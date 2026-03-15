import {
  AI_DEVS_API_KEY,
  AI_API_KEY,
  EXTRA_API_HEADERS,
  RESPONSES_API_ENDPOINT,
  resolveModelForProvider
} from "../config.js";
import { writeFile } from "fs/promises";
import https from "https";
import { existsSync } from "fs";

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

async function main() {
    downloadFile(`https://hub.ag3nts.org/data/${AI_DEVS_API_KEY}/people.csv`, './people.csv')
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
