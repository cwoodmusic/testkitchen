/** Story and dialogue for the first playable page of The Quiet Bell. */

export const OPENING = Object.freeze({
  title: 'The Quiet Bell',
  pageTitle: 'The parcel',
  intro: 'The town bell has fallen silent. At the parcel depot, Mira finds an old parcel, a delivery chest, and three people who remember different parts of its song.',
});

export const PEOPLE = Object.freeze([
  {
    id: 'nell',
    name: 'Nell',
    role: 'Postkeeper',
    goal: 'Deliver the former bellkeeper’s last parcel and hear the town bell ring again.',
    story: 'I kept this parcel for the old bellkeeper. Eight notes are inside; the last one is in that chest. Iris and Pip can help you choose a door.',
    route: 'The blue canal door has the ferry keeper’s lock. Choose that door, then play a half note, a quarter note, and paired eighths, in that order. You will need the half note from the chest.',
    inventory: 'My parcel holds eight note kinds; the half note is in the delivery chest. Each gift and chest can be collected once. Opening a door spends its exact rhythm; everything else stays in your satchel.',
    demo: ['half', 'quarter', 'eighth-pair'],
  },
  {
    id: 'iris',
    name: 'Iris',
    role: 'Gardener',
    goal: 'Leave room in the restored music for an absent friend’s unfinished phrase.',
    story: 'There used to be two of us playing in the garden. I still leave the other chair empty. Everyone wants the bell to ring again. I want us to hear what comes after it.',
    route: 'The ivy-covered garden door asks for two quiet beats followed by two sounding beats: a half rest, then a half note. Choose its lock before arranging that answer. The order matters.',
    inventory: 'Rests are time for listening: a quarter rest holds one quiet beat, a half rest holds two. That dotted half note lasts three beats. You do not have to spend an unusual tile just because you can.',
    demo: ['half-rest', 'half'],
  },
  {
    id: 'pip',
    name: 'Pip',
    role: 'Courier and bird-tender',
    goal: 'Wake the clockwork birds’ answering song and share it with the town.',
    story: 'Nell finally trusts me with real deliveries. These clockwork birds once answered the bell. I want to hear them sing again—try the workshop door.',
    route: 'Choose the gear-marked workshop door. Its lock wants a half note first, then paired eighths, then four sixteenths. Three tiles, four beats, and little footsteps that grow quicker.',
    inventory: 'Paired eighths and four sixteenths each fill one beat, but they sound different. A single eighth or a pair of sixteenths fills only half a beat. The small notes are useful; I would not empty the whole parcel at once.',
    demo: ['half', 'eighth-pair', 'sixteenth-group'],
  },
].map(person => Object.freeze({ ...person, demo: Object.freeze(person.demo) })));

export const ROUTE_OUTCOMES = Object.freeze({
  garden: Object.freeze({
    title: 'The Garden Gate',
    kicker: 'A quiet opening',
    copy: 'The last note fades. From beyond the depot window, the garden latch answers with a small, clear click. Iris reaches for the empty chair beside her basket.',
    replies: Object.freeze({
      nell: 'Iris has been waiting for someone who knows how to leave a little room. Keep the notes you did not spend; you will need them beyond the gate.',
      iris: 'You left a breath before you spoke. Come to the garden gate; there is a phrase I would like you to hear.',
      pip: 'I will let the birds wait a moment. They make enough noise to miss a quiet answer like that.',
    }),
  }),
  workshop: Object.freeze({
    title: 'The Makers Lane',
    kicker: 'Little feet answer',
    copy: 'A tiny tapping answers from the workshop shutters. Pip’s clockwork bird lifts its head, repeats the quick notes, and points its brass beak toward Makers Lane.',
    replies: Object.freeze({
      nell: 'Letters for Makers Lane always come back with little gear marks on the envelopes. Perhaps this parcel belongs there next.',
      iris: 'Those small notes found an answer of their own. Listen carefully when the makers speak back.',
      pip: 'Did you hear that? It copied you! Come see the other birds—we might finally learn what they have been trying to say.',
    }),
  }),
  canal: Object.freeze({
    title: 'The Canal Landing',
    kicker: 'A rhythm over water',
    copy: 'A steady tapping carries back from the canal. Nell recognizes the ferry keeper’s old reply and turns the parcel so its faded address faces the water.',
    replies: Object.freeze({
      nell: 'That is his knock. The canal keeper remembers more of the bell’s last evening than anyone. Let us see what he has kept.',
      iris: 'The water carries an ordinary rhythm a long way. Perhaps it has carried part of our missing song, too.',
      pip: 'The ferry keeper always says I rush my deliveries. He should like that one. I will take the next parcel down ahead of you.',
    }),
  }),
});
