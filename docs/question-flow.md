# Question Flow - Start to Finish

This document traces a single student question through BIO-BOT 2.0, from the
moment it is typed in the browser to the HTML answer that appears in the chat.
It is a simplified map: enough to see where a question goes and why, without
every edge case.

## The two ways a question is asked

The chat in `Bot.jsx` has two distinct paths:

1. **Guided pills** (yearbook -> topic -> semester -> letter/track). These do
   NOT hit `/api/ask`. They call dedicated endpoints directly
   (`/api/requiredcourses/...`, `/api/advisor`, etc.) and render a template.
2. **Free-text question** (the input box at the bottom). This is the path this
   document is about: it always goes through `POST /api/ask`.

Everything below follows the free-text path.

---

## Step 1 - Frontend (`client/src/components/Bot.jsx`)

1. The student must first pick a **yearbook**. Without it, `sendMessage()`
   refuses and shows a reminder to select one.
2. On send, the client:
   - shows a temporary "רגע אני חושב..." bubble,
   - builds the request body,
   - `POST`s to `${VITE_API_BASE}/api/ask`.

The request body:

```json
{
  "yearbookId": "<selected yearbook>",
  "question": "<raw text>",
  "semester": "<number or null>",
  "topic": "<current guided topic or null>",
  "reservesMitve": "<reserves plan or null>",
  "reservesGroup": "<eligibility group or null>",
  "history": [{ "role": "user|bot", "text": "<last ~7 turns, stripped to plain text>" }]
}
```

`history` is the last 7 messages of the current conversation (HTML stripped to
plain text), so the server can resolve follow-up questions like "ומה הקדם שלו?".

3. The response is a single **HTML string** (`data.html`), rendered into the
   chat with `dangerouslySetInnerHTML`. The client does not parse or interpret
   it - the backend decides everything.

---

## Step 2 - Backend routing ladder (`server/routes/public/ask.js`)

`POST /api/ask` runs a top-to-bottom ladder. The **first** branch that matches
answers and returns; nothing after it runs. Order is deliberate - it is how the
bot avoids, say, reading a distress message as a course lookup.

The ladder, in order:

| # | Check | Handler / Result |
|---|-------|------------------|
| 0 | `USE_TOOL_ROUTER=true`? | Hand off entirely to the LLM tool router (`toolRouter.js`). Off by default. |
| 1 | Greeting only ("שלום", "היי"...) | Static greeting reply |
| 2 | Unsupported topic (exams, grades, syllabus, course cancellation) | Try curated admin answer first; else honest "no data" message + log as unanswered |
| 3 | Lab question (lab word + time word) | Delegate to `askLabs.js` |
| 4 | Registration question (and NOT a course-intent question) | Registration branch (see below) |
| 5 | Academic branch (courses / relations / prereqs / emotion) | The main course logic (see below) |
| 6 | Contact lookup ("מי ראש המחלקה") | Deterministic contacts answer |
| 7 | Semantic RAG over curated answers | Curated answer if a hit |
| 8 | Generative LLM fallback | Answer, or route to advisor, or off-topic |
| 9 | Study-related but unanswered | Advisor redirect + auto-save as unanswered |

Steps 6-9 are the **fallback chain**: reached only when no earlier branch fired.

### Before the ladder

The server normalizes the Hebrew question (`qNorm`), lowercases it (`qLower`),
and compacts the history into `historyText`. These are reused by every branch.

---

## Step 3 - The registration branch (step 4)

Triggered when the question looks like registration ("מתי נרשמים", "חלון רישום",
advisors, mentors, credit points, links, internship) AND is not really about a
specific course.

1. An LLM classifies the registration sub-intent (`window`, `credits`,
   `advisors`, `labs`, `mentors`, `links`, `internship`, `contacts`, `general`).
2. The server extracts a semester number from the text if present.
3. If no semester is given, it answers across all semesters (e.g. all
   registration windows) or asks the student to specify one.
4. If a semester is given, it loads that registration doc from Firestore and
   builds the specific answer.

All answers here are built deterministically from Firestore data - no generative
text.

---

## Step 4 - The academic branch (step 5)

This is the core. It loads the yearbook's course list (5-minute cache) and then,
**in parallel**, runs two LLM calls:

- `detectEmotion(question)` - is this emotional distress?
- `classifyQuestion(question, history)` - `{ kind, courses[], intent }` where
  `kind` is `lookup | relation | prerequisites`.

It also matches courses two ways: keyword extraction (`extractMultipleCourses`)
and the LLM's returned course names. LLM matches win when present.

Then, in order:

1. **Emotional support** - if distress detected and no specific course, return
   the empathetic dean-contact reply.
2. **Reverse prerequisites** - "לאילו קורסים X היא דרישת קדם" - lists courses
   that require X. Checked before the forward branch so the mirrored question is
   not answered backwards.
3. **Prerequisites** - "מה הקדם של X" - recursive prerequisite walk (cached,
   with cycle detection), returns the full chain.
4. **Bare course mention** - just a course name with no real question - ask the
   student what they want to know about it.
5. **Lookup** - "מה הקוד של X" - returns the course name + code.
6. **Relations (2+ courses)** - checks prerequisite / corequisite records
   between the courses and answers whether they can be taken together. Absence
   of a record is reported honestly, not as a confirmed "yes".

If none of these fire, the request falls through to the fallback chain.

---

## Step 5 - The fallback chain (steps 6-9)

Reached when the question mentions no clear course/registration/lab intent:

1. **Contact lookup** - direct role match ("מי המזכירה") answered from contacts.
2. **Semantic RAG** - embed the question, compare against curated admin answers
   ("תשובות מוכנות"). On a hit, return the curated HTML (no generative call).
3. **Generative LLM** - only on a RAG miss. One call returns one of:
   - a plain-text answer (built from yearbook + registration + contacts context),
   - `NEED_ADVISOR` -> advisor redirect,
   - `OFF_TOPIC` -> polite "academic topics only" reply.
4. **Advisor redirect** - study-related but unanswered. Show the advisor picker
   button and auto-save the question to `unansweredQuestions` for admins.

---

## Step 6 - Response and logging

- Every branch returns `res.json({ html })`. The client swaps out the loading
  bubble and renders the HTML.
- Every branch also calls `logUsageEvent(...)` with an `answerSource` tag
  (`labs`, `registration`, `courses`, `rag_curated`, `rag`, `emotional`,
  `advisor_redirect`, `offtopic`, ...) and `wasAnswered`. This feeds the admin
  statistics.
- Unanswered fallbacks call `autoSaveUnanswered(...)`, deduplicated by
  normalized question, so admins can later add a curated answer.

---

## One-glance diagram

```
Student types question
        |
        v
  Bot.jsx sendMessage()  --- POST /api/ask (question, yearbook, semester, topic, history) --->
        |
        v
  ask.js routing ladder (first match wins):
        |
        |-- greeting?              -> static hello
        |-- unsupported topic?     -> curated OR honest "no data"
        |-- lab question?          -> askLabs.js
        |-- registration question? -> registration.service (Firestore, deterministic)
        |-- academic?              -> emotion / reverse-prereq / prereq / lookup / relations
        |
        |   (fallback chain, if nothing above matched)
        |-- contact lookup?        -> contacts answer
        |-- curated RAG hit?       -> curated HTML
        |-- generative LLM         -> answer | NEED_ADVISOR | OFF_TOPIC
        |-- else                   -> advisor redirect + save as unanswered
        |
        v
  res.json({ html })  ---> Bot.jsx renders HTML (dangerouslySetInnerHTML)
        |
        +-- logUsageEvent() every time; autoSaveUnanswered() on fallback miss
```

## Key files

- `client/src/components/Bot.jsx` - builds and sends the request, renders the HTML.
- `server/routes/public/ask.js` - the routing ladder (this whole flow).
- `server/routes/public/askLabs.js` - lab schedule answers.
- `server/routes/public/registration.service.js` - registration answers.
- `server/services/courseData.js` - course cache, Hebrew normalization, matching.
- `server/services/curatedRag.js` - semantic RAG over curated admin answers.
- `server/services/llm.js` - OpenAI calls (`callLLM`, `callLLMJson`).
