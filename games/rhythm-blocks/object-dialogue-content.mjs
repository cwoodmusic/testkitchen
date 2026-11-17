/** Optional party exchanges prompted by existing room observations. */
const freeze=value=>{
 if(value&&typeof value==='object'&&!Object.isFrozen(value)){
  Object.values(value).forEach(freeze);Object.freeze(value);
 }
 return value;
};

// These are conversations, never pickups or lock answers. A source-bearing
// observation still needs its separate, explicit Search action afterward.
export const OBJECT_DIALOGUES=freeze({
 "returned-letter":[
  {speaker:"mira",text:"The wax on this letter is still warm. How did it get back while the mail routes were closed?"},
  {speaker:"nell",text:"I sent it out this morning. Its address was clear, but nobody sent back a reply."},
  {speaker:"pip",text:"There are tiny claw marks on the string. One of my birds may have carried it."},
  {speaker:"iris",text:"Then we have two clues: warm wax and claw marks. We should follow the bird’s route."},
 ],
 "dispatch-map":[
  {speaker:"mira",text:"The green line lights up, then stops. Is that why our letters are not getting through?"},
  {speaker:"iris",text:"This screen shows a message going out. The little light for the reply stays dark."},
  {speaker:"nell",text:"That reply tells us a delivery arrived safely. Without it, the next load cannot leave."},
  {speaker:"pip",text:"My bird keeps turning toward the old path. I will follow it, if everyone comes too."},
 ],
 "garden-porch-second-cup":[
  {speaker:"mira",text:"Two cups, but only one person drinking tea. Who is the other cup for?"},
  {speaker:"iris",text:"My friend lives on another island. We used to play music together. Her messages stopped when the bell went quiet."},
  {speaker:"pip",text:"Then we should help her message get through. I can ask the birds. From here."},
  {speaker:"nell",text:"We will keep the cup ready. First, let’s find why the messages have stopped."},
 ],
 "workshop-porch-seed-bowl":[
  {speaker:"mira",text:"The brass bird is sharing its bowl. Does it eat seeds, or is it saving breakfast for me?"},
  {speaker:"pip",text:"The warm perches give my birds their power. I leave seed for the real birds that visit."},
  {speaker:"iris",text:"That perch is still warm. The public bell stopped, but this charger kept working."},
  {speaker:"nell",text:"Then a bird could still travel between working perches. Leave its bowl alone, Mira."},
 ],
 "canal-porch-mooring-bell":[
  {speaker:"mira",text:"Why have you tied the bell so it cannot ring? Isn’t ringing its job?"},
  {speaker:"oren",text:"It tells people to board the ferry. I keep it quiet until the boat sends a message saying it is ready."},
  {speaker:"pip",text:"I am very pleased we check for a boat first. I would rather wait than step onto water."},
  {speaker:"nell",text:"Food deliveries are waiting here too. We need those replies so the boats can dock safely."},
 ],
 "garden-fork-shared-can":[
  {speaker:"mira",text:"Four different patches on one handle. Did the whole street take turns fixing this watering can?"},
  {speaker:"iris",text:"They share it. Since the water pump stopped, they carry each bucket by hand."},
  {speaker:"pip",text:"I know that blue cloth. Someone used the same cloth to mend my bird’s carrying strap."},
  {speaker:"nell",text:"People are helping one another. We can help by getting their water route working again."},
 ],
 "workshop-fork-worn-rail":[
  {speaker:"pip",text:"Look at the shiny ends! A bird lands here, then there. Those marks fit its little feet."},
  {speaker:"iris",text:"The middle is still dusty. Birds can fly between the ends without touching it."},
  {speaker:"mira",text:"So this handrail is also a bird path. We have been walking beside it without noticing!"},
  {speaker:"nell",text:"That may explain how our letter came back. Let’s follow the marks and see where the birds go."},
 ],
 "canal-fork-waiting-drop":[
  {speaker:"mira",text:"That drop has not fallen once. The clock is running, so what is it waiting for?"},
  {speaker:"iris",text:"A reply light. The clock waits until the next station sends a message saying it is ready."},
  {speaker:"pip",text:"Then nobody poke the drop. I do not want a boat arriving before its dock is ready."},
  {speaker:"nell",text:"The sending side works. The line bringing replies back is the part we need to check."},
 ],
 "garden-final-kitchen-relay":[
  {speaker:"mira",text:"That giant switch runs one kitchen. Does it also know when the soup is ready?"},
  {speaker:"iris",text:"This little bell can send replies from these houses. We can connect it to a working wire."},
  {speaker:"pip",text:"So the homes can say, “We got it!” even while the town bell is quiet?"},
  {speaker:"nell",text:"Yes. We can restore this short route and bring water and deliveries back to these homes."},
 ],
 "workshop-final-listening-ring":[
  {speaker:"mira",text:"Where does the person in charge sit? Every chair faces somebody else’s chair."},
  {speaker:"iris",text:"They watch and listen to one another. This old message machine helps them practise repair rhythms together."},
  {speaker:"pip",text:"If I play at the wrong moment, will someone help me try again?"},
  {speaker:"nell",text:"Yes. Once this room works, we can teach more helpers to repair the broken routes."},
 ],
 "canal-final-reply-dish":[
  {speaker:"mira",text:"I thought that huge dish would face the bell. It is pointing toward the islands."},
  {speaker:"iris",text:"It listens for their answers. Look: the wire carrying those answers to the bell has come loose."},
  {speaker:"pip",text:"All those islands were answering? The bell just could not hear them?"},
  {speaker:"nell",text:"Exactly. We must reconnect that wire, then test a call and a reply."},
 ],
 "garden-alcove-flower-stone":[
  {speaker:"iris",text:"This petal is smooth from people lifting it. The carved flower hides a handle."},
  {speaker:"mira",text:"A stone flower that opens like a lid! Someone wanted this little box to blend into the garden."},
  {speaker:"nell",text:"We can search beneath it. Lift the handle gently and leave the supporting roots alone."},
  {speaker:"pip",text:"I will hold the light. I hope there are notes inside, rather than something with teeth."},
 ],
 "workshop-alcove-hollow-perch":[
  {speaker:"pip",text:"This side rings when I tap it. The other side stays quiet. And that little cover moves!"},
  {speaker:"iris",text:"The perch is hollow inside. A wooden peg keeps the cover closed."},
  {speaker:"mira",text:"A perch with a pocket! Do the birds keep spare parts in their chairs?"},
  {speaker:"nell",text:"We can search under the cover. There is no need to pull apart the whole rail."},
 ],
 "garden-secret-final-second-controls":[
  {speaker:"iris",text:"My friend and I used these knobs to send music between our islands."},
  {speaker:"mira",text:"Two sets of worn handles. You kept a place ready for her."},
  {speaker:"pip",text:"Then I will keep my bird quiet. We might hear her answer."},
  {speaker:"nell",text:"We can connect this window to the garden’s working line. Then her reply can reach us."},
 ],
 "workshop-secret-final-small-step":[
  {speaker:"pip",text:"Those are bird-foot marks on top! Someone made this step so a courier could reach the lever."},
  {speaker:"mira",text:"The birds have been trying to tell us something. We put every handle too high!"},
  {speaker:"iris",text:"This step lets a bird work the reply lever. We should see which route it chooses."},
  {speaker:"nell",text:"Leave it room. Our returning letter showed that the birds still know a working path."},
 ],
 "ending-home-memory":[
  {speaker:"mira",text:"Bread and four cups! A welcome you can actually eat. I shall accept it at once."},
  {speaker:"nell",text:"The kitchen’s reply bell is working. Water and deliveries can reach these homes again."},
  {speaker:"iris",text:"And Pip’s bird explains our warm letter. Its metal carrying clip warmed on a charging perch."},
  {speaker:"pip",text:"Then I owe that bird a thank-you. It brought the letter home along its old route."},
 ],
 "ending-school-memory":[
  {speaker:"pip",text:"That stool lets a child reach the little lever. I wish all huge machines came with one."},
  {speaker:"iris",text:"The shorter legs keep the stool level. The long handle brings the control within reach."},
  {speaker:"mira",text:"Somebody helped the learner by changing the furniture. Much quicker than waiting for them to grow!"},
  {speaker:"nell",text:"Now this room can train new helpers to repair routes. The town’s larger reply line still needs help."},
 ],
 "ending-public-reply":[
  {speaker:"mira",text:"There! The far lamp flashed back, and the bell rang. This time the answer got through!"},
  {speaker:"iris",text:"The loose return wire was the fault. Now replies can reach the bell again."},
  {speaker:"pip",text:"My birds wait for that flash before taking off. They were checking that someone was there."},
  {speaker:"nell",text:"Now the delivery birds, water pumps, and boats can work safely again. The whole town will feel this."},
 ],
 "ending-secret-quiet-memory":[
  {speaker:"mira",text:"You moved the chair away from the leak. You really wanted your friend to have a dry seat."},
  {speaker:"iris",text:"Her voice came through the window. She is safe on her island, and she wants to visit. I shall make fresh tea."},
  {speaker:"pip",text:"Then I will help dry the cushion. She should have a comfortable seat when she gets here."},
  {speaker:"nell",text:"Our window repair restored one important reply. The rest of the town still needs help."},
 ],
 "ending-secret-birds-reply":[
  {speaker:"pip",text:"That is the birds’ own reply tune! I thought their compasses were broken."},
  {speaker:"iris",text:"The little horn sends their message along the old service route. Their warm chargers still work."},
  {speaker:"mira",text:"So a bird brought our letter home. Its warm metal clip kept the wax soft!"},
  {speaker:"nell",text:"Yes. We restored the birds’ reply route. They can carry messages while the main bell still needs repair."},
 ],
 "dead-brambles-memory":[
  {speaker:"pip",text:"The roots fill the whole arch. We cannot squeeze through, even if I go last."},
  {speaker:"iris",text:"Someone put this cup under the leak to keep the bench dry. People still care for this place."},
  {speaker:"mira",text:"We found a good place to rest, but no way forward. The listening gate looked much less leafy."},
  {speaker:"nell",text:"Back to our last choice. Revisit it to recover the notes, then take the listening gate."},
 ],
 "dead-aviary-memory":[
  {speaker:"pip",text:"Fresh felt and brass dust! Someone has been mending this bird’s nest."},
  {speaker:"iris",text:"The soft lining protects its wing. This room is cared for, but the wall has no opening."},
  {speaker:"mira",text:"So we found a comfortable bird bed, not our way forward. We should let it rest."},
  {speaker:"nell",text:"We need Pip’s workshop again. Revisit our last choice, then take the running gate."},
 ],
 "dead-ferry-reply":[
  {speaker:"mira",text:"A rope and an empty landing. I suppose a very brave hop will not replace a ferry."},
  {speaker:"iris",text:"Correct. A rope is not a bridge. We cannot cross safely without a boat."},
  {speaker:"pip",text:"I fully support staying on this side. A nice, dry side, with all my friends on it."},
  {speaker:"nell",text:"Revisit our last choice to return to Oren. Then take the delivery gate."},
 ],
 "dead-echo-reply":[
  {speaker:"mira",text:"The clock in the water has our scratch on it. Even our untidy marks are coming back!"},
  {speaker:"iris",text:"That is our own reflection. It copies the clock, so it cannot send a new reply."},
  {speaker:"pip",text:"So another clock is not pretending to be our clock? That is a relief."},
  {speaker:"nell",text:"This channel ends here. Revisit the water clock and choose the town-bell stair."},
 ],
});

/** An unknown prop never borrows a different object’s conversation. */
export function getObjectDialogue(id){
 return typeof id==='string'&&Object.hasOwn(OBJECT_DIALOGUES,id)?OBJECT_DIALOGUES[id]:null;
}
