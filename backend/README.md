# Backend Setup

## Run locally
1. Install dependencies:
   `pip install -r requirements.txt`
2. Start the server:
   `uvicorn app.main:app --host 0.0.0.0 --port 8000`

## Environment
- Copy `.env.example` to `.env` if needed.
- For local development, set `DATABASE_URL` to a reachable PostgreSQL endpoint.
