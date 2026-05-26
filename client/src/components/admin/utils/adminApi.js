const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

export function getAdminToken() {
  try {
    return JSON.parse(sessionStorage.getItem("bio_admin") || "null")?.token ?? null;
  } catch {
    return null;
  }
}

export async function apiFetch(path, options = {}) {
  const token = getAdminToken();
  const res = await fetch(API_BASE + path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    method: options.method || "GET",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API error");
  return data;
}
