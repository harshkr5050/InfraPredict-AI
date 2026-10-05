# InfraPredict AI — Full Stack

This project uses the supplied `admin.html` as the UI/feature reference and upgrades it into a real full-stack predictive-maintenance platform.

## What is included
- Responsive Citizen + Admin/Authority website
- Citizen registration and secure login
- Admin login
- Password hashing using Node's built-in `crypto.scrypt`
- Server-side session tokens
- Persistent SQLite database
- GPS-based infrastructure reports
- Road, bridge, streetlight, water pipeline, drainage and public-building categories
- Automatic department routing
- Risk scoring: Critical 95, High 80, Medium 55, Low 25
- Citizen dashboard and personal complaint tracking
- Admin dashboard with global counts
- Search, status and department filters
- Admin status updates: Pending / In Progress / Resolved
- Admin deletion of invalid requests
- Analytics without external chart libraries
- Risk-ranked predictive maintenance priority queue
- Works without `npm install` or internet once Node.js is installed

## Requirements
Install **Node.js 22 or newer**.

## Fastest way to run on Windows
1. Extract the ZIP.
2. Open the `infrapredict-fullstack` folder.
3. Double-click `run.bat`.
4. The browser opens at `http://localhost:3000`.

## Manual run
```bash
node server.js
```
Then open `http://localhost:3000`.

## Demo accounts
**Citizen**
- Mobile: `9876543210`
- Password: `1234`

**Admin**
- Username: `admin`
- Password: `change-me-before-deploy`

Change the admin credentials before a real deployment. Copy `.env.example` to `.env` and edit:

```env
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password
```

> Admin credentials are seeded when the database is first created. If you change them after first run, delete `data/infrapredict.db` and restart during development, or update the admin record properly for production.

## Database
The app automatically creates:

`data/infrapredict.db`

Tables:
- `users`
- `complaints`
- `sessions`

## Main API routes
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/dashboard`
- `GET /api/complaints`
- `POST /api/complaints`
- `PATCH /api/complaints/:requestId/status`
- `DELETE /api/complaints/:requestId`
- `GET /api/analytics`
- `GET /api/health`

## Project structure
```text
infrapredict-fullstack/
├── public/
│   └── index.html
├── db.js
├── server.js
├── package.json
├── run.bat
├── .env.example
└── README.md
```

## Deployment
This version is excellent for a hackathon demo, local server, Render/Railway/Fly.io/VPS with persistent storage. For a multi-instance production deployment, move the SQLite data layer to a hosted PostgreSQL database such as Neon or Supabase.
