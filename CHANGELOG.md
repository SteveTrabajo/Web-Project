2026-06-20

### Added
- Curated answers feature - admin answers an unanswered question and publishes it; the bot serves it as a safety net (keyword + Gemini match) before the "didn't understand" fallback
- routes/admin/curatedAnswers.js + tabs/FaqTab.jsx ("תשובות מוכנות") - create/edit/publish/unpublish curated answers, with server-side sanitization
- ask.js findCuratedAnswer lookup (5-min cache) hooked in just before the generic fallback

### Modified
- tabs/UnansweredTab.jsx - "ענה ופרסם" dialog; yearbook now shown as Hebrew name, not id
- AdminRegistrationGuidelines.jsx - contacts laid out on full-width rows; each category collapsible
- YearbooksTab.jsx / LabsTab.jsx - selector trigger shows the Hebrew yearbook name, not the id
