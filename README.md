# InfraPredict AI

Smart Public Infrastructure Platform for citizen infrastructure reporting, GPS-based complaint capture, risk prioritization and authority-side request management.

## Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MySQL
- Authentication: JWT + bcrypt password hashing
- Location: Browser Geolocation API

## Features
- Citizen registration and login
- Admin login
- Complaint submission
- Current GPS latitude/longitude
- Infrastructure and severity selection
- Automatic department mapping
- Rule-based risk score
- Citizen complaint tracking
- Admin request management
- Search/filter-ready API
- Status workflow: Pending → In Progress → Resolved
- Admin analytics API

## 1. Requirements
Install Node.js and MySQL.

## 2. Database setup
Open MySQL Workbench or MySQL command line and run:

`database/infrapredict.sql`

This creates the `infrapredict` database and tables.

## 3. Configure backend
Open `backend` and copy `.env.example` to `.env`.

Set your MySQL password in `.env`.

Example:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=infrapredict
JWT_SECRET=use_a_long_random_secret_here
```

## 4. Install and seed admin

```bash
cd backend
npm install
npm run seed
npm start
```

Admin demo:
- Username: `admin`
- Password: `admin123`

## 5. Open the project

Visit:

`http://localhost:5000`

The Express server serves the frontend and API from the same project.

## API overview
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/complaints`
- `GET /api/complaints/my`
- `GET /api/admin/requests`
- `PUT /api/admin/requests/:id/status`
- `DELETE /api/admin/requests/:id`
- `GET /api/admin/analytics`
- `GET /api/health`

## GitHub
Do NOT upload `.env` or `node_modules`.

```bash
git init
git add .
git commit -m "Initial InfraPredict AI full-stack project"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/InfraPredict-AI.git
git push -u origin main
```

## Important
This is a hackathon/demo application. For production deployment, use HTTPS, stronger secret management, rate limiting, audit logs, secure CORS, database backups, OTP/email verification and a production hosting environment.
