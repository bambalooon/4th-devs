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

async function findFileIdsForReCheck(agentName: string, task: string, uniqueOperatorNotes: string[], operatorNotesToFileIdMap: Map<string, string[]>, parseFailFileIds: string[]) {
  const result = await runAgent(agentName, task, undefined, 0, operatorNotesIdsSchema);
  writeFileSync(`./workspace/result.out`, result);
  const operatorNotesIdsWithProblem: number[] = JSON.parse(result).items;
  const operatorNotesWithProblem = operatorNotesIdsWithProblem
      .map(id => uniqueOperatorNotes[id])
      .map(note => {
        return {note, fileIDs: operatorNotesToFileIdMap.get(note)};
      });

  const operatorNotesWithoutProblem = uniqueOperatorNotes
      .filter((_, i) => !operatorNotesIdsWithProblem.includes(i))
      .map(note => ({note, fileIDs: operatorNotesToFileIdMap.get(note)}));

  const reCheckFileIds: string[] = [];
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
      classification: parseFailFileIds.some(invalidFileId => invalidFileId === fileID) ? 'parse_fail' : 'ok',
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

  const task = `From the provided operator notes, return the IDs of all notes where the operator reports a problem, error, anomaly, or warning.

A note reports a problem ONLY when the operator's overall message describes something NEGATIVE: unstable, concerning, suspicious, unreliable, inconsistent, irregular, doubtful, compromised, unusual, unexpected, not healthy, clearly off, does not match expectations.

A note does NOT report a problem when the operator's overall message describes NORMALCY: stable, coherent, consistent, nominal, healthy, clean, reliable, normal, approved, checks out, within limits. Phrases like "no corrective steps were needed", "the case is cleared", "closed this check without action", "no escalation was triggered", "signed off" all mean EVERYTHING IS FINE.

When uncertain, do NOT flag the note.

Input format: each line is {id}:"{note}".

Examples (do NOT include in output):
  A:"System error detected; requires restart." -> flag (error)
  B:"All systems nominal, no issues." -> skip (nominal)
  C:"No concerning drift is present, consistency maintained." -> skip (no drift)
  D:"This state looks unstable, since this report cannot be treated as normal." -> flag (unstable)
  E:"Tracking data remains coherent, everything remains inside expected limits, therefore the case is cleared." -> skip (coherent, within limits)
  F:"The numbers feel inconsistent, I documented it as a probable fault." -> flag (inconsistent, fault)
  G:"The situation requires attention, because the data flow appears compromised." -> flag (requires attention, compromised)
  H:"System behavior is fully stable, we are still in a safe operating zone, and I closed this check without action." -> skip (fully stable)
  I:"Operational state is consistent, the latest sample fits reference behavior, therefore no corrective steps were needed." -> skip (consistent, no correction needed)
  J:"I can see a clear irregularity, so I opened a deeper diagnostic task." -> flag (irregularity)
  K:"Everything checks out, all control checks passed cleanly, and I recorded a standard pass." -> skip (checks out)
  L:"The current result seems unreliable, so I escalated this for engineering analysis." -> flag (unreliable)
  M:"Current status remains healthy, the platform behaves exactly as intended, and I approved the report as normal." -> skip (healthy, as intended)
  N:"The report does not look healthy, and I ordered an immediate quality audit." -> flag (not healthy)
  O:"Daily monitoring confirms stability, the report matches previous healthy cycles, so I signed off this inspection." -> skip (stability confirmed)

Below are ${uniqueOperatorNotes.length} operator notes. Return the IDs of flagged notes only.
${uniqueOperatorNotes.map((note, i) => `${i}:"${note}"`).join('\n')}
`;
  writeFileSync(`./workspace/prompt.out`, task);
  // const reCheckFileIds = await findFileIdsForReCheck('standard', task, uniqueOperatorNotes, operatorNotesToFileIdMap, parseFailFileIds);
  const reCheckFileIds2 = await findFileIdsForReCheck('another', task, uniqueOperatorNotes, operatorNotesToFileIdMap, parseFailFileIds);

  // const set1 = new Set(reCheckFileIds);
  // const set2 = new Set(reCheckFileIds2);
  //
  // const inBoth = reCheckFileIds.filter(id => set2.has(id));
  // const onlyInFirst = reCheckFileIds.filter(id => !set2.has(id));
  // const onlyInSecond = reCheckFileIds2.filter(id => !set1.has(id));
  // const onlyInOne = new Set(onlyInSecond);
  // onlyInFirst.forEach(id => onlyInOne.add(id));
  // console.log([...onlyInOne].map(id => ({
  //   fileID: id,
  //   note: JSON.parse(readFileSync(`./workspace/data/sensors/${id}.json`, 'utf8')).operator_notes
  // })));

  // await sendAnswer([...reCheckFileIds.sort()]);
  // await new Promise(resolve => setTimeout(resolve, 10 * 1000));
  await sendAnswer([...reCheckFileIds2.sort()]);
  // await new Promise(resolve => setTimeout(resolve, 10 * 1000));
  // await sendAnswer([...inBoth.sort()]);
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
