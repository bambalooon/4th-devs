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
  const result = await runAgent(agentName, task, undefined, operatorNotesIdsSchema);
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
      note: JSON.parse(readFileSync(`./workspace/data/sensors/${fileID}.json`, 'utf8')).operator_notes
    };
  });
  writeFileSync(`./workspace/recheck.out.${Date.now()}`, reCheckOperatorNotes
      .map(({fileID, note}) => `${fileID}:${note}`)
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

  const task = `Classify each operator note below as PROBLEM or OK using the rules from your instructions. Return ONLY the IDs of PROBLEM notes.

Few-shot examples (do NOT include these in output):
  9901:"System error detected; requires restart." -> PROBLEM
  9902:"All systems nominal, no issues." -> OK
  9903:"No concerning drift is present, consistency maintained." -> OK
  9904:"This state looks unstable, since this report cannot be treated as normal, and I submitted it for root-cause analysis." -> PROBLEM
  9905:"Tracking data remains coherent, everything remains inside expected limits, therefore the case is cleared for the present monitoring cycle." -> OK
  9906:"The situation requires attention, because the data flow appears compromised." -> PROBLEM
  9907:"System behavior is fully stable, we are still in a safe operating zone, and I closed this check without action for this routine audit." -> OK
  9908:"Operational state is consistent, the latest sample fits reference behavior, therefore no corrective steps were needed for this operational pass." -> OK
  9909:"I can see a clear irregularity, since this report cannot be treated as normal, so I opened a deeper diagnostic task." -> PROBLEM
  9910:"Daily monitoring confirms stability, the report matches previous healthy cycles, so I signed off this inspection." -> OK

Output format: return the IDs of PROBLEM notes in the "items" array. If none are problems, return an empty array.

Below are ${uniqueOperatorNotes.length} operator notes to classify.
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
