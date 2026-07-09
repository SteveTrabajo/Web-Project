2026-07-10

## Tool-calling router - a new answer architecture for the chat

The bot historically routed every free-text question through ~15 hand-maintained
Hebrew keyword lists in `ask.js` (`isRegistrationQuestion`, `detectPrerequisitesFallback`,
`UNSUPPORTED_TOPICS`, ...). Every new phrasing or topic meant editing code, and the
lists still misrouted (e.g. "which courses require X" answered with X's own prereqs).

This adds an alternative: an LLM reads plain-language **tool descriptions** and picks
the right function plus its arguments. The answer *builders* (prereq graph, lab date
logic, registration formatting) are unchanged and correct - only the *routing layer*
changes. Adding a capability is now one executor + one description, not a keyword list;
unknown topics decline automatically (no tool matches), and abuse/prompt-injection is
refused for free.

### How it works

- `services/llm.js` - `callLLMTools()` wraps OpenAI function-calling.
- `routes/public/toolRouter.js` - `routeWithTools(question, yearbookId)` sends the
  question + 9 tool schemas to the LLM, runs the chosen tool, and returns
  `{ type: "tool"|"no_tool"|"error", tool, html }`.
- The 9 tools: `get_prerequisites`, `get_courses_requiring`, `get_course_relations`,
  `get_lab_schedule`, `get_registration_info`, `find_contact`, `get_required_courses`,
  `emotional_support`, `search_knowledge_base` (semantic RAG over curated answers).

### Shared service modules (extracted so both pipelines use one implementation)

- `services/courseData.js` - course cache, matching, and a single-scan relation index
  (forward + reverse prerequisites).
- `services/curatedRag.js` - the embedding/RAG stack (`ragCuratedAnswer`).
- `services/labsData.js` - lab data access, filtering, next-lab, rendering (`askLabs.js`
  is now a thin classifier + orchestration shell over it).
- `answerRegistration()` in `registration.service.js` - the full registration orchestration.

### Rollout

- `USE_TOOL_ROUTER` env flag - `/api/ask` has a flag-gated early return after the
  greeting fast-path. When `true`, free-text questions use the router; results map to
  the existing `logUsageEvent` / `autoSaveUnanswered` so the admin unanswered-questions
  tab keeps filling. Default (unset) runs the keyword pipeline unchanged - instant revert.
- The guided pill flow (yearbook/topic/semester/letter) is client-side and never hits
  this branch.
- Validated with `test-tools.mjs` / `scale-test.mjs`: ~92% routing accuracy on real
  logged questions, with correct declines on junk/abuse.

### Also

- The bot now gives one honest "no answer" admission on a knowledge-base miss or a
  no-tool decline, instead of a technical "not in DB" message or possibly-hallucinated text.
