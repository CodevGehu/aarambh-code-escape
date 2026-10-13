# Round-two booklet and participant access — 13 October 2026

The Round 2 booklet now separates the two images explicitly for every set:

1. Repair the malformed SVG for **Image 1**. The guide includes the original broken source, three repair notes, corrected source and expected drawing.
2. Read the restored drawing’s six-digit marker and validate it together with the repaired source. This unlocks **Photograph 2**.
3. Download the original JPEG and inspect its **EXIF Artist** metadata for the final passphrase. Submit that passphrase, rather than the intermediate marker.

Open the answer booklet from the selected round’s rehearsal to obtain matching instance values. A generic booklet instance and a live participant instance can have different markers and passphrases.

All three sets’ reference corrections were verified against the exact participant broken source. The tests also verify that the second artifact is a separate valid JPEG, its metadata matches the final answer, and the first-image repair cannot be bypassed by submitting the final answer early.

Organizer rehearsal and booklet routes now wait for server verification of an admin session before mounting any controls. This fixes the brief display of controls before an unauthorized request failed. Participant accounts still have only participant privileges; a correct set assignment does not grant testing or booklet access.

Validation passed: 12 early-round unit checks, 9 admin unit checks, 11 client checks, production build, and 421 isolated HTTP security assertions covering organizer actions, reference answers, artifact downloads, event controls and exports. Denied requests cannot mutate the disposable test event, team scores or rehearsal state.

Three organizer-issued test teams were provisioned with fixed L1/L2/L3 assignments. Their credentials are stored outside version control in `.private/set-test-logins.md`; no access codes are published in this document. All three real test logins passed 43 production HTTP checks, including rejection of their tokens at admin routes. Provisioning preserved the 34 existing teams and event history. The live event remains unstarted: participant test accounts wait for the shared event start; the organizer rehearsal runs independently.
