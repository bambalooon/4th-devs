import {AI_DEVS_API_KEY} from "../../config.js";

export const zMailHandler = async (action:string, args:any) => {
    const request = {
        apikey: AI_DEVS_API_KEY,
        action: action,
        page: args.page
    }
    console.log(request);
    const response = await fetch("https://hub.ag3nts.org/api/zmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
    });

    const data = await response.json();
    console.log(JSON.stringify(data));
    return data;
};

export const sendAnswerHandler = async(password:string, date:string, confirmationCode:string) => {
    const request = {
        apikey: AI_DEVS_API_KEY,
        password: password,
        date: date,
        confirmation_code: confirmationCode
    }
    console.log(request);
    const response = await fetch("https://hub.ag3nts.org/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
    });

    const data = await response.json();
    console.log(data);
    return data;
};