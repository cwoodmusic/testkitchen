# The Lumen Reach

The Quiet Bell keeps its Pocket Pixel presentation and gains a retrofuture high-fantasy setting. People inhabit floating stone islands, root bridges and light canals. They use crystal cells, curved phosphor displays and beautiful old machines whose original makers are gone. Much of the world’s technology is understood through tending, listening and repair.

The public bell synchronized everyday systems: post routes, water clocks, doors and courier birds. Since it went quiet, those routines no longer answer one another reliably. Local crystal cells still keep a lamp warm or a receiver glowing. The opening’s stakes are personal: stalled letters, thirsty seedlings, and promises waiting for a reply.

The depot introduces the mystery through a warm returned letter, a disconnected main relay and a route carriage that still slows for an erased stop. Nell, Iris and Pip give those objects personal meaning. A player should first notice a specific thing, then wonder about it, then learn enough from another person or place to reconsider it on a later run.

## The travelling party

Nell leads. She is wise, thoughtful and well versed in the Reach's machinery and history, rarely surprised and a little impatient. She gives the group a purpose, checks their conclusions and brings a wandering discussion back to the task.

Mira is the observant, plucky, slightly brash heroine, with the biggest personality in the group. Her imagination is whimsical, her replies are bold, and food is frequently on her mind. Her jokes start with something she has actually noticed; hunger should vary her voice rather than replace it.

Iris is pragmatic, investigative and fearless. Her academic delivery is dry, droll and emotionally level, including when everyone else is startled. She produces a magnifying glass to examine evidence, distinguishes observations from guesses and lets an understated remark carry the joke.

Pip is curious and excitable, but afraid of almost everything. A promising discovery can send him running before he thinks about what might be waiting there. His startled stumble, harmless fall and quick recovery are playful character acting; he gets back up and continues contributing.

Room openings let the party move and react together. They investigate different physical details while their conversation connects those discoveries. Nell's leadership, Iris's unruffled scrutiny, Pip's nervous enthusiasm and Mira's lively observations should sound like four people sharing a room.

## A lived world in every room

Every room needs four clear answers: who uses it, what they do here, what has changed, and what the place suggests beyond its visible walls. Give it one readable landmark, a daily habit, a trace of an older use and a route clue or promise. A folded wing wrap, repaired cup or thumb-worn button often says more than another glowing machine.

Show the connection between magic, machinery and work: a root feeds a copper pipe, the pipe wakes a crystal manifold, and the manifold waters somebody’s seedlings. Preserve warm people and practical repairs alongside grand architecture. Keep one or two mysteries unanswered rather than explaining the entire civilization in each inspection.

Garden rooms use jade, amber sap, cream ceramic and living roots. Workshop rooms use teal enamel, copper, blue star-glass and adapted instruments. Canal rooms use indigo, pearl stone, silvered water and weathered brass. Moonstone arches, brass route rings and phosphor glass connect the branches. Apply the 2/3 orthographic view to every room, furnishing and character. Show tops and front faces with parallel edges, rectangular tabletops and constant floor spacing; objects do not taper or recede toward a vanishing point. Leave generous clear floor between the smaller furnishings and travelling companions; use strong pixel clusters, simple faces and warm dark outlines. Avoid religious or occult signs, grim violence and writing on the floor.

## Scope and implementation

[worldbuilding.json](worldbuilding.json) gives every released place an occupation, material palette, landmark, daily habit, trace of the past, unresolved question, route clue and inspection props. All fourteen authored dungeon rooms and all nine outcome locations are playable: the three regular endings, two secret endings and four dead ends each occupy their own explorable room. The depot, garden porch, bird workshop and canal storehouse keep their established conversations and observations. `games/rhythm-blocks/campaign-content.mjs` adds the later rooms and outcomes, with Nell, Iris and Pip responding to each location and Oren remaining at the canal storehouse. There are seventy-one environmental observations across the campaign.

The three porch gates now enter the actual garden paths, workshop crossroads and water clock. There are no continuation-preview barriers in the released campaign. The two detours contain explicit once-only searches beneath the flower stone and inside the hollow perch. Discovering those supplies reveals their physical gates; the gate phrases spend the newly found notes while the original final answer remains in the shared bag. Every successful outcome spends all carried notes. A dead end keeps the remaining inventory and gives a clear way to revisit its paid entrance.

The economy in `dungeon.json` stays authoritative. Lore inspections grant no notes, paid doors, party promises or outcomes. They can preserve observations in the journal and allude to other possibilities, while the chart continues to show only entered rooms and travelled connections. Hidden sources and gates must retain their existing once-only claims, reveal conditions and typed budgets.

Each room remains a starting point for a later story and detail pass through the developer editor. The verified campaign keeps fourteen dungeon rooms, twenty-two paid doors, seven once-only supplies and nine outcomes. Companion settling, departures and the longer all-party/drop-off finales remain separate future design work; the present campaign does not award those unfinished finales.
