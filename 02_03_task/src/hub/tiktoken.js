import {encoding_for_model} from "tiktoken";

export const tiktoken = {
    count_tokens({prompt}) {
        let enc;
        try {
            enc = encoding_for_model("gpt-4.1-mini");
            return enc.encode(prompt).length;
        } finally {
            enc?.free();
        }
    }
}