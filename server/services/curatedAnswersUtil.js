/*
 * Shared curated-answer helpers.
 *
 * Curated answers render in the bot via dangerouslySetInnerHTML, and the backend
 * is the ONLY sanitization layer. Every path that writes a curatedAnswers doc
 * (the admin route and the yearbook import) MUST build answerHtml through
 * toSafeHtml here so sanitization stays identical and centralized.
 */

export function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Escape everything, then re-introduce only line breaks and safe auto-links.
export function toSafeHtml(text = "") {
  const escaped = escapeHtml(String(text).trim());
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline text-blue-700 dark:text-sky-300">$1</a>'
  );
  const withBreaks = linked.replace(/\n/g, "<br/>");
  return `<div class="text-sm leading-6">${withBreaks}</div>`;
}

export function cleanKeywords(keywords) {
  return (Array.isArray(keywords) ? keywords : [])
    .filter((k) => typeof k === "string")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 30);
}

export function cleanYearbook(yearbook) {
  return typeof yearbook === "string" && yearbook.trim()
    ? yearbook.trim().slice(0, 100)
    : null;
}
