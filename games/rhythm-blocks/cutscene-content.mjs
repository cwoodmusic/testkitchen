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
   "This letter came back with warm wax. Iris, check the screen. Pip, watch your bird. We need to find who brought it home.",
   "He keeps looking toward that dark route. Does he know a way through? I hope he does not expect me to fly.",
   "A warm letter and a bird with a secret path. I can eat breakfast later. Where do we start?",
   "This flash shows a message going out. The next light should show that it arrived. That light stays dark.",
   "Deliveries are waiting. We must find which routes still work. Nobody touches a wire until Iris checks it.",
   "Watch the bird: it turns before the screen flashes. Maybe it knows a path our map has missed. Let us follow its clues."
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
   "Mind the roots. Iris, check your water pipe. Pip, look at that old metal panel. These plants need water soon.",
   "The seed jars are using a machine part as a shelf! That root moves when the pipe sounds. Will it stay out of my boots?",
   "A fine new job for an old machine part. Iris, why have you set out two cups when you are here alone?",
   "My friend lives on another island. I keep her cup ready. Since the bell stopped, her messages have not reached me.",
   "Then we shall help this garden and look for her reply. Ask Iris for her note tiles before choosing the next door.",
   "The root moves when the pipe calls, but no water comes out. Let us find where the answer gets lost."
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
   "Leave the winding keys alone for now. Iris, check the bowl. Pip, inspect your practice wing. This old bird feather may be a clue.",
   "That wing moved before I touched it! Is another bird calling it? Everyone stay where I can see you.",
   "A room full of clockwork birds, and Pip still puts out seed. Do the real birds come to visit?",
   "They do. These small charging perches also work on their own. The birds can still move while the main bell is quiet.",
   "The feather fits an old kind of mail bird. Someone has kept those birds working. We should find out where they go.",
   "That bird waits for its partner before moving. It is watching for an answer. Perhaps that is what our letter was missing."
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
   "Stay behind the landing rail. Iris, check the message machine. Pip, listen at the small bell. I will read these delivery labels.",
   "My bird keeps listening, but the bell stays quiet. Is a boat supposed to answer? I would like to know before going near the water.",
   "Oren has food boxes ready, but no boat can arrive safely yet. That has become a very important little bell.",
   "The boat waits for the landing to answer. Without that reply, its crew cannot tell whether the landing is safe.",
   "People on the next island need flour and clothes. We will follow Oren’s map toward the bell controls.",
   "Then let us get those supplies moving. I can ask about the warm letter while we walk. And perhaps about Oren’s biscuits."
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
   "This handle has been repaired several times. Iris, check the old stones. Pip, listen at the cups. Someone still tends this path.",
   "Tiny claw marks run beside the cups. My bird knows this old path. Do you think anything much larger uses it?",
   "A path missing from Nell’s map! A small bird could have brought our letter back this way.",
   "The old path has its own message wire. This side can still answer. The bell’s main return connection must have failed.",
   "The hearth path reaches the homes. The old stones lead deeper into the garden. Choose one phrase and keep the other notes safe.",
   "I want to know who kept this old path clear. Let us look at the objects before we choose."
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
   "Iris, study the screen. Pip, check the rail from the floor. Several people have repaired this bird’s wing.",
   "Bird feet polished both ends of that rail. Our hands never touch those spots. Could it be an old flight route?",
   "Our returned letter could fit in a bird’s carrying clip. Nell, I think one of Pip’s birds found a shortcut.",
   "The marks lead toward a charging perch. A bird could carry mail along this old route while the main route is off.",
   "Then the letter did not move by itself. We must find why the main bell cannot hear the replies coming back.",
   "The schoolroom stair and that back passage lead to different places. Let us check the clues before spending our notes."
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
   "Follow the marked stones. Iris, check the water control. Pip, look at the stool. Oren drew this map while checking the landings.",
   "There are tiny claw marks by this warm pipe. Has my bird landed here? Please tell me the rest of its route has rails.",
   "Its carrying clip feels warm too! That could warm the wax on a letter. We can compare it with Nell’s seal.",
   "The map shows two wires for each route. One sends the call. A broken return connection would stop the bell hearing replies.",
   "That would explain the waiting boats. We need to reach the bell controls so people can receive their supplies.",
   "Then we follow the real route to the tower. A pretty reflection will not carry a bag of flour home."
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
   "These small bells connect the nearby homes. Iris, check the spare place. Pip, look at the message box. Mind the hot pot.",
   "The box can send a call, but nobody hears its answer. Are all those families waiting for us?",
   "Warm food, empty seats, and letters stuck outside. Let us get this little bell working.",
   "Its reply wire is loose. The final rhythm lock covers the fixing point. Opening it will let us reconnect the homes.",
   "The public bell has the same problem: it cannot hear a reply. We can repair this smaller route for the families here.",
   "Then their deliveries and garden water can move again. Use the last phrase, and I will hold the lamp steady."
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
   "Keep the circle clear. Iris, check the practice tools. Pip, try the low control. People learned to repair machines in this room.",
   "The lever reaches my stool now! Could I help repair the controls? I would like a lesson without sparks.",
   "Someone lowered the handle so Pip could use it. This room gives small people a real job. I like that.",
   "The machine needs a working reply connection. The last lock guards that part. Open it, and we can reconnect the listening control.",
   "Then children can make music here again, and new repairers can learn to help the other routes.",
   "A working schoolroom means more people who know what to do. That sounds much better than making Iris fix everything."
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
   "Watch the open edge. Iris, check the receiving dish. Pip, look at the lamps. We have reached the public bell controls.",
   "That small lamp is trying to answer. Why can the bell not hear it? Please stay close while I look at the wire.",
   "All those waiting boats depend on this place. Iris, can you show us the broken part?",
   "Here: the bell’s return wire has come loose. Calls can go out, but replies cannot get back. The bell keeps waiting.",
   "The last lock guards the fixing point. Use our final phrase, and we can fasten the wire safely.",
   "Then the bell can hear the islands again. Let us finish this before another delivery has to turn back."
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
   "Step carefully. Iris, check the little instrument. Pip, look at the flower stone. Someone has cleared the leaves from this corner.",
   "The flower stone has one shiny petal. Has somebody polished it? It is much brighter than the others.",
   "The roots bend around that flower stone. Somebody kept it clear after people stopped using this path.",
   "The stone petal has smooth edges. Someone has touched it many times. The leaves around it have been cleared.",
   "Let us look closely before we leave. Someone still visits this corner. There may be a reason it has stayed clear.",
   "An old garden can tell us who has been here. I am glad we looked closely instead of walking past that flower."
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
   "Stay off the high rail. Iris, check the bird marks. Pip, look at that perch. These old wing wraps are still clean.",
   "My birds used to rest here. Someone has brushed their perch recently. Was it a friendly someone?",
   "The marks come in pairs, with spaces between them. Even a tiny bird needs room to land.",
   "Bird feet made those smooth marks. The perch has been used often, though our map no longer shows this stop.",
   "Someone still cares for these birds. Look around carefully before we move on. We may learn where they went next.",
   "We found an old bird stop by following its feet. Next time I shall ask the smallest traveler for directions first."
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
   "Two controls share this little window. Iris, check the chair. Pip, listen for a call from the other island.",
   "I heard two notes! Is someone waiting over there? I hope they know we are friendly.",
   "Iris, you kept this place ready for your friend. Can this old window reach her while the public bell is quiet?",
   "Yes. It has its own reply wire. The last lock protects it. I keep her cup here because I want her to visit.",
   "Then we repair this small route and ask if she is safe. We will wait for her answer.",
   "A real answer from a real friend. That is worth using the notes we saved."
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
   "Small feet polished this step. Iris, check the screen. Pip, listen at the little horn. Someone built it for a bird.",
   "My birds use that horn! I thought they only copied our calls. What have they been trying to tell us?",
   "They need a way to send their own reply. Someone made this control low enough for their feet.",
   "Their reply wire is loose behind the last lock. We can reconnect it. The bell’s larger return wire still needs repair.",
   "Their old perches brought our letter home. Let us finish this route so the birds can answer safely.",
   "Then open the lock. Our smallest helpers deserve a turn to speak."
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
   "The final lock is open. I have fastened the homes’ loose reply wire. Hear their bells answer?",
   "My bird brought the letter back along old perches. Its warm clip heated the wax. Was it helping us all along?",
   "So the letter did not fly home alone. A tiny mail bird found a route our map had lost.",
   "The main bell went quiet because its return connection broke. This repaired local wire lets the homes send replies again.",
   "These families can receive deliveries and water their gardens. Other routes still need repairs, but this neighborhood is working.",
   "A clear answer and a useful repair. Now my stomach is ready for supper. Can we share that loaf?"
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
   "I have reconnected the classroom’s reply wire. The listening machine can hear the learners again.",
   "Our bird returned Nell’s letter on the old perches. Its warm clip heated the wax. Does it know how helpful that was?",
   "We followed a bird’s shortcut and opened this room. Next time I shall watch the smallest traveler first.",
   "The public bell stopped when its return connection broke. We repaired this local control, so people can practice and learn repairs.",
   "Children can make music here again. New repairers can learn to help the other routes. The whole network still needs work.",
   "Then let us leave the next learner a seat. I can teach one lesson: ask questions before pressing the shiny button."
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
   "The lock is open, and the bell’s loose return wire is fastened. Watch the lamps for an answer.",
   "My bird returned our letter using the old perches. Its warm clip heated the wax. Can we thank it with a new perch?",
   "We followed its clues all the way here. I shall try listening to small birds before making large speeches.",
   "The bell can hear replies again. Its broken wire had blocked them. The whole town was waiting for messages that could not arrive.",
   "The routes are ready. Boats can bring supplies, gardens can get water, and delivery birds know where to land.",
   "Then let the evening bell ring! People have been waiting for help. Now they can answer us."
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
   "The window’s reply wire is connected. Iris, your friend can hear your call now. Let us listen.",
   "My bird found the old route that brought the letter home. Its warm clip heated the wax. Could it carry Iris’s letters too?",
   "The public bell lost its return connection. We found another way for two friends to hear each other.",
   "That is her voice. She is safe on her island. She says she would like to visit when the routes are ready.",
   "This listening window works again. The town bell still needs repair, but Iris no longer has to wonder about her friend.",
   "Iris kept the chair ready, and now her friend has answered. I will help set out the cups. A visit needs a proper welcome."
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
   "The little horn’s reply wire is fixed. The birds can send their own calls again. Quiet, everyone; this is their turn.",
   "One bird brought our letter home by the old perches. Its warm carrying clip heated the wax. Can I thank it now?",
   "We thought the birds needed directions. They were trying to show us a working path.",
   "The public bell’s broken return connection blocked their replies. This repaired small route lets their signals get through.",
   "The birds can ask for help and confirm safe landings. The main bell still needs work, but this route now has an answer.",
   "And Pip finally gets to hear his birds’ own calls. I expect very strong opinions about perch height."
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
   "Stop before the roots. Iris, check the wall. Pip, wait by the bench. We need to see whether this path is safe.",
   "Those roots hold up the stones! Shall we stay beside this solid bench? Please tell the roots I like their work.",
   "The garden has grown right across our path. I admire its effort, but I cannot see a way through.",
   "The roots hold the wall together. Pulling them out would loosen the stones. This path is blocked.",
   "We can go back safely. Revisit our previous choice to get the door’s notes back. The tiles still in our bag are safe.",
   "Then we return to Iris’s porch and try the listening gate. We have learned where this path ends."
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
   "Keep away from the loose cable. Iris, check the nest. Pip, look at the little bird. This old room has no exit ahead.",
   "A tired bird has found a sunny seat. Would it like this clean wing wrap? It can have the warmest spot.",
   "Someone made a resting room for birds. We chose a dead end, but we still found someone who needed care.",
   "The wall behind the nest is solid. A repair here would not make a doorway. We must return the way we came.",
   "Revisit the previous choice to recover the notes this door used. Our other notes are still safe in the bag.",
   "We will leave the bird comfortable and try Pip’s running gate. I can save my clever shortcuts for a real path."
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
   "Stay behind the rail. Iris, check the lamp. Pip, look at the rope from here. Oren’s tea tray is still ready.",
   "The rope is repaired, but where is the boat? I would like to stay on dry stone until it gets here.",
   "A good rope cannot carry us across the canal by itself. Even I need a boat for this plan.",
   "Our lamp sends a call, but no landing answers it. A crew cannot bring the ferry here safely yet.",
   "We must turn back. Revisit our previous choice to recover the door’s notes, then follow the delivery gate.",
   "Oren is still waiting for supplies too. Let us find the route that can actually reach the bell controls."
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
   "Stay on this side of the bowl. Iris, check the channel. Pip, listen to the sound. Oren’s map ends here.",
   "Is that my own call coming back? I nearly said hello to it. I am glad I did not ask it for directions.",
   "An echo has copied us perfectly. Sadly, it cannot tell us anything new about the broken bell.",
   "The water channel ends at this wall. Our sound bounces back from it. There is no person or machine sending a reply.",
   "This is a dead end. Revisit the previous choice to recover the notes, then take the path toward the town bell.",
   "Next time we shall listen for an answer from someone else. We can learn from a wrong turn and still get home."
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
