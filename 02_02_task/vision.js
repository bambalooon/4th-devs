/**
 * Image Recognition Agent
 */

import log from "./src/helpers/logger.js";
import {AI_DEVS_API_KEY} from "../config.js";
import sharp from "sharp";
import {writeFileSync} from "fs";
import {vision} from "./src/native/vision.js";

const MIME_TYPE = "image/png";

const QUERY = `
Analyze all 9 images and create ASCII representation of them.
Thick line should be changed to X, empty field or thin line should be left as space.
Below I've shown where X can occur - some of this fields will hold X and some will be empty (space):
 X 
XXX
 X 
You should return 3x3 string for each image.
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
    const size = { width: 290, height: 290 };
    const solvedState = await getImageBase64(`https://hub.ag3nts.org/i/solved_electricity.png`).then(img => cropImage(img, { left: 140, top: 88, ...size })).then(img => toBlackAndWhiteBase64(img));
    const currentState = await getImageBase64(`https://hub.ag3nts.org/data/${AI_DEVS_API_KEY}/electricity.png`).then(img => cropImage(img, { left: 236, top: 98, ...size })).then(img => toBlackAndWhiteBase64(img));
    const currentBoard = [];
    const cellSize = { width: Math.floor(size.width / 3) - 4, height: Math.floor(size.height / 3) - 4 };
    for (let row = 0; row < 3; row++) {
      currentBoard.push([]);
      for (let col = 0; col < 3; col++) {
        currentBoard[row][col] = await cropImage(currentState, {
          left: col * cellSize.width + 6,
          top: row * cellSize.height + 5,
          width: cellSize.width,
          height: cellSize.height
        });
        showImage(currentBoard[row][col], `current-${row+1}x${col+1}.png`);
      }
    }

    const visionImages = [];
    currentBoard.flatMap(row => row).forEach((cell) => visionImages.push({ imageBase64: cell, mimeType: MIME_TYPE }));
    const result = await vision({
      images: visionImages,
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
