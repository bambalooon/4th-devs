import {
  AI_DEVS_API_KEY,
  AI_API_KEY,
  EXTRA_API_HEADERS,
  RESPONSES_API_ENDPOINT,
  resolveModelForProvider
} from "../config.js";
import { writeFile } from "fs/promises";
import https from "https";
import { existsSync, readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { extractResponseText } from "./helpers.js";

const MODEL = resolveModelForProvider("gpt-4o-mini");

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

async function classifyJobs(prompt) {
  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS
    },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      text: { format: jobTagsSchema }
    })
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const message = data?.error?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  const outputText = extractResponseText(data);

  if (!outputText) {
    throw new Error("Missing text output in API response");
  }

  return JSON.parse(outputText);
}

export const JOB_TAGS = [
  "IT",
  "transport",
  "edukacja",
  "medycyna",
  "praca z ludźmi",
  "praca z pojazdami",
  "praca fizyczna"
];

const jobTagsSchema = {
  type: "json_schema",
  name: "job_tags_classification",
  strict: true,
  schema: {
    type: "object",
    description: "Extracted job tags for a given job description text.",
    properties: {
      job_tags: {
        type: "array",
        description: "Extracted job ID and tags for this job description text.",
        items: {
          type: "object",
          properties: {
            id: {
              type: "number",
              description: "Job description ID defined at the beginning of job description text, e.g. '#1234: job description text...'"
            },
            tags: {
              type: "array",
              items: { type: "string", enum: JOB_TAGS },
              minItems: 1,
              description: "Job description tags relevant to the job description text. Select all that apply from the following list: IT, transport, edukacja, medycyna, praca z ludźmi, praca z pojazdami, praca fizyczna."
            }
          },
          required: ["id", "tags"],
          additionalProperties: false
        }
      }
    },
    required: ["job_tags"],
    additionalProperties: false
  }
};

async function main() {
  await downloadFile(`https://hub.ag3nts.org/data/${AI_DEVS_API_KEY}/people.csv`, './people.csv')
  const content = readFileSync("./people.csv", "utf-8");
  const people = parse(content, {
    columns: true,       // use first row as keys
    skip_empty_lines: true,
    trim: true,
  });
  const filteredPeople = people.filter(person =>
    person.gender == 'M'
    && person.birthPlace == 'Grudziądz'
    && calculateAge(person.birthDate) >= 20
    && calculateAge(person.birthDate) <= 40
  ).sort((a, b) => a.surname.localeCompare(b.surname) || a.name.localeCompare(b.name));

  const prompt = `Each line defines job ID and description, e.g. #1234: Job description text, where 1234 is the job ID and text after ':' is job description.
  Classify each job description into one or more of the following categories: IT, transport, method, edukacja, medycyna, praca z ludźmi, praca z pojazdami, praca fizyczna.
  Return JSON with job IDs and their corresponding tags.
  Below is the list of job descriptions to classify:
  ${filteredPeople.map((p, index) => `#${index + 1}: ${p.job}`).join("\n")}`;
  let result = await classifyJobs(prompt);
  const mergedResult = result.job_tags.map(job => ({ ...filteredPeople[job.id - 1], tags: job.tags }));
  const finalPeople = mergedResult.filter(p => p.tags.includes("transport"));
  const answerPeople = finalPeople.map(p => ({ name: p.name, surname: p.surname, gender: p.gender, born: new Date(p.birthDate).getFullYear(), city: p.birthPlace, tags: p.tags }));
  const answer = {
    apikey: AI_DEVS_API_KEY,
    task: "people",
    "answer": answerPeople
  }
  const response = await fetch("https://hub.ag3nts.org/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(answer)
  });

  const data = await response.json();
  console.log(data);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
