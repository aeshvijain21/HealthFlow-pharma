# HealthFlow 🏥

An AI-powered, full-stack platform for capturing and managing patient health data and follow-ups — connecting patients, doctors, and administrators through a single, secure system.

**🔗 Live: [healthflow-pharma.onrender.com](https://healthflow-pharma.onrender.com)**

> Note: hosted on Render's free tier, so the first request after a period of inactivity can take 30–60 seconds to wake up.

---

## 🧩 Problem

When a patient reports a health event related to a medication, pharmaceutical companies need complete follow-up information to assess the drug's ongoing safety profile — this data feeds into regulatory reports that determine whether a medicine stays on the market as-is, needs additional warnings, or requires further changes. But follow-up attempts often fail: complex, repeated requests overwhelm busy patients and healthcare providers, discourage responses, and growing concerns about scams make people warier of engaging at all. The resulting gaps in data make it harder for companies to meet reporting obligations and for regulators to make well-informed safety decisions. HealthFlow is a platform for capturing and managing this kind of follow-up data more simply and securely, with AI support to help flag reports that look incomplete or need closer attention.

## ⚙️ What It Does

- **Role-based access** for patients, doctors, and administrators — separating who submits data, who reviews it clinically, and who manages the process
- **AI-assisted analysis** of reported symptoms and follow-up data, flagging what may need closer attention, powered by Groq + Llama, plus a conversational assistant for basic guidance
- **Secure authentication** via JWT, with bcrypt password hashing to protect sensitive health data
- **Rate limiting and hardened headers** (via `express-rate-limit` and `helmet`) to protect auth endpoints from abuse
- **Structured report management** with CRUD operations, so follow-up data is captured, reviewed, and tracked in one place
- **Analytics** for report management, patient monitoring, and health insights

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB (Atlas) |
| Auth | JWT, bcrypt |
| AI | Groq API, Llama |
| Hosting | Render |

## 🏗️ Architecture

This is a single repo containing both `frontend/` and `backend/`. The Express backend exposes REST APIs under `/api/*` and, in production, also serves the frontend's static files directly — so one deployed service handles the whole app. MongoDB (hosted on Atlas) stores users and reports, JWT + bcrypt handle auth, and the AI assistant layer calls Groq's Llama models for symptom analysis and conversational guidance.

## 📁 Project Structure

```
healthflow/
├── frontend/
│   └── index.html
├── backend/
│   ├── config/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   │   ├── auth.js
│   │   ├── reports.js
│   │   ├── admin.js
│   │   └── ai.js
│   ├── server.js
│   └── .env.example
```

## 🚀 Running Locally

```bash
git clone https://github.com/aeshvijain21/HealthFlow-pharma.git
cd HealthFlow-pharma/backend
npm install
cp .env.example .env   # then fill in your own values
npm run seed            # creates the admin account
npm start
```

The server runs on `http://localhost:5000` by default and serves the API at `/api/*`.

### Environment Variables

See `backend/.env.example` for the full list — you'll need your own MongoDB URI (local or Atlas), a JWT secret, and a Groq API key at minimum.

## 👤 Author

**Aeshvi Jain** — [GitHub](https://github.com/aeshvijain21) · [LinkedIn](https://linkedin.com/in/aeshvi-jain-68b820284)
