import {
  AI_DEVS_API_KEY,
} from "../config.js";
import { writeFile } from "fs/promises";
import https from "https";
import { existsSync, readFileSync } from "fs";
import { parse } from "csv-parse/sync";

async function downloadFile(url, outputPath) {
  if (existsSync(outputPath)) {
    console.log(`File already exists: ${outputPath}, skipping download.`);
    return;
  }
  const agent = new https.Agent({ rejectUnauthorized: false });

  const response = await fetch(url, { agent });

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await writeFile(outputPath, Buffer.from(buffer));
}

function calculateAge(birthDateStr) {
  const birth = new Date(birthDateStr);
  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();

  // Adjust if birthday hasn't occurred yet this year
  const hasBirthdayPassed =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());

  if (!hasBirthdayPassed) age--;

  return age;
}

async function main() {
  await downloadFile(`https://hub.ag3nts.org/data/${AI_DEVS_API_KEY}/people.csv`, './people.csv')
  const content = readFileSync("./people.csv", "utf-8");
  const people = parse(content, {
    columns: true,       // use first row as keys
    skip_empty_lines: true,
    trim: true,
  });
  console.log(people.filter(person => person.gender == 'M' && person.birthPlace == 'Grudziądz' && calculateAge(person.birthDate) >= 20 && calculateAge(person.birthDate) <= 40));
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
