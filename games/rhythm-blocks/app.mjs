import {createStoryGame,PAGE_ONE_DOOR_COSTS} from './story.mjs?v=quiet-bell-dungeon-one-1';
import {NOTE_KINDS,NOTE_KIND_BY_ID} from './engine.mjs?v=quiet-bell-dungeon-one-1';
import {symbolMarkup} from './notation.mjs?v=quiet-bell-dungeon-one-1';
import {createRhythmAudio} from './audio.mjs?v=quiet-bell-dungeon-one-1';
import {PEOPLE,ROUTE_OUTCOMES} from './opening.mjs?v=quiet-bell-dungeon-one-1';

const $=id=>document.getElementById(id),root=$('quiet-bell');
const SAVE_KEY='codaQuietBellPageOneV1',SOUND_KEY='codaRhythmBlocksSoundV1';
const colors={quarter:'#9bd5bb','eighth-pair':'#a9d8da','sixteenth-group':'#b9afe2',half:'#efcb8d',eighth:'#bdb0e7','quarter-rest':'#e8d9b5','half-rest':'#e0bd9b','dotted-half':'#d9abc8','sixteenth-pair':'#c8bde9'};
const shortNames={quarter:'Quarter note','eighth-pair':'Two eighths','sixteenth-group':'Four sixteenths',half:'Half note',eighth:'Eighth note','quarter-rest':'Quarter rest','half-rest':'Half rest','dotted-half':'Dotted half','sixteenth-pair':'Two sixteenths'};
const people=new Map(PEOPLE.map(person=>[person.id,person]));
const topics={story:'What brings you here?',route:'Which way would you go?',inventory:'About my notes…'};
const topicNames={story:'Your story',route:'A way forward',inventory:'Your carried notes'};
const count=stock=>Object.values(stock).reduce((total,n)=>total+n,0);
const beatText=kind=>`${kind.beats===.5?'½':kind.beats} beat${kind.beats<=1?'':'s'}`;
let storageAvailable=true;
function read(key){try{return localStorage.getItem(key);}catch{storageAvailable=false;return null;}}
function write(key,value){try{localStorage.setItem(key,value);return true;}catch{storageAvailable=false;return false;}}
let saved=null;try{saved=JSON.parse(read(SAVE_KEY));}catch{}
const game=createStoryGame({saved}),audio=createRhythmAudio({enabled:read(SOUND_KEY)!=='off'});
let selectedPerson=saved?.version===2&&people.has(saved?.conversation?.person)?saved.conversation.person:'nell';
let selectedTopic=saved?.version===2&&Object.hasOwn(topics,saved?.conversation?.topic)?saved.conversation.topic:'story';
let soundEnabled=read(SOUND_KEY)!=='off',audioRevision=0;
let message=game.state.phase==='continued'?'Your chosen door and carried notes are ready.':saved?.version===2?'Your collected notes and your place in the room are ready.':'Nell has kept a parcel for you. Accept it, then open the delivery chest.';
const doorNames={garden:'Garden door',workshop:'Workshop door',canal:'Canal door'};
const doorHints={garden:'Iris knows the ivy-covered lock.',workshop:'Pip knows the gear-marked lock.',canal:'Nell knows the blue canal lock.'};

function snapshot(){return{...game.state,selectedPerson,selectedTopic};}
Object.defineProperty(window,'quietBell',{value:Object.freeze({get state(){return snapshot();}})});
function save(){write(SAVE_KEY,JSON.stringify({...game.serialize(),conversation:{person:selectedPerson,topic:selectedTopic}}));updateSave();}
function updateSave(){$('save-status').textContent=storageAvailable?'Progress saves on this device.':'Saving is unavailable in this browser. Keep this page open to retain your progress.';}
function stopAudio(){audioRevision++;audio.stop();}
async function play(recipe){const revision=++audioRevision;audio.stop();if(!recipe.length||!soundEnabled)return;await audio.unlock();if(revision===audioRevision&&!document.hidden&&!$('help-dialog').open)audio.playPattern(recipe);}
function talk(){
  const state=game.state,person=people.get(selectedPerson),outcome=state.routeId?ROUTE_OUTCOMES[state.routeId]:null;
  let text=person[selectedTopic];
  if(state.phase==='continued'){
    if(selectedTopic==='story')text=outcome.replies[selectedPerson];
    else if(selectedTopic==='route')text=`Our next stop is ${outcome.title}. ${outcome.copy}`;
    else text=`You kept ${count(state.inventory)} note blocks. The lock used only its own rhythm. There is no new parcel for walking through a door; we will need to meet people and look for chests along the way.`;
  }else if(selectedTopic==='inventory'&&selectedPerson==='nell')text=`You have ${count(state.inventory)} blocks, including any on the floor. My parcel gives eight kinds; the chest holds the half note. We can collect each only once. A matching door spends its key; all other notes travel with you.`;
  $('speaker').textContent=`${person.name} · ${person.role}`;
  $('talk-about').textContent=topicNames[selectedTopic];$('dialogue').textContent=text;
  for(const button of root.querySelectorAll('[data-person]'))button.setAttribute('aria-pressed',String(button.dataset.person===selectedPerson));
  for(const button of root.querySelectorAll('[data-topic]')){button.setAttribute('aria-pressed',String(button.dataset.topic===selectedTopic));button.textContent=state.phase==='continued'&&button.dataset.topic==='route'?'Where are we headed?':topics[button.dataset.topic];}
  $('demo').hidden=state.phase!=='room'||selectedTopic!=='route';
  $('demo').disabled=!soundEnabled;$('demo').textContent=`Hear ${person.name}’s rhythm`;
  $('take-parcel').hidden=selectedPerson!=='nell'||state.phase!=='room';
  $('take-parcel').disabled=state.claimedSources.includes('nell-parcel');
  $('take-parcel').textContent=state.claimedSources.includes('nell-parcel')?'Parcel received':'Take Nell’s parcel';
}
function render(){
  const active=document.activeElement,focusedKind=active?.dataset?.kind,focusedNote=active?.dataset?.remove;
  const state=game.state,continued=state.phase==='continued',recipe=continued?state.receipt.recipe:state.phrase;
  const units=recipe.reduce((total,kind)=>total+NOTE_KIND_BY_ID[kind].units,0);
  $('total').textContent=`${units/2} / 4 beats`;root.querySelector('.mg-floor').dataset.ready=String(units===8);
  $('phrase').innerHTML=recipe.map((kind,index)=>`<button type="button" class="mg-phrase-note" data-remove="${index}" aria-label="${continued?shortNames[kind]:'Return '+shortNames[kind]+' to your satchel'}" style="grid-column:span ${NOTE_KIND_BY_ID[kind].units};--mg-tile:${colors[kind]}"${continued?' disabled':''}>${symbolMarkup(kind)}</button>`).join('');
  $('phrase').setAttribute('aria-label',`${continued?'Your played answer':'Your answer'}: ${recipe.length?recipe.map(kind=>NOTE_KIND_BY_ID[kind].label).join(', '):'empty'}. ${units/2} of four beats.`);
  $('stock').innerHTML=NOTE_KINDS.map(kind=>`<button type="button" class="mg-stock-note" data-kind="${kind.id}" aria-label="${kind.label}, ${beatText(kind)}, ${state.availableInventory[kind.id]} available" style="--mg-tile:${colors[kind.id]}"${continued||state.availableInventory[kind.id]<1||state.units+kind.units>8?' disabled':''}><span class="mg-count">×${state.availableInventory[kind.id]}</span>${symbolMarkup(kind.id)}<span class="mg-kind-name">${shortNames[kind.id]}</span><span class="mg-beat-value">${beatText(kind)}</span></button>`).join('');
  $('stock-title').textContent=continued?'For the next page':'Your note blocks';$('held').textContent=`${count(state.availableInventory)} carried`;
  $('listen').disabled=!recipe.length||!soundEnabled;$('undo').disabled=!state.phrase.length&&!continued;$('commit').disabled=!state.canAttempt;
  $('door-demo').disabled=!state.selectedDoor||!soundEnabled||continued;
  $('door-title').textContent=state.selectedDoor?doorNames[state.selectedDoor]:'Choose a door';
  $('door-hint').textContent=state.selectedDoor?doorHints[state.selectedDoor]:'Each door has its own rhythm lock.';
  for(const button of root.querySelectorAll('[data-door]')){button.setAttribute('aria-pressed',String(button.dataset.door===state.selectedDoor));button.disabled=continued;}
  const chest=root.querySelector('[data-chest]'),chestClaimed=state.claimedSources.includes('depot-chest');
  chest.disabled=continued||chestClaimed;chest.setAttribute('aria-label',chestClaimed?'Delivery chest opened; half note collected':'Open the delivery chest');$('chest-label').textContent=chestClaimed?'Opened':'Open';
  $('edit-hint').textContent=continued?'This is the answer you played. Revisit it to try another path.':'Choose notes from your satchel. Tap a placed note to take it back.';
  $('status').textContent=message;
  $('pack-heading').textContent='Room finds';$('ledger').hidden=!continued;
  $('ledger').innerHTML=continued?`<div><strong>${state.receipt.recipe.length}</strong><span>Used</span></div><div><strong>${count(state.inventory)}</strong><span>Carried</span></div><div><strong>0</strong><span>New on entry</span></div>`:'';
  $('pack').innerHTML='';
  $('pack-copy').textContent=`Nell’s parcel: ${state.claimedSources.includes('nell-parcel')?'received':'waiting'}. Delivery chest: ${chestClaimed?'opened':'closed'}.`;
  $('story-state').textContent=continued?`Your open door leads toward ${ROUTE_OUTCOMES[state.routeId].title}.`:'Collect notes, choose a door, and play its rhythm key.';
  $('seen-routes').textContent=state.discoveredRoutes.length?`Paths you have found: ${state.discoveredRoutes.map(id=>ROUTE_OUTCOMES[id].title).join(' · ')}`:'';
  $('outcome').hidden=!continued;
  if(continued){const outcome=ROUTE_OUTCOMES[state.routeId];$('outcome-kicker').textContent=outcome.kicker;$('outcome-title').textContent=outcome.title;$('outcome-copy').textContent=outcome.copy;}
  $('sound').textContent=soundEnabled?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(soundEnabled));
  talk();updateSave();
  // Updating counts replaces note controls. Keep keyboard navigation in the
  // satchel or phrase rather than sending focus back to the page header.
  if(focusedKind){
    const same=root.querySelector('[data-kind="'+focusedKind+'"]');
    const next=NOTE_KINDS.slice(NOTE_KINDS.findIndex(kind=>kind.id===focusedKind)+1).map(kind=>root.querySelector('[data-kind="'+kind.id+'"]')).find(button=>!button.disabled);
    const target=(!same?.disabled?same:next??root.querySelector('[data-kind]:not(:disabled)'))??(state.canAttempt?$('commit'):state.phrase.length?$('undo'):null);
    target?.focus({preventScroll:true});
  }else if(focusedNote!==undefined){
    const target=root.querySelector('[data-remove="'+Math.min(Number(focusedNote),recipe.length-1)+'"]:not(:disabled)')??root.querySelector('[data-kind]:not(:disabled)');
    target?.focus({preventScroll:true});
  }
}
function edit(action){stopAudio();if(!action())return;message=game.state.units===8?'Four beats. Check the selected lock, then try the door.':'Arrange the notes for your chosen door.';render();save();}
function chooseDoor(id){stopAudio();if(!game.selectDoor(id))return;message=!game.state.claimedSources.includes('nell-parcel')?'Ask Nell for the parcel before opening a door.':!game.state.claimedSources.includes('depot-chest')?'Find the half note in the chest; every opening lock needs it.':`${doorNames[id]} selected. Hear its rhythm or ask a resident for a clue.`;render();save();}
function claim(id){stopAudio();if(!game.claim(id))return;message=id==='nell-parcel'?'Nell gave you eight note blocks. The missing half note is in the chest.':'The chest held a half note: two sounding beats. You can collect it only once.';render();save();$('announcement').textContent=message;if(id==='nell-parcel')root.querySelector('[data-chest]').focus({preventScroll:true});else root.querySelector('[data-door="'+(game.state.selectedDoor??'garden')+'"]').focus({preventScroll:true});}
function commit(){stopAudio();if(!game.commit()){if(game.state.canAttempt){message='The lock stays closed. Those four beats do not match this door’s rhythm. Your notes are safe.';render();$('announcement').textContent=message;}return;}selectedTopic='story';selectedPerson=game.state.routeId==='garden'?'iris':game.state.routeId==='workshop'?'pip':'nell';message=`The ${doorNames[game.state.routeId].toLowerCase()} opens. Your unused notes travel with you.`;render();save();void play(game.state.receipt.recipe);$('announcement').textContent=message;$('outcome').scrollIntoView({behavior:'instant',block:'nearest'});$('revisit').focus({preventScroll:true});}
function undo(){const wasContinued=game.state.phase==='continued';stopAudio();if(!game.undo())return;selectedTopic=wasContinued?'story':selectedTopic;message=wasContinued?'Back at the depot. Your collected notes are restored; the parcel and chest stay collected.':'Note returned to your satchel.';render();save();if(wasContinued)root.querySelector('[data-door="'+game.state.selectedDoor+'"]').focus({preventScroll:true});}
function restart(){stopAudio();game.restart();selectedPerson='nell';selectedTopic='story';message='A new run begins with an empty satchel. Nell and the chest are ready again.';render();save();root.querySelector('[data-person="nell"]').focus({preventScroll:true});}
root.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.person){stopAudio();selectedPerson=button.dataset.person;selectedTopic='story';talk();save();return;}
  if(button.dataset.topic){stopAudio();selectedTopic=button.dataset.topic;talk();save();return;}
  if(button.dataset.door){chooseDoor(button.dataset.door);return;}
  if(button.dataset.chest){claim(button.dataset.chest);return;}
  if(button.dataset.kind){edit(()=>game.add(button.dataset.kind));return;}
  if(button.dataset.remove!==undefined){edit(()=>game.remove(Number(button.dataset.remove)));return;}
  switch(button.id){
    case'demo':void play(people.get(selectedPerson).demo);break;
    case'door-demo':if(game.state.selectedDoor)void play(PAGE_ONE_DOOR_COSTS[game.state.selectedDoor]);break;
    case'take-parcel':claim('nell-parcel');break;
    case'listen':void play(game.state.phase==='continued'?game.state.receipt.recipe:game.state.phrase);break;
    case'commit':commit();break;
    case'undo':case'revisit':undo();break;
    case'restart':restart();break;
    case'sound':stopAudio();soundEnabled=!soundEnabled;audio.setEnabled(soundEnabled);write(SOUND_KEY,soundEnabled?'on':'off');render();break;
    case'help':stopAudio();$('help-dialog').showModal();break;
  }
});
for(const id of ['help-close','help-done'])$(id).addEventListener('click',()=>$('help-dialog').close());
$('help-notes').innerHTML=NOTE_KINDS.map(kind=>`<div class="mg-help-note">${symbolMarkup(kind.id)}<span>${kind.label}</span><span>${beatText(kind)}</span></div>`).join('');
document.addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey||$('help-dialog').open||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  if(event.repeat)return;
  if(/^[1-9]$/.test(event.key)){event.preventDefault();edit(()=>game.add(NOTE_KINDS[Number(event.key)-1].id));}
  else if(event.key==='Backspace'){event.preventDefault();undo();}
});
function exit(event){stopAudio();void audio.suspend();if(window.parent!==window){event.preventDefault();window.parent.postMessage({coda:1,game:'rhythm-blocks',type:'close'},location.origin);}}
$('exit').addEventListener('click',exit);$('outcome-exit').addEventListener('click',exit);
function background(){stopAudio();void audio.suspend();}
window.addEventListener('blur',background);document.addEventListener('visibilitychange',()=>{if(document.hidden)background();});
window.addEventListener('pagehide',()=>{stopAudio();void audio.destroy();});
render();
root.querySelector('[data-person="'+selectedPerson+'"]').focus({preventScroll:true});
