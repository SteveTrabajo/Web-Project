2026-07-15

## Bot "קבצים" flow - download student files by pill or natural language

Students can now get downloadable forms/files directly in the chat: after picking a
yearbook, a new **קבצים** topic pill opens the student-files store (the admin "טפסים"
area) as pills, and also accepts a free-text request ("הטופס לביטול קורס") which the
bot matches to the right file. Clicking a file shows a download link in the response -
no auto-download.

### Added

- `POST /api/forms/match` (public, in `formsAdmin.js`) - natural-language file lookup over
  the existing forms store. Hebrew-tolerant token scoring (final-letter folding, containment)
  with a small `gpt-4o-mini` fallback only when the lexical match is weak or ambiguous.
- `botTemplates.js` - `filesPromptHtml`, `fileMatchesHtml`, `noFileMatchHtml`, and a
  `fileDisplayName` helper (shows underscores as spaces).

### Modified

- `Bot.jsx` - `קבצים` topic pill + files flow: `loadFiles` (pills from `/api/forms`),
  `chooseFile`, and `handleFileQuery` (routes a typed message to `/api/forms/match` when the
  topic is files). Reuses the existing `server/files` store - no new storage or admin section.

## Yearbook import - course-tables-only, faster, surfaces only unresolved relations

Simplified the yearbook import so it targets just the required curriculum (semesters 1-8)
and does far less AI work. Instead of proposing implicit links, flagging anomalies, and
turning footnotes into FAQ entries, the pipeline now parses courses + their relations and
surfaces only the spots where the AI could not map a relation to a course code.

### Modified

- `parsers/yearbook_extractor.py` - now extracts **only** the per-semester course tables
  (>=5 columns with real course codes). Prose, intro pages, footnotes, and the
  elective/specialization sections ("לימודי התמחות", "קורסי בחירה") are skipped. Each table
  is matched to the nearest `סמסטר N` heading **above it** (a page can hold several
  semesters), with carry-over across page breaks. PDFs over 20 pages (DOCX over 80 tables)
  are rejected up front. All note capture removed.
- `services/yearbookImport.js` - dropped `analyzeRelations` (domain-knowledge suggestions +
  anomalies) and `suggestAnswersFromNotes` (notes -> curated Q&A). `structureTable` now also
  returns `unresolvedRelations` - relation-column text it could not turn into a code. A new
  `collectUnresolved` pass builds one review list from those plus dangling code references.
- `routes/admin/uploadAdmin.js` - commit folds admin-**resolved** relations (pick target
  course + type) into the graph and prunes dangling links before closure/write; no longer
  writes note-derived curated answers. Added a page-limit friendly error.
- `components/UploadYearbook.jsx` - review UI replaces the suggestions/anomalies/answers
  sections with a single "relations the AI could not resolve" list (resolve or dismiss each).
