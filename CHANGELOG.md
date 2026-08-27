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
  fields. Reports data gaps as warnings instead of guessing.
- `server/services/registrationImport.js` - shapes parser output into a per-semester patch, and
  converts advisors between the two stores they live in (`assignment` <-> `lastNameRanges`).
- `POST /api/admin/upload/registration-guidelines` - parse-and-preview only; nothing is written
  until the admin reviews and saves.
- `POST /api/admin/advisors/sync/preview` + `/apply` - reconcile the guidelines doc's advisors
  with the `academicAdvisors` collection that the bot's letter/track picker reads. Saving shows a
  diff (new / changed fields) and writes only what the admin approves; deletions are never
  proposed, so hand-created advisors are safe. The apply step recomputes the diff server-side.
- Import card in the "כללים וקישורים" sub-view of the registration editor, which merges the patch
  into the open semester and lists any warnings.
- `server/tests/registration.parser.test.js` + `npm run test:registration` - pins each extracted
  fact to its source cell, the per-semester advisor split, and the sync diff. 54/54.

### Modified

- `server/routes/public/registration.service.js` - added the missing `rules` renderer (single
  semester and deduped across all semesters), surfaced `creditsRange` in the credits answer and
  in the RAG context summary, and added rules keywords to registration detection/refinement.
- `server/routes/public/toolRouter.js` - `get_registration_info` now accepts `aspect: "rules"`.
