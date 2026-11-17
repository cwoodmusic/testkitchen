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
 'returned-letter':[
  {speaker:'mira',text:'The forwarding labels go round in a little paper spiral. Has this letter been trying every address it knows?'},
  {speaker:'nell',text:'It has been trying this address repeatedly. I tied that top label myself, and I would remember warming the seal.'},
  {speaker:'pip',text:'Perhaps it remembers you. Can letters remember people? I would prefer one that remembers me from a distance.'},
  {speaker:'iris',text:'The wax is evidence. The letter’s opinion of Pip remains unmeasured.'},
 ],
 'dispatch-map':[
  {speaker:'mira',text:'That little island moves when I move my head. I could spend a whole afternoon steering it with my nose.'},
  {speaker:'iris',text:'The curved glass displaces the image. The interrupted route stays in the same place; that is the useful part.'},
  {speaker:'nell',text:'I have pressed that brass button every morning. It always reaches this point, then waits for the bell.'},
  {speaker:'pip',text:'My bird keeps looking there too. I shall stand slightly behind the person who presses it next.'},
 ],
 'garden-porch-second-cup':[
  {speaker:'mira',text:'A newly mended handle and a dry place at the table. Are we expecting another visitor?'},
  {speaker:'iris',text:'The cup is serviceable again. I keep it ready.'},
  {speaker:'pip',text:'I could ask the birds to watch the path. Quietly. They are much better at watching than I am.'},
  {speaker:'nell',text:'Then we shall leave the cloth straight and the place clear. Small courtesies travel well.'},
 ],
 'workshop-porch-seed-bowl':[
  {speaker:'mira',text:'It pushed the bowl toward the other bird. Does a brass beak make an excellent spoon?'},
  {speaker:'pip',text:'They used to share a perch. I still put out two portions, even when the chargers do all the feeding.'},
  {speaker:'iris',text:'A repeated habit can survive a change in its practical purpose. That is worth observing.'},
  {speaker:'nell',text:'Observe it without borrowing their bowl, Mira. We have a delivery to follow.'},
 ],
 'canal-porch-mooring-bell':[
  {speaker:'mira',text:'That is a very tidy knot for a bell somebody intends to ring.'},
  {speaker:'oren',text:'The return knock comes first. A loose clapper can call people onto a landing before a boat has answered.'},
  {speaker:'pip',text:'I am delighted to hear there is a rule about knowing where the boat is. A very important rule.'},
  {speaker:'nell',text:'Oren checks it every day. Leave his knot as it is; a quiet safeguard is still doing its work.'},
 ],
 'garden-fork-shared-can':[
  {speaker:'mira',text:'Four repairs on one handle. At what point do we congratulate the whole neighbourhood for making a watering can?'},
  {speaker:'iris',text:'Whenever they return it to the shared shelf. The handle has outlasted several disagreements about tomatoes.'},
  {speaker:'pip',text:'I recognise that blue binding. Someone used the same thread to mend a courier strap for me.'},
  {speaker:'nell',text:'There we are. A useful route already, between a garden shelf and a bird’s wing.'},
 ],
 'workshop-fork-worn-rail':[
  {speaker:'pip',text:'Look at the bright ends! A bird lands here, then there. Those marks are exactly the right distance apart.'},
  {speaker:'iris',text:'The dust survives in the middle because the feet using this rail do not need its middle.'},
  {speaker:'mira',text:'Our map would draw one handrail. Their map would draw two excellent little stations.'},
  {speaker:'nell',text:'Remember what you have seen. A route can be familiar to its users long before it reaches my ledger.'},
 ],
 'canal-fork-waiting-drop':[
  {speaker:'mira',text:'Come on, little drop. You have been at the edge of that lip longer than I have been patient.'},
  {speaker:'iris',text:'Its release is waiting on a return signal. Poking it would remove our chance to observe that signal.'},
  {speaker:'pip',text:'Then nobody poke it. I was not going to. I am very good at leaving enormous clocks alone.'},
  {speaker:'nell',text:'Hands down, everyone. Give the receiving bowl the same attention as the clock above it.'},
 ],
 'garden-final-kitchen-relay':[
  {speaker:'mira',text:'That switch could command a fleet of skyships. Today it is keeping somebody’s soup warm. An admirable promotion.'},
  {speaker:'iris',text:'The small circuit has been fitted carefully. A large mechanism can perform a very precise domestic task.'},
  {speaker:'pip',text:'Will the little bell be loud enough for all that machinery? I should like to stand here if it tries.'},
  {speaker:'nell',text:'A warm meal arriving at the right time is reason enough to mend a bell. Keep that in mind.'},
 ],
 'workshop-final-listening-ring':[
  {speaker:'mira',text:'Where does the person in charge sit? Every chair seems to be looking at somebody else’s chair.'},
  {speaker:'iris',text:'The arrangement lets each player watch another. They can adjust together instead of waiting for one control desk.'},
  {speaker:'pip',text:'If I come in at the wrong moment, would someone give me a very small signal? Preferably before I do it?'},
  {speaker:'nell',text:'Certainly. Leading includes listening, Pip. Find a place where you can see us.'},
 ],
 'canal-final-reply-dish':[
  {speaker:'mira',text:'I thought that enormous dish would be aimed straight at the bell. It is watching the islands.'},
  {speaker:'iris',text:'A receiver needs a clear path from whoever may answer. Its size makes a faint reply easier to distinguish.'},
  {speaker:'pip',text:'Even a very faint one? Suppose somebody is trying to be brave without being particularly loud.'},
  {speaker:'nell',text:'Then we give them time, and we keep this side open. Inspect the receiving line before touching the controls.'},
 ],
 'garden-alcove-flower-stone':[
  {speaker:'iris',text:'One petal has been polished smooth. The wear is from fingers lifting at the same point.'},
  {speaker:'mira',text:'A flower with a handle. Someone has gone to a great deal of trouble to make a lid feel at home in a garden.'},
  {speaker:'nell',text:'There is space beneath its seam. We can search under it carefully when we are ready; leave the supporting roots alone.'},
  {speaker:'pip',text:'I will hold the light. From a place where anything living underneath can see that I am being helpful.'},
 ],
 'workshop-alcove-hollow-perch':[
  {speaker:'pip',text:'This side rings clearly, and this side makes a soft little pause. I keep expecting a third side to answer me.'},
  {speaker:'iris',text:'Two different surfaces surround the same hollow space. The pegged cover can be examined without striking it harder.'},
  {speaker:'mira',text:'A perch with a pocket! Perhaps the birds have been carrying things home in their furniture.'},
  {speaker:'nell',text:'An interesting possibility. We can search inside the cover separately; there is no need to dismantle the whole rail.'},
 ],
 'garden-secret-final-second-controls':[
  {speaker:'iris',text:'The wear differs on these two controls. Their operators reached for different settings, over a long period.'},
  {speaker:'mira',text:'Two people, then. I like a machine that remembers how each of them held it.'},
  {speaker:'pip',text:'Shall I quiet my bird’s throat? He has been trying to help with every silence we find.'},
  {speaker:'nell',text:'For a moment, yes. Let us leave enough quiet to hear what this room has kept.'},
 ],
 'workshop-secret-final-small-step':[
  {speaker:'pip',text:'Those are courier feet on the top! Someone made this step so a bird could reach the lever itself.'},
  {speaker:'mira',text:'A tiny operator with a very large opinion about where the controls ought to be.'},
  {speaker:'iris',text:'The height, grip and landing space suit a bird. Its builder measured the intended user with unusual care.'},
  {speaker:'nell',text:'Then we should pay that user the courtesy of listening. Leave the step clear.'},
 ],
 'ending-home-memory':[
  {speaker:'mira',text:'Four cups and a whole loaf under that cloth. This is an exceptionally well-reasoned welcome.'},
  {speaker:'nell',text:'The corner repair uses wood from the post box. Someone had enough left to mend a place for another person.'},
  {speaker:'iris',text:'And the cloth has been changed recently. These preparations have continued throughout the interruption.'},
  {speaker:'pip',text:'Could my bird sit with us? He has helped to worry about this delivery all the way here.'},
 ],
 'ending-school-memory':[
  {speaker:'pip',text:'That stool is just the right height for the little lever. I wish all enormous machines came with one.'},
  {speaker:'iris',text:'Its shortened legs are level, and the extension follows the original lever’s movement. Both modifications work together.'},
  {speaker:'mira',text:'Somebody looked at a child and decided to change the furniture. I like their priorities.'},
  {speaker:'nell',text:'Leave the stool ready for the next learner. Good instructions can begin before anyone speaks.'},
 ],
 'ending-public-reply':[
  {speaker:'mira',text:'There! That little silver line appeared after the far lamp answered. The islands are taking turns.'},
  {speaker:'iris',text:'Their intervals differ. Each return has travelled its own distance through a working route.'},
  {speaker:'pip',text:'What if one of them takes a little longer? I sometimes need a moment before I know what to say.'},
  {speaker:'nell',text:'Then the receiving side stays open. A public bell should make room for the last answer too.'},
 ],
 'ending-secret-quiet-memory':[
  {speaker:'mira',text:'The cushion has been turned away from the drip. Someone keeps coming back to make this place comfortable.'},
  {speaker:'iris',text:'Fresh sap polish on the arm, too. The maintenance has been regular and considerate.'},
  {speaker:'pip',text:'Should we say something? I could say something very quietly. Or help with the cushion.'},
  {speaker:'nell',text:'The cushion is quite right, Pip. For now, we can simply listen together.'},
 ],
 'ending-secret-birds-reply':[
  {speaker:'pip',text:'That little horn knows their voices! They have been making their own answers all this time.'},
  {speaker:'iris',text:'Both traces retain their own shape. Sharing a pause has given them a place to meet.'},
  {speaker:'mira',text:'Our couriers have been arranging the music between deliveries. I hope they charge us a fair rehearsal fee.'},
  {speaker:'nell',text:'We shall begin by giving them room to finish. Their reply has earned our attention.'},
 ],
 'dead-brambles-memory':[
  {speaker:'pip',text:'The roots come right through the arch. At least someone put the cup where it keeps this bench dry.'},
  {speaker:'iris',text:'Its repaired side faces away from the falling water. Somebody checked the weak seam before setting it down.'},
  {speaker:'mira',text:'A small dry island for tired shoes. I shall remember that next time I complain about a cup.'},
  {speaker:'nell',text:'A brief rest, then back to our last choice. Leave their careful arrangement as we found it.'},
 ],
 'dead-aviary-memory':[
  {speaker:'pip',text:'Fresh felt, and fresh brass dust. Someone has mended this nest since the old route closed.'},
  {speaker:'iris',text:'The lining supports the wing without pressing its hinge. The repairer understood the bird’s proportions.'},
  {speaker:'mira',text:'A sunbed and a new blanket. I approve of this bird’s afternoon plan.'},
  {speaker:'nell',text:'Then let it rest. We have seen what this room needs to show us; our next turn is behind us.'},
 ],
 'dead-ferry-reply':[
  {speaker:'mira',text:'One excellent knot, one very empty berth. I suppose an adventurous hop would be a poor substitute for a ferry.'},
  {speaker:'iris',text:'Correct. A boarding rope requires a boat at its other end.'},
  {speaker:'pip',text:'I support both of those conclusions from this comfortable distance away from the rail.'},
  {speaker:'nell',text:'We shall return by the landing. Oren’s rule about waiting for a reply has proved useful again.'},
 ],
 'dead-echo-reply':[
  {speaker:'mira',text:'The reflected clock has our scratch on it. Even the untidy bits are keeping perfect time.'},
  {speaker:'iris',text:'The repeated scratch identifies the same surface. A separate answering clock would have marks of its own.'},
  {speaker:'pip',text:'So it cannot be a clock pretending to be our clock? I am pleased that we can rule that out.'},
  {speaker:'nell',text:'Mark where the channel ends, and we shall retrace our steps. This observation will improve the next choice.'},
 ],
});

/** An unknown prop never borrows a different object’s conversation. */
export function getObjectDialogue(id){
 return typeof id==='string'&&Object.hasOwn(OBJECT_DIALOGUES,id)?OBJECT_DIALOGUES[id]:null;
}
