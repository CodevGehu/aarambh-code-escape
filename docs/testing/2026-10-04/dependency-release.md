# Code Escape dependency release

Checked on 4 October 2026 (IST). This release updates locked dependency versions, removes the unused client Sharp development dependency, and uses compatible overrides for Express's `qs` and ExcelJS's `uuid`. The API and game rules remain unchanged.

| Check | Result |
| --- | --- |
| Server runtime dependency audit | 0 vulnerabilities |
| Client dependency audit, including development tools | 0 vulnerabilities |
| Backend tests with the local MongoDB replica enabled | 76 passed, 0 failed, 0 skipped |
| Reproducible actual HTTP workflow | 88 assertions passed |
| Client event-notice tests | 4 passed |
| Vite production build | Passed |
| Git whitespace check | Passed |

`strict-workflow.json` records the actual HTTP run. It exercises unauthenticated endpoint protection, forged bridge credentials, operator injection rejection, idempotent approval delivery, participant and organizer sign-in, sequential question access, session replacement, every one of the five rounds, wrong answers, score replay rejection, leaderboard visibility, revocation and stale delivery. It also downloads the real authenticated XLSX export and loads it back through ExcelJS, checking the team and score. This verifies the UUID override through the actual export controller, rather than relying on a module import alone.

The runner creates a disposable loopback replica, uses synthetic questions and credentials, and shuts down the temporary HTTP server and database. It never loads application environment files, contacts Atlas, sends email or writes production data.

Reproduce with `AARAMBH_TEST_MEMORY_SERVER` set to a locally installed `mongodb-memory-server` package and optionally `AARAMBH_TEST_MONGOD` set to a test MongoDB binary. Run `npm test`, `node server/scripts/strict-workflow-smoke.js`, `node --test client/tests/eventNotice.test.js` and `npm run build`. `GAME_SMOKE_REPORT` optionally saves the JSON result. The CI workflow installs the locked dependencies and enforces both dependency audits, unit checks and the production build. Replica and actual HTTP checks in this report were executed locally; they are not claimed as CI checks.

The first replica attempt exceeded its timeout while downloading a fresh MongoDB binary. The successful rerun used the existing test binary and passed all 76 tests. The first HTTP runner comparison included changing server clock fields; the comparison was corrected to the persistent question payload before the successful run. These fixture corrections did not change application code.
