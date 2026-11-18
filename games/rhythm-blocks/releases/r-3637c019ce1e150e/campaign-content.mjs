/** All released places in the Quiet Bell campaign. Text and observations grant no notes. */
import {PEOPLE} from './opening.mjs';
import {ROOM_CONTENT} from './chapter-content.mjs';
import {getRoomPeople} from './party-content.mjs';
import {CAMPAIGN_PLAN} from './campaign-data.mjs';

const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const members=new Map(PEOPLE.map(person=>[person.id,person]));
const MEMBER_IDS=['nell','iris','pip'];
const DOORS=Object.fromEntries(CAMPAIGN_PLAN.rooms.flatMap(room=>room.doors.map(door=>[door.id,{...door,from:room.id}])));
const NEW_ROOMS={
  "garden-fork": {
    "arrival": "Two paths cross a garden shared by nearby families. One leads to their homes. The older stone path disappears under the roots.",
    "stories": {
      "nell": "Mira, the wind cups can wait. These families share tools and help fix them. The bell can’t hear their replies, so deliveries and water controls have stopped. Let’s get their local connection working.",
      "iris": "The old copper line runs under those roots, and it carried messages before this path was built. So an older route might still work when the main one fails.",
      "pip": "My bird keeps watching the old stones. It knows little resting places along that path. Maybe it can get through places our maps have forgotten. I’d rather follow than guess."
    },
    "routes": {
      "nell": "The hearth path needs a dotted half note, then a quarter note. That’s three beats, then one, so save the other five tiles for its next door.",
      "iris": "The old stone path needs two eighth notes, four sixteenth notes, a quarter rest, a single eighth note, then two sixteenth notes. Keep the dotted half and quarter for later.",
      "pip": "I can play the old stone path’s answer. Use two eighths, four sixteenths, a quarter rest, one eighth, then two sixteenths. Iris remembers a flower stone farther along. Keep our dotted half and quarter safe."
    },
    "inventory": {
      "nell": "We’ve got eight beats left, and there aren’t any new notes here. Each path costs four beats. Pick one, then save the other four beats for later.",
      "iris": "The hearth path uses our dotted half and quarter first. The old stone path uses the five smaller tiles first. Either choice leaves a four-beat answer in the bag.",
      "pip": "If we follow the old stones, I’ll guard the dotted half and quarter. We need both at the end. I’m very good at guarding things tucked safely inside a bag."
    },
    "demos": {
      "nell": "garden-normal",
      "iris": "garden-normal",
      "pip": "garden-secret-branch"
    },
    "title": "The Two Garden Paths",
    "inspections": [
      {
        "id": "garden-fork-shared-can",
        "title": "The shared watering can",
        "label": "Inspect the shared watering can",
        "text": "Several people have repaired this watering can’s handle. The families share the can instead of buying one each.",
        "placement": "left"
      },
      {
        "id": "garden-fork-buried-ring",
        "title": "The buried paving ring",
        "label": "Inspect the buried paving ring",
        "text": "Worn stone grooves and an old copper message line pass under the roots. They follow an older path.",
        "placement": "right"
      },
      {
        "id": "garden-fork-wind-cups",
        "title": "The listening cups",
        "label": "Inspect the listening cups",
        "text": "The breeze makes these little cups ring. A gap in their row leaves a pause between the sounds.",
        "placement": "wall"
      }
    ]
  },
  "workshop-fork": {
    "arrival": "Repair benches fill this workshop. One path leads to a music classroom. A smaller passage behind the bird perches leads into the old attic.",
    "stories": {
      "nell": "People brought broken tools here and helped each other fix them. Then they opened a music classroom upstairs. Now that classroom needs a way to send messages and hear replies.",
      "iris": "Pip, three kinds of thread don’t make a bad repair. They fit together, and I checked the red seam myself. It bends without catching. That wing works.",
      "pip": "Iris trusts the repairs. I’d like the birds to trust them too. Both ends of that rail are shiny, but the middle’s dusty. They’re still using the back passage. I hope they remember what’s safe."
    },
    "routes": {
      "nell": "The schoolroom stair needs a dotted half note, then a quarter note. Save the single eighth, paired sixteenths, half rest and quarter rest for the classroom door.",
      "iris": "The birds’ back passage takes a single eighth, paired sixteenths, a half rest and a quarter rest. Paired sixteenths means two sixteenth notes. The schoolroom stair takes a dotted half and a quarter.",
      "pip": "The birds’ back passage needs a single eighth, paired sixteenths, a half rest, then a quarter rest. The first two tiles fill one beat. The rests fill three more. Keep our dotted half and quarter for later."
    },
    "inventory": {
      "nell": "There aren’t any new note tiles here. We’ve got eight beats for two more doors. The schoolroom stair spends the dotted half and quarter first.",
      "iris": "Our dotted half and quarter make one four-beat answer. The two short-note tiles and two rests make the other. Spend one answer and keep the other.",
      "pip": "If we take the back passage, save the dotted half and quarter. The attic might have something worth finding, but I’d like all three of you to help me look."
    },
    "demos": {
      "nell": "workshop-normal",
      "iris": "workshop-normal",
      "pip": "workshop-secret-branch"
    },
    "title": "The Workshop Crossroads",
    "inspections": [
      {
        "id": "workshop-fork-help-shelf",
        "title": "The help shelf",
        "label": "Inspect the help shelf",
        "text": "Three people repaired the same bird wing. Their different stitches let it open smoothly again.",
        "placement": "left"
      },
      {
        "id": "workshop-fork-worn-rail",
        "title": "The back rail",
        "label": "Inspect the back rail",
        "text": "The rail is shiny where small bird feet land. Dust remains in the middle, where the birds do not need to step.",
        "placement": "right"
      },
      {
        "id": "workshop-fork-sound-screen",
        "title": "The silent sound screen",
        "label": "Inspect the silent sound screen",
        "text": "The green screen shows two small flashes after a long pause. It is showing the timing of a rhythm.",
        "placement": "wall"
      }
    ]
  },
  "canal-fork": {
    "arrival": "The water clock is still ticking, but its water bowl is dry. A stair leads toward the town bell. Another channel ends at a solid wall.",
    "stories": {
      "nell": "Oren marked that wall on his map. The clock won’t release the water until the bell replies, so let’s find out why that reply never arrives.",
      "iris": "An echo isn’t a warning, Pip. It’s just a sound coming back. The clock has power, but the water’s waiting for a real reply. We need to follow the connection to the bell.",
      "pip": "My bird can copy that sound, and the water makes an echo. Iris says an echo’s just a sound. Fine, but I’d still like our real reply before I have to swim."
    },
    "routes": {
      "nell": "The town-bell stair needs a dotted half note, then four sixteenth notes. Hold three beats, then play four sounds in one beat. Save our four other tiles for the tower.",
      "iris": "Use a dotted half and four sixteenths at the stair. The other channel takes a single eighth, paired sixteenths, a half rest and a quarter rest, but Oren’s map shows it’s a dead end.",
      "pip": "Take the stair with a dotted half and four sixteenths. The copied waterway only leads to that wall. An echo sounds like an answer, but it can’t open a path through stone."
    },
    "inventory": {
      "nell": "No new notes are stored here. Use the dotted half and four-sixteenth group for the stair. Keep the single eighth, two sixteenths, half rest and quarter rest for the final door.",
      "iris": "We’ve got enough for the stair and the tower’s last lock. Those four quieter tiles belong to the last lock, so don’t spend them on the blocked channel.",
      "pip": "Each door costs four beats, but Revisit previous choice brings its notes back if we try the wrong one. We don’t need to put any notes in the water. Or any people."
    },
    "demos": {
      "nell": "canal-normal",
      "iris": "canal-normal",
      "pip": "canal-dead"
    },
    "title": "The Water Clock",
    "inspections": [
      {
        "id": "canal-fork-waiting-drop",
        "title": "The waiting drop",
        "label": "Inspect the waiting drop",
        "text": "The clock holds this drop above an empty bowl. It is waiting for a message that says it is safe to release the water.",
        "placement": "left"
      },
      {
        "id": "canal-fork-service-stool",
        "title": "The keeper’s stool",
        "label": "Inspect the keeper’s stool",
        "text": "A repaired stool gives Oren somewhere to sit during a long watch. He has kept checking the clock.",
        "placement": "right"
      },
      {
        "id": "canal-fork-maintenance-map",
        "title": "The map of the blocked path",
        "label": "Inspect map of the blocked path",
        "text": "Oren drew the solid wall at the end of the copied channel. The stair is the way toward the bell.",
        "placement": "wall"
      }
    ]
  },
  "garden-final": {
    "arrival": "A small bell connects these homes to the garden’s water controls. Its return wire is loose. The neighbors have kept the kitchen warm while waiting for help.",
    "stories": {
      "nell": "The town bell can’t hear replies because its return connection is loose. This little bell has a shorter, local connection, so we can help these homes without reaching the tower.",
      "iris": "Pip, let’s test the repair before we celebrate. Our last rhythm will check whether the little bell hears the homes answer. Then the garden can request water again. Results first, cheering second.",
      "pip": "Iris wants one more test, but I think we’ve found something! The bird’s clip is warm from its charging perch. That could soften the letter’s wax. Maybe it came home along an old route, not by magic."
    },
    "routes": {
      "nell": "The home door needs two eighth notes, four sixteenth notes, a quarter rest, one eighth note, then two sixteenth notes. Use the five tiles we saved at the garden fork.",
      "iris": "Play two eighths in one beat, then four sixteenths in one beat. Leave one beat silent with a quarter rest. Finish with a single eighth and two sixteenths. Those last two tiles share one beat.",
      "pip": "Our last key is two eighths, four sixteenths, a quarter rest, one eighth, then two sixteenths. The single eighth and the pair of sixteenths take equal time, but they make different sounds."
    },
    "inventory": {
      "nell": "Mira, soup after the door. We’ve already got the five tiles for the whole answer, and there aren’t any new notes in this kitchen. The home door uses everything left in our bag.",
      "iris": "Keep the five tiles in the right order. The quarter rest is one full beat of silence. All five tiles together fill four beats.",
      "pip": "I checked the bag, and we’ve already got the whole last rhythm. I also checked the kitchen. There aren’t any note tiles in the soup. Mira checked twice."
    },
    "demos": {
      "nell": "garden-ending",
      "iris": "garden-ending",
      "pip": "garden-ending"
    },
    "title": "The Hearth Bell",
    "inspections": [
      {
        "id": "garden-final-extra-place",
        "title": "The extra place",
        "label": "Inspect the extra place",
        "text": "A warm cup and a straightened cushion wait at this empty place. The neighbors are ready to welcome another visitor.",
        "placement": "left"
      },
      {
        "id": "garden-final-kitchen-relay",
        "title": "The kitchen reply switch",
        "label": "Inspect kitchen reply switch",
        "text": "This old switch connects the little bell to the water controls. The neighbors also use it to keep their soup warm.",
        "placement": "right"
      },
      {
        "id": "garden-final-mended-clapper",
        "title": "The repaired bell striker",
        "label": "Inspect repaired bell striker",
        "text": "Neighbors have repaired the metal piece inside the bell. That piece strikes the bell to make it ring.",
        "placement": "wall"
      }
    ]
  },
  "workshop-final": {
    "arrival": "This music classroom was built around an old message machine. Low stools and extended handles let more people use it. Its reply connection needs repair.",
    "stories": {
      "nell": "This machine used to send messages for one person at a time. The class changed it so learners could hear and answer each other, but a loose return connection stopped that part working.",
      "iris": "The town bell has the same fault: its return connection can’t carry replies. We can fix the classroom’s local connection now, and the final rhythm will test its listening time.",
      "pip": "That low stool was mine, and Nell helped me make a handle I could reach. I want the next learner to hear an answer when they try. It’s less frightening than a room that just stares at you."
    },
    "routes": {
      "nell": "Use a single eighth note, paired sixteenths, a half rest, then a quarter rest. The two short-note tiles share beat one. Leave the next three beats silent.",
      "iris": "A single eighth takes half a beat. Paired sixteenths take the other half. Follow them with a half rest for two beats, then a quarter rest for one beat.",
      "pip": "Our last four tiles go: single eighth, paired sixteenths, half rest, quarter rest. I can play the example, but keep the rests too. They count even though they don’t make a sound."
    },
    "inventory": {
      "nell": "We’ve got the four tiles we need, so we don’t have to collect another gift. Opening the classroom door will use them all.",
      "iris": "We’ve got one four-beat answer left. Its short notes fill the first beat, and its rests fill the next three. Keep that order.",
      "pip": "The repair shelf has tools, but no more note tiles. We’ve already brought the answer. My pockets have bird feathers, which won’t help the lock. I did check."
    },
    "demos": {
      "nell": "workshop-ending",
      "iris": "workshop-ending",
      "pip": "workshop-ending"
    },
    "title": "The Open Music Room",
    "inspections": [
      {
        "id": "workshop-final-low-control",
        "title": "The lowered control",
        "label": "Inspect the lowered control",
        "text": "A wooden handle extension lets a smaller learner reach the machine’s lever.",
        "placement": "left"
      },
      {
        "id": "workshop-final-practice-patches",
        "title": "The practice patches",
        "label": "Inspect the practice patches",
        "text": "These repaired cloth patches mark where learners stood and tried again. Different people needed different amounts of space.",
        "placement": "right"
      },
      {
        "id": "workshop-final-listening-ring",
        "title": "The listening ring",
        "label": "Inspect the listening ring",
        "text": "The seats face one another. The machine is now a shared music instrument, instead of one person’s work station.",
        "placement": "wall"
      }
    ]
  },
  "canal-final": {
    "arrival": "The silent town bell hangs above a screen of dark route lights. A loose wire leads from the listening dish to the bell. The group has found the missing return connection.",
    "stories": {
      "nell": "There’s the fault. The bell could send messages, but that loose return wire kept it from hearing replies. So it stopped the routes because it couldn’t check whether messages and deliveries arrived safely.",
      "iris": "The wire needs a firm connection, and the timing needs to match. Our last rhythm will test the repair. Then the bell can hear the islands answer again.",
      "pip": "My bird brought Nell’s undelivered letter home along the old service perches. Those are its old resting places, and its warm carrying clip softened the wax. It was helping us all along!"
    },
    "routes": {
      "nell": "The town door needs a single eighth note, paired sixteenths, a half rest and a quarter rest. This is our last four-beat key.",
      "iris": "The single eighth and paired sixteenths share beat one. The half rest leaves beats two and three silent. The quarter rest leaves beat four silent. That gives the machine time to listen.",
      "pip": "Use a single eighth, paired sixteenths, half rest, then quarter rest. We’ve followed the broken connection to its end, so let’s hear a real answer from those lights."
    },
    "inventory": {
      "nell": "Four tiles, one last lock. There aren’t any extra notes to collect at the tower. Mira, stay with us. We can admire the lights once the bell works.",
      "iris": "Our short-note tiles and two rests fill exactly four beats. The final door will use every tile left in the bag.",
      "pip": "Four beats left, and one last lock. I’ve counted twice. I’d like everyone to stay right beside me while it opens, please."
    },
    "demos": {
      "nell": "canal-ending",
      "iris": "canal-ending",
      "pip": "canal-ending"
    },
    "title": "The Evening Tower",
    "inspections": [
      {
        "id": "canal-final-route-lamps",
        "title": "The waiting lamps",
        "label": "Inspect the waiting lamps",
        "text": "Each light marks a place that should send a reply. Most are dark because the bell cannot hear their messages.",
        "placement": "left"
      },
      {
        "id": "canal-final-keeper-flask",
        "title": "The keeper’s flask",
        "label": "Inspect the keeper’s flask",
        "text": "The keeper left a drink beside the controls. Someone kept watching the dark lights instead of giving up.",
        "placement": "right"
      },
      {
        "id": "canal-final-reply-dish",
        "title": "The reply dish",
        "label": "Inspect the reply dish",
        "text": "This dish receives messages from the islands. Its loose return wire should carry those replies back to the bell.",
        "placement": "wall"
      }
    ]
  },
  "garden-alcove": {
    "arrival": "A flower is carved into a loose stone. Beneath it, roots protect an old music box. Someone has kept the lid clear so it can still be opened.",
    "stories": {
      "nell": "That flower marks an old repair hatch. People used this path before the newer garden was built, so a mail bird could still follow these little forgotten stops.",
      "iris": "I came here with my friend when we were younger. I brushed away the leaves, but I never lifted this stone alone. The smooth petal’s a handle. Let’s look beneath it together.",
      "pip": "My bird’s listening beside that loose petal. It seems to remember this place, but I’d rather lift the lid with you than guess what’s inside."
    },
    "routes": {
      "nell": "Inspect the flower stone, then choose Search beneath the flower stone. Its four tiles open the gate they reveal: quarter, two eighths, four sixteenths, quarter rest.",
      "iris": "Search under the stone. Use the new quarter note, two eighth notes, four sixteenths and quarter rest at the flower gate. Keep our original dotted half and quarter for later.",
      "pip": "The music box hides four new one-beat tiles: quarter, two eighths, four sixteenths, quarter rest. Search first, or we won’t have a gate to knock on."
    },
    "inventory": {
      "nell": "We brought a dotted half and a quarter for the final door. The stone has a separate four-beat supply. Its new notes pay this gate, so keep our original pair.",
      "iris": "Just looking at the box won’t give us tiles. Choose Search to collect them once. This gate uses those new tiles, so keep the pair we brought here.",
      "pip": "We can collect the hidden notes once, but talking about them won’t fill the bag. We still need our dotted half and quarter after this gate."
    },
    "demos": {
      "nell": "garden-hidden-exit",
      "iris": "garden-hidden-exit",
      "pip": "garden-hidden-exit"
    },
    "title": "The Overgrown Music Box",
    "inspections": [
      {
        "id": "garden-alcove-cleared-patch",
        "title": "The cleared patch",
        "label": "Inspect the cleared patch",
        "text": "Someone moved the wet leaves away from this dry patch beside the stone.",
        "placement": "wall"
      },
      {
        "id": "garden-alcove-root-cradle",
        "title": "The roots around the box",
        "label": "Inspect roots around the box",
        "text": "The roots curve around the music box. They leave enough space for its lid to open.",
        "placement": "right"
      },
      {
        "id": "garden-alcove-flower-stone",
        "title": "The flower stone",
        "label": "Inspect the flower stone",
        "text": "One flower petal has a smooth grip. A seam runs around the stone lid. Choose Search beneath the flower stone to look inside.",
        "placement": "left",
        "sourceId": "garden-hidden-notes",
        "sourceLabel": "Search beneath the flower stone"
      }
    ]
  },
  "workshop-alcove": {
    "arrival": "Old bird wraps fill this quiet attic. A hollow perch stands beside a little cleaning brush. One side of the perch rings when tapped; the other stays quiet.",
    "stories": {
      "nell": "These straps belonged to mail birds long before Pip looked after them. The old route still has places to rest, so a bird could travel while the main system was stuck.",
      "iris": "Someone’s kept these old perches clean, so a small reply route might still work here. Let’s inspect it. A silent machine isn’t always a broken one.",
      "pip": "I made that brush to clean the hollow perch, but I never opened the cover between its two sides. That was sensible of me. Let’s open it together."
    },
    "routes": {
      "nell": "Inspect the two-sided perch, then choose Search the hollow perch. Its half note followed by a half rest opens the brass gate. Save the dotted half and quarter for the final door.",
      "iris": "The half note sounds for two beats. The half rest leaves two beats silent. Search for those two tiles, then use them in that order at the gate.",
      "pip": "Search inside the perch first. Play its half note, then its half rest. Sound first, silence second. Our original dotted half and quarter must stay in the bag."
    },
    "inventory": {
      "nell": "The two tiles inside the perch pay this hidden gate. We still need our dotted half and quarter after it, so keep those two safe.",
      "iris": "The wraps and brush give no notes. Only Search the hollow perch collects the half note and half rest. The search works once per run.",
      "pip": "I can point to the cover, but I can’t give you its notes just by talking. Search it once, use its two tiles here, and save our original pair."
    },
    "demos": {
      "nell": "workshop-hidden-exit",
      "iris": "workshop-hidden-exit",
      "pip": "workshop-hidden-exit"
    },
    "title": "The Birds’ Dusty Attic",
    "inspections": [
      {
        "id": "workshop-alcove-wing-wraps",
        "title": "The folded wing wraps",
        "label": "Inspect the folded wing wraps",
        "text": "Each soft wrap was repaired to fit a different small bird’s wing.",
        "placement": "wall"
      },
      {
        "id": "workshop-alcove-roost-marks",
        "title": "The old roost marks",
        "label": "Inspect the old roost marks",
        "text": "Small claw marks show where generations of birds landed on the rail.",
        "placement": "right"
      },
      {
        "id": "workshop-alcove-hollow-perch",
        "title": "The two-sided perch",
        "label": "Inspect the two-sided perch",
        "text": "A small cover closes a space inside this perch. Tap one side for sound and the other for silence, or choose Search the hollow perch.",
        "placement": "left",
        "sourceId": "workshop-hidden-notes",
        "sourceLabel": "Search the hollow perch"
      }
    ]
  },
  "garden-secret-final": {
    "arrival": "Two sets of music controls face a window that can carry sound. One chair has been kept ready for Iris’s friend, who lives on another island.",
    "stories": {
      "nell": "The town bell lost its replies because of a loose return connection. This older window has its own connection, so we can fix it and help Iris reach her friend.",
      "iris": "My friend moved to another island. We used to play music here together, and I kept her chair ready. But the broken listening connection stopped our calls. I want to hear that she’s all right.",
      "pip": "The bird’s warm carrying clip explains the soft wax on Nell’s letter. It used old perches like these to bring the letter home, so maybe this old window can carry a reply too."
    },
    "routes": {
      "nell": "The unfinished-song door needs our saved dotted half, then our quarter. We’ve already used the music box’s new notes at its gate, so these are our final two tiles.",
      "iris": "Play a dotted half note for three beats, then a quarter note for one. We only need our saved pair. We don’t need to play my friend’s part for her.",
      "pip": "Dotted half, then quarter. We kept both through the old garden. They make the last four beats of this path."
    },
    "inventory": {
      "nell": "Only the dotted half and quarter remain. They came from our original note bag. This last door uses both.",
      "iris": "The music box gave us notes for its own gate, and we’ve already spent those. Our two saved tiles finish this route and leave the bag empty.",
      "pip": "There aren’t any new notes in the chair or the window. We saved this pair for a reason, and I’m very relieved we still have it."
    },
    "demos": {
      "nell": "garden-secret-ending",
      "iris": "garden-secret-ending",
      "pip": "garden-secret-ending"
    },
    "title": "The Reserved Room",
    "inspections": [
      {
        "id": "garden-secret-final-chair",
        "title": "Iris’s friend’s chair",
        "label": "Inspect Iris’s friend’s chair",
        "text": "Iris has cleaned the chair and repaired its cushion. Her friend can sit here when she visits from the other island.",
        "placement": "left"
      },
      {
        "id": "garden-secret-final-second-controls",
        "title": "The second controls",
        "label": "Inspect the second controls",
        "text": "Two people used these controls to play music together. Each set has room for its own tune.",
        "placement": "right"
      },
      {
        "id": "garden-secret-final-open-window",
        "title": "The listening window",
        "label": "Inspect the listening window",
        "text": "This window carries sound between islands. Its listening connection needs repair so Iris can hear her friend answer.",
        "placement": "wall"
      }
    ]
  },
  "workshop-secret-final": {
    "arrival": "A bird-sized horn stands beside the larger message horn. A little step lets a mail bird reach its controls. The screen shows two different tunes.",
    "stories": {
      "nell": "The big message system stopped because its return connection came loose. But the birds kept using their older service route, and one brought my letter home along those perches.",
      "iris": "Pip, a different tune isn’t a broken one. A countermelody is a second tune played beside the first. This little horn lets a bird send its own tune back, so we can fix its reply route without fixing the whole town bell.",
      "pip": "I thought the birds were copying my tune badly, but they were answering with a different tune! Their warm carrying clips explain the soft wax too. I should’ve listened before tightening their compasses."
    },
    "routes": {
      "nell": "The birds’ answer door needs our saved dotted half, then our quarter. Keep that order. These two tiles make the final four beats.",
      "iris": "Play the dotted half for three beats and the quarter for one. We’ve already used the perch’s half note and half rest at their gate.",
      "pip": "Dotted half, quarter. We carried them all this way. Then I can listen to the birds instead of telling them which tune to sing."
    },
    "inventory": {
      "nell": "We’ve got exactly two tiles: dotted half and quarter. There isn’t a hidden gift inside this horn, and this door uses both tiles.",
      "iris": "The perch supplied the notes for its gate only. The two tiles we saved at the workshop fork pay the final door.",
      "pip": "The horn gives the birds a voice, not more note tiles. Use our saved pair, and the bag will be empty."
    },
    "demos": {
      "nell": "workshop-secret-ending",
      "iris": "workshop-secret-ending",
      "pip": "workshop-secret-ending"
    },
    "title": "The Hidden Countermelody",
    "inspections": [
      {
        "id": "workshop-secret-final-small-horn",
        "title": "The smaller horn",
        "label": "Inspect the smaller horn",
        "text": "The small horn is worn inside its rim. A bird has been trying to sing its own reply into it.",
        "placement": "left"
      },
      {
        "id": "workshop-secret-final-small-step",
        "title": "The bird-sized step",
        "label": "Inspect bird-sized step",
        "text": "This hand-built step raises a small bird high enough to reach the old control.",
        "placement": "right"
      },
      {
        "id": "workshop-secret-final-two-traces",
        "title": "The two tunes on the screen",
        "label": "Inspect two tunes on the screen",
        "text": "The screen shows two different tunes. They share a pause, but neither tune has to copy the other.",
        "placement": "wall"
      }
    ]
  }
};
const OUTCOME_ROOMS={
  "ending-home": {
    "id": "ending-home",
    "title": "A Place to Come Home",
    "arrival": "A kitchen chime rings, and another answers across the courtyard. The garden’s water controls are working again. The neighbors set four cups on the table for their visitors.",
    "stories": {
      "nell": "We fixed this neighborhood’s return wire, so the homes can request water and confirm deliveries again. The town bell still needs help, but these families have their own working connection now.",
      "iris": "The bell’s loose return connection caused the trouble, but the mail bird used old service perches to avoid it. Its warm carrying clip softened the letter’s wax. The evidence fits, and we can water the garden.",
      "pip": "I thought that warm letter meant something scary, but my bird was just bringing Nell’s undelivered letter home! Now the kitchens can answer each other. I’d like to answer that invitation to supper."
    },
    "routes": {
      "nell": "This route is complete. Explore the courtyard, revisit our last choice, or start a new journey. There are other ways to help the town.",
      "iris": "There aren’t any more locks here. We’ve repaired the neighborhood’s connection, but another journey could reach a different part of the broken system.",
      "pip": "No more doors on this path. I want to hear the little chimes before we try another route. That one sounds like a spoon!"
    },
    "inventory": {
      "nell": "We’ve used every tile from my note bag. The returned letter was a separate mystery, and it was never one of our door keys.",
      "iris": "The bag’s empty because we paid every lock on this route. There isn’t a missing tile or one last payment to collect.",
      "pip": "No note tiles left. We used the whole set. The neighbors have cups for us, which is a much better thing to put on this table."
    },
    "inspections": [
      {
        "id": "ending-home-memory",
        "title": "The common table",
        "label": "Inspect the common table",
        "text": "Four cups and a loaf wait on the shared table. The neighbors can welcome visitors while their working chimes carry messages.",
        "placement": "left"
      },
      {
        "id": "ending-home-reply",
        "title": "The kitchen chimes",
        "label": "Inspect the kitchen chimes",
        "text": "Spoons, shells and brass pieces make different chime sounds. Repaired copper wires let the homes send replies to one another again.",
        "placement": "right"
      },
      {
        "id": "ending-home-trace",
        "title": "The working reply switch",
        "label": "Inspect working reply switch",
        "text": "The small bell’s repaired return wire now carries replies. The garden’s water control light changes when a home asks for water.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "ending",
      "kicker": "The neighborhood answers again",
      "copy": "The town bell stopped hearing replies because its return connection was loose. An old mail bird brought Nell’s undelivered letter home through forgotten service perches. Its warm carrying clip softened the wax. Mira’s group repaired the neighborhood’s smaller return connection and tested it with their final rhythm. These homes can confirm deliveries and request garden water again. The town bell still needs repair, but this neighborhood has a working way to answer. Every note tile has been used."
    }
  },
  "ending-school": {
    "id": "ending-school",
    "title": "The Open Music Room",
    "arrival": "The music machine plays a short call, then waits. A learner answers from the circle of stools. The repaired connection carries that answer back, and the next practice round begins.",
    "stories": {
      "nell": "The classroom can hear its learners again, so people can practice music and teach each other repairs. We fixed this local connection, but the larger town system still needs help.",
      "iris": "The loose return connection caused the town’s missing replies. The bird used older perches to return Nell’s letter, and its warm metal clip softened the wax. We solved that mystery and fixed this classroom’s reply link.",
      "pip": "Now a learner can try a rhythm and hear an answer, so they won’t have to wonder whether the machine heard them. I’ll leave my wing repair tool here for the next class."
    },
    "routes": {
      "nell": "This route ends at the shared music room. Explore it, revisit the last choice, or start another journey to help somewhere else.",
      "iris": "There’s no next lock here. The class connection works, and we’ve finished this route. Other routes can help other parts of town.",
      "pip": "We finished this path. I want to hear the next learner’s answer before we leave. Then maybe we can find another place that needs us."
    },
    "inventory": {
      "nell": "We’ve spent all the tiles from our note bag. The music-room door used our final four-beat rhythm, so we don’t need another gift.",
      "iris": "The bag is empty. Every note tile paid a lock on this route. The working music room asks for no more tiles.",
      "pip": "There aren’t any spare tiles because we used them all. We didn’t lose any, but I checked under my stool, just in case."
    },
    "inspections": [
      {
        "id": "ending-school-memory",
        "title": "The smallest stool",
        "label": "Inspect the smallest stool",
        "text": "A low stool and a longer handle let a smaller learner reach the controls. Someone made the machine easier to use.",
        "placement": "left"
      },
      {
        "id": "ending-school-reply",
        "title": "The listening circle",
        "label": "Inspect the listening circle",
        "text": "The stools face one another. Each learner can see who is playing and wait for their turn to answer.",
        "placement": "right"
      },
      {
        "id": "ending-school-trace",
        "title": "The shared repair shelf",
        "label": "Inspect the shared repair shelf",
        "text": "A partly repaired bird wing waits beside clean tools. The next class can finish the repair and learn how it works.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "ending",
      "kicker": "A working music room for everyone",
      "copy": "A loose return connection kept the town bell from hearing replies. A mail bird brought Nell’s undelivered letter home along old service perches. Its warm carrying clip softened the wax. Mira’s group repaired the music room’s local reply connection and tested it with their final rhythm. Learners can hear one another, practice together and share repair skills again. The main town connection still needs help. Every note tile has been used to reach this working classroom."
    }
  },
  "ending-public": {
    "id": "ending-public",
    "title": "The Evening Bell",
    "arrival": "The public bell rings above the terrace. One route light answers, then another. The water clock releases its waiting drop, and the ferry landing sends its safe-arrival signal.",
    "stories": {
      "nell": "The return wire’s connected, and the timing’s right. The bell can hear replies again, so deliveries can be confirmed and gardens can request water. Ferries can check that their landings are ready too. Yes, Mira, now you can wave at the lights.",
      "iris": "One loose connection stopped the whole town from hearing its answers, but we followed the evidence and fixed it. Those returning lights show that our final test worked.",
      "pip": "My bird brought the letter home on old service perches, and its warm clip softened the wax. It wasn’t a ghost letter! Now the birds can wait for safe-landing lights before they take off."
    },
    "routes": {
      "nell": "This route is complete. We can watch the town’s replies, revisit our last choice, or begin a new journey to discover another outcome.",
      "iris": "There’s no next gate here. We fixed the public bell’s return connection, but other routes might show us people and places we missed.",
      "pip": "The tower path ends here. Let’s watch the last light answer. Then I’d like to try a route with fewer tall stairs."
    },
    "inventory": {
      "nell": "Our note bag is empty. The tower’s final rhythm used the last tiles. The returned letter and our note supply were separate all along.",
      "iris": "We’ve used every note tile. The route lights don’t need another payment. They show messages going out and replies coming back.",
      "pip": "No notes left in the bag. We carried exactly enough for this route. This time, the bell can hear the answer after we stop playing."
    },
    "inspections": [
      {
        "id": "ending-public-memory",
        "title": "The keeper’s bench",
        "label": "Inspect the keeper’s bench",
        "text": "A coat and drink wait beside the controls. The keeper can watch the returning route lights from this bench.",
        "placement": "left"
      },
      {
        "id": "ending-public-reply",
        "title": "The receiving dish",
        "label": "Inspect the receiving dish",
        "text": "The dish receives the islands’ reply signals. Its repaired wire carries each answer back to the town bell.",
        "placement": "right"
      },
      {
        "id": "ending-public-trace",
        "title": "The evening route lamps",
        "label": "Inspect the evening route lamps",
        "text": "Lights turn on when a message arrives safely. Separate wires carry signals outward and bring the replies back.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "ending",
      "kicker": "The whole town can answer",
      "copy": "The loose return connection kept the public bell from hearing replies. That stopped deliveries, garden water controls and safe ferry checks. A mail bird brought Nell’s undelivered letter home by using forgotten service perches. Its warm carrying clip softened the wax. Mira’s group reconnected the main return wire and tested its timing with their final rhythm. Replies now reach the bell from across the town. The public network works again, and every note tile has been used."
    }
  },
  "ending-secret-quiet": {
    "id": "ending-secret-quiet",
    "title": "The Reserved Silence",
    "arrival": "The repaired listening window crackles, then carries a familiar voice. Iris’s friend answers from another island. Iris sits beside the clean, empty chair and begins planning their next visit.",
    "stories": {
      "nell": "We found out why the town lost its replies, and we fixed this smaller listening connection. Iris can reach her friend again. The public bell still needs work, but their calls don’t have to wait.",
      "iris": "She’s safe on the other island, and I can hear her clearly now. I kept this chair ready for her visits. Now we can plan the next one instead of guessing why she never answered.",
      "pip": "The bird used old perches to return Nell’s letter, and its warm clip softened the wax. Now this old window’s brought back a voice too. I’m glad we saved the right notes."
    },
    "routes": {
      "nell": "This is the end of the hidden garden route. Listen, explore, revisit the last choice, or begin a new journey. No more locks wait here.",
      "iris": "The listening connection works, and there’s no next door on this route. I’d like to finish talking with my friend before we leave.",
      "pip": "We’ve finished the secret garden path, so we can try another route later. For now, I’ll sit very quietly and keep my hands away from the controls."
    },
    "inventory": {
      "nell": "Our saved dotted half and quarter paid the last door, so we’ve used every original tile and every hidden tile. The note bag’s empty.",
      "iris": "We saved two tiles for this final lock. We spent the hidden music-box tiles on their own gate. No note tile was wasted or left behind.",
      "pip": "We used the notes we brought and the notes we found. The bag is empty. I can stop checking it every few steps now."
    },
    "inspections": [
      {
        "id": "ending-secret-quiet-memory",
        "title": "Iris’s friend’s chair",
        "label": "Inspect Iris’s friend’s chair",
        "text": "Iris cleaned this chair and repaired its cushion. Her friend has a place to sit when she visits from the other island.",
        "placement": "left"
      },
      {
        "id": "ending-secret-quiet-reply",
        "title": "The unplayed instrument",
        "label": "Inspect the unplayed instrument",
        "text": "Iris and her friend each have their own music controls. The repaired connection lets them hear and answer each other.",
        "placement": "right"
      },
      {
        "id": "ending-secret-quiet-trace",
        "title": "The open listening window",
        "label": "Inspect the open listening window",
        "text": "The listening window carries Iris’s friend’s voice from another island. A repaired return wire now brings her replies through clearly.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "secret-ending",
      "kicker": "Iris hears her friend again",
      "copy": "The town bell lost its replies because its return connection was loose. A mail bird used old service perches to bring Nell’s undelivered letter home. Its warm carrying clip softened the wax. Mira’s group repaired a separate listening connection hidden in the garden. Iris hears her friend answer from another island: she is alive and safe. They can play music together again and plan a visit. The public bell still needs repair, but this friendship has a working connection. Every note tile has been used."
    }
  },
  "ending-secret-birds": {
    "id": "ending-secret-birds",
    "title": "The Birds’ Countermelody",
    "arrival": "A small mail bird steps up to its own horn. It plays a new tune beside Pip’s tune. The repaired screen shows both answers traveling along the old bird route.",
    "stories": {
      "nell": "The birds can send their own replies now. This little route works, but the town bell still needs repair. We need to listen to their new tunes instead of calling them mistakes.",
      "iris": "The public bell lost its return connection, but the birds used older perches. That’s how Nell’s letter came home. The warm clip explains the wax, and we’ve fixed the birds’ own reply connection here.",
      "pip": "It wasn’t forgetting my tune. It had another tune to add! I kept tightening its compass when it turned here, but next time I’ll follow it and listen before I fetch my tools."
    },
    "routes": {
      "nell": "This hidden workshop route is complete. Listen to the birds, revisit our last choice, or start a new journey. There aren’t any more locks here.",
      "iris": "The small reply route works, and we’ve reached its last room. Other journeys can help the public bell or the families who use it.",
      "pip": "We found the birds’ answer room, and I want to hear the whole tune before we leave. It’s much better than another compass repair."
    },
    "inventory": {
      "nell": "Our saved dotted half and quarter opened the last door, so we’ve used every tile from the note bag and the hidden perch.",
      "iris": "There are no spare note tiles. The perch’s two hidden tiles paid their gate. Our saved original pair paid this final lock.",
      "pip": "The bag’s empty, but the birds aren’t asking for another tile. They’ve already got their own tune to play."
    },
    "inspections": [
      {
        "id": "ending-secret-birds-memory",
        "title": "The bird-sized step",
        "label": "Inspect bird-sized step",
        "text": "A little step lets a small mail bird reach its controls. Tiny feet have polished the wood smooth.",
        "placement": "left"
      },
      {
        "id": "ending-secret-birds-reply",
        "title": "The answering horn",
        "label": "Inspect the answering horn",
        "text": "The small horn carries the birds’ own answers. Its repaired wire joins the old bird route, separate from the broken town connection.",
        "placement": "right"
      },
      {
        "id": "ending-secret-birds-trace",
        "title": "The two tunes on the screen",
        "label": "Inspect two tunes on the screen",
        "text": "The screen shows two different tunes playing together. The birds’ tune answers Pip’s tune without copying it.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "secret-ending",
      "kicker": "The mail birds have their own reply",
      "copy": "A loose return connection stopped the public bell from hearing replies. A mail bird still reached Nell by using forgotten service perches. Its warm carrying clip softened the wax on her returned letter. Mira’s group repaired the birds’ smaller reply route and opened controls they could reach. Pip learns that their different tunes were answers, not mistakes. The birds can now send their own music. The public bell still needs repair. Every note tile has been used."
    }
  },
  "dead-brambles": {
    "id": "dead-brambles",
    "title": "The Overgrown Arch",
    "arrival": "Thick roots fill the far arch. A cup catches rain beside a dry bench. The party can rest here, but there is no safe gap through the roots.",
    "stories": {
      "nell": "This path used to carry deliveries, but now the roots block it. We can get our door-key notes back and return to Iris’s listening gate. At least we know which way’s closed.",
      "iris": "I cleared the bench, but I couldn’t safely clear the arch. These roots help hold the stones in place, so the other gate on my porch is our way forward.",
      "pip": "My bird won’t try that gap because its wings would scrape both sides. I agree with the bird. Let’s go back to the gate Iris knows."
    },
    "routes": {
      "nell": "There’s no way forward here, but Revisit previous choice gives back the notes we spent on the arch. Then choose the listening gate on Iris’s porch.",
      "iris": "Revisit this choice, then use a half note, then a half rest at my listening gate. The roots don’t hide another path.",
      "pip": "Revisit the last door and take the listening gate instead. We can rest here first. Going back is allowed, and the notes can come back too."
    },
    "inventory": {
      "nell": "Any unspent tiles are still in our note bag. Revisit the last choice to get the door’s payment back. We haven’t lost any notes.",
      "iris": "Revisit the arch to recover its dotted half and quarter. Then keep our tiles together while we choose the other gate.",
      "pip": "We can’t use our remaining notes on another door here, but choosing Revisit previous choice brings back what the arch took. I’ll count them with you."
    },
    "inspections": [
      {
        "id": "dead-brambles-memory",
        "title": "The rain cup",
        "label": "Inspect the rain cup",
        "text": "A repaired cup catches the roof leak. Someone moved it so the bench would stay dry.",
        "placement": "left"
      },
      {
        "id": "dead-brambles-reply",
        "title": "The resting bench",
        "label": "Inspect the resting bench",
        "text": "The bench is clean, though moss covers the closed path. Someone still cares for this resting place.",
        "placement": "right"
      },
      {
        "id": "dead-brambles-trace",
        "title": "The root-filled arch",
        "label": "Inspect the root-filled arch",
        "text": "Thick roots hold the old stones together. There is no safe opening for the party behind them.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "dead-end",
      "kicker": "The roots block this path",
      "copy": "This arch reaches a resting place, but thick roots close the way forward. The party is not trapped. Use Revisit previous choice to recover the notes spent on this door. Return to Iris’s porch and choose her listening gate: half note, then half rest.",
      "repair": "Return to Iris’s porch, collect her notes if needed, and try the listening gate."
    }
  },
  "dead-aviary": {
    "id": "dead-aviary",
    "title": "The Silent Aviary",
    "arrival": "Sunlight falls on a bird’s nest between empty perches. The back wall is sealed with stone. This old bird room is a safe resting place, but it has no onward path.",
    "stories": {
      "nell": "Someone closed this old bird route and took down its departure hooks. The birds can rest here, but we can’t travel through. Let’s return to the workshop. We won’t lose our notes.",
      "iris": "The sun still warms the nest, so this room’s useful even with its passage closed. Pip’s running gate is our way forward.",
      "pip": "I brought that clean wing wrap last week. The bird likes the warm patch, but there’s no opening behind the perches. We need the other gate at my workshop."
    },
    "routes": {
      "nell": "Revisit the last choice to recover this door’s notes. Then choose the workshop’s running gate. This room has no secret passage behind its wall.",
      "iris": "Revisit this choice and return to Pip’s workshop. His running rhythm opens the working gate. We’ve checked this wall, and there’s no way through.",
      "pip": "Revisit this door, then take my gift if it’s still waiting. The running gate needs a half note, two eighth notes, then four sixteenth notes."
    },
    "inventory": {
      "nell": "Our unspent tiles remain in the note bag. Revisit this door to recover its payment before choosing the working route.",
      "iris": "A dead end can leave tiles in the bag. Revisit the last choice to recover the notes we spent here. We can use them on another path.",
      "pip": "Revisit this answer to get its key notes back. The empty perches don’t give new notes, but my workshop gift can help if we haven’t collected it."
    },
    "inspections": [
      {
        "id": "dead-aviary-memory",
        "title": "The sunlit nest",
        "label": "Inspect the sunlit nest",
        "text": "Fresh felt lines this warm nest. A small bird can rest here safely while its wing is repaired.",
        "placement": "left"
      },
      {
        "id": "dead-aviary-reply",
        "title": "The folded wing wrap",
        "label": "Inspect the folded wing wrap",
        "text": "Pip made this soft wrap wide enough to close without bending a bird’s wing.",
        "placement": "right"
      },
      {
        "id": "dead-aviary-trace",
        "title": "The sealed service wall",
        "label": "Inspect the sealed service wall",
        "text": "The stone panel has no hinges or latch. The old route wire is disconnected. No passage continues through this wall.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "dead-end",
      "kicker": "A resting place, with no way onward",
      "copy": "The old bird room has a sealed back wall. It offers a safe place to rest, but no path forward. Use Revisit previous choice to recover the notes spent here. Return to Pip’s workshop and open the running gate with a half note, two eighth notes and four sixteenth notes.",
      "repair": "Return to Pip’s workshop, collect his notes if needed, and try the workshop gate."
    }
  },
  "dead-ferry": {
    "id": "dead-ferry",
    "title": "The Empty Ferry",
    "arrival": "The landing has a boarding rope, but no ferry. Oren left a tea tray for waiting travelers. The lamp still glows, though there is no boat to send a reply.",
    "stories": {
      "nell": "This old ferry doesn’t stop here anymore, and its rope can’t carry us across. We can get our notes back and return to the storehouse’s delivery gate.",
      "iris": "Pip, the lamp’s working. That tells us it has power, not that there’s a boat. There isn’t, so we need the delivery gate.",
      "pip": "I could send a bird across to look, but it couldn’t carry all four of us. Let’s go back to the stamped chest. I’d rather have a floor under my feet."
    },
    "routes": {
      "nell": "Revisit this choice to recover the boarding door’s notes. Then take the storehouse’s delivery gate. There’s no ferry or hidden crossing here.",
      "iris": "Revisit the boarding choice. Open the stamped chest in the storehouse if it’s still closed. Its notes pay the working delivery gate.",
      "pip": "Revisit this choice and use the delivery gate instead. Its key is a half note, a quarter note, then two eighth notes. The stamped chest supplies that rhythm."
    },
    "inventory": {
      "nell": "Our unspent notes are still in the bag. Revisit this door to get its payment back, and collect the stamped chest’s gift if we haven’t already.",
      "iris": "Revisit the last choice to get the spent notes back. We reached a blocked route, but we didn’t lose our supply. We can try the other gate.",
      "pip": "Revisit this choice to recover the dotted half and four-sixteenth group. The tea tray has no note tiles. I checked politely."
    },
    "inspections": [
      {
        "id": "dead-ferry-memory",
        "title": "The waiting tea tray",
        "label": "Inspect the waiting tea tray",
        "text": "Two cups wait under a dry cloth. Oren has cared for this landing even though the ferry no longer comes.",
        "placement": "left"
      },
      {
        "id": "dead-ferry-reply",
        "title": "The boarding rope",
        "label": "Inspect the boarding rope",
        "text": "The loose rope marks where passengers once boarded. It is not a bridge, and it cannot carry the party across.",
        "placement": "right"
      },
      {
        "id": "dead-ferry-trace",
        "title": "The unused landing lamp",
        "label": "Inspect the unused landing lamp",
        "text": "The lamp still has local power. No boat sends a safe-arrival reply from the empty landing.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "dead-end",
      "kicker": "There is no ferry here",
      "copy": "The old landing has no ferry and no other crossing. The glowing lamp cannot carry the party over the water. Use Revisit previous choice to recover the notes spent here. Back at the storehouse, open the stamped chest and take the delivery gate: half note, quarter note, then two eighth notes.",
      "repair": "Return to the canal storehouse, open the stamped chest, and try the delivery door."
    }
  },
  "dead-echo": {
    "id": "dead-echo",
    "title": "The Copied Waterway",
    "arrival": "The water reflects every movement of the clock. The channel ends at a stone wall. Its echo repeats a signal, but no real reply reaches the dry water bowl.",
    "stories": {
      "nell": "We followed a copy of the clock’s signal, but it never reached another place. Revisit this choice and take the town-bell stair. The map did warn us about that wall.",
      "iris": "An echo repeats a sound, but it can’t tell us somebody received a message. The bell needs a separate reply, and this channel can’t give it one.",
      "pip": "That line repeats every movement exactly, but a real bird changes its answer when another bird calls. This is just a copy. Let’s go back to the stairs."
    },
    "routes": {
      "nell": "Revisit the last rhythm to get its notes back. Then take the water clock’s town-bell stair. This channel just ends at solid stone.",
      "iris": "Revisit this choice and take the stair. Its key is a dotted half note followed by four sixteenth notes. There’s no passage through this wall.",
      "pip": "Revisit the water clock and take its town-bell stair. The reflection doesn’t hide another lock, and I’d like to stop staring at it now."
    },
    "inventory": {
      "nell": "We still have our remaining tiles. Revisit this paid choice to get its notes back before we climb toward the bell.",
      "iris": "Revisit the last answer to get back what we spent here. We’ll need that key and the notes still in the bag for the other route.",
      "pip": "Revisit this door to recover the single eighth, paired sixteenths, half rest and quarter rest. No tile vanished into the reflection."
    },
    "inspections": [
      {
        "id": "dead-echo-memory",
        "title": "The dry return bowl",
        "label": "Inspect the dry return bowl",
        "text": "The bowl is dry. A real reply would release a drop here, but the reflected signal never returns one.",
        "placement": "left"
      },
      {
        "id": "dead-echo-reply",
        "title": "The reflected clock face",
        "label": "Inspect the reflected clock face",
        "text": "The water copies the clock hands and even the scratch on its glass. It makes no new reply of its own.",
        "placement": "right"
      },
      {
        "id": "dead-echo-trace",
        "title": "The marked stone end",
        "label": "Inspect the marked stone end",
        "text": "A repair mark points to the solid wall. The channel stops here, with no doorway or hidden tunnel behind it.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "dead-end",
      "kicker": "An echo cannot answer for the town",
      "copy": "The copied channel ends at a stone wall. An echo can repeat the clock’s signal, but it cannot confirm that a message arrived. Use Revisit previous choice to recover the notes spent here. Take the water clock’s town-bell stair instead: dotted half note, then four sixteenth notes.",
      "repair": "Return to the water clock and choose the stair leading to the town bell."
    }
  }
};
export const CAMPAIGN_ART_BRIEFS=freeze({
  "garden-fork": "A jade communal growing court with two root paths, a shared repaired watering can, a buried old paving ring, and listening wind cups.",
  "workshop-fork": "A teal apprentice exchange beneath a suspended demonstration bird, a shared repair shelf, old back handrail, and phosphor sound screen.",
  "canal-fork": "An indigo public water clock holding silver drops over a dry answer bowl, a keeper’s service stool, and an honest maintenance map of the blocked copied channel.",
  "garden-final": "An amber neighbourhood hall where a small hearth bell hangs in a huge old relay, with an extra warm place, useful kitchen relay, and mended clapper.",
  "workshop-final": "A cream and teal teaching room built around a circular star navigator made into a listening ring, with low controls and repaired practice cloths.",
  "canal-final": "A deep indigo evening tower with a great silent bell, waiting route lamps, a keeper’s small flask shelf and outward receiving dish overlooking inhabited islands.",
  "garden-alcove": "A moss-root service nook with a loose flower-carved stone, a carefully cleared patch, and a music box cradled by living roots.",
  "workshop-alcove": "A dusty teal courier attic with old wing wraps, generations of roost marks, and a hollow two-sided perch whose halves sound differently.",
  "garden-secret-final": "A soft jade private listening room with a maintained empty chair, two worn sets of controls and a receiving window kept open to the garden.",
  "workshop-secret-final": "A deep teal reply chamber with a smaller answering horn behind the public horn, a bird-sized service step and two distinct phosphor sound traces.",
  "ending-home": "An amber shared courtyard at dusk, open kitchen windows and answering household chimes, common table with four cups and restored small hearth relay.",
  "ending-school": "A sunlit cream and teal rehearsal commons, low stools around a shared listening instrument, child-sized lever and communal repair shelf.",
  "ending-public": "An indigo and gold public bell terrace with returning route lamps across floating islands, a keeper bench and immense outward receiving dish.",
  "ending-secret-quiet": "A soft jade quiet garden terrace, carefully maintained empty chair, unplayed second instrument and open listening window with fresh water.",
  "ending-secret-birds": "A deep teal courier reply loft with a bird-sized service perch, small answering brass horn and two independently crossing phosphor traces.",
  "dead-brambles": "A rainlit moss court blocked by large living roots, a repaired rain cup keeping a resting bench dry and an old overgrown route mark.",
  "dead-aviary": "A dusty honeylit old aviary with empty perches, a small sunlit bird nest, folded wing cloth and sealed back wall.",
  "dead-ferry": "A pearl and indigo empty sky-canal landing, tied boarding rope reaching still light-water beyond a safe railing, tea tray and unused landing lamp.",
  "dead-echo": "A blue and pearl imitation channel ending at a solid wall, copied clock reflection, dry return bowl and practical keeper maintenance evidence."
});

function doorCopy(roomId){
 return Object.fromEntries(Object.values(DOORS).filter(door=>door.from===roomId).map(door=>{
  const destination=OUTCOME_ROOMS[door.to],copy={name:door.label,hint:door.hint??'Listen to your companions for this door’s ordered four-beat answer.'};
  if(door.warning)copy.warning=door.warning;
  if(destination){copy.deadCopy=destination.outcome.copy;if(destination.outcome.repair)copy.repair=destination.outcome.repair;}
  return [door.id,copy];
 }));
}
function expandedRoom(roomId,descriptor){
 const localDoors=Object.values(DOORS).filter(door=>door.from===roomId);
 const people=MEMBER_IDS.map(id=>({...members.get(id),story:descriptor.stories[id],route:descriptor.routes[id],inventory:descriptor.inventory[id],demo:[...(DOORS[descriptor.demos?.[id]]?.recipe??localDoors[0]?.recipe??[])]}));
 return {title:descriptor.title,arrival:descriptor.arrival,people,inspections:descriptor.inspections,doorCopy:doorCopy(roomId),...(descriptor.outcome?{outcome:descriptor.outcome}:{})};
}
function openingRoom(roomId,room){
 const copies=Object.fromEntries(Object.entries(room.doorCopy).map(([id,copy])=>{
  const updated={...copy};delete updated.previewCopy;return [id,updated];
 }));
 return {...room,people:getRoomPeople(roomId),doorCopy:copies};
}
export const CAMPAIGN_CONTENT=freeze({
 ...Object.fromEntries(Object.entries(ROOM_CONTENT).map(([id,room])=>[id,openingRoom(id,room)])),
 ...Object.fromEntries(Object.entries(NEW_ROOMS).map(([id,room])=>[id,expandedRoom(id,room)])),
 ...Object.fromEntries(Object.entries(OUTCOME_ROOMS).map(([id,room])=>[id,expandedRoom(id,room)])),
});
export const CAMPAIGN_LORE=Object.freeze(Object.values(CAMPAIGN_CONTENT).flatMap(room=>room.inspections));

/** Unknown locations do not silently substitute another room’s story. */
export function getCampaignContent(id){return typeof id==='string'&&Object.hasOwn(CAMPAIGN_CONTENT,id)?CAMPAIGN_CONTENT[id]:null;}
