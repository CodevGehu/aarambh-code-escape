# Question seed

Team leaders sign in using their registered email and organizer-issued access code. Google/Supabase authentication is no longer required. Set a unique server-only `JWT_TEAM_SECRET` separately from `JWT_ADMIN_SECRET`.

For an empty new database, run `npm run seed` with its `MONGODB_URI` configured in `server/.env`. The seed generates random private codes and stores only scrypt hashes in MongoDB. Plaintext codes are saved to the project-root `.private/team-access-codes-*.json` (ignored by Git); distribute each team's own code privately. Keep these files off public hosting and protect organizer access to them.

For an existing roster, run `npm run codes:issue` to issue only missing codes, preserving progress and previously issued credentials. For a single leader use `npm run codes:issue -- --email leader@example.com`. To replace a lost code use `npm run codes:issue -- --email leader@example.com --rotate --confirm-rotate`; rotation invalidates that team's session. No code-issuing command should target last year's database.

Participant tokens last three hours. A new successful login replaces the active session, so the old device is rejected on its next API request. Signing out revokes that session. Browser session storage allows refreshes in the same tab without sharing credentials across separate browser tabs.

There are three complete sets, with one question in each of five rounds:

| Set | Content | Points per round |
| --- | --- | --- |
| L1 | Existing hunt rounds 1–3; fence laboratory and cargo escape | 100, 200, 300, 400, 500 |
| L2 | Temporary practice rounds 1–3; permutation machine and courier controller | 100, 200, 300, 400, 500 |
| L3 | Temporary practice rounds 1–3; fold-and-cut and shadow assembly | 100, 200, 300, 400, 500 |

Replace the remaining L2/L3 round 1–3 practice content when the final questions arrive. The original five L1 hunt questions are retained as `legacyQuestions` in `seedQuestions.js`; fresh seeds replace only rounds 4/5 with the six definitions in `services/interactivePuzzles.js`. Keep the set IDs and five-round structure consistent. Interactive completions are checked from artifacts on the server; their placeholder `correct_answer` is never an accepted answer.

Organizers can try all six puzzles at `/admin/puzzles` after signing in at `/admin`. Rehearsal checks use the same validators as competition submissions, without updating team progress, event state, or scores. These are finite, solvable rehearsal instances; difficulty equivalence and the round caps still require a pilot. The fence workbench uses the video's shared-edge and field-area principles on a finite lattice rather than asking teams to discover a new mathematical record. The courier editor runs only its bounded instruction language.

To install rounds 4/5 into an existing question bank without resetting a roster, first run `npm run questions:preview`, then `npm run questions:install`. The installation creates a private backup and uses a transaction. All previous versions are archived under their original IDs and replaced with new active documents, preserving even a mapping that finishes just after the event ends. Allocation validates only active questions while retaining archived IDs for legacy mapping lookup. It refuses an active/starting/resetting event and never deletes teams, credentials, scores, results, or logs. Do not run the full seed against a live roster merely to add these puzzles.

See `docs/interactive-rounds-organizer.md` for private organizer solution methods and exact rehearsal mechanics. Do not copy these solutions into participant bundles or public pages.

From the `server` directory, inspect the seed without connecting to a database:

```powershell
npm run seed:preview
```

Run the offline set/assignment tests:

```powershell
npm test
```

`npm run seed` is a full reset against the database configured by `MONGODB_URI`. It replaces teams and questions, clears their old mappings/results, and resets quiz state. If any existing data is found, it requires the typed confirmation `YES DELETE EVERYTHING`. It also validates replacement documents before connecting or deleting data. Use a separate development database when trying the placeholders.

The seed distributes the existing 33-team sample roster equally across the three sets. Starting a quiz validates every set and assigns any remaining teams to complete paths. Assignments are persisted, and a shared allocation plan prevents backend workers from mixing competing plans. Round retrieval and submission use only the team's assigned set. A quiz reset clears assignments so the next run can allocate fresh paths.

Adding a set means adding all five rounds; incomplete or duplicate-round sets prevent quiz start. If using only two sets, remove the entire third set before seeding a new test run.
