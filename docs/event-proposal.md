# Code Escape Room — event proposal

## The idea

We propose a digital escape challenge within Aarambh 4.0 in which teams of 3 students work through five linked rounds. The aim is to combine observation, online research, problem-solving and teamwork in a controlled two-hour competition. The website makes progress visible and handles timing and scoring consistently while organizers supervise the event in person.

Code Escape is scheduled for the second day of Aarambh, 31 October 2026. The final start time, venue and briefing should follow the organizer's published schedule. The game clock begins when the organizer starts the competition, rather than when an individual student opens the website.

## How a team reaches the game

Students begin on Aarambh, not on a separate game registration form. The leader forms the Code Escape team, the invited members accept, and the team completes its registration and payment process. Once the full fee is approved, the roster is locked and any required NOC is verified, Aarambh checks that the registration is eligible for game access.

It then creates a private, randomly generated code for that registration. The approved team name, leader name and email, accepted member names, registration reference and access credential are handed to the game securely. Only the authorized leader retrieves the code from the Aarambh registration page. The leader uses the registered email and code to open the team's competition session.

There is no need for a second Google account login in the game. Participants should keep the private access code confidential and use their event QR pass separately for venue entry/check-in. The QR pass does not unlock the competition.

## What happens during play

Before the event begins, the leader can sign in and read the rules in a waiting lobby. At the shared start, the first room opens for all eligible teams. Each team receives a consistent question path, so its questions do not change on refresh or on the next round. The application supports multiple complete paths with balanced team assignment.

The team solves together using the leader's device and submits an answer for its current round. A correct answer advances the team immediately. The screen shows both the overall competition clock and the current round's time, available reward and any penalty. External browsing is allowed under the published rules; organizers should explain any additional fair-play restrictions during the briefing.

Completing a round within its allowance earns its full reward and carries unused time into the next round. Once that allowance expires, the team chooses whether to continue solving for a decreasing reward or skip with the displayed deduction. A skip becomes available only after the round allowance expires. Overtime or skipping does not carry unused time forward, and deductions can take a score below zero.

The current defaults are shown below so organizers can review the pacing. They can be adjusted before the shared start; the website freezes the chosen settings when the event starts.

| Round | Initial allowance | Full reward |
| --- | ---: | ---: |
| 1 | 10 minutes | 100 points |
| 2 | 15 minutes | 200 points |
| 3 | 20 minutes | 300 points |
| 4 | 25 minutes | 400 points |
| 5 | 30 minutes | 500 points |

By default, overtime reduces the available reward by 5% of that round's base points per minute, down to a minimum reward of 25%. Skipping deducts 20% of that round's base points. The five initial allowances total 100 minutes, within the overall two-hour limit; carried time and overtime remain subject to the same final deadline.

Closing a tab, refreshing or reconnecting does not restart the clock. A fresh successful login replaces the previous team session, leaving one active session. Late arrivals use the original shared start and receive no extra time. At the two-hour deadline, submissions stop even if a team has not finished all rounds. The organizer can also end the event earlier.

## How results and supervision work

The leaderboard ranks teams by score, then by the number of rounds solved, then by the earlier time at which the score was reached. A stable final ordering resolves otherwise identical records. Repeated submissions are guarded so a round cannot award its points twice.

The game organizer dashboard is separate from Aarambh's general administration. It shows team progress, timing, scores and recent activity, and provides searchable activity records and exports. Organizers can set the pre-event scoring, start the competition for everyone, end it, and prepare another run through a deliberate reset. Previous outcomes are archived and activity logs are retained.

Portal administrators continue to handle registrations, payment decisions and participant entry. Having a portal admin account does not itself grant access to the game's organizer dashboard.

## How the two websites stay connected

Aarambh tries to transfer the eligible team without making the leader re-enter the roster. If the game cannot accept the update immediately, Aarambh leaves it pending and retries. The leader sees ready access after the receiving game acknowledges the current approval. The verified payment is preserved while the transfer is pending.

GitHub Actions provides a scheduled nudge to the portal, approximately every five minutes while automation is enabled. It calls the portal's protected workers for queued emails and pending Code Escape approvals or revocations. Those workers read the current registration state and perform the work. GitHub Actions is not a spreadsheet for team details and does not create the private game code. Scheduled runs and delivery retries can be delayed, so this is not a promise of instant email or game access.

Retries reuse the registration's existing code and preserve progress, scores, timers and question paths. Cancellation, refund or another loss of eligibility revokes access. The receiving game ignores older updates so a delayed approval cannot reverse a newer revocation.

## Emails and reminders

Aarambh explains the student's next step through team invitations, payment updates, event reminders and individual pass emails. Messages identify the event and why the recipient is receiving them. They are placed in a delivery queue, sent through the configured organizer Gmail accounts with spacing and retries, and recorded for support.

The private Code Escape credential is currently shown to the leader inside Aarambh rather than distributed in ordinary pass emails. This gives each teammate their own entry pass while keeping one controlled game session for the team.

## Readiness before the event

The core game and the registration bridge are implemented. Final competition readiness still requires organizer approval of the question paths, a private rehearsal, confirmation of the briefing and fair-play policy, and a check of the configured email and integration workers. The source currently contains the original question path plus two temporary replacement paths; their presence is not a claim that final questions have been approved.

For the event-day handover, organizers should verify the eligible roster, have the leader retrieve the ready code, confirm that emails and passes are reaching participants, and rehearse start/end and export actions in a separate environment. Production registrations and game progress should not be reset merely to release a website update.

Read the [combined platform proposal](platform-proposal.md) for the broader Aarambh journey. Question preparation and private rehearsal instructions remain in the [separate maintainer guide](../server/seed/README.md).
