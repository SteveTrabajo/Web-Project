2026-05-26

### Added
- shadcn/ui (canary) initialized for Tailwind v4 - components land in src/components/ui/
- Primitives: Button, Input, Label, Card, Badge, Separator, Dialog, Checkbox, Textarea, Select
- src/lib/utils.js - shadcn cn() helper
- client/jsconfig.json - @/* import alias

### Modified
- vite.config.js - added path alias (@/ -> src/)
- index.css - tw-animate-css import, shadcn @theme inline token block, :root/.dark variable mapping to project colors
- App.css - gutted (was never imported; content moved to index.css)
- AdminLogin.jsx - migrated to shadcn Button/Input/Label/Separator; visual redesign with brand header and centered layout
- AdminPanel.jsx - login renders as standalone full-page centered layout
- AdminSecurityUI.jsx - migrated to shadcn Button/Input/Label/Separator; consistent feedback banner
- FeedbackModal.jsx - migrated to shadcn Dialog/Button/Checkbox/Textarea/Label; Escape + backdrop handled natively
- UploadYearbook.jsx - migrated to shadcn Card/Button/Input/Label
- UploadLabs.jsx - migrated to shadcn Card/Button/Input/Label/Select; replaced raw select + custom arrow CSS
