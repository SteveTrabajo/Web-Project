const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

export function getAdmin() {
  try {
    return JSON.parse(sessionStorage.getItem("bio_admin") || "null");
  } catch {
    return null;
  }
}

export function getAdminToken() {
  return getAdmin()?.token ?? null;
}

/*
 * Short-lived GET cache. Keyed by full path (query string included), it stores
 * the in-flight promise so that remounting a tab, switching back to a tab, or
 * several tabs requesting the same endpoint within the TTL all reuse one
 * network call instead of hammering the server. Any mutation (non-GET) clears
 * the cache so admins never see stale data right after an edit
 */
const _getCache = new Map();
const CACHE_TTL_MS = 60_000;

export function clearApiCache() {
  _getCache.clear();
}

export async function apiFetch(path, options = {}) {
  const token = getAdminToken();
  const method = options.method || "GET";

  if (method === "GET") {
    // options.force lets a deliberate "refresh" action bypass the cache
    const hit = _getCache.get(path);
    if (!options.force && hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.promise;
  } else {
    clearApiCache();
  }

  const promise = (async () => {
    const res = await fetch(API_BASE + path, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      method,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "API error");
    return data;
  })();

  if (method === "GET") {
    _getCache.set(path, { ts: Date.now(), promise });
    promise.catch(() => _getCache.delete(path)); // don't cache failures
  }

  return promise;
}
