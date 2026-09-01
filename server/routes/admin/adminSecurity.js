import express from "express";
import bcrypt from "bcrypt";
import { db } from "../../server.js";
import {
  BCRYPT_ROUNDS,
  buildAdminId,
  findAdminByEmail,
  verifyAdminPassword,
} from "../../services/adminAuth.js";

const router = express.Router();

/*
 * Every route here acts on the signed-in admin identified by the JWT
 * (req.admin.id, set by requireAdmin). It previously wrote to a hardcoded
 * "admin1" document, so a second admin changing their own password silently
 * overwrote the first admin's credentials.
 */

// Change email (requires JWT - enforced by requireAdmin middleware in server.js)
router.post("/change-email", async (req, res) => {
  const { newEmail } = req.body;
  if (!newEmail) return res.status(400).json({ error: "חסר אימייל" });

  const me = req.admin?.id;
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const existing = await findAdminByEmail(newEmail);
  if (existing && existing.id !== me) {
    return res.status(409).json({ error: "אימייל כבר בשימוש" });
  }

  await db.collection("admins").doc(me).update({ email: String(newEmail).trim() });
  res.json({ ok: true });
});

// Change password (requires JWT - enforced by requireAdmin middleware in server.js)
router.post("/change-password", async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: "חסרה סיסמה חדשה" });
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: "הסיסמה חייבת להכיל לפחות 6 תווים" });
  }

  const me = req.admin?.id;
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const hashed = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS);
  await db.collection("admins").doc(me).update({ password: hashed });
  res.json({ ok: true });
});

/* =============================
   Admin account management

   Adding an admin grants full dashboard access, and removing one can lock
   people out, so both re-check the acting admin's password on top of the JWT.
============================= */

// Never returns password hashes.
router.get("/admins", async (req, res) => {
  try {
    const snap = await db.collection("admins").get();
    const admins = snap.docs
      .map((d) => ({
        id: d.id,
        email: d.data()?.email || "",
        name: d.data()?.name || "",
        isSelf: d.id === req.admin?.id,
      }))
      .sort((a, b) => a.email.localeCompare(b.email));
    res.json({ admins });
  } catch (err) {
    console.error("admins GET error:", err);
    res.status(500).json({ error: "שגיאת שרת פנימית" });
  }
});

router.post("/admins", async (req, res) => {
  const { email, name, password, currentPassword } = req.body || {};

  if (!email || !String(email).trim()) return res.status(400).json({ error: "חסר אימייל / שם משתמש" });
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: "הסיסמה חייבת להכיל לפחות 6 תווים" });
  }
  if (!currentPassword) return res.status(400).json({ error: "יש להזין את הסיסמה שלך לאישור" });

  try {
    if (!(await verifyAdminPassword(req.admin?.id, currentPassword))) {
      return res.status(401).json({ error: "הסיסמה שלך שגויה." });
    }
    if (await findAdminByEmail(email)) {
      return res.status(409).json({ error: "כבר קיים מנהל עם אימייל זה." });
    }

    const id = await buildAdminId(email);
    await db.collection("admins").doc(id).set({
      email: String(email).trim(),
      name: String(name || "").trim(),
      password: await bcrypt.hash(String(password), BCRYPT_ROUNDS),
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error("admins POST error:", err);
    res.status(500).json({ error: "שגיאת שרת פנימית" });
  }
});

router.delete("/admins/:id", async (req, res) => {
  const { id } = req.params;
  const { currentPassword } = req.body || {};
  const me = req.admin?.id;

  // Self-deletion would log you out mid-session and can be done by another
  // admin instead; blocking it also prevents removing the only account.
  if (id === me) return res.status(400).json({ error: "לא ניתן למחוק את החשבון שלך." });
  if (!currentPassword) return res.status(400).json({ error: "יש להזין את הסיסמה שלך לאישור" });

  try {
    if (!(await verifyAdminPassword(me, currentPassword))) {
      return res.status(401).json({ error: "הסיסמה שלך שגויה." });
    }

    const all = await db.collection("admins").get();
    if (all.size <= 1) return res.status(400).json({ error: "חייב להישאר לפחות מנהל אחד." });
    if (!all.docs.some((d) => d.id === id)) {
      return res.status(404).json({ error: "המנהל לא נמצא." });
    }

    await db.collection("admins").doc(id).delete();
    res.json({ ok: true });
  } catch (err) {
    console.error("admins DELETE error:", err);
    res.status(500).json({ error: "שגיאת שרת פנימית" });
  }
});

export default router;
