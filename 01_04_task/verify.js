import {AI_DEVS_API_KEY} from "../config.js";
import { readFileSync } from "fs";


const declaration = readFileSync("./workspace/result.txt", 'utf8');

const answer = {
    apikey: AI_DEVS_API_KEY,
    task: "sendit",
    answer: {
        declaration: declaration
    }
}
console.log(answer);
const response = await fetch("https://hub.ag3nts.org/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(answer)
});

const data = await response.json();
console.log(data);