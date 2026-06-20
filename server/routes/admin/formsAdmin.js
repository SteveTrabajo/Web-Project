import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES_DIR = path.resolve(__dirname, "../../files");
const METADATA_FILENAME = "forms.json";
const METADATA_PATH = path.join(FILES_DIR, METADATA_FILENAME);

const ALLOWED_EXT = new Set([".doc", ".docx", ".pdf"]);
const ALLOWED_USAGE = new Set(["advisor", "exception_registration", "other"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const adminRouter = express.Router();
const publicRouter = express.Router();

function hasHebrew(str) {
  return /[\u0590-\u05FF]/.test(str);
}

/**
 * Multipart uploads often deliver UTF-8 Hebrew filenames as latin1 mojibake.
 * Apply up to two latin1→utf8 passes when Hebrew is not already present.
 */
function fixFilenameEncoding(originalname = "") {
  const original = String(originalname);
  if (!original) return "";

  if (hasHebrew(original)) return original;

  let name = original;
  for (let i = 0; i < 2; i++) {
    try {
      const decoded = Buffer.from(name, "latin1").toString("utf8");
      if (hasHebrew(decoded)) return decoded;
      if (decoded === name) break;
      name = decoded;
    } catch {
      break;
    }
  }

  return original;
}

function sanitizeFilename(name = "") {
  const raw = fixFilenameEncoding(name);
  if (!raw || raw.includes("..") || raw.includes("/") || raw.includes("\\")) return null;
  const base = path.basename(raw);
  if (!base || base === METADATA_FILENAME) return null;
  const ext = path.extname(base).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return null;
  return base;
}

function resolveSafePath(filename) {
  const safeName = sanitizeFilename(filename);
  if (!safeName) return null;
  const fullPath = path.resolve(FILES_DIR, safeName);
  const relative = path.relative(FILES_DIR, fullPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return { safeName, fullPath };
}

function detectUsageFromFilename(filename) {
  if (filename.includes("ייעוץ")) return "advisor";
  if (filename.includes("רישום") || filename.includes("ביטול")) return "exception_registration";
  return "other";
}

function defaultLabel(filename) {
  return path.basename(filename, path.extname(filename));
}

async function ensureFilesDir() {
  await fs.mkdir(FILES_DIR, { recursive: true });
}

async function readMetadataRaw() {
  await ensureFilesDir();
  try {
    const raw = await fs.readFile(METADATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function scanDiskForms() {
  await ensureFilesDir();
  const entries = await fs.readdir(FILES_DIR);
  const forms = [];

  for (const entry of entries) {
    if (entry === METADATA_FILENAME) continue;
    const safeName = sanitizeFilename(entry);
    if (!safeName) continue;

    const stat = await fs.stat(path.join(FILES_DIR, safeName));
    if (!stat.isFile()) continue;

    forms.push({
      filename: safeName,
      label: defaultLabel(safeName),
      usage: detectUsageFromFilename(safeName),
      uploadedAt: stat.mtime.toISOString(),
    });
  }

  return forms;
}

async function bootstrapMetadata() {
  const forms = await scanDiskForms();
  await fs.writeFile(METADATA_PATH, JSON.stringify(forms, null, 2), "utf8");
  return forms;
}

async function readMetadata() {
  let metadata = await readMetadataRaw();
  if (metadata === null) {
    metadata = await bootstrapMetadata();
  }
  return metadata;
}

async function writeMetadata(forms) {
  await ensureFilesDir();
  await fs.writeFile(METADATA_PATH, JSON.stringify(forms, null, 2), "utf8");
}

async function syncMetadataWithDisk(metadata) {
  const byName = new Map(metadata.map((f) => [f.filename, f]));
  const diskForms = await scanDiskForms();

  const merged = diskForms.map((disk) => {
    const existing = byName.get(disk.filename);
    if (existing) {
      return {
        filename: disk.filename,
        label: existing.label || disk.label,
        usage: ALLOWED_USAGE.has(existing.usage) ? existing.usage : disk.usage,
        uploadedAt: existing.uploadedAt || disk.uploadedAt,
      };
    }
    return disk;
  });

  if (JSON.stringify(merged) !== JSON.stringify(metadata)) {
    await writeMetadata(merged);
  }

  return merged;
}

async function getFormsList() {
  const metadata = await readMetadata();
  return syncMetadataWithDisk(metadata);
}

function toPublicForm(form, req) {
  const base = `${req.protocol}://${req.get("host")}`;
  const encoded = form.filename
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return {
    filename: form.filename,
    label: form.label,
    usage: form.usage,
    uploadedAt: form.uploadedAt,
    url: `${base}/files/${encoded}`,
  };
}

async function toAdminForm(form, req) {
  const pub = toPublicForm(form, req);
  let size = null;
  try {
    const stat = await fs.stat(path.join(FILES_DIR, form.filename));
    size = stat.size;
  } catch {
    /* file may be missing */
  }
  return { ...pub, size };
}

async function formFileExists(safeName) {
  try {
    await fs.access(path.join(FILES_DIR, safeName));
    return true;
  } catch {
    return false;
  }
}

const formsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const fixedName = fixFilenameEncoding(file.originalname);
    const ext = path.extname(fixedName).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      cb(new Error("סוג קובץ לא מורשה. מותר: doc, docx, pdf"));
      return;
    }
    if (!sanitizeFilename(fixedName)) {
      cb(new Error("שם קובץ לא תקין"));
      return;
    }
    cb(null, true);
  },
});

async function listHandler(req, res) {
  try {
    const forms = await getFormsList();
    const enriched = await Promise.all(forms.map((f) => toAdminForm(f, req)));
    res.json({ forms: enriched });
  } catch (err) {
    console.error("FORMS LIST ERROR:", err);
    res.status(500).json({ error: "failed to list forms" });
  }
}

async function publicListHandler(req, res) {
  try {
    const forms = await getFormsList();
    res.json({ forms: forms.map((f) => toPublicForm(f, req)) });
  } catch (err) {
    console.error("FORMS PUBLIC LIST ERROR:", err);
    res.status(500).json({ error: "failed to list forms" });
  }
}

adminRouter.get("/forms", listHandler);

adminRouter.post("/forms/upload", (req, res) => {
  formsUpload.single("file")(req, res, async (err) => {
    if (err) {
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? "הקובץ גדול מדי (מקסימום 10MB)"
          : err.message || "שגיאת העלאה";
      return res.status(400).json({ error: msg });
    }

    if (!req.file) {
      return res.status(400).json({ error: "לא הועלה קובץ" });
    }

    const safeName = sanitizeFilename(req.file.originalname);
    if (!safeName) {
      return res.status(400).json({ error: "שם קובץ לא תקין" });
    }

    const label = String(req.body.label || "").trim() || defaultLabel(safeName);
    const usageRaw = String(req.body.usage || "other").trim();
    const usage = ALLOWED_USAGE.has(usageRaw) ? usageRaw : "other";

    try {
      await ensureFilesDir();

      const metadata = await readMetadata();
      const existsOnDisk = await formFileExists(safeName);
      const inMetadata = metadata.some((f) => f.filename === safeName);

      if (existsOnDisk || inMetadata) {
        return res.status(409).json({ error: "קובץ בשם זה כבר קיים" });
      }

      await fs.writeFile(path.join(FILES_DIR, safeName), req.file.buffer);

      const entry = {
        filename: safeName,
        label,
        usage,
        uploadedAt: new Date().toISOString(),
      };

      metadata.push(entry);
      await writeMetadata(metadata);

      const form = await toAdminForm(entry, req);
      res.json({ ok: true, form });
    } catch (e) {
      console.error("FORMS UPLOAD ERROR:", e);
      res.status(500).json({ error: "שגיאת שרת בהעלאה" });
    }
  });
});

adminRouter.delete("/forms/:filename", async (req, res) => {
  try {
    const decoded = fixFilenameEncoding(decodeURIComponent(req.params.filename || ""));
    if (decoded === METADATA_FILENAME || sanitizeFilename(decoded) === null) {
      return res.status(400).json({ error: "שם קובץ לא תקין" });
    }

    const resolved = resolveSafePath(decoded);
    if (!resolved) {
      return res.status(400).json({ error: "שם קובץ לא תקין" });
    }

    const { safeName, fullPath } = resolved;

    try {
      await fs.unlink(fullPath);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }

    const metadata = await getFormsList();
    const filtered = metadata.filter((f) => f.filename !== safeName);
    await writeMetadata(filtered);

    res.json({ ok: true });
  } catch (err) {
    console.error("FORMS DELETE ERROR:", err);
    res.status(500).json({ error: "שגיאה במחיקת הקובץ" });
  }
});

publicRouter.get("/forms", publicListHandler);

export { publicRouter as formsPublicRoutes };
export default adminRouter;
