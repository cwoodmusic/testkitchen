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
      story:'I closed the counter latch and left its lamp on. Letters can wait a little; that warm parcel deserves a walk. These pipes carried seed orders once. I remember the green stains on every envelope.',
      route:'Iris leaves room for a reply: two quiet beats, then a sound held for two. A half rest followed by a half note will open the listening gate. She has a phrase for us if we ask.',
      inventory:'Iris is keeping our next two tiles safe: one half rest and one half note. Ask her for the listening phrase once, then carry our remaining notes onward in the shared satchel.',
    },
    pip:{
      story:'The little courier on my strap goes quiet whenever Iris turns that dial. Its wings still twitch during the silence, as though someone on the far side is taking a breath. I want to hear the answer with all of us here.',
      route:'Let the bird wait through two beats, then let its call last two more. That is a half rest before a half note. Iris knows the listening gate; the tangled arch leads into roots.',
      inventory:'Ask Iris for her listening phrase before we try the gate. Its half rest and half note fill four beats together. I will keep the satchel steady while you listen.',
    },
  },
  'workshop-porch':{
    nell:{
      story:'That pale feather has an old post-office hinge. We stopped ordering those before Pip learned to wind a bird. I brought the parcel along so we can compare its seal with whatever the couriers remember.',
      route:'Pip stretches a wing for two beats, taps twice during the third, and four times during the fourth. Use a half note, paired eighths, then four sixteenths at the running gate.',
      inventory:'Pip has a running phrase to share once. Its half note, paired eighths, and four sixteenths pay the next gate exactly. Our other notes stay together in the satchel.',
    },
    iris:{
      story:'I brought seed from the greenhouse. Pip says their crystal throats need winding, but the birds still gather when the bowl rattles. Perhaps a familiar sound can be a kind of food.',
      route:'One long wingbeat, two little taps, four tiny taps: a half note, paired eighths, then four sixteenths. Pip can play it for us. The birds turn away from the old aviary.',
      inventory:'Pip offers the three tiles for the running gate. Ask him for that phrase once before we go onward; the rest of our shared notes will be needed later.',
    },
  },
  'canal-porch':{
    nell:{
      story:'I know every fold in Oren’s delivery rope. He mends it with the same thread I use for mailbags. That wet seal should have taken days to arrive, yet the wax on our parcel is still warm. I am glad we came together.',
      route:'The delivery knock holds one sound for two beats, taps once, then gives two quick replies in the final beat. Play a half note, a quarter, then paired eighths. Oren can sound the knock.',
      inventory:'The stamped chest carries my old post mark. Open it once for a half note, a quarter, and paired eighths; those three tiles pay the delivery gate while our other notes travel with us.',
    },
    iris:{
      story:'The light-water makes these roots lean toward the glass. They used to turn toward the great bell at dawn. I will walk with you a while longer; perhaps we will find what they are listening for.',
      route:'Watch the reflection hold for two beats, ripple once, then answer twice in one beat. That is a half note, a quarter, and paired eighths. The delivery gate follows that order.',
      inventory:'Oren keeps the next phrase in the stamped delivery chest: a half note, a quarter, and paired eighths. We can take that chest once and keep our remaining notes in the shared satchel.',
    },
    pip:{
      story:'My birds always circle this landing before crossing the light-water. Today one keeps looking back at all four of us. I have checked its compass twice. I think it is counting who came along.',
      route:'Oren’s knock takes a long step, one ordinary step, then two quick steps: a half note, a quarter, and paired eighths. The empty ferry has no boat; I would follow the delivery lamps.',
      inventory:'The stamped chest holds our delivery phrase. Open it once for a half note, a quarter, and paired eighths, then use those tiles in that order at the delivery gate.',
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
