import fetch from "node-fetch";

/*
 * Single LLM provider module. All HTTP/provider details live here so the rest
 * of the server only ever calls callLLM / callLLMJson / embed.
 *
 * Provider: OpenAI. Models are overridable via env:
 *   OPENAI_API_KEY        (required)
 *   OPENAI_MODEL          (default: gpt-4o-mini)
 *   OPENAI_EMBED_MODEL    (default: text-embedding-3-small)
 */

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const EMBED_URL = "https://api.openai.com/v1/embeddings";
const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  };
}

// Tolerant JSON extraction (strips ```json fences, falls back to first {...}).
function extractJson(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

// Plain-text completion. Returns trimmed text, or null on any failure.
export async function callLLM(prompt, { temperature = 0.2 } = {}) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        model: CHAT_MODEL,
        temperature,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content;
    return text?.trim() || null;
  } catch {
    return null;
  }
}

// JSON completion via OpenAI JSON mode. Returns a parsed object, or null.
// The system message guarantees the "json" keyword JSON mode requires.
export async function callLLMJson(prompt, { temperature = 0 } = {}) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        model: CHAT_MODEL,
        temperature,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Respond ONLY with a single valid JSON object, no prose." },
          { role: "user", content: prompt },
        ],
      }),
    });
    const data = await resp.json();
    return extractJson(data?.choices?.[0]?.message?.content);
  } catch {
    return null;
  }
}

// Embedding vector (number[]) for a single text, or null on failure.
export async function embed(text) {
  try {
    const resp = await fetch(EMBED_URL, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: String(text).slice(0, 8000),
      }),
    });
    const data = await resp.json();
    const vec = data?.data?.[0]?.embedding;
    return Array.isArray(vec) ? vec : null;
  } catch {
    return null;
  }
}
