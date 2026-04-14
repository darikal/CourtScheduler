# 🎾 Court Scheduler

A web app for scheduling tennis & pickleball court sessions. Players browse a monthly calendar, click any future date, and sign up for singles or doubles play — so others can see who's coming and join in.

---

## Features
- 📅 Monthly calendar with color-coded signups (blue = singles, yellow = doubles)
- 👥 See who's signed up for each day before committing
- ✏️ Sign up with name, optional email, game type, and a personal note
- 🗑 Remove any signup
- 📱 Mobile-friendly responsive layout
- ⚡ Fast — same-origin Express server serves the frontend

---

## Stack
- **Backend**: Node.js + Express
- **Database**: MongoDB (local or Atlas cloud)
- **Frontend**: Vanilla HTML/CSS/JS (no build step needed)

---

## Quick Start (Local)

### 1. Prerequisites
- [Node.js](https://nodejs.org) v18+
- [MongoDB](https://www.mongodb.com/try/download/community) running locally, OR a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### 2. Install
```bash
cd court-scheduler
npm install
```

### 3. Configure
```bash
cp .env.example .env
# Edit .env with your MongoDB connection string
```

### 4. Run
```bash
npm start
# or for auto-restart on changes:
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deploy to the Web

### Option A — Render.com (Free tier, easiest)
1. Push this folder to a GitHub repo
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your repo
4. Set **Start Command**: `npm start`
5. Add environment variables:
   - `MONGODB_URI` → your MongoDB Atlas connection string
   - `DB_NAME` → `court_scheduler`
6. Deploy — you'll get a public URL like `https://your-app.onrender.com`

### Option B — Railway.app
1. Push to GitHub
2. Go to [railway.app](https://railway.app) → **New Project from GitHub**
3. Add a MongoDB plugin, or use Atlas URI
4. Set env vars as above → Deploy

### Option C — DigitalOcean / VPS
```bash
# On your server:
git clone <your-repo>
cd court-scheduler
npm install
# Set up .env
# Use PM2 for process management:
npm install -g pm2
pm2 start server.js --name court-scheduler
pm2 save
```

---

## MongoDB Atlas Setup (Cloud DB)
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → create free account
2. Create a free M0 cluster
3. Under **Database Access**: create a user with read/write permissions
4. Under **Network Access**: Add `0.0.0.0/0` (allow all IPs) for hosted apps
5. Click **Connect** → **Drivers** → copy the URI
6. Replace `<password>` in the URI and paste into your `.env`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
   ```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions?month=2026-04` | Get all sessions in a month |
| GET | `/api/sessions/:date` | Get one date (e.g. `2026-04-15`) |
| POST | `/api/sessions/:date/signup` | Sign up for a date |
| DELETE | `/api/sessions/:date/signup/:playerId` | Remove a signup |

**POST body example:**
```json
{
  "name": "Alex Johnson",
  "email": "alex@example.com",
  "gameType": "doubles",
  "note": "Prefer mornings, intermediate level"
}
```

---

## Customization Tips
- **Court name/branding**: Edit the `<h1>` in `public/index.html`
- **Colors**: Change CSS variables at the top of `index.html`
- **Max group sizes**: You can add validation in `server.js` to cap doubles at 4 players, etc.
- **Email reminders**: Integrate [Nodemailer](https://nodemailer.com) + a cron job using the stored emails
