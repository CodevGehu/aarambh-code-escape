# Aarambh Code Escape Room

A separate event deployment based on the previous technical hunt, with a React/Vite frontend and Express/MongoDB API hosted together on Vercel. Source should remain in a private GitHub repository because the backend seed contains answers.

Implemented here: three complete question sets, persistent balanced assignment, leader-email/access-code login with one active team session, server-authoritative round timers and scoring, an Aarambh-themed five-room path, and a live admin activity dashboard. L1 preserves the original questions; L2 and L3 contain easy temporary questions in `server/seed/placeholderQuestions.js`.

Everyone starts together with a two-hour hard deadline. Default round caps are 10/15/20/25/30 minutes; unused time transfers to the next round after a correct answer. After a cap, teams choose Continue for a reward decreasing by 5% of base points per minute (25% minimum), or Skip for a 20% penalty. Negative totals are allowed. Organizers can edit these scoring settings before starting. Atomic team updates prevent duplicate awards; reset archives outcomes and retains activity logs.

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

The organizer page is `/admin`, including on a future custom domain. Username is `admin`; its password comes from `ADMIN_PASSWORD`. The dashboard includes team and activity search, filters, CSV/Excel exports, in-page end confirmation, and five-second live refresh. Participant pages show a shared-start message, event-ended message, and custom error screens.

Check `/api/health` for `ready`, `setup_required`, or `database_unavailable`. MongoDB credentials are never sent to the browser. The connection pool is reused across warm requests.

Hosting references: [Vercel Node.js functions](https://vercel.com/docs/functions/runtimes/node-js), [Vercel rewrites](https://vercel.com/docs/routing/rewrites).

## Seed and access codes

Production access codes come from verified Aarambh registrations. On the Aarambh server, set `CODE_ESCAPE_URL` to this app's HTTPS root URL, `CODE_ESCAPE_INTEGRATION_SECRET` to the same secret as this app's `AARAMBH_INTEGRATION_SECRET`, and `CODE_ESCAPE_ENCRYPTION_KEY` to a persistent dedicated 64-character hex key. Enable `AARAMBH_REGISTRATION_REQUIRED=true` here to exclude the inherited rehearsal roster from competition access and ranking.

Aarambh generates one encrypted code after approved full payment, locked team registration, and any required NOC. Its backend sends an authenticated registration update to `POST /api/integrations/aarambh/teams`; retries preserve scores, sessions, and the code. Cancellation/refund updates revoke access, and older approval messages cannot undo a revocation. Only the registered leader sees the code on the Aarambh registration page. Ordinary registration responses and public logs contain no codes. See the portal's `docs/code-escape-integration.md` for retry-worker details.

```powershell
npm run seed:preview --prefix server
npm run seed --prefix server
```

Seed only the new empty development/event database. The seed is a full reset and requests typed confirmation if data already exists. It generates private organizer access-code exports under `.private/`, which Git and Vercel both exclude. Teams sign in with their registered leader email and assigned access code. Admin signs in at `/admin` with username `admin` and the configured admin password.

For an isolated rehearsal without the portal integration, issue missing codes without resetting progress:

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

## Future domain and updates

Keep the two projects separate: the Aarambh portal on the root domain and this app on a subdomain such as `escape.example.com`. Add that subdomain to this Vercel project and use Vercel's DNS instructions. Then update Aarambh's `CODE_ESCAPE_URL` and redeploy the portal. The admin page becomes `https://escape.example.com/admin`.

Each project can be updated independently from its own source and deployed to the same production alias. A path such as `example.com/escape` also requires proxy rewrites, a Vite asset base, and a router basename; it is a different hosting configuration from a subdomain. Domain changes do not reset the database, codes, timers, or results.
