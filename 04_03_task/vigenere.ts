/**
 * Decodes a Vigenère ciphered message.
 * @param cipherText - The message to decode.
 * @param key - The secret key used for encryption.
 * @returns The decoded plain text.
 */
function decodeVigenere(cipherText: string, key: string): string {
    let plainText = "";
    const keyUpper = key.toUpperCase();
    let keyIndex = 0;

    for (let i = 0; i < cipherText.length; i++) {
        const char = cipherText[i];

        // Check if the character is a letter
        if (/[a-zA-Z]/.test(char)) {
            const isUpperCase = char === char.toUpperCase();
            const cipherCharCode = char.toUpperCase().charCodeAt(0) - 65;
            const keyCharCode = keyUpper[keyIndex % keyUpper.length].charCodeAt(0) - 65;

            // Apply the Vigenère decryption formula
            let decodedCharCode = (cipherCharCode - keyCharCode + 26) % 26;

            // Convert back to ASCII (65 is 'A')
            let decodedChar = String.fromCharCode(decodedCharCode + 65);

            plainText += isUpperCase ? decodedChar : decodedChar.toLowerCase();

            // Only increment key index if we processed a letter
            keyIndex++;
        } else {
            // Keep spaces, numbers, and punctuation as they are
            plainText += char;
        }
    }

    return plainText;
}

// Example usage:
const encodedMessage = "mkhnf://czs.oe3aox.ffe/qvsv/oxnujc_gcpmjk.an4";
const secretKey = "froynv";

const result = decodeVigenere(encodedMessage, secretKey);
console.log(`Decoded: ${result}`);
// Output: "O jakim zwierzęciu na pierwszej randce?"