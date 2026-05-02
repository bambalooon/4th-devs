Please read:
- [[./lesson.md]] - AI generative lesson content
- [[./goal.md]] - describes task to implement/solve 

and let's plan work together.
Treat [[./goal.md]] as the source of truth for the task.
Use [[./lesson.md]] as optional inspiration for design, verification, and learning.

Main goal is to solve the task defined in [[./goal.md]]; secondary goal is to learn from the lesson where it helps.

Do not solve the task directly. The goal is to design a reusable agentic workflow that can solve the task again if data changes.

Prefer deterministic code for mechanical steps and LLMs for interpretation, reasoning, and ambiguous inputs. If the lesson suggests a more sophisticated approach that improves reliability or learning, it is acceptable to choose that instead of the simplest option, as long as the choice is justified.

My proposition is to:
1. Define which part of task will be solved with code and which with LLM agent.
2. Plan the structure and implementation of required tools, separating task-specific tools in [[../../src/task.ts]] from shared utilities in [[../../src/tools.ts]], based on API description in [[./goal.md]].
3. Plan how many and what kind of agents are required.
4. Implement the tools in [[../../src/task.ts]] according to the plan.
5. Define required agents in [[../agents/]], e.g. [[../agents/standard.agent.md]]
    a) For each agent, define the model, max_turns, and tools it can use. Use the least expensive OpenRouter model that can reliably complete this task.
    b) For each agent, define the system prompt with context, instructions, and rules.
6. Define user prompt in [[../../src/prompt.ts]] in langfuse and update its reference in [[../../src/index.ts]].

Report each step to me for approval before implementation. After each step, verify the plan against [[./goal.md]]. If something is ambiguous, state the assumption and prefer reversible changes.

Let's start with step 1: defining which part of the task will be solved with code and which with LLM agent.
Be concise in responses. Focus on reasons for your choices.