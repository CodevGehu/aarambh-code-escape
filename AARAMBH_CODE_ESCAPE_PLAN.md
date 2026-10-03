# Aarambh Code Escape Room — proposal and event readiness

## What we are presenting

Code Escape Room is a five-round team challenge connected to the Aarambh event portal. It gives students a clear path from registration and payment approval to a timed competition, while giving organizers one place to start the game, supervise progress and review the results.

Teams have 3 accepted members and play together through their registered leader's device. The leader signs in with the registered email and a private game code. Aarambh creates that code after the team registration is eligible and securely transfers the approved roster; students do not register a second roster in the game or need a separate Google sign-in.

The private game code is shown to the authorized leader in Aarambh. It is separate from each participant's entry QR pass and from a team invitation link. Ordinary pass emails do not contain the team's competition credential.

## Proposed event-day flow

1. Before the event, organizers approve the final question paths and conduct a private rehearsal.
2. Students complete team formation, event registration, full payment verification and any required NOC in Aarambh.
3. The leader checks that the registration page shows ready game access, then signs into Code Escape and waits for the briefing and shared start.
4. The organizer starts the two-hour competition for all eligible teams. Teams solve the five rounds in order and advance immediately after a correct answer or an available skip.
5. At the deadline, submissions close and organizers review the ranked results and export the event records.

Code Escape is scheduled for 31 October 2026, the second day of Aarambh. The final start time and venue should match the organizer's published schedule. The two-hour clock starts through the game organizer's action, not an individual student's login.

## Rules implemented in the website

Everyone shares the same start and final deadline. Each round has its own full-score allowance, and unused time from an early correct answer carries into the next round. After that allowance expires, the team chooses Continue for a decreasing reward or Skip for a displayed deduction. Skipping is available only after the allowance expires. Negative scores are possible, and overtime or skipping does not carry unused time forward.

The default allowances are 10/15/20/25/30 minutes and full rewards are 100/200/300/400/500 points. The default overtime reduction is 5% of base points per minute with a 25% reward floor; a skip deducts 20% of base points. Organizers can adjust the scoring before the shared start. The two-hour duration remains fixed, and the selected settings freeze when the event begins.

External browsing is allowed. The team uses one active game session; a fresh successful login replaces the earlier session. Refresh, reconnect and late arrival do not restart the clock. Results rank by score, then more solved rounds, then the earlier time the score was reached.

## What organizers can supervise

The separate game organizer dashboard shows teams, rounds, scores, clocks and activity. It provides pre-event settings, shared start/end controls and exports. A deliberate reset archives previous outcomes and retains activity records before preparing another run. No pause/resume or arbitrary score-adjustment feature is being represented as available here.

Aarambh's portal administrators handle registration, payment review and entry scanning. Those permissions do not automatically grant the game organizer login. Cancelling or refunding a registration, or another loss of eligibility, triggers game-access revocation.

## Automatic updates and messages

Aarambh sends invitations, payment updates, reminders and individual pass emails from its delivery queue. GitHub Actions asks the portal's protected workers to process pending emails and retry game handoffs approximately every five minutes while automation is enabled. The workers read the current registration state and contact the game securely; the workflow does not generate private codes or store participant rosters in repository files.

If the transfer is temporarily unavailable, the approved payment remains intact and game access waits for retry. Repeated updates preserve the existing credential, score, timers and question path. Older approvals cannot overwrite a newer revocation.

## What still needs event approval

Multiple complete question paths are supported, and teams receive balanced, persistent assignments. The source currently includes the original question path and two temporary replacement paths. Organizers must approve the final questions and perform a blind rehearsal before presenting the event as ready to run.

Confirm the fair-play policy, final briefing and venue, the question difficulty and pacing, and the configured email/integration workers. Rehearse leader access, shared start/end and exports in a separate environment. A website update does not require resetting the production registration or game data.

The [event proposal](docs/event-proposal.md) presents the full competition experience. The [combined platform proposal](docs/platform-proposal.md) explains the entire student journey. Private question preparation and operational setup remain in [server/seed/README.md](server/seed/README.md); answers and code exports do not belong in proposal material.
