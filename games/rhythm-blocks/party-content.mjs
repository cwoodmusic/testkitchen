/** Travelling companions are room conversations; only authored sources grant notes. */
import {PEOPLE} from './opening.mjs';
import {ROOM_CONTENT} from './chapter-content.mjs';
import {CHAPTER_DOORS} from './chapter.mjs';

const freeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.values(value).forEach(freeze);Object.freeze(value);
  }
  return value;
};
export const PARTY_MEMBER_IDS=Object.freeze(['nell','iris','pip']);
const members=new Map(PEOPLE.map(person=>[person.id,person]));

// Residents keep their established dialogue. These lines let the other party
// members notice each place while keeping each room's exact key understandable.
const companionDialogue={
  'garden-porch':{
    nell:{
      story:"I’ve closed the post office and left its lamp on. The missing mail can wait while we find the fault. These pipes used to carry water to the gardens, and they still make a sound. Let’s follow that clue.",
      route:"The listening gate needs two beats of sound, then two beats of silence. Play a half note, then a half rest. Iris can give us those tiles, so let’s ask her.",
      inventory:"Ask Iris for her listening phrase before leaving. We get one half note and one half rest, once per run. They pay the listening gate. Later doors need the other tiles, so we can’t spend them carelessly.",
    },
    pip:{
      story:"My mail bird goes quiet when Iris turns that dial. Its wings still move, but it doesn’t call. Iris says it’s listening. I think it looks worried, and I’d rather listen from behind someone taller.",
      route:"Make a sound for two beats, then leave two beats silent. That’s a half note, then a half rest. The listening gate leads onward, but roots block the old arch.",
      inventory:"Ask Iris for her listening phrase before we try the gate. Its half note and half rest make four beats. I’ll hold the note bag while you listen.",
    },
  },
  'workshop-porch':{
    nell:{
      story:"That feather’s from an older kind of mail bird. We stopped using those before Pip learned to fix wings. I’ve brought the returned letter, so we can compare its stamp with the old routes.",
      route:"Use a half note, paired eighths, then four sixteenths at the running gate. That’s two beats, one beat, and one beat. Pip can play it for us.",
      inventory:"Ask Pip for his running phrase before leaving. Its half note, paired eighths, and four sixteenths open the next gate. Take it once per run, and save the other kinds for later. Paid keys don’t return.",
    },
    iris:{
      story:"I brought seed from the greenhouse. These birds get power from their chargers, but they still come when Pip shakes the bowl. Pip says they like him. I’d like to test that before we call it a fact.",
      route:"The running gate needs a half note, paired eighths, then four sixteenths. That’s four beats, and Pip can play it for us. The birds turn away from the old bird house.",
      inventory:"Ask Pip for the running phrase. It gives us the running gate’s three tiles, once per run. We’ll need the others for later doors, so keep them in our note bag.",
    },
  },
  'canal-porch':{
    nell:{
      story:"Mira, you can ask about snacks after we’ve checked the letter. Oren and I have sent mail together for years, and he checks every rope before a boat leaves. Our letter’s mark is from an old landing. Let’s ask him what he knows.",
      route:"Play a half note, a quarter note, then paired eighths. That’s two beats, one beat, and one beat. Oren can play this pattern for the delivery gate.",
      inventory:"Open the delivery chest once for a half note, a quarter note, and paired eighths. They’ll open the delivery gate. We’ll keep our other note tiles for the rest of the route.",
    },
    iris:{
      story:"The garden used to get water through these pipes. Their lamps still glow, but the main controls have stopped. Having power isn’t the same as getting a reply signal. We need to find out which one’s missing.",
      route:"Use a half note, a quarter note, then paired eighths at the delivery gate. Hold the sound for two beats, sound one beat, then fit two quick sounds into the last beat.",
      inventory:"Open Oren’s delivery chest for a half note, a quarter note, and paired eighths. We can collect it once, and we’ll keep our other note tiles together in the bag.",
    },
    pip:{
      story:"My birds circle this landing before flying over the water. They wait for a light from the other side, but today it’s missing. I thought they were afraid. Maybe they’re just following a sensible rule.",
      route:"The delivery gate needs a half note, a quarter note, then paired eighths. Oren can play it for us. There’s no boat beyond the empty ferry door, so I vote for the door with a working path.",
      inventory:"Open the delivery chest once. Its half note, quarter note, and paired eighths open the delivery gate in that order. I’ll check that we keep every unused tile.",
    },
  },
};

export const PARTY_PEOPLE_BY_ROOM=freeze(Object.fromEntries(Object.entries(ROOM_CONTENT).map(([roomId,room])=>[
  roomId,PARTY_MEMBER_IDS.map(id=>room.people.find(person=>person.id===id)??{
    ...members.get(id),...companionDialogue[roomId][id],demo:CHAPTER_DOORS[`${roomId}-forward`].recipe,
  }),
])));
const peopleByRoom=freeze(Object.fromEntries(Object.entries(ROOM_CONTENT).map(([roomId,room])=>[
  roomId,[...PARTY_PEOPLE_BY_ROOM[roomId],...room.people.filter(person=>!PARTY_MEMBER_IDS.includes(person.id))],
])));
const empty=Object.freeze([]);

/** All companions plus local residents, with stable records and source metadata. */
export function getRoomPeople(roomId){
  return typeof roomId==='string'&&Object.hasOwn(peopleByRoom,roomId)?peopleByRoom[roomId]:empty;
}

/** Catalog only the additional dialogue; reading it is still an explicit event. */
export const PARTY_ROUTE_HINTS=freeze(Object.entries(ROOM_CONTENT).flatMap(([roomId,room])=>
  PARTY_PEOPLE_BY_ROOM[roomId].filter(person=>!room.people.some(resident=>resident.id===person.id)).map(person=>({
    id:`${roomId}-${person.id}-route`,title:`${person.name} · ${room.title}`,text:person.route,
  }))
));
