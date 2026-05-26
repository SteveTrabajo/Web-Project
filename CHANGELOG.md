2026-05-26

### Added
- src/components/admin/ folder split:
  - AdminShell.jsx (auth gate, header, status banner, tab strip)
  - tabs/AdvisorsTab.jsx, LabsTab.jsx, YearbooksTab.jsx, RegistrationTab.jsx, FeedbackTab.jsx
  - utils/adminApi.js (shared apiFetch + getAdminToken)

### Modified
- AdminSecurityUI.jsx, FeedbackModal.jsx, UploadYearbook.jsx, UploadLabs.jsx - migrated to shadcn primitives
- AdminPanel.jsx - reduced to a re-export shim of AdminShell; logic split into tab files
- Each admin tab now owns its own data fetching, CRUD, and draft state; AdminShell only owns auth + active tab + status toast
- Tab strip wrapped in dir="ltr" to fix RTL flex-wrap rendering (tabs were stacking as a vertical column)
- Removed local Card/Btn/PrimaryBtn/DangerBtn/Field helpers; all dark:bg-slate-*/text-gray-* replaced with token classes
- Fixed pre-existing bug: AdminSecurity was receiving adminUid instead of adminId
