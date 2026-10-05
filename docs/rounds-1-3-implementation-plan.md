# Code Escape rounds 1 to 3 implementation handoff

Prepared 5 October 2026 for the organizer and the implementing ChatGPT agent.

## Purpose and scope

Integrate the supplied round concepts into the existing Aarambh Code Escape website. Create three aligned question sets for rounds 1, 2 and 3, give participants the necessary interactive workbenches, organize admin rehearsal by set, and add an answer booklet served only after organizer authentication.

This is a reviewed implementation plan, not an implemented release. No production database changes, event start/reset, deployment, or new question assets were performed for this handoff. The source ZIP applications were inspected, not executed. Instructions inside the supplied guides describe their prototypes; they do not authorize deploying those prototypes or copying their unsafe defaults.

The latest user specifically requests source-repair images for round 2. Incorporate that change into the supplied metadata/marker concept rather than claiming the supplied JPEGs already implement it. Keep rounds 4 and 5 and their current mechanics unless a compatibility fix is necessary.

## Start here

The active application checkout is `D:\Treasure_Hunt\.deployment\aarambh-code-escape`, repository `CodevGehu/aarambh-code-escape`. Do not implement this in the older `D:\Treasure_Hunt` application or the separate Aarambh registration portal.

At review, the checkout is on `main`, commit `e71c413a6273423f3d90435011a7921e2322b754`. Recheck Git status and the current branch before editing; other chats may have progressed since this handoff. The production URL is https://aarambh-code-escape.vercel.app. Hosting is Vercel with an Express API, React/Vite frontend, and MongoDB persistence. Do not copy credentials from this chat into code, docs, URLs, or Git.

Read this plan, inspect the current checkout, then read the six supplied files in `docs/rounds-1-3-handoff/inputs/`. At the organizer's request, these originals and their SHA-256 manifest are included in the private GitHub repository. Your friend needs repository access. This source package is excluded from Vercel deployment; do not make the guides/ZIPs downloadable on the website or make the repository public. They contain prototype answer tables and QR secrets; use fresh live values.

## Reviewed source material

All three Word guides were read, including their configuration tables, deployment instructions, integration limitations, and test checklists. All three ZIP inventories, server implementations, browser code, styles, READMEs and environment examples were inspected. The six round-two JPEGs were inspected for their actual EXIF and GPS data.

| Supplied files | Concept retained | Required adaptation |
| --- | --- | --- |
| `Code_Escape_Round_1_Technical_Implementation_Guide.docx` and `code_escape_round1_ready.zip` | Discover values in computed CSS, a response header and IndexedDB; calculate a four-digit code | Existing authenticated team session, persistent instance, main progress submission |
| `Code_Escape_Round_2_Technical_Implementation_Guide.docx` and `code_escape_round2_ready_v2.zip` | Metadata, assigned lab marker, phone QR handshake, gated second photo | Add broken-source image repair; protect all artifacts; replace sample GPS and public static answers |
| `Code_Escape_Round_3_Technical_Implementation_Guide.docx` and `code_escape_round3_final.zip` | Observe letter transformations, use limited probes, infer final output | Prevent querying the target directly; persist probes; use a longer final code |

The three internal prototype configurations align to existing application sets as follows. These labels are for organizers and server mapping only.

| Admin label | Application set | Prototype configuration |
| --- | --- | --- |
| Set 1 | `L1` | `cfg_17` |
| Set 2 | `L2` | `cfg_42` |
| Set 3 | `L3` | `cfg_83` |

Participants never choose their set. Resolve it from the authenticated team, retaining the same assignment across all five rounds and refreshes.

## Problems found in the prototypes

1. Every standalone server uses an in-memory `Map` for session state. That does not survive process restarts or reliably share state across Vercel instances. Their production launch/callback integration is explicitly unfinished.
2. Development mode is enabled unless `DEV_MODE` equals the literal string `false`; round two even supplies `DEV_MODE=true` in its example. Do not import `/start?devConfig=...` or `dev-info` into participant production routes.
3. Round two mounts its whole `public` directory. Direct `/assets/photos/...photo2.jpg` requests bypass its supposedly gated photo-two endpoint. The second photos contain passwords in EXIF `Artist`. Public QR PNGs also expose marker tokens. Remove this public-static design entirely.
4. All supplied JPEGs contain the same sample GPS location. Changing `TCL_LAT/TCL_LON` does not rewrite those existing file bytes: the server variable is only used in development information. Regenerate/check metadata after receiving the real venue coordinates.
5. The physical QR flow shows a six-digit desktop code, but the prototype searches all sessions by that code without a collision guarantee, durable throttling, or main-team session checks.
6. Round three accepts its final input as a probe. The page even suggests probing `E`, its final target. One query gives the answer. Its single-letter answer is also easy to exhaustively guess. On refresh, the UI resets the displayed budget to six even though the server's in-memory counter may already have spent probes.
7. Round one's guide describes a GET answer submission, while its ZIP actually uses POST. Use the current main platform's POST progress route; do not put answers or bearer tokens in query strings.
8. Round-one X and Z are deliberately delivered to the browser, including in bootstrap JSON. This is a DevTools exercise, not a barrier to coding agents. Round-two repair and round-three inference can also be automated. Describe them honestly and calibrate difficulty with pilot teams.

## Architecture decision

Port the puzzle mechanics into the existing API and React application. Do not create three new services, new logins, or independent timers. The guides' temporary launch-token architecture solves a cross-service problem that this integrated design does not need.

Use the existing participant JWT and active-session checks, question mapping, event run, deadline, overtime decision, score calculation and atomic completion flow. Keep successful submissions on `POST /api/progress/submit`; puzzle-specific routes only initialize, return artifacts, verify intermediate steps or execute a bounded probe.

Existing editable integration points:

- `server/models/Question.js`: extend puzzle types and reference private configuration/artifacts.
- `server/models/MappedQuestion.js`: existing one-question-per-team-per-round mapping; preserve pinned question IDs.
- `server/controllers/questionController.js`: authenticated current-question response and downloads.
- `server/controllers/progressController.js`: authoritative answer validation and completion.
- `server/services/eventRules.js`: existing rules; retain their behavior.
- `server/services/interactivePuzzles.js`: currently implements rounds 4 and 5; add a dispatcher rather than replacing its working judges.
- `server/services/installInteractiveQuestions.js`: existing archive-and-replace transaction, currently restricted to rounds 4 and 5. Add a separate round-1-to-3 installer, preserving that restriction on the old installer.
- `server/controllers/adminPuzzleController.js` and `server/routes/admin.js`: protected preview and new booklet endpoints.
- `client/src/pages/QuestionPage.jsx`, `client/src/components/puzzles/PuzzleWorkbench.jsx`: participant rendering and submission.
- `client/src/pages/PuzzleLabPage.jsx`, `client/src/pages/AdminPage.jsx`, `client/src/App.jsx`: admin testing and booklet navigation.

Keep existing approved rehearsal caps of 10/15/20/25/30 minutes, a synchronized event start and shared two-hour deadline, early-finish time carried to subsequent rounds, overtime reward decay of 5% per minute with a 25% floor, and a 20% skip penalty available after the cap. Do not silently alter those rules to match the guides' solving-time estimates. Round three's supplied 5–10-minute concept is easier than the nominal cap suggests; pilot and present timing adjustments separately. Physical movement also makes round two slower than round three, so strictly increasing difficulty is a calibration issue to resolve before the live event.

## Question specifications

There are nine new questions: one per set per round. The three sets should have equivalent tasks and repair workload, not wildly different hidden instructions. Use fresh private event values instead of deploying the now-known guide answers.

### Round 1 The Three Traces

Participant copy, with small wording changes allowed for readability:

> Three traces remain in this room. One belongs to its appearance, one travelled back from the server, and one survived in the browser's storage. Use Developer Tools to find X, Y and Z. Wake the signal when you are ready to inspect its reply. Add the three values and enter exactly four digits, including leading zeroes.

For Set 1 use the title **The Three Traces**; for Set 2 **A Message Between Layers**; for Set 3 **What the Browser Keeps**. All have the same formula and comparable clue placement. Avoid forced poetry and unexplained references.

Mechanism:

1. Server resolves the current mapped question and generates/persists X/Y/Z for that team, question version and event run. Use bounded positive integers whose sum fits four digits. A refresh must not regenerate them.
2. Set `--round1-x` on the round's clue element; reference it through a named computed property such as `--discovery-signal`. The displayed number is intentionally absent from ordinary page text.
3. **Wake signal** performs an authenticated request. Put Y in `X-Escape-Signal`, return only a status in JSON, and set `Cache-Control: no-store`. Preserve the header through Vercel/CORS if API and UI origins differ.
4. Store Z in IndexedDB database `CodeEscape`, store `clues`, under an opaque current-instance key. Tell players which active record belongs to this round without revealing its value. Replace/clear obsolete team/run records on identity change; do not leave another team's clue active on a shared device.
5. Validate exactly four ASCII digits and compare with the server's computed, zero-padded sum through main progress. No client validation that embeds the expected answer.

The server-provided X/Z are allowed intended clues, not confidential answers. Do not claim computed CSS makes them inaccessible through Network or automation. If IndexedDB is unavailable, show an actionable error and offer an organizer-controlled equivalent clue delivery; never silently use zero or reset the clock.

### Round 2 The Picture That Refuses to Open

Use an SVG source-repair puzzle, not a damaged JPEG decoder exploit. SVG is an image described by XML text, so players can inspect and repair its source in the website's editor or their own editor. Create actual malformed fixtures and test that they fail to render in the supported browsers; behavior across every image application or AI service cannot be guaranteed.

Participant copy:

> This picture has lost its grammar. An image viewer cannot finish the sentence, but a text editor can show you where it broke. Open the source, repair its structure, then restore its frame. When the image appears, read the destination and marker it reveals. The clock continues while you work.

The workbench explicitly identifies the file as SVG and says that there are **two structural faults and one frame/visibility fault**. The source should be short enough to inspect, with ordinary line breaks, useful grouping and no minification. It should take reasoning, not require undocumented file-format trivia.

Proposed set design; these are new fixtures to author, not files already in the ZIP:

| Set | Title | Structural repairs | Visual repair after parsing |
| --- | --- | --- | --- |
| 1 | The Frame That Forgot | One unmatched group closing tag; one missing attribute quote | Fix an inconsistent `viewBox` that crops the clue |
| 2 | A Window Without a Picture | One mismatched closing tag; one duplicated attribute | Fix a translated group outside the explicitly declared canvas |
| 3 | The Drawing Behind the Curtain | One missing attribute quote; one mismatched closing tag | Restore a clue group's explicit zero opacity using a nearby visible sibling as evidence |

Each file must initially be invalid XML, not merely have the wrong extension. Each visual fault must have a local, understandable clue to its intended value. Pilot the three forms; translation/opacity may be easier than a frame repair. If unequal, use the same fault types in all sets with different locations and drawings.

Render the marker/location clue with outlined vector glyphs rather than a literal password in `<text>`, comments, filenames, IDs or metadata. This removes the trivial text search shortcut; it does not make reconstruction impossible for AI. Use self-contained vector shapes, no external fonts or remote images. Never include the final round-two password in the stage-one SVG.

Recommended full flow, preserving the guide's physical stage:

1. Download only this team's broken SVG, or open its text in the integrated source editor.
2. Repair and preview it. Submit repaired source plus the read marker. Server verifies the intended normalized structure and current-instance marker; persist `image_repaired`.
3. The restored picture directs players to the authorized lab marker. Preserve Photograph 1 as an optional metadata artifact if organizers want the GPS investigation too; adding both metadata and repair needs timing calibration.
4. A teammate may use a phone to scan the physical marker and enter a short-lived pairing code from the leader's desktop. This is a narrowly scoped QR validation page, not a second team login or playable session. It cannot show other questions, advance rounds, change the score, or replace the leader session.
5. Correct marker plus current pairing code unlocks Photograph 2. Serve the original bytes only through an authenticated, stage-checked download. Its private, regenerated metadata contains the final passphrase.
6. Submit that passphrase through main progress, requiring both `image_repaired` and `marker_validated`. Completion awards the round and opens round three once.

The real TCL location, authorized physical access, travel time and phone use are **organizer decisions still needed before live activation**. The supplied coordinates are placeholders, not verified lab coordinates. If organizers choose a fully digital event, support a separately configured digital mode: after validated repair, open the protected second-photo stage directly. Select that mode once before the run; do not let participants choose or silently fall back from physical mode. Admin rehearsal may simulate the QR stage without changing the live mode.

#### SVG editor and proof safety

- Provide line numbers, plain-text editing, upload/paste, reset, download repaired source, explicit **Preview**, and inline syntax error feedback. A textarea-based editor is sufficient initially; avoid a large new dependency solely for syntax coloring.
- Do not automatically repair anything, show the reference image to participants, or have an error message list all fixes. Parse errors can identify line/column; the visual repair remains the player's job.
- Preview only after strict validation. Never inject uploaded SVG with `innerHTML`, embed it as an unrestricted document, run scripts, or process it with a shell command. Use a validated Blob through `<img>` and revoke replaced object URLs.
- Allow only the small SVG subset used by the generator: `svg`, `g`, `path`, `rect`, `circle`, `line`, `polyline`, `polygon`, plus a tightly specified safe attribute list. Reject DOCTYPE/entities, scripts, `on*`, `foreignObject`, external references, `<use>`, links, CSS URLs, animation and unexpected namespace tricks. Reject extra elements/attributes rather than quietly stripping them before proof checks.
- Proposed bound: 64 KiB per source, 1,500 nodes, depth 16, bounded finite geometry and bounded path lengths. Generate fixtures within those limits. Apply independent limits in browser and API before parsing.
- Server canonicalizes the allowlisted tree and compares its structural representation to a private expected manifest for this instance. Ignore harmless whitespace, quote choice, attribute order and equivalent numeric formatting. Keep intended geometry and glyph paths unchanged. This avoids pretending that a submitted screenshot or client `repaired=true` proves source repair.
- This is a constrained restoration puzzle. Tell participants that changing the drawing to write an arbitrary answer is not a valid repair. Do not promise to recognize every mathematically equivalent SVG; rejecting arbitrary redraws is an explicit rule.
- Keep original/corrected artifacts immutable for a mapped instance. Do not use a public hash of the solution as the only proof or send the corrected manifest to the browser.
- Before coding, choose a maintained non-resolving XML parser and verify its behavior for DTDs/entities, duplicate attributes, malformed input and size limits. Do not use regex as the complete XML parser.

### Round 3 The Black Box

Keep the guide's alphabet-position transformation with a private per-instance base: shift the input by the base plus the triangular number of its zero-based alphabet position, wrapping after Z. Implement the rule only on the server. It is intentionally an introductory inference exercise, not an AI-resistant cipher.

Participant copy:

> The machine follows one rule. These four observations are its footprints. You have six experiments to test your idea. The sealed letters in the final message cannot be queried directly. Work out the rule, transform each letter of the message, and submit the resulting code.

Use four initial observations from A–D, six valid probes, and a three-letter held-out final input rather than the prototype's one-letter E. Suggested final inputs are `ELM`, `EKN`, and `ELO` for Sets 1, 2 and 3. Each includes a near extrapolation and two further letters. Pilot before fixing the final words. Their expected outputs must be generated privately, not published in this plan.

Reject probes of **any character appearing in the final input**. Blocking only the whole three-letter word would still allow probing its letters separately. Make this restriction explicit before a probe is spent. Invalid inputs and blocked letters do not consume a probe. Accept exactly one A–Z letter for probes and exactly three A–Z letters for the final answer, with documented uppercase normalization.

Persist probe history and remaining allowance in MongoDB. Atomically reserve/record each valid probe so simultaneous requests cannot exceed six. Use an idempotency key so a network retry cannot spend a second probe; reusing a key with another input is rejected. Refresh returns actual history and allowance. After six probes, final submission remains available. Add durable answer throttling to prevent code enumeration without introducing an undisclosed new score penalty.

All three sets use the same family and complexity with different private bases and final input. Consider private per-team variation within the assigned set to reduce answer sharing, keeping generator bounds and difficulty equal. Do not give each team a new formula or reroll on refresh.

## Persistent model and API contract

These are proposed names to implement, not existing endpoints. Resolve route ordering carefully: the existing `/api/questions/:level` dynamic route must not capture new static paths.

Add a `RoundPuzzleState` collection with a unique key `(event_run_id, team_id, question_id, puzzle_version)`, an opaque instance ID, current stage, round-one clue values, round-two artifact references/repair acceptance/marker acceptance, and round-three probe budget/history. Keep separate private config/artifact records for the event's active question bank. For partial state writes include the current run, mapped question, active-session identity, current round, event deadline, and overtime decision conditions.

No participant-supplied `team_id`, `set_id`, or configuration parameter chooses content. Each endpoint resolves identity from `authMiddleware`, loads the mapped current question, then checks ownership and stage. Fail closed when MongoDB or private configuration is unavailable.

| Proposed endpoint | Purpose | Authorization |
| --- | --- | --- |
| `GET /api/questions/:level` | Existing current-question interface; return safe config and public instance ID | Existing participant middleware and current-round checks |
| `POST /api/round-puzzles/:questionId/signal` | Round-one header clue | Team, mapped question, current run |
| `GET /api/round-puzzles/:questionId/artifacts/:artifactId` | Broken SVG / allowed photographs | Team ownership, stage, run and current round |
| `POST /api/round-puzzles/:questionId/repair` | Bounded SVG restoration validation | Team, instance, current stage |
| `POST /api/round-puzzles/:questionId/pairing-code` | Issue/refresh narrow QR pairing code | Leader's active session, after repair |
| `POST /api/round2/scan` | Verify physical marker and pairing code | Scoped capability, durable limits, no full team JWT on phone |
| `POST /api/round-puzzles/:questionId/probe` | Bounded server-side black-box probe | Team, instance, current round, persisted budget |
| `POST /api/progress/submit` | Existing final validation, scoring and advancement | Existing main completion path |
| `GET /api/admin/puzzles?set_id=L1` | Rehearsal questions from only selected set, all five rounds | `adminAuth` |
| `POST /api/admin/rehearsals` | Isolated rehearsal instance for selected set/question | `adminAuth` |
| `POST /api/admin/rehearsals/:id/...` | Preview signal, repair, scan simulation, probe and check | `adminAuth`, preview owner and expiry |
| `GET /api/admin/answer-booklet?set_id=L1` | Selected set's private explanations and answers | `adminAuth`, active booklet access policy |

Final submissions carry `level`, `question_id`, `instance_id` and a bounded typed `puzzle_submission`. R1 contains the four-digit code, R2 the final passphrase, R3 the three-letter output. The server validates intermediate state. Allow SVG only on the bounded repair endpoint; do not enlarge the existing 9,000-character progress-submission limit for every puzzle.

Use MongoDB transactions or equivalent atomic conditional updates to coordinate partial puzzle state with event controls. A request that began before end/skip but commits afterward must not unlock an artifact, reserve a new probe, or alter round progress. Existing atomic score completion must remain the sole scoring write. Retried solves, skips, scans and event controls must be safe and idempotent.

Pairing codes must be cryptographically generated, short-lived, collision-checked among active sessions and bound to run, team, leader session, round and expected marker. Store capability hashes, not reusable raw codes in ordinary logs. Expiration revokes only the pairing capability, not the team's round or timer. Bound incorrect scan attempts persistently; avoid locking every team behind one venue IP. Accept QR retries for the same valid stage idempotently. Revoke on logout/session replacement, skip, completion, reset or end.

QR scan success confirms possession of marker information, not physical presence. GPS and QR URLs can be copied. If attendance at the lab matters, use organizer supervision or another event procedure; do not advertise this endpoint as proof of location.

## Participant UI

Retain the current Aarambh visual style, top-level timer, progress display, start/end announcements, overtime modal, and draft handling. Implement `DevToolsRound`, `ImageRepairRound` and `BlackBoxRound` as focused components dispatched by puzzle type.

- R1: clue panel, Wake signal button, storage initialization status without Z, four-digit submission. Avoid revealing X/Y/Z in status messages or analytics.
- R2: stage stepper, source editor and preview beside it on desktop, repair validation, download controls, pairing code with countdown, marker status, protected photo-two download and final passphrase entry. Explain original-file metadata preservation: screenshot/re-encoding may remove EXIF. No public gallery, QR image library or set-labelled asset filenames.
- R3: observation table, probe input, remaining allowance, immutable probe history, sealed-letter list, final message and answer entry. Rehydrate from server on refresh; do not infer remaining probes from local state.
- Persist drafts per authenticated team + run + question version. Do not save organizer answers or the booklet in localStorage/IndexedDB. Ordinary participant artifacts necessarily exist in their own browser once authorized.
- Keyboard access, labelled controls, useful errors, retry without losing work, small-screen layout. Desktop/laptop is recommended for DevTools; phone page supports QR validation only.

## Admin UI organized by set

Keep `/admin` directly accessible and keep the organizer entry absent from participant login.

At `/admin/puzzles`, replace the mixed six-button list with **Set 1 / Set 2 / Set 3** selection followed by that set's **Round 1–5** list. Fetch only the selected set from the protected API. Changing sets clears old selected questions, feedback and active rehearsal state; it must never leave Set 1's question open below a Set 2 heading.

Within the selected round provide **Participant preview**, **Test controls**, and **Answer booklet**. Test controls can reset that rehearsal, run a known-valid reference submission, simulate only that rehearsal's QR stage, and exercise exhausted probes or overtime presentation. Clearly label simulation. Rehearsals use synthetic state separate from live teams and must not write `Team`, `Result`, `MappedQuestion` or competition `EventLog` records. A separate audit collection may record organizer actions.

Booklet content for each selected set and round:

1. Exact participant wording and question/version reference.
2. Intended solving path, expected values for that preview, and normalization rules.
3. R1 discovery locations and worked addition; R2 original/corrected artifact, repair diff, intended marker, deployment-specific QR instructions and second-photo metadata location; R3 private rule, worked examples, probe restrictions and final output.
4. R4/R5 working instructions and certified reference solutions for the selected preview instance; geometric rounds have valid arrangements rather than a single text password.
5. Test checklist, troubleshooting and estimated solving time.

Support selecting a live team's instance only through an additional protected organizer query when helping that team. Do not confuse a rehearsal answer with a per-team live answer. Reuse validators when generating reference answers so the booklet cannot silently disagree with the game.

## Protecting the answer booklet

The achievable requirement is: **an unauthenticated visitor or a participant credential cannot fetch another team's private assets or any organizer booklet data through application routes, static files, bundles, cache or exports**. No system can prevent an authorized organizer from copying its contents, or guarantee secrecy after admin credentials are stolen.

The previously requested rehearsal admin password is known and weak. Hiding `/admin` cannot protect answers. Before loading fresh live secrets, the organizer must supply a private strong admin credential, or explicitly approve a separate strong booklet-unlock credential. The implementing agent must not invent a replacement password and silently lock the organizer out. Keep secrets in deployment environment/private configuration, never in this plan.

Required controls:

- Every booklet, answer asset, reference-proof, corrected-source and booklet export route uses server-side organizer authorization. UI hiding is only navigation, not authorization.
- Reuse the existing distinct admin/team signing secrets, and harden admin JWT verification with an explicit algorithm, role, issuer and audience; update token issuance and tests together. Participant JWTs must fail organizer checks, including when decorated with client-provided admin flags.
- Add short expiry and server-side admin session revocation for booklet access, so logout/revocation ends access without waiting for the existing 12-hour token lifetime. Reauthentication for booklet access is recommended. Avoid caching the secret response in the SPA.
- Private answer/config collections are not exposed through generic serializers. Build participant DTOs from an allowlist. Keep all private files outside `client/public`, static Express roots and frontend imports. Package server-private runtime files intentionally, never as Vercel static output.
- Set booklet/answer downloads to `Cache-Control: private, no-store`, prevent service-worker/offline caching and cross-origin embedding as appropriate, and clear sensitive in-memory UI state on sign-out. Never send answers to analytics, ordinary logs or exception reporting.
- No anonymous/public object-storage URL, public PDF booklet, accessible corrected SVG, public screenshot of answers, or long-lived share link. If export is added, authenticate it independently and treat the downloaded copy as organizer confidential material.
- Audit repository history and deployment output for old answer constants, guide tables, `organizerWitness`, source fixtures and active deterministic generation inputs. Existing old published answers cannot become secret by deleting today's file. Generate fresh live values/artifacts in private storage; do not commit a new live answer booklet or private seeds. It is acceptable to publish validator rules and intentionally visible clues; secrecy must not depend on hiding JavaScript.
- Rate-limit admin login/booklet unlocking and avoid error responses that reveal secrets. Keep all inherited event protections.

## Build order and deliverables

1. **Inventory and fixtures:** inspect current work; create private input manifest, separate public question definitions from private answers, and create nine versioned questions. Author SVG pairs and private normalization manifests; regenerate photos and opaque QR tokens. Verify all reference solutions locally.
2. **Persistence and authorization:** implement the new state/config records, current-instance resolver, participant DTOs, safe artifact service and reusable validators. Extend puzzle type dispatch and main progress validation without changing existing scoring rules.
3. **Round one:** server header endpoint, CSS/IndexedDB setup and participant component. Verify refresh/session isolation.
4. **Round two:** constrained source editor/preview, server repair proof, stage-checked artifact downloads, optional physical pairing and phone page. Test that no static path bypasses a stage. No server execution of participant code.
5. **Round three:** private transformation, held-out targets, atomic probe reservation/idempotency, persistent history and final validator.
6. **Admin:** set-first five-round rehearsal, isolated preview state, booklet authentication, solution display and optional scoped live-instance support.
7. **Migration:** a dry-run-first, backup-backed installer for rounds 1–3 only. Require stopped event and claim the same configuration document as start/reset. Archive old documents and insert new versions; preserve previous question IDs and historic mappings/scores/logs. After apply, verify exactly 15 active questions: three sets × five rounds. Do not reset the event or teams as a migration shortcut.
8. **QA and pilot:** run meaningful tests below, then a small student pilot with internet/AI allowed. Compare all three sets, image clarity, repairs, probe restrictions and physical travel time. Adjust puzzle fixtures/timing only after reporting observed results.
9. **Release:** review diff and migration report; follow the user's then-current push/deployment authorization. Confirm live API, asset authorization, admin booklet and all three complete flows. Keep event stopped until organizers choose to start it.

The plan does not authorize sending messages to the friend, exposing private originals publicly, changing the Aarambh payment portal, or deploying a new independent round service.

## Acceptance tests

### Functional and competition integrity

- All nine new questions load from assigned sets; all six existing R4/R5 workbenches continue to work.
- R1 CSS/header/storage paths expose the intended team clues; exact four-digit code validates. Changing local storage cannot change the server answer.
- All three broken SVG fixtures fail before repair, parse after structural fixes, remain visually incomplete until the frame repair, and reveal readable clues after all repairs. Reference repairs pass; arbitrary redraws do not.
- Corrected sources accept harmless formatting changes. Malformed XML, oversized documents, entity payloads, external references, scripts and extreme path geometry are rejected without executing anything or fetching a URL.
- Round-two final submit is rejected before required stages. The marker/photo-two chain works on actual desktop + phone when physical mode is selected; digital mode is fixed per run and clearly tested.
- Pairing codes cannot validate another marker or run; collisions, exhaustion, expiry, retries and session replacement are tested. QR replay after skip/end cannot unlock anything.
- R3 blocks every target letter without spending budget, handles invalid input, atomically limits concurrent probes to six, retries a request without double charge, restores history after refresh, and accepts final answers after exhaustion.
- Wrong submissions return generic incorrect-answer feedback without expected values. Durable per-team rate limits work on a shared venue IP and across serverless processes.
- Early solve carries remaining time, overtime requires Continue/Skip, reward decay and negative skip scores behave as before, and the shared event deadline wins races against solves, repair, scan and probe writes.

### Access control and leakage

- No token, expired token, participant token, forged role, wrong issuer/audience and revoked organizer session cannot access booklet or reference artifacts.
- A team cannot select another set, request another team's artifact by ID, access a future round, bypass QR, or fetch a corrected SVG/reference answer.
- Direct old `/assets/photos/`, `/assets/qr/`, `dev-info` and `/start?devConfig=...` paths return no secret content in production. Check actual static output, not only route handlers.
- Search built JS, source maps, public filenames, static assets, ZIPs, exports and Git changes for fresh private answers/credentials. Inspect participant API response bodies, not just visible UI.
- Successful booklet responses have no-store headers. Unauthorized downloads are rejected by the origin; changing a client role/state flag has no effect.
- Admin preview simulations never modify live team state, scores or competition logs. Changing set shows only that set's five questions.

### Release evidence

Use the existing backend test suite, strict HTTP workflow smoke test, interactive workflow smoke test and production client build; add focused round-1-to-3, artifact access, QR and booklet HTTP tests. Verify browser UI on desktop and narrow viewport, IndexedDB in a clean profile, real EXIF from downloaded bytes, all three set flows and a server restart/second instance. Record migrated question counts, retained original IDs, and unchanged team/score/log collection checks before and after migration.

## Remaining organizer inputs

These do not prevent implementing local workbenches and protected rehearsal:

- Keep physical lab movement, or choose fully digital round two?
- If physical: actual lab coordinates, permitted marker locations, staffing/accessibility/travel constraints and phone permission.
- Strong private admin/booklet credentials before loading live secrets.
- Pilot-based final fixture difficulty and any explicit cap changes.

Do not invent a real-world destination or activate placeholder GPS. Keep physical deployment disabled/unready until that information is supplied.

## Technical references

The implementation recommendations use the supplied files and the reviewed current code. For SVG image embedding restrictions, consult [MDN SVG as an image](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image). For per-request authorization and fail-closed access, consult [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). These support the security design; they do not guarantee secrecy or AI resistance.

## Pasteable brief for the implementing agent

> Work in the active Aarambh Code Escape repository. Read `docs/rounds-1-3-implementation-plan.md` and the original guides/ZIPs in `docs/rounds-1-3-handoff/inputs/` before coding. Integrate the nine new R1–R3 questions into the existing team authentication, MongoDB state, main scoring/timers and React UI. Build SVG source repair for R2 with protected stages; fix R3 direct-target probing and persistent budgets. Organize organizer testing by selected set with all five rounds, and serve the answer booklet through strict organizer-only backend authorization. Preserve working R4/R5 puzzles and historical team/score/log data. Start with local tests and a dry-run migration. Do not expose input guides, answer files, credentials or fresh live solutions in public assets or public Git repositories, and do not start/reset the live event. Follow the current user's authorization for release actions; ask only for the outstanding physical-event and secret-credential inputs when their dependent work is ready.
