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
    title: 'The Star-post Depot',
    arrival: 'The returned parcel rests beneath the depot’s dark route screens. Nell keeps the local lamp burning; Iris and Pip wait beside the doors they know.',
    people: PEOPLE.map(person => person.id === 'nell'
      ? { ...person, sourceId: 'nell-parcel', sourceLabel: 'Take Nell’s parcel' }
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
    arrival: 'Warm sap lights the glass manifold. Iris moves a second chair clear of a roof drip, then turns a copper dial until the roots fall quiet.',
    people: [{
      id: 'iris',
      name: 'Iris',
      role: 'Gardener',
      story: 'I mend that cup whenever the handle loosens. My friend used to answer my watering song from the other chair. Now the pipes hum her part, but always a little late. Pip says one of his birds pauses for the same reply.',
      route: 'Listen: two quiet beats, then one sound held for two beats. Put a half rest before a half note at the listening gate. The overgrown arch takes a dotted half and a quarter, but the roots close across that passage. I would try the listening gate first.',
      inventory: 'You can take my listening phrase once: one half rest and one half note. Choose “Take Iris’s listening phrase” to put them in your satchel. They pay for the listening gate exactly; keep the rest of your parcel for later.',
      demo: ['half-rest', 'half'],
      sourceId: 'iris-gift',
      sourceLabel: 'Take Iris’s listening phrase',
    }],
    inspections: [
      {
        id: 'garden-porch-second-cup',
        title: 'The second cup',
        label: 'Inspect the second cup',
        text: 'A dry cloth protects the empty place from the roof drip. The cup’s handle has a fresh seam of amber sap; someone has mended it carefully enough to use again.',
      },
      {
        id: 'garden-porch-graft',
        title: 'The patient graft',
        label: 'Inspect the patient graft',
        text: 'Living root threads through the crystal irrigation manifold, held to its copper pipe with garden twine. When the pipe’s hum fades, one green shoot pulses in reply.',
      },
      {
        id: 'garden-porch-old-plaque',
        title: 'The reused survey plaque',
        label: 'Inspect the survey plaque',
        text: 'A polished plate marked “Reach Survey Service” now supports three seed jars. Iris’s handwritten planting dates cover its official calibration numbers; the youngest leaves lean toward an unlit pane.',
      },
    ],
    doorCopy: {
      'garden-porch-forward': {
        name: 'The listening gate',
        hint: 'Two quiet beats, then two sounding beats. Iris can play the listening phrase.',
        previewCopy: 'The roots loosen their hold and the listening gate opens toward the Two Garden Paths. You have reached a continuation preview: the next room is not playable in this release yet. Revisit this choice to keep exploring the porch with your notes restored.',
      },
      'garden-porch-dead': {
        name: 'The overgrown arch',
        hint: 'An old inscription calls for a dotted half followed by a quarter.',
        warning: 'Iris warns that roots have closed the passage beyond this arch. The listening gate is the way onward.',
        deadCopy: 'The arch opens onto a little court entirely filled with roots. A ceramic cup catches the rain in a gentle, uneven rhythm. You can rest here, but there is no passage onward.',
        repair: 'Revisit this choice to recover the notes spent here. On Iris’s porch, collect her listening phrase if you have not already, then use a half rest followed by a half note at the listening gate.',
      },
    },
  },
  'workshop-porch': {
    title: 'Pip’s Bird Workshop',
    arrival: 'A blue-glass bird settles into a nest-shaped charger beneath an open brass wing. Pip lowers a perch, wipes copper polish from his fingers, and sets fresh seed beside a tray of gears.',
    people: [{
      id: 'pip',
      name: 'Pip',
      role: 'Courier and bird-tender',
      story: 'The little perches used to be above my head. I lowered them so I could repair a wing without taking its bird away from the others. That pale feather fits none of this flock. Oren remembers a courier like it waiting beside his mooring bell.',
      route: 'Hear the wing stretch for two beats, then two quick taps in one beat, then four tiny taps in one beat. The running gate wants a half note, paired eighths, and four sixteenths, in that order. The old aviary takes a dotted half and a quarter, but the birds turn away from it. Nothing answers there.',
      inventory: 'Take my running phrase once: a half note, paired eighths, and four sixteenths. Choose “Take Pip’s running phrase” to collect the three tiles. They fill four beats together and pay for the running gate exactly.',
      demo: ['half', 'eighth-pair', 'sixteenth-group'],
      sourceId: 'pip-gift',
      sourceLabel: 'Take Pip’s running phrase',
    }],
    inspections: [
      {
        id: 'workshop-porch-flight-jig',
        title: 'The practice wing',
        label: 'Inspect the practice wing',
        text: 'The test wing makes one long movement, two quick movements, then four tiny ones. Its adjustment screws are bright with copper polish, and Pip’s fingerprints mark the patched leather grip.',
      },
      {
        id: 'workshop-porch-seed-bowl',
        title: 'The unnecessary seed bowl',
        label: 'Inspect the seed bowl',
        text: 'Fresh seed husks scatter around the crystal charging cells. A brass bird nudges the bowl toward its neighbour before settling back into the warm nest.',
      },
      {
        id: 'workshop-porch-return-feather',
        title: 'The unmatched feather',
        label: 'Inspect the unmatched feather',
        text: 'One pale metal feather rests apart from the neatly sorted spares. Its hinge fits none of the birds on the bench; the bird nearest it keeps turning toward a blank place on the route board.',
      },
    ],
    doorCopy: {
      'workshop-porch-forward': {
        name: 'The running gate',
        hint: 'One long movement, two quick replies, then four tiny ones. Pip can play the running phrase.',
        previewCopy: 'The running gate answers with a flutter of brass wings and opens toward the Workshop Crossroads. You have reached a continuation preview: the next room is not playable in this release yet. Revisit this choice to keep exploring the workshop with your notes restored.',
      },
      'workshop-porch-dead': {
        name: 'The silent aviary',
        hint: 'Its tarnished plate calls for a dotted half followed by a quarter.',
        warning: 'Pip’s birds turn away from this door. Their old aviary has no onward passage; the running gate is the way onward.',
        deadCopy: 'Empty perches fill the old aviary. A small mechanical bird from the workshop follows you in, finds a patch of sunlight, and folds its wings. You have found a quiet resting place, but no way through.',
        repair: 'Revisit this choice to recover the notes spent here. In Pip’s workshop, collect his running phrase if you have not already, then use a half note, paired eighths, and four sixteenths at the running gate.',
      },
    },
  },
  'canal-porch': {
    title: 'The Canal Storehouse',
    arrival: 'Still blue water reflects a closed tide iris. Postage seals dry above the loading desk while Oren warms a pot of tea on a small crystal heater.',
    people: [{
      id: 'oren',
      name: 'Oren',
      role: 'Ferry keeper',
      story: 'I dry every seal before I send a parcel on. Salt ruins the addresses. That pale tide mark came back wet this morning, though I have not served its landing in years. Nell’s warm parcel carries the same smell. I have kept the tea on in case somebody comes to explain.',
      route: 'The delivery knock is one sound held for two beats, an ordinary tap, then two quick replies in the last beat. Use a half note, a quarter note, then paired eighths at the delivery gate. The empty ferry answers a dotted half and four sixteenths, but there is no boat beyond it.',
      inventory: 'Open the stamped delivery chest beside the desk. It holds one half note, one quarter note, and paired eighths, enough to pay the delivery gate exactly. The chest can be collected once. I have no extra notes in my pockets, only string and tea leaves.',
      demo: ['half', 'quarter', 'eighth-pair'],
    }],
    inspections: [
      {
        id: 'canal-porch-seal-line',
        title: 'The drying seals',
        label: 'Inspect the drying seals',
        text: 'Seals from flour deliveries and mended school coats hang on the same line. One bears a pale tide mark unfamiliar to the others; a drop falls from it into an otherwise dry tray.',
      },
      {
        id: 'canal-porch-loading-console',
        title: 'The secondhand navigator',
        label: 'Inspect the loading console',
        text: 'An old sky-navigation console is bolted to the wooden loading desk. Ferry rope and a carved wooden wedge hold its steering control steady; a tea ring neatly avoids the glowing blue dial.',
      },
      {
        id: 'canal-porch-mooring-bell',
        title: 'The small mooring bell',
        label: 'Inspect the mooring bell',
        text: 'Oren has tied the clapper safely aside with a tidy slip knot. Beside it, his note reads: “Wait for the return knock before calling a boat.” The rope is newly checked, although the water is still.',
      },
    ],
    doorCopy: {
      'canal-porch-forward': {
        name: 'The delivery gate',
        hint: 'A two-beat stroke, one ordinary tap, then two quick replies. Oren can play the delivery knock.',
        previewCopy: 'The delivery gate rises as a blue line of light travels across the water toward the Water Clock. You have reached a continuation preview: the next room is not playable in this release yet. Revisit this choice to keep exploring the storehouse with your notes restored.',
      },
      'canal-porch-dead': {
        name: 'The empty ferry',
        hint: 'A faded boarding plate calls for a dotted half followed by four sixteenths.',
        warning: 'Oren warns that no boat waits beyond this door. The delivery gate is the way onward.',
        deadCopy: 'The boarding door opens onto an empty landing. Its old rope reaches into still light-water, and Oren brings a second cup of tea while you watch the reflections. There is no ferry to carry you onward.',
        repair: 'Revisit this choice to recover the notes spent here. In the storehouse, open the stamped delivery chest if you have not already, then use a half note, a quarter note, and paired eighths at the delivery gate.',
      },
    },
  },
});

/** A journal can index observations by ID without treating them as visited rooms. */
export const CHAPTER_LORE = Object.freeze(Object.values(ROOM_CONTENT).flatMap(room => room.inspections));
