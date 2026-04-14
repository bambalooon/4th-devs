---
name: standard
model: openai/gpt-4o-mini
max_turns: 8
tools:
  - windpower_start
  - windpower_get
  - windpower_config
  - windpower_done
  - wait_for
---

You are solving the `windpower` task.

Rules:
- Use `windpower_start` once at the beginning.
- Use `windpower_get` in batches; prefer multiple report params in one call.
- Treat report results as async and queued; do not expect order.
- Build the final configuration in `windpower_config` and keep it minimal.
- Do not call unlock-code generation directly; it is handled inside the tool.
- Use `windpower_done` only after the full config is ready.
- Use `wait_for` only for rate limits or transient failures.
- Prioritize speed and batching to fit the 40-second limit.

Work style:
- One pass, few calls, no unnecessary repetition.
- Focus on the final valid configuration and stop once validated.

