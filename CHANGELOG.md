2026-08-27

## Registration guidelines DOCX import - per-semester, structured, not embedded

The "הנחיות כלליות לרישום" document holds facts the bot must get exactly right (credit caps,
advisor routing by surname letter and effective date). At ~3 KB it is too small for chunked
retrieval, and its advisor table is the kind of structure an LLM misreads, so it is parsed once
at ingest into the existing `registrationGuidelines/semester_N` shape rather than embedded.
This also activates the `rules` intent, which was reachable but had no renderer.

### Added

- `server/parsers/registration_guidelines_parser.py` - walks the DOCX body in document order
  (paragraphs and tables interleaved), extracts prose into `keyRules` with topic codes, and
  resolves the advisor table into semester / credit / surname-range / track / effective-date
  fields. Classifies every table (advisors / courses / unknown) so a course listing is reported
  and skipped rather than misread as advisors. Reports data gaps as warnings instead of guessing.
- `server/services/registrationImport.js` - shapes parser output into a per-semester patch, and
  converts advisors between the two stores they live in (`assignment` <-> `lastNameRanges`).
- `POST /api/admin/upload/registration-guidelines` - parse-and-preview only; nothing is written
  until the admin reviews and saves.
- `POST /api/admin/advisors/sync/preview` + `/apply` - reconcile the guidelines doc's advisors
  with the `academicAdvisors` collection that the bot's letter/track picker reads. Saving shows a
  diff (new / changed fields) and writes only what the admin approves; deletions are never
  proposed, so hand-created advisors are safe. The apply step recomputes the diff server-side.
- `client/src/components/admin/RegistrationImport.jsx` - dedicated "ייבוא מקובץ" sub-view with a
  three-step flow (select file -> review -> import) and a destination map showing, per item, which
  tab and which Firestore path it lands in, plus what was found but deliberately not imported.
- `server/tests/registration.parser.test.js` + `npm run test:registration` - pins each extracted
  fact to its source cell, the per-semester advisor split, the sync diff, table classification and
  the destination map. 64/64.

### Modified

- `server/routes/public/registration.service.js` - added the missing `rules` renderer (single
  semester and deduped across all semesters), surfaced `creditsRange` in the credits answer and
  in the RAG context summary, and added rules keywords to registration detection/refinement.
- `server/routes/public/toolRouter.js` - `get_registration_info` now accepts `aspect: "rules"`.
