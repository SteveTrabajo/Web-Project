# Migration Plan: Keyword Routing -> Tool-Calling

## Why

`ask.js` routes free-text questions with ~15 hand-maintained Hebrew keyword lists
(`isRegistrationQuestion`, `isReversePrereqQuestion`, `UNSUPPORTED_TOPICS`, ...).
Every new phrasing or topic needs a code edit, and the lists still misroute
(e.g. "ביוכימיה פותחת לי אילו קורסים" answered with forward prereqs instead of
reverse). A tool-calling router replaces the keyword layer: the LLM reads
plain-language tool descriptions and picks the function + arguments. Adding a
capability becomes one executor + one description; unknown topics decline
automatically (no tool matches).

The answer *builders* (prereq graph traversal, lab date logic, registration
formatting) are correct and stay. Only the *routing layer* changes.

## What is already done (step 1 + first production tool)

- **`server/services/courseData.js`** - shared course/relation data access
  (`normalizeHebrew`, `getAllCoursesCached`, `matchCourse`, `getRelationIndex`
  giving both forward and reverse relations from one scan, `getCoursesRequiring`).
- **`server/services/curatedRag.js`** - the RAG stack (`ragCuratedAnswer` + caches),
  extracted so both pipelines can reach it without a circular import.
- **`ask.js`** now imports from both modules; its local copies were deleted and
  the reverse-prereq call site uses `getRelationIndex`. Behavior unchanged.
- **`server/services/labsData.js`** - lab data access, filtering, next-lab, and
  rendering, extracted from `askLabs.js` (which is now a thin classifier +
  orchestration shell that imports it).
- **`registration.service.js`** gained `answerRegistration({ semester, aspect, forms })`
  - the full semester / all-semesters orchestration extracted from ask.js's
  registration branch, returning an HTML string.
- **`toolRouter.js`** uses the shared modules and registers nine tools:
  `get_prerequisites`, `get_courses_requiring`, `get_course_relations`,
  `find_contact`, `get_required_courses`, `get_lab_schedule`,
  `get_registration_info`, `emotional_support`, `search_knowledge_base` (RAG).
  `find_contact` wraps `findContactsByQuery`; `get_required_courses` filters
  `getAllCoursesCached` by semester. Covers every free-text intent the keyword
  pipeline handles, plus the two gaps the real-log scale test exposed.
- **`scale-test.mjs` + `scale-questions.txt`** - Phase B harness: runs a labeled
  batch through `/api/ask-tools` and reports routing accuracy + distribution.
- **`POST /api/ask-tools`** exposes the router for side-by-side testing; the
  chat still uses `/api/ask`. `test-tools.mjs` drives a question set.

## Guiding principle

Keep the deterministic fast-paths that are NOT free text. The guided pill flow
(yearbook -> topic -> semester -> letter) and greetings are button clicks with
known intent - they should stay rule-based. The tool router replaces only the
**free-text branch** of `/api/ask` (everything after the guided flow, where the
keyword cascade lives today).

## Remaining tools to build (each = one executor + one schema in toolRouter.js)

| Tool | Wraps (existing logic in ask.js / services) | Notes |
|---|---|---|
| `get_lab_schedule` | DONE - `services/labsData.js` | extracted from askLabs.js; args: course/semester/session/lecturer/group/day/date/time/intent |
| `search_knowledge_base` | DONE - `ragCuratedAnswer` | catch-all for prose/policy |
| `get_registration_info` | DONE - `answerRegistration` in registration.service.js | args: semester, aspect (window/advisors/mentors/credits/links/internship/exemptions/contacts/labs/general) |
| `get_course_relations` | DONE - direct relations in toolRouter (prototype) | two-course "can I take X and Y together"; promotion swaps for the recursive walk |
| `emotional_support` | DONE - static template in toolRouter | LLM routes distress here instead of `detectEmotion` |
| `get_prerequisites` | prototype does direct lookup; swap for `getAllPrerequisitesRecursiveCached` | recursive chain, not just direct |
| `get_advisor` | `advisor.js` lookup | args: last_name_letter, semester, track?; note the by-letter picker stays a guided flow |

When every branch has a tool, the keyword detectors and `UNSUPPORTED_TOPICS`
delete themselves - "unsupported" becomes "no tool matched".

## Phased rollout

**Phase A - build tools behind `/api/ask-tools` (no production impact).**
Add the tools above one at a time. After each, extend `test-tools.mjs` with
questions for it (including ones that must NOT route to it) and run the batch.
Watch `_debug.tool`. This is where the shared builders get wrapped; where a
builder still lives inside `ask.js` (labs, registration), extract it to a
service module first (same move we did for courses/RAG) so the tool can import
it without a circular dependency.

**Phase B - scale test.** Pull real questions from the `unansweredQuestions`
collection and the usage logs. Run a few dozen messy ones through
`/api/ask-tools`. Measure routing accuracy and argument extraction in Hebrew.
Gate: only proceed if accuracy on structured intents clears a bar you set
(suggest >=95% on a labelled set of ~50). If shaky, fall back to the
LLM-classifies-to-an-enum variant (below) which still removes the keyword lists.

**Phase C - flip the free-text branch. DONE.** `/api/ask` now has a flag-gated
early return, right after the greeting fast-path: when `USE_TOOL_ROUTER=true`,
free-text questions go through `routeWithTools`; results map to `logUsageEvent`
(`answerSource: tool:<name>` when answered, else the router type) and
`autoSaveUnanswered` on a `no_tool`/KB-miss. Default (unset) leaves the entire
keyword pipeline unchanged - instant revert by unsetting the env var. Greetings
stay on the fast-path; the guided pill flow (yearbook/topic/semester/letter,
reserves) is client-side and never hits this branch. Remaining polish: multi-tool
questions currently take only the first `tool_calls[0]` - loop and concatenate if
you see compound questions in the logs.

**Phase D - clean up.** Once the tool router is trusted in production, delete the
keyword detectors, `UNSUPPORTED_TOPICS`, `isReversePrereqQuestion`,
`detectPrerequisitesFallback`, `refineRegistrationIntent`, `classifyQuestion`,
`classifyRegistrationIntent`, `detectEmotion`, and the `answerOrRoute` generative
fallback (the router's `no_tool` path + `search_knowledge_base` cover it). This
is where `ask.js` shrinks from ~1000 lines to a thin guided-flow + router shell.

## Cost / latency

The router is ONE LLM call that does classify + route + extract-args together.
It replaces today's separate `detectEmotion` + `classifyQuestion` +
`classifyRegistrationIntent` calls, so it should be latency- and cost-neutral or
better. Confirm with timing in Phase B.

## Fallback if tool-selection is unreliable

If Phase B shows the model picking tools poorly in Hebrew, keep the architecture
but swap the mechanism: one `callLLMJson` call returns
`{ intent: "<enum>", args: {...} }`, and a `switch` maps intent -> builder. Still
no keyword lists (the enum + descriptions do the work), just less elegant than
native tool-calls. The executors and shared services stay identical.

## Risks and mitigations

- **Wrong tool fires** -> keep `USE_TOOL_ROUTER` env flag for instant revert
  (Phase C); adversarial questions in `test-tools.mjs`.
- **Hallucinated arguments** (course that does not exist) -> executors already
  return "לא זיהיתי את הקורס" on a match miss; keep that guard in every executor.
- **Curated RAG over-triggers** -> `search_knowledge_base` description says
  "only when no other tool covers it"; the RAG threshold (0.78) still gates hits.
- **Loss of `wasAnswered` logging** -> map router results to the existing
  `logUsageEvent` calls in Phase C (`type: "no_tool"` -> `wasAnswered:false` +
  `autoSaveUnanswered`).

## Definition of done

- `/api/ask` free-text path runs through `routeWithTools`; guided flow unchanged.
- All keyword detector functions and topic lists removed from `ask.js`.
- Adding a new answerable topic requires only a new executor + schema entry.
- `test-tools.mjs` (or a promoted test suite) green on the labelled question set.
