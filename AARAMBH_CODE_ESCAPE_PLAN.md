# Aarambh 4.0 Code Escape Room — proposed implementation plan

Status: implementation has begun with question-set scaffolding. Confirmed: everyone starts the event together; teams advance immediately when they finish a round; unused full-score time carries to the next round; overtime decreases the available round reward; external browsing is allowed and the seed questions are retained; the event will have two or three question sets. The user intends twisted, discovery-based questions that resist straightforward AI answers. The user favors the previous leader-only, single-device setup but is still considering member access. Numeric settings remain proposals. Database contents have not been changed.

## Implemented question-set scaffolding

- Original L1 questions retained; two easy temporary paths, L2 and L3, added in `server/seed/placeholderQuestions.js`, for 15 questions total.
- Persistent team set assignment, balanced distribution, complete-set validation before quiz start, and a shared versioned allocation plan across backend workers.
- Round retrieval stays inside the assigned set; submissions reject set mismatches. Mapping creation tolerates concurrent requests.
- Seed preview without database access, offline tests, replacement instructions, and schema validation before a seed reset.
- These changes do not yet implement the proposed new timing/scoring, replacement login, admin activity log, or visual redesign. The actual database seed has not been run.

## Initial repository findings

- React/Vite client, Express API, MongoDB/Mongoose persistence.
- Five sequential levels with server-side answer validation and an animated marker moving between map checkpoints.
- Persistent question assignment per team/level and atomic protection against awarding the same correct answer twice.
- Global admin start/end/reset controls, a leaderboard refreshed every five seconds, and Excel export.
- Participant login uses Supabase Google OAuth throughout the client and API. Disabling that provider requires a replacement authentication flow.
- Team state stores total and per-level points, but no round start/deadline, overtime choice, skip outcome, or persistent action history.
- The event currently ends only through the admin action; no automatic two-hour cutoff is enforced.
- The seed contains five questions, one per round, with rewards of 100/200/300/400/500. Its comment claiming three questions per level is stale.
- Questions already have `set_id`, but the current controller selects randomly from all questions at a level and does not filter by a team's assigned set. All existing seed questions belong to `L1`. Adding more sets without changing this would mix paths between rounds.
- The deployment configuration runs two backend workers. Timers, activity history, and update delivery must behave consistently across both workers and after restarts.

## Recommended competition rules

One shared event start and a hard deadline 120 minutes later, including for teams that log in late. Teams advance immediately after solving or skipping, preserving the original progression mechanic. Each round receives its base full-score allowance plus unused time carried from the previous round. Teams do not wait for a common next-round start.

| Round | Seed task | Full-score allowance | Full reward | Proposed skip deduction |
| --- | --- | ---: | ---: | ---: |
| 1 | Find an institution's achievement post | 10 min | 100 | 20 |
| 2 | Interpret the creator identifiers | 15 min | 200 | 40 |
| 3 | Trace the creator's identity across platforms | 20 min | 300 | 60 |
| 4 | Inspect highlighted projects for a clue | 25 min | 400 | 80 |
| 5 | Follow an announcement to source and community | 30 min | 500 | 100 |

Full-score allowances total 100 minutes, leaving 20 minutes for overtime across the event. They are starting estimates based on the steps described in the seed, not measured solving times. A rehearsal with people unfamiliar with the answers must confirm both the increasing difficulty and these allowances. Round 1's open-ended search could be harder than Round 2; adjust the clues, order, or caps based on that rehearsal.

### Carry-forward time

- Round 1 starts at the shared event start with its base allowance.
- On solving the current round, `carry = max(0, fullScoreDeadline - serverSubmissionTime)` in milliseconds.
- Next round starts at that same server submission time with `baseAllowance + carry`; banked time is transferred once, not duplicated or added separately again.
- Example: Round 1 solved at event minute 6 leaves 4 minutes. Round 2 gets 15 + 4 = 19 minutes, with its full-score deadline at event minute 25.
- If Round 2 is solved at event minute 18, it leaves 7 minutes. Round 3 gets 20 + 7 = 27 minutes, with its full-score deadline at event minute 45.
- Solving in overtime carries zero unused time; the next round still receives its base allowance. Do not subtract overtime from its base allowance under the proposed policy.
- Skip becomes available after the current allowance, including any carry, expires; therefore skipping transfers zero unused time.
- The shared event deadline always overrides a longer remaining round allowance. Saved time never extends the 120-minute event.
- Celebration and map animation happen after the next round's clock has started; navigating away does not defer activation.
- Show the current round allowance as base time + saved time, its remaining time, and global remaining time, so the transfer is understandable.

This time bank makes early solving useful without changing the full reward. The 20 minutes outside the 100-minute base total is an event-wide overtime buffer, not an extra grant added to every team's bank.

### Round lifecycle

1. Locked: future round; no question access.
2. Active: current round, full reward until its deadline.
3. Time cap reached: display Continue and Skip choices. Overtime is measured from the deadline even while the team is deciding.
4. Continue: keep solving the same assigned question for a decreasing reward. Skip remains available.
5. Solved: credit the reward calculated by the server, record the outcome and remaining-time transfer, and activate the next round atomically.
6. Skipped: subtract the advertised penalty, record the outcome, and activate the next round atomically with no saved time. Cannot return to earn points from this round.
7. At the event deadline: reject further answers and skips, freeze final results, and mark unresolved rounds unfinished. Do not apply skip penalties to rounds a team never skipped.

Skip is proposed to become available only after the round cap, matching the requested timeout choice. Teams may submit during the initial allowance without choosing Continue. After timeout, require the explicit Continue choice before accepting an answer.

### Proposed scoring

- Full reward for correct submissions received by the backend by the round deadline, provided the event itself has not ended.
- In overtime, reduce the available reward by 5% of that round's base points per minute, proportionally to elapsed time, rounded down to whole points. Minimum reward: 25% of the base points.
- Formula: `reward = max(ceil(base * 0.25), floor(base * (1 - 0.05 * overtimeMinutes)))`, with overtime calculated from persisted server timestamps.
- Example: Round 2 solved at 18 minutes earns 170 points (200 base, 3 minutes overtime).
- Skipping deducts 20% of the round's base points from the current total. Negative totals are allowed; skipping Round 1 from zero gives -20.
- Confirmed: overtime reduces this round's potential reward, without continuously subtracting from the existing total.
- No proposed point deduction for incorrect answers; retain team-based attempt limits and log each accepted attempt.
- Maximum possible score remains 1,500. Skipping all five rounds gives -300.
- Show current available reward, the exact skip deduction, projected total after skipping, round countdown/overtime, and global time remaining before a choice.

Proposed ranking: total points descending, correctly solved rounds descending, then earliest server timestamp at which that final score was reached. Teams still tied share a rank. Use the same ranking calculation for the participant leaderboard, admin view, and exports. Heartbeats, login, and unrelated document updates must not change tie-breaking time. A team that traverses all checkpoints by skipping has finished its run but has not solved all rounds.

## Question dependencies and event preparation

- Support two or three complete five-round sets (10 or 15 questions total). Preserve the current five-question path as the first set; do not treat new wording with the same answer as sufficient separation. Three paths are now scaffolded; the last two contain temporary easy questions pending final content.
- Recommended assignment: shuffle the event roster once, distribute complete sets evenly, persist each team's set and five question assignments before event start, and retain them through refresh/reconnect. A team stays on the same set for the whole event so clue dependencies remain coherent. Validate exactly one question per round in each enabled set and block event start if a set is incomplete. Reconcile an organizer-approved late addition against the existing distribution without changing other teams' sets.
- Use identical base rewards and proposed time allowances for corresponding rounds across sets. A blind rehearsal must establish comparable research effort and difficulty; identical point values do not establish fairness by themselves.
- Admin team details and activity/export records should include the assigned set. Participant APIs expose only the team's own assigned questions. All question selection and answer validation must enforce the persisted set.
- Questions should require finding and verifying specific evidence, as in the existing seed. Test the new sets with participants and a browsing-capable AI tool before assuming twisted wording prevents solutions. The user's confidence in question design is not an explicit AI-use rule; agree the participant rule separately without requiring an AI prohibition as the design's foundation.
- Later seed questions explicitly depend on discovering the creator. A skipped round must supply the minimal context needed to attempt the next one, without revealing that next answer. Alternatively, rewrite rounds to be independent.
- The seed refers to creator credits and identifiers in a site's footer. This client currently has no corresponding creator footer. Establish which site the clues refer to and preserve its clue-bearing content through the redesign.
- Identify and check all referenced posts, profiles, highlighted repositories, invitations, and community messages before the event. Decide whether external platform accounts are required and arrange an organizer-controlled fallback for unavailable clues.
- Keep the question and accepted-answer data private. Audit public asset/build output for accidental inclusion of answers.
- External browsing is allowed; retain the existing seed questions. Confirm AI assistance, hints, collaboration between teams, and permitted devices before writing participant rules.
- The local Aarambh event listing at `D:/Arambh-4.0/frontend/src/data/events.js` still forbids internet access during Code Escape Room. Its published rules need to be updated to match the confirmed browsing policy. The reference repository has existing uncommitted changes; treat it as a read-only design reference for this task. No edits to that repository have been made.
- Recommended device policy: only the designated team leader can open the competition session; the entire team solves together on one laptop, including external browsing. No separate member logins. One active team session, with organizer-assisted device replacement. Session/device changes do not restart timers. The server can limit active game sessions; volunteers enforce the one-device research rule.
- Measure round difficulty with a full team using one device. Multiple devices would allow parallel research, change solve times, and require recalibrating the caps.
- Import this year's roster into a new event rather than reusing last year's participants automatically.

## Participant experience and visual direction

- Design reference found locally at `D:/Arambh-4.0`, Git remote `https://github.com/CodevGehu/Arambh-4.0.git`. Inspected source styles, event artwork, and a saved screenshot. Replace One Piece names, font, ship/island artwork, copy, and tutorial screenshots with this branding.
- Verified source tokens in `frontend/src/styles/index.css`: paper `#f2efe8`, ink `#111111`, purple `#5b19d1`, pink `#ff4ac0`, lime `#b8ff38`. Body type is Outfit. Use bold black outlines, offset shadows, and paper surfaces. Give the escape-room progression the terminal/unlock motif already used by its event artwork, with lime as its event accent.
- Retain the existing checkpoint progression and curved movement animation. Replace the ship with a team marker moving through five rooms or system checkpoints.
- Distinguish solved, skipped, current, and locked checkpoints; don't mark every passed round as solved.
- Show event time remaining and current round time prominently on both the dashboard and question view.
- At timeout, show the scoring consequence of Continue and Skip. Refresh or reconnect restores the same state.
- Provide a waiting lobby, clear competition rules, reconnect status, and a final summary with points earned/deducted per round.
- Recommended authentication: registered leader email plus a private organizer-issued team access code, hashed on the backend, with separate participant and admin sessions. This preserves the leader whitelist while replacing disabled Google OAuth. Possession of a code is a credential, not proof of who is physically using the device; organizers designate the leader at check-in. No email-provider redirect needed.

## Admin dashboard and persistent logs

- Live team table: current round, solved/skipped counts, score, round time/overtime, available reward, last activity, and connection status.
- Activity feed: login/session changes, round activation, submitted answer outcome, timeout, Continue, Skip, reward/penalty, finish, event controls, and admin adjustments.
- Every scoring/action entry includes event ID, team ID, round, server timestamp, actor, request/action ID, point delta, and before/after score. Participant answers, if retained, are admin-only; never log access codes, session tokens, or secrets.
- Filters by team, round, action, and time. Paginated/replayable history and full export rather than a feed that exists only in browser memory.
- Start, end, emergency pause/resume, per-team timing compensation, and reasoned score adjustments. All administrative actions are audited.
- Pause must freeze round and event clocks together. Proposed policy: an organizer-declared outage pause extends the event deadline by the paused duration; this needs agreement if the venue requires an absolute wall-clock finish.
- Archive event history before starting another run. Avoid the current reset flow deleting competition evidence.
- Durable logs form the source for live updates. Use an authenticated server event stream with cursor replay and a polling fallback; delivery across the two backend workers must read shared persisted events.
- Countdown display ticks locally using server time synchronization; don't write a log entry or hit the backend every timer second.

## Implementation order

1. Finalize leader/device policy and the proposed timing/scoring settings after discussion. Shared event start, immediate progression, carry-forward time, overtime interpretation, browsing permission, seed retention, and design reference are established. Update the published event rules through the appropriate authorized workflow. Keep time/penalty settings configurable before the event; freeze and version them when it starts.
2. Add event-scoped configuration, balanced and persisted complete-set assignments, team round state with base allowance and carried milliseconds, score history, and durable activity events. Keep prior data intact and add a non-destructive new-event setup script.
3. Implement server-authoritative deadlines, Continue/Skip, score calculation, event cutoff, and atomic/idempotent mutations. Persist deadlines and recover scheduled work after restarts; API requests independently enforce the event cutoff.
4. Replace Google authentication and update participant state/timer/timeout screens.
5. Extend the admin view, event streaming, exports, ranking, and audited event controls.
6. Apply the reference design and replace the ship artwork while preserving checkpoint movement mechanics and question clues.
7. Rehearse the whole event in a separate test database, then prepare the existing AWS backend deployment and frontend configuration. Verify the actual hosting/database setup before making deployment changes.

## Verification required before running the event

- Correct/wrong answers; time-cap boundaries; continuous overtime calculation and reward floor; skip penalties and negative totals; unfinished rounds at cutoff.
- Repeated requests, response loss and retry, simultaneous answer/skip, and multiple tabs must never apply points or advance a round twice.
- Refresh, browser closure, late login, reconnect, device replacement, and backend restart must preserve deadlines and outcomes.
- Carry-forward examples across multiple early finishes, no carry after overtime/skip, no duplicated bank on retry, and global cutoff overriding a banked allowance.
- Global cutoff enforcement even when no browser is connected or the scheduled end worker is delayed.
- Pause/resume and timing compensation with a recoverable audited history.
- Logs and live views consistent across both backend workers; reconnect replays missed events without duplicate scoring.
- Participant/admin authorization isolation and correct assignment of one question per round.
- Balanced two/three-set allocation, no path mixing, assignment persistence, own-set-only access, and refusal to start with an incomplete enabled set.
- Ranking and exports agree, including negative scores and tied ranks.
- Simulate the expected number of teams answering at once; perform an organizer rehearsal and a blind question rehearsal.

## Decisions pending

1. Final leader/device policy; recommended default is the registered leader email plus private team access code, with one competition/research laptop per team.
2. AI-assistance and other fair-play rules beyond the confirmed external browsing permission.
3. Confirm proposed base times, decay/floor/skip values, skip availability, tie rules, and outage pause policy after the initial discussion.
4. Final set count (two or three) and replacement question/answer paths; the seed now contains the original path and two easy temporary paths.
