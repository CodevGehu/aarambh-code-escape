# Aarambh Code Escape Room

A separate event deployment based on the previous technical hunt, with a React/Vite frontend and Express/MongoDB API hosted together on Vercel. Source should remain in a private GitHub repository because the backend seed contains answers.

Implemented here: three complete question sets, persistent balanced assignment, leader-email/access-code login with one active team session, and a serverless-compatible database connection. L1 preserves the original questions; L2 and L3 contain easy temporary questions in `server/seed/placeholderQuestions.js`.

The proposed carry-forward round timers, overtime scoring, skips, full admin activity log, and Aarambh visual redesign remain on the implementation plan. This initial deployment establishes independent hosting and authentication.

## Local setup

```powershell
npm ci --prefix server
npm ci --prefix client
```

Copy `server/.env.example` to `server/.env` and supply a connection string for the separate event database, two different random signing secrets, and the private admin password.

```powershell
npm run server
npm run client
```

The Vite development proxy forwards `/api` to the local backend. On Vercel, both frontend and API use the same origin; no Supabase or Google OAuth configuration is required.

## Vercel

Use the repository root. `vercel.json` installs the server and client dependencies, builds the frontend, and routes `/api/*` to the exported Express function. Set `MONGODB_URI`, `JWT_TEAM_SECRET`, `JWT_ADMIN_SECRET`, and `ADMIN_PASSWORD` as private environment variables. Keep preview databases separate from real competition data. Node.js version: 22.x.

Check `/api/health` for `ready`, `setup_required`, or `database_unavailable`. MongoDB credentials are never sent to the browser. The connection pool is reused across warm requests.

Hosting references: [Vercel Node.js functions](https://vercel.com/docs/functions/runtimes/node-js), [Vercel rewrites](https://vercel.com/docs/routing/rewrites).

## Seed and access codes

```powershell
npm run seed:preview --prefix server
npm run seed --prefix server
```

Seed only the new empty development/event database. The seed is a full reset and requests typed confirmation if data already exists. It generates private organizer access-code exports under `.private/`, which Git and Vercel both exclude. Teams sign in with their registered leader email and assigned access code. Admin signs in at `/admin` with username `admin` and the configured admin password.

To issue missing codes without resetting progress:

```powershell
npm run codes:issue --prefix server
```

To replace one team's code/session after a device problem, use the explicit one-leader rotation flags documented in `server/seed/README.md`. Do not publish or distribute the entire organizer export to participants.

## Verification

```powershell
npm test
npm run build
npm run db:check --prefix server
```

Tests run offline. The final database diagnostic uses the private local configuration and checks connectivity without displaying credentials.
