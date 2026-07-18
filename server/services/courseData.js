import { db } from "../server.js";

// Shared course + relation data access, used by both ask.js and toolRouter.js.

export function normalizeHebrew(s = "") {
  return String(s)
    .replace(/["׳״'`]/g, "")
    .replace(/[.-]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export const isCourseCode = (s) => /^\d{5,6}$/.test(String(s || "").trim());

export function extractCourseCode(question = "") {
  const m = String(question).match(/\b\d{5,6}\b/);
  return m ? m[0] : null;
}

/* ---------- courses ---------- */

const _coursesCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getAllCoursesCached(yearbookId) {
  const now = Date.now();
  const cached = _coursesCache.get(yearbookId);
  if (cached && now - cached.ts < CACHE_TTL_MS) return cached.courses;

  const coursesRef = db.collection("yearbooks").doc(yearbookId).collection("requiredCourses");
  const semestersSnap = await coursesRef.get();

  const semesterDocs = semestersSnap.docs;
  const coursePromises = semesterDocs.map((sem) => sem.ref.collection("courses").get());
  const coursesSnaps = await Promise.all(coursePromises);

  const allCourses = [];
  coursesSnaps.forEach((snap, idx) => {
    const semesterKey = semesterDocs[idx].id;
    snap.forEach((doc) => {
      const data = doc.data() || {};
      const courseCode = String(data.courseCode || doc.id);
      const courseName = String(data.courseName || "");
      allCourses.push({
        courseCode,
        courseName,
        semesterKey,
        nameNorm: normalizeHebrew(courseName),
        codeNorm: courseCode.replace(/\s+/g, ""),
        // Attributes from the yearbook parser (null when absent in the source).
        credits: data.credits ?? null,
        lectureHours: data.lectureHours ?? null,
        practiceHours: data.practiceHours ?? null,
        labHours: data.labHours ?? null,
        // Layer 3: precomputed full prerequisite chain (null for legacy imports).
        transitivePrerequisites: Array.isArray(data.transitivePrerequisites)
          ? data.transitivePrerequisites
          : null,
      });
    });
  });

  _coursesCache.set(yearbookId, { ts: now, courses: allCourses });
  return allCourses;
}

export function matchCourse(raw, courses, nameIndex) {
  if (!raw) return null;
  const s = String(raw).trim();

  if (isCourseCode(s)) return courses.find((c) => c.courseCode === s) || null;

  const n = normalizeHebrew(s);
  if (!n) return null;

  if (nameIndex?.has(n)) return nameIndex.get(n);

  if (nameIndex) {
    for (const [key, course] of nameIndex.entries()) {
      if (key.includes(n) || n.includes(key)) return course;
    }
  }

  // No index supplied: direct scan.
  return (
    courses.find((c) => c.nameNorm === n) ||
    courses.find((c) => c.nameNorm && (c.nameNorm.includes(n) || n.includes(c.nameNorm))) ||
    null
  );
}

// Course-info card: credits, weekly hours (lecture/practice/lab + total) and
// semester. Rendered from the cached course object; fields absent in the source
// yearbook are shown as "not specified" rather than omitted silently.
export function buildCourseInfoHtml(course) {
  const semNum = course.semesterKey?.match(/\d+/)?.[0] || null;

  const hourBits = [];
  if (course.lectureHours) hourBits.push(`הרצאה ${course.lectureHours}`);
  if (course.practiceHours) hourBits.push(`תרגול ${course.practiceHours}`);
  if (course.labHours) hourBits.push(`מעבדה ${course.labHours}`);
  const totalHours = [course.lectureHours, course.practiceHours, course.labHours]
    .reduce((sum, h) => sum + (Number(h) || 0), 0);

  const rows = [`• נקודות זכות (נ"ז): ${course.credits != null ? course.credits : "לא צוין בשנתון"}`];
  if (hourBits.length) rows.push(`• שעות שבועיות: ${hourBits.join(", ")} (סה"כ ${totalHours})`);
  if (semNum) rows.push(`• סמסטר: ${semNum}`);

  return `
    <div class="text-sm leading-6">
      📋 <b class="bot-title">${course.courseName}</b> (${course.courseCode})<br/><br/>
      ${rows.join("<br/>")}
    </div>`;
}

/* ---------- relations (both directions from one scan) ---------- */

const _relIndexCache = new Map();
const RELATION_CACHE_TTL_MS = 5 * 60 * 1000;

// forward: course -> [{ code, type }] its prerequisites/co-reqs
// reverse: course -> [{ code, type }] courses that list it as a relation
export async function getRelationIndex(yearbookId) {
  const now = Date.now();
  const cached = _relIndexCache.get(yearbookId);
  if (cached && now - cached.ts < RELATION_CACHE_TTL_MS) return cached.index;

  const snap = await db.collectionGroup("relations").get();
  const forward = new Map();
  const reverse = new Map();
  for (const doc of snap.docs) {
    if (!doc.ref.path.startsWith(`yearbooks/${yearbookId}/`)) continue;
    const dependentCode = doc.ref.parent.parent?.id;
    const prereqCode = doc.id;
    if (!dependentCode) continue;
    const type = doc.data()?.type || null;
    if (!forward.has(dependentCode)) forward.set(dependentCode, []);
    forward.get(dependentCode).push({ code: prereqCode, type });
    if (!reverse.has(prereqCode)) reverse.set(prereqCode, []);
    reverse.get(prereqCode).push({ code: dependentCode, type });
  }

  const index = { forward, reverse };
  _relIndexCache.set(yearbookId, { ts: now, index });
  return index;
}
