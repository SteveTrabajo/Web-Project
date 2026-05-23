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
