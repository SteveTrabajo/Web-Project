2026-05-25

### Added
- FeedbackModal component: anonymous end-of-session feedback flow
  - client/src/components/FeedbackModal.jsx — rating + reason checkboxes + comment textarea
  - client/src/components/docs/FeedbackModal.md — component documentation
  - server/routes/public/feedback.js — POST /api/feedback 
  - server/routes/admin/feedbackAdmin.js — GET /api/admin/feedback
  - Firestore: new feedback collection

### Modified
- server/server.js — registered feedbackRoutes and feedbackAdminRoutes
- client/src/components/Bot.jsx — "סיים שיחה" button (visible after first exchange) triggers FeedbackModal, chat resets on submit
- client/src/components/AdminPanel.jsx — feedback tab with paginated FeedbackCard list and relative timestamps

---

2026-05-23

- All admin routes now require a JWT token (Authorization: Bearer) - unauthenticated requests return 401
- Login now signs and returns a JWT (8h expiry); frontend stores and sends it with every admin request
- Admin passwords hashed with bcrypt; legacy plaintext passwords auto-migrated to hash on first login
- Password reset and change-password endpoints now hash before storing
- File upload parser (uploadAdmin.js) switched from exec() to execFile() - eliminates shell injection via form fields
- Uploaded temp files cleaned up after parser exits
- forgot-password and reset-password moved to /api/admin/auth/* (remain public, no JWT needed)
- yearbooksAdmin route registered in server.js (was defined but never mounted)
- express.json() body limit set to 10kb
- Rate limit on /api/ask: 20 requests per minute per IP
- Added: jsonwebtoken, express-rate-limit to server dependencies
- Added: server/middleware/authMiddleware.js
