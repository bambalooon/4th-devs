import {existsSync} from "fs";
import https from "https";
import {writeFile} from "fs/promises";

export default async function downloadFile(url, outputDir = ".") {
    const outputPath = `${outputDir}/${url.split("/").slice(-1)[0]}`;
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
