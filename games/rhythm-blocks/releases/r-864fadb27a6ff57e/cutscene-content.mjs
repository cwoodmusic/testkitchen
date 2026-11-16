/** Short, staged arrivals. Looking and searching here never claim a game source. */
import {CAMPAIGN_CONTENT} from './campaign-content.mjs';
import {CAMPAIGN_SCENES} from './campaign-scenes.mjs';

const freeze=value=>{
 if(value&&typeof value==='object'&&!Object.isFrozen(value)){
  Object.values(value).forEach(freeze);Object.freeze(value);
 }
 return value;
};
const beat=(speaker,target,action,text)=>({speaker,...(target?{target}:{}),action,text});
const reply=text=>beat('mira',null,'look',text);

const arrivals={
 depot:[
  beat('nell','returned-letter','examine','The seal is still warm. How did this letter come back to its own starting place when I checked the outgoing tray myself?'),
  beat('iris','dispatch-map','search','And the little islands are waiting on this screen. Something begins here, then stops before anyone answers.'),
  beat('pip','clockwork-roost','listen','Listen to my courier. It keeps turning toward the dark route, as though it remembers hearing somebody there.'),
  reply('Then we should look for the missing reply together. Show me what this place remembers before we choose a door.'),
 ],
 'garden-porch':[
  beat('nell','garden-porch-second-cup','examine','Is this the same cup again, Iris? You have mended its handle so whoever sits here next will find it ready.'),
  beat('iris','garden-porch-graft','listen','The roots are waiting too. Hear how the little shoot answers only when the copper pipe gives it room?'),
  beat('pip','garden-porch-old-plaque','search','Your seed jars have taken over an official survey plate. I think the seedlings make better use of it.'),
  reply('A place can change its work and still remember people. Let us listen before we ask it to open for us.'),
 ],
 'workshop-porch':[
  beat('nell','workshop-porch-return-feather','examine','This feather was put apart carefully. It was worth keeping, even though it did not fit any bird on the bench.'),
  beat('iris','workshop-porch-seed-bowl','search','Fresh husks by the chargers? Pip, have your metal couriers been picking up some ordinary bird habits?'),
  beat('pip','workshop-porch-flight-jig','examine','They copy each other, not just the machines. Watch this repaired wing: I leave it room to move before tightening anything.'),
  reply('Then we will do the same. Look closely, give things room, and ask before we decide what they need.'),
 ],
 'canal-porch':[
  beat('nell','canal-porch-seal-line','search','Flour deliveries and repaired coats on the same drying line. These routes carried a whole neighbourhood in little pieces.'),
  beat('iris','canal-porch-loading-console','examine','And someone has made an enormous navigator useful with a wooden wedge. Oren has kept a careful place for his tea.'),
  beat('pip','canal-porch-mooring-bell','listen','Why is the small bell tied quiet? My courier keeps listening anyway, as though the other end ought to knock.'),
  reply('We should ask the keeper what he has heard. A still landing may have more to tell us than a busy one.'),
 ],
 'garden-fork':[
  beat('nell','garden-fork-shared-can','examine','I recognise three different repairs on this handle. Nobody could bear to throw away the neighbourhood watering can.'),
  beat('iris','garden-fork-buried-ring','search','Do you see the grooves beneath the roots? They have grown around the old path rather than erasing it.'),
  beat('pip','garden-fork-wind-cups','listen','The breeze finds the cups, but that empty place changes the answer. My bird is listening to the gap.'),
  reply('There is care in what people kept and in what they left open. Let us look at both before choosing our way.'),
 ],
 'workshop-fork':[
  beat('nell','workshop-fork-help-shelf','examine','Three kinds of stitching on one wing. This little repair has passed between more hands than a parcel.'),
  beat('iris','workshop-fork-sound-screen','listen','They left room for each other’s work. This screen does too: its pauses let somebody else answer between the pulses.'),
  beat('pip','workshop-fork-worn-rail','search','Who has been using just the ends of this rail? Small feet seem to be taking their own way around the dusty middle.'),
  reply('Then we will watch where people and couriers actually go. A worn handrail may tell us more than a grand sign.'),
 ],
 'canal-fork':[
  beat('nell','canal-fork-maintenance-map','examine','Oren has drawn what is really here, right down to the closed stone. He must have checked each turn himself.'),
  beat('iris','canal-fork-waiting-drop','listen','Why does the clock keep this drop waiting? The bowl beneath it is empty, but it will not let go.'),
  beat('pip','canal-fork-service-stool','search','And he repaired the footrest while he waited. A long watch is easier when someone remembers the person keeping it.'),
  reply('We will trust his careful work. Let us see which part of the clock is waiting for a reply instead of a reflection.'),
 ],
 'garden-final':[
  beat('nell','garden-final-mended-clapper','examine','This small bell has more than one household repair on it. The neighbours never waited for an official replacement.'),
  beat('iris','garden-final-extra-place','look','Who will sit in this spare chair? Its cup is warm and its cushion straight, but nobody has chosen the visitor’s part.'),
  beat('pip','garden-final-kitchen-relay','search','Look what this mighty old switch does now: it keeps a little pot warm. I think that is a very good job for it.'),
  reply('A welcome does not have to be enormous to matter. Let us find out what this little bell is waiting to hear.'),
 ],
 'workshop-final':[
  beat('nell','workshop-final-listening-ring','look','The seats face each other now. Whoever changed this room wanted people to hear more than one operator.'),
  beat('iris','workshop-final-practice-patches','search','What makes a good place to begin for each person? These repaired patches mark different answers instead of one perfect shape.'),
  beat('pip','workshop-final-low-control','examine','That wooden extension reaches my old stool. Nell helped me fit it so I could stop balancing on my toes.'),
  reply('Then this room has already learned something from you. We can take our time and add our own answer.'),
 ],
 'canal-final':[
  beat('nell','canal-final-route-lamps','examine','Even the dark lamps have clean glass. Somebody kept caring for places that had not answered in a long time.'),
  beat('iris','canal-final-reply-dish','listen','Could such a great tower be waiting to hear us? This dish faces outward to receive, instead of only sending its own voice.'),
  beat('pip','canal-final-keeper-flask','search','There is the keeper in the middle of it all: a little shelf, a warm flask, and somewhere to rest one hand.'),
  reply('We can see the islands from here, but we still need to listen to them. Let us make room for an answer.'),
 ],
 'garden-alcove':[
  beat('nell','garden-alcove-cleared-patch','search','The leaves have been moved recently. Someone has kept this corner dry without trying to tame the whole garden.'),
  beat('iris','garden-alcove-root-cradle','examine','Have you seen how the roots curve around the little box? They have grown beside it and left it enough room.'),
  beat('pip','garden-alcove-flower-stone','look','Even the stonework seems at home among these roots. We should take care where we put our feet.'),
  reply('Quiet does not mean forgotten. Let us look gently and decide for ourselves what needs a closer examination.'),
 ],
 'workshop-alcove':[
  beat('nell','workshop-alcove-wing-wraps','examine','Every wrap has been mended to a different size. Somebody knew these couriers as individuals, not spare parts.'),
  beat('iris','workshop-alcove-roost-marks','search','Why do the scratches leave empty spaces on the rail? Perhaps the couriers needed different places to settle.'),
  beat('pip','workshop-alcove-hollow-perch','look','The wood has stayed smooth beneath the dust. This was a place to settle for a while, not just pass through.'),
  reply('Then we will slow down too. There is no reason to hurry past a room somebody took such care to keep.'),
 ],
 'garden-secret-final':[
  beat('nell','garden-secret-final-second-controls','examine','Two sets of worn controls, and neither has been replaced by the other. These hands did different work together.'),
  beat('iris','garden-secret-final-chair','search','Does an empty place have to be uncared for? There is fresh water here, and someone has turned the cushion this morning.'),
  beat('pip','garden-secret-final-open-window','listen','The receiving side is open while the sending side rests. We do not have to fill every quiet space ourselves.'),
  reply('We can offer an answer without demanding one back. Let us be careful about what kind of welcome we make.'),
 ],
 'workshop-secret-final':[
  beat('nell','workshop-secret-final-two-traces','examine','Those lines approach the same pause by different curves. Neither one has been pressed into the other’s shape.'),
  beat('iris','workshop-secret-final-small-step','search','Who could reach this old control without the little step? Someone changed the room for its next small visitor.'),
  beat('pip','workshop-secret-final-small-horn','listen','The smaller horn is worn on the inside. A courier has been speaking here, not simply repeating the loudest call.'),
  reply('Then let us hear what it has to say. A different voice should not have to become a copy to belong here.'),
 ],
 'ending-home':[
  beat('nell','ending-home-memory','examine','Who set out four cups for us? Even this mended table corner has borrowed a little wood from the post box.'),
  beat('iris','ending-home-reply','listen','The window chimes answer with shells, spoons and brass. They are together without having to sound alike.'),
  beat('pip','ending-home-trace','search','The small bell is keeping the relay warm. There is room for our unanswered letter beside an ordinary envelope.'),
  reply('We came looking for a reply and found a place to ask together. For now, I would like to sit with all of you.'),
 ],
 'ending-school':[
  beat('nell','ending-school-trace','examine','A clean brush and fresh felt beside the unfinished repair. Whoever tries next will not have to begin alone.'),
  beat('iris','ending-school-reply','search','Who will bring the next stool? The circle has kept an opening, ready to change its shape for another learner.'),
  beat('pip','ending-school-memory','look','My old stool sits level, and the lever reaches it. Being small does not have to mean waiting outside the lesson.'),
  reply('Our answer got us here, but it does not have to be the last one. Let us leave the next person room to try.'),
 ],
 'ending-public':[
  beat('nell','ending-public-memory','examine','The keeper’s bench faces the lamps, not the bell. He was watching for everybody else to answer.'),
  beat('iris','ending-public-reply','listen','Can you see the fine silver line returning? It appears after the distant light. The tower is listening as well as calling.'),
  beat('pip','ending-public-trace','search','The new light takes a different line on its way back. Our couriers have more than an outward journey now.'),
  reply('We cannot carry every question across the Reach ourselves. Tonight, at least, we can hear one another again.'),
 ],
 'ending-secret-quiet':[
  beat('nell','ending-secret-quiet-memory','examine','The worn arm has fresh polish and the cushion is safe from the drip. Nobody has mistaken an empty chair for neglect.'),
  beat('iris','ending-secret-quiet-reply','look','We can leave that cloth over the sounding keys. Keeping a place does not mean choosing somebody else’s answer.'),
  beat('pip','ending-secret-quiet-trace','listen','Can you hear how little is being asked of this quiet? The window is open, and nothing is trying to hurry a reply.'),
  reply('Then we will not hurry it either. We have done what we came to do, and there is room for whatever comes next.'),
 ],
 'ending-secret-birds':[
  beat('nell','ending-secret-birds-memory','examine','Tiny feet have polished the service step. That small alteration has given someone a place at an enormous machine.'),
  beat('iris','ending-secret-birds-trace','search','Do you see how the lines part again? Sharing a pause does not make either voice less its own.'),
  beat('pip','ending-secret-birds-reply','listen','Hear that? My couriers are not echoing us. They have found something they wanted to say back.'),
  reply('I am glad we stayed to listen. The post can carry more voices than the old board ever knew how to name.'),
 ],
 'dead-brambles':[
  beat('nell','dead-brambles-memory','examine','Someone moved this cup to catch the drip. Even with the path closed, they made sure a visitor could sit dry.'),
  beat('iris','dead-brambles-trace','search','Could we pass without hurting the roots? They have joined the supporting stone, and I cannot see a safe gap.'),
  beat('pip','dead-brambles-reply','look','The bench is still brushed clean. Finding a resting place is not the same as finding our way onward.'),
  reply('Then we can rest and reconsider. We have learned what is here; we do not have to pretend every choice goes through.'),
 ],
 'dead-aviary':[
  beat('nell','dead-aviary-trace','search','The cable is disconnected at both ends. This wall was closed carefully, rather than waiting for someone to mend its latch.'),
  beat('iris','dead-aviary-memory','examine','Does a room have to be a passage to matter? This nest has fresh felt. Somebody still knows what it is good for.'),
  beat('pip','dead-aviary-reply','look','I brought a clean wrap for that little courier. It can settle in the sunlight while we think about another way.'),
  reply('We will leave it comfortable. This choice can be reconsidered, and a quiet stop need not become the end of our journey.'),
 ],
 'dead-ferry':[
  beat('nell','dead-ferry-memory','examine','Oren has checked the tea tray again. He is still making room for visitors, even without a ferry wake at the landing.'),
  beat('iris','dead-ferry-trace','search','Where is the answering light? Our local crystal works, but keeping one lamp lit cannot bring a boat by itself.'),
  beat('pip','dead-ferry-reply','look','The rope is repaired at our end and slack at the other. We should stay behind the rail; it is no bridge.'),
  reply('Then we will not ask a waiting rope to carry us. We can go back, recover our choice, and try a working route.'),
 ],
 'dead-echo':[
  beat('nell','dead-echo-trace','search','Oren’s maintenance mark ends at solid stone. His map was honest about where this channel would stop.'),
  beat('iris','dead-echo-memory','examine','How could the channel send its signal all this way and leave the bowl dry? Nothing is coming back.'),
  beat('pip','dead-echo-reply','listen','Even the scratch in the glass repeats. It is an excellent copy, but I cannot hear a separate answer.'),
  reply('Now we know the difference. Let us reconsider the last choice and find a way that can answer as well as repeat.'),
 ],
};

const emotions={
 "depot": [
  "question",
  "thinking",
  "surprise",
  "idea"
 ],
 "garden-porch": [
  "question",
  "thinking",
  "happy",
  "idea"
 ],
 "workshop-porch": [
  "thinking",
  "question",
  "idea",
  "happy"
 ],
 "canal-porch": [
  "thinking",
  "idea",
  "question",
  "thinking"
 ],
 "garden-fork": [
  "thinking",
  "question",
  "surprise",
  "idea"
 ],
 "workshop-fork": [
  "surprise",
  "idea",
  "question",
  "thinking"
 ],
 "canal-fork": [
  "idea",
  "question",
  "happy",
  "thinking"
 ],
 "garden-final": [
  "thinking",
  "question",
  "surprise",
  "idea"
 ],
 "workshop-final": [
  "idea",
  "question",
  "happy",
  "thinking"
 ],
 "canal-final": [
  "thinking",
  "question",
  "happy",
  "idea"
 ],
 "garden-alcove": [
  "thinking",
  "question",
  "happy",
  "idea"
 ],
 "workshop-alcove": [
  "thinking",
  "question",
  "happy",
  "idea"
 ],
 "garden-secret-final": [
  "thinking",
  "question",
  "idea",
  "happy"
 ],
 "workshop-secret-final": [
  "thinking",
  "question",
  "idea",
  "happy"
 ],
 "ending-home": [
  "question",
  "happy",
  "idea",
  "happy"
 ],
 "ending-school": [
  "idea",
  "question",
  "happy",
  "happy"
 ],
 "ending-public": [
  "thinking",
  "question",
  "idea",
  "happy"
 ],
 "ending-secret-quiet": [
  "thinking",
  "idea",
  "question",
  "happy"
 ],
 "ending-secret-birds": [
  "idea",
  "question",
  "happy",
  "happy"
 ],
 "dead-brambles": [
  "thinking",
  "question",
  "happy",
  "idea"
 ],
 "dead-aviary": [
  "thinking",
  "question",
  "happy",
  "idea"
 ],
 "dead-ferry": [
  "thinking",
  "question",
  "surprise",
  "idea"
 ],
 "dead-echo": [
  "thinking",
  "question",
  "surprise",
  "idea"
 ]
};

// Keep the published discussion data separate from the content and geometry it
// references, so an edited project can replace a scene without mutating defaults.
for(const [roomId,beats]of Object.entries(arrivals)){
 beats.forEach((item,index)=>{item.id=`${roomId}-arrival-${index+1}`;item.emote=emotions[roomId][index];});
 const content=CAMPAIGN_CONTENT[roomId],scene=CAMPAIGN_SCENES[roomId];
 if(!content||!scene)throw new Error(`Unknown cutscene location: ${roomId}`);
 for(const item of beats)if(item.target&&!scene.geometry.targets.some(target=>target.id===item.target))throw new Error(`Unknown cutscene target: ${roomId}/${item.target}`);
}
export const ROOM_CUTSCENES=freeze(arrivals);

/** Unknown locations never borrow another room’s arrival. */
export function getRoomCutscene(id){return typeof id==='string'&&Object.hasOwn(ROOM_CUTSCENES,id)?ROOM_CUTSCENES[id]:null;}
