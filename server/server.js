import express from "express";
import cors from "cors";
import "dotenv/config";
import path from "path";
import firebase_admin from "firebase-admin";
import rateLimit from "express-rate-limit";

// routes
import yearbooksRoutes from "./routes/public/yearbooks.js";
import labsRoutes from "./routes/public/labs.js";
import advisorRoutes from "./routes/public/advisor.js";
import askRoutes from "./routes/public/ask.js";

import coursesAdminRoutes from "./routes/admin/coursesAdmin.js";
import advisorsAdminRoutes from "./routes/admin/advisorsAdmin.js";
import labsAdminRoutes from "./routes/admin/labsAdmin.js";
import uploadAdminRoutes from "./routes/admin/uploadAdmin.js";
import adminSecurityRoutes from "./routes/admin/adminSecurity.js";
import adminAuthRoutes from "./routes/admin/auth.js";
import registrationGuidelinesAdmin from "./routes/admin/registrationGuidelinesAdmin.js";
import formsAdminRoutes, { formsPublicRoutes } from "./routes/admin/formsAdmin.js";
import knowledgeCheckAdminRoutes from "./routes/admin/knowledgeCheckAdmin.js";
import yearbooksAdminRoutes from "./routes/admin/yearbooksAdmin.js";
import feedbackRoutes from "./routes/public/feedback.js";
import feedbackAdminRoutes from "./routes/admin/feedbackAdmin.js";
import unansweredAdminRoutes from "./routes/admin/unansweredAdmin.js";
import curatedAnswersRoutes from "./routes/admin/curatedAnswers.js";
import reportsAdminRoutes from "./routes/admin/reports.js";
import usageStatsRoutes from "./routes/admin/usageStats.js";
import cronRoutes from "./routes/internal/cron.js";
import { requireAdmin } from "./middleware/authMiddleware.js";

/* ======================
   App init
====================== */
const app = express();

/* ======================
   CORS (Local + Vercel)
====================== */
app.use(
    cors({
    origin: (origin, cb) => {
      const allowed =
        !origin ||
        /^http:\/\/localhost(:\d+)?$/.test(origin) ||
        origin === "https://web-project-gules-sigma.vercel.app";
      cb(allowed ? null : new Error("CORS"), allowed);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

/* ======================
   Middlewares
====================== */
// Global body limit stays tight. The yearbook commit route carries a full
// reviewed import (many courses + relations) and mounts its own larger parser,
// so the global parser skips it to avoid a premature 413.
const globalJson = express.json({ limit: "10kb" });
app.use((req, res, next) => {
  if (req.path.endsWith("/yearbook/commit")) return next();
  return globalJson(req, res, next);
});
/* ======================
   Static files (form downloads)
====================== */
const DOWNLOAD_EXT = new Set([".doc", ".docx", ".pdf"]);

// The files directory also holds the bot's knowledge-base corpus (the miluim /
// mitve .txt docs) and forms.json, none of which are student downloads. Serving
// the directory wholesale made those readable to anyone who guessed the URL, so
// only the student-form document types are public.
function isPublicFormPath(urlPath) {
  let decoded = urlPath;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    // malformed encoding - fall through and judge the raw path
  }
  return DOWNLOAD_EXT.has(path.extname(decoded).toLowerCase());
}

app.use(
  "/files",
  (req, res, next) => {
    if (!isPublicFormPath(req.path)) return res.status(404).json({ error: "Not found" });
    next();
  },
  express.static("files", {
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (!DOWNLOAD_EXT.has(ext)) return;
      const name = path.basename(filePath);
      // Hebrew filenames need RFC 5987 (filename*); the ASCII filename is a
      // fallback for legacy browsers that only understand the plain form.
      const asciiFallback = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(name)}`
      );
    },
  })
);

/* ======================
   Firebase init (ENV only)
====================== */
if (!firebase_admin.apps.length) {
  firebase_admin.initializeApp({
    credential: firebase_admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export const db = firebase_admin.firestore();

/* ======================
   Health check (Render)
====================== */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* ======================
   Rate limiting (public ask endpoint)
====================== */
const askLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { html: "⚠️ יותר מדי בקשות. אנא המתן דקה ונסה שוב." },
});

/* ======================
   Public Routes
====================== */
app.use("/api", yearbooksRoutes);
app.use("/api", labsRoutes);
app.use("/api", advisorRoutes);
app.use("/api/ask", askLimiter);
app.use("/api", askRoutes);
app.use("/api", formsPublicRoutes);
app.use("/api", feedbackRoutes);

/* ======================
   Internal Routes
   Triggered by the scheduled GitHub Action
====================== */
app.use("/api/internal", cronRoutes);

/* ======================
   Admin Auth Routes (public - no JWT required)
   Includes login, forgot-password, reset-password
====================== */
app.use("/api/admin/auth", adminAuthRoutes);

/* ======================
   Protected Admin Routes (JWT required)
====================== */
app.use("/api/admin/security", requireAdmin, adminSecurityRoutes);
app.use("/api/admin", requireAdmin, coursesAdminRoutes);
app.use("/api/admin", requireAdmin, advisorsAdminRoutes);
app.use("/api/admin", requireAdmin, labsAdminRoutes);
app.use("/api/admin", requireAdmin, uploadAdminRoutes);
app.use("/api/admin", requireAdmin, yearbooksAdminRoutes);
app.use("/api/admin/registration-guidelines", requireAdmin, registrationGuidelinesAdmin);
app.use("/api/admin", requireAdmin, formsAdminRoutes);
app.use("/api/admin", requireAdmin, knowledgeCheckAdminRoutes);
app.use("/api/admin", requireAdmin, feedbackAdminRoutes);
app.use("/api/admin", requireAdmin, unansweredAdminRoutes);
app.use("/api/admin", requireAdmin, curatedAnswersRoutes);
app.use("/api/admin", requireAdmin, reportsAdminRoutes);
app.use("/api/admin", requireAdmin, usageStatsRoutes);

/* ======================
   Start server (Local + Render)
====================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
