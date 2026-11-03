# Musicians, movement, and wardrobe

The connected world’s historical visitor pool includes J. S. Bach, Mozart, Beethoven, Clara Schumann, Scott Joplin, Duke Ellington, Ella Fitzgerald, Nina Simone, Miles Davis, Arnold Schoenberg, George Frideric Handel, and Antonio Vivaldi. Walk nearby and press **E** to talk; the Profile can help you find musicians. Conversations offer musical background, a practice tip, their current activity, and preferred games.

Historical musicians greet the player with either a source-checked quotation or game-written speech about their musical work and history, without quotation marks or an appended name. Authored greetings are identified in the catalogue and never labeled as historical quotations. Their only general chat choice is **Advice**, a short explanation of a musical concept associated with that person, using familiar examples for young children. Biography and quotation credits stay out of the chat panel; biographies remain in the roster and source notes remain in the content files and [quotation sources](docs/musician-quotes.md). Chopin and Haydn use the same plain greeting and Advice pattern while keeping their room activities. Friendship quests and discoverable facts remain available. In the main arcade, the history action replaces the legacy mission/trivia chat buttons. The three original invited visitors keep fictional greetings.

## Characters

The active characters are the earlier JavaScript-drawn pixel people, restored from before the image-sprite experiments. They draw directly on Canvas and do not depend on generated character PNGs. The plain player base remains bald, in gray clothes, with no automatic hat or accessory. The boutique retains separate hair, skin, upper/lower clothing colors, hats, eyewear, accessories, shoes, and emotes.

Musicians have individual body proportions, face shapes and details, hairstyles, and period outfits. Bach has a broad curled wig, bands and manuscript; Mozart a smaller silhouette, tied wig and embroidered red coat; Beethoven a wild mane and storm coat; Clara a brooched Victorian gown. Joplin wears a side part, waistcoat, watch chain and full moustache; Ellington has a taller tuxedo silhouette, pompadour and pencil moustache; Ella a coiffure, satin gown, pearls and microphone; Nina a long column dress, headwrap and statement jewelry; Miles a slim leather jacket, sunglasses and trumpet. Their fixed identities remain intact. Wardrobe overrides affect appearance without renaming them or changing conversations and routines. Player and NPC drawings share four-direction movement and gestures, and reduced-motion preferences suppress cosmetic animation.

## Behavior

Visitors play cabinets, relax, dance, and explore using the editable collision map. Cabinet destinations follow moved cabinets; hidden or unreachable stations are abandoned. Visitors reserve stations, yield to others, and retry blocked routes. Brief avoidance steps keep their route-facing direction. Conversations pause the selected visitor while the rest of the room continues. Full panels, cabinets, and world editing pause movement. Visitors blocked by a new edit briefly despawn before safe reentry.

See [LEARNING-WORLD.md](LEARNING-WORLD.md) for Chopin, Professor Haydn, Notes, musician missions, levels, and Hall of Fame.

## Boutique and saving

**Your avatar** or the boutique opens the wardrobe. **Customize** switches between the player, the twelve historical musicians, and DJ Coda. The searchable wardrobe has 158 catalog choices: 17 hairstyles, 15 outfits, 26 hats, 16 glasses, 48 accessories, 18 shoes, and 18 emotes. Witch and wizard hats, clockwork goggles, heart glasses, wings, wands, roller skates, clown shoes, chic frames and formalwear are included. The four-direction preview shows draft choices in idle, walking, or selected-emote poses; taller hats fit the expanded preview. Hat and glasses colors are editable. **Plain base avatar** restores the bald gray draft; **Classic cap look** is optional. **Save my look** or **Save NPC look** applies it. Canceling, closing, or switching targets leaves the saved look intact. Names and gameplay progress are preserved.

Player cosmetics stay in `musicArcadeV1`; musician overrides stay in `codaNPCOutfitsV1`, keyed by cast ID. Explicit equipment remains equipped, while recognizable older automatic defaults migrate to the plain base. Unlocks do not automatically equip rewards. Local saves remain separate from account services and world-editor exports.

Press **Q** for the selected player emote. Musicians choose their own gestures through talking, cabinet play, sitting, and dancing activities. Miles's trumpet and Ella's microphone remain available as accessories.

Move with **WASD** or arrows and press **Space** to jump. You can steer during the hop; walls and object depth still follow your floor position. Keyboard controls stay out of text entry, menus, conversations, and the editor.

## DJ and lighting

DJ Coda works behind the dance-room turntables. Walk to the front of the booth and press **E** to open the jukebox, or use the header button. Guests can play three original house compositions, stop playback, and load Song Machine JSON files. Up to twelve imported songs are kept locally in `codaDJLibraryV1`; signed-in song libraries remain available alongside them. Moving or hiding the turntable also moves or hides the DJ and interaction point. The DJ’s outfit can be edited in the boutique.

Hanging lantern glass and bloom pulse slowly. Disco balls project spinning colored beams and small floor reflections contained by the room outline and independent of walking collision. The Canvas projection gives a ray-traced visual style without requiring WebGL. Ball transforms, opacity, rays switches and animation controls carry through to the lights. Full and Lite bound the ray/pin counts; Off removes the added lights. Reduced motion keeps the light geometry and lamp intensity steady.

## Implementation and checks

- `npc-behavior.js` owns cast metadata, dialogue, activity states, reservations, and routing.
- `character-renderer.js` draws the JavaScript characters and owns normalized cosmetic slots, cast appearances, motion, and a bounded palette cache.
- `musician-ui.js` provides conversations, the roster, and live previews; `boutique-ui.js` provides draft controls, presets, and safe default migration.
- `world-lighting.js` owns lantern pulses, room-bounded disco projections, cached glow textures and moving floor pins; `dj-library.js` supplies the original guest compositions and validates Song Machine JSON.
- `world-preview.html` connects these to movement, cabinets, editing, and storage, while preserving cached lighting and paused modal backdrops.

Image sprites and their build tools are retained but inactive. See [SPRITE-ASSETS.md](SPRITE-ASSETS.md) for the active renderer API and verification commands. Guest play needs no credentials; runtime characters do not call an image-generation or AI service.


## Rotating and invited visitors

The main arcade keeps six regular visitors onsite at a time. They arrive and leave through the entrance using normal collision and paths. Conversation partners, authored placements, and active or ready-to-collect quest givers stay protected. Requested musicians return at the entrance rather than appearing beside the player.

Riff’s Visitors collection sells three invitations: Vee Jay (TV-headed DJ, 6,000 Notes), Zizi (alien music explorer, 8,000), and Metronome (clockwork robot, 10,000). They are original fictional characters with their own appearances, greetings, and music tips. Locked visitors do not appear. Invitations persist with the Notes wallet and join future visitor rotations; they do not equip avatar costumes. Mission and trivia buttons only appear when that visitor has an activity implemented.

## Rotating visitors

At most **six visiting NPCs** are inside the arcade at once. The larger roster
rotates: an outgoing visitor walks to the entrance/exit, leaves, and an incoming
visitor enters through that doorway. Requested visitors queue for a free slot;
conversations and active quest givers stay protected without increasing the cap.
If an exit route is blocked, visitors wait and retry rather than fading away.
Chopin, Professor Haydn, and the fixed service characters remain in their rooms.
J. S. Bach remains a single existing character. Schoenberg, Handel, and Vivaldi
each have their own appearance, conversation, and 10 music-history discoveries.

## The Scholar

The fixed historian sits on the lounge couch and keeps the music-history record.
Musician friendships advance through fresh, accepted quests rather than repeated
fact clicks. A **! New history fact** prompt appears when a discovery is ready.
Learn the fact, carry it to the scholar, and collect the hand-in reward.
Collection rewards and ten-question quizzes are described in the
[scholar guide](docs/music-history.md). The scholar does not occupy a roaming
visitor slot or have a separate fact collection.
