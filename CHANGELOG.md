2026-07-09

### Added
- Lab upload preview-then-confirm flow - uploading an Excel now parses only (no DB write); the admin reviews all parsed rows plus a quality report (missing fields, unparseable dates) and commits via the existing labs PUT endpoint
- Parser `--dry-run` flag for validating a labs Excel locally without Firestore credentials
- Multi-day ("מרוכז") lab support - date ranges like 14-16.6.26 are stored as `date` + `dateEnd` and render as 14-16/06/2026 in the viewer and chat

### Modified
- Labs parser normalizes dates to ISO yyyy-mm-dd (handles Excel date cells, d.m.yy text, day/cross-month ranges) and times to HH:MM
- Chat lab answers are range-aware (date/week filters and next-lab treat multi-day labs as intervals) and day filtering now matches "ב" against stored "ב'" and day ranges
