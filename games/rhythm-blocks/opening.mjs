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
    story: "Mira, eyes on the letter for a second. I run this post office, but we haven’t had a reply signal since the bell stopped. Somehow, this letter came back with warm wax. Take my note bag for the route doors. There are eight tiles inside, and the half note’s in that chest.",
    route: "Choose the blue canal door. You’ll need a half note, a quarter note, then paired eighths. That’s four beats: two, one, one. Get the half note from the chest first.",
    inventory: "There are eight tiles in my note bag and one more in the chest: a half note. You can collect each gift or chest once. A door only uses the tiles in its key, so we’ll keep the rest in the bag.",
    demo: ['half', 'quarter', 'eighth-pair'],
  },
  {
    id: 'iris',
    name: 'Iris',
    role: "Gardener and researcher",
    goal: "Get water flowing through the garden pipes and hear from her friend again.",
    story: "My friend lives on another island, and we used to play music together. Her messages stopped when the bell went quiet. I’ve kept her cup ready for our next visit. The garden pipes need help too. The plants are still waiting for water.",
    route: "Choose the garden door covered in ivy. You’ll need a half note, then a half rest. Hold the sound for two beats, and leave the next two beats silent. The order matters.",
    inventory: "A rest means silence. A quarter rest lasts one beat, and a half rest lasts two. A dotted half note lasts three beats. Keep the tiles a door doesn’t need. We’ll use them later.",
    demo: ['half', 'half-rest'],
  },
  {
    id: 'pip',
    name: 'Pip',
    role: "Mail carrier and bird keeper",
    goal: "Follow the mail birds and learn why they are still waiting for replies.",
    story: "These clockwork birds carry the mail, and I wind their keys and mend their wings. That one keeps turning toward the same dark window. I think it’s trying to show us something. I’m hoping it’s something friendly.",
    route: "Choose the workshop door marked with a gear. Play a half note, paired eighths, then four sixteenths. That’s two beats, one beat, and one beat. Four altogether! I can play it for you.",
    inventory: "Paired eighths fill one beat, and four sixteenths do too. The sixteenths make four quicker sounds. A single eighth or paired sixteenths lasts half a beat. Use what the lock asks for, and I’ll help keep the rest safe.",
    demo: ['half', 'eighth-pair', 'sixteenth-group'],
  },
].map(person => Object.freeze({ ...person, demo: Object.freeze(person.demo) })));

export const ROUTE_OUTCOMES = Object.freeze({
  garden: Object.freeze({
    title: 'The Garden Gate',
    kicker: 'A quiet opening',
    copy: "The roots move aside when the garden door hears our rhythm. Beyond it is Iris’s greenhouse. A water control starts to turn. We have found one machine that still responds.",
    replies: Object.freeze({
      nell: "I used to deliver seed orders here. Keep those unused tiles. We need to find out why the garden can hear us but the bell can’t.",
      iris: "Two beats of sound, then two beats of silence. The lock accepted the whole pattern. Come in, and I’ll show you the water pipes.",
      pip: "My birds stop calling beside that window. Maybe they’re listening for an answer. We should listen too. From a safe distance, if that’s an option.",
    }),
  }),
  workshop: Object.freeze({
    title: 'The Makers Lane',
    kicker: 'Little feet answer',
    copy: "A clockwork bird taps the workshop door. A green line on the screen repeats its rhythm. The bird and this machine can still send messages to each other.",
    replies: Object.freeze({
      nell: "The workshop makes and repairs our mail birds. Someone here might know how a bird brought that letter home. Bring the note bag. We’ve got more doors ahead.",
      iris: "They fix birds with wire, wood, and plenty of patience. Let’s find out what the birds have noticed.",
      pip: "That bird knows the way! I’ve cleaned its wing every morning, but I should’ve watched where it was pointing. Come on, before I lose my nerve.",
    }),
  }),
  canal: Object.freeze({
    title: 'The Canal Landing',
    kicker: 'A rhythm over water',
    copy: "The blue canal door opens. A slow knock comes back from the ferry landing across the water. Nell holds up the returned letter. Its wax is still warm.",
    replies: Object.freeze({
      nell: "That’s Oren’s knock. He runs the ferry and checks the mail boats. Let’s ask if he saw the bird that carried our letter.",
      iris: "We grow the ferry’s lamp crystals in the greenhouse. A working crystal still gives light when the route’s closed. That difference could help us find the fault.",
      pip: "Oren calls my birds impatient little stars. They always pause before flying over water, and I thought they were nervous. Maybe they’re waiting for a reply, just like us.",
    }),
  }),
});
