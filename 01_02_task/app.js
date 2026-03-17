import {AI_DEVS_API_KEY} from "../config.js";
import {writeFile} from "fs/promises";
import https from "https";
import {existsSync} from "fs";

const LOCATION_API_ENDPOINT = "https://hub.ag3nts.org/api/location";
const ACCESS_LEVEL_API_ENDPOINT = "https://hub.ag3nts.org/api/accesslevel";

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

async function findLocation(name, surname) {
  const response = await fetch(LOCATION_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apikey: AI_DEVS_API_KEY,
      name: name,
      surname: surname
    })
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const message = data?.error?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function getAccessLevel(name, surname, birthYear) {
  const response = await fetch(ACCESS_LEVEL_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apikey: AI_DEVS_API_KEY,
      name: name,
      surname: surname,
      birthYear: birthYear
    })
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const message = data?.error?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function main() {
  await downloadFile(`https://hub.ag3nts.org/data/${AI_DEVS_API_KEY}/findhim_locations.json`, './findhim_locations.json')
  console.log(await findLocation("Wojciech", "Bielik"));
  console.log(await getAccessLevel("Wojciech", "Bielik", 1986));
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
