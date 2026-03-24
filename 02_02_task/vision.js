/**
 * Image Recognition Agent
 */

import log from "./src/helpers/logger.js";
import {logStats} from "./src/helpers/stats.js";
import {AI_DEVS_API_KEY} from "../config.js";
import {vision} from "./src/native/vision.js";

const QUERY = `
Analyze the 3x3 board on both images.

This is empty board in ASCII format:
+---+---+---+
|   |   |   |
|   |   |   |
|   |   |   |
+---+---+---+
|   |   |   |
|   |   |   |
|   |   |   |
+---+---+---+
|   |   |   |
|   |   |   |
|   |   |   |
+---+---+---+

This is board on 1st image in ASCII format:
+---+---+---+
|   |   |   |
| +-|-+-|---|
| | | | |   |
+---+---+---+
| | | | |   |
| | | +-|-+-|
| | | | | | |
+---+---+---+
| | | | | | |
|-+-|-+ | +-|
|   |   |   |
+---+---+---+
 
Following above examples and rules, generate board in ASCII format for 2nd image.
`;

const getImageBase64 = async (image_url) => {
  const response = await fetch(image_url);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

const main = async () => {
  try {
    const result = await vision({
      images: [
        { imageBase64: await getImageBase64(`https://hub.ag3nts.org/i/solved_electricity.png`), mimeType: "image/png" },
        { imageBase64: await getImageBase64(`https://hub.ag3nts.org/data/${AI_DEVS_API_KEY}/electricity.png`), mimeType: "image/png" },
      ],
      question: QUERY
    });

    log.visionResult(result);
    console.log(result);
    logStats();
  } catch (error) {
    throw error;
  }
};

main().catch((error) => {
  log.error("Startup error", error.message);
  process.exit(1);
});
