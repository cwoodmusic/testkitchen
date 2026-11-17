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
      story:"I closed the post office and left its lamp on. The missing mail can wait while we look for the fault. These pipes used to carry water to the gardens. They still make a sound, so let us follow that clue.",
      route:"The listening gate needs two beats of sound, then two beats of silence. Play a half note, then a half rest. Iris can give us those tiles if we ask.",
      inventory:"Ask Iris for her listening phrase. It gives one half note and one half rest, once per run. They pay for the next gate. Keep the other tiles in our note bag.",
    },
    pip:{
      story:"My mail bird goes quiet when Iris turns that dial. Its wings still move, but it does not call. Perhaps it is listening. I shall listen too, behind someone taller.",
      route:"Make a sound for two beats, then leave two beats silent. Use a half note, then a half rest. The listening gate leads onward. Roots block the old arch.",
      inventory:"Ask Iris for her listening phrase before we try the gate. Its half note and half rest make four beats. I will hold the note bag while you listen.",
    },
  },
  'workshop-porch':{
    nell:{
      story:"That feather comes from an older kind of mail bird. We stopped using those before Pip learned to fix wings. I brought the returned letter so we can compare its stamp with the old routes.",
      route:"Use a half note, paired eighths, then four sixteenths at the running gate. They make two beats, one beat, and one beat. Pip can play the pattern.",
      inventory:"Ask Pip for his running phrase. Its half note, paired eighths, and four sixteenths open the next gate. We can take his gift once. Our other tiles stay in the note bag.",
    },
    iris:{
      story:"I brought seed from the greenhouse. These birds get power from their chargers, but they still come when Pip shakes the bowl. That is an interesting habit. I would like to test it.",
      route:"The running gate needs a half note, paired eighths, then four sixteenths. That makes four beats. Pip can play it for us. The birds turn away from the old bird house.",
      inventory:"Ask Pip for the running phrase. It gives the three tiles for the running gate, once per run. Save the other tiles in our note bag. More doors lie ahead.",
    },
  },
  'canal-porch':{
    nell:{
      story:"Oren and I have sent mail together for years. He checks every rope before a boat leaves. The mark on our letter comes from an old landing. Let us ask him what he knows.",
      route:"Play a half note, a quarter note, then paired eighths. They make two beats, one beat, and one beat. Oren can play this pattern for the delivery gate.",
      inventory:"Open the delivery chest once. It gives a half note, a quarter note, and paired eighths for the delivery gate. Keep our other note tiles for the rest of the route.",
    },
    iris:{
      story:"The garden used to receive water through these pipes. Their lamps still glow, but the main controls have stopped. Power and a working reply signal are different things. We need to find which one is missing.",
      route:"Use a half note, a quarter note, then paired eighths at the delivery gate. Hold two beats, sound one beat, then fit two quick sounds into the last beat.",
      inventory:"Open Oren’s delivery chest for a half note, a quarter note, and paired eighths. It can be collected once. We will keep our other note tiles together in the bag.",
    },
    pip:{
      story:"My birds circle this landing before flying over the water. They wait for a light from the other side. Today that light is missing. I thought they were afraid. Perhaps they are following a sensible rule.",
      route:"The delivery gate needs a half note, a quarter note, then paired eighths. Oren can play the pattern. There is no boat beyond the empty ferry door. I vote for the door with a working path.",
      inventory:"Open the delivery chest once. Its half note, quarter note, and paired eighths open the delivery gate in that order. I will check that we keep every unused tile.",
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
