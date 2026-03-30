import {runAgent} from './agent.js'
import {readFile} from "node:fs/promises";
import {SensorDataSchema} from "./task.js";
import {writeFileSync} from "node:fs";

async function main() {
  const invalidFileIds:string[] = [];
  const operatorNotesToFileIdMap:Map<string, string[]> = new Map();
  for (let i = 1; i < 1000; i++) {
    const fileID = String(i).padStart(4, '0');
    let fileContent;
    try {
      fileContent = await readFile(`./workspace/data/sensors/${fileID}.json`, 'utf8');
      const result = SensorDataSchema.parse(fileContent);
      const operatorNotes = result.operator_notes.toLowerCase();
      if (operatorNotesToFileIdMap.has(operatorNotes)) {
        operatorNotesToFileIdMap.get(operatorNotes)!.push(fileID);
      } else {
        operatorNotesToFileIdMap.set(operatorNotes, [fileID]);
      }
    } catch (err) {
      invalidFileIds.push(fileID);
      console.error(`Error processing file ${fileID}`);
    }
  }
  const uniqueOperatorNotes:string[] = operatorNotesToFileIdMap.keys().toArray();
  // console.log(operatorNotesToFileIdMap.keys());
  // console.log(invalidFileIds);

  const task = [
    'Please classify each operator note as "ok" or "problem" based on whether it indicates an anomaly in the sensor data.',
    'As result return line separated list of {id}:{result} where result is "ok" or "problem".',
    `${uniqueOperatorNotes.map((i, note) => `Note ${i}:"${note}"`).join('\n')}`,
  ].join('\n')

  const result = await runAgent('standard', task);
  writeFileSync(`./workspace/result.out`, result); //TODO: JSON schema for expected result?
  // operatorNotes -> to LLM with some ID - LLM says if note says there is anomaly or no
  // add all fileIDs with anomalies to array and send
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
