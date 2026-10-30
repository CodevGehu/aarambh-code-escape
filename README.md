# Aarambh Code Escape Room

Code Escape Room is the competition website connected to the Aarambh 4.0 event portal. Aarambh handles accounts, team formation, registration, payment review and entry passes. This website takes over when an approved Code Escape team is ready to play.

The experience is a five-round digital escape challenge. All three registered members can sign in with Google, research together and submit to the same team progress and score. Everyone shares the same organizer-controlled start and two-hour finish, so refreshing the website or signing in late does not restart the clock.

## The participant journey

1. Students create their Aarambh accounts using any valid email, including personal Gmail or Outlook. A university email is not required. The college dropdown offers GEHU Dehradun only. They form a Code Escape team of 3 accepted members and complete registration.
2. The organizer verifies the full payment and any required NOC. The registered team is locked before competition access is issued.
3. The organizer imports the verified attendee CSV, registering all three member emails and assigning complete question sets randomly, balanced as evenly as possible. Seven teams occupy the three sets as 3/2/2; an existing team's set stays fixed on reimport.
4. Each member signs in with their registered Google account. Teammates keep independent sessions while sharing one team timer, round and score. The team waits in the lobby until the organizer starts the competition.
5. The team solves five rounds in order, follows its remaining time and score, and sees the outcome on the leaderboard.

Each participant's event QR pass is for entry/check-in. Invitation links accept or decline a team invitation; they do not sign a participant into the competition. The legacy leader email/access-code API remains compatible with older handoffs, but the participant login page uses Google.

## Google sign in and attendee import

Set `GOOGLE_CLIENT_ID` on the server to a Google OAuth Web client ID. Add `https://aarambh-code-escape.vercel.app` to its Authorized JavaScript origins. No client secret is needed. `/api/auth/config` supplies this public ID at runtime; the backend verifies Google's signature, audience, issuer, expiry and verified email before matching the registered roster and binding its Google subject. Missing configuration fails closed.

Before the event, preview and then apply the paid attendee CSV:

```powershell
node server/scripts/importAttendees.js path/to/attendees.csv
node server/scripts/importAttendees.js path/to/attendees.csv --apply
```

Each registration must have three distinct emails, one leader and confirmed, verified payment. The transactional import preserves existing assignments, Google bindings and unchanged members' sessions; changing leaders revokes the former leader session. Imports stop once the event starts. Private recovery backups are saved under ignored `.private/roster-backups`; never commit the CSV or these backups. The three unused `organizer-test-L1/L2/L3` rehearsal accounts are disabled when applying the real roster, without deleting their history.

Use the Google-account email from the roster. A non-Gmail address must actually belong to that Google account; confirm such entries with the organizer before the event. Updating an imported CSV roster is an organizer operation, separate from legacy payment-handoff retries.

## Legacy code and email integration

The game code is created by Aarambh after the registration meets its approval conditions. It is a randomly generated credential, not a number derived from the team's name or phone. Aarambh protects the stored code so it can show it to the authorized leader; the game keeps a protected verification record rather than displaying the code in its organizer tables or public rankings. A delivery retry reuses the existing code.

Invitation, payment and pass emails are sent by Aarambh's email service. The private game code is currently retrieved by the leader from Aarambh; it is not included in ordinary participant pass emails. This keeps the venue QR pass and competition login separate.

GitHub Actions acts as a scheduled reminder to the portal's background workers. Approximately every five minutes, when automation is enabled, it asks Aarambh to process pending emails and retry game handoffs. The portal then sends the approved team to this game through a protected connection. The workflow itself does not generate access codes or place participant lists in GitHub files. Scheduled runs and delivery retries may be delayed, so email and game access are not promised instantly.

If the game is temporarily unavailable, the payment stays verified and the transfer waits for retry. Repeated transfers preserve the team's scores, timers and question assignment. A cancellation, refund or loss of eligibility sends a revocation; older approval messages cannot restore revoked access.

## Competition rules at a glance

| Part of the experience | Current behavior |
| --- | --- |
| Team access | All three registered Google accounts may sign in simultaneously. Signing in again or out affects only that member's session. |
| Competition length | Five rounds within two hours of the shared start. |
| Research | Internet, search engines, online tools and AI assistants are allowed. Work only with your own team; no peeping, copying or sharing across teams. |
| Progression | Solve a round to advance immediately. After its allowance expires, choose Continue or Skip. |
| Early completion | Unused full-score time carries into the next round. |
| Overtime | Available points gradually decrease while continuing beyond the round allowance. |
| Skipping | Applies the displayed deduction and advances to the next round; negative scores are possible. |
| Ranking | Highest score, then more solved rounds, then the earlier time at which that score was reached. |

The current default round allowances are 10, 15, 20, 25 and 30 minutes, with rewards of 100, 200, 300, 400 and 500 points. The default overtime reduction is 5% of the base reward per minute, with a 25% reward floor; skipping costs 20% of the base reward. Organizers can adjust these settings before the event starts. The two-hour event duration remains fixed, and settings are frozen once started.

## Organizer experience

The game has its own organizer sign-in at `/admin`, separate from Aarambh's admin, payment reviewer and scanner roles. Its dashboard lets organizers review teams, current rounds, scores and activity; configure the scoring before starting; start or end the competition; and export results and activity records. A reset prepares another run and archives previous outcomes while retaining activity logs. Resetting is an organizer operation, not a step needed to update the website.

Multiple complete question paths are supported, with a balanced assignment that stays consistent for each team. The source includes the original path and two temporary replacement paths; the event team must approve the final question content in a private rehearsal before using it for the competition. Answers and private code exports must remain outside public documentation.

For the venue display, open `/leaderboard?display=1` and select Full screen. It contains standings and queued on-screen round/finish shout-outs, with no venue information. It refreshes every five seconds, retains the last standings while reconnecting, and does not replay announcements on initial load.

The one-page [participant rulebook](docs/Code_Escape_Room_Rulebook.pdf) contains the event flow, venue/time, permitted tools and conduct rules. Its [editable text](docs/Code_Escape_Room_Rulebook.md) is kept alongside it.

## Read the presentation

- [PDF proposal](output/pdf/aarambh-code-escape-proposal.pdf) is the seven-page presentation of both connected websites.

- [Code Escape event proposal](docs/event-proposal.md) explains the game to a faculty member or organizer.
- [Combined platform proposal](docs/platform-proposal.md) explains the full journey across Aarambh and Code Escape.
- [Private question and rehearsal setup](server/seed/README.md) is the separate operational reference for maintainers.

## Links and maintainer handover

The game is at [aarambh-code-escape.vercel.app](https://aarambh-code-escape.vercel.app); [organizer access](https://aarambh-code-escape.vercel.app/admin) is restricted. The event portal is at [codegehu-eight.vercel.app](https://codegehu-eight.vercel.app). These are separate deployments and can later use a main domain and an event subdomain without resetting registrations or progress.

The active source is the private `CodevGehu/aarambh-code-escape` repository on `main`, the single branch used for production releases. Earlier working branches are retained for history. In the local Treasure Hunt folder, use `.deployment/aarambh-code-escape` for this app; the parent folder contains the earlier hunt.

For maintainers, install dependencies in `server` and `client`, create the private server configuration from `server/.env.example`, and use `npm run server` and `npm run client` locally. `npm test` and `npm run build` verify the project. Hosting uses the repository root on Vercel. Keep credentials private, keep rehearsal data separate, and use the seed guide only when intentionally preparing an isolated database; deploying a website update does not require seeding production.
