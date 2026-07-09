import { db } from "../server.js";
import { embed } from "./llm.js";

// Semantic retrieval over admin-curated answers (search_knowledge_base tool + ask.js).

const RAG_THRESHOLD = 0.78; // min cosine similarity for a confident hit

const _curatedCache = { ts: 0, items: [] };
const CURATED_TTL = 5 * 60 * 1000;

async function getCuratedAnswersCached() {
  const now = Date.now();
  if (_curatedCache.ts && now - _curatedCache.ts < CURATED_TTL) return _curatedCache.items;
  try {
    const snap = await db
      .collection("curatedAnswers")
      .where("status", "==", "published")
      .get();
    _curatedCache.items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    _curatedCache.ts = now;
  } catch {
    // keep stale cache on failure
  }
  return _curatedCache.items;
}

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function hashText(s = "") {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
}

// Curated-answer vectors cached by doc id + text hash, so each unique text is
// embedded only once and reused across the 5-minute curated cache windows.
const _embedCache = new Map();

async function getCuratedEmbedded() {
  const items = await getCuratedAnswersCached();
  const out = [];
  for (const a of items) {
    const text = `${a.question || ""} ${(a.keywords || []).join(" ")}`.trim();
    if (!text) continue;
    const h = hashText(text);
    let entry = _embedCache.get(a.id);
    if (!entry || entry.hash !== h) {
      const vector = await embed(text);
      if (!vector) continue;
      entry = { hash: h, vector };
      _embedCache.set(a.id, entry);
    }
    out.push({ ...a, vector: entry.vector });
  }
  return out;
}

// Best curated answer above the similarity threshold for this yearbook, or null.
export async function ragCuratedAnswer(question, yearbookId) {
  const qVec = await embed(question);
  if (!qVec) return null;
  const corpus = await getCuratedEmbedded();
  let best = null;
  let bestSim = 0;
  for (const a of corpus) {
    if (a.yearbook && a.yearbook !== yearbookId) continue;
    const sim = cosineSim(qVec, a.vector);
    if (sim > bestSim) { bestSim = sim; best = a; }
  }
  return best && bestSim >= RAG_THRESHOLD ? best : null;
}
