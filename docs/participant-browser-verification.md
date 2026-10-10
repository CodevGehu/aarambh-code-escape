# Participant browser verification — 10 October 2026

Three isolated participant browser sessions ran sets L1, L2 and L3 concurrently through the production frontend build, backed by the actual Express application and a disposable loopback MongoDB replica set. This was a functional rehearsal, not a production load test. No live event was started or reset, and no real team scores were changed.

## Results

| Scenario | Verified result |
| --- | --- |
| Team login and event start | Independent sessions; start announcement shown; shared event deadline |
| All three sets, rounds 1–5 | All 15 questions completed through participant controls |
| Normal scoring | Each team saved five solved outcomes: 100, 200, 300, 400 and 500 points; total 1,500 |
| Invalid answer | Rejected without advancing the team |
| Time carry | Unused allowance added to the next round |
| Round-two repair | Broken SVG rejected; repaired sources rendered in every set; saved editor draft survived refresh |
| Round-two photograph | Locked until marker validation; actual JPEG download and EXIF passphrase verified for each set |
| Round-three experiments | Six probes recorded; history survived refresh; further probes disabled |
| Later interactive puzzles | Fence, machine, fold/cut, packing import/tool download, courier and shadow interfaces accepted valid solutions |
| Completion and rankings | Completion persisted after reload; three result records, 15 mappings and searchable rankings verified before branch fixtures |
| Overtime Continue | Clue automatically loaded after accepting Continue; solving awarded 88 reduced points in this rehearsal; zero time carried |
| Overtime Skip | Confirmation shown; score became −20; team advanced to round two with zero time carried |
| Manual event end | All five open participant sessions received the end announcement without reload; completed and unfinished scores remained visible; play controls closed |

## Fix found during rehearsal

If a team first opened an early-round clue after its cap, the server required an overtime choice and withheld the clue. Accepting Continue previously updated progress without fetching that withheld clue, leaving a Retry button. The Continue handler now requests the clue when none is loaded. The blocked-request → Continue → automatic clue → reduced-score submission flow was reproduced and retested in the browser.

Validation: production build and all 11 client state/import tests passed. Synthetic fixtures, answer witnesses, credentials, screenshots and local database files remain ignored in `.private`; they are not published with this report.
