2026-08-27

## Admin destructive actions: delete a yearbook, clear the unanswered queue

Both are irreversible, so each is gated behind an explicit confirmation that matches the
blast radius: a yearbook delete shows exactly what it will remove and requires the id to be
retyped, and clearing the unanswered queue requires the admin password on top of the session.

### Added

- `GET /api/admin/yearbooks/:id/delete-impact` - counts the semesters, courses and relations a
  delete would remove, flags the last remaining yearbook, and reports data that references the
  yearbook without being owned by it (matching `lab_schedule` doc, curated answers).
- `DELETE /api/admin/yearbooks/:id` - `recursiveDelete` over the four-level subcollection tree,
  requires the id echoed in the body, optionally removes the matching lab schedule.
- `DELETE /api/admin/unanswered-questions` - clears the whole queue in chunked batches after
  re-verifying the admin password (bcrypt, with the same legacy-plaintext fallback as login).
- `invalidateYearbookCaches()` in `services/courseData.js` - drops the 5-minute course and
  relation caches after a delete, so the bot stops answering from a deleted yearbook.
- Danger-zone section in the settings tab listing every yearbook with a delete dialog, and a
  "מחיקת הכל" action with a password dialog in the unanswered-questions tab.

### Modified

- `routes/admin/usageStats.js` + `StatsTab` - added an `unansweredQueue` count so the statistics
  reflect a cleared queue. It is labelled separately from the event-log "שאלות ללא מענה" metric,
  which is historical and intentionally unaffected by clearing the queue. Stats now load with
  `force: true` so they bypass the shared GET cache.
- `routes/admin/unansweredAdmin.js` - the list response carries a whole-collection `total`, shown
  next to the tab heading and in the purge confirmation.
