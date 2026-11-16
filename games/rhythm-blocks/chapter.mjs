/** The shipped chapter only: four playable rooms and six honest boundaries. */
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const CHAPTER_ROOMS=freeze({
 depot:{id:'depot',title:'The Parcel Depot',stage:1,sources:['nell-parcel','depot-chest'],doors:['garden','workshop','canal']},
 'garden-porch':{id:'garden-porch',title:'Iris’s Garden Porch',stage:2,sources:['iris-gift'],doors:['garden-porch-forward','garden-porch-dead']},
 'workshop-porch':{id:'workshop-porch',title:'Pip’s Bird Workshop',stage:2,sources:['pip-gift'],doors:['workshop-porch-forward','workshop-porch-dead']},
 'canal-porch':{id:'canal-porch',title:'The Canal Storehouse',stage:2,sources:['canal-chest'],doors:['canal-porch-forward','canal-porch-dead']}
});
export const CHAPTER_SOURCES=freeze({
 'nell-parcel':{id:'nell-parcel',roomId:'depot',type:'npc',character:'nell',recipe:['quarter','eighth-pair','sixteenth-group','eighth','quarter-rest','half-rest','dotted-half','sixteenth-pair'],label:'Nell’s old parcel',hint:'Talk to Nell and accept the parcel once. It holds ten beats in eight different note kinds.'},
 'depot-chest':{id:'depot-chest',roomId:'depot',type:'chest',recipe:['half'],label:'The small delivery chest',hint:'Nell points out a small chest beside her counter. Its half note is needed for every opening door.'},
 'iris-gift':{id:'iris-gift',roomId:'garden-porch',type:'npc',character:'iris',recipe:['half-rest','half'],label:'Iris’s listening phrase',hint:'Iris gives back the two kinds used at the garden door. These are needed for the next garden gate.'},
 'pip-gift':{id:'pip-gift',roomId:'workshop-porch',type:'npc',character:'pip',recipe:['half','eighth-pair','sixteenth-group'],label:'Pip’s running phrase',hint:'Pip offers a half note, paired eighths, and four sixteenths. The workshop gate needs that precise phrase.'},
 'canal-chest':{id:'canal-chest',roomId:'canal-porch',type:'chest',recipe:['half','quarter','eighth-pair'],label:'The stamped delivery chest',hint:'The ferry keeper points out a chest bearing Nell’s postage. Its three notes match the lock ahead.'}
});
export const CHAPTER_DOORS=freeze({
 garden:{id:'garden',canonicalId:'depot-garden',from:'depot',to:'garden-porch',recipe:['half-rest','half'],label:'The garden door',hint:'Two quiet beats, then two sounding beats.'},
 workshop:{id:'workshop',canonicalId:'depot-workshop',from:'depot',to:'workshop-porch',recipe:['half','eighth-pair','sixteenth-group'],label:'The workshop door',hint:'A long step, two quick steps, then four tiny steps.'},
 canal:{id:'canal',canonicalId:'depot-canal',from:'depot',to:'canal-porch',recipe:['half','quarter','eighth-pair'],label:'The canal door',hint:'A long step, one ordinary step, then paired footsteps.'},
 'garden-porch-forward':{id:'garden-porch-forward',canonicalId:'garden-porch-forward',from:'garden-porch',to:'garden-fork',recipe:['half-rest','half'],label:'The listening gate'},
 'garden-porch-dead':{id:'garden-porch-dead',canonicalId:'garden-porch-dead',from:'garden-porch',to:'dead-brambles',recipe:['dotted-half','quarter'],label:'The overgrown arch',warning:'A faded answer is scratched beside the arch. Iris warns that the path behind it is overgrown.'},
 'workshop-porch-forward':{id:'workshop-porch-forward',canonicalId:'workshop-porch-forward',from:'workshop-porch',to:'workshop-fork',recipe:['half','eighth-pair','sixteenth-group'],label:'The running gate'},
 'workshop-porch-dead':{id:'workshop-porch-dead',canonicalId:'workshop-porch-dead',from:'workshop-porch',to:'dead-aviary',recipe:['dotted-half','quarter'],label:'The silent aviary',warning:'The birds turn away from this door. Pip says its long call has nowhere to return from.'},
 'canal-porch-forward':{id:'canal-porch-forward',canonicalId:'canal-porch-forward',from:'canal-porch',to:'canal-fork',recipe:['half','quarter','eighth-pair'],label:'The delivery gate'},
 'canal-porch-dead':{id:'canal-porch-dead',canonicalId:'canal-porch-dead',from:'canal-porch',to:'dead-ferry',recipe:['dotted-half','sixteenth-group'],label:'The empty ferry',warning:'A rotted boarding rope hangs beyond this door. The ferry keeper warns that no boat waits there.'}
});
export const CHAPTER_PREVIEWS=freeze({
 'garden-fork':{id:'garden-fork',title:'The Two Garden Paths',stage:3,kind:'preview'},
 'workshop-fork':{id:'workshop-fork',title:'The Workshop Crossroads',stage:3,kind:'preview'},
 'canal-fork':{id:'canal-fork',title:'The Water Clock',stage:3,kind:'preview'}
});
export const CHAPTER_TERMINALS=freeze({
 'dead-brambles':{id:'dead-brambles',title:'The Overgrown Arch',stage:3,kind:'dead-end',repair:'Revisit Iris’s porch and use her gift at the listening gate.'},
 'dead-aviary':{id:'dead-aviary',title:'The Silent Aviary',stage:3,kind:'dead-end',repair:'Revisit Pip’s workshop and use his running phrase at the workshop gate.'},
 'dead-ferry':{id:'dead-ferry',title:'The Empty Ferry',stage:3,kind:'dead-end',repair:'Revisit the canal storehouse, open the stamped chest, and use its delivery phrase.'}
});
export function getChapterDoor(id){
 if(typeof id!=='string')return null;
 if(Object.hasOwn(CHAPTER_DOORS,id))return CHAPTER_DOORS[id];
 return Object.values(CHAPTER_DOORS).find(door=>door.canonicalId===id)??null;
}
