2026-08-27

## Multi-admin support, and mobile chat fixes

Admin credential routes were hardcoded to the "admin1" document, so a second admin changing
their own password silently overwrote the first admin's credentials. Identity now always comes
from the JWT, and admin accounts can be managed from the settings tab.

### Added

- `server/services/adminAuth.js` - shared `verifyAdminPassword`, case-insensitive
  `findAdminByEmail`, and readable unique id generation for new admin documents.
- `GET/POST/DELETE /api/admin/security/admins` - list, create and remove admin accounts. Both
  mutations re-check the acting admin's password on top of the JWT, since adding an account
  grants full access and removing one can lock people out. Self-deletion and removing the last
  remaining admin are blocked; password hashes are never returned.
- "ניהול מנהלים" section in the settings tab: account list, add form, and a remove dialog.

### Modified

- `routes/admin/adminSecurity.js` - `change-password` and `change-email` now write to
  `req.admin.id` instead of a hardcoded `admin1`, and the email uniqueness check compares
  against the acting admin rather than that constant. Passwords require at least 6 characters.
- `services/scheduler.js` - the weekly report goes to every admin; it previously read the same
  hardcoded document, so any admin added later would never have received one.
- `AdminLogin.jsx` - the identifier field is `type="text"` with `inputMode="email"`, so plain
  usernames are accepted (accounts match on the stored string, not on email format).
- `BotParts.jsx` - the chat input is RTL, so text flows toward the physical left where the send
  button sits. Clearance was on the right (`pr-*`), which both wasted width and let the
  placeholder run under the button; it is now `pl-14 sm:pl-16` with `ps-*` for the text start.
- `ThemeToggle.jsx` / `Navbar.jsx` - the floating toggle overlapped the chat send button on
  phones. It now takes a `variant`: floating (desktop only, `lg:`) and inline, rendered beside
  the mobile menu button.
