# Run Guide - RainReady

This file explains how to run RainReady in mock mode.

## Prerequisites

- Docker Desktop (recommended)
- Git
- Node.js 18+ (only needed for local non-Docker frontend run)
- Python 3.11+ (only needed for local non-Docker backend run)

## Option 1 (Recommended): Run with Docker Compose

### 1. Open the project root

```bash
cd <your-cloned-repo-folder>
```

### 2. Create environment file

If `.env.example` exists:

```bash
cp .env.example .env
```

If `.env.example` does not exist, create `.env` manually with at least:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rainready
REDIS_URL=redis://localhost:6379/0
WAQI_API_TOKEN=
GROQ_API_KEY=
RAZORPAY_KEY_ID=mock_key
RAZORPAY_KEY_SECRET=mock_secret
SECRET_KEY=dev_secret
DEBUG=true
CORS_ORIGINS=http://localhost:5173
```

### 3. Build and start all services

```bash
docker-compose up --build
```

### 4. Verify services

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

### 5. Seed data (first run)

In a new terminal:

```bash
docker exec -it rainready-server-1 python scripts/seed_historical_data.py
```

If container name is different, run:

```bash
docker ps
```

Then replace `rainready-server-1` with the actual backend container name.

### 6. Stop services

```bash
docker-compose down
```

To also remove volumes:

```bash
docker-compose down -v
```

## Option 2: Run without Docker (local dev)

Use this only if you prefer local processes.

### Backend

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

In another terminal:

```bash
cd client
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

## Run Tests

### Backend tests

```bash
cd server
pytest tests/ -v
```

## Mock Workflow Check (quick smoke test)

1. Open frontend at http://localhost:5173
2. Register/login test worker
3. Activate policy from dashboard
4. Simulate disruption via API/Postman
5. Check claim and payout status in dashboard/admin views

## Common Issues

### Port already in use

- 5173 busy: stop existing Vite process
- 8000 busy: stop existing backend process
- 5432 busy: stop local Postgres or map different Docker port

### Docker container name mismatch for seed command

Use `docker ps` and copy the backend container name.

### API key missing

- `GROQ_API_KEY` is optional (fallback templates are used)
- `WAQI_API_TOKEN` can be left empty for basic local testing

### Database connection errors

- Ensure database service is running
- Ensure `DATABASE_URL` is correct for your chosen mode (Docker vs local)

## Recommended for Team Demos

- Use Docker Compose mode
- Keep mock payment mode enabled
- Use seeded test users and Postman collection for repeatable demo flow
