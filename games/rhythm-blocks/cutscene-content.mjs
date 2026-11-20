/** Overlapping party performances; observing never claims a game source. */
import {CAMPAIGN_CONTENT} from './campaign-content.mjs';
import {CAMPAIGN_SCENES} from './campaign-scenes.mjs';
import {compileRoomCutscene} from './cutscene.mjs';

const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

// Nell leads; Mira brings nerve, curiosity and an unreliable breakfast schedule.
// Iris tests the evidence without flinching. Pip's curiosity outruns his courage.
const arrivals={
 "depot": {
  "points": [
   {
    "target": "returned-letter",
    "action": "examine"
   },
   {
    "target": "dispatch-map",
    "action": "search"
   },
   {
    "target": "clockwork-roost",
    "action": "listen"
   }
  ],
  "lines": [
   "This letter came back with warm wax. Iris, check the screen, and Pip, watch your bird. We need to know who brought it home.",
   "He keeps looking down that dark route. Does he want us to follow? I really hope his plan doesn’t involve flying.",
   "Shimmy shimmy! A bird with a secret path! Wait, is that breakfast I smell? We could investigate with toast.",
   "We can walk, Pip. The screen shows a message going out, but the light for its reply stays dark. That’s what we need to check.",
   "Breakfast later, Mira. People are waiting for deliveries, so let’s find a working route. Nobody touches a wire before Iris checks it.",
   "Right, bird first, toast later. Look, it turns before the screen flashes! Maybe it knows a path our map’s missed. Let’s follow it."
  ]
 },
 "garden-porch": {
  "points": [
   {
    "target": "garden-porch-second-cup",
    "action": "examine"
   },
   {
    "target": "garden-porch-graft",
    "action": "listen"
   },
   {
    "target": "garden-porch-old-plaque",
    "action": "search"
   }
  ],
  "lines": [
   "Watch the roots. Iris, check your water pipe, and Pip, look at that metal panel. These plants need water soon.",
   "Those seed jars are sitting on an old machine! And that root just moved. Is it coming for my boots?",
   "Is that root winking? Oh, two cups! Iris, is someone coming for tea, or can I claim the spare?",
   "The root’s answering the pipe, Pip. My friend’s on another island. Her messages stopped with the bell, so I’m keeping her cup ready.",
   "Tea can wait, Mira. We’ll help the garden and look for that reply. Ask Iris for her note tiles before choosing a door.",
   "The root moves when the pipe calls, but there’s still no water. That’s a useful clue, right? Let’s find where the answer gets lost."
  ]
 },
 "workshop-porch": {
  "points": [
   {
    "target": "workshop-porch-return-feather",
    "action": "examine"
   },
   {
    "target": "workshop-porch-seed-bowl",
    "action": "search"
   },
   {
    "target": "workshop-porch-flight-jig",
    "action": "examine"
   }
  ],
  "lines": [
   "Leave those winding keys alone for now. Iris, check the bowl, and Pip, inspect your practice wing. That old feather might be a clue.",
   "The wing moved before I touched it! Is another bird calling it? Everyone stay where I can see you, please.",
   "A whole room of clockwork birds, and Pip still puts out seed. Is that for real birds, or have I found our emergency snack?",
   "That’s its test motor, Pip. The charging perches work on their own too, so the birds still have power while the main bell’s quiet.",
   "Leave the seed, Mira. The feather fits an older mail bird, and someone’s kept those birds working. Let’s find out where they go.",
   "Fine, I’ll interview the bird instead of eating its lunch. It waits for its partner before moving. Maybe it needs an answer too."
  ]
 },
 "canal-porch": {
  "points": [
   {
    "target": "canal-porch-seal-line",
    "action": "search"
   },
   {
    "target": "canal-porch-loading-console",
    "action": "examine"
   },
   {
    "target": "canal-porch-mooring-bell",
    "action": "listen"
   }
  ],
  "lines": [
   "Stay behind the landing rail. Iris, check the message machine, and Pip, listen at the little bell. I’ll read these delivery labels.",
   "My bird keeps listening, but the bell’s quiet. Is a boat supposed to answer? I’d like to know before going near the water.",
   "Oren’s got food boxes ready, but no boat can arrive safely. Are those biscuits? Suddenly I’m extremely interested in these deliveries.",
   "You’re safe behind the rail, Pip. The boat needs a reply from the landing, so its crew can check that it’s safe to dock.",
   "Those supplies are for the next island, Mira. They need flour and clothes, so we’re following Oren’s map to the bell controls.",
   "Right. Get the supplies moving, then ask about biscuits. I can investigate the warm letter while we walk. That’s multitasking."
  ]
 },
 "garden-fork": {
  "points": [
   {
    "target": "garden-fork-shared-can",
    "action": "examine"
   },
   {
    "target": "garden-fork-buried-ring",
    "action": "search"
   },
   {
    "target": "garden-fork-wind-cups",
    "action": "listen"
   }
  ],
  "lines": [
   "That handle’s been repaired several times. Iris, check the old stones, and Pip, listen at the cups. Someone still uses this path.",
   "Tiny claw marks run beside the cups. My bird knows this path. Do you think something much bigger could be following it?",
   "A path missing from Nell’s map! Our bird could’ve brought the letter this way. And those stones look perfect for a hopping contest.",
   "The marks fit small birds, Pip. This old path has its own message wire, and it still answers. The bell’s main return connection must be broken.",
   "Both feet on the path, Mira. The hearth way reaches the homes; the old stones go deeper. Choose one phrase and save the other notes.",
   "No hopping. Got it. But someone’s kept this old path clear, and I want to know who. Let’s look around before we choose."
  ]
 },
 "workshop-fork": {
  "points": [
   {
    "target": "workshop-fork-help-shelf",
    "action": "examine"
   },
   {
    "target": "workshop-fork-sound-screen",
    "action": "listen"
   },
   {
    "target": "workshop-fork-worn-rail",
    "action": "search"
   }
  ],
  "lines": [
   "Iris, study the screen, and Pip, check the rail from the floor. Several people have helped repair that bird’s wing.",
   "Those shiny marks fit bird feet. Could this be an old flight route? I’d be thrilled if it didn’t involve any high places.",
   "Our letter would fit in that bird’s clip! Nell, it found a shortcut. Also, that shiny clip would look incredible in my hair.",
   "We can follow it from the floor, Pip. The marks lead to a charging perch, so a bird could use this old route while the main one’s off.",
   "The bird needs its clip, Mira. Now we know the letter had a carrier. We still need to find why the main bell can’t hear replies.",
   "Shimmy shimmy! A real clue, and nobody lost a hair clip. Let’s check the schoolroom stair and the back passage before spending notes."
  ]
 },
 "canal-fork": {
  "points": [
   {
    "target": "canal-fork-maintenance-map",
    "action": "examine"
   },
   {
    "target": "canal-fork-waiting-drop",
    "action": "listen"
   },
   {
    "target": "canal-fork-service-stool",
    "action": "search"
   }
  ],
  "lines": [
   "Follow the marked stones. Iris, check the water control, and Pip, look at the stool. Oren drew this map while checking the landings.",
   "There are claw marks by this warm pipe. Has my bird landed here? Please tell me its next stop has rails. Tall rails.",
   "Its clip’s warm too! That could heat the letter’s wax. Also, this pipe makes my hair look enormous. Is that useful?",
   "The pipe’s only warm, Pip. The map shows a call wire and a return wire. A broken return connection would stop the bell hearing replies.",
   "The clip is useful, Mira. That explains the warm wax, and the wire could explain the waiting boats. Let’s get those supplies moving.",
   "Then it’s the tower for us. My excellent reflection can wait. A shiny pipe isn’t going to carry anyone’s flour home."
  ]
 },
 "garden-final": {
  "points": [
   {
    "target": "garden-final-mended-clapper",
    "action": "examine"
   },
   {
    "target": "garden-final-extra-place",
    "action": "look"
   },
   {
    "target": "garden-final-kitchen-relay",
    "action": "search"
   }
  ],
  "lines": [
   "These small bells connect the nearby homes. Iris, check the spare place, and Pip, look at the message box. Mind that hot pot.",
   "The box can call, but nobody hears its answer. Are all those families waiting for us? What if I make it worse?",
   "Warm food, empty seats, and letters stuck outside. I could guard the soup while you check the bell. Extremely carefully. With a spoon.",
   "They need a repair, Pip. This reply wire’s loose, and the final rhythm lock guards it. Opening that lock lets us reconnect the homes.",
   "Soup after the repair, Mira. The public bell can’t hear replies either, but we can fix this smaller route for the families here.",
   "I’m on lamp duty, then. Fix the wire, get their deliveries and garden water moving, and only then investigate the soup. Understood."
  ]
 },
 "workshop-final": {
  "points": [
   {
    "target": "workshop-final-listening-ring",
    "action": "look"
   },
   {
    "target": "workshop-final-practice-patches",
    "action": "search"
   },
   {
    "target": "workshop-final-low-control",
    "action": "examine"
   }
  ],
  "lines": [
   "Keep the circle clear. Iris, check the practice tools, and Pip, try the low control. People learned to repair machines here.",
   "The lever reaches my stool! Could I help fix the controls? I’m excited, but I’d really like a lesson without sparks.",
   "Someone lowered that handle so Pip could help. I love this room! If I take the biggest chair, does that make me head teacher?",
   "We’ll check it before touching anything, Pip. The reply connection’s loose. Open the last lock, and we can fix the listening control.",
   "You can help without claiming a throne, Mira. Then children can make music here, and new repairers can learn to help other routes.",
   "Fine, I’ll share the important chairs. A working schoolroom means more people who know what to do, instead of Iris fixing everything."
  ]
 },
 "canal-final": {
  "points": [
   {
    "target": "canal-final-route-lamps",
    "action": "examine"
   },
   {
    "target": "canal-final-reply-dish",
    "action": "listen"
   },
   {
    "target": "canal-final-keeper-flask",
    "action": "search"
   }
  ],
  "lines": [
   "Watch the open edge. Iris, check the receiving dish, and Pip, look at the lamps. We’ve reached the public bell controls.",
   "That little lamp’s trying to answer. Why can’t the bell hear it? I feel awful for it. And I’m still worried about this edge.",
   "All those boats depend on this room. Also, I can see my whole street from here! Iris, can you show me the broken part?",
   "It isn’t ignoring the lamp, Pip. The bell’s return wire has come loose. Calls go out, but replies can’t get back, so it keeps waiting.",
   "Eyes on the controls, Mira. The last lock needs its own four-beat key. Check the bag before trying to reach that loose wire.",
   "Right, fix first, sightseeing later. Then the bell can hear the islands again, and another delivery won’t have to turn back."
  ]
 },
 "garden-alcove": {
  "points": [
   {
    "target": "garden-alcove-cleared-patch",
    "action": "search"
   },
   {
    "target": "garden-alcove-root-cradle",
    "action": "examine"
   },
   {
    "target": "garden-alcove-flower-stone",
    "action": "look"
   }
  ],
  "lines": [
   "Step carefully. Iris, check the little instrument, and Pip, look at the flower stone. Someone’s cleared the leaves from this corner.",
   "That stone flower has one shiny petal. Has somebody polished it? I know it’s silly, but it feels like it’s watching me.",
   "The roots bend around that flower stone. Someone kept it clear! I wonder if we could grow a flower big enough to sit in.",
   "It’s polished stone, Pip. The petal’s smooth because someone’s touched it often, and the cleared leaves show they’ve been here recently.",
   "One puzzle at a time, Mira. Let’s look closely before we leave. Someone still visits this corner, and we should find out why.",
   "Shimmy shimmy! We found a clue people walk right past. My giant flower can wait. I want to know who’s been here."
  ]
 },
 "workshop-alcove": {
  "points": [
   {
    "target": "workshop-alcove-wing-wraps",
    "action": "examine"
   },
   {
    "target": "workshop-alcove-roost-marks",
    "action": "search"
   },
   {
    "target": "workshop-alcove-hollow-perch",
    "action": "look"
   }
  ],
  "lines": [
   "Stay off the high rail. Iris, check the bird marks, and Pip, look at that perch. These old wing wraps are still clean.",
   "My birds used to rest here, and somebody’s brushed their perch. Was it a friendly somebody? This attic gives me the shivers.",
   "The marks come in pairs, with space to land. A bird bedroom! Those little wraps look cozy. Could we stop for a very tiny nap?",
   "There’s a cleaning brush beside it, Pip. Bird feet made those smooth marks. They’ve used this stop even though our map’s forgotten it.",
   "After we find our way onward, Mira. Someone still cares for these birds. Look around carefully and see where they went next.",
   "All right, no nap. We found a bird stop by following tiny footprints. Next time I’m asking the smallest traveler for directions first."
  ]
 },
 "garden-secret-final": {
  "points": [
   {
    "target": "garden-secret-final-second-controls",
    "action": "examine"
   },
   {
    "target": "garden-secret-final-chair",
    "action": "search"
   },
   {
    "target": "garden-secret-final-open-window",
    "action": "listen"
   }
  ],
  "lines": [
   "Two controls share this window. Iris, check the chair, and Pip, listen for a call from the other island.",
   "I heard two notes! Is someone waiting over there? I hope they’re friendly. Iris, how can you stand so close without worrying?",
   "Iris, you kept this place ready for your friend. I nearly started arranging the cups. Can this window reach her while the bell’s quiet?",
   "It’s a call, Pip. This window has its own reply wire, behind the last lock. I kept her cup ready because I want her to visit.",
   "We’ll sort the cups afterward, Mira. First we fix this small route, ask if she’s safe, and give her time to answer.",
   "You’re right. Her answer matters more than my fancy table setting. Let’s check whether we kept the two notes this last door needs."
  ]
 },
 "workshop-secret-final": {
  "points": [
   {
    "target": "workshop-secret-final-two-traces",
    "action": "examine"
   },
   {
    "target": "workshop-secret-final-small-step",
    "action": "search"
   },
   {
    "target": "workshop-secret-final-small-horn",
    "action": "listen"
   }
  ],
  "lines": [
   "Small feet polished that step. Iris, check the screen, and Pip, listen at the little horn. Someone built it for a bird.",
   "My birds use that horn! What have they been trying to tell us? Oh no. What if they’re angry because I didn’t listen?",
   "They need a way to send their own reply. Someone made a control for tiny feet! Now I want to see a bird press every button.",
   "A different tune doesn’t mean anger, Pip. Their reply wire’s loose behind the last lock. We can fix it, though the main bell still needs work.",
   "One working control is enough, Mira. Their old perches brought our letter home, so let’s finish this route and let the birds answer.",
   "Fair. We’ll open the lock, give them room, and actually listen. Our smallest helpers deserve a turn to speak for themselves."
  ]
 },
 "final-concourse": {
  "points": [
   {
    "target": "final-concourse-home-board",
    "action": "examine"
   },
   {
    "target": "final-concourse-service-map",
    "action": "search"
   },
   {
    "target": "final-concourse-bird-step",
    "action": "listen"
   }
  ],
  "lines": [
   "Our journal kept every result, even the failed trips. These controls let us connect all five services in one journey.",
   "The birds get a little horn of their own? Please tell me we aren’t leaving their line out just because the big bell’s louder.",
   "Five lines! Homes, music class, bell, birds, Iris’s window. It looks like a plate of noodles, but I can trace every one.",
   "A louder bell won’t connect that horn, Pip. Each service needs its own return wire. We know how to check them now.",
   "Follow the wires, Mira. Starting again reset the repairs, but we kept the lessons. Now we can put them together.",
   "Right. Less noodle admiration, more useful pointing. The homes’ line joins that one, and the bird step reaches this horn. We’re doing the whole job!"
  ]
 },
 "final-heart": {
  "points": [
   {
    "target": "final-heart-return-clamp",
    "action": "examine"
   },
   {
    "target": "final-heart-reply-screen",
    "action": "search"
   },
   {
    "target": "final-heart-class-controls",
    "action": "look"
   }
  ],
  "lines": [
   "The smaller lines are ready. We’ll fasten the main return wire here, then test whether every service can answer the bell.",
   "What if the birds’ little lamp stays dark? I’ll watch it. I know their tune now, and I don’t want anyone to miss it.",
   "That little handle’s low enough for a child! Oh, and this clamp fits the loose wire. We can fix the line and leave a place for the next helper.",
   "The low handles let learners help with repairs. Pip, watch the bird-shaped switch; that lamp shows whether their line works.",
   "No testing handles yet, Mira. Fasten the wire first. Then watch for all five replies, including the classroom and Iris’s window.",
   "Wire first, curious poking later. Pip’s got the birds, Iris has the window, Nell has the bell, and I’m checking the homes and class. Nobody gets missed!"
  ]
 },
 "ending-home": {
  "points": [
   {
    "target": "ending-home-memory",
    "action": "examine"
   },
   {
    "target": "ending-home-reply",
    "action": "listen"
   },
   {
    "target": "ending-home-trace",
    "action": "search"
   }
  ],
  "lines": [
   "The final lock’s open, and I’ve fastened the homes’ loose reply wire. Can you hear their bells answering?",
   "My bird brought the letter home along old perches. Its warm clip heated the wax. Was it helping us all along? I’m so proud!",
   "So the letter didn’t fly home alone. A tiny mail bird found a route our map had lost! And there’s bread. I love a useful discovery.",
   "We can thank it after the test, Pip. The main bell’s return connection broke. This fixed local wire lets the homes send replies again.",
   "It’s supper time now, Mira. These families have deliveries and garden water again. Other routes still need repairs, but this area works.",
   "Permission to eat! My stomach’s ready for supper, and we’ve got a mystery solved and a useful repair done. Can we share that loaf?"
  ]
 },
 "ending-school": {
  "points": [
   {
    "target": "ending-school-trace",
    "action": "examine"
   },
   {
    "target": "ending-school-reply",
    "action": "search"
   },
   {
    "target": "ending-school-memory",
    "action": "look"
   }
  ],
  "lines": [
   "I’ve reconnected the classroom’s reply wire, and the listening machine can hear its learners again.",
   "Our bird returned Nell’s letter on old perches. Its warm clip heated the wax. Does it know how helpful that was? I might cry.",
   "We followed a bird’s shortcut and opened a whole classroom! I could give a speech. Or try that incredibly shiny button.",
   "Tears are optional, Pip. The public bell’s return connection broke. We fixed this local control so people can practice and learn repairs.",
   "Step away from the button, Mira. Children can make music here and learn to help the other routes. The wider network still needs work.",
   "Fine, my first lesson is “ask before pressing things.” Let’s leave the next learner a seat. I think they’re going to like it here."
  ]
 },
 "ending-public": {
  "points": [
   {
    "target": "ending-public-memory",
    "action": "examine"
   },
   {
    "target": "ending-public-reply",
    "action": "listen"
   },
   {
    "target": "ending-public-trace",
    "action": "search"
   }
  ],
  "lines": [
   "The lock’s open, and the bell’s loose return wire is fastened. Watch those lamps for an answer.",
   "My bird returned our letter along old perches. Its warm clip heated the wax. Can we get it a new perch? I want everyone to cheer!",
   "We followed its clues all the way here! I’ve got a victory speech ready. It’s mostly about birds and how brilliant we all look.",
   "The lights confirm it, Pip. The bell can hear replies again. Its broken wire had blocked them while the whole town waited.",
   "Let the bell do the announcing, Mira. Boats can bring supplies, gardens can get water, and delivery birds know where to land.",
   "Shimmy shimmy! That’s better than my speech. People have been waiting for help, and now the evening bell can hear them answer!"
  ]
 },
 "ending-secret-quiet": {
  "points": [
   {
    "target": "ending-secret-quiet-memory",
    "action": "examine"
   },
   {
    "target": "ending-secret-quiet-reply",
    "action": "look"
   },
   {
    "target": "ending-secret-quiet-trace",
    "action": "listen"
   }
  ],
  "lines": [
   "The window’s reply wire is connected. Iris, call your friend, and let’s listen for her answer.",
   "My bird returned the letter by an old route, and its warm clip heated the wax. Could it carry Iris’s letters too? I’d feel better.",
   "The public bell lost its return connection, but we found another way for two friends to talk. I’ll get the cups! Where are the cups?",
   "There’s her voice, Pip. She’s safe on her island, and she’d like to visit when the routes are ready. That’s the answer I needed.",
   "Let Iris finish listening, Mira. This little window works again. The town bell still needs repair, but her friend can answer now.",
   "Right, no rattling cups during an important call. Iris kept that chair ready, and now they can plan a real visit. I’ll help welcome her."
  ]
 },
 "ending-secret-birds": {
  "points": [
   {
    "target": "ending-secret-birds-memory",
    "action": "examine"
   },
   {
    "target": "ending-secret-birds-trace",
    "action": "search"
   },
   {
    "target": "ending-secret-birds-reply",
    "action": "listen"
   }
  ],
  "lines": [
   "The little horn’s reply wire is fixed, and the birds can send their own calls again. Quiet, everyone. It’s their turn.",
   "One bird returned our letter on the old perches. Its warm clip heated the wax. Can I thank it now? I’m bursting to hear its tune!",
   "We thought the birds needed directions, but they were showing us a path. That horn’s tiny! Do you think I could play it with one finger?",
   "Listen to the signal, Pip. The public bell’s broken return connection blocked their replies. This repaired small route lets them through.",
   "Leave their horn alone, Mira. The birds can ask for help and confirm safe landings. The main bell still needs work, but this route works.",
   "Shimmy shimmy! Bird solo! Pip finally gets to hear their own calls, and I’m listening. I expect strong opinions about perch height."
  ]
 },
 "dead-brambles": {
  "points": [
   {
    "target": "dead-brambles-memory",
    "action": "examine"
   },
   {
    "target": "dead-brambles-trace",
    "action": "search"
   },
   {
    "target": "dead-brambles-reply",
    "action": "look"
   }
  ],
  "lines": [
   "Stop before the roots. Iris, check the wall, and Pip, wait by the bench. We need to know if this path’s safe.",
   "Those roots hold up the stones! Can we stay beside this solid bench? I’m telling the roots I like their work. Just in case.",
   "The garden’s grown right across our path. That’s impressive. Could we climb it? I’ve always wanted a tree-house entrance.",
   "The roots hold the wall together, Pip. They aren’t chasing us. Pulling them out would loosen the stones, so this path stays blocked.",
   "No climbing, Mira. The south service gate costs another four beats. The arch’s notes stay spent, so count what later doors will need.",
   "Okay, no tree-house entrance. The south gate reaches the garden paths, but it won’t replace that final key. I’m writing this down."
  ]
 },
 "dead-aviary": {
  "points": [
   {
    "target": "dead-aviary-trace",
    "action": "search"
   },
   {
    "target": "dead-aviary-memory",
    "action": "examine"
   },
   {
    "target": "dead-aviary-reply",
    "action": "look"
   }
  ],
  "lines": [
   "Keep away from the loose cable. Iris, check the nest, and Pip, look at the little bird. There’s no exit ahead.",
   "That tired bird’s found a sunny seat. Would it like this clean wing wrap? I’m worried about leaving it here by itself.",
   "Someone made a bird resting room. We found a dead end, but also a patient! Should we build it a tiny bed? Maybe a pillow?",
   "The nest keeps it safe, Pip. The northern wall is solid, but a paid service gate opens from the south. We need to count its cost.",
   "The nest is enough, Mira. The south gate needs Pip’s three gift tiles, and it costs another four beats. The earlier key stays spent.",
   "One comfortable bird, no extra furniture. Got it. A longer route needs more notes, so my clever shortcut may cost us our final key."
  ]
 },
 "dead-ferry": {
  "points": [
   {
    "target": "dead-ferry-memory",
    "action": "examine"
   },
   {
    "target": "dead-ferry-trace",
    "action": "search"
   },
   {
    "target": "dead-ferry-reply",
    "action": "look"
   }
  ],
  "lines": [
   "Stay behind the rail. Iris, check the lamp, and Pip, look at the rope from here. Oren’s tea tray is still ready.",
   "The rope’s repaired, but where’s the boat? I’d really like to stay on dry stone until it arrives. Please tell me we’re not swimming.",
   "A good rope won’t carry us across the canal by itself. What if I make a very brave hop? A heroic, extremely long hop?",
   "No swimming, Pip. Our lamp sends a call, but no landing answers it, so a crew can’t bring the ferry here safely yet.",
   "No heroic hopping, Mira. This run ends here, but our journal keeps the clue. Next time, we’ll use Oren’s delivery gate.",
   "Dry stone it is. Next time we’ll take Oren’s delivery gate. I’ll remember this landing—and the tea. We can plan a better route."
  ]
 },
 "dead-echo": {
  "points": [
   {
    "target": "dead-echo-trace",
    "action": "search"
   },
   {
    "target": "dead-echo-memory",
    "action": "examine"
   },
   {
    "target": "dead-echo-reply",
    "action": "listen"
   }
  ],
  "lines": [
   "Stay on this side of the bowl. Iris, check the channel, and Pip, listen to that sound. Oren’s map ends here.",
   "Is that my own call coming back? I nearly said hello! I don’t like something copying us when we can’t see who’s doing it.",
   "That echo’s copying us perfectly. I could make it sing a duet! Although I suppose it can’t tell us much about the broken bell.",
   "It’s sound bouncing off that wall, Pip. There’s no other person or machine replying. The water channel ends here.",
   "Save the duet, Mira. The south stair reaches the tower for another four beats. The final lock still needs its own four-beat answer.",
   "All right, no duet. We spent a key to get here, and the south stair needs another. Let’s count what the tower will need before paying."
  ]
 },
 "ending-complete": {
  "points": [
   {
    "target": "ending-complete-memory",
    "action": "examine"
   },
   {
    "target": "ending-complete-trace",
    "action": "search"
   },
   {
    "target": "ending-complete-reply",
    "action": "listen"
   }
  ],
  "lines": [
   "The bell hears all five lines. Homes have water and deliveries, and the ferry has its safe-landing reply. All four of us are here.",
   "My bird’s playing its own tune! Do we clap, or will that frighten it? I might cry, but I’ll try to do it quietly.",
   "The music room’s answering too! Lessons, repair practice, bird songs—and Iris, isn’t that your friend’s voice? Tell her we’re coming for tea!",
   "Her ferry arrived safely. She’s at Nell’s depot with the kettle on. Pip, the bird can hear applause. I suspect it’ll survive yours.",
   "Well spotted, Mira. Every repair was made on this trip, with what our journal taught us. Now all four of us can rest.",
   "Shimmy shimmy! We brought the whole town’s answers back, and nobody got left behind. The bag’s empty, the bread isn’t, and I’m calling that perfect."
  ]
 }
};

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function along(path,length){
 for(let index=1;index<path.length;index++){
  const from=path[index-1],to=path[index],leg=distance(from,to);
  if(length<=leg){const progress=leg?length/leg:0;return{x:from.x+(to.x-from.x)*progress,y:from.y+(to.y-from.y)*progress};}
  length-=leg;
 }
 return{...path.at(-1)};
}
const actors=['nell','iris','pip'],speakers=['nell','pip','mira','iris','nell','mira'];

function stage(roomId,{points,lines}){
 const scene=CAMPAIGN_SCENES[roomId],content=CAMPAIGN_CONTENT[roomId];
 if(!scene||!content)throw new Error(`Unknown cutscene location: ${roomId}`);
 if(points.some(point=>!scene.geometry.targets.some(target=>target.id===point.target)))throw new Error(`Unknown cutscene target in ${roomId}`);
 const walk=(actor,index,patch={})=>({id:`${roomId}-${actor}-investigate`,kind:'walk',actor,target:points[index].target,action:points[index].action,startTile:actor==='pip'?1:0,durationTiles:1,...patch});
 const provisional=actors.map((actor,index)=>walk(actor,index,actor==='pip'?{gait:'run'}:{}));
 const preview=compileRoomCutscene({scene,beats:provisional}),pipRoute=preview.clips.find(clip=>clip.actor==='pip');
 const stumbleAt=along(pipRoute.path,pipRoute.pathLength*.65);
 const movement=[
  walk('nell',0),walk('iris',1),
  walk('pip',2,{id:`${roomId}-pip-rush`,target:undefined,destination:stumbleAt,gait:'run'}),
  {id:`${roomId}-mira-observe`,kind:'walk',actor:'mira',action:'look',destination:{x:scene.geometry.start.x-64,y:scene.geometry.start.y-128},startTile:1,durationTiles:1},
 ];
 const first=compileRoomCutscene({scene,beats:movement});
 for(const raw of movement){const clip=first.clips.find(clip=>clip.id===raw.id);raw.durationTiles=clip.movementTiles||1;}
 const rush=first.clips.find(clip=>clip.actor==='pip'),tripStart=rush.startTile+rush.movementTiles;
 const gesture=(actor,name,startTile,durationTiles)=>({id:`${roomId}-${actor}-${name}`,kind:'gesture',actor,gesture:name,startTile,durationTiles});
 const trip=gesture('pip','trip',tripStart,4),fallen=gesture('pip','fallen',tripStart+4,5),recover=gesture('pip','recover',tripStart+9,6);
 const finish=walk('pip',2,{id:`${roomId}-pip-arrive`,gait:'run',startTile:recover.startTile+recover.durationTiles});
 const staging=[...movement,trip,fallen,recover,finish];
 const compiled=compileRoomCutscene({scene,beats:staging});
 finish.durationTiles=compiled.clips.find(clip=>clip.id===finish.id).movementTiles||1;
 const iris=compiled.clips.find(clip=>clip.actor==='iris'&&clip.kind==='walk');
 const quantum=scene.geometry.gridSize/scene.geometry.speed*1000;
 let cursor=0;
 const dialogue=lines.map((text,index)=>{
  const durationTiles=Math.ceil(Math.max(3000,Math.min(5600,950+text.length*31))/quantum);
  const item={id:`${roomId}-arrival-${index+1}`,kind:'dialogue',actor:speakers[index],speaker:speakers[index],text,startTile:cursor,durationTiles};
  if(roomId==='depot'){
   if(index===1){item.reaction={emote:'surprise',durationTiles:14};item.stageCue='courier-signal';}
   else if(index===3)item.stageCue='radar';
   else if(index===5)item.stageCue='courier-signal';
  }
  cursor+=durationTiles;return item;
 });
 const magnifyStart=iris.startTile+iris.movementTiles;
 const magnify=gesture('iris','magnify',magnifyStart,Math.max(16,dialogue[3].startTile+dialogue[3].durationTiles-magnifyStart));
 const emote=(actor,name,startTile,durationTiles,suffix=name)=>({id:`${roomId}-${actor}-emote-${suffix}`,kind:'emote',actor,emote:name,startTile,durationTiles});
 const reactions=[
  emote('nell','thinking',0,16),emote('iris','thinking',0,16),emote('pip','happy',0,Math.max(1,tripStart)),emote('mira','idea',0,18),
  emote('pip','surprise',trip.startTile,trip.durationTiles),emote('pip','question',fallen.startTile,fallen.durationTiles),emote('pip','happy',recover.startTile,recover.durationTiles,'recovered'),
  emote('iris','idea',Math.max(magnifyStart,16),12),
 ];
 return[...staging,magnify,...dialogue,...reactions];
}

// Plain raw authoring data: each channel stays individually editable. The
// helper only establishes shipped defaults; saved projects keep their timings.
export const ROOM_CUTSCENES=freeze(Object.fromEntries(Object.entries(arrivals).map(([id,arrival])=>[id,stage(id,arrival)])));

/** Unknown locations never borrow another room's arrival. */
export function getRoomCutscene(id){return typeof id==='string'&&Object.hasOwn(ROOM_CUTSCENES,id)?ROOM_CUTSCENES[id]:null;}
