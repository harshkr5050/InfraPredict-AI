# InfraPredict AI — Full Stack

InfraPredict AI is a full-stack public infrastructure reporting and predictive-maintenance demo with Citizen and Admin/Authority portals.

## Included
- Responsive Citizen + Admin website
- Citizen registration and login
- Admin login
- Password hashing with Node `crypto.scrypt`
- Server-side session tokens
- Neon PostgreSQL database
- GPS-based infrastructure reports
- Road, bridge, streetlight, water pipeline, drainage and public-building categories
- Automatic department routing
- Risk scoring: Critical 95, High 80, Medium 55, Low 25
- Citizen dashboard and complaint tracking
- Admin dashboard, filters and status updates
- Analytics and risk-ranked maintenance priority queue

## Runtime
- Node.js 24
- `@neondatabase/serverless`
- PostgreSQL / Neon

## Environment variables
Create `.env` locally or add these in Vercel Project Settings → Environment Variables:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me-before-deploy
```

Do not commit a real `.env` file.

## Vercel deployment
1. Import this GitHub repository into Vercel.
2. In Vercel Marketplace install **Neon** for the project, or connect an existing Neon PostgreSQL database.
3. Make sure Vercel has a `DATABASE_URL` environment variable for Production (and Preview if required).
4. Add `ADMIN_USERNAME` and `ADMIN_PASSWORD` in Vercel Environment Variables.
5. Redeploy the project.

The app creates its tables automatically on first request and seeds the demo citizen and admin account.

## Local run
Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example` and place your Neon `DATABASE_URL` in it. Then run:

```bash
npm start
```

Open `http://localhost:3000`.

## Demo citizen
- Mobile: `9876543210`
- Password: `1234`

## Admin
- Username comes from `ADMIN_USERNAME`
- Password comes from `ADMIN_PASSWORD`

## API routes
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

## Structure
```text
InfraPredict-AI/
├── public/
│   └── index.html
├── db.js
├── server.js
├── server.ts
├── package.json
├── .env.example
├── .gitignore
├── run.bat
└── README.md
```

`server.ts` is the Vercel zero-config Node entrypoint. `server.js` is also kept for local Windows/Node execution.
