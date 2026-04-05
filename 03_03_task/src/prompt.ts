import { LangfuseClient } from "@langfuse/client";

const USER_PROMPT = `Your task: get the firmware binary /opt/firmware/cooler/cooler.bin running correctly and retrieve the ECCS confirmation code it outputs.

## Workflow

### Phase 1 — Discover available commands
1. Run "help" first to see all available shell commands and their syntax.
2. Note which commands exist — this is a non-standard shell, so standard Linux commands may not work. Pay special attention to how files are edited.

### Phase 2 — Explore the firmware directory
1. List the contents of /opt/firmware/cooler/ and any subdirectories.
2. Read settings.ini and any other config/documentation files you find.
3. Try to run /opt/firmware/cooler/cooler.bin and carefully read the error message.

### Phase 3 — Find the password
1. The password is stored in several places in the filesystem.
2. Search broadly: check home directories, common data locations (/var, /tmp, /opt, etc.).
3. Look for text files, hidden files, README files, notes, or anything that might contain credentials.
4. If there is a .gitignore in any directory, read it first and avoid the files/dirs listed there.
5. NEVER look in /etc, /root, or /proc — these are forbidden.

### Phase 4 — Configure and run
1. Based on error messages from the binary and any documentation you find, update settings.ini as needed.
2. Use the shell's file editing capabilities (discovered from "help") to modify the config.
3. Run the binary again. If it asks for a password, provide it.
4. Iterate: read errors → fix config → retry.

### Phase 5 — Send the answer
1. When the binary outputs a code matching ECCS-xxxx..., call send_answer with that exact code.

## Important
- Always start with "help" — the shell has non-standard commands.
- Read ALL output carefully before acting.
- The binary needs correct configuration in settings.ini AND the password to produce the ECCS code.`;

// Load .env when running without --env-file flag (e.g. npx tsx src/index.ts)
try { process.loadEnvFile(".env"); } catch { /* already loaded or file missing */ }

// Initialize the Langfuse client
const langfuse = new LangfuseClient();

// Create a text prompt
await langfuse.prompt.create({
    name: "firmware-task",
    type: "text",
    prompt: USER_PROMPT,
    labels: ["production"] // optionally, directly promote to production
});

console.log("Prompt 'firmware-task' uploaded to Langfuse.");
