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
import yearbooksAdminRoutes from "./routes/admin/yearbooksAdmin.js";
import feedbackRoutes from "./routes/public/feedback.js";
import feedbackAdminRoutes from "./routes/admin/feedbackAdmin.js";
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
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://web-project-gules-sigma.vercel.app"
    ],
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
app.use("/api", feedbackRoutes);

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
app.use("/api/admin", requireAdmin, feedbackAdminRoutes);

/* ======================
   Start server (Local + Render)
====================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
