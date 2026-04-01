import {runAgent} from './agent.js'
import {readFile} from "node:fs/promises";
import {sendAnswer, SensorDataSchema} from "./task.js";
import {writeFileSync} from "node:fs";
import {readFileSync} from "fs";

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

  const task = [
    'Please found all operator notes that indicate an error, anomaly or warning.',
    'As a result return a list of IDs for these notes separated by ",".',
    `Below start operator notes for classification in format {id}:"{operator_note}". Please classify all ${uniqueOperatorNotes.length} of them.`,
    `${uniqueOperatorNotes.map((note, i) => `${i}:"${note}"`).join('\n')}`,
  ].join('\n');
  writeFileSync(`./workspace/prompt.out`, task);
  const result = await runAgent('standard', task, undefined, operatorNotesIdsSchema);
  writeFileSync(`./workspace/result.out`, result);
  const operatorNotesIdsWithProblem:number[] = JSON.parse(result).items;
  const operatorNotesWithProblem = operatorNotesIdsWithProblem
      .map(id => uniqueOperatorNotes[id])
      .map(note => {
        return { note, fileIDs: operatorNotesToFileIdMap.get(note)};
      });

  const operatorNotesWithoutProblem = uniqueOperatorNotes
      .filter((_, i) => !operatorNotesIdsWithProblem.includes(i))
      .map(note => ({ note, fileIDs: operatorNotesToFileIdMap.get(note) }));

  const reCheckFileIds:string[] = [];
  for (const {note, fileIDs} of operatorNotesWithProblem) {
    for (const fileId of fileIDs!) {
      if (!parseFailFileIds.some(invalidFileId => invalidFileId === fileId)) {
        reCheckFileIds.push(fileId);
      }
    }
  }
  for (const {note, fileIDs} of operatorNotesWithoutProblem) {
    for (const fileId of fileIDs!) {
      if (parseFailFileIds.some(invalidFileId => invalidFileId === fileId)) {
        reCheckFileIds.push(fileId);
      }
    }
  }

  const reCheckOperatorNotes = reCheckFileIds.sort().map(fileID => {
    return {
      fileID: fileID,
      note: JSON.parse(readFileSync(`./workspace/data/sensors/${fileID}.json`, 'utf8')).operator_notes
    };
  });
  writeFileSync(`./workspace/recheck.out.${Date.now()}`, reCheckOperatorNotes
      .map(({ fileID, note }) => `${fileID}:${note}`)
      .join('\n'));

  await sendAnswer([...reCheckFileIds.sort()]);
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
