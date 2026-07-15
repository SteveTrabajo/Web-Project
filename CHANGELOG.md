2026-07-15

## Student files - topic categories + keywords for wider selection and better matching

The forms library had only 3 bot "usage" roles. Added a separate topic taxonomy and
admin-authored keywords so the library can grow and the bot resolves free-text file
requests far more reliably.

### Added

- `category` field (9-topic taxonomy) + `keywords` + `description` per file, separate from
  the functional `usage` role. Auto-classified from the filename on first sight; admin-editable.
- `PATCH /api/admin/forms/:filename` - edit an existing file's metadata without re-uploading.
- `client/src/components/formCategories.js` - shared category labels + `groupByCategory` helper.

### Modified

- `/api/forms/match` now scores over label + filename + **keywords + description** (and passes
  them to the LLM fallback), so paraphrased requests resolve even when the label is terse.
- `AdminForms.jsx` - upload + inline-edit fields for category/keywords/description, category filter,
  keyword-aware search. `Bot.jsx` - קבצים pills grouped by category.
