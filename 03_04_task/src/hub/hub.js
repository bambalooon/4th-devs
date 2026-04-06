import {AI_DEVS_API_KEY} from "../../../config.js";

export const hub = {
    async sendLogs(logs) {
        try {
            const request = {
                apikey: AI_DEVS_API_KEY,
                task: "failure",
                answer: {
                    logs: logs
                }
            }
            console.log("API request: ", request);

            const response = await fetch("https://hub.ag3nts.org/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(request)
            });

            const result = await response.json();
            if (!response.ok) {
                return {
                    isError: true,
                    message: `Send logs call failed with response status ${response.status}`,
                    result: result
                }
            }

            console.log("API call result: ", result);
            return result;
        } catch (error) {
            return {
                message: error.message,
                isError: true
            };
        }
    }
}