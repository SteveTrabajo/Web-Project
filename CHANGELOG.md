2026-06-19

### Added
- routes/admin/unansweredAdmin.js - GET (paginated + date filters) and DELETE for unanswered questions
- tabs/UnansweredTab.jsx - admin dashboard to view and delete questions flagged as unhelpful

### Modified
- routes/public/feedback.js - negative feedback now also stores last 5 questions in unansweredQuestions collection
- server.js - mounted unansweredAdmin route behind requireAdmin
- FeedbackModal.jsx - sends questions + yearbook in the feedback payload
- Bot.jsx - tracks last 5 typed questions per session and passes them to the modal
- AdminShell.jsx - added "unanswered" nav item and tab
