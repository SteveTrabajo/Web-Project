2026-07-18

## UI redesign (navbar, hero, bot, labs, admin login) + direct-only course prerequisites

A refined-polish visual pass across the main surfaces, keeping the Braude palette, plus a
backend change so prerequisite answers report only the immediate course - not the whole chain.

### Added

- `client/src/index.css` - shared theme-aware helpers: animated `.bot-typing` dots, frosted
  `.brand-nav-surface`, and a luminous `.brand-hairline` divider (all honor reduced-motion).
- Hero secondary "לוח מעבדות" CTA (new `onLabs` prop) and feature chips.
- Labs: per-course collapsible cards + a dedicated mobile stacked-card view for sessions.

### Modified

- `Navbar.jsx` - frosted-glass bar, nav icons, refined active pill, animated mobile drawer.
- `Hero.jsx` - layered gradient overlay, gradient headline, dual CTA, entrance animation.
- `Bot.jsx` / `BotParts.jsx` - avatar+status header, typing-dot loaders, tactile pills.
- `LabsViewer.jsx` - icon header, skeleton loading + friendly empty state, hover rows.
- `AdminLogin.jsx` - minimalist rewrite (dropped logo tile, separator, uppercase labels, footer).
- `server/routes/public/ask.js` - prerequisite lookups now return direct (one-hop) קדם courses
  and the direct צמוד course only; removed the recursive/transitive chain walk.
