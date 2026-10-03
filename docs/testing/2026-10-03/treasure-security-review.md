# Code Escape independent security and workflow review

Reviewed on 3 October 2026 (IST). Active release repository: `CodevGehu/aarambh-code-escape`, baseline `8b2cdd23a893e82f5a9aaaa3c1b133c48f44d463`. The older `Treasure_Hunt` checkout was reviewed separately and is not the active deployed backend.

## Results

| Check | Result |
| --- | --- |
| Active backend suite, including optional MongoDB replica transactions | 76 passed, 0 failed, 0 skipped |
| Actual Express HTTP workflow against an ephemeral loopback replica | 93 assertions passed |
| Client event notice suite | 4 passed, 0 failed |
| Legacy question-set suite | 23 passed, 0 failed |
| Whitespace validation in both repositories | Passed |

The replica tests used the existing local test-only MongoDB runtime. They did not read application environment files, connect to Atlas, send email, issue production access codes, reset production progress or seed a production database.

## Actual HTTP workflow

The separate smoke used the actual application and routes with synthetic secrets, three synthetic teammate names, synthetic questions and a new loopback replica. It exercised:

- Health, unauthorized participant/staff/export/start endpoints, absent and forged bridge authentication.
- Rejection of a MongoDB operator in the registration identity and leader email fields.
- Approved bridge delivery followed by an idempotent repeat delivery.
- Incorrect leader credentials, login before the start, hidden credential hashes and hidden session identifiers.
- Organizer login and start, rejection of a participant token at organizer start, duplicate start conflict and locked future rounds.
- A replacement login invalidating the earlier session.
- All five rounds: question retrieval, persistent mapping on refresh, incorrect answer, correct answer and replay rejection.
- Completion at round six with exactly five outcomes and 1,500 points; the public leaderboard contained one completed team.
- Refund/revocation invalidating the active session and future login, ignoring stale approval, removing the team from public rankings and retaining its score for audit.

The smoke reported `productionWrites: 0` and `emailsSent: 0`. Its temporary server and replica were closed after completion. It was an additional local execution, not a new repository test file.

## Independent security findings

No release blocker was found in the reviewed active bridge, session or scoring changes. Shared-secret bridge authentication uses constant-time comparison; payloads whitelist fields; transaction receipts prevent stale approvals from undoing revocation; access codes are stored as salted hashes. Participant JWTs constrain algorithm, audience, issuer and active session. Score writes compare the round, progress version, session, event run and server database deadline. Answers are not returned or logged. Organizer endpoints are protected and downloads neutralize spreadsheet formulas.

The 76-test suite also covered overlapping score writes, answer/skip races, event closure during a write, two-hour cutoff boundaries, overtime decisions and penalties, derived-result failures, private metadata omission, paid-roster isolation and actual transactional synchronization with concurrent deliveries.

## Limits and operational notes

- This is pre-deployment local evidence. Production HTTP smoke and final deployment verification must be recorded separately; no live organizer start/reset/refund operation was performed for a test.
- This independent agent did not perform browser visual checks. The inherited local browser permission restriction was respected; HTTP testing was limited to backend API workflows and does not stand in for desktop/mobile layout review.
- Calling `Model.init()` explicitly after loading the app before the first connection exposed a Mongoose `autoCreate` initialization error with `bufferCommands=false`. The independent clean-database fixture connected before importing the application. Existing production collections and indexes must remain intact; creating a fresh database needs an explicit schema/index bootstrap. This was not introduced by the reviewed changes.
- The checked-in seed contains clearly labelled temporary practice question sets. This review did not install those questions into production. Final event content still needs organizer review before the competition.
- The legacy checkout still uses its historical authentication and scoring implementation. It must not replace the active Code Escape deployment.
- Code Escape registration policy (exactly three people, ₹150 per team) is owned by Aarambh. The protected bridge imports approved registrations; the game remains a five-round competition.

## Reproduction

From the active repository, run `npm test`, `node --test client/tests/eventNotice.test.js` and `npm run build`. The checked-in CI workflow installs locked server/client dependencies and performs those checks. To include the optional transaction tests locally, set `AARAMBH_TEST_MEMORY_SERVER` to a locally installed `mongodb-memory-server` package and optionally `AARAMBH_TEST_MONGOD` to a test MongoDB binary; never set either to a production database URI.
