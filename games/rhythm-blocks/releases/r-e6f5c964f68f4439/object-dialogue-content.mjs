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
  {speaker:"mira",text:"This wax looks like toffee, but it's warm. How did the letter get home with the mail routes closed?"},
  {speaker:"nell",text:"Eyes on the letter, Mira. I sent it this morning, but no reply came back."},
  {speaker:"pip",text:"Those claw marks look like my bird's. I knew he wouldn't leave a letter behind!"},
  {speaker:"iris",text:"The marks are evidence, but the rest is a guess. Let's check the bird's route."},
 ],
 "dispatch-map":[
  {speaker:"mira",text:"That green line's like a tiny race. Oh, it stopped. Aren't our letters getting through?"},
  {speaker:"iris",text:"It's showing a message going out, but the reply light stays dark."},
  {speaker:"nell",text:"The reply means a delivery got there safely. Without it, we can't send the next load."},
  {speaker:"pip",text:"My bird wants the old path, and I trust him. I'd like everyone to come, though."},
 ],
 "garden-porch-second-cup":[
  {speaker:"mira",text:"There's a second cup, but you're the only one having tea. Who's it for?"},
  {speaker:"iris",text:"My friend on another island. We used to play music together, but her messages stopped when the bell went quiet."},
  {speaker:"pip",text:"She might be waiting by her cup too. We can't just leave her wondering!"},
  {speaker:"nell",text:"We won't. We'll keep this cup ready, but first let's find what's blocking the replies."},
 ],
 "workshop-porch-seed-bowl":[
  {speaker:"mira",text:"That brass bird's sharing its bowl. Does it eat seeds, or is that breakfast for me?"},
  {speaker:"pip",text:"The warm perches power my birds, but the seed's for the real birds that visit."},
  {speaker:"iris",text:"And this perch is still warm. The public bell stopped, but its charger didn't."},
  {speaker:"nell",text:"So a bird could still travel between working perches. Leave its breakfast alone, Mira."},
 ],
 "canal-porch-mooring-bell":[
  {speaker:"mira",text:"You've tied the bell so it can't ring. Isn't ringing its whole job?"},
  {speaker:"oren",text:"It tells people to board, so I keep it quiet until the boat says it's ready."},
  {speaker:"pip",text:"That's a rule I like. I'd rather wait for a boat than take a very wet step."},
  {speaker:"nell",text:"Food deliveries are waiting too, so we need replies before the boats can dock safely."},
 ],
 "garden-fork-shared-can":[
  {speaker:"mira",text:"Four patches on one handle! Did the whole street take turns fixing this can?"},
  {speaker:"iris",text:"They share it, and now they're carrying every bucket by hand because the pump's stopped."},
  {speaker:"pip",text:"I know that blue cloth! Someone used it to mend my bird's carrying strap too."},
  {speaker:"nell",text:"They're already helping each other, so let's help by getting their water route working again."},
 ],
 "workshop-fork-worn-rail":[
  {speaker:"pip",text:"Look at those shiny ends! My birds have been landing here. They haven't given up on us!"},
  {speaker:"iris",text:"Their feet fit the marks, but that's all we know. They've flown over the dusty middle."},
  {speaker:"mira",text:"Shimmy shimmy! It's a bird path. I thought the shiny bits were just fancy decoration."},
  {speaker:"nell",text:"Useful noticing, Mira. Now follow those marks, and let's find how our letter came back."},
 ],
 "canal-fork-waiting-drop":[
  {speaker:"mira",text:"That drop hasn't fallen once. The clock's running, so what's it waiting for?"},
  {speaker:"iris",text:"The reply light. It won't move until the next station says it's ready."},
  {speaker:"pip",text:"Then don't poke it! I don't want a boat arriving before its dock's ready."},
  {speaker:"nell",text:"The sending side works, so let's check the line that brings the replies back."},
 ],
 "garden-final-kitchen-relay":[
  {speaker:"mira",text:"That giant switch runs one kitchen? I wonder if it knows when the soup's ready."},
  {speaker:"iris",text:"It sends replies from these houses, and we can connect it to a working wire."},
  {speaker:"pip",text:"So the homes can say, 'We got it!' even while the town bell's quiet?"},
  {speaker:"nell",text:"Yes, so leave the soup for later, Mira. This short route can restore these homes' water and deliveries."},
 ],
 "workshop-final-listening-ring":[
  {speaker:"mira",text:"Every chair faces another chair, so where does the person in charge sit?"},
  {speaker:"iris",text:"They watch each other, and this old message machine helps them practise repair rhythms together."},
  {speaker:"pip",text:"But what if I come in wrong and everyone hears? I'd like a practice try."},
  {speaker:"nell",text:"That's what practice is for, Pip. Once this room works, we can teach more helpers to repair routes."},
 ],
 "canal-final-reply-dish":[
  {speaker:"mira",text:"I thought that huge dish would face the bell, but it's pointing at the islands."},
  {speaker:"iris",text:"It's listening for their answers. Look, the wire carrying them to the bell has come loose."},
  {speaker:"pip",text:"So they were answering all along, and the bell couldn't hear them? That's awful!"},
  {speaker:"nell",text:"It is, but we can fix it. Let's reconnect that wire and test a call and a reply."},
 ],
 "garden-alcove-flower-stone":[
  {speaker:"iris",text:"That petal's smooth because people keep lifting it. The carved flower hides a handle."},
  {speaker:"mira",text:"A stone flower with a lid! It'd make a very sneaky lunchbox. Do you think it opens?"},
  {speaker:"nell",text:"The handle, Mira. We can search beneath it, but lift gently and leave the supporting roots alone."},
  {speaker:"pip",text:"I'll hold the light. I'm hoping for notes, but I'd settle for nothing with teeth."},
 ],
 "workshop-alcove-hollow-perch":[
  {speaker:"pip",text:"This side rings, but that one's quiet. And the cover moves! Please tell me that's meant to happen."},
  {speaker:"iris",text:"It's a hollow perch, Pip, and a wooden peg holds the cover shut. Nothing's broken."},
  {speaker:"mira",text:"It's got a pocket! Maybe the birds keep spare parts in there. Or tiny biscuits."},
  {speaker:"nell",text:"Let's search under the cover, Mira. We don't need to dismantle the rail for biscuits."},
 ],
 "garden-secret-final-second-controls":[
  {speaker:"iris",text:"My friend and I used these knobs to send music between our islands, and they should still work."},
  {speaker:"mira",text:"Both sets of handles are worn. You kept her place ready even when you couldn't hear her."},
  {speaker:"pip",text:"Then I'll keep my bird quiet, because I really want to hear her answer."},
  {speaker:"nell",text:"Let's connect this window to the garden's working line so her reply can reach us."},
 ],
 "workshop-secret-final-small-step":[
  {speaker:"pip",text:"Bird-foot marks! Someone made a step for them. Finally, somebody thought about their tiny legs!"},
  {speaker:"mira",text:"We've put every handle too high, and the birds have been trying to tell us!"},
  {speaker:"iris",text:"They need to reach the reply lever, so the step solves that problem. Let's watch which route they choose."},
  {speaker:"nell",text:"Give them room. Our returning letter showed us the birds still know a working path."},
 ],
 "ending-home-memory":[
  {speaker:"mira",text:"Bread and four cups! That's a welcome I can eat, and I'm accepting it immediately."},
  {speaker:"nell",text:"In a moment, Mira. The kitchen's reply bell works, so water and deliveries can reach these homes again."},
  {speaker:"iris",text:"And Pip's bird explains our warm letter. Its metal carrying clip warmed up on a charging perch."},
  {speaker:"pip",text:"Then that bird deserves a proper thank-you. He brought our letter home along his old route."},
 ],
 "ending-school-memory":[
  {speaker:"pip",text:"They made a stool so a child could reach! I wish every huge machine cared that much."},
  {speaker:"iris",text:"The machine doesn't care, but its makers did. Short legs keep the stool level, and the long handle's within reach."},
  {speaker:"mira",text:"So they changed the furniture instead of waiting for the learner to grow. I'd call that a good idea!"},
  {speaker:"nell",text:"Now this room can train new helpers to repair routes, but the town's larger reply line still needs help."},
 ],
 "ending-public-reply":[
  {speaker:"mira",text:"Shimmy shimmy! The far lamp flashed back, and the bell rang. Our answer got through!"},
  {speaker:"iris",text:"The loose return wire was the fault, and now replies can reach the bell again."},
  {speaker:"pip",text:"My birds wait for that flash before taking off. They weren't giving up; they were checking someone was there!"},
  {speaker:"nell",text:"And now the delivery birds, water pumps, and boats can work safely again. We've helped the whole town."},
 ],
 "ending-secret-quiet-memory":[
  {speaker:"mira",text:"You moved her chair away from the leak. That's a very thoughtful way to save someone a seat."},
  {speaker:"iris",text:"She answered through the window, and she's safe on her island. She wants to visit, so I'll make fresh tea."},
  {speaker:"pip",text:"Then I'll dry the cushion, because I don't want her first visit to start with a soggy seat."},
  {speaker:"nell",text:"Our window repair restored one important reply, but the rest of the town still needs help."},
 ],
 "ending-secret-birds-reply":[
  {speaker:"pip",text:"That's their own reply tune! I thought their compasses were broken, and they were just lost."},
  {speaker:"iris",text:"They weren't lost. The little horn uses their old service route, and their warm chargers still work."},
  {speaker:"mira",text:"So a bird brought our letter home, and its warm metal clip kept the wax soft!"},
  {speaker:"nell",text:"That's right. We've restored the birds' small reply route, but the main bell still needs repair."},
 ],
 "dead-brambles-memory":[
  {speaker:"pip",text:"The roots fill the whole arch! I don't think they want us here, and I don't want to argue."},
  {speaker:"iris",text:"Roots don't have opinions, Pip, but they do block the path. That cup catches a roof leak, so the bench stays dry."},
  {speaker:"mira",text:"A nice rest stop, but no way through those roots. The south gate has its own price, and our final pair is already spent."},
  {speaker:"nell",text:"The garden service gate to the south needs a half note and half rest. Count our bag first; the arch's payment won't return."},
 ],
 "dead-aviary-memory":[
  {speaker:"pip",text:"Fresh felt and brass dust! Someone's mending this bird's nest. We can't leave it all alone!"},
  {speaker:"iris",text:"It's being cared for, Pip. The lining protects its wing, but there's no opening in that wall."},
  {speaker:"mira",text:"A comfy bird bed! I'll skip the matching pillows. The south service gate leads onward, but it needs another four beats."},
  {speaker:"nell",text:"The south service gate needs Pip's half note, two eighths and four sixteenths. That's another payment, so check what we'll have left."},
 ],
 "dead-ferry-reply":[
  {speaker:"mira",text:"An empty landing and one rope. Even my most impressive hop won't turn that into a ferry."},
  {speaker:"iris",text:"Correct, and the rope isn't a bridge. We can't cross safely without a boat."},
  {speaker:"pip",text:"I'm glad we agree. I like this side, because it's dry and all my friends are on it."},
  {speaker:"nell",text:"This run ends here. Our journal keeps the clue, so next time we'll collect Oren's chest and choose the delivery gate."},
 ],
 "dead-echo-reply":[
  {speaker:"mira",text:"The clock in the water's got our scratch! Even our untidy marks are coming back."},
  {speaker:"iris",text:"That's our reflection, so it's copying the clock. It can't send a new reply."},
  {speaker:"pip",text:"It still feels like another clock's watching us, but I'll take the reflection explanation. Happily."},
  {speaker:"nell",text:"The channel ends at stone, but the south stair reaches the tower. It costs four more beats, and the tower still needs its final key."},
 ],
 "final-concourse-service-map": [
  {
   "speaker": "mira",
   "text": "There’s the homes’ pump, the class, the bell, the birds’ horn and Iris’s window. We’ve seen every one of these connections!"
  },
  {
   "speaker": "nell",
   "text": "And we learned from the trips that stopped short. Those repairs reset when we started again, but our journal kept the results."
  },
  {
   "speaker": "pip",
   "text": "Then those wrong turns weren’t for nothing? I still wish I’d counted before the roots, but now I know what to save."
  },
  {
   "speaker": "iris",
   "text": "The lesson stayed, Pip. These service controls let us connect all five lines on this trip. We still have to do the work."
  }
 ],
 "final-heart-reply-screen": [
  {
   "speaker": "pip",
   "text": "Five lamps. What if one doesn’t answer? I don’t want to cheer so loudly that we miss the birds’ little tune."
  },
  {
   "speaker": "iris",
   "text": "We’ll check each lamp, then listen to the horn. Fear isn’t a test result, but watching carefully is useful."
  },
  {
   "speaker": "mira",
   "text": "And this receiver’s for your friend! If the bell hears the ferry’s safety reply, she can finally cross for tea."
  },
  {
   "speaker": "nell",
   "text": "Exactly. The last rhythm makes a call and leaves time for an answer. We need every return line working, not just the loudest one."
  }
 ],
 "ending-complete-reply": [
  {
   "speaker": "pip",
   "text": "That bird’s tune is its own answer! We gave it a step, a horn and a working line. I’m so glad we listened."
  },
  {
   "speaker": "iris",
   "text": "My friend’s arrived safely at the town landing. She’s at Nell’s depot with tea ready. I can stop saving an empty chair."
  },
  {
   "speaker": "mira",
   "text": "Shimmy shimmy! Four cups here, tea at the depot, and the class can start again. We’ve earned a very busy afternoon."
  },
  {
   "speaker": "nell",
   "text": "Together. The homes, music room, birds, window and public bell all work in this run. We learned from every route, and all four of us finished the repair."
  }
 ],
});

/** An unknown prop never borrows a different object’s conversation. */
export function getObjectDialogue(id){
 return typeof id==='string'&&Object.hasOwn(OBJECT_DIALOGUES,id)?OBJECT_DIALOGUES[id]:null;
}
