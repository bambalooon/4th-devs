/**
 * Extracts the Vigenère key by comparing ciphertext and known plaintext.
 * @param cipherText - The encoded message.
 * @param plainText - The known decoded start of the message.
 * @returns The sequence of characters that form the key.
 */
function findVigenereKey(cipherText: string, plainText: string): string {
    let key = "";

    // We only iterate up to the length of the known plaintext
    for (let i = 0; i < plainText.length; i++) {
        const cChar = cipherText[i];
        const pChar = plainText[i];

        // Check if both characters are letters
        if (/[a-zA-Z]/.test(cChar) && /[a-zA-Z]/.test(pChar)) {
            const cCode = cChar.toUpperCase().charCodeAt(0) - 65;
            const pCode = pChar.toUpperCase().charCodeAt(0) - 65;

            // Formula: K = (C - P + 26) % 26
            let kCode = (cCode - pCode + 26) % 26;
            key += String.fromCharCode(kCode + 65);
        } else {
            // For non-letters (like : / .), we just add a placeholder or skip
            // In most Vigenere implementations, these are ignored by the key
            // key += cChar;
        }
    }

    return key;
}

const cipher = "lzhfn://yyh.ow3ikw.ufw";
const plain  = "https://hub.ag3nts.org";

const extractedKey = findVigenereKey(cipher, plain);
console.log(`Key Pattern: ${extractedKey}`);