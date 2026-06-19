# 🌱 BIO-BOT 2.0 - Academic Assistant for Biotechnology Students

BIO-BOT 2.0 is a revision and upgrade on the intelligent academic assistant designed for **Biotechnology students**.  
The system provides **natural-language answers in Hebrew** about courses, prerequisites, registration guidelines, lab schedules, and academic contacts — powered by structured academic data and AI (Google Gemini).

---

## 🎯 Project Goals

- Provide a **single conversational interface** for academic information
- Reduce confusion around:
  - Course prerequisites and relations
  - Registration rules and registration windows
  - Lab schedules and responsibilities
- Support **free-text questions in Hebrew**
- Combine **rule-based logic** with **AI-based intent understanding**
- Ensure answers are **accurate, explainable, and data-driven**

---

## 🧠 What BIO-BOT Can Answer

### 📘 Courses (Academic Logic)

Handled through course classification + Firestore relations.

Supported:

Course name ↔ course code

Prerequisites (PREREQUISITE)

Co-requisites (COREQUISITE)

Can course A be taken before / in parallel / after course B

Examples:

מה השם של קורס 11005?`

מה קורסי הקדם של חדו״א 2?

אפשר לקחת חדו״א 2 לפני אלגברה?



### 🗓️ Registration Guidelines
Information is fetched from **Firestore – `registrationGuidelines` collection**.

The system supports **many natural formulations**, interpreted using Gemini intent classification.

Supported topics:
- Registration windows (dates & hours)
- How to register (process questions)
- Registration links and guides
- Credit requirements (נ״ז, 165)
- Academic advisors
- Exemptions / special approvals
- Who to contact and for what

**Examples:**
- `מתי חלון הרישום לסמסטר 3?`
- `איך נרשמים לסמסטר 1?`
- `יש קישור להדרכת רישום?`
- `כמה נ״ז צריך לתואר?`
- `למי פונים לגבי פטור?`

---

### 🧪 Labs
Lab-related questions are handled by a **dedicated route** to avoid conflicts with registration logic.

Supported information:
- Lab dates
- Lab times
- Lab groups
- Lecturers
- Lab schedule by semester

**Examples:**
- `מתי יש מעבדה בביולוגיה מולקולרית?`
- `מתי יש מעבדה בסמסטר 2?`

---

### 💙 Emotional Support Detection
If a student expresses emotional or academic distress, the system responds **empathetically** and suggests appropriate academic support resources.

**Examples:**
- `אני בלחץ מהלימודים`
- `לא מצליחה להבין כלום`
- `אני מרגישה תקועה`

---

## 🏗️ System Architecture

### Backend
- **Node.js + Express**
- **Firestore (Firebase Admin SDK)**
- **Google Gemini API**
- Modular route-based architecture

### Key API Routes
- `/api/ask` – Main question answering endpoint  
- `/api/labs/*` – Lab-related queries  
- `/api/feedback` – Anonymous student feedback (no auth)  
- `/api/admin/*` – Admin CRUD, uploads, feedback export, reports (JWT)  
- `/api/internal/run-report` – Weekly report trigger (GitHub Actions, secret-gated)  

### Data Sources (Firestore)
- `yearbooks/{id}/requiredCourses` – Courses & relations  
- `registrationGuidelines/semester_X` – Registration rules  
- `labs` – Lab schedules  
- `feedback` – Anonymous student feedback  
- `admins` – Admin accounts (bcrypt-hashed passwords)  

---

## 🧩 Technologies Used

- Node.js + Express (ES Modules)
- Firebase Firestore (Admin SDK)
- Google Gemini (intent classification)
- React 19 + Vite + Tailwind CSS v4
- shadcn/ui (@base-ui/react)
- Brevo HTTP API (transactional email)
- GitHub Actions (weekly scheduled report)

---

## 🔐 Environment Variables

### Server (.env inside /server)

Create a `.env` file inside the `server` directory:

GEMINI_API_KEY=  
FIREBASE_PROJECT_ID=  
FIREBASE_CLIENT_EMAIL=  
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"  
JWT_SECRET=  
BREVO_API_KEY=  
BREVO_SENDER=  
CRON_SECRET=  
PORT=5000


---

### Client (.env inside /client)

Local development:

VITE_API_BASE=http://localhost:5000

Production (Render backend):

VITE_API_BASE=https://web-project-dz5u.onrender.com

---

## ▶️ Running Locally

### Backend Server

cd server  
npm install  
node server.js  

Server will run on http://localhost:5000 (or `PORT` if set).

First run — seed the admin account:

node seed-admin.js

Python parsers (only needed for DOCX/Excel uploads):

pip install python-docx firebase-admin

---

### Frontend Client

cd client  
npm install  
npm run dev  

Client will run on:

http://localhost:5173

---

## 🚀 Deployment Instructions

### Frontend – Vercel

1. Import the GitHub repository into Vercel.  
2. Set Root Directory to:

client

3. Add environment variable:

VITE_API_BASE=https://web-project-dz5u.onrender.com

4. Deploy normally.

---

### Backend – Render

Build Command:

npm install

Start Command:

node server.js

Add all `server/.env` variables in the Render dashboard. For the GitHub Actions weekly report, set `RENDER_URL` and `CRON_SECRET` as repository secrets.

---

## 🌐 Production Links

Frontend:

https://web-project-gules-sigma.vercel.app

Backend:

https://web-project-dz5u.onrender.com

---

## ⚠️ Notes

- Frontend deployed on Vercel, backend on Render (free tier — cold starts possible).  
- Render free tier blocks outbound SMTP; email is sent via Brevo HTTP API instead.  
- Firestore is used as the database (no SQL).  
- Google Gemini is used for AI intent classification.  

