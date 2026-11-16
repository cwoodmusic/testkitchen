# The Quiet Bell dungeon plan

`dungeon.json` is the active inventory plan. Rooms have a fixed list of physical doors, each with an authored ordered four-beat key. Notes enter through explicit, once-only conversations, chests, or hidden searches. Entering a room never awards notes automatically.

The plan contains 14 rooms, 22 doors, seven sources, three regular endings, two secret endings, and four intentional dead ends. This is a balanced branch skeleton for developing the dungeon room by room, not a claim that all rooms are playable. Production currently implements only the Parcel Depot, its two sources, and its three door choices.

Nell’s parcel contains eight types worth ten beats. The depot chest holds the half note worth two beats. Every opening door requires that half note, and the half note alone cannot open a door, so both sources are naturally needed. A branch’s next source restores the types spent at its first door, and its next lock uses that exact gift. The remaining original eight beats split into two four-beat phrases, A and B.

| Successful path | Notes supplied | Door costs | Final inventory |
| --- | --- | --- | --- |
| Regular, A then B | 12 initial beats + 4 from a person/chest | 4 doors × 4 beats | Zero of every type |
| Secret, B then hidden key then A | 12 initial + 4 branch + 4 hidden | 5 doors × 4 beats | Zero of every type |

The equalities hold for each individual note type, not merely duration. Hidden caches occur inside their chosen detours; their notes pay an additional hidden gate before the final phrase. They cannot be collected on a regular route and leave surplus inventory there. A hidden gate stays concealed until its cache is found. Nothing discards, converts, or consumes an arbitrary bag of leftovers.

The explicit dead ends keep four or eight beats, depending on whether their preceding source was collected. They are outcomes with a repair hint, not unintended rooms with no available action. Every reachable nonterminal state retains a successful continuation, including states before collecting an available source.

The current skeleton has four-door regular and five-door secret paths. Longer conservation puzzles can be authored by extending the graph with balanced supplies and costs; they must pass the same exhaustive checks. This plan does not yet claim the earlier ten-step secret-planning depth or least-move achievements.

The next design requirements—longer replay routes, companion destinations and finales, a discovered-only pause chart, and the ultimate **The Complete Score** achievement—are recorded in [replay-and-party.md](replay-and-party.md). The released opening now implements the persistent chart and clue journal. The deeper branches and party finales still require authoring and verification; they do not change the counts below.

The retrofuture high-fantasy setting and room storytelling guide are in [worldbuilding.md](worldbuilding.md), with one record for every authored room in [worldbuilding.json](worldbuilding.json). These add setting, visual direction and environmental observations while preserving the verified economy. Only the depot is currently playable.

## Reproduce the proof

```sh
node design/music-puzzler/dungeon-analyze.mjs
node --test design/music-puzzler/dungeon-analyze.test.mjs
```

The analyzer enumerates all source-claim orders and every affordable, revealed door. A state consists of the current room, exact typed inventory, and claimed-source receipts. The checked `dungeon-verification.json` reports 34 states, 34 transitions, and 24 complete action histories. All rooms, sources, doors, and terminals are reachable. Successful endings have no leftovers; no live state is blocked or forced into a dead end. Both secret endings require a hidden-note claim and its hidden gate on every path. Every reported source, door, and terminal has a replayable witness with a per-kind conservation receipt.

Undo must restore the room, inventory, action log, source receipts, and revealed doors together. Permanent discoveries may label the journal but cannot supply current-run notes. Repeated conversation and reopening a chest never grant another copy.

## Earlier proposal

`chapter-one.json`, `analyze.mjs`, `verification.json`, `audit.mjs`, `audit.json`, and `profile-plan.json` preserve the earlier twelve-answer story proposal and its reproducible proof. That proposal used automatic three-tile stage grants and ended with four beats remaining. It is superseded by the dungeon plan and must not supply runtime rules or new profile integration. Its tests remain useful for reproducing that historical proposal.
