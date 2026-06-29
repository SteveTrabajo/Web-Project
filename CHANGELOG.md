2026-06-29

### Added
- Semantic RAG over curated answers - ask.js now embeds the question (Gemini `text-embedding-004`) and cosine-matches cached curated-answer vectors BEFORE any generative call; a confident hit returns the admin answer with no Gemini generation
- Conversation context - the bot sends the latest 7 turns of the current chat; the classifier and generative fallback use them so follow-up questions ("ומה הקדם שלו?") resolve correctly
- Advisor redirect - study-related questions with no answer now route the student to their academic advisor (best-effort by semester, else the advisor menu) plus dean contact, instead of a dead-end "didn't understand"
- Admin apiFetch GET cache (60s TTL, mutation-invalidated) to stop refetch-on-every-tab-switch

### Modified
- ask.js - replaced keyword `findCuratedAnswer` with embedding-based `ragCuratedAnswer`; `callRagFallback` -> `answerOrRoute` (returns answer / advisor / off-topic via NEED_ADVISOR / OFF_TOPIC sentinels, folding study-relevance into one call); generative Gemini fires only on a RAG miss
- Bot.jsx - sends conversation `history`; input capped at 150 chars; message bubbles wrap instead of overflowing
