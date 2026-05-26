2026-05-26

### Modified
- AdminShell.jsx - replaced shadcn Tabs with a right-side vertical sidebar nav (Card with vertical button list, sticky on md+, horizontal scroll on mobile)
- Header - inline admin info bar (status + email + buttons) replaces standalone card
- AdvisorsTab and YearbooksTab - editor side-panel removed; editing opens a shadcn Dialog. Tables fill full width
- Tables wrapped in overflow-x-auto with whitespace-nowrap on narrow columns; main column uses min-w-0 to shrink correctly
