# Interactive rounds 4 and 5 — organizer reference

This file contains solutions. Keep it in the private repository; do not copy it into the client, public assets, or question API. The player API sends explicitly selected board configuration only.

These six rehearsalable puzzles replace rounds 4 and 5 of sets L1, L2 and L3. Existing questions for rounds 1–3 remain unchanged. The legacy seed questions are retained separately. The first supplied transcript inspires the **unit-fence/shared-boundary** puzzle; the second inspires **polygon packing**. Neither is circle packing. Both are finite puzzles inspired by the videos' mathematics, not attempts to beat research records. The former sliding-cargo round remains supported for previously assigned questions, but new L1 round-5 assignments use polygon packing.

The event's current 25/30-minute round caps, carryover, overtime and skip rules remain in effect. These are scheduling defaults, **not measured solving times**. The puzzle families have not been calibrated to equal difficulty. Folding in particular is an introductory implementation. Run representative team playtests before a scored event.

## Player contracts and judging

Every puzzle has a stable `instance_id` binding team ID, mapped question ID, event run ID, puzzle type and version. Every submission must include that ID. A stale or copied proof from another team/run is rejected. The game controller must additionally check the active mapped question ID, round, deadline and overtime state before calling the validator. This ID is replay binding, not a secret and not an AI deterrent.

All coordinates increase right/down. Integer-only controls are used except the fence display's generated exact triangular-lattice positions. Client previews assist experimentation; server validation decides the result. No submitted JavaScript or Python is executed.

| Set | Round | Puzzle | Submitted proof |
| --- | --- | --- | --- |
| L1 | 4 | The Shared Fence | `{instance_id, edges:[edgeId,...]}` |
| L1 | 5 | Six Guests, One Small Home | `{instance_id, container_side, positions:[{id,x,y,rotation},...]}` |
| L2 | 4 | The Buttons Lie | `{instance_id, program:[buttonLabel,...]}` |
| L2 | 5 | One Controller, Four Deliveries | `{instance_id, program:"restricted DSL text"}` |
| L3 | 4 | One Folded Cut | `{instance_id, folds:[foldId,...],cut:{a:[x,y],b:[x,y]}}` |
| L3 | 5 | The Shadow Is the Map | `{instance_id, layers:[{id,rotation,x,y},...]}` |

## L1, round 4: The Shared Fence

**Private source key:** [the first supplied video](https://www.youtube.com/watch?v=PhvX-5ymga8), concerning fence packing at [Erich Friedman's packing centre](https://erich-friedman.github.io/packing/fence/). The player receives a poetic clue rather than either URL. A YouTube video URL identifying this source unlocks the workbench. The server parses only approved YouTube hosts; it does not request user-provided URLs. The discovery proof is tied to the puzzle's instance ID.

The discovery checkpoint verifies identification of a source, not that the team watched it. URLs can be shared and a coding agent can locate them. Provide a supervised source-discovery fallback if YouTube is blocked at the venue, so a network outage cannot consume a scored round unfairly.

The selectable graph is a radius-2 triangular lattice. Every edge is exactly one unit long. Select at most 12 edges, forming one connected network. Every used vertex must have degree at least two. Each bounded field must have area at most 1; the sum must reach `3*sqrt(3)/2`, approximately 2.598076211353316. The authoritative comparison tolerance is `1e-8` area units. Players cannot supply coordinates or their own claimed areas.

**Witness:** take the six unit edges forming the hexagon surrounding the central node, then its six spokes. The spokes divide a hexagon into six equilateral unit triangles. Each triangle's area is `sqrt(3)/4`, approximately 0.4330127019; the six faces sum to the target. Rotating the board preserves feasibility. The server follows directed half-edges to compute bounded face areas; a bare hexagon fails the per-field cap. Disconnected graphs fail, preventing nested components being counted incorrectly.

## L1, round 5: Six Guests, One Small Home

**Private source key:** [the second supplied video](https://www.youtube.com/watch?v=mVH7OPx4QZU), titled *I Got 122 World Records To Prove A Point* by Flamethrower. Its transcript describes 122 packing records, exploration/polishing, warm-starting, polygon boundary penalties and separating-axis collision checks. Its verified description links the creator's [polygon-packer tool](https://github.com/Flamethr0wer/polygon-packer). The player clue refers to those distinctive motifs and the red play button without supplying the title, channel or link. The video URL **and** the linked GitHub repository URL must pass the same instance-bound discovery checkpoint before the workbench appears. The GitHub check accepts the repository root, optional trailing slash or `.git`, case-insensitively; it does not fetch URLs or execute downloaded code.

The official tool README documents `python3 polygon_packer.py [n] [nsi] [nsc]`: `n` is the number of inner polygons, `nsi` the number of sides of each inner polygon, and `nsc` the number of sides of the container. This event's example parameters are `6 3 6`. Teams may inspect the tool and use outside resources, but installing or running its numerical optimiser is **not required**. Its research runs can be lengthy; the event provides a finite, known-solvable geometric threshold instead. The round clock continues during source discovery, tool research and board experimentation, following the existing overtime rules.

Six regular equilateral triangles have side length 1. Pack all six inside a regular hexagon with side length at most **1.02** and at least **1**. The initial displayed side length is 1.8. Translations and rotations are continuous; players can manipulate poses or import plain JSON. No arbitrary submitted code runs. Coordinates are relative to the container centre, with x right and y down; positive rotation is clockwise. Every pose contains a unique piece ID, finite x/y within ±4, and rotation in `[0,360)` degrees.

The team-specific container rotation is a multiple of 15°. Each unit-side hexagon is defined by vertices at angles `rotation + 60*i` with radius 1. Each local unit-side triangle has centroid `(0,0)` and vertices at angles `0,120,240`, with radius `1/sqrt(3)`. Scale only the container by the submitted `container_side`.

**Witness:** subdivide the unit hexagon into six sectors from its centre. Triangle `i` has centre `((cos(theta))/sqrt(3),(sin(theta))/sqrt(3))`, where `theta = container_rotation + 60*i + 30` degrees, and orientation `(container_rotation + 60*i + 90) mod 360`. Use container side 1. This exactly tiles the hexagon, so it is a constructive feasible result without an optimisation run. Six-decimal poses are also accepted at side 1.02, avoiding a requirement for pixel-perfect dragging or symbolic-number input.

The judge transforms the authoritative local triangles, checks every vertex against every container edge using normalized signed distances, and checks each triangle pair with the separating axis theorem over both polygons' edge normals. Shared/touching edges are accepted. The published geometric tolerance is `1e-6` units for containment and projection separation; client-supplied polygon vertices are ignored. Missing/duplicate IDs, nonfinite poses, out-of-range rotations, overlaps or oversized containers fail. This is a practical threshold with slack, not an unproved global optimum challenge.

## Legacy L1, round 5: A Fit Is Not an Exit

Slide pieces on the 6×6 board along their assigned axis. A move is one signed, integer translation of 1–6 squares. Every intermediate square is checked; no rotation, collision, teleport, wrong-edge exit or out-of-bounds ordinary piece is accepted. Only cargo may traverse its marked exit; it must leave completely. At most 40 submitted moves are accepted. A move sequence ends when cargo has fully exited.

The original eleven-piece fixture has an independently BFS-verified minimum of eight axis-slides. For the right-exit orientation its shortest witness is `C:+1, cargo:-1, A:-1, J:-4, A:+1, F:+1, I:+1, cargo:+6`. Cargo must initially move away from the exit so that the lower blockers can be rearranged. The board can be rotated 180° for a team's equivalent instance; negate every delta for the left-exit orientation. The private `organizerWitness` helper provides the exact signed sequence for that instance. Refer to the tested fixture in `interactivePuzzles.js`; do not infer a witness from a screenshot of a different team.

## L2, round 4: The Buttons Lie

Six distinct tiles and three buttons are shown. Public demonstrations reveal before/after arrays for each button; teams infer the positional permutations. The private operations are right-cycle by one, swap positions 0/1 and reverse all positions. SUN/MOON/STAR labels are permuted by instance.

The server exhaustively enumerates all 720 permutations by BFS from the initial arrangement, chooses a maximally distant target, and allows shortest distance plus two presses. The current generator's maximum distance is 12; the visible allowance is 14. All target variants have the same minimum distance. The shortest witness is server-only; any sequence within the visible allowance that reaches the target is accepted.

The demonstrations are sufficient to infer every operation without guessing, because all tile labels differ. This puzzle can also be solved by a coding agent; its purpose is inference and planning, not guaranteed AI resistance.

## L2, round 5: One Controller, Four Deliveries

Two practice maps are public. Two further maps are withheld; all four contain one connected, nonbranching corridor without loops, with varying orientations, starts and goals. Walls `#`, outside the board, and the fragile-package tunnel `T` block movement. `G` is the delivery destination. Coordinates increase right/down; directions 0/1/2/3 are up/right/down/left.

The only commands are `MOVE`, `TURN_LEFT`, `TURN_RIGHT`, `STOP`, `REPEAT n`, `IF_WALL`, `IF_RIGHT_OPEN`, `IF_GOAL`, `ELSE`, and `END`. Blocks may nest at most four levels; repeats range 1–160; programs are at most 60 nonblank lines and 4,000 characters. Blocks require their matching `END`. There is no access to coordinates, network, files, arbitrary variables or JavaScript. The parser never uses `eval` or `Function`.

**Verified controller:**

```text
REPEAT 160
IF_GOAL
STOP
END
IF_RIGHT_OPEN
TURN_RIGHT
END
IF_WALL
TURN_LEFT
ELSE
MOVE
END
END
```

This follows the right-hand wall while preventing forward collisions, including turning around at a dead end. One program must deliver on all four maps. STOP before G fails; termination on G also succeeds. Each parsed instruction execution and each repeat iteration consumes budget; the limit is 1,500 per map. Hitting a wall/tunnel or exceeding the budget fails. The API reports completion summaries without publishing withheld geometry or a required path. The controller is predictable and intentionally introductory; increase map-family complexity only after adding a verified general solution.

## L3, round 4: One Folded Cut

The sheet is 8×8. Fold both prescribed halves once, in either order, along x=4 and y=4. Which half moves changes by team. The final material occupies the corresponding 4×4 quarter. Make one straight cut with integer endpoints inside that quarter.

**Witness:** one endpoint lies on the vertical crease, two units away from the horizontal crease; the other lies on the horizontal crease, two units away from the vertical crease. For left/top onto right/bottom this is `(4,6)` to `(6,4)`. Reflect the endpoints for a team assigned another quarter.

Unfolding duplicates the segment across both creases, producing the four edges of the diamond `(4,2)→(6,4)→(4,6)→(2,4)→(4,2)`. The validator computes all reflected segments and compares them to the target; it accepts reversed endpoints and either fold order. Duplicate folds, noninteger cuts, degenerate cuts and cuts outside the final quarter fail. No physical prop verification is required in this online prototype. [Fold-and-cut research](https://erikdemaine.org/foldcut/) provides optional background.

## L3, round 5: The Shadow Is the Map

Place three 3×3 opaque patterned layers on a 7×7 grid. All layers must be used once, stay wholly inside the board, and use integer translations and clockwise quarter-turns. Rotations use `(x,y)→(2-y,x)` for 90°. Shadows combine by **union**, matching opaque material: overlaps remain dark.

The private generator selects rotations for each layer and placements `(0,0)`, `(2,1)`, `(1,3)`, and computes the target union. Teams see source masks and the target, but not placements. The judge accepts any exact union matching the target, including alternative valid arrangements. Extra/missing cells fail. No route extraction is included in this first playable implementation; completing the layer assembly is the objective.

## Private witness generation and maintenance

`server/services/interactivePuzzles.js` exports `organizerWitness(question, team)` and `organizerDiscoveryWitness(question, team)` for organizer tooling and tests only. The latter contains the private expected source URL for fence/packing. The public `getPuzzle` function never calls or includes these answer helpers. Pass the real mapped question's `_id` and team's `_id`/`event_run_id` to obtain proofs tied to that exact instance.

All six question texts are now poetic descriptions of their actual puzzle method. Fence and packing additionally require source discovery; the other four use their public demonstrations or geometry directly. Public puzzle metadata contains `discovery: {clue,platform:'YouTube',kind:'video'}` for those two, with no answer URL/video ID, and no source-link drawer. Packing also has `tool_required:true` and a second-resource clue, with no expected repository name or URL. Its proof includes `tool_url` in addition to the video's `url` and the shared `instance_id`. The question controller must withhold the full board configuration until discovery has been verified for the current team/question/run; `getPuzzle` itself is an internal complete-config builder.

The engine suite verifies all six witnesses over 40 team IDs (240 instances), explicit cross-team/question/run rejection, polygon containment/SAT collision, decimal precision with packing slack, unknown IDs/properties, numeric bounds, DSL parse/execution budgets, equivalent fold orders, and shadow union validation. Source-parser tests cover watch/short/shorts URLs, spoofed hosts, userinfo, ports, duplicate query IDs, wrong videos, oversized input and cross-team/run rejection. Independent integration tests must ensure text `[interactive]` cannot bypass the proof path, discovery cannot be bypassed, and stale question IDs cannot advance the round.

## Event rehearsal and AI expectations

AI agents can derive permutations, solve finite packing/movement problems, follow the linked video and construct the restricted controller. This implementation reduces answer sharing through instance binding and demands a complete working result, but cannot guarantee independent human reasoning. Do not market it as impossible for AI. Optional physical reconstruction can require human attendance, though it still does not prove AI-free reasoning.

Before using different families for scored parallel sets, test representative teams, time source discovery and UI operation separately, and adjust goals so median completion times and failure rates are comparable. Avoid making precise pointer movement, loading a third-party site, unfamiliar English phrasing or an organizer queue part of the score. If fairness cannot be demonstrated, use one family with equivalent variants for all competing teams.
