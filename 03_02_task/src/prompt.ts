import { LangfuseClient } from "@langfuse/client";

const USER_PROMPT = `From the provided operator notes, return the IDs of all notes where the operator reports a problem, error, anomaly, or warning.

A note reports a problem ONLY when the operator's overall message describes something NEGATIVE: unstable, concerning, suspicious, unreliable, inconsistent, irregular, doubtful, compromised, unusual, unexpected, not healthy, clearly off, does not match expectations, questionable.

A note does NOT report a problem when the operator's overall message describes NORMALCY: stable, coherent, consistent, nominal, healthy, clean, reliable, normal, approved, checks out, within limits, reassuring. Phrases like "no corrective steps were needed", "the case is cleared", "closed this check without action", "no escalation was triggered", "signed off" all mean EVERYTHING IS FINE.

When uncertain, do NOT flag the note.

Input format: each line is {id}:"{note}".

Examples (do NOT include in output):
  A:"System error detected; requires restart." -> flag (error)
  B:"All systems nominal, no issues." -> skip (nominal)
  C:"No concerning drift is present, consistency maintained." -> skip (no drift)
  D:"This state looks unstable, since this report cannot be treated as normal." -> flag (unstable)
  E:"Tracking data remains coherent, everything remains inside expected limits, therefore the case is cleared." -> skip (coherent, within limits)
  F:"The numbers feel inconsistent, I documented it as a probable fault." -> flag (inconsistent, fault)
  G:"The situation requires attention, because the data flow appears compromised." -> flag (requires attention, compromised)
  H:"System behavior is fully stable, we are still in a safe operating zone, and I closed this check without action." -> skip (fully stable)
  I:"Operational state is consistent, the latest sample fits reference behavior, therefore no corrective steps were needed." -> skip (consistent, no correction needed)
  J:"I can see a clear irregularity, so I opened a deeper diagnostic task." -> flag (irregularity)
  K:"Everything checks out, all control checks passed cleanly, and I recorded a standard pass." -> skip (checks out)
  L:"The current result seems unreliable, so I escalated this for engineering analysis." -> flag (unreliable)
  M:"Current status remains healthy, the platform behaves exactly as intended, and I approved the report as normal." -> skip (healthy, as intended)
  N:"The report does not look healthy, and I ordered an immediate quality audit." -> flag (not healthy)
  O:"Daily monitoring confirms stability, the report matches previous healthy cycles, so I signed off this inspection." -> skip (stability confirmed)

Below are {{notesLength}} operator notes (IDs {{startIndex}} to {{endIndex}}). Return the IDs of flagged notes only.
{{notes}}
`;

// Load .env when running without --env-file flag (e.g. npx tsx src/index.ts)
try { process.loadEnvFile(".env"); } catch { /* already loaded or file missing */ }

// Initialize the Langfuse client
const langfuse = new LangfuseClient();

// Create a chat prompt
await langfuse.prompt.create({
    name: "operator-notes-classifier",
    type: "text",
    prompt: USER_PROMPT,
    labels: ["production"] // optionally, directly promote to production
});