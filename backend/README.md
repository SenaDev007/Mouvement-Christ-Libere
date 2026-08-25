# Backend API — Mouvement Christ Libère

Standalone **Express.js** server replicating all the Next.js API routes of the
Mouvement Christ Libère monolith. Designed for deployment on **Railway** (or
any Node.js host).

## Why this exists

The project was a Next.js monolith (`src/app/api/*`). To scale independently,
we split it into:

- `frontend/` — Next.js app (pages + components only, no API routes) → **Vercel**
- `backend/` — this folder, a standalone Express server → **Railway**

All 26+ API routes from `src/app/api/*` and `src/app/admin/api/*` are
replicated here 1:1.

## Quick start

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Generate Prisma client
npx prisma generate

# 3. Copy env vars and edit them
cp .env.example .env
# (set DATABASE_URL, JWT_SECRET, VAPID keys, etc.)

# 4. Push the database schema (PostgreSQL)
npx prisma db push

# 5. (Optional) Seed
npm run db:seed

# 6. Start dev server (hot reload)
npm run dev
```

The server listens on port `3001` by default (override with `PORT`).

## Endpoints

| Method | Path                                              | Description                          | Auth     |
| ------ | ------------------------------------------------- | ------------------------------------ | -------- |
| GET    | `/api/health`                                     | Health check                         | Public   |
| GET    | `/api`                                            | API root info                        | Public   |
| POST   | `/api/auth/register`                              | Create user, return JWT              | Public   |
| POST   | `/api/auth/login`                                 | Login, return JWT                    | Public   |
| POST   | `/api/auth/logout`                                | Clear auth cookie                    | Public   |
| GET    | `/api/auth/session`                               | Return current user                  | JWT      |
| POST   | `/api/auth/admin-login`                           | Admin login (cookie)                 | Public   |
| POST   | `/api/auth/admin-logout`                          | Admin logout                         | Public   |
| GET    | `/api/auth/csrf`                                  | NextAuth compatibility stub          | Public   |
| GET    | `/api/auth/providers`                             | NextAuth compatibility stub          | Public   |
| GET    | `/api/yeshua-connect/conversations`               | List channels                        | Public\* |
| GET    | `/api/yeshua-connect/conversations/:id/messages`  | List messages                        | Public\* |
| POST   | `/api/yeshua-connect/conversations/:id/messages`  | Send message                         | Public\* |
| POST   | `/api/yeshua-connect/conversations/:id/messages/attachment` | Upload file + create message | Public\* |
| GET    | `/api/yeshua-connect/channels`                    | List channels                        | Public   |
| POST   | `/api/yeshua-connect/channels`                    | Create channel                       | Public   |
| GET    | `/api/yeshua-connect/announcements`               | List announcements                   | Public   |
| POST   | `/api/yeshua-connect/announcements`               | Publish announcement                 | Public   |
| GET    | `/api/yeshua-connect/search?q=`                   | Global search                        | Public   |
| GET    | `/api/yeshua-connect/calls`                       | Call history                         | Public   |
| PUT    | `/api/yeshua-connect/messages/:messageId/edit`    | Edit message                         | Public   |
| DELETE | `/api/yeshua-connect/messages/:messageId/delete`  | Delete message                       | Public   |
| POST   | `/api/yeshua-connect/messages/:messageId/react`   | React to message                     | Public   |
| POST   | `/api/yeshua-connect/messages/:messageId/forward` | Forward message                      | Public   |
| POST   | `/api/yeshua-connect/messages/:messageId/pin`     | Pin message                          | Public   |
| GET    | `/api/push/vapid`                                 | Public VAPID key                     | Public   |
| POST   | `/api/push/subscribe`                             | Save push subscription               | JWT      |
| DELETE | `/api/push/subscribe`                             | Remove push subscription             | JWT      |
| POST   | `/api/push/send`                                  | Send push notification               | Public   |
| POST   | `/api/matrix/token`                               | Issue Matrix access token            | JWT      |
| POST   | `/api/livekit/token`                              | Issue LiveKit access token           | JWT      |
| POST   | `/api/transcribe`                                 | Whisper transcription                | Public   |
| GET    | `/api/user/profile`                               | Get user profile                     | JWT      |
| PUT    | `/api/user/profile`                               | Update user profile                  | JWT      |
| GET    | `/api/calendrier/rappels`                         | Get reminder prefs                   | JWT      |
| PUT    | `/api/calendrier/rappels`                         | Update reminder prefs                | JWT      |
| GET    | `/api/calendrier/shabbat`                         | Check Shabbat mode                   | JWT      |
| POST   | `/api/calendrier/shabbat`                         | Toggle Shabbat mode                  | JWT      |
| GET    | `/api/bible/:reference`                           | Get verse by reference               | Public   |
| GET    | `/api/bible/search?q=`                            | Search verses                        | Public   |
| POST   | `/api/contact`                                    | Submit contact form                  | Public   |
| GET    | `/api/home`                                       | Home page data                       | Public   |
| GET    | `/api/intercession`                               | List intercession requests           | Public   |
| POST   | `/api/intercession`                               | Create intercession request          | Public   |
| POST   | `/api/intercession/:id/prier`                     | Increment prayer count               | Public   |
| GET    | `/api/disperses`                                  | List dispersed members               | Public   |
| POST   | `/api/disperses`                                  | Add dispersed member                 | Public   |
| GET    | `/api/cron/shabbat-reminder`                      | Cron: Shabbat reminders              | CRON_SECRET |
| GET    | `/api/calendrier-biblique/:annee`                 | Biblical year (364 days)             | Public   |
| GET    | `/api/calendrier-biblique/fetes?annee=`           | List feasts for the year             | Public   |
| GET    | `/api/calendrier-biblique/convertir`              | Gregorian ↔ biblical conversion      | Public   |
| GET    | `/api/calendrier-biblique/ical?annee=`            | iCal export                          | Public   |
| GET    | `/api/bible-v2/versions`                          | List Bible versions                  | Public   |
| GET    | `/api/bible-v2/search?version=&q=`                | Full-text search                     | Public   |
| GET    | `/api/bible-v2/strong/:numero`                    | Strong definition                    | Public   |
| GET    | `/api/bible-v2/concordance/:numero`               | Strong concordance                   | Public   |
| GET    | `/api/bible-v2/hebrew/:livre/:chapitre/:verset`   | Hebrew morphology (OSHB)             | Public   |
| GET    | `/api/bible-v2/peshitta/:livre/:chapitre`         | Aramaic Peshitta                     | Public   |
| GET    | `/api/bible-v2/:version/:livre/:chapitre`         | Full chapter                         | Public   |
| GET    | `/api/soustitres`                                 | Available subtitle languages         | Public   |
| POST   | `/api/soustitres`                                 | Generate subtitles                   | Public   |
| GET    | `/api/dead-mans-switch`                           | List switches                        | Public   |
| POST   | `/api/dead-mans-switch`                           | Create switch                        | Public   |
| POST   | `/api/dead-mans-switch/signal`                    | Reset timer                          | Public   |
| GET    | `/api/dead-mans-switch/cron`                      | Cron: check & trigger                | CRON_SECRET |
| POST   | `/api/arweave/ancrer`                             | Anchor content (SHA-256)             | Public   |
| POST   | `/api/arweave/verifier`                           | Verify content integrity             | Public   |
| POST   | `/api/admin/login`                                | Admin login                          | Public   |
| POST   | `/api/admin/logout`                               | Admin logout                         | Public   |
| GET    | `/api/admin/:entity`                              | List entities                        | Admin    |
| POST   | `/api/admin/:entity`                              | Create entity                        | Admin    |
| GET    | `/api/admin/:entity/:id`                          | Get entity                           | Admin    |
| PATCH  | `/api/admin/:entity/:id`                          | Update entity                        | Admin    |
| DELETE | `/api/admin/:entity/:id`                          | Delete entity                        | Admin    |

\* The original Next.js code didn't enforce auth on these endpoints — the
backend replicates that behaviour for now. Add `requireAuth` if you want to
lock them down.

## Authentication

The backend replaces NextAuth v5 with a simple JWT scheme:

1. **Login** (`POST /api/auth/login`) verifies email + password with `bcryptjs`,
   signs a JWT, and sets it as an `httpOnly` cookie named `auth_token`.
2. **Protected routes** use the `requireAuth` middleware which reads the JWT
   from the cookie (or `Authorization: Bearer <token>` header) and populates
   `req.user = { id, email, name, role }`.
3. **Admin backoffice** uses a separate `admin_session` cookie (HMAC-signed
   token) — same scheme as the original `src/lib/auth.ts`.

The JWT secret is configured via `JWT_SECRET`. Tokens expire after 30 days
(configurable via `JWT_EXPIRES_IN`).

### Frontend migration notes

The Next.js frontend's `next-auth` provider must be replaced with a small
fetch-based client that calls `/api/auth/login`, `/api/auth/register`,
`/api/auth/logout`, and `/api/auth/session` (with `credentials: "include"`
so the cookie is sent). The `useSession()` hook should be replaced with a
custom hook reading from `/api/auth/session`.

## File uploads

`multer` is used for multipart/form-data uploads:

- `POST /api/transcribe` accepts a `audio` file (memory storage, 25 MB max)
- `POST /api/yeshua-connect/conversations/:id/messages/attachment` accepts a
  `file` field (disk storage in `public/uploads/yeshua-connect/`, 50 MB max)

Uploaded files are served at `/uploads/...` (static route in `index.ts`).
In production, replace the disk storage with S3/R2/Cloudinary.

## Deployment (Railway)

1. Create a new Railway project from this folder.
2. Add a **PostgreSQL** plugin — Railway will inject `DATABASE_URL`.
3. Set the env vars from `.env.example`:
   - `CORS_ORIGIN` — your Vercel frontend URL (e.g. `https://your-app.vercel.app`)
   - `JWT_SECRET` — random 32+ char string
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — generate with `npx web-push generate-vapid-keys`
   - `ADMIN_DEFAULT_PASSWORD` — admin panel password
   - `OPENAI_API_KEY` (optional, for Whisper transcription)
   - `MATRIX_*` (optional, for Matrix messaging)
   - `LIVEKIT_*` (optional, for audio/video calls)
   - `CRON_SECRET` — secret for protecting cron endpoints
4. Deploy — Railway will run `npm install`, `npx prisma generate`,
   `npm run build`, and start `npm run start`.
5. Set up a Railway Cron Job to call:
   - `GET /api/cron/shabbat-reminder` every Friday at 16:00 UTC
     (with header `Authorization: Bearer <CRON_SECRET>`)
   - `GET /api/dead-mans-switch/cron` daily at 03:00 UTC

Health check: `GET /api/health` returns `{ status: "ok" }`.

## Database

The Prisma schema is copied verbatim from the root `prisma/schema.prisma`.
It expects PostgreSQL (set `DATABASE_URL` and `DIRECT_URL`).

Run migrations:

```bash
npm run db:push      # push schema (dev)
npm run db:migrate   # apply migrations (prod)
npm run db:seed      # seed authentic content (Pam + Kongo)
```

## Differences from the Next.js monolith

| Concern                  | Next.js monolith                       | Backend (this folder)                   |
| ------------------------ | -------------------------------------- | ---------------------------------------- |
| Framework                | Next.js 16 App Router                  | Express 4                                |
| Auth                     | NextAuth v5 (JWT cookies)              | jsonwebtoken + custom middleware         |
| Route files              | `route.ts` with `export async function GET/POST` | `router.get/post('/', async (req, res) => ...)` |
| Body parsing             | `await req.json()`                     | `req.body` (express.json())              |
| URL params               | `{ params }: { params: Promise<{id}> }` | `req.params.id`                          |
| Query params             | `new URL(req.url).searchParams`        | `req.query`                              |
| Form data                | `await req.formData()`                 | `multer` middleware (`upload.single("file")`) |
| Cookies                  | `req.cookies.set(...)` / `next/headers`| `res.cookie(...)` (cookie-parser)         |
| Server sessions          | `getServerSession(authOptions)`        | `req.user` (populated by authMiddleware) |
| File system              | `process.cwd()` based paths            | Same — works in Docker too               |

## Folder structure

```
backend/
├── package.json
├── tsconfig.json
├── Dockerfile
├── railway.toml
├── .env.example
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── seed-calendar.ts
└── src/
    ├── index.ts                 # Express entry point
    ├── lib/
    │   ├── db.ts                # Prisma singleton
    │   ├── auth.ts              # JWT auth + middleware
    │   ├── admin-auth.ts        # Admin backoffice (HMAC tokens)
    │   ├── push.ts              # Web Push (VAPID) config
    │   ├── matrix/config.ts     # Matrix Synapse config
    │   ├── arweave/coffre-fort.ts
    │   ├── bible/               # Bible data loader + references
    │   ├── calendrier/          # Biblical calendar computation
    │   ├── whisper/             # Subtitling logic
    │   └── data/authentic-content.ts
    ├── data/bible/              # 46 MB of Bible JSON (versions, Strongs, OSHB, Peshitta)
    └── routes/
        ├── auth.ts
        ├── yeshua-connect.ts
        ├── push.ts
        ├── matrix.ts
        ├── livekit.ts
        ├── transcribe.ts
        ├── user.ts
        ├── calendrier.ts
        ├── calendrier-biblique.ts
        ├── bible.ts
        ├── bible-v2.ts
        ├── contact.ts
        ├── home.ts
        ├── intercession.ts
        ├── disperses.ts
        ├── cron.ts
        ├── admin.ts
        ├── arweave.ts
        ├── soustitres.ts
        └── dead-mans-switch.ts
```

## Verifying the build

```bash
npm run build   # tsc — compiles to dist/
npm run start   # node dist/index.js — runs the server
```

The TypeScript compiler runs in strict mode and produces zero errors.
