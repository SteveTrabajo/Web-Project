2026-08-27

## Reserve-duty (מילואים) flow paused behind a flag

The grounded reserve-duty answers were not accurate enough to keep serving. The flow is now
disabled by a flag rather than deleted, and students are pointed at the college's official
page. No documents, label maps, prompts or templates were removed - flipping the two flags
restores the flow exactly as it was.

### Added

- `RESERVES_ENABLED` (server env, default off) and a matching constant in
  `client/src/components/botTemplates.js`. The server refuses reserve-duty answers on its own,
  so leaving the client flag alone still fails closed.
- `isReservesQuestion()` + `buildReservesRedirect()` in `routes/public/ask.js`, and
  `reservesDisabledHtml()` on the client. Both link to
  https://w3.braude.ac.il/department/dean/miluim/

### Modified

- `routes/public/ask.js` - the guard runs immediately after the greeting check, ahead of the
  tool router, the curated knowledge base and the generative fallback. It matches reserve-duty
  wording on *any* question, not just `topic=reserves`, so a free-text "כמה ימי מילואים מזכים
  בפטור" cannot be answered from a non-grounded path. The existing grounded branch is now
  gated on the flag.
- `routes/public/ask.js` - `buildRagContext()` no longer injects the student's mitve and
  eligibility group into the generative prompt while the flow is off; that context would have
  invited a reserve-duty answer with no source document behind it.
- `Bot.jsx` - the מילואים topic button shows the redirect instead of opening the mitve picker,
  and clears any stored mitve/group so later questions carry no reserve-duty context.

### Verified

Live probe against a running server: the guided flow and four free-text phrasings (ימי מילואים,
מתווה, צו 8, מילואימניק) all return the official link with no reserve-duty figures in the
response, while a normal course question still answers as before.
