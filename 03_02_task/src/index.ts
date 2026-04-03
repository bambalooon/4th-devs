import "./instrumentation"; // Must be the first import
import {runAgent} from './agent.js'
import {readFile} from "node:fs/promises";
import {sendAnswer, SensorDataSchema} from "./task.js";
import {writeFileSync} from "node:fs";
import {readFileSync} from "fs";
import {langfuse} from "./instrumentation.js";
import {TextPromptClient} from "@langfuse/client";

const BATCH_SIZE = 100;

const operatorNotesIdsSchema = {
  type: "json_schema",
  json_schema: {
    name: "operator_notes_ids",
    strict: true,
    schema: {
      type: "object",
      description: "IDs of operator notes that were classified as anomaly, error or warning.",
      properties: {
        items: {
          type: "array",
          description: "Array of operator note IDs.",
          items: {
            type: "number",
            description: "ID of operator note that was classified as anomaly, error or warning.",
          }
        }
      },
      required: ["items"],
      additionalProperties: false
    }
  }
};

function buildClassificationTask(prompt: TextPromptClient, notes: string[], startIndex: number): string {
  return prompt.compile({
    notesLength: notes.length.toString(),
    startIndex: startIndex.toString(),
    endIndex: (startIndex + notes.length - 1).toString(),
    notes: notes.map((note, i) => `${startIndex + i}:"${note}"`).join('\n')
  });
}

async function classifyNotesInBatches(agentName: string, uniqueOperatorNotes: string[]): Promise<number[]> {
  const prompt:TextPromptClient = await langfuse.prompt.get("operator-notes-classifier");
  const allFlagged: number[] = [];
  const totalBatches = Math.ceil(uniqueOperatorNotes.length / BATCH_SIZE);

  for (let start = 0; start < uniqueOperatorNotes.length; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE, uniqueOperatorNotes.length);
    const batch = uniqueOperatorNotes.slice(start, end);
    const batchNum = Math.floor(start / BATCH_SIZE) + 1;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Batch ${batchNum}/${totalBatches}] Classifying notes ${start}-${end - 1}... (attempt ${attempt})`);
        const task = buildClassificationTask(prompt, batch, start);
        const result = await runAgent(agentName, task, undefined, 0, operatorNotesIdsSchema);
        const flaggedIds: number[] = JSON.parse(result).items;
        allFlagged.push(...flaggedIds);
        console.log(`[Batch ${batchNum}/${totalBatches}] Flagged ${flaggedIds.length} notes: ${flaggedIds.join(',')}`);
        break;
      } catch (err) {
        console.error(`[Batch ${batchNum}/${totalBatches}] Attempt ${attempt} failed:`, err instanceof Error ? err.message : err);
        if (attempt === 3) throw err;
        const delay = attempt * 5_000;
        console.log(`Retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  return allFlagged;
}

async function findFileIdsForReCheck(agentName: string, uniqueOperatorNotes: string[], operatorNotesToFileIdMap: Map<string, string[]>, parseFailFileIds: string[]) {
  const operatorNotesIdsWithProblem = await classifyNotesInBatches(agentName, uniqueOperatorNotes);
  writeFileSync(`./workspace/result.out`, JSON.stringify({items: operatorNotesIdsWithProblem}));
  console.log(`Total flagged: ${operatorNotesIdsWithProblem.length} out of ${uniqueOperatorNotes.length}`);

  const parseFailSet = new Set(parseFailFileIds);

  // ALL parse_fail files are anomalies (bad sensor data — definitions #1, #4)
  const reCheckFileIds: string[] = [...parseFailFileIds];
  console.log(`Parse-fail files (bad data): ${parseFailFileIds.length}`);

  // Also add ok-data files where operator reports a problem (incorrect note — definition #3)
  const operatorNotesWithProblem = operatorNotesIdsWithProblem
      .map(id => uniqueOperatorNotes[id])
      .map(note => ({note, fileIDs: operatorNotesToFileIdMap.get(note)}));

  let okWithProblemNote = 0;
  for (const {note, fileIDs} of operatorNotesWithProblem) {
    for (const fileId of fileIDs!) {
      if (!parseFailSet.has(fileId)) {
        reCheckFileIds.push(fileId);
        okWithProblemNote++;
      }
    }
  }
  console.log(`Ok-data files with problem notes: ${okWithProblemNote}`);
  console.log(`Total anomalies: ${reCheckFileIds.length}`);

  const reCheckOperatorNotes = reCheckFileIds.sort().map(fileID => {
    return {
      fileID: fileID,
      classification: parseFailSet.has(fileID) ? 'parse_fail' : 'ok',
      note: JSON.parse(readFileSync(`./workspace/data/sensors/${fileID}.json`, 'utf8')).operator_notes
    };
  });
  writeFileSync(`./workspace/recheck.out.${Date.now()}`, reCheckOperatorNotes
      .map(({fileID, classification, note}) => `${fileID}:${classification}:${note}`)
      .join('\n'));
  return reCheckFileIds;
}

async function main() {
  const parseFailFileIds:string[] = [];
  const operatorNotesToFileIdMap:Map<string, string[]> = new Map();
  for (let i = 1; i < 10_000; i++) {
    const fileID = String(i).padStart(4, '0');
    let fileContent, operatorNotes;
    try {
      fileContent = await readFile(`./workspace/data/sensors/${fileID}.json`, 'utf8');
      const result = SensorDataSchema.parse(fileContent);
      operatorNotes = result.operator_notes.toLowerCase();
    } catch (err) {
      parseFailFileIds.push(fileID);
      operatorNotes = JSON.parse(fileContent!).operator_notes.toLowerCase();
      console.error(`Error processing file ${fileID}`);
    }
    if (operatorNotesToFileIdMap.has(operatorNotes)) {
      operatorNotesToFileIdMap.get(operatorNotes)!.push(fileID);
    } else {
      operatorNotesToFileIdMap.set(operatorNotes, [fileID]);
    }
  }
  const uniqueOperatorNotes:string[] = operatorNotesToFileIdMap.keys().toArray();
  console.log(uniqueOperatorNotes.length);

  const reCheckFileIds = await findFileIdsForReCheck('another', uniqueOperatorNotes, operatorNotesToFileIdMap, parseFailFileIds);

  await sendAnswer([...reCheckFileIds.sort()]);
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
