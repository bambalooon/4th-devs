import "./instrumentation"; // Must be the first import
import {runAgent} from './agent.js'

const USER_PROMPT = `Your task: get the firmware binary running and retrieve the confirmation code.

Target binary: /opt/firmware/cooler/cooler.bin

Steps:
1. Run "help" to discover available shell commands.
2. Explore /opt/firmware/cooler/ — read all files, especially settings.ini.
3. Try running the binary and read error messages carefully.
4. Search the filesystem for the password (check /home, /var, /tmp, and other accessible locations — NOT /etc, /root, /proc).
5. Fix settings.ini based on what you learn from errors and documentation.
6. Run the binary again with the correct configuration and password.
7. When you see the ECCS-... code, send it using send_answer.

Important: Start with "help" — this shell has non-standard commands.`;

async function main() {
  console.log("Starting firmware agent...");
  const result = await runAgent('standard', USER_PROMPT);
  console.log("Agent finished. Result:", result);
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
