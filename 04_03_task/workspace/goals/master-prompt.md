Please read:
- [[./goal.md]] - describes task to implement/solve 
- [[./help-response.md]] - describes output of help command in available tool

and let's plan work together.

My proposition is to:
1. Define which part of task will be solved with code and which with LLM agent.
2. Plan the structure and implementation of required tools - [[../../src/task.ts]] based on the API specification in [[./help-response.md]].
3. Plan how many and what kind of agents are required.
4. Implement the tools in [[../../src/task.ts]] according to the plan.
5. Define required agents in [[../agents/]], e.g. [[../agents/standard.agent.md]]
    a) For each agent, define the model, max_turns, and tools it can use. Choose the cheapest model from OpenRouter that should handle this task.
    b) For each agent, define the system prompt with context, instructions, and rules.
6. Define user prompt in [[../../src/prompt.ts]] in langfuse and update its reference in [[../../src/index.ts]].

Report each step to me for approval before implementation. Let's start with step 1: defining which part of the task will be solved with code and which with LLM agent.
Be concise in responses. Focus on reasons for your choices.