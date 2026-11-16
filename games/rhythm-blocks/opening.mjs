/** Story and dialogue for the first playable page of The Quiet Bell. */

export const OPENING = Object.freeze({
  title: 'The Quiet Bell',
  pageTitle: 'The parcel',
  intro: 'The Lumen Reach’s great bell has fallen silent. In a star-post depot full of dark route screens and living copper roots, Mira finds the bellkeeper’s returned parcel with its wax still warm.',
});

export const PEOPLE = Object.freeze([
  {
    id: 'nell',
    name: 'Nell',
    role: 'Postkeeper',
    goal: 'Find out how the bellkeeper’s parcel crossed a silent route and reopen the island post.',
    story: 'I keep a lamp lit for the last letters crossing the Lumen Reach. The bellkeeper’s parcel came back with warm wax even though every route lamp is dark. Eight notes are inside; the last one is in that chest.',
    route: 'The blue canal door has the ferry keeper’s lock. Choose that door, then play a half note, a quarter note, and paired eighths, in that order. You will need the half note from the chest.',
    inventory: 'My parcel holds eight note kinds; the half note is in the delivery chest. Each gift and chest can be collected once. Opening a door spends its exact rhythm; everything else stays in your satchel.',
    demo: ['half', 'quarter', 'eighth-pair'],
  },
  {
    id: 'iris',
    name: 'Iris',
    role: 'Gardener',
    goal: 'Reconnect the sky-garden’s living conduits while keeping a place for her absent friend.',
    story: 'I still set two cups beside the greenhouse dials, though my friend’s chair is empty. Since the bell went quiet, the roots have stopped following the brass pipes; they lean toward a dark patch of sky.',
    route: 'The ivy-covered garden door asks for two quiet beats followed by two sounding beats: a half rest, then a half note. Choose its lock before arranging that answer. The order matters.',
    inventory: 'Rests are time for listening: a quarter rest holds one quiet beat, a half rest holds two. That dotted half note lasts three beats. You do not have to spend an unusual tile just because you can.',
    demo: ['half-rest', 'half'],
  },
  {
    id: 'pip',
    name: 'Pip',
    role: 'Courier and bird-tender',
    goal: 'Follow the courier birds’ last remembered route and bring back their answering song.',
    story: 'I bring seed for the courier birds out of habit, then wind their little crystal throats. One keeps turning toward the same dark window. I think it’s still waiting for someone to answer.',
    route: 'Choose the gear-marked workshop door. Its lock wants a half note first, then paired eighths, then four sixteenths. Three tiles, four beats, and little footsteps that grow quicker.',
    inventory: 'Paired eighths and four sixteenths each fill one beat, but they sound different. A single eighth or a pair of sixteenths fills only half a beat. The small notes are useful; I would not empty the whole parcel at once.',
    demo: ['half', 'eighth-pair', 'sixteenth-group'],
  },
].map(person => Object.freeze({ ...person, demo: Object.freeze(person.demo) })));

export const ROUTE_OUTCOMES = Object.freeze({
  garden: Object.freeze({
    title: 'The Garden Gate',
    kicker: 'A quiet opening',
    copy: 'The copper roots around the garden door answer with a thin green glow. Beyond the glass, a greenhouse dial turns once, and Iris reaches for the folded cloth she keeps for the empty chair.',
    replies: Object.freeze({
      nell: 'I used to deliver seed letters through that window. Keep the notes the lock left you; the greenhouse has been listening longer than this depot.',
      iris: 'The roots heard the space you left. I’ll show you where I put the second chair.',
      pip: 'My birds always go quiet beside that glass. I thought they were asleep; perhaps they were listening.',
    }),
  }),
  workshop: Object.freeze({
    title: 'The Makers Lane',
    kicker: 'Little feet answer',
    copy: 'A brass bird taps the workshop shutter with its beak. Behind it, a green line wakes on an old screen and repeats the same quick rhythm.',
    replies: Object.freeze({
      nell: 'They still send me paper invoices from Makers Lane; the birds eat the corners. Take the notes you kept. Someone there may know who built these little messengers.',
      iris: 'The makers thread wire through living wood as if it were a sewing needle. Ask them why the birds remember a song the bell has forgotten.',
      pip: 'That’s the first time it’s answered me. I’ve been oiling that same hinge every morning. Come on; the others may still remember the way.',
    }),
  }),
  canal: Object.freeze({
    title: 'The Canal Landing',
    kicker: 'A rhythm over water',
    copy: 'The canal door’s blue glass fills with wavering stars. A slow tapping returns through the old ferry speaker; Nell turns the warm parcel so its faded address faces the water.',
    replies: Object.freeze({
      nell: 'That’s the keeper’s knock. I used to send the last post by his lantern, after the route screens went dim. I want to ask how this parcel found its way back.',
      iris: 'We used to grow the ferry’s lamp crystals in the greenhouse. The keeper always returned the cracked ones wrapped in soft cloth.',
      pip: 'The keeper calls my birds “impatient little stars.” I’ve never told him they stop to listen at every landing. Let’s see which voice they recognize.',
    }),
  }),
});
