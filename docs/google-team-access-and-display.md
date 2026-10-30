# Google team access and live display

The paid attendee CSV registers every member of each three-person team. Verified Google sign-in resolves the member to that existing team; it never creates an account from an unregistered email. Each member has an independent session, while questions, experiment budgets, round timing and points remain shared. Repeated or concurrent correct submissions award the round only once.

## Deployment setup

Create a Google OAuth Web client and add `https://aarambh-code-escape.vercel.app` to Authorized JavaScript origins. Configure its public ID as server environment variable `GOOGLE_CLIENT_ID`, then deploy. A client secret is not used. Follow the [Google setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

The server uses the official Google verification library and checks signature, audience, issuer, expiry and verified email before matching the roster. First login binds the Google subject to the registered member. Missing client configuration fails closed; no email-only or development identity bypass is available in production. If the Google application is restricted to test users, authorize the attendee accounts or complete the appropriate publication setup before the event.

## Attendee import

Run `node server/scripts/importAttendees.js path/to/attendees.csv` to preview. Add `--apply` only to import into the configured database. Every row must be a confirmed Code Escape Room registration with verified payment. Three unique emails and one leader are required per team. Question sets are randomized and balanced to differ by at most one team, then retained on reimport.

The supplied CSV contains seven teams and 21 members, allocated as L1: 2, L2: 2, L3: 3. The import preserved existing historical teams, question records, scores and event logs. Only the three unused organizer rehearsal accounts were disabled. No event timer was started.

CSV files and recovery backups remain outside Git and Vercel uploads. Changing a leader revokes the removed leader's session and Google binding; unchanged teammates retain their sessions. Imports are refused while an event is active. A non-Gmail email must be confirmed as the member's actual Google-account address; the original CSV entry is retained until an organizer supplies a correction.

## Venue display

Open `/leaderboard?display=1` and select Full screen. This view contains team standings with no venue details. It polls every five seconds, keeps the last standings during reconnection, and queues silent on-screen shout-outs for round advances and finishing. Initial loads and repeated snapshots do not replay announcements. Skip advances are never described as solved rounds.

The one-page [rulebook](Code_Escape_Room_Rulebook.pdf) contains the venue, 8 am to 10 am timing, early arrival request, event mechanics, permitted internet and AI tools, and the conduct and disqualification rules. Its editable source is [alongside the PDF](Code_Escape_Room_Rulebook.md).

## Verification

- Google member authentication and shared progress: 71 real HTTP checks using synthetic Google identities and disposable MongoDB, including three simultaneous members, self-only logout, subject mismatch rejection and a single reward for concurrent correct answers.
- CSV import: 33 disposable MongoDB transaction checks covering 7 teams / 21 members, preview without writes, stable balanced assignments, complete private backups, preserved sessions, leader changes, collision rejection and active-event rejection.
- Existing backend unit suite and 88 strict HTTP workflow checks passed; the optional registration replica integration was separately exercised with 11 passing checks.
- All 14 client tests and the production build passed.
- Browser checks passed on the production frontend build with synthetic data: seven teams at 1920 x 1080, fullscreen, round and finish shout-outs, offline retention/reconnection, and 390 x 844 mobile layout without page overflow. The mobile table scrolls within its container.

Actual Google consent and real-account sign-in require the client ID and its authorized production origin. Local synthetic verification tests do not replace that final provider check.
