/** Short scene introductions; evidence and conversations still tell the story. */
export const ROOM_NARRATIONS=Object.freeze({
 depot:'Nell’s post office serves the floating islands of Lumen Reach. With the public bell silent, mail is piling up and gardens are waiting for water. A letter has somehow come back with warm wax on its seal; Mira and her friends will search for clues and a way onward.',
 'garden-porch':'Pots of herbs surround Iris’s porch, but the pipe that waters them has stopped. A small lamp still shines beside the silent controls. The friends need to find what still works and choose a path deeper into the garden.',
 'workshop-porch':'Pip’s workshop is full of brass mail birds, tools, and careful repairs. The main delivery routes are closed, yet some birds can still move and charge here. Search for signs of where they have been before trying the workshop’s next door.',
 'canal-porch':'Oren keeps supplies ready beside the empty ferry landing. Its lamps must receive a reply that means the far landing is safe, but no reply has arrived. The friends will ask Oren what he has seen and look for a route to the water clock.',
 'garden-fork':'Two paths divide a garden shared by several homes. The newer path leads toward the household water controls; older stones disappear beneath the roots. The friends must choose which clues to follow while keeping enough note tiles for the doors ahead.',
 'workshop-fork':'A bright teaching stair and a narrow service passage lead away from the repair shelf. The stair serves the music room, while small mail birds have been using the older passage. Look at the tools and tracks to decide which connection to investigate.',
 'canal-fork':'The water clock still ticks, although the ferry’s safety lamps remain dark. One stair climbs toward the public bell, and another passage follows a channel that repeats the clock’s sound. The friends need a route that can carry a reply back to town.',
 'garden-final':'A small household bell hangs inside a much older machine. This room connects nearby homes and garden water controls, but their replies are not getting through. The friends have reached a place where they can restore a useful part of the town’s system.',
 'workshop-final':'Low stools surround the music room’s great brass instrument. Its controls help people learn to send a call and listen for an answer, but the listening connection has failed. The friends must get this shared room working again so lessons can continue.',
 'canal-final':'Dark route lamps line the tower beneath Lumen Reach’s silent public bell. The bell can send a call, but a loose return wire prevents it from hearing the islands answer. The friends have reached the main connection that the whole town needs repaired.',
 'garden-alcove':'Roots curve around an old music box beneath a flower-carved stone. Someone has kept its lid clear, and the stone has a small grip. The friends will search this forgotten stop for a way onward while saving the note tiles they brought for the final door.',
 'workshop-alcove':'Old wing wraps and a little cleaning brush fill the birds’ attic. A hollow perch has a cover that Pip has never opened alone. The friends will look for clues about the birds’ forgotten service route.',
 'garden-secret-final':'Two sets of music controls face a window that carries sound between islands. Iris’s friend lives across the water, but the window’s broken listening connection has kept her reply from reaching Iris. The friends will try to restore that connection together.',
 'workshop-secret-final':'A small horn stands beside the larger message horn, with a step made for a bird. This old station lets the couriers send their own replies instead of only carrying other people’s calls. The friends have found the controls for the birds’ separate reply route.',
 'ending-home':'Warm kitchen windows face a shared courtyard, and household chimes can be heard again. Water begins moving through the nearby garden pipes. With this local connection restored, the friends can look around and see which daily jobs people can finally resume.',
 'ending-school':'The shared music room is ready for learners again, with low stools around its listening instrument. A practice call now receives a clear answer. The friends can explore the room, talk about what they discovered, and see how this repaired connection will help others learn.',
 'ending-public':'The public bell sounds above a terrace overlooking the floating islands. One route lamp answers, then another shines farther across the water. The friends can watch those replies return and learn what this repair means for the mail, gardens, and ferries.',
 'ending-secret-quiet':'A quiet garden window carries music from another island. Iris’s friend can answer her again, and the empty chair is ready for a future visit. The friends have time to listen, explore the terrace, and talk about the small connection they restored.',
 'ending-secret-birds':'A small answering horn faces the couriers’ service perches. Two different tunes move across the screen as a bird sends its own reply. The friends can listen to the birds, examine the old station, and see what this separate route has made possible.',
 'dead-brambles':'Thick roots block the old arch, with no safe opening beyond them. A sheltered bench shows that people still care for this corner, even though it cannot lead the friends onward. They can return to Iris’s porch and try the other gate without losing their notes.',
 'dead-aviary':'Warm light falls across a row of quiet bird perches. There is room to rest here, but the wall behind them has no passage onward. The friends can return to Pip’s workshop and choose its other gate; revisiting the choice will restore the notes they spent.',
 'dead-ferry':'A slack boarding rope hangs over still water, but no ferry has arrived. This room offers shelter and clues, but it cannot take the friends closer to the bell. They can return to the storehouse, recover their spent notes, and look for another route.',
 'dead-echo':'The channel copies the water clock’s rhythm all the way to a solid stone wall. A repeated sound cannot carry the friends onward or bring a message back. They can revisit the water-clock choice, recover the notes they spent, and try the stair to the public bell.',
});

/** Supply new defaults only where an older saved project has no narration key. */
export function upgradeRoomNarration(project){
 const updated=structuredClone(project);
 for(const [id,narration]of Object.entries(ROOM_NARRATIONS)){
  const content=updated?.content?.[id];
  if(content&&typeof content==='object'&&!Array.isArray(content)&&!Object.hasOwn(content,'narration'))content.narration=narration;
 }
 return updated;
}
