import express from "express";
import { db } from "../../server.js";

const router = express.Router();

router.get("/advisor", async (req, res) => {
  try {
    const lastNameLetter = req.query.lastNameLetter || "";
    const semester = parseInt(req.query.semester || "0", 10);
    const track = req.query.track || null;

    const snap = await db.collection("academicAdvisors").get();
    const advisors = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const letters = [
      "א","ב","ג","ד","ה","ו","ז","ח","ט","י","כ","ל","מ","נ","ס","ע","פ","צ","ק","ר","ש","ת"
    ];

    const match = advisors.filter((a) => {
      const semOk = a.semesters?.includes(semester);
      const letterOk = a.lastNameRanges?.some((rng) => {
        const [from, to] = rng.split("-");
        return (
          letters.indexOf(lastNameLetter) >= letters.indexOf(from) &&
          letters.indexOf(lastNameLetter) <= letters.indexOf(to)
        );
      });
      const trackOk =
        semester < 5 || !track || a.tracks?.includes(track);

      return semOk && letterOk && trackOk;
    });

    res.json({ found: !!match.length, advisors: match });
  } catch {
    res.status(500).json({ error: "failed" });
  }
});

export default router;
