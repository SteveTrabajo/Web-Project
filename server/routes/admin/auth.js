import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../../server.js";
import { sendEmail } from "../../services/mailer.js";

const router = express.Router();
const ADMIN_ID = "admin1";

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "חסר אימייל או סיסמה" });
  }

  try {
    const snap = await db
      .collection("admins")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (snap.empty) return res.status(401).json({ error: "משתמש לא קיים" });

    const doc = snap.docs[0];
    const admin = doc.data();

    // Support both bcrypt hashes and legacy plaintext passwords.
    // On first plaintext login, the password is transparently migrated to a hash.
    const isHashed = String(admin.password).startsWith("$2");
    let valid = false;

    if (isHashed) {
      valid = await bcrypt.compare(password, admin.password);
    } else {
      valid = admin.password === password;
      if (valid) {
        const hashed = await bcrypt.hash(password, 12);
        await doc.ref.update({ password: hashed });
      }
    }

    if (!valid) return res.status(401).json({ error: "סיסמה שגויה" });

    const token = jwt.sign(
      { id: doc.id, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ id: doc.id, email: admin.email, name: admin.name || "", token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "שגיאת שרת" });
  }
});

// Forgot password - send reset code (public, no auth required)
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  const adminRef = db.collection("admins").doc(ADMIN_ID);
  const snap = await adminRef.get();

  if (!snap.exists || snap.data().email !== email) {
    return res.status(404).json({ error: "אימייל לא קיים" });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await adminRef.update({ resetCode: code, resetAt: Date.now() });

  await sendEmail({
    to: email,
    subject: "קוד לאיפוס סיסמה",
    text: `קוד האימות שלך הוא: ${code}`,
  });

  res.json({ ok: true });
});

// Reset password with code (public, no auth required)
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

  const hashed = await bcrypt.hash(newPassword, 12);
  await adminRef.update({ password: hashed, resetCode: null, resetAt: null });

  res.json({ ok: true });
});

export default router;
