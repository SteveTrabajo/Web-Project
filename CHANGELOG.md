2026-07-05

### Added
- Mobile-adaptive layout (client requirement) - the site is now fully usable on phones; styling-only changes, no logic touched
- Navbar hamburger menu below 768px - nav items and admin logout move into a dropdown panel; desktop navbar unchanged

### Modified
- Root font steps down 20px -> 17px below 640px (the documented mobile typography base)
- App shell converted to a dvh flex column - removed all hard-coded `calc(100vh-72px)` offsets and fixed the mobile URL-bar viewport bug
- Chat, Hero, and labs paddings/sizes gain `sm:` breakpoints; labs table min-width reduced so only modest side-scroll remains on phones
- Theme toggle repositioned on mobile so it no longer covers the chat send button
