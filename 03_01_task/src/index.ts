import {runAgent} from './agent.js'
import {readFile} from "node:fs/promises";
import {sendAnswer, SensorDataSchema} from "./task.js";
import {writeFileSync} from "node:fs";

async function main() {
  const parseFailFileIds:string[] = [];
  const operatorNotesToFileIdMap:Map<string, string[]> = new Map();
  for (let i = 1; i < 10000; i++) {
    const fileID = String(i).padStart(4, '0');
    let fileContent, operatorNotes;
    try {
      fileContent = await readFile(`./workspace/data/sensors/${fileID}.json`, 'utf8');
      const result = SensorDataSchema.parse(fileContent);
      operatorNotes = result.operator_notes.toLowerCase();
    } catch (err) {
      parseFailFileIds.push(fileID);
      operatorNotes = JSON.parse(fileContent!).operator_notes;
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
    'Please classify each operator note as "ok" or "problem". If it indicates an error, anomaly or warning then mark it as "problem". If its positive or neutral then mark as "ok".',
    'As result return line separated list of {id}:{result} where result is "ok" or "problem".',
    `Below start notes for classification in format {id}:"{operator_note}". Please classify all ${uniqueOperatorNotes.length} of them.`,
    `${uniqueOperatorNotes.map((note, i) => `${i}:"${note}"`).join('\n')}`,
  ].join('\n');
  writeFileSync(`./workspace/prompt.out`, task); //TODO: JSON schema for expected result?
  const classificationResult = await runAgent('standard', task);
  writeFileSync(`./workspace/result.out`, classificationResult); //TODO: JSON schema for expected result?

  const invalidFileIds:string[] = [];
  type ClassificationResult = 'ok' | 'problem';
  for (const line of classificationResult.trim().split('\n')) {
    const [id, result] = line.split(':') as [number, ClassificationResult];
    switch (result) {
      case 'ok':
        for (const fileId of operatorNotesToFileIdMap.get(uniqueOperatorNotes[id])!) {
          if (parseFailFileIds.some(invalidFileId => invalidFileId === fileId)) {
            invalidFileIds.push(fileId);
          }
        }
        break;
      case 'problem':
        for (const fileId of operatorNotesToFileIdMap.get(uniqueOperatorNotes[id])!) {
          if (!parseFailFileIds.some(invalidFileId => invalidFileId === fileId)) {
            invalidFileIds.push(fileId);
          }
        }
    }
  }
  // parseFailFileIds.forEach(fileId => invalidFileIds.push(fileId));

  await sendAnswer([...invalidFileIds]);
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
