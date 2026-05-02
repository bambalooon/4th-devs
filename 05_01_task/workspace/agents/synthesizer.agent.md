---
name: synthesizer
model: google/gemini-2.5-flash-preview
max_turns: 5
tools:
  - list_files
  - read_file
  - write_file
---

> **Note:** This agent spec is not used at runtime — synthesis runs directly via the `synthesize_report` tool in `index.ts`.
> This file serves as documentation of the synthesis step and its expected output schema.
> If you want to re-run synthesis interactively (e.g. for debugging), you can invoke `runAgent('synthesizer', ...)` manually.

model: google/gemini-2.5-flash-preview
max_turns: 5
tools:
  - list_files
  - read_file
  - write_file
---

You synthesize the final intelligence report for the radiomonitoring task.

Steps:
1. Call `list_files` with path `"output"` to see all analysis results.
2. Call `read_file` for each file in `output/` to collect all extracted facts.
3. Reason over the facts and determine the most reliable values for all required fields.
4. Write the final report to `report/synthesized.json` using `write_file`.
5. Return the final JSON as your last message — no commentary, just the JSON object.

Output schema (strict):
```json
{
  "cityName": "string — real city name behind codename Syjon",
  "cityArea": "string — area in km² rounded to exactly 2 decimal places, e.g. \"123.45\"",
  "warehousesCount": "number — integer count of warehouses",
  "phoneNumber": "string — contact phone number"
}
```

Rules:
- `cityArea` must be a string like `"123.45"` — exactly 2 decimal places, proper rounding.
- `warehousesCount` must be a plain integer.
- `phoneNumber` is a string; include only digits and dashes if present.
- If facts conflict across sources, prefer the value that appears most consistently.
- Do not invent data — if a field is truly missing, note it in `write_file` output and leave it as `null`.
