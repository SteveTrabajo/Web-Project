import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { db } from "../../server.js";
import {
  knownCreditsGapInfo,
  isKnownMissingLabStaff,
  knownLabStaffGapMessage,
  isKnownRegistrationWindowGap,
  isKnownMissingLinksGap,
  sectionStatusFromIssues,
  worstStatus,
} from "./knownDataGaps.js";

const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES_DIR = path.resolve(__dirname, "../../files");
const METADATA_PATH = path.join(FILES_DIR, "forms.json");

const VALID_RELATION_TYPES = new Set(["PREREQUISITE", "COREQUISITE"]);

function sectionResult(status = "ok", messages = [], issues = []) {
  return { status, messages, issues };
}

async function readFormsMetadataReadOnly() {
  try {
    const raw = await fs.readFile(METADATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function checkYearbooks() {
  const messages = [];
  const issues = [];
  let coursesCount = 0;
  let relationsCount = 0;
  let yearbooksCount = 0;
  const reportedCreditGaps = new Set();

  const snap = await db.collection("yearbooks").get();
  yearbooksCount = snap.size;

  if (snap.empty) {
    return {
      section: sectionResult("empty", ["לא נמצאו שנתונים במאגר הידע הסגור"], []),
      yearbooksCount,
      coursesCount,
      relationsCount,
    };
  }

  messages.push(`נמצאו ${yearbooksCount} שנתונים שהוזנו למערכת`);

  for (const ybDoc of snap.docs) {
    const data = ybDoc.data() || {};
    const ybId = ybDoc.id;

    if (!data.displayName) {
      issues.push({
        area: "שנתונים וקורסים",
        level: "warning",
        message: `שנתון "${ybId}": חסר displayName`,
      });
    }

    const semSnap = await ybDoc.ref.collection("requiredCourses").get();
    if (semSnap.empty) {
      issues.push({
        area: "שנתונים וקורסים",
        level: "warning",
        message: `שנתון "${ybId}": לא נמצאו סמסטרים (requiredCourses)`,
      });
      continue;
    }

    const semesterIds = semSnap.docs.map((d) => d.id);
    messages.push(`שנתון "${ybId}": סמסטרים — ${semesterIds.join(", ")}`);

    for (const semDoc of semSnap.docs) {
      const coursesSnap = await semDoc.ref.collection("courses").get();
      if (coursesSnap.empty) {
        issues.push({
          area: "שנתונים וקורסים",
          level: "warning",
          message: `שנתון "${ybId}" / ${semDoc.id}: לא נמצאו קורסים`,
        });
        continue;
      }

      for (const courseDoc of coursesSnap.docs) {
        coursesCount += 1;
        const c = courseDoc.data() || {};
        const courseCode = c.courseCode || courseDoc.id;
        const courseName = c.courseName;

        if (!courseName) {
          issues.push({
            area: "שנתונים וקורסים",
            level: "warning",
            message: `קורס ${courseCode} (${ybId}/${semDoc.id}): חסר courseName — מבנה לא תקין`,
          });
        }
        if (!courseCode) {
          issues.push({
            area: "שנתונים וקורסים",
            level: "error",
            message: `קורס ב-${ybId}/${semDoc.id}: חסר courseCode`,
          });
        }
        if (c.credits == null) {
          const creditsGap = knownCreditsGapInfo(courseCode);
          if (creditsGap) {
            const gapKey = String(courseCode);
            if (!reportedCreditGaps.has(gapKey)) {
              reportedCreditGaps.add(gapKey);
              issues.push({
                area: "שנתונים וקורסים",
                level: "info",
                message: `קורס ${courseCode}: ${creditsGap.message}`,
                courseCode: gapKey,
                creditsGapKind: creditsGap.kind,
                sourceCreditsMark: creditsGap.sourceCreditsMark,
                acceptedKnownGap: true,
              });
            }
          } else {
            issues.push({
              area: "שנתונים וקורסים",
              level: "warning",
              message: `קורס ${courseCode}: חסר credits`,
              courseCode: String(courseCode),
            });
          }
        }

        const relSnap = await courseDoc.ref.collection("relations").get();
        for (const relDoc of relSnap.docs) {
          relationsCount += 1;
          const r = relDoc.data() || {};
          if (!VALID_RELATION_TYPES.has(r.type)) {
            issues.push({
              area: "שנתונים וקורסים",
              level: "warning",
              message: `קשר ${courseCode}→${relDoc.id}: type לא תקין (${r.type || "חסר"})`,
            });
          }
          if (!r.courseCode && !relDoc.id) {
            issues.push({
              area: "שנתונים וקורסים",
              level: "warning",
              message: `קשר של קורס ${courseCode}: חסר courseCode`,
            });
          }
        }
      }
    }
  }

  const hasCourses = coursesCount > 0;
  const status = hasCourses
    ? sectionStatusFromIssues(issues)
    : "warning";

  if (hasCourses && (status === "ok" || status === "ok_with_notes")) {
    messages.push("מבנה שנתונים וקורסים: תקין");
  } else if (!hasCourses) {
    messages.push("חסר מידע: לא נמצאו קורסים בשנתונים");
  }

  return { section: sectionResult(status, messages, issues), yearbooksCount, coursesCount, relationsCount };
}

async function checkLabs() {
  const messages = [];
  const issues = [];
  let labYearsCount = 0;
  let labSemestersCount = 0;
  let labRowsCount = 0;

  const snap = await db.collection("lab_schedule").get();
  labYearsCount = snap.size;

  if (snap.empty) {
    return {
      section: sectionResult("empty", ["לא נמצאו לוחות מעבדה במאגר הידע"], []),
      labYearsCount,
      labSemestersCount,
      labRowsCount,
    };
  }

  messages.push(`נמצאו ${labYearsCount} שנות מעבדה`);

  for (const yearDoc of snap.docs) {
    const yearId = yearDoc.id;
    const semSnap = await yearDoc.ref.collection("semesters").get();

    if (semSnap.empty) {
      issues.push({
        area: "לוחות מעבדה",
        level: "warning",
        message: `שנה "${yearId}": לא נמצאו סמסטרים`,
      });
      continue;
    }

    labSemestersCount += semSnap.size;

    for (const semDoc of semSnap.docs) {
      const semData = semDoc.data() || {};
      const courses = semData.courses || {};

      if (!Object.keys(courses).length) {
        issues.push({
          area: "לוחות מעבדה",
          level: "warning",
          message: `שנה "${yearId}" סמסטר ${semDoc.id}: אין קורסים/מעבדות`,
        });
        continue;
      }

      for (const [code, course] of Object.entries(courses)) {
        const courseName = course?.courseName;
        const labs = course?.labs || [];

        if (!courseName) {
          issues.push({
            area: "לוחות מעבדה",
            level: "warning",
            message: `קורס ${code} (שנה ${yearId}, סמסטר ${semDoc.id}): חסר courseName`,
          });
        }

        if (!labs.length) {
          issues.push({
            area: "לוחות מעבדה",
            level: "warning",
            message: `קורס ${code}: אין שורות מעבדה`,
          });
          continue;
        }

        for (const lab of labs) {
          labRowsCount += 1;
          const missing = [];
          if (!lab.date) missing.push("date");
          if (!lab.day) missing.push("day");
          if (!lab.time) missing.push("time");
          if (lab.group == null || lab.group === "") missing.push("group");
          const staff = lab.staff;
          if (!staff || (Array.isArray(staff) && !staff.length)) missing.push("staff");

          if (missing.length) {
            const labCtx = {
              semester: semDoc.id,
              courseCode: code,
              session: lab.session,
              group: lab.group,
              missingFields: missing,
            };
            const staffOnlyGap =
              missing.length === 1 &&
              missing[0] === "staff" &&
              isKnownMissingLabStaff(labCtx);
            const staffGapMsg = staffOnlyGap ? knownLabStaffGapMessage(labCtx) : null;

            issues.push({
              area: "לוחות מעבדה",
              level: staffOnlyGap ? "info" : "warning",
              message: staffOnlyGap
                ? `קורס ${code} (סמסטר ${semDoc.id}, קבוצה ${lab.group}${lab.session ? `, ${lab.session}` : ""}): ${staffGapMsg}`
                : `מעבדה בקורס ${courseName || code}: חסר ${missing.join(", ")}`,
              ...labCtx,
              acceptedKnownGap: Boolean(staffOnlyGap),
            });
          }
        }
      }
    }
  }

  const status =
    labRowsCount === 0
      ? "warning"
      : sectionStatusFromIssues(issues, { hasContent: labRowsCount > 0 });

  if (status === "ok" || status === "ok_with_notes") {
    messages.push("לוחות מעבדה: תקין — ניתן לשלוף מידע דינמית מהנתונים");
  } else if (labRowsCount === 0) messages.push("חסר מידע: לא נמצאו שורות מעבדה");

  return { section: sectionResult(status, messages, issues), labYearsCount, labSemestersCount, labRowsCount };
}

async function checkRegistration() {
  const messages = [];
  const issues = [];
  let guidelinesCount = 0;

  for (let n = 1; n <= 8; n++) {
    const docId = `semester_${n}`;
    const snap = await db.collection("registrationGuidelines").doc(docId).get();

    if (!snap.exists) continue;

    guidelinesCount += 1;
    const d = snap.data() || {};

    if (!d.title) {
      issues.push({
        area: "הנחיות רישום",
        level: "warning",
        message: `סמסטר ${n}: חסר title`,
      });
    }
    if (!d.registrationWindow?.date && !d.registrationWindow?.from) {
      const regWindowGap = isKnownRegistrationWindowGap(n);
      issues.push({
        area: "הנחיות רישום",
        level: regWindowGap ? "info" : "warning",
        message: regWindowGap
          ? `סמסטר ${n}: חלון רישום לא פורש אוטומטית מהמסמך (ההנחיות נשמרו)`
          : `סמסטר ${n}: חסר registrationWindow`,
        semester: n,
        acceptedKnownGap: regWindowGap,
      });
    }
    if (!d.contacts || typeof d.contacts !== "object") {
      issues.push({
        area: "הנחיות רישום",
        level: "warning",
        message: `סמסטר ${n}: חסר contacts`,
      });
    }
    if (!Array.isArray(d.keyRules) || !d.keyRules.length) {
      issues.push({
        area: "הנחיות רישום",
        level: "warning",
        message: `סמסטר ${n}: חסרים keyRules`,
      });
    }
    if (!Array.isArray(d.links) || !d.links.length) {
      const linksGap = isKnownMissingLinksGap(n);
      if (linksGap) {
        issues.push({
          area: "הנחיות רישום",
          level: "info",
          message: `סמסטר ${n}: אין קישורים במסמך המקור — לא נדרש ייבוא`,
          semester: n,
          acceptedKnownGap: true,
        });
      } else {
        issues.push({
          area: "הנחיות רישום",
          level: "warning",
          message: `סמסטר ${n}: חסרים links`,
          semester: n,
        });
      }
    }
  }

  if (guidelinesCount === 0) {
    return {
      section: sectionResult("empty", ["לא נמצאו הנחיות רישום"], []),
      guidelinesCount,
    };
  }

  messages.push(`נמצאו ${guidelinesCount} מסמכי הנחיות רישום`);
  const status = sectionStatusFromIssues(issues, { hasContent: guidelinesCount > 0 });
  if (status === "ok" || status === "ok_with_notes") messages.push("הנחיות רישום: תקין");

  return { section: sectionResult(status, messages, issues), guidelinesCount };
}

async function checkAdvisors() {
  const messages = [];
  const issues = [];
  let advisorsCount = 0;

  const snap = await db.collection("academicAdvisors").get();
  advisorsCount = snap.size;

  if (snap.empty) {
    return {
      section: sectionResult(
        "empty",
        [
          "לא נמצאו יועצים",
          "יועצים אופציונליים — לא נמצא מקור רשמי מובנה מספיק לייבוא אוטומטי",
        ],
        []
      ),
      advisorsCount,
    };
  }

  messages.push(`נמצאו ${advisorsCount} יועצים`);

  for (const doc of snap.docs) {
    const a = doc.data() || {};
    const id = doc.id;

    if (!a.name) {
      issues.push({ area: "יועצים", level: "warning", message: `יועץ ${id}: חסר name` });
    }
    if (!a.email) {
      issues.push({ area: "יועצים", level: "warning", message: `יועץ ${id}: חסר email` });
    }
    if (!Array.isArray(a.semesters) || !a.semesters.length) {
      issues.push({ area: "יועצים", level: "warning", message: `יועץ ${id}: חסרים semesters` });
    }
    if (!Array.isArray(a.lastNameRanges) || !a.lastNameRanges.length) {
      issues.push({ area: "יועצים", level: "warning", message: `יועץ ${id}: חסרים lastNameRanges` });
    }
    const semesters = Array.isArray(a.semesters) ? a.semesters : [];
    const needsTracks = semesters.some((s) => Number(s) >= 5);
    if (needsTracks && (!Array.isArray(a.tracks) || !a.tracks.length)) {
      issues.push({ area: "יועצים", level: "warning", message: `יועץ ${id}: חסרים tracks` });
    }
  }

  const status = sectionStatusFromIssues(issues, { hasContent: advisorsCount > 0 });
  if (status === "ok" || status === "ok_with_notes") messages.push("יועצים: תקין");

  return { section: sectionResult(status, messages, issues), advisorsCount };
}

async function checkForms(req) {
  const messages = [];
  const issues = [];
  const metadata = await readFormsMetadataReadOnly();
  const formsCount = metadata.length;

  if (!metadata.length) {
    return {
      section: sectionResult("empty", ["לא נמצאו טפסים בבדיקת קבצים וטפסים"], []),
      formsCount,
    };
  }

  messages.push(`נמצאו ${formsCount} טפסים ב-forms.json`);

  const hasAdvisor = metadata.some((f) => f.usage === "advisor");
  const hasException = metadata.some((f) => f.usage === "exception_registration");

  if (!hasAdvisor) {
    issues.push({
      area: "טפסים",
      level: "warning",
      message: "חסר טופס עם usage=advisor",
    });
  }
  if (!hasException) {
    issues.push({
      area: "טפסים",
      level: "warning",
      message: "חסר טופס עם usage=exception_registration",
    });
  }

  const base = `${req.protocol}://${req.get("host")}`;

  for (const form of metadata) {
    const filePath = path.join(FILES_DIR, form.filename);
    try {
      await fs.access(filePath);
    } catch {
      issues.push({
        area: "טפסים",
        level: "error",
        message: `קובץ חסר בדיסק: ${form.filename}`,
      });
      continue;
    }

    const encoded = form.filename
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    const url = `${base}/files/${encoded}`;
    messages.push(`טופס "${form.filename}" (${form.usage || "other"}): ${url}`);
  }

  const status = issues.some((i) => i.level === "error")
    ? "error"
    : issues.length
      ? "warning"
      : "ok";

  if (status === "ok") messages.push("בדיקת קבצים וטפסים: תקין");

  return { section: sectionResult(status, messages, issues), formsCount, hasAdvisor, hasException };
}

router.get("/knowledge-check", async (req, res) => {
  try {
    const [yearbooks, labs, registration, advisors, forms] = await Promise.all([
      checkYearbooks(),
      checkLabs(),
      checkRegistration(),
      checkAdvisors(),
      checkForms(req),
    ]);

    const allIssues = [
      ...yearbooks.section.issues,
      ...labs.section.issues,
      ...registration.section.issues,
      ...advisors.section.issues,
      ...forms.section.issues,
    ];

    const warnings = [...new Set(allIssues.filter((i) => i.level === "warning").map((i) => i.message))];
    const infos = [...new Set(allIssues.filter((i) => i.level === "info").map((i) => i.message))];
    const errors = [...new Set(allIssues.filter((i) => i.level === "error").map((i) => i.message))];

    const sectionStatuses = [
      yearbooks.section.status,
      labs.section.status,
      registration.section.status,
      advisors.section.status,
      forms.section.status,
    ];

    let status = worstStatus(...sectionStatuses);
    const mostlyEmpty = sectionStatuses.filter((s) => s === "empty").length >= 3;
    if (mostlyEmpty && status !== "error") status = "empty";

    const summary = {
      yearbooksCount: yearbooks.yearbooksCount,
      coursesCount: yearbooks.coursesCount,
      relationsCount: yearbooks.relationsCount,
      labYearsCount: labs.labYearsCount,
      labSemestersCount: labs.labSemestersCount,
      labRowsCount: labs.labRowsCount,
      advisorsCount: advisors.advisorsCount,
      registrationGuidelinesCount: registration.guidelinesCount,
      formsCount: forms.formsCount,
    };

    res.json({
      ok: true,
      status,
      title: "בדיקת מאגר הידע",
      subtitle: "מאגר ידע סגור — נתונים שהוזנו למערכת בלבד",
      summary,
      warnings,
      infos,
      errors,
      sections: {
        yearbooks: {
          title: "שנתונים וקורסים",
          ...yearbooks.section,
        },
        labs: {
          title: "לוחות מעבדה",
          ...labs.section,
        },
        registration: {
          title: "הנחיות רישום",
          ...registration.section,
        },
        advisors: {
          title: "יועצים",
          ...advisors.section,
        },
        forms: {
          title: "טפסים",
          ...forms.section,
        },
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("KNOWLEDGE CHECK ERROR:", err);
    res.status(500).json({ ok: false, error: "שגיאה בהרצת בדיקת מאגר הידע" });
  }
});

export default router;
