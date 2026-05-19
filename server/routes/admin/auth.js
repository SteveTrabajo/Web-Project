import express from "express";
import { db } from "../../server.js";

const router = express.Router();

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

    if (snap.empty) {
      return res.status(401).json({ error: "משתמש לא קיים" });
    }

    const doc = snap.docs[0];
    const admin = doc.data();

    if (admin.password !== password) {
      return res.status(401).json({ error: "סיסמה שגויה" });
    }

    res.json({
      id: doc.id,
      email: admin.email,
      name: admin.name || "",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "שגיאת שרת" });
  }
});

export default router;
