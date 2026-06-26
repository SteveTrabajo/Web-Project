import express from "express";
import cors from "cors";
import "dotenv/config";
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
app.use(express.json({ limit: "10kb" }));
app.use("/files", express.static("files"));

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

// temp Firestore diagnostic — remove once the 403 is solved
app.get("/health/fs", async (req, res) => {
  const pk = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") || "";
  const out = {
    serverTimeUTC: new Date().toISOString(), // compare to real time → clock skew
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    keyOk: pk.startsWith("-----BEGIN PRIVATE KEY-----") && pk.trimEnd().endsWith("-----END PRIVATE KEY-----"),
    keyLen: pk.length,
  };
  try {
    const cols = await db.listCollections();
    out.firestore = "OK";
    out.collections = cols.map((c) => c.id);
  } catch (e) {
    out.firestore = "FAILED";
    out.code = e.code;
    out.details = e.details;
    out.message = e.message;
  }
  // raw REST probe: who is returning the HTML 403?
  try {
    const tok = await firebase_admin.app().options.credential.getAccessToken();
    const r = await fetch(
      `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/admins?pageSize=1`,
      { headers: { Authorization: `Bearer ${tok.access_token}` } }
    );
    out.restStatus = r.status;
    out.restServer = r.headers.get("server");
    out.restVia = r.headers.get("via");
    out.restBody = (await r.text()).slice(0, 600);
  } catch (e) {
    out.restProbeError = e.message;
  }
  res.json(out);
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
