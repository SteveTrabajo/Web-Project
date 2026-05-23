import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import os from "os";

const router = express.Router();

// "py" on Windows, "python3" on Linux/Render
const PYTHON_CMD = os.platform() === "win32" ? "py" : "python3";

// ======================
// Multer setup
// ======================
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (_, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

function cleanupFile(filePath) {
  fs.unlink(filePath, () => {});
}

// ======================
// Upload yearbook
// ======================
router.post("/upload/yearbook", upload.single("file"), (req, res) => {
  const { yearbookId, yearbookLabel } = req.body;
  const filePath = req.file?.path;

  if (!filePath) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // execFile passes args as an array - no shell interpolation, immune to injection
  execFile(
    PYTHON_CMD,
    ["parsers/yearbook_parser.py", filePath, yearbookId, yearbookLabel],
    (err, stdout, stderr) => {
      cleanupFile(filePath);
      if (err) {
        console.error(stderr || err.message);
        return res.status(500).json({
          error: "Yearbook parser failed",
          details: stderr || err.message,
        });
      }
      res.json({ ok: true });
    }
  );
});

// ======================
// Upload labs
// ======================
router.post("/upload/labs", upload.single("file"), (req, res) => {
  const { yearId, yearLabel, semester } = req.body;
  const filePath = req.file?.path;

  if (!filePath) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  execFile(
    PYTHON_CMD,
    ["parsers/labs_parser.py", filePath, yearId, yearLabel, semester],
    (err, stdout, stderr) => {
      cleanupFile(filePath);
      if (err) {
        console.error(stderr || err.message);
        return res.status(500).json({
          error: "Labs parser failed",
          details: stderr || err.message,
        });
      }
      res.json({ ok: true });
    }
  );
});

export default router;
