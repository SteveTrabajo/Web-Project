import bcrypt from "bcrypt";
import { db } from "../server.js";

/*
 * Admin account helpers shared by the security and bulk-delete routes.
 *
 * Identity always comes from req.admin.id (the JWT), never from the request
 * body - otherwise one admin could change another admin's credentials.
 */

export const BCRYPT_ROUNDS = 12;

// Case-insensitive lookup across the collection: Firestore cannot query that way.
export async function findAdminByEmail(email) {
  const wanted = String(email || "").toLowerCase().trim();
  if (!wanted) return null;
  const snap = await db.collection("admins").get();
  return snap.docs.find((d) => String(d.data().email).toLowerCase() === wanted) || null;
}

/*
 * Re-authenticates the signed-in admin by password. A valid JWT is already
 * required to reach these routes; this is the extra confirmation for actions
 * that are irreversible or grant access, so a walk-up on an open session cannot
 * perform them. Accepts legacy plaintext records the same way login does.
 */
export async function verifyAdminPassword(adminId, password) {
  if (!adminId || !password) return false;
  const doc = await db.collection("admins").doc(adminId).get();
  if (!doc.exists) return false;
  const stored = String(doc.data()?.password || "");
  if (!stored) return false;
  return stored.startsWith("$2") ? bcrypt.compare(password, stored) : stored === password;
}

// Readable, unique document id derived from the login identifier.
export async function buildAdminId(email) {
  const base =
    String(email || "")
      .toLowerCase()
      .split("@")[0]
      .replace(/[^a-z0-9._-]/g, "")
      .slice(0, 40) || "admin";

  const existing = await db.collection("admins").get();
  const taken = new Set(existing.docs.map((d) => d.id));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    if (!taken.has(`${base}${i}`)) return `${base}${i}`;
  }
  return `${base}-${Date.now()}`;
}
