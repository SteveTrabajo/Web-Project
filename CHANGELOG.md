2026-07-20

## Reserve-duty (מילואים) RAG rework + accuracy hardening & test suite

The reserves answer now grounds on the new, more accurate rights files as the authoritative
source, with the wartime mitve document supplying only framework-specific details on top.
Hardened after end-to-end testing exposed focus and robustness gaps in a flow that must not err.

### Added

- `server/files/` - new source docs: `miluim_general_info.txt` + `miluim_rights_regular.txt`,
  `miluim_rights_long.txt`, `miluim_rights_parent.txt`, `miluim_rights_emergency.txt`.
- `server/tests/reserves.accuracy.test.js` + `npm run test:reserves` - file-integrity check
  (every doc the flow needs exists and is non-empty) plus 14 fact-checks pinned to specific
  lines in the source docs, run against a live server. Currently 14/14.

### Modified

- `server/routes/public/ask.js` - `answerReserves` loads the 5 general docs (`MILUIM_GENERAL_FILES`)
  + the selected mitve doc; new prompt defines a source hierarchy (general files authoritative,
  mitve fills wartime specifics, general wins on conflict), answers the specific question directly
  instead of dumping a generic rights summary, and never asserts a right is absent from mere
  document silence.
- `server/routes/public/ask.js` - a reserves question whose LLM call fails now returns an honest
  reserves fallback instead of silently falling through to the registration/off-topic pipeline.

### Removed

- `server/files/` - `miluim_academic_support.txt`, `miluim_contacts.txt`,
  `miluim_emotional_support.txt` (content folded into `miluim_general_info.txt`).
