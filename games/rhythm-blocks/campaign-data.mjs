/** Verified authored dungeon data; kept in sync with design/music-puzzler/dungeon.json. */
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const CAMPAIGN_PLAN=freeze({
 "version": 1,
 "status": "released campaign economy; all rooms and outcomes playable",
 "entry": "depot",
 "initialInventory": {},
 "rooms": [
  {
   "id": "depot",
   "title": "The Parcel Depot",
   "sources": [
    {
     "id": "nell-parcel",
     "type": "npc",
     "recipe": [
      "quarter",
      "eighth-pair",
      "sixteenth-group",
      "eighth",
      "quarter-rest",
      "half-rest",
      "dotted-half",
      "sixteenth-pair"
     ],
     "character": "nell",
     "label": "Nell’s note bag",
     "hint": "Talk to Nell to receive eight note tiles. They open musical locks. This bag is separate from the returned letter."
    },
    {
     "id": "depot-chest",
     "type": "chest",
     "recipe": [
      "half"
     ],
     "label": "The small delivery chest",
     "hint": "Nell points out a small chest beside her counter. Its half note is needed for every opening door."
    }
   ],
   "doors": [
    {
     "id": "depot-garden",
     "to": "garden-porch",
     "recipe": [
      "half",
      "half-rest"
     ],
     "label": "The garden door",
     "hint": "Hold a sound for two beats, then leave two beats silent."
    },
    {
     "id": "depot-workshop",
     "to": "workshop-porch",
     "recipe": [
      "half",
      "eighth-pair",
      "sixteenth-group"
     ],
     "label": "The workshop door",
     "hint": "Hold for two beats. Then play two eighth notes and four sixteenth notes."
    },
    {
     "id": "depot-canal",
     "to": "canal-porch",
     "recipe": [
      "half",
      "quarter",
      "eighth-pair"
     ],
     "label": "The canal door",
     "hint": "Hold for two beats, play one quarter note, then two eighth notes."
    }
   ],
   "description": "The bell is silent. Mira and her friends follow a returned letter to learn why mail, water, and ferry checks have stopped."
  },
  {
   "id": "garden-porch",
   "title": "Iris’s Garden Porch",
   "sources": [
    {
     "id": "iris-gift",
     "type": "npc",
     "recipe": [
      "half-rest",
      "half"
     ],
     "character": "iris",
     "label": "Iris’s garden notes",
     "hint": "Talk to Iris for a half note and a half rest. They replace the tiles used at the first garden door."
    }
   ],
   "doors": [
    {
     "id": "garden-porch-forward",
     "to": "garden-fork",
     "recipe": [
      "half",
      "half-rest"
     ],
     "label": "The listening gate"
    },
    {
     "id": "garden-porch-dead",
     "to": "dead-brambles",
     "recipe": [
      "dotted-half",
      "quarter"
     ],
     "label": "The overgrown arch",
     "warning": "Iris warns that thick brambles block the path behind this arch."
    }
   ],
   "description": "Iris asks Mira to listen to the space between notes. Her gift is claimed once through conversation."
  },
  {
   "id": "workshop-porch",
   "title": "Pip’s Bird Workshop",
   "sources": [
    {
     "id": "pip-gift",
     "type": "npc",
     "recipe": [
      "half",
      "eighth-pair",
      "sixteenth-group"
     ],
     "character": "pip",
     "label": "Pip’s workshop notes",
     "hint": "Talk to Pip for a half note, paired eighths, and four sixteenths. The next workshop door needs these notes."
    }
   ],
   "doors": [
    {
     "id": "workshop-porch-forward",
     "to": "workshop-fork",
     "recipe": [
      "half",
      "eighth-pair",
      "sixteenth-group"
     ],
     "label": "The running gate"
    },
    {
     "id": "workshop-porch-dead",
     "to": "dead-aviary",
     "recipe": [
      "dotted-half",
      "quarter"
     ],
     "label": "The silent aviary",
     "warning": "Pip warns that the old bird house has no working reply connection."
    }
   ]
  },
  {
   "id": "canal-porch",
   "title": "The Canal Storehouse",
   "sources": [
    {
     "id": "canal-chest",
     "type": "chest",
     "recipe": [
      "half",
      "quarter",
      "eighth-pair"
     ],
     "label": "The stamped delivery chest",
     "hint": "Oren points out a chest with Nell’s postage stamp. Its three notes fit the next canal door."
    }
   ],
   "doors": [
    {
     "id": "canal-porch-forward",
     "to": "canal-fork",
     "recipe": [
      "half",
      "quarter",
      "eighth-pair"
     ],
     "label": "The delivery gate"
    },
    {
     "id": "canal-porch-dead",
     "to": "dead-ferry",
     "recipe": [
      "dotted-half",
      "sixteenth-group"
     ],
     "label": "The empty ferry",
     "warning": "Oren warns that no boat waits beyond this door."
    }
   ]
  },
  {
   "id": "garden-fork",
   "title": "The Two Garden Paths",
   "sources": [],
   "doors": [
    {
     "id": "garden-normal",
     "to": "garden-final",
     "recipe": [
      "dotted-half",
      "quarter"
     ],
     "label": "The hearth path",
     "hint": "A dotted half note lasts three beats. Add a quarter note to reach the homes."
    },
    {
     "id": "garden-secret-branch",
     "to": "garden-alcove",
     "recipe": [
      "eighth-pair",
      "sixteenth-group",
      "quarter-rest",
      "eighth",
      "sixteenth-pair"
     ],
     "label": "The old stone path",
     "hint": "Try the two one-beat groups, a quarter rest, a single eighth, and paired sixteenths."
    }
   ]
  },
  {
   "id": "workshop-fork",
   "title": "The Workshop Crossroads",
   "sources": [],
   "doors": [
    {
     "id": "workshop-normal",
     "to": "workshop-final",
     "recipe": [
      "dotted-half",
      "quarter"
     ],
     "label": "The schoolroom stair",
     "hint": "Use a three-beat dotted half note and a quarter note to reach the music room."
    },
    {
     "id": "workshop-secret-branch",
     "to": "workshop-alcove",
     "recipe": [
      "eighth",
      "sixteenth-pair",
      "half-rest",
      "quarter-rest"
     ],
     "label": "The birds’ back passage",
     "hint": "Play a single eighth and paired sixteenths. Then use a half rest and a quarter rest."
    }
   ]
  },
  {
   "id": "canal-fork",
   "title": "The Water Clock",
   "sources": [],
   "doors": [
    {
     "id": "canal-normal",
     "to": "canal-final",
     "recipe": [
      "dotted-half",
      "sixteenth-group"
     ],
     "label": "The town-bell stair",
     "hint": "Use a three-beat dotted half note, then four sixteenth notes, to climb toward the bell."
    },
    {
     "id": "canal-dead",
     "to": "dead-echo",
     "recipe": [
      "eighth",
      "sixteenth-pair",
      "half-rest",
      "quarter-rest"
     ],
     "label": "The copied waterway",
     "warning": "Oren’s map shows that this passage ends at a wall."
    }
   ]
  },
  {
   "id": "garden-final",
   "title": "The Hearth Bell",
   "sources": [],
   "doors": [
    {
     "id": "garden-ending",
     "to": "ending-home",
     "recipe": [
      "eighth-pair",
      "sixteenth-group",
      "quarter-rest",
      "eighth",
      "sixteenth-pair"
     ],
     "label": "The home door",
     "hint": "Use the five tiles you brought: two eighths, four sixteenths, a quarter rest, a single eighth, and paired sixteenths."
    }
   ]
  },
  {
   "id": "workshop-final",
   "title": "The Open Music Room",
   "sources": [],
   "doors": [
    {
     "id": "workshop-ending",
     "to": "ending-school",
     "recipe": [
      "eighth",
      "sixteenth-pair",
      "half-rest",
      "quarter-rest"
     ],
     "label": "The music-room door",
     "hint": "Play a single eighth and paired sixteenths for beat one. A half rest and a quarter rest finish the rhythm."
    }
   ]
  },
  {
   "id": "canal-final",
   "title": "The Evening Tower",
   "sources": [],
   "doors": [
    {
     "id": "canal-ending",
     "to": "ending-public",
     "recipe": [
      "eighth",
      "sixteenth-pair",
      "half-rest",
      "quarter-rest"
     ],
     "label": "The town door",
     "hint": "Play a single eighth and paired sixteenths for beat one. Then leave two beats silent and one more silent."
    }
   ]
  },
  {
   "id": "garden-alcove",
   "title": "The Overgrown Music Box",
   "sources": [
    {
     "id": "garden-hidden-notes",
     "type": "hidden",
     "recipe": [
      "quarter",
      "eighth-pair",
      "sixteenth-group",
      "quarter-rest"
     ],
     "label": "Four notes under the flower stone",
     "hint": "Look for a stone carved with a flower. Inspect it, then Search for four notes and a hidden gate."
    }
   ],
   "doors": [
    {
     "id": "garden-hidden-exit",
     "to": "garden-secret-final",
     "recipe": [
      "quarter",
      "eighth-pair",
      "sixteenth-group",
      "quarter-rest"
     ],
     "revealAfter": "garden-hidden-notes",
     "label": "The hidden flower gate",
     "hint": "The four new one-beat tiles from the flower stone open this gate."
    }
   ],
   "description": "The hidden pickup is inside the chosen secret branch. It cannot be collected on the normal path and cannot leak into a regular ending."
  },
  {
   "id": "workshop-alcove",
   "title": "The Birds’ Dusty Attic",
   "sources": [
    {
     "id": "workshop-hidden-notes",
     "type": "hidden",
     "recipe": [
      "half",
      "half-rest"
     ],
     "label": "Two notes inside the hollow perch",
     "hint": "Inspect the hollow bird perch, then Search. Its hidden half note and half rest reveal another gate."
    }
   ],
   "doors": [
    {
     "id": "workshop-hidden-exit",
     "to": "workshop-secret-final",
     "recipe": [
      "half",
      "half-rest"
     ],
     "revealAfter": "workshop-hidden-notes",
     "label": "The hidden brass gate",
     "hint": "A half note sounds for two beats. A half rest leaves two beats silent."
    }
   ],
   "description": "Searching is optional before choosing this detour. Inside it, the once-only hidden cache is needed for the only forward gate; it remains available until found."
  },
  {
   "id": "garden-secret-final",
   "title": "The Reserved Room",
   "sources": [],
   "doors": [
    {
     "id": "garden-secret-ending",
     "to": "ending-secret-quiet",
     "recipe": [
      "dotted-half",
      "quarter"
     ],
     "label": "The unfinished-song door",
     "hint": "Use the dotted half note and quarter note you saved for this last door."
    }
   ]
  },
  {
   "id": "workshop-secret-final",
   "title": "The Hidden Countermelody",
   "sources": [],
   "doors": [
    {
     "id": "workshop-secret-ending",
     "to": "ending-secret-birds",
     "recipe": [
      "dotted-half",
      "quarter"
     ],
     "label": "The birds’ answer door",
     "hint": "Use the dotted half note and quarter note you saved through the hidden passage."
    }
   ]
  }
 ],
 "terminals": [
  {
   "id": "ending-home",
   "title": "A Place to Come Home",
   "kind": "ending"
  },
  {
   "id": "ending-school",
   "title": "The Open Music Room",
   "kind": "ending"
  },
  {
   "id": "ending-public",
   "title": "The Evening Bell",
   "kind": "ending"
  },
  {
   "id": "ending-secret-quiet",
   "title": "The Reserved Silence",
   "kind": "secret-ending"
  },
  {
   "id": "ending-secret-birds",
   "title": "The Birds’ Countermelody",
   "kind": "secret-ending"
  },
  {
   "id": "dead-brambles",
   "title": "The Overgrown Arch",
   "kind": "dead-end",
   "repair": "Return to Iris’s porch, collect her notes if needed, and try the listening gate."
  },
  {
   "id": "dead-aviary",
   "title": "The Silent Aviary",
   "kind": "dead-end",
   "repair": "Return to Pip’s workshop, collect his notes if needed, and try the workshop gate."
  },
  {
   "id": "dead-ferry",
   "title": "The Empty Ferry",
   "kind": "dead-end",
   "repair": "Return to the canal storehouse, open the stamped chest, and try the delivery door."
  },
  {
   "id": "dead-echo",
   "title": "The Copied Waterway",
   "kind": "dead-end",
   "repair": "Return to the water clock and choose the stair leading to the town bell."
  }
 ],
 "rules": [
  "Doors accept their authored ordered recipe, not every rhythm of equal duration. Every door costs exactly four beats.",
  "All sources are explicit interactions, claimed once globally per run. Talking again never gives another parcel. No notes are awarded automatically on room entry.",
  "Nell supplies eight kinds worth ten beats; the depot chest holds the missing half note worth two beats. Both opening interactions are naturally required: every door needs the half note, and that note alone is not four beats. Garden and workshop notes come from conversations; canal notes come from a chest.",
  "The source required for a good porch gate gives exactly the kinds absent after the corresponding opening door. The gate therefore cannot be paid before claiming it.",
  "Hidden sources exist only after choosing their secret detour. Their fixed four-beat gate spends exactly the newly supplied four-beat vector before the branch rejoins its own final room.",
  "Successful terminal stock must equal zero for every kind. Dead ends retain four or eight beats. Nothing discards, converts, or consumes arbitrary leftover notes.",
  "Undo restores room, inventory, source receipts, revealed doors, and the committed action log together. Permanent discoveries never provide current-run notes.",
  "The previous automatic three-tile-per-stage grants are replaced by these explicit once-only sources."
 ],
 "expectedCounts": {
  "rooms": 14,
  "terminals": 9,
  "regularEndings": 3,
  "secretEndings": 2,
  "deadEnds": 4,
  "sources": 7,
  "doors": 22
 },
 "budgetProof": {
  "regular": "12 initial beats + 4 branch-source beats = 4 doors × 4 beats = 16; zero remains.",
  "secret": "12 initial beats + 4 branch-source beats + 4 hidden-cache beats = 5 doors × 4 beats = 20; zero remains.",
  "typed": "Each branch’s remaining eight beats are partitioned into two fixed four-beat vectors. The regular path spends A then B; the secret path spends B, its newly supplied cache vector, then A. Equality holds component by component."
 }
});
