import {AI_DEVS_API_KEY} from "../config.js";

const answer = {
    apikey: AI_DEVS_API_KEY,
    task: "phonecall",
    answer: {
        action: "start"
    }
}
console.log(answer);
const response = await fetch("https://hub.ag3nts.org/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(answer)
});

const data = await response.json();
console.log(JSON.stringify(data));