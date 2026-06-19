const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

// Sends an email through Brevo's HTTP API.
// Render's free tier blocks outbound SMTP, so we use HTTP (port 443) instead.
// attachments: optional array of { content (base64 string), name }
export async function sendEmail({ to, subject, html, text, attachments }) {
  const payload = {
    sender: { name: "BIO-BOT", email: process.env.BREVO_SENDER },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text,
  };
  if (attachments?.length) payload.attachment = attachments;

  const res = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Brevo send failed: ${res.status} ${detail}`);
  }
}
