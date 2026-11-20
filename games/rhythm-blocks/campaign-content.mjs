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
      "nell": "The direct route leaves eight beats for these paths. Extra gates spend that supply, so count our bag before choosing. Each lock needs four beats.",
      "iris": "The hearth path uses a dotted half and a quarter. The old stone path uses the five smaller tiles. Check what the earlier gates left us before choosing.",
      "pip": "The old stone route needs our dotted half and quarter at its end. If we spent them at the overgrown arch, I want to know before we get there."
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
      "nell": "The direct route leaves eight beats for two more doors. There are no new tiles here, so count what we have before choosing.",
      "iris": "A dotted half and quarter make one four-beat key. The two short-note tiles and two rests make the other. Extra gates may have spent one of those keys.",
      "pip": "If we take the back passage, we still need a dotted half and quarter at the end. I hope we kept them. Let’s check instead of hoping."
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
      "iris": "Use a dotted half and four sixteenths at the direct stair. The copied channel takes a single eighth, paired sixteenths, a half rest and a quarter rest, then adds another paid stair.",
      "pip": "The direct stair needs a dotted half and four sixteenths. The copied channel stops at stone, but its service stair reaches the tower for another four beats. I’d count carefully."
    },
    "inventory": {
      "nell": "No new notes are stored here. The direct stair uses the dotted half and four-sixteenth group. Keep the single eighth, paired sixteenths, half rest and quarter rest for the tower.",
      "iris": "The tower’s final lock needs our two short-note tiles and two rests. Paying them to the copied channel doesn’t get them back, even if we find another stair.",
      "pip": "Each paid door keeps its four beats. An extra stair means another payment, and the tower still needs its own key. I’d rather count notes than swim."
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
        "text": "Oren marked the copied channel’s solid northern wall. A southern service stair still reaches the tower, but it adds another four-beat payment. The direct stair needs only one.",
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
      "nell": "The last lock needs four beats, and there are no extra notes at the tower. Mira, check the bag before admiring the lights. An extra service stair may have used our last key.",
      "iris": "The single eighth, paired sixteenths, half rest and quarter rest make this key. If those tiles are gone, we need a new run; the journal will keep what we learned.",
      "pip": "One last four-beat lock, but I’m checking the bag instead of guessing. We can still hear its pattern and remember what to save next time."
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
      "nell": "The final door needs a dotted half and a quarter from Nell’s bag. The flower stone has separate notes for this gate, so searching won’t replace a final key spent earlier.",
      "iris": "Looking gives no tiles. Choose Search to collect the four hidden notes once. They pay this gate, but the next lock still needs the original dotted half and quarter.",
      "pip": "We can collect the hidden notes once, but talking won’t fill the bag. If we spent the final pair at the overgrown arch, this box won’t replace it."
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
      "nell": "The perch’s two tiles pay this hidden gate. The final door still needs a dotted half and quarter, so these hidden notes won’t replace a key spent at the aviary.",
      "iris": "The wraps and brush give no notes. Only Search the hollow perch collects its half note and half rest, once per run. Those tiles pay this gate only.",
      "pip": "Search once for the perch’s two tiles. I’m glad we found them, but Iris is right: the last door still needs the dotted half and quarter from our starting bag."
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
      "nell": "The unfinished-song door needs a dotted half, then a quarter. The music box’s new notes paid its own gate, so we need to have saved these two original tiles.",
      "iris": "Play a dotted half note for three beats, then a quarter note for one. That is the final key. We don’t need to play my friend’s part for her.",
      "pip": "Dotted half, then quarter. That’s the last four beats of this path. If we spent those tiles at the arch, I’ll write down what we need for the next run."
    },
    "inventory": {
      "nell": "This last lock needs the dotted half and quarter from our original bag. The chair and window have no extra tiles. Count what remains before trying it.",
      "iris": "The music box supplied only its own gate. If this final pair was spent at the overgrown arch, the route ends here for this run. The journal will keep the lesson.",
      "pip": "There aren’t any new notes in the chair or window. I want Iris to hear her friend, so next time we’ll keep the right pair all the way here."
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
      "nell": "The birds’ answer door needs a dotted half, then a quarter. Keep that order. Those two original tiles make the final four beats.",
      "iris": "Play the dotted half for three beats and the quarter for one. The perch’s half note and half rest paid their own gate; they cannot pay this one.",
      "pip": "Dotted half, quarter. Those are the tiles this lock needs. I want to hear the birds, but we can’t replace their key with a different four beats."
    },
    "inventory": {
      "nell": "There isn’t a hidden gift inside this horn. The final door needs the original dotted half and quarter, so check whether we kept them.",
      "iris": "The perch supplied its own gate only. Spending the dotted half and quarter at the old aviary leaves nothing to pay this final key.",
      "pip": "The horn gives the birds a voice, not note tiles. If the final pair is gone, we’ll start again and keep the clues about their route."
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
  },
  "final-concourse": {
    "arrival": "Five old service lines meet beneath one wall map. Their controls reach the homes, classroom, public bell, birds’ horn and Iris’s listening window. The journal explains how each one should answer.",
    "stories": {
      "nell": "Starting again reset our note bag and the repairs. Our journal kept what worked and what failed. We can use that knowledge to connect every service during this one trip.",
      "iris": "These old service controls reach the smaller reply connections from here. We know which wire each one needs. The shared return line still needs fastening in the next room.",
      "pip": "The birds’ tiny horn has its own line! We must connect that one too. Getting the big bell working won’t help if nobody hears their own answers. I remembered that part."
    },
    "routes": {
      "nell": "The heart door needs a dotted half note, then four sixteenth notes. Hold three beats, then play four sounds in the last beat. Save the four other tiles for the last door.",
      "iris": "Use a dotted half, then four sixteenths. That fills four beats. Keep the single eighth, paired sixteenths, half rest and quarter rest for the shared return line’s final test.",
      "pip": "I can play the heart door’s example: a dotted half, then four sixteenths. There are no new tiles here. Let’s keep our two short-note tiles and two rests for the last lock."
    },
    "inventory": {
      "nell": "We brought twelve beats from the depot. Its door used four, so eight remain for these two doors. No side trip and no new supply are needed here.",
      "iris": "Our eight remaining beats form two different keys. The dotted half and four-sixteenth group pay this door. The other four tiles must stay in the bag.",
      "pip": "I checked beside the little step: tools, but no note tiles. We already have both keys if we brought Nell’s bag and opened the depot chest. Let’s spend them carefully."
    },
    "demos": {
      "nell": "concourse-heart",
      "iris": "concourse-heart",
      "pip": "concourse-heart"
    },
    "title": "The Meeting of Routes",
    "inspections": [
      {
        "id": "final-concourse-home-board",
        "title": "The household control board",
        "label": "Inspect the household control board",
        "text": "A pump lever and parcel light share this board. Each waits for a reply from a home before sending water or another delivery.",
        "placement": "left"
      },
      {
        "id": "final-concourse-bird-step",
        "title": "The birds’ reply step",
        "label": "Inspect the birds’ reply step",
        "text": "A low wooden step reaches a little horn. Its separate wire lets the mail birds send a tune of their own.",
        "placement": "right"
      },
      {
        "id": "final-concourse-service-map",
        "title": "The five-line service map",
        "label": "Inspect the five-line service map",
        "text": "Five lines join the homes, music room, public bell, birds’ horn and Iris’s window to these controls. The large return wire continues into the next room.",
        "placement": "wall"
      }
    ]
  },
  "final-heart": {
    "arrival": "The five service lines join a loose wire beside the public bell’s controls. A hand clamp can hold the wire in place. The last rhythm will test whether each connected service can send back a reply.",
    "stories": {
      "nell": "We’ve connected the smaller lines from the first room. Now we can fasten this loose return wire and test them together. Water, deliveries and safe ferry checks all depend on the bell hearing their replies.",
      "iris": "The return wire carries answers back to the bell. The last key begins with a quick call, then leaves listening time. We’ll check the classroom, bird horn and my friend’s window as well as the public line.",
      "pip": "If one little lamp stays dark, we’ll notice, won’t we? I’m watching the birds’ line. Iris can watch the window, Nell can check the bell, and Mira spots things the rest of us walk past."
    },
    "routes": {
      "nell": "The final door needs a single eighth note, paired sixteenths, a half rest, then a quarter rest. The two short-note tiles fill beat one, and the rests leave three beats to hear an answer.",
      "iris": "Use a single eighth, paired sixteenths, a half rest and a quarter rest, in that order. The first two tiles share one beat. Two silent beats and one silent beat complete the test.",
      "pip": "I’ll play it: single eighth, paired sixteenths, half rest, quarter rest. We make the quick call first, then listen. Silence is part of the answer, so keep both rest tiles."
    },
    "inventory": {
      "nell": "These last four tiles are all we need. The final door spends every tile left from the depot’s twelve beats. No new gift or hidden supply is waiting in this room.",
      "iris": "Our four tiles fill exactly four beats. No tile is spare, and none is missing. The tools fasten the wire; the note key tests its timing and opens the last door.",
      "pip": "The bag should hold a single eighth, paired sixteenths, a half rest and a quarter rest. I’ve counted twice. When we open this door, we’ll have an empty bag and a real reply to listen for."
    },
    "demos": {
      "nell": "heart-complete",
      "iris": "heart-complete",
      "pip": "heart-complete"
    },
    "title": "The Listening Heart",
    "inspections": [
      {
        "id": "final-heart-return-clamp",
        "title": "The return-wire clamp",
        "label": "Inspect the return-wire clamp",
        "text": "The main return wire has slipped from its socket. A hand clamp holds it firmly, so replies from the smaller service lines can reach the public bell.",
        "placement": "left"
      },
      {
        "id": "final-heart-class-controls",
        "title": "The low practice controls",
        "label": "Inspect the low practice controls",
        "text": "A low stool and extended handles let learners use these controls. Their line reconnects the music room, where people practise rhythms and teach repair skills.",
        "placement": "right"
      },
      {
        "id": "final-heart-reply-screen",
        "title": "The five reply lamps",
        "label": "Inspect the five reply lamps",
        "text": "Five lamps show whether the connected services answer. A small receiver beside Iris’s lamp can carry her friend’s voice from another island.",
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
      "nell": "This route is complete. Explore the courtyard or start a new run with the clues we found. There are other ways to help the town.",
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
      "nell": "This route ends at the shared music room. Explore it, then start another run to help somewhere else. Our journal will remember this route.",
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
      "nell": "This route is complete. We can watch the town’s replies, then begin a new run to discover another outcome. The map keeps our discoveries.",
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
      "nell": "This is the end of the hidden garden route. Listen and explore, or begin a new run with what we learned. No more locks wait here.",
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
      "nell": "This hidden workshop route is complete. Listen to the birds, or start a new run with our discoveries in the journal. There aren’t any more locks here.",
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
    "arrival": "Roots block the northern arch. A dry bench offers a place to think, while the southern garden service gate asks for another four-beat key.",
    "stories": {
      "nell": "The roots still block that arch. The southern service gate reaches the garden paths, but it costs another four beats. The notes we paid to enter are already spent.",
      "iris": "I cleared the bench, not the arch. The roots hold these stones together. A southern service gate remains, but using it won’t replace the dotted half and quarter we spent.",
      "pip": "My bird won’t squeeze through that gap, and neither will I. There’s a service gate to the south, but please count our tiles before we pay for another door."
    },
    "routes": {
      "nell": "The garden service gate is at the southern threshold. It needs a half note, then a half rest, and leads to the Two Garden Paths. That is another four-beat payment.",
      "iris": "Use a half note, then a half rest at the south gate. That costs four beats. The roots hide no free passage, and the notes spent on the arch won’t return.",
      "pip": "The southern service gate needs a half note, then a half rest. Iris’s gift supplied them. If we left it behind, we’ll need a new run—and I’ll ask her before leaving next time."
    },
    "inventory": {
      "nell": "Check for the half note and half rest from Iris’s gift. They pay the southern service gate. The arch already used our dotted half and quarter, which later locks may need.",
      "iris": "The south gate can spend Iris’s gift, but it cannot replace the arch’s key. Note kinds matter, not just the total beats. Our journal can carry this lesson into another run.",
      "pip": "This cup has rainwater, not note tiles. If the south key is missing, we start again with our clues. If we can pay, we still need to think about the locks after it."
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
    ]
  },
  "dead-aviary": {
    "id": "dead-aviary",
    "title": "The Silent Aviary",
    "arrival": "A bird rests in sunlight beside empty perches. The northern wall is sealed, but a southern workshop service gate leads toward the crossroads for another four-beat payment.",
    "stories": {
      "nell": "This room still shelters the birds, but its northern route is sealed. The service gate at the southern threshold reaches the crossroads for another four beats. Count before spending again.",
      "iris": "The sun warms the nest, so the room is useful. That doesn’t make it a cheap route, Pip. The south gate costs notes, and later locks need the key we used at the aviary.",
      "pip": "I brought that wing wrap last week, and I’m glad the bird is safe. The southern service gate leads onward, but I should have thought about our note bag as well as its nest."
    },
    "routes": {
      "nell": "The workshop service gate is south of us. Play a half note, paired eighths, then four sixteenths. It reaches the Workshop Crossroads and costs another four beats.",
      "iris": "Use a half note, two eighth notes, then four sixteenth notes at the southern service gate. That key opens this gate only; it won’t replace the dotted half and quarter.",
      "pip": "My workshop gift supplies the southern service key: half note, two eighths, then four sixteenths. If we left the gift behind, we’ll need another run to collect it before leaving."
    },
    "inventory": {
      "nell": "The southern service gate needs the three tiles from Pip’s gift. There are no notes in these perches, and paid keys stay spent for this run.",
      "iris": "A four-beat key can reach the crossroads without leaving the right tiles for its final doors. We spent the dotted half and quarter at the aviary, so count the kinds left.",
      "pip": "The wraps are for wings, not extra notes. If we start again, I’ll remember to offer my gift before we choose a door—and to save the final pair."
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
    ]
  },
  "dead-ferry": {
    "id": "dead-ferry",
    "title": "The Empty Ferry",
    "arrival": "The landing has a boarding rope, but no ferry. Oren left a tea tray for waiting travelers. The lamp still glows, though there is no boat to send a reply.",
    "stories": {
      "nell": "This old ferry no longer stops here, and that rope cannot carry us across. This run has reached a dead end. We can keep its clues, then start again and choose the delivery gate.",
      "iris": "Pip, the lamp proves that the landing has power, not a boat. There is no crossing here. On the next run, the storehouse’s delivery gate is the useful route.",
      "pip": "I could send a bird to look, but it couldn’t carry all four of us. I’d rather start again with a floor under my feet. I’ll remember the stamped chest."
    },
    "routes": {
      "nell": "Start a new run from the post office. When we reach the storehouse again, open the stamped chest and choose the delivery gate. Its key is a half note, a quarter note, then paired eighths.",
      "iris": "This run cannot cross the water. The next run needs the stamped chest’s half note, quarter note and paired eighths for the delivery gate. The journal will keep that clue.",
      "pip": "There’s no ferry or hidden bridge here. On our next try, use the delivery gate: half note, quarter note, then two eighth notes. I’ll ask Oren about the chest before we leave."
    },
    "inventory": {
      "nell": "Unspent notes are still in our bag, but none can make a boat appear. Paid keys won’t return. A new run clears the bag and pickups while keeping our discovered routes and clues.",
      "iris": "Notes cannot buy a passage that is not here. Start again with the knowledge from this landing, then spend the next bag on a different route.",
      "pip": "The tea tray has no note tiles. I checked politely. Next time I’ll remember that the delivery chest pays the working gate, and the boarding door’s key stays spent."
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
      "copy": "There is no ferry or safe crossing at this landing, so this run ends here. Paid door notes do not return. The discovered map and journal will remember this place. Start a new run, collect the stamped chest at the storehouse, and choose the delivery gate instead.",
      "repair": "Start a new run. Open the stamped chest in the canal storehouse, then choose the delivery gate."
    }
  },
  "dead-echo": {
    "id": "dead-echo",
    "title": "The Copied Waterway",
    "arrival": "The copied water channel stops at a solid northern wall. A bell service stair opens from the southern threshold, but reaching the tower this way costs another four-beat key.",
    "stories": {
      "nell": "We followed a copy of the clock’s signal. The southern service stair reaches the bell tower, but it costs another four beats. The direct stair avoided this extra payment.",
      "iris": "An echo repeats a sound, but it cannot confirm a delivery. The north wall is solid. We can use the southern service stair, but the tower still needs its own four-beat answer.",
      "pip": "The reflection copies every movement, but a bird changes its reply. I should have listened to the map as well as the echo. That southern stair asks for more notes."
    },
    "routes": {
      "nell": "The bell service stair is at the southern threshold. It needs a dotted half note, then four sixteenth notes. It reaches the tower, where another four-beat lock waits.",
      "iris": "Play a dotted half note followed by four sixteenth notes at the south stair. The north wall stays closed. Reaching the tower is not the same as keeping the key to its final door.",
      "pip": "The southern service stair needs a dotted half and four sixteenths. That is four more beats. I’d like to check our bag before we climb; the bell’s own lock still needs four."
    },
    "inventory": {
      "nell": "The copied-channel door already spent the single eighth, paired sixteenths, half rest and quarter rest. Those were the tower’s final key. The southern stair won’t return them.",
      "iris": "The dotted half and four-sixteenth group pay this stair. If they are our last notes, we’ll reach the tower with an empty bag and still have its lock to open.",
      "pip": "Nothing in the reflection gives notes back. If we start another run, I’ll remember the direct stair and save the little notes and rests for the bell."
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
    ]
  },
  "ending-complete": {
    "id": "ending-complete",
    "title": "A Town Answering Together",
    "arrival": "The public bell rings, and all five service lamps answer. A bird plays its own reply while Iris hears her friend call from Nell’s depot, safely arrived for tea. Nell, Mira, Iris and Pip stand together as the town’s water and delivery controls start moving again.",
    "stories": {
      "nell": "We repaired the shared return line and connected every smaller service during this trip. The bell hears the town, homes can request water and deliveries, and ferries can check their landings. All four of us helped finish it.",
      "iris": "The music room can hear its learners again, and the birds have their own reply horn. My friend’s ferry reached the town landing safely. She’s at Nell’s depot now, with tea ready. We can hear each other, and we can finally sit together again.",
      "pip": "My bird brought Nell’s letter back along old service perches. Its warm carrying clip softened the wax. Now it can send its own reply too! We listened to it, and it helped us bring everyone’s answers home."
    },
    "routes": {
      "nell": "This is the complete ending. Every service we learned about now works together, and we’ve stayed together too. Explore and celebrate, or begin another run; the journal keeps what we discovered.",
      "iris": "There’s no final payment or missing repair. The bell, homes, classroom, birds and listening window all work in this run. We can check their replies before leaving.",
      "pip": "No more locked doors! Can we stay for the birds’ whole tune, and then join Iris’s friend for tea at the depot? I’d like all four of us to be there. On the dry part of the landing."
    },
    "inventory": {
      "nell": "Every tile from the depot’s twelve beats has paid one of our three doors. The bag is empty, and every service answers. Mira, now we can share the bread.",
      "iris": "All twelve beats were spent in this run. Earlier runs gave us knowledge, not extra notes or repairs that stayed fixed. We made every connection together this time.",
      "pip": "No tiles left, no friend left behind, and no little reply horn forgotten. I’ll put the empty bag beside the cups. Please don’t use it for crumbs, Mira."
    },
    "inspections": [
      {
        "id": "ending-complete-memory",
        "title": "The table for four",
        "label": "Inspect the table for four",
        "text": "Four cups and a loaf wait beside the open, empty note bag. Nell, Mira, Iris and Pip have reached the end together, with every tile spent.",
        "placement": "left"
      },
      {
        "id": "ending-complete-reply",
        "title": "The voices answering back",
        "label": "Inspect the voices answering back",
        "text": "A mail bird reaches its own reply horn. Beside it, Iris’s receiver carries her friend’s voice: the ferry brought her safely to town, and she is waiting at Nell’s depot with tea ready.",
        "placement": "right"
      },
      {
        "id": "ending-complete-trace",
        "title": "The five working service lines",
        "label": "Inspect the five working service lines",
        "text": "Five lights answer the public bell. Homes request water and deliveries, music learners practise repairs, birds send their own tunes, and Iris’s listening window carries her friend’s reply.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "ending",
      "kicker": "Complete ending",
      "copy": "The public bell fell silent because its loose return wire could no longer carry replies. A mail bird brought Nell’s letter home along old service perches; its warm clip softened the wax. Earlier journeys taught the friends how each service worked, including what failed. Starting again reset those repairs and note supplies, but their journal kept the knowledge. This time, Nell, Mira, Iris and Pip connected all five services and fastened the main return wire in one trip. Homes receive water and deliveries. Ferries confirm safe landings. The shared music room teaches music and repair. The birds have their own reply horn, and Iris’s friend has reached town safely and is waiting at the depot with tea ready. The public bell hears them all. All four friends finish together, and all twelve beats from the depot have been spent."
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
  "dead-echo": "A blue and pearl imitation channel ending at a solid wall, copied clock reflection, dry return bowl and practical keeper maintenance evidence.",
  "final-concourse": "An amber, jade and teal central service hall with five copper lines meeting above a north gate, household pump and parcel board on the left, bird-sized reply step and horn on the right, and a five-line service map on the wall. Generous open floor.",
  "final-heart": "An indigo, cream and copper bell control chamber with a north gate, loose return wire and hand clamp on the left, low music-learning controls on the right, and five reply lamps with a small voice receiver on the wall. Generous open floor.",
  "ending-complete": "A bright amber, jade and teal shared celebration hall with four cups, bread and an open empty note bag on a left table; an accessible bird horn and Iris’s voice receiver on the right; and the public bell with five lit service lines on the wall. Generous open floor."
});

function doorCopy(roomId){
 return Object.fromEntries(Object.values(DOORS).filter(door=>door.from===roomId).map(door=>{
  const destination=OUTCOME_ROOMS[door.to]?.outcome,copy={name:door.label,hint:door.hint??'Listen to your companions for this door’s ordered four-beat answer.'};
  if(door.warning)copy.warning=door.warning;
  if(destination){copy.deadCopy=destination.copy;if(destination.repair)copy.repair=destination.repair;}
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
 if(roomId==='depot'){const entry=DOORS['depot-final-route'];copies['final-route']={name:entry.label,hint:entry.hint};}
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
