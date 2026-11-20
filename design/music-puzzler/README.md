# The Quiet Bell dungeon plan

`dungeon.json` is the active inventory plan. Rooms have physical doors with ordered four-beat keys. Notes come from explicit, once-only conversations, chests, or hidden searches. Entering a room never awards notes automatically. A correct key spends its notes permanently for the current run; an incorrect rhythm spends nothing.

The released graph has **19 ordinary rooms, 28 doors, seven supplies, and seven terminal locations**: four regular endings, two secret endings, and the empty-ferry dead end. The 26 locations include a final three-door route. The Overgrown Arch, Silent Aviary, and Copied Waterway remain paid detours, with southern service gates instead of free return/refund actions.

The purpose is to learn through repeated attempts. A player can spend the notes needed later, reach an empty bag, or retain note types that cannot open the next gate. These are explicit failed runs. The player can read the local explanation and review discovered clues, but must start again to try another route. Starting over resets carried notes, paid doors, and once-only supplies while keeping the discovered-only chart and journal on this device.

## Successful note budgets

Nell’s note bag contains eight types worth ten beats. The depot chest holds the half note worth two beats. Every opening door needs that half note and another two beats, so both starting supplies are required. The next branch gift or chest restores the types spent at the opening door. The direct porch gate uses that gift, leaving two original four-beat phrases, A and B.

| Successful path | Notes supplied | Door costs | Final inventory |
| --- | --- | --- | --- |
| Regular, A then B | 12 initial beats + 4 branch beats | 4 doors × 4 beats | Zero of every type |
| Secret, B then hidden key then A | 12 initial + 4 branch + 4 hidden | 5 doors × 4 beats | Zero of every type |
| Ultimate, C then A then B | 12 initial beats | 3 doors × 4 beats | Zero of every type |

For the ultimate route, C is a half note, quarter note, and paired eighths; A is a dotted half and four sixteenths; B is a single eighth, paired sixteenths, half rest, and quarter rest. These three keys partition the original nine note tiles exactly. There are no new supplies on this route.

All published door rhythms begin with a sounded note. Rests occur after beat one. Equality holds for each note type, not only total duration. Hidden caches require an explicit Search action and reveal their own gates. Their notes pay only the additional hidden gate, so finding a cache does not replace a final key already spent on a detour.

## Deliberate run losses

The data declares three risk-entry doors in `replayRisk.lossEntryDoorIds`: `garden-porch-dead`, `workshop-porch-dead`, and `canal-dead`. Each sends the party through an extra paid service gate. The clues state that the extra gate costs four beats and the final door still needs its own answer.

| Detour | Paid southern exit | Cost | What the attempt teaches |
| --- | --- | --- | --- |
| Overgrown Arch | `bramble-return-gate` → garden fork | Half note, half rest | Save the original dotted half and quarter for the final garden door. |
| Silent Aviary | `aviary-return-gate` → workshop fork | Half, paired eighths, four sixteenths | The hidden cache pays its own gate, not a final key used earlier. |
| Copied Waterway | `echo-return-gate` → bell controls | Dotted half, four sixteenths | The extra service stair uses the last four beats before the bell’s separate key. |

With their porch gifts collected, the garden and workshop detours can continue through the hidden cache, but reach their secret final rooms with zero notes. Skipping the gift instead leaves four beats of the wrong types at the service gate. The canal detour reaches the public-bell controls with an empty bag. All five successful routes remain possible through their safe choices.

Failure detection uses the full carried inventory, including notes currently arranged in an answer. An unclaimed local supply, including a hidden cache, keeps the attempt alive. Only a room with no affordable revealed door and no remaining local supply becomes a resource loss. Empty inventory means out of notes; nonempty unusable inventory means the required note types are missing. The empty-ferry terminal is also a failed attempt rather than a successful repair.

Undo remains free while editing an uncommitted rhythm. It cannot reverse a paid door, restore earlier supplies, or refund a failed route. The authoring editor’s draft Undo and explicit developer test controls are separate tools.

## The final route

The town-link door at Nell’s depot requires **all eleven prior outcomes**, including failed attempts:

- Three ordinary endings: `ending-home`, `ending-school`, `ending-public`.
- Both secret endings: `ending-secret-quiet`, `ending-secret-birds`.
- The empty ferry: `dead-ferry`.
- Five resource losses: `failure-dead-brambles`, `failure-dead-aviary`, `failure-garden-secret-final`, `failure-workshop-secret-final`, `failure-canal-final`.

`progressOutcomes` declares the trusted outcome-ID registry. The entry door carries `requiresProgress: { outcomes: [...] }`; all eleven records are required. The new `ending-complete` outcome and The Complete Score are deliberately absent from that requirement, so the route does not depend on completing itself. Prior run repairs do not stack: the final run uses what the group learned to connect the town’s systems together.

The unlocked path is depot → The Meeting of Routes → The Listening Heart → **A Town Answering Together**. Its three keys use all twelve starting beats. Journal knowledge opens the route but grants no notes; restarting still clears the carried inventory and restores only the ordinary once-only sources.

## Reproduce the proof

```sh
node design/music-puzzler/dungeon-analyze.mjs
node --test design/music-puzzler/dungeon-analyze.test.mjs
```

The analyzer enumerates every supply-claim order and every affordable revealed door whose permanent progress requirements are met. A state contains its room, exact typed inventory, and claimed-source receipts. The checked proof’s full-progress profile reports **46 states, 46 transitions, 16 terminal histories, and 10 resource-loss histories: 26 complete runs**. The fresh-journal profile preserves **43 states, 43 transitions, and 24 complete runs**. Both profiles find three zero-note loss states and two missing-type loss states. With full progress every room, supply, door, and terminal is reachable; all six successful endings have exact zero balances; both secret endings require their hidden claim and gate.

`analyzeDungeon(data, { progressOutcomes: [] })` proves one fixed journal, defaulting to a fresh one. `replayDungeon` accepts the same option, and each gated-campaign witness records the progress IDs needed to reproduce it. `analyzeDungeonProgress` produces the checked full report plus `progressProof`: fresh and complete journal summaries and eleven independent missing-one profiles. Omitting any single prerequisite keeps the final entry closed. The full profile needs only the eleven prior outcomes, never the new ending.

`progress.lockedUntilProgress` lists rooms, supplies, doors, and terminals that are structurally locked by missing journal records. These are reported separately from accidental `coverage.unreachable*` findings. Full-progress coverage still rejects an orphaned room or an unpaid route, and a broken budget behind a progress lock fails the comprehensive proof.

An intentional loss is accepted only when every history reaching it has crossed a declared risk-entry door. Each declared risk door must also have a replayable loss witness. The analyzer tracks marked and unmarked histories even when they merge into the same room and inventory, so one marked representative cannot conceal an accidental blocked path. It still rejects unmarked softlocks, unmarked forced dead ends, invalid typed balances, unreachable content, cyclic graphs, and ungated secret endings. Generic plans without a replay-risk declaration retain the former strict no-loss checks.

Recognized failure descendants are reported separately in `intentionalLossStates`; accidental `softlocks` and `forcedDeadEndStates` remain zero for the released graph. The successful starting state and safe routes retain a successful continuation. Permanent knowledge never creates current-run notes, and repeated conversations or reopened chests cannot duplicate a supply.

The discovered-only pause chart and clue journal persist across runs. **The Complete Score** rewards exploring every location, connection, and outcome in the released graph, including the paid detours learned during unsuccessful attempts. Longer companion destinations/finales in [replay-and-party.md](replay-and-party.md) remain future work. Story and visual direction are documented in [worldbuilding.md](worldbuilding.md) and [worldbuilding.json](worldbuilding.json).

## Earlier proposal

`chapter-one.json`, `analyze.mjs`, `verification.json`, `audit.mjs`, `audit.json`, and `profile-plan.json` preserve the earlier twelve-answer story proposal and its reproducible proof. That proposal used automatic three-tile stage grants and ended with four beats remaining. It is superseded by the dungeon plan and must not supply runtime rules or new profile integration. Its tests remain useful for reproducing that historical proposal.
