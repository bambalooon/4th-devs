/**
 * Image Recognition Agent
 */

import log from "./src/helpers/logger.js";
import {AI_DEVS_API_KEY} from "../config.js";
import sharp from "sharp";
import {exec} from "child_process";
import {writeFileSync} from "fs";
import {vision} from "./src/native/vision.js";

const MIME_TYPE = "image/png";

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
| XX|XXX|XXX|
| X | X |   |
+---+---+---+
| X | X |   |
| X | XX|XXX|
| X | X | X |
+---+---+---+
| X | X | X |
|XXX|XX | XX|
|   |   |   |
+---+---+---+
 
Following above examples and rules, generate board in ASCII format for 2nd image.
`;

const getImageBase64 = async (image_url) => {
  const response = await fetch(image_url);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

const toBlackAndWhiteBase64 = async (imageBase64) => {
  const buffer = Buffer.from(imageBase64, "base64");
  const bwBuffer = await sharp(buffer).grayscale().threshold(128).toBuffer();
  return bwBuffer.toString("base64");
};

const cropImage = async (imageBase64, { left, top, width, height }) => {
  const buffer = Buffer.from(imageBase64, "base64");
  const sliced = await sharp(buffer)
      .extract({ left, top, width, height })
      .toBuffer();
  return sliced.toString("base64");
};

const showImage = (imageBase64, filename = "preview.png") => {
  const path = `./cropped-${filename}`;
  writeFileSync(path, Buffer.from(imageBase64, "base64"));
  // exec(`xdg-open ${path}`);
};

const main = async () => {
  try {
    const solvedState = await cropImage(await getImageBase64(`https://hub.ag3nts.org/i/solved_electricity.png`), { left: 140, top: 88, width: 290, height: 290 });
    const currentState = await cropImage(await getImageBase64(`https://hub.ag3nts.org/data/${AI_DEVS_API_KEY}/electricity.png`), { left: 236, top: 98, width: 290, height: 290 });
    showImage(solvedState, 'solved.png');
    showImage(currentState, 'current.png');
    // showImage(await toBlackAndWhiteBase64(solvedOrig));

    const result = await vision({
      images: [
        { imageBase64: solvedState, mimeType: MIME_TYPE },
        { imageBase64: currentState, mimeType: MIME_TYPE },
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
