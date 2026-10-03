# Aarambh 4.0 and Code Escape

## 1. Proposal overview

**A connected registration, entry and competition experience**

Prepared for the Aarambh 4.0 organizing team, Co-Dev Club, Graphic Era Hill University. Festival dates: **30-31 October 2026**. Document reviewed on 3 October 2026; individual event timings remain tentative until organizers finalize them.

The proposal brings the festival journey into one coordinated process. Students discover events, create their account, find teammates, submit payment proof and receive their personal entry pass through Aarambh. Organizers review applications and use the same records to admit participants. For Code Escape, approved teams continue into a separate competition website without another manual roster upload.

The Aarambh website is the registration and festival management desk. The Treasure Hunt project powers the active **Code Escape Room** game, where teams solve five rounds while organizers control the start, monitor progress and review results. Keeping the game separate allows each website to be updated independently while sharing the approved team information they need.

**Participant journey:** Discover an event -> Create an account -> Form a team where required -> Submit proof -> Receive approval and a personal pass -> Attend or enter Code Escape.

This is a proposal-style explanation of the implemented workflow, rather than an engineering blueprint. The final section identifies the preparation still needed before the competition.

- Festival and registration: [Aarambh](https://codegehu-eight.vercel.app)
- Competition: [Code Escape](https://aarambh-code-escape.vercel.app)

## 2. The participant journey

**Create a complete student profile.** Signup accepts any valid email address, including personal Gmail and Outlook addresses. A university email is not required, and the email does not need to match the student ID. The college/university dropdown offers **GEHU Dehradun** only. Signup also collects the participant's name, student identity, contact details, course, optional specialization and section. Participants can complete additional profile details such as year. These academic details help organizers prepare accurate certificate recipient lists later. Automatic certificate creation and delivery are not part of the present workflow. Email/password login is available; Google login depends on its separate configuration.

**Choose the event and check its requirements.** The event page explains the fee, date, venue, team size and rules. A solo participant registers directly. For an ordinary team event, the leader creates a team and invited members accept before the team registration locks the roster. Joining a team alone does not complete payment or event registration.

**Submit payment and any required NOC.** The participant pays through the displayed UPI details and supplies the transaction reference and screenshot. An organizer checks the proof against the actual payment before approving it. An uploaded screenshot is not automatic payment confirmation. If the event requires a No Objection Certificate, its approval is also needed before the pass is released.

**Receive a personal event pass.** Once the requirements are approved, each accepted participant receives their own pass in the dashboard and an email containing their entry QR and event details. A team of four receives four personal passes, rather than one shared QR.

**Human Ludo has a flexible team-building route.** The current personal enrollment fee is INR 50 per person. A participant may pay, complete verification and receive an admission pass before completing a four-player team. They can continue forming or merging teams through the website, including at the venue before the configured formation cutoff. Invitations, join requests and merges require the appropriate member consent. A complete, eligible and finalized team of four is still required to play; finding teammates at the venue is not guaranteed. Moving between forming teams preserves the participant's approved personal payment and entry pass.

## 3. Understanding the different codes

Several codes appear in the journey, but each serves a different purpose.

| Item | What it is for | How it is created and used |
| --- | --- | --- |
| Payment QR | Paying the organizer | Built from the configured UPI recipient, amount and payment note. It requests a transfer; it is not proof of payment or an entry ticket. |
| Team join code | Joining a forming team | A random reference generated when the team is created. The website checks membership, available places and the event's team rules. |
| Invitation link | Accepting a specific team invitation | A private, time-limited link tied to the invitation and intended email address. A new participant signs up with that address before responding. |
| Personal entry QR | Admission to one event | Generated after approval for one participant, registration and event. It includes a protected digital signature and expiry. |
| Code Escape access code | Opening the team's competition session | A separate random secret created for an eligible approved team. It is shown privately to its registered leader after the game confirms receipt. |

The server chooses random references rather than deriving them from a student's name, phone number or ID. For a personal pass, it records the attendee and event, then creates the QR from a signed ticket. The signature works like a digital stamp: editing a copied ticket does not create a valid new ticket. The QR itself is not an encrypted container for the participant's full profile; the staff screen retrieves the appropriate details from the saved record.

At the gate, authorized staff select the event and scan the QR. The system checks the ticket's signature, expiry, approval and saved pass, then records the first admission. A repeat scan is flagged instead of admitting the same ticket again. Volunteers also check the participant's student ID. Admission requires the online check; offline admission is not promised.

Retrying pass delivery reuses the existing approved pass. It does not create a fresh QR just because an email or page request had to be retried.

## 4. How the emails work

Emails explain **why the recipient is being contacted, what event or team is involved, and what to do next**. The templates use a branded HTML layout, a readable text alternative and links to the live website.

| Situation | What the recipient receives |
| --- | --- |
| Team invitation | Who invited them, the team and event, the response link and the invitation expiry. People without an account can sign up before accepting. |
| Payment or NOC review | Approval or rejection information and the participant's next step. |
| Pass ready | Their name, event, date and time in IST, venue, registration/pass references and their personal QR. The QR is included in the email and as a PNG attachment. |
| Human Ludo team activity | Relevant invitations, join/merge requests, consent decisions and team finalization updates. |
| Reminders and account actions | Upcoming-event reminders, Human Ludo unfinished requirements, and password-reset instructions when requested. |

When an action occurs, Aarambh saves a notification and a durable email job. A background worker picks up the job, builds the message and sends it. This lets the participant close the browser while the message is waiting. It also lets the system retry a temporary failure without asking the organizer to recreate the action.

The primary sender is **codev.aarambh4.0@gmail.com**; the secondary is **codevclub.aarambh4@gmail.com**. The worker selects an available sender that has been used least recently and applies spacing and daily limits. An authentication or provider-policy block pauses delivery for attention; the system does not switch identities to bypass that block.

Emails may remain queued while a sender is cooling down, the batch is full or a retry is waiting. The current worker sends small batches, so a busy queue can take more than one scheduled run. A successful send means the mail server accepted the message, rather than a guarantee that it appears immediately in the recipient's inbox. Organizers can review queued, sent and failed states in the admin area.

The Code Escape login secret is **not included in these emails**. The registered leader retrieves it from the private registration page.

## 5. How approved teams reach Code Escape

The two websites cooperate without students having to register the same team twice.

1. **Aarambh checks eligibility.** Code Escape needs a confirmed registration, a locked accepted roster of the allowed size, full verified payment and any required NOC approval.
2. **Aarambh creates one private game code.** It generates an unpredictable team access code and stores it in protected form. Repeated delivery attempts reuse that code.
3. **Aarambh sends the approved team directly to the game.** The message contains the registration reference, team name, leader name and email, accepted member names, access code and approval status. Payment screenshots, NOC documents and the rest of the student profile are not copied to the game.
4. **The game confirms receipt.** It creates or updates that team's game record and records the approval. Repeated messages do not reset scores or create duplicate teams.
5. **The leader sees access ready.** After the matching confirmation, the private Aarambh page shows the game link and access code. The leader signs in to Code Escape with their registered email and this code. Teammates solve together through the leader's session.

**Where GitHub Actions fits:** it acts as a scheduled reminder to the servers, normally around every five minutes when automation is enabled on the repository's default branch. It calls protected Aarambh background workers, which process queued emails and retry pending game updates. GitHub Actions does not generate the codes or store the participant roster in its workflow. The server-to-server transfer happens in Aarambh's backend.

The system also attempts transfer immediately after approval and when the leader checks their access page. If the game is temporarily unavailable, the registration stays approved and access remains pending until a retry succeeds. The advertised five-minute schedule is approximate; GitHub can delay a run.

Cancellation, refund-related cancellation or an event becoming unavailable also produces an access update. The game blocks a revoked team, and a delayed older approval cannot restore it. An email delivery problem does not stop the separate game-update retry process.

## 6. The competition experience

The active Treasure Hunt deployment is branded **Aarambh Code Escape Room**. Its participant login uses the registered leader's email and private access code; it does not require a second Google sign-in.

The organizer starts the competition for everyone together. The event has a shared two-hour deadline, including for a team that logs in late. Teams move through five rooms in order. Solving a round opens the next room immediately, and unused full-score time carries forward. Refreshing or changing the active session does not restart the competition clock.

| Round | Default full-score allowance | Base reward |
| --- | --- | --- |
| 1 | 10 minutes | 100 points |
| 2 | 15 minutes | 200 points |
| 3 | 20 minutes | 300 points |
| 4 | 25 minutes | 400 points |
| 5 | 30 minutes | 500 points |

These are the current default settings; organizers can adjust them before starting. When a round's allowance expires, the team chooses **Continue** or **Skip**. Under the default rules, overtime reduces that round's available reward by 5% of its base points per minute, down to a 25% minimum. Skipping deducts 20% of that round's base points and opens the next room. The event deadline always overrides saved time. External browsing is allowed under the reviewed Code Escape rules.

Each team follows one assigned five-round question set, which stays consistent when the page refreshes. The game supports three complete sets. The second and third currently contain temporary practice questions and need final event content and a fairness rehearsal before competition use.

The leaderboard ranks by score, solved rounds and the earlier time at which the final score was reached. The game keeps one active session per team. A new successful leader login replaces the previous session, so organizers should explain the intended shared-device arrangement and handle device problems through an agreed process.

The game organizer dashboard can start or end the event, monitor teams and activity, review rankings and export results. Reset is a deliberate organizer action for a new run, not a step required when updating the website.

## 7. Organizer responsibilities and readiness

| Workspace | Main responsibility |
| --- | --- |
| Aarambh admin | Review payment, NOC and refund requests; manage event and participant records; monitor email status and audit history. |
| Aarambh super admin | Perform admin work and manage privileged staff roles. |
| Assigned event staff | Use the manager and scanner for their authorized events, check student identity and admit valid pass holders. |
| Code Escape organizer | Control the competition start/end, observe activity and review/export results through the game's separate admin login. |

Useful pages are the festival **/admin**, **/manager** and **/scanner**, and the game's **/admin**. These are permission-protected workspaces. Knowing a URL does not give a student staff access. The game administrator login is separate from the Aarambh account roles.

Before opening the final event, organizers should approve the payment recipient and published fees, finalize the tentative schedule and venue details, replace practice question sets, and rehearse the complete student-to-gate and student-to-game journey. Confirm sender credentials and background scheduling, approve staff assignments, and prepare a process for payment disputes, incomplete teams and device problems.

The proposal's expected result is a clear experience for participants and one accountable record for organizers: an approved payment leads to the correct personal pass, and an approved Code Escape team reaches the game with the same roster and a private leader credential. The website handles routine follow-up; organizers retain the decisions that need a human review.

Implementation evidence is based on the current Aarambh and active Code Escape source. This document does not claim a new live email, payment or production participant test was performed while preparing the proposal.
