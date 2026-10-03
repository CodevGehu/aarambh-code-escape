# Aarambh Code Escape Room

Code Escape Room is the competition website connected to the Aarambh 4.0 event portal. Aarambh handles accounts, team formation, registration, payment review and entry passes. This website takes over when an approved Code Escape team is ready to play.

The experience is a five-round digital escape challenge. Teams research clues together, submit answers through their leader's device and move through five rooms. Everyone shares the same organizer-controlled start and two-hour finish, so refreshing the website or signing in late does not restart the clock.

## The participant journey

1. Students create their Aarambh accounts using any valid email, including personal Gmail or Outlook. A university email is not required. The college dropdown offers GEHU Dehradun only. They form a Code Escape team of 3 accepted members and complete registration.
2. The organizer verifies the full payment and any required NOC. The registered team is locked before competition access is issued.
3. Aarambh creates one private access code for that registration and sends the approved team details securely to this website. The leader sees the game link, registered email and code in the Aarambh registration page when the handoff is ready.
4. The leader signs in here with that email and code. No Google sign-in is required for the game. The team waits in the lobby until the organizer starts the competition.
5. The team solves five rounds in order, follows its remaining time and score, and sees the outcome on the leaderboard.

Each participant's event QR pass is for entry/check-in. The team's private Code Escape code is a different credential used to open the game. Invitation links are different again: they let a student accept or decline a team invitation, rather than enter the competition.

## How the code and email flow work

The game code is created by Aarambh after the registration meets its approval conditions. It is a randomly generated credential, not a number derived from the team's name or phone. Aarambh protects the stored code so it can show it to the authorized leader; the game keeps a protected verification record rather than displaying the code in its organizer tables or public rankings. A delivery retry reuses the existing code.

Invitation, payment and pass emails are sent by Aarambh's email service. The private game code is currently retrieved by the leader from Aarambh; it is not included in ordinary participant pass emails. This keeps the venue QR pass and competition login separate.

GitHub Actions acts as a scheduled reminder to the portal's background workers. Approximately every five minutes, when automation is enabled, it asks Aarambh to process pending emails and retry game handoffs. The portal then sends the approved team to this game through a protected connection. The workflow itself does not generate access codes or place participant lists in GitHub files. Scheduled runs and delivery retries may be delayed, so email and game access are not promised instantly.

If the game is temporarily unavailable, the payment stays verified and the transfer waits for retry. Repeated transfers preserve the team's scores, timers and question assignment. A cancellation, refund or loss of eligibility sends a revocation; older approval messages cannot restore revoked access.

## Competition rules at a glance

| Part of the experience | Current behavior |
| --- | --- |
| Team access | Registered leader signs in; one active team session. A new successful login replaces the previous session. |
| Competition length | Five rounds within two hours of the shared start. |
| Research | External browsing is allowed; the event briefing should confirm the final fair-play policy. |
| Progression | Solve a round to advance immediately. After its allowance expires, choose Continue or Skip. |
| Early completion | Unused full-score time carries into the next round. |
| Overtime | Available points gradually decrease while continuing beyond the round allowance. |
| Skipping | Applies the displayed deduction and advances to the next round; negative scores are possible. |
| Ranking | Highest score, then more solved rounds, then the earlier time at which that score was reached. |

The current default round allowances are 10, 15, 20, 25 and 30 minutes, with rewards of 100, 200, 300, 400 and 500 points. The default overtime reduction is 5% of the base reward per minute, with a 25% reward floor; skipping costs 20% of the base reward. Organizers can adjust these settings before the event starts. The two-hour event duration remains fixed, and settings are frozen once started.

## Organizer experience

The game has its own organizer sign-in at `/admin`, separate from Aarambh's admin, payment reviewer and scanner roles. Its dashboard lets organizers review teams, current rounds, scores and activity; configure the scoring before starting; start or end the competition; and export results and activity records. A reset prepares another run and archives previous outcomes while retaining activity logs. Resetting is an organizer operation, not a step needed to update the website.

Multiple complete question paths are supported, with a balanced assignment that stays consistent for each team. The source includes the original path and two temporary replacement paths; the event team must approve the final question content in a private rehearsal before using it for the competition. Answers and private code exports must remain outside public documentation.

## Read the presentation

- [PDF proposal](output/pdf/aarambh-code-escape-proposal.pdf) is the seven-page presentation of both connected websites.

- [Code Escape event proposal](docs/event-proposal.md) explains the game to a faculty member or organizer.
- [Combined platform proposal](docs/platform-proposal.md) explains the full journey across Aarambh and Code Escape.
- [Private question and rehearsal setup](server/seed/README.md) is the separate operational reference for maintainers.

## Links and maintainer handover

The game is at [aarambh-code-escape.vercel.app](https://aarambh-code-escape.vercel.app); [organizer access](https://aarambh-code-escape.vercel.app/admin) is restricted. The event portal is at [codegehu-eight.vercel.app](https://codegehu-eight.vercel.app). These are separate deployments and can later use a main domain and an event subdomain without resetting registrations or progress.

The active source is the private `CodevGehu/aarambh-code-escape` repository on `main`, the single branch used for production releases. Earlier working branches are retained for history. In the local Treasure Hunt folder, use `.deployment/aarambh-code-escape` for this app; the parent folder contains the earlier hunt.

For maintainers, install dependencies in `server` and `client`, create the private server configuration from `server/.env.example`, and use `npm run server` and `npm run client` locally. `npm test` and `npm run build` verify the project. Hosting uses the repository root on Vercel. Keep credentials private, keep rehearsal data separate, and use the seed guide only when intentionally preparing an isolated database; deploying a website update does not require seeding production.
