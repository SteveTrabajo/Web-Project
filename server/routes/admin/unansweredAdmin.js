import express from "express";
import bcrypt from "bcrypt";
import { db } from "../../server.js";

const router = express.Router();

/*
 * Re-authenticates the signed-in admin by password.
 * A valid JWT is already required to reach these routes; this is the extra
 * confirmation step for an irreversible bulk delete, so a walk-up on an open
 * session cannot wipe the queue.
 * Mirrors the bcrypt/legacy-plaintext handling in routes/admin/auth.js.
 */
async function verifyAdminPassword(adminId, password) {
  if (!adminId || !password) return false;
  const doc = await db.collection("admins").doc(adminId).get();
  if (!doc.exists) return false;
  const stored = String(doc.data()?.password || "");
  if (!stored) return false;
  return stored.startsWith("$2") ? bcrypt.compare(password, stored) : stored === password;
}

// GET /api/admin/unanswered-questions — JWT protected, paginated + optional date filters
// ?page=1&limit=20&from=ISO&to=ISO
router.get("/unanswered-questions", async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(100, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const { from, to } = req.query;
  const hasFilter = from || to;

  try {
    let query = db.collection("unansweredQuestions").orderBy("createdAt", "desc");
    if (from) query = query.where("createdAt", ">=", from);
    if (to)   query = query.where("createdAt", "<=", to);

    // Whole-collection size, so the UI can say how many a purge would remove
    // (the list itself is paginated / filtered).
    let total = null;
    try {
      total = (await db.collection("unansweredQuestions").count().get()).data().count;
    } catch {
      total = null;
    }

    if (hasFilter) {
      // Fetch all matching docs when filters are active; no pagination needed
      const snap = await query.get();
      const questions = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return res.json({ questions, page: 1, limit: questions.length, hasMore: false, total });
    }

    const snap = await query.limit(limit).offset(offset).get();
    const questions = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json({ questions, page, limit, hasMore: questions.length === limit, total });
  } catch (err) {
    console.error("unansweredAdmin GET error:", err);
    return res.status(500).json({ error: "שגיאת שרת פנימית" });
  }
});

// DELETE /api/admin/unanswered-questions — purge the whole queue.
// Irreversible, so it requires the admin's password on top of the JWT.
// Declared before the /:id route so "all" is never read as a document id.
router.delete("/unanswered-questions", async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "יש להזין סיסמה לאישור המחיקה." });

  try {
    const ok = await verifyAdminPassword(req.admin?.id, password);
    if (!ok) return res.status(401).json({ error: "סיסמה שגויה." });

    // Chunked: a Firestore batch caps at 500 operations.
    let deleted = 0;
    for (;;) {
      const snap = await db.collection("unansweredQuestions").limit(400).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deleted += snap.size;
      if (snap.size < 400) break;
    }

    res.json({ ok: true, deleted });
  } catch (err) {
    console.error("unansweredAdmin purge error:", err);
    res.status(500).json({ error: "שגיאת שרת פנימית" });
  }
});

// DELETE /api/admin/unanswered-questions/:id
router.delete("/unanswered-questions/:id", async (req, res) => {
  try {
    await db.collection("unansweredQuestions").doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (err) {
    console.error("unansweredAdmin DELETE error:", err);
    res.status(500).json({ error: "שגיאת שרת פנימית" });
  }
});

export default router;
