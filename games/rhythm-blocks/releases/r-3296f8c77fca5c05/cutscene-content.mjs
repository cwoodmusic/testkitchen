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
   "Spread out, please. I checked this tray myself. Iris, the map; Pip, the roost. A warm seal has a history.",
   "My courier heard something! Is it behind us? Ah! No, only my feet. I am up. Please do not let the letter bite.",
   "A letter that delivered itself home? I like its nerve. Can we chase its mystery past a bakery? I missed breakfast.",
   "The screen receives a pulse but records no reply. I will check the interval. Letters lack the anatomy required for biting.",
   "Quite. I know this relay. Look before touching, Pip; I would prefer to investigate one mystery at a time.",
   "Then watch the bird: it turns before the screen flashes. Our smallest witness has spotted something we missed."
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
   "Mind the roots. Iris, examine the graft; Pip, the survey plate. I recognise the repairs on this second cup.",
   "The seed jars conquered a survey plate! That root moved! Whoa! I am fine. Does it know I am not a vegetable?",
   "A brave victory for vegetables. Iris, does your garden usually annex government property before breakfast?",
   "Only unused property. This root tightens when the pipe sounds. The glass will show where the movement begins.",
   "The handle was mended for the next visitor. Useful work often proceeds without a proclamation, Mira. Do keep up.",
   "Look: two cups, one warm chair. Someone planned for company. I intend to be excellent, if slightly muddy, company."
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
   "No winding anything yet. Iris, check the bowl. Pip, your wing jig. This old postal feather was set aside carefully.",
   "My repaired wing! It moved by itself! Ah! I meant to look underneath it. Briefly. Are we certain it likes me?",
   "Your reputation has feathers; it will recover. Why does a room full of metal birds need a bowl of seed?",
   "Fresh husks and scratches at the rim. I will compare them through the glass. The mechanical birds appear to have dietary opinions.",
   "That hinge predates Pip. Somebody kept an awkward part because its owner mattered. A familiar postal problem.",
   "There: one wing waits for the other. They learned manners from each other. Pip, your machines are outgrowing us."
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
   "Stay behind the landing rail. Iris, the console; Pip, the small bell. I will read these old delivery seals.",
   "That bell knows my courier! Did it ring? Whoops! Only me. Please tell the water I have no intention of visiting.",
   "A wise diplomatic position. Oren, your enormous navigator appears to be losing an argument with a wooden wedge.",
   "The wedge holds its contact open. The wear is recent. I will inspect the mechanism. Nobody remove the wood.",
   "Oren adapts what still works. These seals carried flour and winter coats. Remember the people behind the machinery.",
   "And his tea has a place among all those switches. I respect any solution that leaves room for a person and a biscuit."
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
   "Three repairs on this handle. Iris, inspect the old paving; Pip, listen at the cups. Nobody uproot anything.",
   "The cups are singing! Or whispering? At me? Oh! Just the breeze. I am all right. Is that definitely a breeze?",
   "Good. The ground is famously difficult to lose. Nell, that watering can has had more adventures than our parcel.",
   "The grooves continue beneath the roots. Their edges are intact. Pulling them apart would destroy our evidence. Also the roots.",
   "Repairs do not erase a history. Neither do new roots. We will examine both paths before declaring a favourite.",
   "One cup is missing, but the breeze plays that space too. Empty places are terrible at being empty. Except my stomach."
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
   "Iris, study the screen. Pip, check that rail without climbing it. Three different hands have stitched this wing.",
   "Tiny feet polished the rail! Something tiny is behind me! Ow! My own bird. I knew that. Mostly. I am getting up.",
   "We will omit that from your biography. Iris, does the screen always pause as if somebody else is supposed to speak?",
   "At the same point every time. A second input left open. This machine has better conversational discipline than most committees.",
   "A shared bench needs room for another pair of hands. So does a conversation. Yes, Mira, that includes yours.",
   "Cruel but persuasive. Look at the dusty middle of the rail: the little couriers made a route our hands never needed."
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
   "We follow evidence, not reflections. Iris, examine the waiting drop. Pip, the stool. Oren has marked solid stone here.",
   "He fixed my favourite footrest! What if the drop falls on me? Whoa! I fell first. I would like that recorded.",
   "Recorded with distinction. That drop has been hanging there long enough to develop opinions. Iris, can you interrogate it?",
   "I can measure its contact point. The release holds steady despite the pressure. Water is generally a poor interview subject.",
   "Oren checked every turn himself. Trust a map made by someone who carries parcels through it. And leave the drop alone.",
   "The reflection copies us perfectly, but it never looks first. I would rather meet something with ideas of its own."
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
   "A household bell, mended more than once. Iris, check the spare place. Pip, look at the relay; mind the hot pot.",
   "That giant switch keeps supper warm! Is the pot hissing at me? Oof! Pot safe. Pip safe. Please do not lift its hat.",
   "A splendid retirement for an empire-sized switch. I hope someone finds me equally important work involving supper.",
   "This cup is warm and the chair has no dust. The fresh cushion fibres are quite clear through the glass. A maintained place.",
   "Then the welcome is current, not remembered. We need not wake the whole Reach to recognise a well-kept promise.",
   "Look at the little clapper inside all that brass. The grand machine has a kitchen voice. I think we should hear it."
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
   "Keep the circle clear. Iris, examine the practice patches. Pip, your control. These seats once faced one operator.",
   "My old stool! The lever reaches it! Did the machine growl? Ah! No, that was me. I can still stand. Watch. Carefully.",
   "An ambitious curriculum. Nell, someone turned the chairs around. That is a quiet sort of revolution, and I approve.",
   "Different wear patterns, different learners. I am checking the joins. Standard dimensions would have been distinctly unhelpful.",
   "A good room changes for the people using it. We fitted that extension for Pip, not an imaginary average child.",
   "Then I nominate this stubborn little stool for a medal. It stayed itself while the enormous machine learned to bend."
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
   "Watch the open edge. Iris, examine the receiving dish. Pip, the flask shelf. Even the dark lamps have clean glass.",
   "Oren keeps tea up here! Is that wind or a giant bird? Whoop! Not over the edge! Very local landing. Please stay close.",
   "Excellent choice of direction. Iris, this tower seems proud of its voice. Does it ever let anyone else speak?",
   "The dish faces outward. Separate receiving contacts, separate return line. An elementary precaution for a conversational tower.",
   "The keeper maintained places that had not answered in years. Patience is work, Mira. It is not an absence of work.",
   "Then the cleanest dark lamp is the bravest one here. Someone polished its handle where a waiting hand would rest."
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
   "Step lightly. Iris, inspect the root cradle. Pip, only look at the flower stone. Someone cleared this patch recently.",
   "A stone flower! Does it open? What if it opens at me? Ah! Fine. No flowers squashed. I shall look from standing up.",
   "A rare ground-blooming Pip. Iris, the roots curve around that little box as if it were invited to stay.",
   "The outer fibres remain unbroken. I will examine the growth through the glass without moving the box. The roots have priority.",
   "A tended corner need not be tame. The dry leaves tell us someone cared for it. Enough rushing, Pip; let us look.",
   "Look at the worn petals. Someone polished a flower with their hands. I like them already. I hope they grew something edible too."
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
   "No climbing the roost. Iris, examine its marks. Pip, look at the smooth perch. Each wing wrap fits a different bird.",
   "My couriers slept here! Is one still in the dark? Oof! I volunteer to greet it after I get up. With all of you.",
   "A sensible delegation. Iris, those scratches leave spaces between them. A bird-sized seating plan?",
   "Different claw spans, different resting places. I can compare the paired marks under the glass without disturbing the rail.",
   "An observant repairer knows individuals, not just spare parts. Take your time, both of you. This room has earned it.",
   "Dust everywhere except that old perch. Even an empty room keeps a favourite seat. We should be polite guests."
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
   "Leave the window as it is. Iris, examine the chair. Pip, listen nearby. Two sets of controls have worn differently.",
   "The window is listening! Is something listening back? Whoa! I contributed a thump. A friendly thump. No need to answer it.",
   "A stirring opening statement. Nell, those controls meet in the middle without either one surrendering its shape.",
   "Fresh water, turned cushion, no damp fibres. I am checking the chair through the glass. Its empty place is maintained.",
   "Different hands can share a task without becoming the same hands. We will offer company, not instructions to an absent guest.",
   "Then I shall resist giving this silence a grand speech. A heroic sacrifice, but somebody already opened the window."
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
   "Watch the low step. Iris, inspect its join. Pip, listen at the small horn. These traces approach one pause differently.",
   "That horn is courier-sized! What if it shouts? Eep! Only a step. I am up. A step should announce itself, Nell.",
   "It did put itself on the floor. Iris, someone changed a mighty machine to fit one small visitor. My sort of engineering.",
   "The added wood bears actual weight. I am checking the fastening. This was used, not displayed. A refreshing distinction.",
   "A useful adaptation need not look grand. Pip, listen before demonstrating anything else. There is another voice here.",
   "Look at the wear inside that little horn. Someone spoke often enough to leave a mark. I would dearly like an introduction."
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
   "Leave the table steady, please. Iris, the chimes. Pip, the relay. This repaired corner borrowed wood from the post box.",
   "Room for our letter! Does that bell know we are here? Oof! It does now. I shall choose a chair for my next landing.",
   "Nell, four cups! Either we were expected, or this house is exceptionally hopeful. Please let it be hopeful about cake too.",
   "Shells and brass wear at different edges. Each chime has its own recurring movement. An untidy ensemble. Effective.",
   "Different voices can keep a household together. We have followed the letter far enough to earn a proper sit-down.",
   "Then I am claiming the wobbliest chair. It has character, and I feel we shall understand each other magnificently."
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
   "Set nothing on the unfinished repair. Iris, the spare place. Pip, your stool. The next learner has clean felt and a brush.",
   "My lever reaches! My stool sits flat! That scrape was not a monster, was it? Ah! Just me again. A useful lesson.",
   "We should charge admission to your demonstrations. Nell, a gap in the circle! An invitation disguised as furniture.",
   "The edges are worn where stools moved outward. I will check the joints. The circle has already revised its own dimensions.",
   "Then the next learner will not need permission to fit. A lesson is useful when it leaves someone able to begin.",
   "I could put that on a grand sign. But the little empty place says it better. Annoying when furniture wins an argument."
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
   "Keep clear of the lamps. Iris, examine the return line. Pip, the new trace. The keeper faced the islands, not his own bell.",
   "A light came back! Was that thunder? Whoop! I am fine! If it was thunder, please tell it I liked the light very much.",
   "One reply from the islands, one from Pip. A flourishing postal service. Iris, tell me that silver thread is real.",
   "It follows the distant flash, not ours. I am checking the receiving contact. The delay is consistent. Reality appears to be cooperating.",
   "A keeper watches for other people. That is what the bench was for. Let the reply arrive before calling again, Mira.",
   "I can wait one glorious moment. Look how the light takes its own way home! I knew the dark had something up its sleeve."
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
   "Softly now. Iris, the covered keys. Pip, listen by the window. The chair is dry and its worn arm has fresh polish.",
   "The window is open! What if something—oof. A quiet thump. Very apologetic. I am standing, and nothing need come in.",
   "An eloquent thump. Nell, nobody abandoned that chair. They simply refused to tell it whom to wait for.",
   "The cloth protects the sounding keys. The contact edges are clean beneath the glass. Removing it would add work without adding evidence.",
   "Precisely. A place can be ready without making demands. We have done enough. Resist improving the silence, please.",
   "I had a magnificent speech prepared. I shall save it for a deserving thunderstorm. For this place, an open window will do."
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
   "Give the couriers room. Iris, examine the traces. Pip, the little horn. Small feet have polished this service step.",
   "Their own voices! Such loud voices! Whoa! Fine! Please continue your historic conversation at whatever volume you require.",
   "Even falling over cannot interrupt his manners today. Iris, those lines part after the pause. They kept their own minds.",
   "Different intervals, different contours. I am checking the trace. This is not a copy. The couriers have declined the simpler thesis.",
   "Then hear what they choose to say. We delivered an opening, not a script. The old board could learn a thing or two.",
   "I volunteer to explain it to the old board. With diagrams. And a small, extremely opinionated bird on every desk."
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
   "Stop short of the roots. Iris, check the supporting stone. Pip, the bench. Someone moved this cup to catch the drip.",
   "A clean bench! Did the roots rustle at me? Oof! Technically seated. I would prefer somewhere less close to their toes.",
   "The bench appreciates being considered. Nell, the roots and the wall seem to have become business partners.",
   "They support each other. I am checking the narrow joints. Pulling either side would damage both. A poor shortcut.",
   "Then we will not force a passage. A closed path is useful information. Gather yourselves; we can reconsider our approach.",
   "I dislike losing arguments to shrubbery, but these are excellent shrubs. We will leave them their wall and take our curiosity back."
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
   "Stay off the disconnected cable. Iris, inspect the nest. Pip, that small courier. This wall was closed deliberately.",
   "A sunny resting place! Is that courier asleep or staring? Ah! I brought it a wrap. It may have the less frightening spot.",
   "Selfless, if poorly staged. Iris, fresh felt but no open way onward. Someone kept this room for a different reason.",
   "The nest lining is recent. I will check its edge. No repair here would turn solid wall into a passage. Geometry remains stubborn.",
   "A room is not obliged to be a corridor. Leave the courier comfortable, then we shall retrace our choice. Promptly, please.",
   "The sun gets a nursery, the bird gets a wrap, and we get a better question. I can survive that bargain. A snack would help."
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
   "Behind the rail, all of you. Iris, check the lamp. Pip, the rope from here. Oren still keeps a tea tray ready.",
   "The rope is mended! Is that a wave coming here? Whoa! Staying here! I have tested this end of the landing thoroughly.",
   "A convincing review. Iris, our light is in the water, but no answering lamp. Even my optimism needs a boat.",
   "The local crystal is sound. The contact closes under the glass. There is no separate return flash. Enthusiasm will not supply one.",
   "A repaired rope is still not a bridge. Back together, please. No inventive crossings, Mira; I know that expression.",
   "A tragic loss for inventive crossings. Look, the spare cup is dry under its cover. Oren has not stopped expecting someone."
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
   "Keep this side of the bowl. Iris, examine the dry rim. Pip, listen. Oren marked the stone honestly; the channel stops here.",
   "My courier's voice! Is somebody copying us? Oof! It copied that too. I would prefer the stranger forgot my landing.",
   "An echo with no discretion. Iris, every scratch returns in exactly the same place. Our mysterious stranger is suspiciously us.",
   "The bowl has no fresh water line. I am checking the glass. A signal travels outward; no independent reply returns. Efficiently useless.",
   "A perfect copy is not a conversation. We have learned the difference. Gather up; a useful mistake need not keep us here.",
   "Farewell, flattering imitation. Next time I want a stranger who interrupts me with something I could not have invented."
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
