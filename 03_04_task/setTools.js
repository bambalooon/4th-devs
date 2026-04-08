import {AI_DEVS_API_KEY} from "../config.js";

const answer = {
    apikey: AI_DEVS_API_KEY,
    task: "negotiations",
    answer: {
        tools: [
            {
                URL: "https://azyl-57637.ag3nts.org",
                description: "Give item description in params field and we'll return list of cities where you can find this item. Example JSON request: {\"params\": \"laptop\"}"
            }
        ]
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