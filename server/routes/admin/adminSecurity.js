import express from "express";
import { db } from "../../server.js";
import nodemailer from "nodemailer";

const router = express.Router();
const ADMIN_ID = "admin1";

// Send reset code to admin email
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  const adminRef = db.collection("admins").doc(ADMIN_ID);
  const snap = await adminRef.get();

  if (!snap.exists || snap.data().email !== email) {
    return res.status(404).json({ error: "אימייל לא קיים" });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await adminRef.update({
    resetCode: code,
    resetAt: Date.now(),
  });

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "biobot139@gmail.com",
      pass: "bdbd pwhr qlqr bjjk",
    },
  });

  await transporter.sendMail({
    from: "BIO-BOT",
    to: email,
    subject: "קוד לאיפוס סיסמה",
    text: `קוד האימות שלך הוא: ${code}`,
  });

  res.json({ ok: true });
});

// Verify reset code and set new password
router.post("/reset-password", async (req, res) => {
  const { code, newPassword } = req.body;

  const adminRef = db.collection("admins").doc(ADMIN_ID);
  const snap = await adminRef.get();
  const admin = snap.data();

  if (
    admin.resetCode !== code ||
    Date.now() - admin.resetAt > 10 * 60 * 1000
  ) {
    return res.status(400).json({ error: "קוד שגוי או פג תוקף" });
  }

  await adminRef.update({
    password: newPassword,
    resetCode: null,
    resetAt: null,
  });

  res.json({ ok: true });
});

// Update admin email
router.post("/change-email", async (req, res) => {
  const { newEmail } = req.body;

  if (!newEmail) {
    return res.status(400).json({ error: "חסר אימייל" });
  }

  await db.collection("admins").doc(ADMIN_ID).update({
    email: newEmail,
  });

  res.json({ ok: true });
});
// Update admin password
router.post("/change-password", async (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ error: "חסרה סיסמה חדשה" });
  }

  await db.collection("admins").doc(ADMIN_ID).update({
    password: newPassword,
  });

  res.json({ ok: true });
});

export default router;
