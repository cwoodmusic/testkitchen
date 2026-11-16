# The Lumen Reach

The Quiet Bell keeps its Pocket Pixel presentation and gains a retrofuture high-fantasy setting. People inhabit floating stone islands, root bridges and light canals. They use crystal cells, curved phosphor displays and beautiful old machines whose original makers are gone. Much of the world’s technology is understood through tending, listening and repair.

The public bell synchronized everyday systems: post routes, water clocks, doors and courier birds. Since it went quiet, those routines no longer answer one another reliably. Local crystal cells still keep a lamp warm or a receiver glowing. The opening’s stakes are personal: stalled letters, thirsty seedlings, and promises waiting for a reply.

The depot introduces the mystery through a warm returned letter, a disconnected main relay and a route carriage that still slows for an erased stop. Nell, Iris and Pip give those objects personal meaning. A player should first notice a specific thing, then wonder about it, then learn enough from another person or place to reconsider it on a later run.

## A lived world in every room

Every room needs four clear answers: who uses it, what they do here, what has changed, and what the place suggests beyond its visible walls. Give it one readable landmark, a daily habit, a trace of an older use and a route clue or promise. A folded wing wrap, repaired cup or thumb-worn button often says more than another glowing machine.

Show the connection between magic, machinery and work: a root feeds a copper pipe, the pipe wakes a crystal manifold, and the manifold waters somebody’s seedlings. Preserve warm people and practical repairs alongside grand architecture. Keep one or two mysteries unanswered rather than explaining the entire civilization in each inspection.

Garden rooms use jade, amber sap, cream ceramic and living roots. Workshop rooms use teal enamel, copper, blue star-glass and adapted instruments. Canal rooms use indigo, pearl stone, silvered water and weathered brass. Moonstone arches, brass route rings and phosphor glass connect the branches. Apply the 2/3 orthographic view to every room, furnishing and character. Show tops and front faces with parallel edges, rectangular tabletops and constant floor spacing; objects do not taper or recede toward a vanishing point. Leave generous clear floor between the smaller furnishings and travelling companions; use strong pixel clusters, simple faces and warm dark outlines. Avoid religious or occult signs, grim violence and writing on the floor.

## Scope and implementation

[worldbuilding.json](worldbuilding.json) gives all fourteen authored dungeon rooms an occupation, material palette, landmark, daily habit, trace of the past, unresolved question, route clue and inspection props. The depot, Iris’s Garden Porch, Pip’s Bird Workshop and the Canal Storehouse are playable. The depot’s five observations remain in `games/rhythm-blocks/lore.mjs`; `chapter-content.mjs` adds three observations for each new room, branch dialogue and lock warnings. The remaining ten room records are authoring plans. The three forward gates currently reach clearly marked continuation previews; the three porch dead ends are observed outcomes with a way to revisit the choice.

The economy in `dungeon.json` stays authoritative. Lore inspections grant no notes, paid doors, party promises or outcomes. They can preserve observations in the journal and allude to other possibilities, while the chart continues to show only entered rooms and travelled connections. Hidden sources and gates must retain their existing once-only claims, reveal conditions and typed budgets.

Future rooms should be reviewed against this guide when they become playable. The guide adds no new ending or route count and does not replace the separate party and replay verification work.
