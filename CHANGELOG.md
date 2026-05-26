2026-05-26

### Added
- shadcn/ui (canary) initialized for Tailwind v4 - components land in src/components/ui/
- Primitive components added: Button, Input, Label, Card, Badge, Separator
- src/lib/utils.js - shadcn cn() helper
- client/jsconfig.json - @/* import alias for shadcn compatibility

### Modified
- vite.config.js — added path alias (@/ → src/)
- index.css — added tw-animate-css import, shadcn @theme inline token block, and shadcn :root/.dark variable mapping wired to existing project colors (brand-navy → --primary light, bio-green-glow → --primary dark)
- App.css — gutted (content moved to index.css; file was never imported)
- AdminLogin.jsx — full visual redesign: brand logo badge, mode-aware title/subtitle, labeled inputs, colored success/error feedback banners, polished buttons with dark mode variants
- AdminPanel.jsx — login now renders in a standalone full-page centered layout; dashboard card widened to 380px
