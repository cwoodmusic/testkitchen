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
    "arrival": "A tended walkway bends toward warm kitchen windows. Beside it, an older paving ring disappears beneath the roots; the empty place in a row of ceramic cups lets the breeze through without a sound.",
    "stories": {
      "nell": "I used to leave seed catalogues on that shared shelf. Three households would read the same copy before it came back, each with a different repair to the cover. The new path belongs to all of them.",
      "iris": "The watering can has had four handles, and everyone still calls it the same can. I clear the old stones too. A garden can make room for a new path without pretending the older one was never here.",
      "pip": "One of my birds keeps hopping over the empty cup instead of trying to fill the gap. It follows the buried ring with its eyes. I think it knows a delivery route that never reached Nell’s new maps."
    },
    "routes": {
      "nell": "For the hearth path, play a dotted half followed by a quarter: three beats, then one. Keep the paired eighths, four sixteenths, quarter rest, single eighth and paired sixteenths for the answer after it.",
      "iris": "The hearth path takes a dotted half and a quarter. The older stone path takes paired eighths, four sixteenths, a quarter rest, a single eighth, then paired sixteenths. If we choose the stones, leave the dotted half and quarter in our bag for later.",
      "pip": "The little replies mark the old stone path: paired eighths, four sixteenths, quarter rest, single eighth, paired sixteenths. That spends four beats in five tiles. Iris remembers a flower-carved stone beyond it; keep our dotted half and quarter through the detour."
    },
    "inventory": {
      "nell": "We brought eight beats here, with no new parcel waiting. Either path spends four. The hearth path leaves our five smaller tiles for its last door; the older path leaves the dotted half and quarter instead.",
      "iris": "There are no extra notes to gather in this court. Choose which four-beat phrase to spend now and keep the other intact. The older path needs us to look carefully once we have entered it.",
      "pip": "Our bag has two different four-beat answers. Spending the little groups and short replies now means carrying the dotted half and quarter onward. I will not trade those saved notes for anything along the way."
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
        "text": "Several different hands have repaired the same handle.",
        "placement": "left"
      },
      {
        "id": "garden-fork-buried-ring",
        "title": "The buried paving ring",
        "label": "Inspect the buried paving ring",
        "text": "Its worn grooves pass beneath roots instead of following the newer path.",
        "placement": "right"
      },
      {
        "id": "garden-fork-wind-cups",
        "title": "The listening cups",
        "label": "Inspect the listening cups",
        "text": "Small ceramic cups answer a breeze only after one empty space in their row.",
        "placement": "wall"
      }
    ]
  },
  "workshop-fork": {
    "arrival": "An unfinished bird hangs above a shelf of other people’s careful repairs. A bright teaching stair opens beside a narrow, older service arch; the phosphor screen between them leaves a long space before its two smallest pulses.",
    "stories": {
      "nell": "The teaching stair used to end at a locked storeroom. People kept leaving little repairs outside until somebody put out a second workbench and opened the door. That is how the music room began taking visitors.",
      "iris": "Three people have mended this one wing. Their thread colours disagree, but the feathers lie smoothly together. I brought the red thread myself; Pip showed me where a stiff seam would stop it opening.",
      "pip": "The rear handrail is bright at both ends and dusty in the middle. Small couriers land where a person would put a hand. The old passage is still a route for somebody, even if our shoes have forgotten it."
    },
    "routes": {
      "nell": "The schoolroom stair answers a dotted half followed by a quarter. After that, the single eighth, paired sixteenths, half rest and quarter rest are the four-beat key we must keep for the music room.",
      "iris": "One held call for three beats and an ordinary one-beat step opens the schoolroom stair: dotted half, quarter. The birds’ back passage uses a single eighth, paired sixteenths, half rest and quarter rest instead.",
      "pip": "For the birds’ back passage, play a single eighth, paired sixteenths, a half rest and a quarter rest. The two different half-beat tiles sound first, followed by three quiet beats. Keep our dotted half and quarter; the old loft has a hollow perch worth searching."
    },
    "inventory": {
      "nell": "No new notes are stored on this shelf. We have eight beats to divide between this choice and a later answer. The public stair spends the dotted half and quarter first.",
      "iris": "The long call and ordinary step make one four-beat phrase; the two rests and two short tiles make another. Choose one here and protect the other in our shared bag.",
      "pip": "If we go behind the stage, keep the dotted half and quarter all the way through. A forgotten instrument may supply a separate phrase, but it will not replace the last answer we are carrying."
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
        "text": "An unfinished bird has three different styles of careful repair around the same wing.",
        "placement": "left"
      },
      {
        "id": "workshop-fork-worn-rail",
        "title": "The back rail",
        "label": "Inspect the back rail",
        "text": "Dust fills the middle of the rail, but the handholds at either end are bright.",
        "placement": "right"
      },
      {
        "id": "workshop-fork-sound-screen",
        "title": "The silent sound screen",
        "label": "Inspect the silent sound screen",
        "text": "A curved phosphor display keeps space between the last two small pulses.",
        "placement": "wall"
      }
    ]
  },
  "canal-fork": {
    "arrival": "A silver drop waits above the water clock’s dry answering bowl. A repaired stool stands beside the service hatch, and a second channel copies every reflection before ending against a plainly visible stone wall.",
    "stories": {
      "nell": "Oren’s maintenance map is newer than the brass it is pinned to. He has marked every solid wall he could find. I trust a map made by somebody who still has to carry parcels through the place himself.",
      "iris": "That drop has enough water for a seed, but the clock will not let it fall. The little roots beside the bowl lean toward the empty space. Whatever this machine is waiting for, the garden has learned to wait with it.",
      "pip": "My bird can copy the clock exactly. The reflection can too. Neither makes the dry bowl answer. I think the stair leads to the part of this instrument that knows how to listen back."
    },
    "routes": {
      "nell": "Take the town-bell stair with a dotted half followed by four sixteenths: three beats held, then four attacks in one beat. Keep the single eighth, paired sixteenths, half rest and quarter rest for the tower’s last answer.",
      "iris": "The stair wants a dotted half and a group of four sixteenths. The copied waterway takes a single eighth, paired sixteenths, half rest and quarter rest, but Oren has shown us the wall at its end. It is a dead end.",
      "pip": "A long call for three beats, then four tiny steps, opens the town-bell stair. That is dotted half, four sixteenths. The copied waterway repeats our quiet phrase perfectly and still goes nowhere; follow the stair if we mean to reach the bell."
    },
    "inventory": {
      "nell": "There is no supply box in the timing chamber. We have enough for the stair and the tower if we spend the dotted half and four-sixteenth group here, then keep the four quieter tiles.",
      "iris": "Our single eighth, paired sixteenths, half rest and quarter rest belong to the final tower phrase. Spending them on the copied waterway leaves notes in the bag and no way onward.",
      "pip": "The two ways here each cost four beats. Only the stair leads onward. If we try the copied waterway, we can revisit that choice and recover its key; the clock has no extra gift for us."
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
        "text": "The clock holds one silver drop until the empty bowl receives its answer.",
        "placement": "left"
      },
      {
        "id": "canal-fork-service-stool",
        "title": "The keeper’s stool",
        "label": "Inspect the keeper’s stool",
        "text": "A cushion and repaired footrest make a long watch a little kinder.",
        "placement": "right"
      },
      {
        "id": "canal-fork-maintenance-map",
        "title": "The practical maintenance map",
        "label": "Inspect the practical maintenance map",
        "text": "The keeper has plainly marked the copied channel’s solid end.",
        "placement": "wall"
      }
    ]
  },
  "garden-final": {
    "arrival": "A small household bell hangs inside a relay frame built for a much larger place. Cups warm beside a practical kitchen switch, and an empty chair has been straightened for the next person who arrives.",
    "stories": {
      "nell": "I know this bell. Its old service number was longer than the street it served, so the neighbours gave it a kitchen name instead. They still answer it, whether the great route screens are working or not.",
      "iris": "The extra cup is warm, but nobody has decided who must sit there. That is a kind way to leave a place open. We can offer a welcome without writing the other person’s part for them.",
      "pip": "The little switch moves a machine big enough to steer an island, and all it does today is keep soup warm. I like that the neighbours chose something useful. My bird has already found the empty chair."
    },
    "routes": {
      "nell": "The home door needs paired eighths, four sixteenths, a quarter rest, a single eighth, then paired sixteenths. Those are the five smaller tiles we saved at the garden fork, in that order.",
      "iris": "Give two quick sounds in one beat, four tiny sounds in the next, one quiet beat, then the single eighth and paired sixteenths. Each of those final two tiles fills half a beat. All five together open the home door.",
      "pip": "Our remaining key is paired eighths, four sixteenths, quarter rest, single eighth, paired sixteenths. Listen to the last two tiles: one short sound, then two even shorter sounds. Equal time does not make them the same answer."
    },
    "inventory": {
      "nell": "We need no new parcel here. The five tiles in our bag are the exact last payment. Opening the home door will use every note we have carried on this route.",
      "iris": "Keep the order of the five remaining tiles. Their rest matters as much as their sounding notes. Once the home door answers, our shared bag will be empty.",
      "pip": "Nothing in the kitchen gives more notes. We brought the whole last phrase with us: two grouped tiles, the quarter rest, and the two different half-beat tiles."
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
        "text": "The chair is empty, but its cup is warm and its cushion has been straightened.",
        "placement": "left"
      },
      {
        "id": "garden-final-kitchen-relay",
        "title": "The kitchen relay",
        "label": "Inspect the kitchen relay",
        "text": "A formidable old switch now turns a tiny soup warmer on and off.",
        "placement": "right"
      },
      {
        "id": "garden-final-mended-clapper",
        "title": "The mended clapper",
        "label": "Inspect the mended clapper",
        "text": "Several household repair methods meet at the same small bell.",
        "placement": "wall"
      }
    ]
  },
  "workshop-final": {
    "arrival": "Low stools form a listening circle around a retired star navigator. Wooden extensions bring its oldest controls within reach, and repaired practice cloths mark the places where different learners have tried again.",
    "stories": {
      "nell": "The old operators worked alone in the middle of that ring. People turned the seats around before they understood every control. They wanted the room to help them hear one another while they learned.",
      "iris": "Somebody shortened one lever and lengthened the next. There is no single right size of person for this instrument now. The cloth patches show where each learner found a comfortable place to begin.",
      "pip": "That small stool was mine. I used to stand on it to reach the lever, until Nell helped me fit the wooden grip. Now the next learner will not have to balance on tiptoe just to make one sound."
    },
    "routes": {
      "nell": "The music-room door wants a single eighth, paired sixteenths, a half rest and a quarter rest. Give the two different half-beat replies, then wait for two beats and one more.",
      "iris": "Begin with a single eighth and paired sixteenths; together they fill the first beat. Follow them with a half rest, then a quarter rest. Three quiet beats leave room for an answer.",
      "pip": "Use our single eighth, paired sixteenths, half rest, then quarter rest. The first beat has one short sound followed by two smaller ones. I will hold the silence with you after they sound."
    },
    "inventory": {
      "nell": "These four tiles are the remaining four beats of our original parcel. There is no classroom reward to collect first. This final door spends them all.",
      "iris": "Our bag holds exactly the rests and short replies this door needs. Keep their order, and there will be no leftover note when we enter the shared room.",
      "pip": "The practice shelf is for repairs, not new note tiles. We have carried the complete answer here already; the final payment leaves our satchel empty."
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
        "text": "A wooden extension lets the smallest stool reach the oldest brass lever.",
        "placement": "left"
      },
      {
        "id": "workshop-final-practice-patches",
        "title": "The practice patches",
        "label": "Inspect the practice patches",
        "text": "Different repaired cloth squares mark places where people learned by trying again.",
        "placement": "right"
      },
      {
        "id": "workshop-final-listening-ring",
        "title": "The listening ring",
        "label": "Inspect the listening ring",
        "text": "Its empty centre faces the other seats instead of a lone operator’s desk.",
        "placement": "wall"
      }
    ]
  },
  "canal-final": {
    "arrival": "The Reach’s inhabited islands lie beyond the tower windows. Beneath the silent bell, someone has cleaned every dark route lamp and left a flask on a small shelf fitted to an immense receiving instrument.",
    "stories": {
      "nell": "Those lamps are places that used to send me a receipt. I cannot see every household from here, but somebody polished each glass as carefully as the one still glowing. They kept expecting an answer.",
      "iris": "The dish faces outward. I thought a great tower would only know how to send its own sound, but this one has been making room to receive. Perhaps the gardens were leaning toward that space all along.",
      "pip": "My couriers can reach the small islands faster than we can. If this room answers them, each bird will know where its next reply should go. I have left the harnesses loose enough for them to choose their own perch."
    },
    "routes": {
      "nell": "The town door takes a single eighth, paired sixteenths, half rest and quarter rest. Give the two different short replies before two quiet beats and one more. This is the last four-beat key.",
      "iris": "Begin with a single eighth for half a beat and paired sixteenths for the other half. Follow them with a half rest, then a quarter rest. The tower leaves room to listen after its call.",
      "pip": "Our last answer is single eighth, paired sixteenths, half rest, quarter rest. One short sound and two smaller sounds, then three beats of silence. Oren’s returning knock has brought us this far."
    },
    "inventory": {
      "nell": "The four tiles left in the bag pay this last lock exactly. The lamps and the keeper’s shelf hold no extra parcel. We need every kind in the order we kept it.",
      "iris": "There is no new gift at the top of the tower. Our two short tiles, half rest and quarter rest are enough; the final answer will empty our shared bag.",
      "pip": "We have brought exactly four beats up these stairs. The last door spends all four note tiles, leaving nothing to trade, discard or convert afterward."
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
        "text": "Each dark lamp has been cleaned as carefully as the one that still glows.",
        "placement": "left"
      },
      {
        "id": "canal-final-keeper-flask",
        "title": "The keeper’s flask",
        "label": "Inspect the keeper’s flask",
        "text": "The flask fits a hand-sized shelf added to a machine of enormous scale.",
        "placement": "right"
      },
      {
        "id": "canal-final-reply-dish",
        "title": "The reply dish",
        "label": "Inspect the reply dish",
        "text": "Its centre faces outward toward the islands, waiting to receive as well as send.",
        "placement": "wall"
      }
    ]
  },
  "garden-alcove": {
    "arrival": "Freshly moved leaves protect a dry patch beside an old flower-carved stone. Living roots cradle a small music box without pressing on its lid; one polished petal forms a hand-sized grip.",
    "stories": {
      "nell": "This stone carries the old survey flower. People used that mark for a service hatch before the neighbourhood had street names. Somebody has kept its grip clear even while the modern path grew elsewhere.",
      "iris": "I brushed the leaves away when I was small, but I never lifted the stone alone. The roots have made space for the box below it. They seem to know that a lid is meant to open again.",
      "pip": "The bird on my strap has stopped trying to copy the pipes. It is listening at the loose petal. A little mechanism can hold a reply for a very long time if somebody keeps the rain out."
    },
    "routes": {
      "nell": "Search beneath the loose flower stone. The notes found there open the flower gate: quarter note, paired eighths, four sixteenths, then a quarter rest. Keep the dotted half and quarter we brought for the answer beyond it.",
      "iris": "The polished petal is a grip. Search under that stone, then use its quarter, paired eighths, four sixteenths and quarter rest at the gate it reveals. Our original dotted half and quarter must stay in the bag.",
      "pip": "Find the music box under the flower stone before looking for its gate. Its four new one-beat tiles go quarter, paired eighths, four sixteenths, quarter rest. Those are separate from the long call and ordinary step we saved."
    },
    "inventory": {
      "nell": "We arrived carrying the dotted half and quarter for the final answer. The stone hides a separate four-beat supply, collectible once; its whole new phrase pays the flower gate and leaves our saved pair intact.",
      "iris": "Looking at the cradle alone gives no notes. Choose the search beneath the flower stone to collect its four tiles once. Spend those at the revealed gate, and protect our original two tiles.",
      "pip": "The search is a single pickup, not a gift for each conversation. After its four notes open the hidden gate, our dotted half and quarter will still be ready for the last door."
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
        "text": "Freshly turned leaves protect a dry place beside the old stone.",
        "placement": "wall"
      },
      {
        "id": "garden-alcove-root-cradle",
        "title": "The root cradle",
        "label": "Inspect the root cradle",
        "text": "Roots curve around the little instrument’s lid, leaving it room to open.",
        "placement": "right"
      },
      {
        "id": "garden-alcove-flower-stone",
        "title": "The flower stone",
        "label": "Inspect the flower stone",
        "text": "One carved petal is polished by a hand-sized grip. A narrow seam leaves room to lift the carved lid and search beneath it.",
        "placement": "left",
        "sourceId": "garden-hidden-notes",
        "sourceLabel": "Search beneath the flower stone"
      }
    ]
  },
  "workshop-alcove": {
    "arrival": "Wing wraps lie folded beside an old brush in the loft. Scratches of several sizes follow the roost rail toward a hollow perch, where one side gives a clear tone and the other holds a soft pause.",
    "stories": {
      "nell": "The straps up here belonged to couriers older than my first delivery book. Every new harness kept one buckle from the one before it. I can trace the repairs farther back than I can trace the names.",
      "iris": "The folded wraps smell of the same dry leaves Pip uses downstairs. Somebody has been caring for the quiet birds too. Being out of sight has not made them less worth tending.",
      "pip": "I made that little brush so I could clean inside the hollow perch. I never found what its two sides were for. Listen: the left rings, and the right leaves room after it. There may be something stored inside."
    },
    "routes": {
      "nell": "Search the hollow two-sided perch. Its half note followed by a half rest opens the brass gate it reveals. Leave our original dotted half and quarter untouched for the last room.",
      "iris": "The perch answers with two sounding beats and two quiet ones: half note, then half rest. Search it to collect those tiles once and reveal the brass gate. Keep the dotted half and quarter we carried through the back passage.",
      "pip": "Search inside the hollow perch, then use its half note before its half rest at the revealed gate. Sound first, silence second. Our saved dotted half and quarter belong beyond that gate."
    },
    "inventory": {
      "nell": "The old dotted half and quarter are still our last answer. The two long tiles inside the perch are a separate once-only supply; spend them together at the hidden brass gate.",
      "iris": "Inspecting the old wraps does not fill the bag. The explicit perch search gives one half note and one half rest. They pay only this gate, leaving the saved final pair.",
      "pip": "I can show you where to search, but repeating our conversation gives nothing. Take the two notes from the perch once, use them in sounding-then-silent order, and carry the original pair onward."
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
        "text": "Each wrap has been repaired to fit a different small wing.",
        "placement": "wall"
      },
      {
        "id": "workshop-alcove-roost-marks",
        "title": "The old roost marks",
        "label": "Inspect the old roost marks",
        "text": "Tiny scratches stop beside larger empty spaces along the rail.",
        "placement": "right"
      },
      {
        "id": "workshop-alcove-hollow-perch",
        "title": "The two-sided perch",
        "label": "Inspect the two-sided perch",
        "text": "A gentle tap gives a clear tone on one side and a muffled pause on the other. A small pegged cover closes a storage space between the two sides.",
        "placement": "left",
        "sourceId": "workshop-hidden-notes",
        "sourceLabel": "Search the hollow perch"
      }
    ]
  },
  "garden-secret-final": {
    "arrival": "Fresh water stands beside a carefully maintained empty chair. Two sets of hand-worn controls face a listening window; one sending lever rests beneath a folded cloth, while the receiver remains open to the garden.",
    "stories": {
      "nell": "An unanswered letter is still somebody’s letter. We leave its place in the tray instead of writing a reply on their behalf. This room seems to have kept the same promise with its second set of controls.",
      "iris": "My friend used the smoother grip. I have mended the chair and changed the water, but I never moved those controls into my place. I can keep a room ready without deciding what she would have played.",
      "pip": "The receiver is awake even though that second lever is covered. My birds do that too: they can listen without repeating. I would like to learn how to leave a space so carefully."
    },
    "routes": {
      "nell": "Use the two original tiles we saved: a dotted half followed by a quarter. The music-box notes have already paid their own gate. This last answer needs the long call and ordinary step.",
      "iris": "The unfinished-song door takes our dotted half, then our quarter. Three sounding beats and one ordinary beat are enough. We do not need to fill the empty chair’s part to open it.",
      "pip": "Dotted half, quarter: the pair we protected at the garden fork. The other notes brought us through the hidden gate; these four beats complete our own answer here."
    },
    "inventory": {
      "nell": "Only the saved dotted half and quarter remain. They are not a new gift from this room. Paying the last door uses both and leaves every note kind at zero.",
      "iris": "The last pair has travelled with us since the parcel. We spent the music box’s separate supply on its gate, so there are no spare notes to leave in the chair.",
      "pip": "We carried two tiles through the entire detour on purpose. Their four beats are the final payment. The satchel will be empty when the door answers."
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
        "title": "The maintained chair",
        "label": "Inspect the maintained chair",
        "text": "Its place is empty, but nothing about it has been neglected.",
        "placement": "left"
      },
      {
        "id": "garden-secret-final-second-controls",
        "title": "The second controls",
        "label": "Inspect the second controls",
        "text": "Two different hands wore the adjacent controls in different ways.",
        "placement": "right"
      },
      {
        "id": "garden-secret-final-open-window",
        "title": "The listening window",
        "label": "Inspect the listening window",
        "text": "Its receiver faces the garden even while the sending side rests.",
        "placement": "wall"
      }
    ]
  },
  "workshop-secret-final": {
    "arrival": "Behind the great sending horn, a smaller horn rests on a freshly brushed perch. A hand-built step reaches its oldest control, and two phosphor traces approach the same pause along different curves.",
    "stories": {
      "nell": "The delivery ledgers have a column for returns, but this horn was never listed as a sender. Perhaps the couriers kept answering while we were only counting the messages we gave them.",
      "iris": "The little step is newer than the great machine. Somebody noticed one bird could not reach the lever and made that difference matter. I recognise the care, even if I do not know who built it.",
      "pip": "I thought the birds were getting my tune wrong. Their line bends away and still arrives beside ours. They were not losing the answer. They had another part they wanted us to hear."
    },
    "routes": {
      "nell": "The birds’ answer door needs the original dotted half followed by the quarter. We kept that long call and ordinary step through the quiet passage; they are our final four beats.",
      "iris": "Play the dotted half and then the quarter we saved. The hollow perch’s half note and half rest have already paid their own gate. This answer belongs to the pair we carried here.",
      "pip": "Our last two tiles go dotted half, quarter. Three beats held and one ordinary step finish the phrase without making the small horn copy the large one."
    },
    "inventory": {
      "nell": "The shared bag has exactly its last four beats: dotted half and quarter. There are no notes hidden in this horn; spending that pair will empty every kind.",
      "iris": "We protected this pair when the workshop fork offered two paths. The perch supplied only its own gate. Our two original tiles are the complete final answer.",
      "pip": "The little horn brings a voice, not another note reward. Pay the door with our saved dotted half and quarter; nothing will be left over afterward."
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
        "text": "Its rim is polished from the inside, as if something small has been speaking into it.",
        "placement": "left"
      },
      {
        "id": "workshop-secret-final-small-step",
        "title": "The little service step",
        "label": "Inspect the little service step",
        "text": "A hand-built step reaches the one control a small courier cannot reach from its perch.",
        "placement": "right"
      },
      {
        "id": "workshop-secret-final-two-traces",
        "title": "The two sound traces",
        "label": "Inspect the two sound traces",
        "text": "Two phosphor traces approach the same pause along different curves.",
        "placement": "wall"
      }
    ]
  }
};
const OUTCOME_ROOMS={
  "ending-home": {
    "id": "ending-home",
    "title": "A Place to Come Home",
    "arrival": "A kitchen chime answers from an open window, then another across the courtyard. Someone moves four cups onto the common table while the old relay settles into a small, steady glow.",
    "stories": {
      "nell": "I used to bring post through here before the houses had their own chimes. People would leave the courtyard door unlatched when they expected someone. That is a useful sort of signal to have working again.",
      "iris": "The extra chair has been pulled into the light. We do not have to decide whose place it is before we keep it ready. I would like to water those window boxes in the morning.",
      "pip": "Listen—each kitchen answers a little differently. I thought fixing the bell would make everything sound alike. I am glad it does not."
    },
    "routes": {
      "nell": "Our delivery is finished here. We can look around the courtyard, revisit the last answer, or begin another journey from the depot.",
      "iris": "This path has brought us to a place that answers. There is no further lock here; stay a little, or revisit our choice when you are ready.",
      "pip": "No more door keys on this route. I want to hear all the little chimes before we try a different way on another journey."
    },
    "inventory": {
      "nell": "The satchel is empty. Every note we carried has paid its part of the route, including the last home-door phrase.",
      "iris": "There are no note tiles left to spend. The empty space in the bag belongs to the finished phrase.",
      "pip": "Nothing rattles in the satchel now. We used the whole set, and the kitchens are keeping the answer going for us."
    },
    "inspections": [
      {
        "id": "ending-home-memory",
        "title": "The common table",
        "label": "Inspect the common table",
        "text": "Four cups stand beside a loaf under a clean cloth. One corner of the table has been mended with a piece of the same wood as the nearby post box.",
        "placement": "left"
      },
      {
        "id": "ending-home-reply",
        "title": "The kitchen chimes",
        "label": "Inspect the kitchen chimes",
        "text": "The window chimes use different spoons, shells and brass scraps. A thin copper line connects their hinges to the old relay without making their voices alike.",
        "placement": "right"
      },
      {
        "id": "ending-home-trace",
        "title": "The small working relay",
        "label": "Inspect the small working relay",
        "text": "An immense socket now holds a hand-sized bell. Warm wax on an ordinary envelope softens beside its service lamp; the parcel’s sender is still unnamed.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "ending",
      "kicker": "A place that answers",
      "copy": "The home door opens into a courtyard that has kept a place for whoever arrives next. Its kitchen chimes answer the restored hearth relay one by one. Mira has spent every note she carried, and the warm parcel can rest on a table among people who will help ask where it came from."
    }
  },
  "ending-school": {
    "id": "ending-school",
    "title": "The Open Music Room",
    "arrival": "Low stools form an open circle around the listening instrument. As its rings begin to turn, a small practice control clicks and leaves room for the next person to answer.",
    "stories": {
      "nell": "The oldest handle has a child-sized grip fitted over it. Someone did not wait to understand the whole machine before making it useful. I know a few retired postkeepers who would enjoy a seat here.",
      "iris": "The stools face one another. When a learner stops, the others can see that they are thinking. That seems as important as getting the next sound right.",
      "pip": "I brought the wing jig, but I think we can leave it on the help shelf. Someone learning here may find a better repair than mine. I would like to come back and see it."
    },
    "routes": {
      "nell": "This is the end of this delivery route. The room is open now; explore it, revisit the last rhythm, or start another journey with what we have learned.",
      "iris": "We have reached the shared music room, and its last lock is paid. There is no onward door to solve here.",
      "pip": "Our phrase ends here so another learner can begin. We can listen before revisiting our answer or trying a new route."
    },
    "inventory": {
      "nell": "All note tiles are spent. The music-room door accepted the short replies and following silence from our original parcel.",
      "iris": "The shared satchel is empty. Every note has found its place in the route; the room does not require another payment.",
      "pip": "We have no spare tiles left. That is the complete delivery, not a missing supply."
    },
    "inspections": [
      {
        "id": "ending-school-memory",
        "title": "The smallest stool",
        "label": "Inspect the smallest stool",
        "text": "Its front legs have been shortened and capped neatly so it sits level. A wooden lever extension reaches down to it from the oldest brass control.",
        "placement": "left"
      },
      {
        "id": "ending-school-reply",
        "title": "The listening circle",
        "label": "Inspect the listening circle",
        "text": "The instrument’s seats leave an opening wide enough for another stool. Polished handrails show that people have moved around the circle instead of keeping one permanent operator’s place.",
        "placement": "right"
      },
      {
        "id": "ending-school-trace",
        "title": "The shared repair shelf",
        "label": "Inspect the shared repair shelf",
        "text": "An unfinished mechanism has three kinds of careful stitching around one joint. Beside it lies a fresh piece of felt and a brush cleaned for the next learner.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "ending",
      "kicker": "Room for another voice",
      "copy": "The final quiet phrase opens the community music room. Its retired navigator becomes a listening instrument that several people can learn together. Every carried note has been used, while the circle keeps an empty place for the next attempt and the next answer."
    }
  },
  "ending-public": {
    "id": "ending-public",
    "title": "The Evening Bell",
    "arrival": "The evening bell moves once above the terrace. A route lamp answers from a nearby island, then a distant blue light returns the same interval across the Reach.",
    "stories": {
      "nell": "A dispatch signal should tell you whether anyone received it. Those little returning lights were the part we had lost. I will keep the parcel’s reply address open until somebody can fill it in.",
      "iris": "The gardens are answering at their own distances. We did not have to pull every island closer to hear them. I hope the people tending those lamps can go home before their tea gets cold.",
      "pip": "My birds are waiting for the lights to return before they take off. I used to think the waiting was a fault in their compass. They were checking that someone was there."
    },
    "routes": {
      "nell": "The town door completes this route. We can watch the replies from the terrace, revisit that final choice, or make another journey.",
      "iris": "There is no further gate here. The phrase has reached the public bell; its answer now comes from the islands outside.",
      "pip": "We have reached the end of the tower path. Let the last lamp answer before we decide whether to revisit it or try a new way."
    },
    "inventory": {
      "nell": "The delivery bag is empty. The tower’s final phrase used every note that remained after the route here.",
      "iris": "We have spent all our tiles. The returning lights belong to the completed answer and ask for no more notes.",
      "pip": "No notes left in the satchel. We carried exactly enough to reach the bell and leave it ready to listen."
    },
    "inspections": [
      {
        "id": "ending-public-memory",
        "title": "The keeper’s bench",
        "label": "Inspect the keeper’s bench",
        "text": "A patched coat and a flask rest on a narrow shelf beside the immense control frame. The bench faces the returning route lamps rather than the bell itself.",
        "placement": "left"
      },
      {
        "id": "ending-public-reply",
        "title": "The receiving dish",
        "label": "Inspect the receiving dish",
        "text": "Its open centre faces the inhabited islands. A fine silver trace appears only after a distant lamp has answered the bell’s signal.",
        "placement": "right"
      },
      {
        "id": "ending-public-trace",
        "title": "The evening route lamps",
        "label": "Inspect the evening route lamps",
        "text": "Clean glass covers every lamp, including the furthest dark ones. New light travels outward and returns along separate copper lines; the keeper has cared for both.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "ending",
      "kicker": "The Reach replies",
      "copy": "Mira’s last phrase brings the public bell into time with the returning route lights. The islands answer rather than merely receive a command. Every note is spent, and the old network can carry the warm parcel’s unanswered question farther than the party could carry it alone."
    }
  },
  "ending-secret-quiet": {
    "id": "ending-secret-quiet",
    "title": "The Reserved Silence",
    "arrival": "The listening window opens onto the garden without sounding its second instrument. Fresh water catches the light beside a maintained empty chair, and nothing hurries to fill its place.",
    "stories": {
      "nell": "There is room on an address line for a name we do not know yet. I can keep that space without inventing a recipient. We have delivered everything we promised to carry.",
      "iris": "I changed the water here even when I could not bear to sit down. You listened long enough to find the way in, and you did not use up the part I was keeping. Thank you for letting the chair stay ready.",
      "pip": "The little bird keeps breathing between its calls. I will not wind that pause out of it again. A second voice needs somewhere to arrive."
    },
    "routes": {
      "nell": "This listening place is the end of the hidden garden route. We can remain here, revisit its last answer, or begin another journey without taking anything from the chair.",
      "iris": "There is no further lock to fill. We have reached the space I wanted to keep; looking after it does not require another phrase.",
      "pip": "The secret path finishes here. If we try another route later, I want to remember that finding a quiet room did not mean we had to make it loud."
    },
    "inventory": {
      "nell": "The original long call and ordinary step paid the final door. The satchel holds no unused notes.",
      "iris": "All our note tiles are spent. Keeping this place open has not left an unpaid rhythm or an extra tile in the bag.",
      "pip": "We used everything we carried and everything we found. The quiet here is a finished answer, not a forgotten note."
    },
    "inspections": [
      {
        "id": "ending-secret-quiet-memory",
        "title": "The maintained chair",
        "label": "Inspect the maintained chair",
        "text": "The cushion has been turned away from a roof drip and its worn arm has a fresh coat of sap polish. An empty place can be kept with the same care as an occupied one.",
        "placement": "left"
      },
      {
        "id": "ending-secret-quiet-reply",
        "title": "The unplayed instrument",
        "label": "Inspect the unplayed instrument",
        "text": "A folded cloth covers the second set of sounding keys. Beside it, two different hands have worn the receiver controls smooth in different places.",
        "placement": "right"
      },
      {
        "id": "ending-secret-quiet-trace",
        "title": "The open listening window",
        "label": "Inspect the open listening window",
        "text": "The receiving pane faces the garden while the sending side remains still. A tiny shoot rests against its frame without interrupting the open space.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "secret-ending",
      "kicker": "A hidden garden ending",
      "copy": "The notes Mira saved through the old garden open a room that has been kept ready. Iris leaves the second instrument unplayed and the listening window open. Every note is spent; the reserved silence belongs to a voice that may choose its own time to return."
    }
  },
  "ending-secret-birds": {
    "id": "ending-secret-birds",
    "title": "The Birds’ Countermelody",
    "arrival": "A small courier steps onto the service perch and sounds its own brass horn. A second phosphor trace meets the first at the shared pause, then takes a different curve into the evening.",
    "stories": {
      "nell": "I have stamped thousands of bird-carried letters and never asked what else a courier might need to send. I should leave a little more space on the return forms. This answer deserves its own address.",
      "iris": "That phrase has a place where another sound could grow beside it. The old garden cups do the same thing in the wind. I am glad we followed the quieter passage.",
      "pip": "It was not forgetting the tune. It had another part. I kept tightening the compass whenever it turned toward this room, and all it needed was a step high enough to reach its horn."
    },
    "routes": {
      "nell": "This reply loft completes the hidden workshop route. We can listen here, revisit the final door, or begin another journey carrying the discovery in our journal.",
      "iris": "There is no onward lock. The smaller voice has reached its own place in the song, and we can let it answer.",
      "pip": "We have found the end of the birds’ back passage. I want to hear their whole reply before we revisit anything."
    },
    "inventory": {
      "nell": "The long call and ordinary note were kept for this last door. Now every tile in the satchel has been used.",
      "iris": "There are no spare notes left. Both the carried phrase and the hidden perch’s gift have paid their exact parts.",
      "pip": "The satchel is empty, and the birds are not asking for another tile. They already had a voice to add."
    },
    "inspections": [
      {
        "id": "ending-secret-birds-memory",
        "title": "The little service perch",
        "label": "Inspect the little service perch",
        "text": "A hand-built step raises a small courier to the older control. Its top is polished by tiny feet, and a brush rests nearby with fresh brass dust in its bristles.",
        "placement": "left"
      },
      {
        "id": "ending-secret-birds-reply",
        "title": "The answering horn",
        "label": "Inspect the answering horn",
        "text": "Its rim is worn from the inside. The smaller instrument points toward the listening side of the great public horn, leaving the two voices distinct.",
        "placement": "right"
      },
      {
        "id": "ending-secret-birds-trace",
        "title": "The crossing sound traces",
        "label": "Inspect the crossing sound traces",
        "text": "Two green-blue traces share one pause, then part along different curves. Neither is a copy of the other, and both continue past the old route board’s edge.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "secret-ending",
      "kicker": "A hidden courier ending",
      "copy": "Mira’s carefully saved final notes open the reply chamber behind the public machinery. Pip’s birds answer with a countermelody of their own. Every note is spent, and the star-post gains a returning voice that its old route board never named."
    }
  },
  "dead-brambles": {
    "id": "dead-brambles",
    "title": "The Overgrown Arch",
    "arrival": "Rain threads through the roots that fill the far arch. A ceramic cup catches it beside a dry bench, while the party’s footsteps end gently against the overgrown court.",
    "stories": {
      "nell": "The old route mark is still on the arch, but no one could carry a parcel through those roots now. A sign can outlast the service it once promised. We can recover the key and return to Iris’s listening gate.",
      "iris": "I cleared the bench, not the passage. Those roots are holding more of this court together than I understood when I first tried cutting them. There is a kinder way onward from my porch.",
      "pip": "My bird will not try that gap. Its wings would scrape both sides, and it knows it still could not get through. Let us take the answer back rather than push it."
    },
    "routes": {
      "nell": "There is no onward passage in this court. Revisit the paid arch to recover its notes and choose the listening gate on Iris’s porch.",
      "iris": "Revisit this choice and use my listening phrase at the other gate: a half note, then a half rest. The roots here do not hide another way through.",
      "pip": "This route ends at the roots. We can rest on the bench, then revisit the last door and try the listening gate."
    },
    "inventory": {
      "nell": "Some notes remain in the satchel because this was a dead end. Revisit the last choice to recover the arch’s key; the remaining tiles are not lost.",
      "iris": "The notes we did not spend are still together. Revisit the arch to bring its dotted half and quarter back before we choose the other gate.",
      "pip": "There are still tiles in the bag. We cannot spend them on another door here, but revisiting our answer restores what the arch took."
    },
    "inspections": [
      {
        "id": "dead-brambles-memory",
        "title": "The rain cup",
        "label": "Inspect the rain cup",
        "text": "A repaired ceramic cup gathers water beneath one loose roof joint. Someone has shifted it just far enough to keep the bench dry.",
        "placement": "left"
      },
      {
        "id": "dead-brambles-reply",
        "title": "The resting bench",
        "label": "Inspect the resting bench",
        "text": "Its seat has been brushed clean, though moss has covered the path beyond it. The little court is cared for even without a working through route.",
        "placement": "right"
      },
      {
        "id": "dead-brambles-trace",
        "title": "The root-filled arch",
        "label": "Inspect the root-filled arch",
        "text": "Several thick roots press through the old route frame into supporting stone. Beyond them lies solid growth with no safe gap for the party.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "dead-end",
      "kicker": "A quiet dead end",
      "copy": "The overgrown arch opens into a rainlit resting court, but roots close every onward passage. The party can pause here without being trapped. Revisit the last answer to recover its notes and take Iris’s listening gate instead.",
      "repair": "Revisit Iris’s porch and use her gift at the listening gate."
    }
  },
  "dead-aviary": {
    "id": "dead-aviary",
    "title": "The Silent Aviary",
    "arrival": "Sunlight reaches a small nest between rows of empty perches. One workshop bird follows Pip inside and folds its wings while the old aviary’s sealed back wall gives no answering click.",
    "stories": {
      "nell": "The departure hooks have been taken down carefully, one at a time. Whoever closed this room meant the birds to rest safely, not to keep travelling through it. We should revisit the door rather than search for a new dispatch route.",
      "iris": "The sun still finds that little nest. A place can be useful after its old path has closed. We can leave it peaceful and return to Pip’s working gate.",
      "pip": "I brought the clean wing wrap up last week. This bird likes the warm patch, but there is no service opening behind the perches. The running gate is the route I know how to repair."
    },
    "routes": {
      "nell": "The aviary has no onward door. Revisit its answer to recover the paid notes and choose the workshop’s running gate.",
      "iris": "We can return to the workshop by revisiting the last choice. Pip’s running phrase opens the working gate there.",
      "pip": "Revisit this door, then take my gift if it is still waiting. The running gate wants a half note, paired eighths, and four sixteenths."
    },
    "inventory": {
      "nell": "The unspent tiles are still in the shared bag. Revisit the aviary’s key to recover that payment before choosing the working route.",
      "iris": "A dead end may leave notes in the satchel. There is no reason to discard them; revisiting the door restores the phrase we spent here.",
      "pip": "We still have carried notes, and the last key can come back when we revisit it. None of the empty perches gives another gift."
    },
    "inspections": [
      {
        "id": "dead-aviary-memory",
        "title": "The sunlit nest",
        "label": "Inspect the sunlit nest",
        "text": "Its felt lining has been renewed where a small bird settles into the light. Fresh brass dust catches along one recently repaired edge.",
        "placement": "left"
      },
      {
        "id": "dead-aviary-reply",
        "title": "The folded wing wrap",
        "label": "Inspect the folded wing wrap",
        "text": "A clean wrap waits beside a little brush. Pip has stitched its fastening wide enough to close without bending a delicate wing.",
        "placement": "right"
      },
      {
        "id": "dead-aviary-trace",
        "title": "The sealed service wall",
        "label": "Inspect the sealed service wall",
        "text": "Perch brackets end at a carefully closed stone panel. Its edges have no hinge or latch, and the old route cable has been disconnected at both ends.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "dead-end",
      "kicker": "A quiet dead end",
      "copy": "The old aviary is a safe place for a tired courier, but it carries no route onward. Its last service wall is sealed. Revisit this answer to recover the notes and return to the workshop’s running gate.",
      "repair": "Revisit Pip’s workshop and use his running phrase at the workshop gate."
    }
  },
  "dead-ferry": {
    "id": "dead-ferry",
    "title": "The Empty Ferry",
    "arrival": "The boarding rope hangs over still light-water with no ferry beneath it. Oren has left a tray for the waiting party, and the unused landing lamp casts a small blue circle on the rail.",
    "stories": {
      "nell": "I used to time my last mailbag by this lamp. The ferry has not served the landing for years, and a warm envelope does not make a boat appear. We can revisit our boarding answer and use the delivery gate.",
      "iris": "The water is bright enough to show every knot in that rope. Nothing is pulling back from the far end. Let us take the route that can answer us.",
      "pip": "Even the birds are staying on the rail. I could send one across to look, but that would not carry all four of us. We should return to the stamped chest and the delivery knock."
    },
    "routes": {
      "nell": "This landing ends the abandoned boarding route. Revisit the last answer to recover its notes and choose the storehouse’s delivery gate.",
      "iris": "There is no boat or hidden crossing here. Revisit the boarding choice, then open the stamped chest in the storehouse if it is still closed.",
      "pip": "The working delivery gate wants a half note, a quarter, then paired eighths. Revisit this choice to take those notes back toward the proper route."
    },
    "inventory": {
      "nell": "Our unspent notes remain in the bag. Revisit the boarding key to restore the payment; the stamped chest can still supply the working route if unclaimed.",
      "iris": "The bag is not empty because our journey stopped at a dead end. Revisit the last door rather than throwing any tiles into the water.",
      "pip": "We have carried notes left, and revisiting brings back the dotted half and four sixteenths spent on this landing. The tea tray has no extra tiles."
    },
    "inspections": [
      {
        "id": "dead-ferry-memory",
        "title": "The waiting tea tray",
        "label": "Inspect the waiting tea tray",
        "text": "A second cup stands beside the first beneath a dry cloth. The keeper has checked the tray even though no fresh ferry wake reaches the landing.",
        "placement": "left"
      },
      {
        "id": "dead-ferry-reply",
        "title": "The boarding rope",
        "label": "Inspect the boarding rope",
        "text": "Its near end has a fresh repair, but the far end lies slack above still water. It is a waiting rope, not a bridge.",
        "placement": "right"
      },
      {
        "id": "dead-ferry-trace",
        "title": "The unused landing lamp",
        "label": "Inspect the unused landing lamp",
        "text": "The brass housing is clean and its local crystal still glows. No return lamp answers from a boat or the empty berth beyond the rail.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "dead-end",
      "kicker": "A quiet dead end",
      "copy": "The boarding door reaches a cared-for landing without a ferry. The water offers no crossing for the party. Revisit this choice to recover the spent notes, then use the stamped chest’s delivery phrase at the storehouse’s working gate.",
      "repair": "Revisit the canal storehouse, open the stamped chest, and use its delivery phrase."
    }
  },
  "dead-echo": {
    "id": "dead-echo",
    "title": "The Copied Waterway",
    "arrival": "The channel repeats the water clock’s reflected face exactly. Its silver line reaches a clean stone wall, then turns back toward a dry bowl that has never received an answering drop.",
    "stories": {
      "nell": "That is a copy of a route signal, not a delivery receipt. The maintenance mark warned us where the stone would stop it. We can revisit the water-clock choice and take the town-bell stair.",
      "iris": "A reflection can repeat a movement without growing anything. We heard a familiar quiet phrase and followed it, but no living root or receiver carries its answer onward.",
      "pip": "The trace returns at exactly the same angle every time. My birds turn their heads when another bird replies; this line never changes. Let us go back to the stair with the four tiny footfalls."
    },
    "routes": {
      "nell": "This copied waterway has a solid end. Revisit the last rhythm and choose the water clock’s town-bell stair.",
      "iris": "We can recover the last key by revisiting this choice. The onward stair uses a dotted half followed by four sixteenths.",
      "pip": "There is no further lock hidden in the reflection. Revisit the water clock and take its town-bell stair instead."
    },
    "inventory": {
      "nell": "The remaining notes are still ours. Revisit this paid choice to restore its quiet phrase before taking the stair to the public bell.",
      "iris": "The satchel still holds the notes this dead end could not use. Revisit the last answer and keep the whole set together for the other route.",
      "pip": "No note has vanished in the reflection. Revisit this door to recover the single eighth, paired sixteenths, half rest, and quarter rest we spent here."
    },
    "inspections": [
      {
        "id": "dead-echo-memory",
        "title": "The dry return bowl",
        "label": "Inspect the dry return bowl",
        "text": "A pale ring marks where a drop should land, but the bowl is dry. The copy sends a signal without bringing anything back.",
        "placement": "left"
      },
      {
        "id": "dead-echo-reply",
        "title": "The reflected clock face",
        "label": "Inspect the reflected clock face",
        "text": "Every motion repeats at the same angle, including a scratch that belongs to the original glass. The reflection has no separate reply of its own.",
        "placement": "right"
      },
      {
        "id": "dead-echo-trace",
        "title": "The marked stone end",
        "label": "Inspect the marked stone end",
        "text": "A practical maintenance mark points directly at the closed wall. The channel stops flush against the stone; no service passage continues behind it.",
        "placement": "wall"
      }
    ],
    "outcome": {
      "kind": "dead-end",
      "kicker": "A quiet dead end",
      "copy": "The copied channel follows a familiar rhythm all the way to a stone wall. It can repeat the clock, but cannot carry the party onward or return an answer. Revisit the paid choice and take the water clock’s town-bell stair.",
      "repair": "Revisit the water clock and choose the town-bell stair."
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
