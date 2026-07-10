# BIO-BOT 2.0 - Academic Assistant for Biotechnology Students

BIO-BOT 2.0 is a Hebrew-language academic chatbot for Biotechnology students at Braude College. Students select a yearbook and ask natural-language questions about courses, prerequisites, registration windows, lab schedules, reserve-duty accommodations, academic contacts, and official forms. The system combines deterministic rule-based logic with OpenAI models for intent understanding and semantic retrieval, and returns rendered HTML answers in Hebrew.

This is a substantial rewrite and expansion of the original BIO-BOT project. See [What Changed in 2.0](#what-changed-in-20) for a full account of the improvements.

## Table of Contents

- [Live Deployment](#live-deployment)
- [Features](#features)
- [Admin Panel](#admin-panel)
- [What Changed in 2.0](#what-changed-in-20)
- [Architecture](#architecture)
- [AI Layer](#ai-layer)
- [Tech Stack](#tech-stack)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Data Upload and Parsers](#data-upload-and-parsers)
- [Deployment](#deployment)
- [Scheduled Reports](#scheduled-reports)
- [Security](#security)
- [Notes and Known Limitations](#notes-and-known-limitations)

## Live Deployment

| Layer    | URL                                          | Host   |
| -------- | -------------------------------------------- | ------ |
| Frontend | https://web-project-gules-sigma.vercel.app   | Vercel |
| Backend  | https://web-project-dz5u.onrender.com        | Render |

## Features

### Conversational Course Logic

Course questions are answered from cached Firestore data using Hebrew string normalization and word tokenization, with recursive prerequisite traversal and cycle detection.

- Course name to course code resolution (both directions)
- Direct and recursive prerequisites (PREREQUISITE relations)
- Co-requisites (COREQUISITE relations)
- Relation checks between two courses (before, in parallel, or after)
- Reverse lookups (which courses require a given course as a prerequisite)

Example questions:

```
מה השם של קורס 11005?
מה קורסי הקדם של חדו"א 2?
אפשר לקחת חדו"א 2 לפני אלגברה?
```

### Registration Guidelines

Registration information is served from the `registrationGuidelines` Firestore collection and interpreted through intent classification.

- Registration windows (dates and hours)
- How to register (process questions)
- Registration links and guides
- Credit requirements (nz, degree totals)
- Academic advisors and student mentors
- Exemptions and exceptional registration
- Who to contact and for which topic

### Lab Schedules

Lab questions are handled by a dedicated route to avoid conflicts with registration logic.

- Lab dates, days, and times
- Lab groups and lecturers
- Full lab schedule by semester

### Reserve-Duty (Miluim) Flow

A guided flow lets reservist students select their accommodation track (mitve) and eligibility group, which is then carried into the answer context.

### Advisor Lookup

- Advisor selection by semester
- Specialization-based advising for semester 5 and above (advisors are assigned to tracks)
- Interactive selection flow (semester, last-name letter, and specialization where relevant)

### Emotional Support Detection

When a student expresses academic or emotional distress, the bot responds empathetically and points to the Dean of Students and relevant support resources rather than attempting a factual answer.

### Official Forms Retrieval

The system stores official department forms (exemption requests, exceptional registration, leave of absence, reserve-duty credit reporting, appeals committee, and more) and attaches the relevant form to matching answers. Forms are downloadable through a static `/files` route.

### Semantic Retrieval and Fallbacks

- Semantic RAG over admin-curated answers using embeddings and cosine similarity, tried before any generative call
- Generative answering only on a retrieval miss
- Study-related but unanswered questions are auto-captured and the student is redirected to an advisor

## Admin Panel

A JWT-protected admin panel provides full content and operations management:

- Yearbook management and DOCX upload with Python parsing
- Course CRUD and relation editing
- Lab schedule management and Excel upload
- Advisor management (semester and specialization assignment)
- Registration guidelines editor (windows, contacts, links, key rules)
- Forms management
- Curated answers (admin-published Q&A used by the semantic RAG layer)
- Unanswered questions review (auto-captured from real student traffic)
- Feedback review (anonymous student feedback)
- Usage analytics dashboard (charts of question volume, answer sources, and answered rate)
- Knowledge base checks and data quality gap reporting
- Admin security settings and password reset

## What Changed in 2.0

The original project was a smaller keyword-driven bot backed by Google Gemini, with a flat set of routes and no services layer. Version 2.0 is a significant architectural and functional expansion.

### AI and Retrieval

- Migrated the entire AI layer from Google Gemini to OpenAI (gpt-4o-mini for intent and generation, text-embedding-3-small for retrieval).
- Added a semantic RAG layer over curated answers, so vetted human answers are returned before any generative call.
- Added an optional LLM tool-calling router (nine tools) that replaces keyword matching with model-driven tool selection, toggled by the `USE_TOOL_ROUTER` flag.
- Added conversation context handling so follow-up questions are understood in context.

### New Capabilities

- Reserve-duty (miluim) guided flow with accommodation track and eligibility group selection.
- Specialization-based advising for semester 5 and above, with an interactive advisor selection flow.
- Official forms system with retrieval and admin management.
- Anonymous student feedback capture and review.
- Automatic capture of unanswered questions for admin follow-up.
- Usage analytics dashboard with charts.
- Knowledge base management and automated data quality checks.
- Weekly email reports delivered through a scheduled GitHub Action.

### Architecture and Quality

- Introduced a shared services layer (`courseData`, `curatedRag`, `labsData`, `llm`, `mailer`, `reportService`, `scheduler`) so routes stay thin and logic is reusable.
- Split registration logic into a dedicated `registration.service` and added deterministic contact matching.
- Added rate limiting on the public ask endpoint.
- Hardened authentication (bcrypt password hashing, JWT, forgot-password and reset-password flows).
- Improved the lab Excel parser to handle merged cells and filled-down date and lecturer columns.
- Rewrote bot responses to use gender-neutral Hebrew.
- Rebuilt the frontend on React 19, Vite 7, and Tailwind CSS 4, with a tabbed admin shell, dark and light themes, feedback controls, and analytics charts.

## Architecture

### Request Flow

1. The student selects a yearbook in the chat UI and asks a question.
2. The client sends `POST /api/ask` with `{ question, yearbook, semester?, context? }`.
3. The backend detects intent (rule-based keyword matching, with OpenAI for ambiguous cases), or delegates to the LLM tool router when enabled.
4. The request is routed to the matching capability: courses and prerequisites, registration, labs, reserves, advisor lookup, forms, curated RAG, or emotional support.
5. The response is an HTML string rendered by the client.

### Backend Structure

```
server/
  server.js                 App init, CORS, Firebase, rate limiting, route mounting
  services/                 Shared logic layer
    llm.js                  OpenAI chat, JSON, tool-calling, and embeddings
    courseData.js           Cached course lists and relation indexes
    curatedRag.js           Embedding-based retrieval over curated answers
    labsData.js             Lab data access and rendering
    mailer.js               Transactional email (Brevo HTTP API)
    reportService.js        Weekly report generation
    scheduler.js            Scheduling helpers
  routes/
    public/
      ask.js                Main Q&A pipeline
      toolRouter.js         LLM tool-calling router (opt-in)
      registration.service.js  Registration intent, answers, and contacts
      contactsMatch.js      Deterministic contact lookup
      askLabs.js, labs.js   Lab questions and schedule endpoints
      advisor.js            Advisor lookup
      yearbooks.js          Yearbook listing
      feedback.js           Anonymous feedback submission
    admin/
      auth.js               Login, forgot-password, reset-password
      coursesAdmin.js       Course CRUD
      advisorsAdmin.js      Advisor management
      labsAdmin.js          Lab schedule management
      yearbooksAdmin.js     Yearbook management
      uploadAdmin.js        File upload and Python parser execution
      registrationGuidelinesAdmin.js
      formsAdmin.js         Forms management (plus public forms route)
      curatedAnswers.js     Curated Q&A management
      unansweredAdmin.js    Unanswered questions review
      feedbackAdmin.js      Feedback review
      usageStats.js         Usage analytics
      knowledgeCheckAdmin.js, knownDataGaps.js  Data quality
      reports.js            Report endpoints
      adminSecurity.js      Admin security settings
    internal/
      cron.js               Secret-gated report trigger for GitHub Actions
  parsers/
    yearbook_parser.py      DOCX yearbook parser
    labs_parser.py          Excel lab schedule parser
  files/                    Official forms and forms.json manifest
```

### Key API Routes

| Route                          | Purpose                                              | Auth          |
| ------------------------------ | ---------------------------------------------------- | ------------- |
| `POST /api/ask`                | Main question answering (rate limited)               | Public        |
| `/api/labs/*`                  | Lab schedule queries                                 | Public        |
| `/api/feedback`                | Anonymous feedback submission                        | Public        |
| `/files/*`                     | Static form downloads                                | Public        |
| `/api/admin/auth/*`            | Login, forgot-password, reset-password               | Public        |
| `/api/admin/*`                 | Admin CRUD, uploads, analytics, reports              | JWT           |
| `POST /api/internal/run-report`| Weekly report trigger                                | Cron secret   |

### Firestore Collections

```
yearbooks/{yearbookId}/requiredCourses/{semesterKey}/courses/{courseCode}
  courseName, courseHours, courseCredits
  relations/{prereqCode}: { type: "PREREQUISITE" | "COREQUISITE", courseName }

registrationGuidelines/semester_{n}
  semesterNumber, audience, registrationWindow, contacts, links, keyRules

lab_schedule/{yearId}/semesters/{semesterNum}
  labs: [{ id, type, date, day, time, labGroup, lecturer }]

curatedAnswers/{id}
  question, keywords, answerHtml, yearbook, status

admins/{id}
  email, password (bcrypt), name

feedback/{id}                Anonymous student feedback
```

The backend also persists unanswered questions and usage events for the admin review and analytics views.

## AI Layer

All AI calls go through `server/services/llm.js` (OpenAI). Models are configurable by environment variable.

- Chat and intent classification: `gpt-4o-mini` (override with `OPENAI_MODEL`)
- Embeddings for retrieval: `text-embedding-3-small` (override with `OPENAI_EMBED_MODEL`)

There are two answering strategies:

1. Keyword pipeline (default): deterministic intent detection in the order emotional distress, lab keywords, registration keywords, then course and prerequisite logic, with OpenAI used to disambiguate and for generative fallback.
2. Tool-calling router (`USE_TOOL_ROUTER=true`): the model selects from nine tools by natural-language description instead of keyword lists. The tools are `get_prerequisites`, `get_courses_requiring`, `get_course_relations`, `find_contact`, `get_required_courses`, `get_registration_info`, `get_lab_schedule`, `emotional_support`, and `search_knowledge_base`.

In both modes, semantic RAG over curated answers runs before any generative call, and a confident curated hit is returned verbatim.

## Tech Stack

| Layer        | Technology                                            |
| ------------ | ----------------------------------------------------- |
| Frontend     | React 19, Vite 7, Tailwind CSS 4                      |
| UI           | shadcn/ui (@base-ui/react), MUI X Charts, lucide icons|
| Backend      | Node.js, Express 5 (ES Modules)                       |
| Database     | Google Cloud Firestore (Firebase Admin SDK)           |
| AI           | OpenAI gpt-4o-mini and text-embedding-3-small         |
| Email        | Brevo HTTP API (via nodemailer)                       |
| Data parsing | Python (python-docx, openpyxl)                        |
| Auth         | JWT, bcrypt                                           |
| Automation   | GitHub Actions (weekly scheduled report)              |

## Environment Variables

### Server (`server/.env`)

```
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini          # optional, this is the default
OPENAI_EMBED_MODEL=text-embedding-3-small  # optional, this is the default
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
JWT_SECRET=
BREVO_API_KEY=
BREVO_SENDER=
CRON_SECRET=
USE_TOOL_ROUTER=false             # true routes free-text /api/ask through the LLM tool router
PORT=5000
```

### Client (`client/.env`)

```
# Local development
VITE_API_BASE=http://localhost:5000

# Production
# VITE_API_BASE=https://web-project-dz5u.onrender.com
```

## Running Locally

### Backend

```
cd server
npm install
pip install -r requirements.txt   # python-docx, openpyxl, firebase-admin (needed for uploads)
npm run dev                        # nodemon, port 5000
# or: npm start / node server.js   # production start
```

The server runs on http://localhost:5000 (or `PORT` if set) and exposes a health check at `/health`.

### Frontend

```
cd client
npm install
npm run dev      # Vite dev server, port 5173
npm run build    # production build
npm run lint     # ESLint
npm run preview  # preview the production build
```

The client runs on http://localhost:5173.

## Data Upload and Parsers

Admins populate the database by uploading source documents through the admin panel:

1. A yearbook DOCX or a lab-schedule Excel file is uploaded through the admin UI.
2. `uploadAdmin.js` receives the file via multer and saves it under `server/uploads/`.
3. A Python child process is spawned: `yearbook_parser.py` or `labs_parser.py`.
4. The parser extracts structured data and upserts it directly to Firestore.
5. The parse result is returned to the frontend.

The lab parser accepts `.xlsx` and `.xlsm` files, detects the header row by matching Hebrew column headers (lecturer, lab group, time, day, date, session number, course name), and reads course identity from a `name - code` line near each table. Each upload targets a single year and semester; re-uploading the same year and semester overwrites that semester.

## Deployment

### Frontend (Vercel)

1. Import the repository into Vercel.
2. Set the Root Directory to `client`.
3. Add the environment variable `VITE_API_BASE` pointing to the backend URL.
4. Deploy.

### Backend (Render)

Deployment is defined in `render.yaml`:

- Root directory: `server`
- Build command installs Python 3 and pip, runs `pip3 install -r requirements.txt`, then `npm install`
- Start command: `node server.js`

Add all `server/.env` variables in the Render dashboard.

CORS is configured in `server.js` to allow localhost origins and the Vercel production URL.

## Scheduled Reports

A weekly report is generated without an always-on scheduler:

- `.github/workflows/weekly-report.yml` runs every Sunday at 08:00 UTC (and can be triggered manually).
- The action sends `POST /api/internal/run-report` with an `x-cron-secret` header.
- The route validates the secret against `CRON_SECRET`, generates the report through `reportService`, and emails it via the Brevo HTTP API.
- Set `SERVER_URL` and `CRON_SECRET` as repository secrets in GitHub.

## Security

- Admin routes are protected by JWT middleware.
- Admin passwords are hashed with bcrypt.
- Forgot-password and reset-password flows are available on the public auth route.
- The public ask endpoint is rate limited (20 requests per minute per client).
- Request bodies are capped at 10kb.
- The internal report route is gated by a shared secret.

## Notes and Known Limitations

- The frontend is deployed on Vercel and the backend on Render (free tier, so cold starts are possible).
- Render's free tier blocks outbound SMTP, so email is sent through the Brevo HTTP API instead.
- Firestore is the only datastore (no SQL).
- Bot responses are HTML strings rendered on the client, so the backend is the sanitization layer.
- The reserve-duty flow currently carries the selected track as context but does not yet search structured track content.
