# Node + PostgreSQL API setup

This folder contains a lightweight backend implementation for tasks + auth with:

- Email/password login using bcrypt hashes.
- Google social login using Google ID token verification.
- PostgreSQL schema and SQL migrations.
- HTTP-only cookie sessions stored in PostgreSQL.
- Basic task CRUD endpoints.

## 1) Configure environment

```bash
cp server/.env.example server/.env
# update values as needed
```

## 2) Create database and run migrations

Make sure PostgreSQL is running and `DATABASE_URL` in `server/.env` points to your database.

```bash
export $(cat server/.env | xargs)
npm run db:migrate
```

## 3) Start API server

```bash
export $(cat server/.env | xargs)
npm run api
```

## Endpoints (MVP)

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/google`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/email-verification/request`
- `POST /api/auth/email-verification/confirm`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/confirm`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`

## Notes

- Session cookie is `httpOnly` and set to `secure` only in production.
- Login endpoints are rate-limited to 10 requests / 15 minutes.
- Token endpoints currently return token in JSON for local development convenience.
  In production, send these via email/SMS and never expose raw tokens in responses.
