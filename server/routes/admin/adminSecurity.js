import express from "express";
import bcrypt from "bcrypt";
import { db } from "../../server.js";

const router = express.Router();
const ADMIN_ID = "admin1";

// Change email (requires JWT - enforced by requireAdmin middleware in server.js)
router.post("/change-email", async (req, res) => {
  const { newEmail } = req.body;
  if (!newEmail) return res.status(400).json({ error: "חסר אימייל" });

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
