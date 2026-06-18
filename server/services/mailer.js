import nodemailer from "nodemailer";

// Shared Gmail transporter used by password reset and the report scheduler.
export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
});
