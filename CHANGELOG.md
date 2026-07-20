2026-07-21

## Catalog-aware tool router - course questions no longer fall through

The LLM tool router picked tools from static descriptions with no knowledge of the actual
catalog, so a bare or partial course name ("הנדסה גנטית", "מעבר מסה") matched no tool and
returned no_tool/kb_miss even though the course exists. The router is now catalog-aware.

### Added

- `server/services/courseData.js` - `findCoursesInText()`: deterministic detection of real
  courses named in a question (word-bounded, most-specific first).
- `server/routes/public/toolRouter.js` - before routing, detected courses are injected into the
  system prompt; if the model still finds no tool (or the chosen tool produces no answer) but the
  question names a real course, the router falls back to that course's info card.
- `server/tests/router.courses.test.js` + `npm run test:router` - pins course questions to the
  tool + course code they must resolve to, incl. regressions (prereqs/contact/registration). 8/8.

### Modified

- `server/routes/public/toolRouter.js` - broadened `get_course_info` to cover course-number/code
  lookup and bare course mentions; hardened arg/tool descriptions so the model stops copying the
  example course ("ביוכימיה") into its arguments and copies the user's real question instead.
