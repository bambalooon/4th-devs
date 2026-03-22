import {AI_DEVS_API_KEY} from "../config.js";
import {writeFile} from "fs/promises";

async function downloadFile(url, outputPath) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await writeFile(outputPath, Buffer.from(buffer));
}

await downloadFile(`https://hub.ag3nts.org/data/${AI_DEVS_API_KEY}/categorize.csv`, './categorize.csv')
