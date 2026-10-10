# Digital rounds 1–3 release

Implemented 10 October 2026 in `CodevGehu/aarambh-code-escape`.

## Organizer decisions

Round two runs entirely on the website. No physical lab visit, location permission, QR handshake or secondary device is required. The booklet uses the same authenticated organizer session as the dashboard; there is no second password. Credentials are deployment environment settings, never source files.

## Question sets and participant flow

Each assigned set (L1, L2, L3) has five rounds. The new rounds replace the first three, retaining the existing fourth and fifth rounds. Participants retain their server-assigned set throughout the event.

1. **DevTools traces:** inspect a computed CSS property, wake an authenticated response-header signal, and inspect the current IndexedDB clue. Add the values and submit four digits.
2. **Broken-source image:** repair two XML faults and one frame/visibility fault in the provided SVG. Preview the restored image, read its six-digit marker, and validate both the source and marker. The server then permits downloading a generated original JPEG; its EXIF Artist field contains the final passphrase. Each set has a distinct repair pattern.
3. **Black-box inference:** infer a letter transformation from four observations and up to six additional experiments. Letters in the final three-letter input cannot be probed. The server persists experiment history, enforces the budget transactionally, and treats retries with the same idempotency key as one experiment.

Instances and private values persist in MongoDB for the team, event run, question and version. Refreshes retain progress; a new event or question receives a fresh instance. Main score submission remains in the existing progress controller. Shared start/deadline, carryover, overtime decisions, rewards and skip deductions use the existing event rules.

These are solvable technical puzzles, including with AI assistance. Broken SVG syntax prevents ordinary image rendering until repaired; it does not make the puzzle impossible for an AI coding agent. Pilot teams should assess difficulty before the event.

## Admin use

Open `/admin` directly and sign in with the configured organizer credentials. The participant login page has no organizer link.

- `/admin/puzzles`: choose Set 1, 2 or 3; only that set's five rounds appear. Select a round to create an isolated rehearsal. Reset creates a fresh early-round instance. Reference checks validate known solving paths without changing live scores, teams or activity logs.
- `/admin/answer-booklet`: choose a set and optionally a round. The booklet includes all five references by default. The link from a rehearsal shows that exact rehearsal's private values. Other default early-round references are cached instances owned by the current admin session; live team values can differ.
- Sign out revokes the server session. Existing sessions expire after two hours. Booklet responses use `Cache-Control: no-store`, and the UI clears its in-memory content on leaving or logout.

Every booklet and rehearsal API verifies the organizer JWT and current MongoDB session. Team tokens, guessed rehearsal IDs, another organizer session's rehearsal, expired sessions and revoked sessions are rejected. Private answers, corrected source and transformation rules are absent from participant responses and frontend bundles. Original supplied guides and ZIPs remain in the private repository handoff directory and are excluded from deployment. Someone who can read that private repository can read its prototype answers; do not grant participants repository access.

## Deployment and migration

Set `EARLY_ROUND_SECRET` to at least 32 random characters in the server environment, together with the existing MongoDB/JWT configuration and organizer password. Keep it stable during a run. Install dependencies with the lockfiles.

`node server/scripts/installEarlyQuestions.js` previews the nine replacements. `--apply` requires a stopped event, creates a private backup, archives the previous nine questions and inserts their replacements in one MongoDB transaction. It preserves question IDs used by history and does not rewrite teams, scores, mappings, results or logs. The installer is idempotent and refuses to run during an active event.

Deployment does not start or reset the event. Use the dashboard controls separately when organizers are ready.

## Verification

The backend unit suite, real HTTP workflows, client tests and production build cover the release. The early-round HTTP suite uses an ephemeral local MongoDB replica, completes all nine new questions, verifies source/metadata gates and six-probe concurrency, and exercises booklet ownership, logout revocation, leader-session replacement, answer throttling and migration rollback. The organizer security suite separately checks JWT claims, session expiry and protected routes. Existing scoring and rounds 4–5 HTTP suites remain in CI.

For local browser testing, `node server/scripts/early-round-workflow-smoke.js --serve` keeps its synthetic backend at port 5312 after checks. This mode uses disposable local data and synthetic credentials; it must never target Atlas. Production verification uses admin rehearsal endpoints without starting the event.
