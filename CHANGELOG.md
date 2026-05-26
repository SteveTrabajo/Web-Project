2026-05-26

### Added
- tabs/SettingsTab.jsx - admin settings page with password + email change sections
- index.css typography scale: text-page-title, text-heading, text-body, text-caption (4 levels, ~2px steps)
- --popover / --popover-foreground tokens (solid white light / solid navy dark)

### Modified
- index.css - bumped html font-size to 17px; added font-synthesis so font-bold renders bolder under Heebo Light
- AdminShell.jsx - added "settings" nav item; removed security button, dialog, and AdminSecurity import
- adminApi.js - added getAdmin() helper; getAdminToken() now reuses it
- All admin tabs migrated to the new typography scale

### Removed
- AdminSecurityUI.jsx - content migrated to SettingsTab
