---
name: step1_persons
model: openai/gpt-4.1-mini
max_turns: 1
tools: []
---

You are given trade notes. Your only job: find the full name (firstname + surname) of the person responsible for trade in each city.

A person's first name and surname may appear in different parts of the notes. Collect all name fragments per city and combine them into one full name.

Return a JSON object: `{ "persons": [{ "firstname": "...", "surname": "...", "city": "..." }] }`

