import express from "express";
import { db } from "../../server.js";
import { diffAdvisorSync } from "../../services/registrationImport.js";


const router = express.Router();

async function getCollectionAdvisors() {
  const snap = await db.collection("academicAdvisors").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/*
 * Advisors live in two stores: this collection (which the bot's letter/track
 * picker reads) and registrationGuidelines/semester_N.contacts.academicAdvisors
 * (which the guidelines DOCX import fills). These two endpoints reconcile them -
 * preview computes the diff, apply writes only the rows the admin approved.
 * Deletions are never proposed, so hand-created advisors are safe.
 */
router.post("/advisors/sync/preview", async (req, res) => {
  try {
    const incoming = Array.isArray(req.body?.advisors) ? req.body.advisors : [];
    const rows = diffAdvisorSync(incoming, await getCollectionAdvisors());
    res.json({
      ok: true,
      rows,
      counts: {
        new: rows.filter((r) => r.status === "new").length,
        update: rows.filter((r) => r.status === "update").length,
        same: rows.filter((r) => r.status === "same").length,
      },
    });
  } catch (e) {
    console.error("advisor sync preview:", e);
    res.status(500).json({ error: "שגיאה בהכנת הסנכרון" });
  }
});

router.post("/advisors/sync/apply", async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    // Recompute the diff server-side so the client cannot write an arbitrary
    // advisor document; only ids the preview actually proposed are written.
    const incoming = rows.map((r) => r.advisor).filter(Boolean);
    const fresh = diffAdvisorSync(incoming, await getCollectionAdvisors());
    const approved = new Set(rows.map((r) => r.id));

    const batch = db.batch();
    let written = 0;
    for (const row of fresh) {
      if (row.status === "same" || !approved.has(row.id)) continue;
      const { id, ...data } = row.advisor;
      batch.set(db.collection("academicAdvisors").doc(id), data, { merge: true });
      written++;
    }
    if (written) await batch.commit();

    res.json({ ok: true, written });
  } catch (e) {
    console.error("advisor sync apply:", e);
    res.status(500).json({ error: "שגיאה בסנכרון היועצים" });
  }
});

router.get("/advisors", async (req, res) => {
  const snap = await db.collection("academicAdvisors").get();
  res.json({
    advisors: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
  });
});
router.post("/advisors/:advisorId",  async (req, res) => {
  await db
    .collection("academicAdvisors")
    .doc(req.params.advisorId)
    .set(req.body, { merge: true });

  res.json({ ok: true });
});
router.delete("/advisors/:advisorId", async (req, res) => {
  await db.collection("academicAdvisors").doc(req.params.advisorId).delete();
  res.json({ ok: true });
});

export default router;
