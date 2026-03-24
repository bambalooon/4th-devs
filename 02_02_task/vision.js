/**
 * Image Recognition Agent
 */

import log from "./src/helpers/logger.js";
import {logStats} from "./src/helpers/stats.js";
import {AI_DEVS_API_KEY} from "../config.js";
import {vision} from "./src/native/vision.js";

const QUERY = `
Analyze the 3x3 board.
Draw it in simple ASCII format - only board and return as result.

This is empty board:
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

Example board:
+---+---+---+
|   | | |   |
|-+-| | |---|
| | | | |   |
+---+---+---+
| | |   |   |
| |-|   |   |
| | |   |   |
+---+---+---+
|   | | |   |
|   |-+ |   |
|   |   |   |
+---+---+---+

Please keep this format, if lines connect in the center then put '+' there.
`;

const main = async () => {
  try {
    const response = await fetch(`https://hub.ag3nts.org/data/${AI_DEVS_API_KEY}/electricity.png`);
    if (!response.ok) {
      return {
        isError: true,
        message: `Failed to download image: ${response.status} ${response.statusText}`
      }
    }

    const buffer = await response.arrayBuffer();
    const imageBase64 = Buffer.from(buffer).toString("base64");

    const result = await vision({
      imageBase64,
      mimeType: "image/png",
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
