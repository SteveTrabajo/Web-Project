2026-06-20

### Added
- RAG fallback in ask.js - when no intent matches, passes yearbook courses + registration context to Gemini and returns a composed Hebrew answer instead of a dead-end "didn't understand"
- Forms integration - bot registration responses now append relevant download links from the admin-managed forms system (advisor form, exception registration, exemption request)
- Advisor deduplication - registration "advisors" intent now queries live `academicAdvisors` Firestore collection; falls back to embedded contacts only if collection is empty

### Modified
- ask.js - new callGeminiText, getFormsCached, buildRagContext, callRagFallback; autoSaveUnanswered now only fires when RAG also fails
- registration.service.js - buildRegistrationAnswer is now async; accepts forms param; advisor case queries live collection via getAdvisorsForSemester; appendForms helper wires forms into exemptions/contacts/advisors/general responses
