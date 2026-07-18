2026-07-18

## General course-info answers (credits / weekly hours / semester)

The bot can now answer general questions about a single course - how many נ"ז it gives,
its weekly hours (lecture/practice/lab), and which semester it belongs to. Previously these
fell through to the advisor-redirect fallback because the attributes were never loaded.

### Added

- `server/services/courseData.js` - course cache now loads `credits`, `lectureHours`,
  `practiceHours`, `labHours`; new `buildCourseInfoHtml()` renders a shared course-info card.
- `server/routes/public/toolRouter.js` - new `get_course_info` tool (course credits/hours/semester).
- `server/routes/public/ask.js` - `isCourseInfoQuestion` detector + course-info branch in the
  keyword pipeline; capability advertised in the bare-course-mention clarify prompt.

### Modified

- `server/routes/public/ask.js` - registration gate now excludes course-info questions so a
  per-course "כמה נ\"ז" is not answered with the degree-level 165 נ"ז rule.
