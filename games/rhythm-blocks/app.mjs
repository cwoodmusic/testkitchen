import {createStoryGame,PAGE_ONE_DOOR_COSTS} from './story.mjs';
import {NOTE_KINDS,NOTE_KIND_BY_ID} from './engine.mjs';
import {symbolMarkup} from './notation.mjs';
import {createRhythmAudio} from './audio.mjs';
import {PEOPLE,ROUTE_OUTCOMES} from './opening.mjs';
import {createRoomView} from './room-view.mjs';
import {createJourney} from './journey.mjs';
import {renderJourney} from './journey-view.mjs';

const $=id=>document.getElementById(id),root=$('quiet-bell');
const SAVE_KEY='codaQuietBellPageOneV1',JOURNEY_KEY='codaQuietBellJourneyV1',SOUND_KEY='codaRhythmBlocksSoundV1';
const colors={quarter:'#9bd5bb','eighth-pair':'#a9d8da','sixteenth-group':'#b9afe2',half:'#efcb8d',eighth:'#bdb0e7','quarter-rest':'#e8d9b5','half-rest':'#e0bd9b','dotted-half':'#d9abc8','sixteenth-pair':'#c8bde9'};
const shortNames={quarter:'Quarter note','eighth-pair':'Two eighths','sixteenth-group':'Four sixteenths',half:'Half note',eighth:'Eighth note','quarter-rest':'Quarter rest','half-rest':'Half rest','dotted-half':'Dotted half','sixteenth-pair':'Two sixteenths'};
const people=new Map(PEOPLE.map(person=>[person.id,person]));
const topics={story:'Your story',route:'A way forward',inventory:'My notes'};
const topicNames={story:'Your story',route:'A way forward',inventory:'Your carried notes'};
const count=stock=>Object.values(stock).reduce((total,n)=>total+n,0);
const beatText=kind=>`${kind.beats===.5?'½':kind.beats} beat${kind.beats<=1?'':'s'}`;
let storageAvailable=true;
function read(key){try{return localStorage.getItem(key);}catch{storageAvailable=false;return null;}}
function write(key,value){try{localStorage.setItem(key,value);return true;}catch{storageAvailable=false;return false;}}
let saved=null;try{saved=JSON.parse(read(SAVE_KEY));}catch{}
let savedJourney=null;try{savedJourney=JSON.parse(read(JOURNEY_KEY));}catch{}
const game=createStoryGame({saved}),audio=createRhythmAudio({enabled:read(SOUND_KEY)!=='off'});
const journey=createJourney({saved:savedJourney});
let journeyChanged=journey.visit('depot');
for(const route of game.state.discoveredRoutes)journeyChanged=journey.traverse('depot-'+route)||journeyChanged;
if(journeyChanged)write(JOURNEY_KEY,JSON.stringify(journey.serialize()));
let selectedPerson=saved?.version===2&&people.has(saved?.conversation?.person)?saved.conversation.person:'nell';
let selectedTopic=saved?.version===2&&Object.hasOwn(topics,saved?.conversation?.topic)?saved.conversation.topic:'story';
let soundEnabled=read(SOUND_KEY)!=='off',audioRevision=0;
let roomView=null,toastTimer=0;
let message=game.state.phase==='continued'?'Your chosen door and carried notes are ready.':saved?.version===2?'Your collected notes and your place in the room are ready.':'Nell has kept a parcel for you. Accept it, then open the delivery chest.';
const doorNames={garden:'Garden door',workshop:'Workshop door',canal:'Canal door'};
const doorHints={garden:'Iris knows the ivy-covered lock.',workshop:'Pip knows the gear-marked lock.',canal:'Nell knows the blue canal lock.'};

function snapshot(){return{...game.state,selectedPerson,selectedTopic};}
Object.defineProperty(window,'quietBell',{value:Object.freeze({get state(){return snapshot();},get journey(){return journey.state;},get walker(){return roomView?.state??null;},get camera(){return roomView?.camera??null;}})});
function save(){const position=roomView?.state;write(SAVE_KEY,JSON.stringify({...game.serialize(),conversation:{person:selectedPerson,topic:selectedTopic},roomPosition:position?{x:position.x,y:position.y,facing:position.facing}:saved?.roomPosition}));updateSave();}
function saveJourney(){write(JOURNEY_KEY,JSON.stringify(journey.serialize()));if($('menu-dialog').open)renderPause();updateSave();}
function renderPause(){
  const state=journey.state;
  renderJourney($('journey-chart'),state,{currentNodeId:game.state.phase==='continued'?game.state.nextScene.id:'depot'});
  for(const category of ['hints','outcomes','achievements']){
    const list=$('journey-'+category);list.replaceChildren();
    for(const entry of state[category]){
      const item=document.createElement('li'),title=document.createElement('strong');title.textContent=entry.title;item.append(title);
      if(entry.text){const text=document.createElement('p');text.textContent=entry.text;item.append(text);}
      list.append(item);
    }
    $('journey-'+category+'-section').hidden=state[category].length===0;
  }
  const hasJournal=state.hints.length+state.outcomes.length+state.achievements.length>0;
  $('journey-journal').hidden=!hasJournal;$('pause-journey').classList.toggle('has-journal',hasJournal);
}
function updateSave(){$('save-status').textContent=storageAvailable?'Progress saves on this device.':'Saving is unavailable in this browser. Keep this page open to retain your progress.';}
function stopAudio(){audioRevision++;audio.stop();}
async function play(recipe){const revision=++audioRevision;audio.stop();if(!recipe.length||!soundEnabled)return;await audio.unlock();if(revision===audioRevision&&!document.hidden&&!$('help-dialog').open)audio.playPattern(recipe);}
const panelIds=['conversation-dialog','notes-dialog','menu-dialog','help-dialog','outcome'];
function panelOpen(){return panelIds.some(id=>$(id).open);}
function closePanels(except=null){for(const id of panelIds)if(id!==except&&$(id).open)$(id).close();}
function openPanel(id){roomView?.stop();if(id==='menu-dialog'){stopAudio();renderPause();}closePanels(id);if(!$(id).open)$(id).showModal();roomView?.refresh();}
function openNotes(mode){$('notes-dialog').dataset.mode=mode;openPanel('notes-dialog');render();}
function notify(text){clearTimeout(toastTimer);$('world-status').textContent=text;$('world-status').hidden=false;$('announcement').textContent=text;toastTimer=setTimeout(()=>{$('world-status').hidden=true;},3200);}
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
  updateAccess();
}
function updateAccess(){
  const state=game.state,nearNell=roomView?.withinReach('nell')??false,parcelClaimed=state.claimedSources.includes('nell-parcel');
  $('take-parcel').disabled=parcelClaimed||!nearNell;
  $('take-parcel').textContent=parcelClaimed?'Parcel received':nearNell?'Take Nell’s parcel':'Walk to Nell for the parcel';
  const atDoor=!!state.selectedDoor&&!!roomView?.withinReach(state.selectedDoor);
  $('commit').disabled=!state.canAttempt||!atDoor;
  $('door-hint').textContent=state.selectedDoor?state.phase==='room'&&!atDoor?'Walk to the selected door to try its rhythm key.':doorHints[state.selectedDoor]:'Each door has its own rhythm lock.';
}
function render(){
  const active=document.activeElement,focusedKind=active?.dataset?.kind,focusedNote=active?.dataset?.remove;
  const state=game.state,continued=state.phase==='continued',recipe=continued?state.receipt.recipe:state.phrase;
  const bagMode=$('notes-dialog').dataset.mode==='bag',visibleStock=bagMode?state.inventory:state.availableInventory;
  const units=recipe.reduce((total,kind)=>total+NOTE_KIND_BY_ID[kind].units,0);
  $('total').textContent=`${units/2} / 4 beats`;root.querySelector('.mg-floor').dataset.ready=String(units===8);
  $('phrase').innerHTML=recipe.map((kind,index)=>`<button type="button" class="mg-phrase-note" data-remove="${index}" aria-label="${continued?shortNames[kind]:'Return '+shortNames[kind]+' to your satchel'}" style="grid-column:span ${NOTE_KIND_BY_ID[kind].units};--mg-tile:${colors[kind]}"${continued?' disabled':''}>${symbolMarkup(kind)}</button>`).join('');
  $('phrase').setAttribute('aria-label',`${continued?'Your played answer':'Your answer'}: ${recipe.length?recipe.map(kind=>NOTE_KIND_BY_ID[kind].label).join(', '):'empty'}. ${units/2} of four beats.`);
  $('stock').innerHTML=NOTE_KINDS.map(kind=>`<button type="button" class="mg-stock-note" data-kind="${kind.id}" aria-label="${kind.label}, ${beatText(kind)}, ${visibleStock[kind.id]} available" style="--mg-tile:${colors[kind.id]}"${bagMode||continued||state.availableInventory[kind.id]<1||state.units+kind.units>8?' disabled':''}><span class="mg-count">×${visibleStock[kind.id]}</span>${symbolMarkup(kind.id)}<span class="mg-kind-name">${shortNames[kind.id]}</span><span class="mg-beat-value">${beatText(kind)}</span></button>`).join('');
  $('stock-title').textContent=bagMode?'Your notes':'Rhythm lock';$('held').textContent=`${count(visibleStock)} ${bagMode?'carried':'available'}`;
  const bagCount=count(state.inventory);$('bag-count').textContent=String(bagCount);$('bag-count').hidden=bagCount===0;$('bag').setAttribute('aria-label',`Open inventory, ${bagCount} notes`);
  $('listen').disabled=!recipe.length||!soundEnabled;$('undo').disabled=!state.phrase.length&&!continued;$('commit').disabled=!state.canAttempt;
  $('door-demo').disabled=!state.selectedDoor||!soundEnabled||continued;
  $('door-title').textContent=state.selectedDoor?doorNames[state.selectedDoor]:'Choose a door';
  $('door-hint').textContent=state.selectedDoor?doorHints[state.selectedDoor]:'Each door has its own rhythm lock.';
  for(const button of root.querySelectorAll('[data-door]')){button.setAttribute('aria-pressed',String(button.dataset.door===state.selectedDoor));button.disabled=continued;}
  for(const button of root.querySelectorAll('[data-person]'))button.disabled=continued;
  const chest=root.querySelector('[data-chest]'),chestClaimed=state.claimedSources.includes('depot-chest');
  chest.disabled=continued||chestClaimed;chest.setAttribute('aria-label',chestClaimed?'Delivery chest opened; half note collected':'Open the delivery chest');$('chest-label').textContent=chestClaimed?'Opened':'Open';
  $('edit-hint').textContent=continued?'This is the answer you played. Revisit it to try another path.':'Choose notes from your satchel. Tap a placed note to take it back.';
  $('status').textContent=message;
  $('pack-heading').textContent='Room finds';$('ledger').hidden=!continued;
  $('ledger').innerHTML=continued?`<div><strong>${state.receipt.recipe.length}</strong><span>Used</span></div><div><strong>${count(state.inventory)}</strong><span>Carried</span></div><div><strong>0</strong><span>New on entry</span></div>`:'';
  $('pack').innerHTML='';
  $('pack-copy').textContent=`Nell’s parcel: ${state.claimedSources.includes('nell-parcel')?'received':'waiting'}. Delivery chest: ${chestClaimed?'opened':'closed'}.`;
  if($('menu-dialog').open)renderPause();
  if(!continued&&$('outcome').open)$('outcome').close();
  if(continued){const outcome=ROUTE_OUTCOMES[state.routeId];$('outcome-kicker').textContent=outcome.kicker;$('outcome-title').textContent=outcome.title;$('outcome-copy').textContent=outcome.copy;}
  $('sound').textContent=soundEnabled?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(soundEnabled));
  talk();updateSave();roomView?.refresh();
  // Updating counts replaces note controls. Keep keyboard navigation in the
  // satchel or phrase rather than sending focus back to the page header.
  if(focusedKind){
    const same=root.querySelector('[data-kind="'+focusedKind+'"]');
    const next=NOTE_KINDS.slice(NOTE_KINDS.findIndex(kind=>kind.id===focusedKind)+1).map(kind=>root.querySelector('[data-kind="'+kind.id+'"]')).find(button=>!button.disabled);
    const target=(!same?.disabled?same:next??root.querySelector('[data-kind]:not(:disabled)'))??(state.canAttempt&&!$('commit').disabled?$('commit'):state.phrase.length?$('undo'):null);
    target?.focus({preventScroll:true});
  }else if(focusedNote!==undefined){
    const target=root.querySelector('[data-remove="'+Math.min(Number(focusedNote),recipe.length-1)+'"]:not(:disabled)')??root.querySelector('[data-kind]:not(:disabled)');
    target?.focus({preventScroll:true});
  }
}
function edit(action){roomView?.stop();stopAudio();if(!action())return;message=game.state.units===8?'Four beats. Check the selected lock, then try the door.':'Arrange the notes for your chosen door.';render();save();}
function chooseDoor(id){stopAudio();if(!roomView?.withinReach(id)||!game.selectDoor(id))return;message=!game.state.claimedSources.includes('nell-parcel')?'Ask Nell for the parcel before opening a door.':!game.state.claimedSources.includes('depot-chest')?'Find the half note in the chest; every opening lock needs it.':`${doorNames[id]} selected. Hear its rhythm or ask a resident for a clue.`;openNotes('lock');save();}
function claim(id){stopAudio();if(!roomView?.withinReach(id==='nell-parcel'?'nell':id))return;if(!game.claim(id)){message=id==='depot-chest'?'The chest is empty; its half note has already been collected.':'Nell has already given you this parcel.';render();notify(message);return;}message=id==='nell-parcel'?'Nell gave you eight notes. The half note is in the chest.':'Found a half note in the chest.';if($('conversation-dialog').open)$('conversation-dialog').close();render();save();notify(message);$('walk-floor').focus({preventScroll:true});}
function commit(){roomView?.stop();stopAudio();if(!roomView?.withinReach(game.state.selectedDoor))return;if(!game.commit()){if(game.state.canAttempt){message='The lock stays closed. Those four beats do not match this door’s rhythm. Your notes are safe.';render();$('announcement').textContent=message;}return;}if(journey.traverse('depot-'+game.state.routeId))saveJourney();selectedTopic='story';selectedPerson=game.state.routeId==='garden'?'iris':game.state.routeId==='workshop'?'pip':'nell';message=`The ${doorNames[game.state.routeId].toLowerCase()} opens. Your unused notes travel with you.`;render();save();void play(game.state.receipt.recipe);$('announcement').textContent=message;openPanel('outcome');$('revisit').focus({preventScroll:true});}
function undo(){roomView?.stop();const wasContinued=game.state.phase==='continued';stopAudio();if(!game.undo())return;selectedTopic=wasContinued?'story':selectedTopic;message=wasContinued?'Back at the depot. Your collected notes are restored; the parcel and chest stay collected.':'Note returned to your satchel.';render();save();if(wasContinued)root.querySelector('[data-door="'+game.state.selectedDoor+'"]').focus({preventScroll:true});}
function restart(){roomView?.stop();stopAudio();game.restart();closePanels();selectedPerson='nell';selectedTopic='story';roomView?.reset();message='A new run begins with an empty satchel. Nell and the chest are ready again.';render();save();$('walk-floor').focus({preventScroll:true});}
function interactWith(id){
  if(people.has(id)){stopAudio();selectedPerson=id;selectedTopic='story';talk();openPanel('conversation-dialog');save();}
  else if(Object.hasOwn(doorNames,id))chooseDoor(id);
  else if(id==='depot-chest')claim(id);
}
root.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.person){roomView?.request(button.dataset.person);return;}
  if(button.dataset.topic){stopAudio();selectedTopic=button.dataset.topic;talk();if(selectedTopic==='route'&&game.state.phase==='room'&&journey.discoverHint(selectedPerson+'-route'))saveJourney();save();return;}
  if(button.dataset.door){roomView?.request(button.dataset.door);return;}
  if(button.dataset.chest){roomView?.request(button.dataset.chest);return;}
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
    case'help':stopAudio();openPanel('help-dialog');break;
    case'menu':case'outcome-map':openPanel('menu-dialog');break;
    case'bag':openNotes('bag');break;
  }
});
for(const [button,panel]of [['help-close','help-dialog'],['help-done','help-dialog'],['conversation-close','conversation-dialog'],['notes-close','notes-dialog'],['menu-close','menu-dialog']])$(button).addEventListener('click',()=>$(panel).close());
for(const id of panelIds)$(id).addEventListener('close',()=>{roomView?.refresh();if(!panelOpen()&&game.state.phase==='continued'){openPanel('outcome');return;}const active=document.activeElement;if(!panelOpen()&&(!active||active===document.body||active===document.documentElement||active.closest('dialog')))$('walk-floor').focus({preventScroll:true});});
$('outcome').addEventListener('cancel',event=>event.preventDefault());
$('help-notes').innerHTML=NOTE_KINDS.map(kind=>`<div class="mg-help-note">${symbolMarkup(kind.id)}<span>${kind.label}</span><span>${beatText(kind)}</span></div>`).join('');
document.addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  if(event.repeat)return;
  if(!panelOpen()&&event.key==='Escape'){event.preventDefault();openPanel('menu-dialog');return;}
  if(!panelOpen()&&event.key.toLowerCase()==='i'){event.preventDefault();openNotes('bag');return;}
  if(!$('notes-dialog').open||$('notes-dialog').dataset.mode!=='lock')return;
  if(/^[1-9]$/.test(event.key)){event.preventDefault();edit(()=>game.add(NOTE_KINDS[Number(event.key)-1].id));}
  else if(event.key==='Backspace'){event.preventDefault();undo();}
});
function exit(event){roomView?.stop();stopAudio();void audio.suspend();if(window.parent!==window){event.preventDefault();window.parent.postMessage({coda:1,game:'rhythm-blocks',type:'close'},location.origin);}}
$('exit').addEventListener('click',exit);$('outcome-exit').addEventListener('click',exit);
function background(){stopAudio();void audio.suspend();}
window.addEventListener('blur',background);document.addEventListener('visibilitychange',()=>{if(document.hidden)background();});
window.addEventListener('pagehide',()=>{clearTimeout(toastTimer);stopAudio();void audio.destroy();});
roomView=createRoomView({scene:$('room-scene'),map:$('room-map'),player:$('player-sprite'),floor:$('walk-floor'),controls:$('room-controls'),interactButton:$('interact'),prompt:$('nearby-prompt'),savedPosition:saved?.version===2?saved.roomPosition:null,canMove:()=>game.state.phase==='room'&&!panelOpen(),onInteract:interactWith,onStop:()=>save(),onReachChange:()=>{if(roomView)updateAccess();}});
render();
if(game.state.phase==='continued')openPanel('outcome');else $('walk-floor').focus({preventScroll:true});
