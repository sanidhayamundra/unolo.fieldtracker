scscjdjdmm# Unolo Field Force Tracker
# Unolo Field Force Tracker

A web application for tracking field employee check-ins at client locations.

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, React Router
- **Backend:** Node.js, Express.js, SQLite
- **Authentication:** JWT

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm run setup    # Installs dependencies and initializes database
cp .env.example .env
npm run dev
```

Backend runs on: `http://localhost:3001`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: `http://localhost:5173`

### Test Credentials

| Role     | Email              | Password    |
|----------|-------------------|-------------|
| Manager  | manager@unolo.com | password123 |
| Employee | rahul@unolo.com   | password123 |
| Employee | priya@unolo.com   | password123 |

## Project Structure

```
├── backend/
│   ├── config/          # Database configuration
│   ├── middleware/      # Auth middleware
│   ├── routes/          # API routes
│   ├── scripts/         # Database init scripts
│   └── server.js        # Express app entry
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components
│   │   └── utils/       # API helpers
│   └── index.html
└── database/            # SQL schemas (reference only)
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login (email is case-insensitive)
- `GET /api/auth/me` - Get current user

### Check-ins
- `GET /api/checkin/clients` - Get assigned clients (includes lat/lng)
- `POST /api/checkin` - Create check-in (returns `distance_km` from client)
- `PUT /api/checkin/checkout` - Checkout from active check-in
- `GET /api/checkin/history` - Get check-in history (includes `distance_from_client`)
- `GET /api/checkin/active` - Get active check-in

### Dashboard
- `GET /api/dashboard/stats` - Manager dashboard stats
- `GET /api/dashboard/employee` - Employee dashboard stats

### Reports (Manager Only)
- `GET /api/reports/daily-summary?date=YYYY-MM-DD&employee_id=N` - Daily summary report
  - `date` (required): Date in YYYY-MM-DD format
  - `employee_id` (optional): Filter to specific employee
  - Returns per-employee check-in counts, working hours, unique clients visited
  - Includes team-level aggregates

## Features

### Distance Calculation
Check-ins now calculate distance from client location using the Haversine formula:
- Distance is stored in `distance_from_client` (kilometers, 2 decimal places)
- Frontend shows distance preview before check-in
- Warning displayed if more than 500m from client
- History page displays distance column

## Notes

- The database uses SQLite - no external database setup required
- Run `npm run init-db` to reset the database to initial state
- See `BUG_FIXES.md` for documented fixes
- See `QUESTIONS.md` for technical discussion
