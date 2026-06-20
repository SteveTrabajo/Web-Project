import express from "express";
import bcrypt from "bcrypt";
import { db } from "../../server.js";

const router = express.Router();
const ADMIN_ID = "admin1";

// Change email (requires JWT - enforced by requireAdmin middleware in server.js)
router.post("/change-email", async (req, res) => {
  const { newEmail } = req.body;
  if (!newEmail) return res.status(400).json({ error: "חסר אימייל" });

  const wanted = String(newEmail).toLowerCase();
  const snap = await db.collection("admins").get();
  const taken = snap.docs.some(
    (d) => d.id !== ADMIN_ID && String(d.data().email).toLowerCase() === wanted
  );
  if (taken) return res.status(409).json({ error: "אימייל כבר בשימוש" });

  await db.collection("admins").doc(ADMIN_ID).update({ email: newEmail });
  res.json({ ok: true });
});

// Change password (requires JWT - enforced by requireAdmin middleware in server.js)
router.post("/change-password", async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: "חסרה סיסמה חדשה" });

  const hashed = await bcrypt.hash(newPassword, 12);
  await db.collection("admins").doc(ADMIN_ID).update({ password: hashed });
  res.json({ ok: true });
});

export default router;
