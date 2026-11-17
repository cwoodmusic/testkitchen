/** Room dialogue and observations. Reading this content never grants notes or travel. */
import { PEOPLE } from './opening.mjs';
import { DEPOT_LORE } from './lore.mjs';

const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

const depotDoors = {
  garden: { name: 'Garden door', hint: 'Iris knows the ivy-covered lock.' },
  workshop: { name: 'Workshop door', hint: 'Pip knows the gear-marked lock.' },
  canal: { name: 'Canal door', hint: 'Nell knows the blue canal lock.' },
};

export const ROOM_CONTENT = freeze({
  depot: {
    title: "Nell’s Post Office",
    arrival: "The returned letter lies below the dark mail-route screen. Nell keeps a lamp lit while Iris and Pip study the three locked doors. The group needs clues and note tiles before setting out.",
    people: PEOPLE.map(person => person.id === 'nell'
      ? { ...person, sourceId: 'nell-parcel', sourceLabel: "Take Nell’s note bag" }
      : { ...person }),
    inspections: DEPOT_LORE,
    doorCopy: {
      ...depotDoors,
      'depot-garden': depotDoors.garden,
      'depot-workshop': depotDoors.workshop,
      'depot-canal': depotDoors.canal,
    },
  },
  'garden-porch': {
    title: 'Iris’s Garden Porch',
    arrival: "Iris’s greenhouse is warm, but its water pipes have stopped. She moves her friend’s chair out of the rain. Then she turns a dial and listens to the roots.",
    people: [{
      id: 'iris',
      name: 'Iris',
      role: 'Gardener',
      story: "My friend lives on another island. She used to answer my music from this chair when she visited. Her messages stopped with the bell. The garden pipes still hum, so something here has power. I want to test why the water will not flow.",
      route: "The listening gate needs a half note, then a half rest. Hold one sound for two beats, then leave two beats silent. The overgrown arch uses a dotted half and a quarter, but roots block its path. Try the listening gate to move onward.",
      inventory: "Choose “Take Iris’s listening phrase” for one half note and one half rest. You can take this gift once. Those two tiles open the listening gate. Keep every other tile for later doors.",
      demo: ['half', 'half-rest'],
      sourceId: 'iris-gift',
      sourceLabel: 'Take Iris’s listening phrase',
    }],
    inspections: [
      {
        id: 'garden-porch-second-cup',
        title: 'The second cup',
        label: 'Inspect the second cup',
        text: "Iris has moved the empty chair away from the dripping roof. She has repaired the cup’s handle and left a clean cloth beside it. Her friend’s place is ready for another visit.",
      },
      {
        id: 'garden-porch-graft',
        title: "The young root",
        label: "Inspect the young root",
        text: "A young root is tied to a copper water pipe with garden string. The pipe hums. When the sound stops, the root gives a small green flash. It is answering the pipe.",
      },
      {
        id: 'garden-porch-old-plaque',
        title: "The seed shelf",
        label: "Inspect the seed shelf",
        text: "An old metal panel now holds three jars of seeds. Faint marks show where its machine controls used to be. Iris has covered them with planting dates. She has made a useful shelf from a broken machine.",
      },
    ],
    doorCopy: {
      'garden-porch-forward': {
        name: 'The listening gate',
        hint: "Play a half note, then a half rest: two beats of sound, then two beats of silence. Iris can play the pattern for you.",
        previewCopy: "The roots move aside. The listening gate opens onto the Two Garden Paths. The group can now follow the working pipes toward the homes or the old garden.",
      },
      'garden-porch-dead': {
        name: 'The overgrown arch',
        hint: "The old sign asks for a dotted half note, then a quarter note.",
        warning: "Iris warns that roots block the path beyond this arch. The listening gate leads onward.",
        deadCopy: "The arch opens into a small garden filled with roots. A cup catches the rain. There is no path onward from here.",
        repair: "Choose Revisit previous choice to get back the notes spent here. Ask Iris for her listening phrase if you still need it. Then open the listening gate with a half note followed by a half rest.",
      },
    },
  },
  'workshop-porch': {
    title: 'Pip’s Bird Workshop',
    arrival: "A clockwork bird settles into a charger shaped like a nest. Pip lowers a perch and wipes polish from his hands. These birds can still move, even while the main mail routes are closed.",
    people: [{
      id: 'pip',
      name: 'Pip',
      role: "Mail carrier and bird keeper",
      story: "I lowered these perches so I can reach the birds to fix their wings. That pale metal feather does not fit any bird here. Oren saw an older mail bird near his ferry bell. We should ask him about it.",
      route: "The running gate needs a half note, paired eighths, then four sixteenths. They last two beats, one beat, and one beat. The old bird house uses a dotted half and a quarter, but no path leads through it. I would follow the running gate.",
      inventory: "Choose “Take Pip’s running phrase” for a half note, paired eighths, and four sixteenths. This gift can be taken once. The three tiles make four beats and open the running gate.",
      demo: ['half', 'eighth-pair', 'sixteenth-group'],
      sourceId: 'pip-gift',
      sourceLabel: 'Take Pip’s running phrase',
    }],
    inspections: [
      {
        id: 'workshop-porch-flight-jig',
        title: 'The practice wing',
        label: 'Inspect the practice wing',
        text: "The test wing moves once slowly, twice quickly, then four times very quickly. That matches the running gate’s rhythm. Bright screws and a repaired handle show where Pip has been working.",
      },
      {
        id: 'workshop-porch-seed-bowl',
        title: "The birds’ seed bowl",
        label: 'Inspect the seed bowl',
        text: "Seed shells lie beside the glowing chargers. A brass bird pushes the bowl toward its neighbour. The birds get power from their chargers, but they still share the seed Pip leaves for them.",
      },
      {
        id: 'workshop-porch-return-feather',
        title: "The older bird’s feather",
        label: 'Inspect the unmatched feather',
        text: "This pale metal feather does not fit any bird on Pip’s workbench. A nearby bird keeps turning toward a blank space on the map. Could an older bird know a route that is missing from it?",
      },
    ],
    doorCopy: {
      'workshop-porch-forward': {
        name: 'The running gate',
        hint: "Play a half note, paired eighths, then four sixteenths. Pip can play the pattern for you.",
        previewCopy: "The running gate opens toward the Workshop Crossroads. A bird flies ahead and lands on an old rail. The group follows it to see which route it knows.",
      },
      'workshop-porch-dead': {
        name: 'The silent aviary',
        hint: "Its old sign asks for a dotted half note, then a quarter note.",
        warning: "Pip’s birds turn away from this door. The old bird house has no path onward. Use the running gate to keep going.",
        deadCopy: "The old bird house is full of empty perches. One bird follows you in and rests in a sunny spot. This is a place to rest, but there is no way through.",
        repair: "Choose Revisit previous choice to get back the notes spent here. Ask Pip for his running phrase if you still need it. Then use a half note, paired eighths, and four sixteenths at the running gate.",
      },
    },
  },
  'canal-porch': {
    title: 'The Canal Storehouse',
    arrival: "The canal water is still, and a round water gate is closed. Oren, the ferry keeper, warms a pot of tea. He will not call a boat until the landing can send a safe reply.",
    people: [{
      id: 'oren',
      name: 'Oren',
      role: 'Ferry keeper',
      story: "I keep the mail dry before it goes on a boat. This wet stamp came from a landing I have not served for years. It matches the mark on Nell’s returned letter. Someone has used that old route again. Sit down if you need to think. The tea is ready.",
      route: "The delivery gate needs a half note, a quarter note, then paired eighths. That is two beats, one beat, and one beat. The empty ferry door uses a dotted half and four sixteenths. There is no boat beyond that door.",
      inventory: "Open the delivery chest beside the desk. It holds a half note, a quarter note, and paired eighths. Those three tiles open the delivery gate. You can collect the chest once. I have no spare note tiles, only string and tea leaves.",
      demo: ['half', 'quarter', 'eighth-pair'],
    }],
    inspections: [
      {
        id: 'canal-porch-seal-line',
        title: 'The drying seals',
        label: 'Inspect the drying seals',
        text: "Mail stamps hang here to dry. One has a faded wave mark that is not on the others. Water drips from it into a dry tray. It has come from an older ferry landing.",
      },
      {
        id: 'canal-porch-loading-console',
        title: "The reused map screen",
        label: "Inspect the reused map screen",
        text: "Oren has fixed an old map screen to his loading desk. A wooden block holds one handle steady. The screen still glows, but it shows no returning message from the ferry landing.",
      },
      {
        id: 'canal-porch-mooring-bell',
        title: "The small ferry bell",
        label: "Inspect the ferry bell",
        text: "Oren has tied back the piece that strikes the bell. His note says, “Wait for a reply before calling a boat.” He has checked the rope, but he still has no reply from the landing.",
      },
    ],
    doorCopy: {
      'canal-porch-forward': {
        name: 'The delivery gate',
        hint: "Play a half note, a quarter note, then paired eighths. Oren can play the pattern for you.",
        previewCopy: "The delivery gate rises. A blue light leads across the canal toward the Water Clock. Oren checks the landing, then points the group toward the next clue.",
      },
      'canal-porch-dead': {
        name: 'The empty ferry',
        hint: "The faded boarding sign asks for a dotted half note, then four sixteenths.",
        warning: "Oren warns that no boat waits beyond this door. The delivery gate leads onward.",
        deadCopy: "The door opens onto an empty ferry landing. An old rope hangs over the still water. Oren brings another cup of tea, but no boat is coming to carry you farther.",
        repair: "Choose Revisit previous choice to get back the notes spent here. Open the delivery chest if you still need its tiles. Then use a half note, a quarter note, and paired eighths at the delivery gate.",
      },
    },
  },
});

/** A journal can index observations by ID without treating them as visited rooms. */
export const CHAPTER_LORE = Object.freeze(Object.values(ROOM_CONTENT).flatMap(room => room.inspections));
