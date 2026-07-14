2026-07-14

## Yearbook import overhaul - full-LLM extraction, prerequisite graph, AI review

Reworked how yearbooks (course catalogs) are imported so the bot answers "can I take
course X with Y?" from a complete, grounded prerequisite graph instead of a brittle
keyword/column parse that silently missed relations.

### Added

- `parsers/yearbook_extractor.py` - format-detecting raw extractor for DOCX **and** PDF
  (pdfplumber). Pulls tabular content only; writes nothing. Preserves the yearbook's
  "underline = corequisite" convention as `<u>..</u>` markup for the LLM.
- `services/yearbookImport.js` - gpt-4o structures each semester table into typed
  courses/relations (`buildPreview`), then an analysis pass (`analyzeRelations`) proposes
  implicit links + flags anomalies as **advisory suggestions** for admin approval.
- `services/prereqGraph.js` - `computeTransitiveClosure()` builds each course's full
  upstream prerequisite chain (with cycle detection) at commit time.
- Preview -> review -> commit flow: `POST /upload/yearbook` returns a preview (no writes);
  `POST /upload/yearbook/commit` writes reviewed data. New `UploadYearbook.jsx` review UI
  surfaces detected courses, AI suggestions (approve to include), anomalies, and warnings.

### Modified

- `routes/public/ask.js` - the two-course "can study together" answer no longer defaults
  to a confident yes when no relation exists; it now distinguishes "no data recorded" from
  "confirmed compatible". Prerequisite lookups read the precomputed transitive chain
  (`transitivePrerequisites`) with a fallback to the live recursive walk for legacy imports.
- `services/llm.js` - `callLLMJson` accepts a per-call `model`; adds `IMPORT_MODEL` (gpt-4o).
- `services/courseData.js` - course cache now carries `transitivePrerequisites`.
- `server.js` - yearbook commit route bypasses the global 10kb JSON limit (own 8mb parser).
- Only admin-approved AI suggestions ever reach the live data - the bot stays grounded.
