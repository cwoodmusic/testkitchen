/** Story and dialogue for the first playable page of The Quiet Bell. */

export const OPENING = Object.freeze({
  title: 'The Quiet Bell',
  pageTitle: "The returned letter",
  intro: "Lumen Reach is a chain of floating islands. Its great bell has stopped, and mail and supplies are stuck. Mira finds a returned letter at Nell’s post office. The red wax that seals it is still warm. Who brought it back?",
});

export const PEOPLE = Object.freeze([
  {
    id: 'nell',
    name: 'Nell',
    role: "Post office keeper",
    goal: "Find out who brought the letter back and help the mail reach the islands again.",
    story: "I run this post office. No reply signals have reached us since the bell stopped. Yet this letter came back with warm wax. Take my note bag to open the route doors. It holds eight note tiles. The half note is in that chest.",
    route: "Choose the blue canal door. Its key is a half note, a quarter note, then paired eighths. That makes four beats: two, one, one. Take the half note from the chest first.",
    inventory: "My note bag holds eight tiles. The chest holds one more: a half note. You can collect each gift or chest once. A door uses only the tiles in its key. Your unused tiles stay in the bag.",
    demo: ['half', 'quarter', 'eighth-pair'],
  },
  {
    id: 'iris',
    name: 'Iris',
    role: "Gardener and researcher",
    goal: "Get water flowing through the garden pipes and hear from her friend again.",
    story: "My friend lives on another island. We used to play music together. Her messages stopped when the bell went quiet. I keep her cup ready for our next visit. The garden pipes need help too; the plants are waiting for water.",
    route: "Choose the garden door covered in ivy. Its key is a half note, then a half rest. Hold the sound for two beats. Leave the next two beats silent. Put them in that order.",
    inventory: "A rest means silence. A quarter rest lasts one beat; a half rest lasts two. A dotted half note lasts three beats. Save the tiles a door does not need. We will use them later.",
    demo: ['half', 'half-rest'],
  },
  {
    id: 'pip',
    name: 'Pip',
    role: "Mail carrier and bird keeper",
    goal: "Follow the mail birds and learn why they are still waiting for replies.",
    story: "These clockwork birds carry the mail. I wind their keys and mend their wings. One keeps turning toward the same dark window. I think it wants to show us something. I hope it is something friendly.",
    route: "Choose the workshop door marked with a gear. Play a half note, paired eighths, then four sixteenths. The tiles last two beats, one beat, and one beat. Four beats in all. I can play it for you.",
    inventory: "Paired eighths fill one beat. Four sixteenths also fill one beat, but make four quicker sounds. A single eighth or paired sixteenths lasts half a beat. Use only the tiles the lock asks for. I will help you keep the rest safe.",
    demo: ['half', 'eighth-pair', 'sixteenth-group'],
  },
].map(person => Object.freeze({ ...person, demo: Object.freeze(person.demo) })));

export const ROUTE_OUTCOMES = Object.freeze({
  garden: Object.freeze({
    title: 'The Garden Gate',
    kicker: 'A quiet opening',
    copy: "The roots move aside when the garden door hears our rhythm. Beyond it is Iris’s greenhouse. A water control starts to turn. We have found one machine that still responds.",
    replies: Object.freeze({
      nell: "I used to deliver seed orders here. Keep your unused note tiles. We need to find out why the garden can hear us but the bell cannot.",
      iris: "Two beats of sound, then two beats of silence. The lock accepted the whole pattern. Come in; I will show you the water pipes.",
      pip: "My birds stop calling beside that window. Perhaps they are listening for an answer. We should listen too. From a safe distance, if possible.",
    }),
  }),
  workshop: Object.freeze({
    title: 'The Makers Lane',
    kicker: 'Little feet answer',
    copy: "A clockwork bird taps the workshop door. A green line on the screen repeats its rhythm. The bird and this machine can still send messages to each other.",
    replies: Object.freeze({
      nell: "The workshop makes and repairs our mail birds. Someone here may know how a bird brought that letter home. Bring the note bag; more doors lie ahead.",
      iris: "They repair birds with wire, wood, and a great deal of patience. Let us find out what the birds have noticed.",
      pip: "That bird knows the way! I have cleaned its wing every morning. Perhaps I should spend more time watching where it points. Come on, before I lose my nerve.",
    }),
  }),
  canal: Object.freeze({
    title: 'The Canal Landing',
    kicker: 'A rhythm over water',
    copy: "The blue canal door opens. A slow knock comes back from the ferry landing across the water. Nell holds up the returned letter. Its wax is still warm.",
    replies: Object.freeze({
      nell: "That is Oren’s knock. He runs the ferry and checks the mail boats. Let us ask whether he saw the bird that carried our letter.",
      iris: "We grow the ferry’s lamp crystals in the greenhouse. A working crystal gives light, even while the route is closed. That difference may help us find the fault.",
      pip: "Oren calls my birds impatient little stars. They always pause before flying over water. I thought they were nervous. Perhaps they are waiting for a reply, like us.",
    }),
  }),
});
