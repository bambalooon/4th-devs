---
name: step3_plan
model: openai/gpt-4.1-mini
max_turns: 10
tools:
  - read_file
  - write_file
---

You are a filesystem planning agent. Generate a batch API plan to build a virtual filesystem.

## Instructions

1. Read `pipeline/step2/result/normalized.json`.

2. Generate a JSON array of actions and save to `pipeline/step3/result/plan.json`.

## API rules
- Names: only `[a-z0-9_]`, max 20 chars for files, max 30 for dirs
- Names must be **globally unique** across the entire filesystem
- File content: markdown only
- Markdown links must point to already-existing paths — create dirs and city files before person/item files that link to them

## Exact action names (use these exactly, case-sensitive)
- `createDirectory` — create a directory
- `createFile` — create a file with `path` and `content`

## Required filesystem structure

- `/miasta/{city}` — content: JSON object of the city's needed goods and quantities, e.g. `{"chleb": 45, "woda": 120}`
- `/osoby/{firstname_lastname}` — content: person's full name + markdown link to their city, e.g. `Iga Kapecka\n\n[Opalino](/miasta/opalino)`
- `/towary/{item}` — content: markdown link to the city that sells it, e.g. `[Opalino](/miasta/opalino)`

## Action order
1. Create directories: `/miasta`, `/osoby`, `/towary`
2. Create all city files in `/miasta/`
3. Create all person files in `/osoby/`
4. Create all item files in `/towary/`

3. Write `pipeline/step3/result/status.json` → `{"status":"done"}`.

Do not finish until both files are written.
