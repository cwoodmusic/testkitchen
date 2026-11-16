import {createDungeonGame} from './dungeon-game.mjs';
import {symbolMarkup as engraveSymbol} from './notation.mjs';
import {createRhythmAudio} from './audio.mjs';
import {createRoomView} from './room-view.mjs';
import {createJourney,CHAPTER_JOURNEY_MANIFEST} from './journey.mjs';
import {renderJourney} from './journey-view.mjs';
import {createDefaultProject,normalizeProject,createProjectManifest,getProjectDoor,getPersonReplies} from './developer-project.mjs';
import {createDeveloperConsole} from './developer-console.mjs';
import {createCutsceneView,stageCutsceneScene} from './cutscene-view.mjs';
import {compileRoomCutscene} from './cutscene.mjs';
import {createCutscenePathEditor} from './cutscene-paths.mjs';

const $=id=>document.getElementById(id),root=$('quiet-bell');
const SAVE_KEY='codaQuietBellPageOneV1',JOURNEY_KEY='codaQuietBellJourneyV1',SOUND_KEY='codaRhythmBlocksSoundV1';
const APPLIED_PROJECT_KEY='codaQuietBellDeveloperAppliedProjectV1',PROJECT_KEY='codaQuietBellDeveloperProjectV1',DEV_SAVE_KEY='codaQuietBellDeveloperRunV1',DEV_JOURNEY_KEY='codaQuietBellDeveloperJourneyV1',DEV_ACTIVE_KEY='codaQuietBellDeveloperActiveV1';
let storageAvailable=true;
function read(key){try{return localStorage.getItem(key);}catch{storageAvailable=false;return null;}}
function write(key,value){try{localStorage.setItem(key,value);return true;}catch{storageAvailable=false;return false;}}
function readJSON(key){try{return JSON.parse(read(key));}catch{return null;}}
const shippedProject=normalizeProject(createDefaultProject());
let authoredProject=shippedProject,projectLoadError='';
const storedProject=readJSON(PROJECT_KEY);
if(storedProject)try{authoredProject=normalizeProject(storedProject);}catch(error){projectLoadError=error.message;}
let appliedProject=authoredProject,appliedProjectError='';const storedApplied=readJSON(APPLIED_PROJECT_KEY);if(storedApplied)try{appliedProject=normalizeProject(storedApplied);}catch(error){appliedProjectError=error.message;}
let developerMode=read(DEV_ACTIVE_KEY)==='on'&&!appliedProjectError,runtimeProject=developerMode?appliedProject:shippedProject;
let NOTE_KINDS,NOTE_KIND_BY_ID,CHAPTER_ROOMS,CHAPTER_SOURCES,colors,shortNames;
function bindDefinitions(){document.title=runtimeProject.settings.title+' · Coda Arcade';NOTE_KINDS=runtimeProject.noteKinds;NOTE_KIND_BY_ID=Object.fromEntries(NOTE_KINDS.map(kind=>[kind.id,kind]));CHAPTER_ROOMS=runtimeProject.rooms;CHAPTER_SOURCES=runtimeProject.sources;colors=Object.fromEntries(NOTE_KINDS.map(kind=>[kind.id,kind.color]));shortNames=Object.fromEntries(NOTE_KINDS.map(kind=>[kind.id,kind.shortName]));}
bindDefinitions();
const content=()=>runtimeProject.content[game.state.roomId];
const getChapterDoor=id=>getProjectDoor(runtimeProject,id);
const isTerminalScene=scene=>!!scene&&Object.hasOwn(runtimeProject.terminals,scene.id);
function doorCopyFor(id,project=runtimeProject,roomId=game.state.roomId){const door=getProjectDoor(project,id),copies=project.content[roomId]?.doorCopy??{};return copies[door?.id??id]??copies[door?.canonicalId]??{name:door?.label??String(id),hint:door?.hint??''};}
function doorTargetId(id){const door=getChapterDoor(id);return activeScene?.geometry.targets.find(target=>target.type==='door'&&getChapterDoor(target.id)?.id===door?.id)?.id??id;}

const symbolMarkup=id=>engraveSymbol(NOTE_KIND_BY_ID[id]?.symbol??id);
const escapeHTML=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const count=stock=>Object.values(stock).reduce((total,n)=>total+n,0);
const beatText=kind=>`${kind.beats===.5?'½':kind.beats} beat${kind.beats<=1?'':'s'}`;
let saved=readJSON(developerMode?DEV_SAVE_KEY:SAVE_KEY);
let game=createDungeonGame({saved,...(developerMode?{definition:runtimeProject,developer:true}:{})});
let journey=createJourney({saved:readJSON(developerMode?DEV_JOURNEY_KEY:JOURNEY_KEY),manifest:developerMode?createProjectManifest(runtimeProject):CHAPTER_JOURNEY_MANIFEST});
let soundEnabled=read(SOUND_KEY)!=='off',audioRevision=0;
const audio=createRhythmAudio({enabled:soundEnabled,bpm:runtimeProject.settings.bpm,noteKinds:NOTE_KINDS}),previewAudio=createRhythmAudio();
let people=new Map(),observations=new Map(),doorNames={},doorHints={},activeScene=null,activeSceneProject=null;
let roomView=null,toastTimer=0,developerConsole=null,editingOpen=false,editorProject=null,editingRoomId=null,editorReturnPosition=null,editorReturnSelection=null,editorSignature='';
let cutsceneView=null,cutsceneSeen=new Set(),cutscenePoses=new Map(),cutsceneProjectSignature='';
let cutsceneRate=1,pathEditor=null,pathSelection=null,pathEditorActive=false;
function restoreCutscenes(value){
 cutsceneSeen=new Set((Array.isArray(value?.seen)?value.seen:[]).filter(id=>typeof id==='string'&&Object.hasOwn(runtimeProject.scenes,id)));
 cutscenePoses=new Map(Object.entries(value?.poses??{}).filter(([id,poses])=>Object.hasOwn(runtimeProject.scenes,id)&&Array.isArray(poses)&&poses.length<=16).map(([id,poses])=>[id,poses.filter(pose=>pose&&typeof pose.id==='string'&&Number.isFinite(pose.x)&&Number.isFinite(pose.y)).map(pose=>({id:pose.id,x:pose.x,y:pose.y,facing:['up','down','left','right'].includes(pose.facing)?pose.facing:'down'}))]));
}
restoreCutscenes(saved?.roomCutscenes);
const initialPeople=content().people;
let selectedPerson=[2,3].includes(saved?.version)&&initialPeople.some(person=>person.id===saved?.conversation?.person)?saved.conversation.person:initialPeople[0]?.id??null;
const initialReplies=getPersonReplies(initialPeople.find(person=>person.id===selectedPerson)??{});
let selectedTopic=initialReplies.some(reply=>reply.id===saved?.conversation?.topic)?saved.conversation.topic:Object.hasOwn(initialPeople.find(person=>person.id===selectedPerson)??{},'intro')?null:initialReplies[0]?.id??null;
let message=developerMode?'Developer playtest resumed. Your published run is kept separately.':saved?'Your collected notes and your place in the room are ready.':'Nell has kept a parcel for you. Accept it, then open the delivery chest.';
function recordRestoredJourney(){
 let changed=journey.visit(runtimeProject.settings.startRoomId);
 for(const route of game.state.discoveredRoutes)changed=journey.traverse('depot-'+route)||changed;
 for(const id of game.state.traversedDoors)changed=journey.traverse(id)||changed;
 changed=journey.visit(game.state.roomId)||changed;
 if(isTerminalScene(game.state.nextScene))changed=journey.recordOutcome(game.state.nextScene.id)||changed;
 if(changed)write(developerMode?DEV_JOURNEY_KEY:JOURNEY_KEY,JSON.stringify(journey.serialize()));
}
recordRestoredJourney();
function snapshot(){return{...game.state,selectedPerson,selectedTopic,developerMode,editing:editingOpen,cutscenePlaybackRate:cutsceneRate};}
Object.defineProperty(window,'quietBell',{value:Object.freeze({get state(){return snapshot();},get project(){return runtimeProject;},get journey(){return journey.state;},get walker(){return roomView?.state??null;},get camera(){return roomView?.camera??null;},get scene(){return activeScene;},get cutscene(){return cutsceneView?.state??null;}})});
function save({force=false}={}){if(editingOpen&&!force)return;const position=editingOpen?(editorReturnPosition?.roomId===game.state.roomId?editorReturnPosition:runtimeProject.scenes[game.state.roomId].geometry.start):roomView?.state;write(developerMode?DEV_SAVE_KEY:SAVE_KEY,JSON.stringify({...game.serialize(),conversation:{person:selectedPerson,topic:selectedTopic},positionRoomId:game.state.roomId,roomPosition:position?{x:position.x,y:position.y,facing:position.facing}:saved?.roomPosition,roomCutscenes:{version:1,seen:[...cutsceneSeen],poses:Object.fromEntries(cutscenePoses)}}));updateSave();}
function saveJourney(){write(developerMode?DEV_JOURNEY_KEY:JOURNEY_KEY,JSON.stringify(journey.serialize()));if($('menu-dialog').open)renderPause();updateSave();}
function renderPause(){
  const state=journey.state;
  renderJourney($('journey-chart'),state,{currentNodeId:game.state.phase==='continued'?game.state.nextScene.id:game.state.roomId});
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
function stopAudio(){audioRevision++;audio.stop();previewAudio.stop();}
async function play(recipe){const revision=++audioRevision;audio.stop();if(!recipe.length||!soundEnabled)return;await audio.unlock();if(revision===audioRevision&&!document.hidden&&!$('help-dialog').open)audio.playPattern(recipe);}
const panelIds=['conversation-dialog','notes-dialog','lore-dialog','menu-dialog','help-dialog','outcome'];
function panelOpen(){return editingOpen||root.classList.contains('cutscene-playing')||panelIds.some(id=>$(id).open);}
function closePanels(except=null){for(const id of panelIds)if(id!==except&&$(id).open)$(id).close();}
function openPanel(id){roomView?.stop();if(id==='menu-dialog'){stopAudio();renderPause();}closePanels(id);if(!$(id).open)$(id).showModal();roomView?.refresh();}
function openNotes(mode){$('notes-dialog').dataset.mode=mode;openPanel('notes-dialog');render();}
function inspect(id){
  const entry=observations.get(id);
  if(!entry||!['room','terminal'].includes(game.state.phase)||!roomView?.withinReach(id))return;
  stopAudio();$('lore-title').textContent=entry.title;$('lore-copy').textContent=entry.text;
  $('lore-dialog').dataset.observation=id;
  const claimed=game.state.claimedSources.includes(entry.sourceId);
  $('lore-search').hidden=!entry.sourceId||game.state.phase!=='room';
  $('lore-search').disabled=claimed;
  $('lore-search').textContent=claimed?'Notes found':entry.sourceLabel??'Search here';
  if(journey.discoverHint('lore-'+id))saveJourney();
  openPanel('lore-dialog');
}
function notify(text){clearTimeout(toastTimer);$('world-status').textContent=text;$('world-status').hidden=false;$('announcement').textContent=text;toastTimer=setTimeout(()=>{$('world-status').hidden=true;},3200);}
function talk(){
  const state=game.state,person=people.get(selectedPerson);if(!person){$('take-parcel').hidden=true;return;}
  const replies=getPersonReplies(person),showIntro=selectedTopic===null&&Object.hasOwn(person,'intro');if(!showIntro&&!replies.some(reply=>reply.id===selectedTopic))selectedTopic=replies[0]?.id??null;
  const reply=replies.find(reply=>reply.id===selectedTopic);
  let text=showIntro?person.intro:reply?.text??person.intro??person.story??'';
  if(!developerMode&&selectedTopic==='inventory'&&state.roomId==='depot'&&selectedPerson==='nell')text=`You have ${count(state.inventory)} blocks, including any on the floor. My parcel gives eight kinds; the chest holds the half note. We can collect each only once. A matching door spends its key; all other notes travel with you.`;
  $('speaker').textContent=`${person.name} · ${person.role}`;
  $('talk-about').textContent=reply?.label??'';$('dialogue').textContent=text;
  for(const button of root.querySelectorAll('[data-person]'))button.setAttribute('aria-pressed',String(button.dataset.person===selectedPerson));
  const questions=root.querySelector('.mg-questions'),activeTopic=document.activeElement?.dataset?.topic;
  questions.replaceChildren();
  for(const choice of replies){const button=document.createElement('button');button.type='button';button.className='mg-button';button.dataset.topic=choice.id;button.dataset.reply=choice.id;button.textContent=choice.label;button.setAttribute('aria-pressed',String(choice.id===selectedTopic));questions.append(button);}
  if(activeTopic)questions.querySelector('[data-topic="'+activeTopic+'"]')?.focus({preventScroll:true});
  $('demo').hidden=state.phase==='continued'||!(reply?.demo?.length||selectedTopic==='route'&&person.demo?.length);
  $('demo').disabled=!soundEnabled;$('demo').textContent=`Hear ${person.name}’s rhythm`;
  $('take-parcel').hidden=!person.sourceId||state.phase!=='room';
  updateAccess();
}

function updateAccess(){
  const state=game.state,person=people.get(selectedPerson),near=roomView?.withinReach(selectedPerson)??false;
  const claimed=person?.sourceId&&state.claimedSources.includes(person.sourceId);
  $('take-parcel').disabled=!!claimed||!near;
  $('take-parcel').textContent=claimed?'Notes received':near?person?.sourceLabel??'Take notes':`Walk to ${person?.name??'the resident'} for the notes`;
  const atDoor=!!state.selectedDoor&&!!roomView?.withinReach(doorTargetId(state.selectedDoor));
  $('commit').disabled=!state.canAttempt||!atDoor;
  const copy=doorCopyFor(state.selectedDoor);
  $('door-hint').textContent=state.selectedDoor?state.phase==='room'&&!atDoor?'Walk to the selected door to try its rhythm key.':[copy?.hint,copy?.warning].filter(Boolean).join(' '):'Each door has its own rhythm lock.';
}
function clearCutscenePath(){pathEditor?.destroy();pathEditor=null;}
function renderCutscenePath(){
 clearCutscenePath();
 const map=$('room-map'),project=editorProject??authoredProject;
 if(!editingOpen||developerConsole?.activeTab!=='cutscene'||!activeScene||!project.scenes[activeScene.id]){pathEditorActive=false;map.querySelector('.cutscene-mira-pick')?.remove();return;}
 if(!pathEditorActive&&!cutsceneView?.state.preview){pathEditorActive=true;roomView?.reset();}else pathEditorActive=true;
 let mira=map.querySelector('.cutscene-mira-pick');
 if(!mira){
  const pose=cutsceneView?.state.actors.find(actor=>actor.id==='mira')??roomView.state;
  mira=document.createElement('button');mira.type='button';mira.className='cutscene-mira-pick';mira.dataset.cutsceneActor='mira';mira.dataset.originX=pose.x;mira.dataset.originY=pose.y;mira.setAttribute('aria-label','Edit Mira’s cutscene path');
  Object.assign(mira.style,{left:`${(pose.x-64)/activeScene.geometry.width*100}%`,top:`${(pose.y-160)/activeScene.geometry.height*100}%`,width:`${128/activeScene.geometry.width*100}%`,height:`${166/activeScene.geometry.height*100}%`});map.append(mira);
 }
 if(!pathSelection||pathSelection.roomId!==activeScene.id)return;
 const scene=project.scenes[activeScene.id],timeline=compileRoomCutscene({scene,beats:project.content[activeScene.id].cutscene??[],playerPosition:scene.geometry.start});
 const clip=timeline.clips.find(clip=>clip.index===pathSelection.clipIndex);if(!clip)return;
 pathEditor=createCutscenePathEditor({map,scene,clip,actorId:clip.actor,onChange:change=>{if(cutsceneView?.state.preview)cutsceneView.pause();developerConsole.updateCutscenePath(clip.index,change);}});
}
function selectCutsceneActor(id){
 if(cutsceneView?.state.preview)cutsceneView.pause();
 developerConsole.selectCutsceneActor(id);
}
function stopCutscene({retain=false,state=null}={}){
 const view=cutsceneView;if(!view)return false;
 const current=state??view.state,preview=view.state.preview,position=roomView?.state;
 cutsceneView=null;cutsceneProjectSignature='';view.destroy();
 const player=current.actors?.find(actor=>actor.id==='mira');
 if(retain&&!preview){
  cutsceneSeen.add(game.state.roomId);
  cutscenePoses.set(game.state.roomId,current.actors.map(({id,x,y,facing})=>({id,x,y,facing})));
 }
 activeSceneProject=null;renderScene(retain&&!preview?player??position:position);render();
 if(retain&&!preview)save();
 document.dispatchEvent(new CustomEvent('quietbellcutscene',{detail:{...current,playing:false,finished:true,preview,roomId:activeScene.id}}));
 if(!editingOpen)$('walk-floor').focus({preventScroll:true});
 return true;
}
function beginCutscene({preview=false,project=runtimeProject,roomId=game.state.roomId,paused=false,tile=0}={}){
 stopCutscene();
 const beats=project.content[roomId]?.cutscene??[];
 if(!beats.length||!project.scenes[roomId])return null;
 roomView?.stop();stopAudio();closePanels();
 if(preview){editorProject=project;editingRoomId=roomId;activeSceneProject=null;renderScene();}
 const scene=activeScene;
 cutsceneProjectSignature=preview?JSON.stringify(project):'';
 cutsceneView=createCutsceneView({root,map:$('room-map'),panel:$('cutscene-panel'),roomView,scene,project,beats,playerPosition:preview?scene.geometry.start:roomView.state,preview,paused,tile,playbackRate:cutsceneRate,onRateChange:rate=>{cutsceneRate=rate;},onFinish:({state})=>stopCutscene({retain:!preview,state})});
 roomView.refresh();if(preview)renderCutscenePath();return cutsceneView;
}
function maybeEntrance({replay=false}={}){
 if(editingOpen||game.state.phase==='continued'||cutsceneView||!replay&&cutsceneSeen.has(game.state.roomId))return;
 if(replay){const position=roomView?.state;cutscenePoses.delete(game.state.roomId);activeSceneProject=null;renderScene(position);}
 beginCutscene();
}
function previewCutscene(roomId,project,options={}){
 const command=options.command??'play';
 if(command==='rate'){cutsceneRate=options.rate===2?2:1;return cutsceneView?.state.preview?cutsceneView.setRate(cutsceneRate):{playbackRate:cutsceneRate,playing:false};}
 if(command==='stop'){if(cutsceneView?.state.preview)stopCutscene();return null;}
 if(command==='state')return cutsceneView?.state??null;
 const matching=cutsceneView?.state.preview&&cutsceneView.state.roomId===roomId&&(activeSceneProject===project||cutsceneProjectSignature===JSON.stringify(project));
 if(!matching){const view=beginCutscene({preview:true,project,roomId,paused:command!=='play',tile:options.tile??0});return view?.state??null;}
 if(command==='pause')return cutsceneView.pause();
 if(command==='seek')return cutsceneView.seek(options.tile??0);
 return cutsceneView.play();
}
function renderScene(position=null){
  const project=editingOpen?(editorProject??authoredProject):runtimeProject;
  const roomId=editingOpen&&project.scenes[editingRoomId]?editingRoomId:game.state.roomId;
  const baseScene=project.scenes[roomId];if(!baseScene)return;
  if(activeScene?.id===roomId&&activeSceneProject===project)return;
  const sceneDefinition=editingOpen?baseScene:stageCutsceneScene(baseScene,cutscenePoses.get(roomId));
  clearCutscenePath();$('room-map').querySelector('.cutscene-mira-pick')?.remove();
  const previous=roomView;roomView=null;previous?.destroy();
  activeScene=sceneDefinition;activeSceneProject=project;
  const visible=item=>editingOpen||!item.revealAfter||game.state.claimedSources.includes(item.revealAfter);
  const room={...activeScene.geometry,targets:activeScene.geometry.targets.filter(visible)},current=project.content[roomId];
  people=new Map(current.people.map(person=>[person.id,person]));observations=new Map(current.inspections.map(entry=>[entry.id,entry]));
  const localDoors=Object.values(project.doors).filter(door=>door.from===roomId);
  doorNames=Object.fromEntries(localDoors.flatMap(door=>[door.id,door.canonicalId].map(id=>[id,doorCopyFor(id,project,roomId).name])));
  doorHints=Object.fromEntries(localDoors.flatMap(door=>[door.id,door.canonicalId].map(id=>[id,doorCopyFor(id,project,roomId).hint])));
  if(!people.has(selectedPerson)){selectedPerson=current.people[0]?.id??null;selectedTopic=getPersonReplies(current.people[0]??{})[0]?.id??null;}
  const scene=$('room-scene'),map=$('room-map'),art=map.querySelector('.mg-art');
  scene.dataset.room=activeScene.id;scene.setAttribute('aria-label',activeScene.title);root.querySelector('.location').textContent=activeScene.title;
  $('developer-end').hidden=!developerMode;root.dataset.developer=String(developerMode);
  art.src=activeScene.image;art.alt=`${activeScene.title}, a spacious orthographic 2/3 Pocket Pixel room in the floating islands of Lumen Reach.`;
  for(const item of map.querySelectorAll('.mg-occluder,.mg-npc'))item.remove();
  for(const mask of activeScene.occluders){const img=document.createElement('img');img.className='mg-occluder';img.dataset.occluder=mask.id;img.src=activeScene.image;img.alt='';img.setAttribute('aria-hidden','true');img.style.clipPath=mask.clipPath;img.style.zIndex=String(mask.depth);map.insertBefore(img,map.querySelector('.mg-room-objects'));}
  for(const actor of activeScene.actors){
    const sprite=project.cast[actor.character],element=document.createElement('div');element.className='mg-npc';element.dataset.actor=actor.id;element.setAttribute('aria-hidden','true');
    Object.assign(element.style,{left:`${actor.feet.x/room.width*100}%`,top:`${actor.feet.y/room.height*100}%`,width:`${actor.worldSize/room.width*100}%`,backgroundImage:`url("${project.settings.castImage}")`,backgroundPosition:`${sprite.column*100}% ${sprite.row*100}%`,transform:`translate(${-sprite.anchor[0]*100}%,${-sprite.anchor[1]*100}%)`,zIndex:String(Math.round(actor.feet.y)+1)});
    map.insertBefore(element,map.querySelector('.mg-room-objects'));
  }
  for(const name of ['.mg-room-objects','.mg-people','.mg-inspections'])map.querySelector(name).replaceChildren();
  for(const item of activeScene.objects.filter(visible)){
    const button=document.createElement('button'),label=document.createElement('span');button.type='button';button.className=`mg-${item.type} mg-hotspot`;button.dataset[item.type]=item.id;button.setAttribute('aria-label',item.actionLabel??item.label);
    if(['person','door'].includes(item.type))button.setAttribute('aria-pressed','false');
    const r=item.rect;Object.assign(button.style,{left:`${r.x/room.width*100}%`,top:`${r.y/room.height*100}%`,width:`${r.width/room.width*100}%`,height:`${r.height/room.height*100}%`});
    label.textContent=item.label;if(item.type==='chest')label.id='chest-label';button.append(label);
    map.querySelector(item.type==='person'?'.mg-people':item.type==='inspect'?'.mg-inspections':'.mg-room-objects').append(button);
  }
  const sceneId=activeScene.id;
  roomView=createRoomView({scene,map,room,playerDefinition:project.player,cameraFit:editingOpen,player:$('player-sprite'),floor:$('walk-floor'),controls:$('room-controls'),interactButton:$('interact'),prompt:$('nearby-prompt'),savedPosition:position,canMove:()=>['room','terminal'].includes(game.state.phase)&&!panelOpen(),onInteract:interactWith,onStop:()=>{if(!editingOpen&&sceneId===game.state.roomId)save();},onReachChange:()=>{if(roomView&&!editingOpen)updateAccess();}});
  renderCutscenePath();
}

function render(){
  renderScene();
  if(editingOpen){for(const button of $('room-map').querySelectorAll('button'))button.disabled=false;roomView?.refresh();return;}
  const active=document.activeElement,focusedKind=active?.dataset?.kind,focusedNote=active?.dataset?.remove;
  const state=game.state,continued=state.phase==='continued',recipe=continued?state.receipt.recipe:state.phrase;
  const bagMode=$('notes-dialog').dataset.mode==='bag',visibleStock=bagMode?state.inventory:state.availableInventory;
  const units=recipe.reduce((total,kind)=>total+NOTE_KIND_BY_ID[kind].units,0);
  const targetUnits=state.targetUnits??8,targetBeats=targetUnits/2;
  $('total').textContent=`${units/2} / ${targetBeats} beats`;root.querySelector('.mg-floor').dataset.ready=String(units===targetUnits);
  $('phrase').style.gridTemplateColumns=`repeat(${Math.max(targetUnits,units,1)},minmax(0,1fr))`;
  const ruler=root.querySelector('.mg-ruler');ruler.replaceChildren();ruler.style.gridTemplateColumns=`repeat(${targetUnits},minmax(0,1fr))`;
  for(let unit=0;unit<targetUnits;unit+=2){const label=document.createElement('span');label.textContent=String(unit/2+1);label.style.gridColumn=`span ${Math.min(2,targetUnits-unit)}`;ruler.append(label);}
  $('phrase').innerHTML=recipe.map((kind,index)=>`<button type="button" class="mg-phrase-note" data-remove="${index}" aria-label="${escapeHTML(continued?shortNames[kind]:'Return '+shortNames[kind]+' to your satchel')}" style="grid-column:span ${NOTE_KIND_BY_ID[kind].units};--mg-tile:${colors[kind]}"${continued?' disabled':''}>${symbolMarkup(kind)}</button>`).join('');
  $('phrase').setAttribute('aria-label',`${continued?'Your played answer':'Your answer'}: ${recipe.length?recipe.map(kind=>NOTE_KIND_BY_ID[kind].label).join(', '):'empty'}. ${units/2} of ${targetBeats} beats.`);
  $('stock').innerHTML=NOTE_KINDS.map(kind=>`<button type="button" class="mg-stock-note" data-kind="${kind.id}" aria-label="${escapeHTML(kind.label)}, ${beatText(kind)}, ${visibleStock[kind.id]} available" style="--mg-tile:${colors[kind.id]}"${bagMode||continued||state.availableInventory[kind.id]<1||state.units+kind.units>targetUnits?' disabled':''}><span class="mg-count">×${visibleStock[kind.id]}</span>${symbolMarkup(kind.id)}<span class="mg-kind-name">${escapeHTML(shortNames[kind.id])}</span><span class="mg-beat-value">${beatText(kind)}</span></button>`).join('');
  $('stock-title').textContent=bagMode?'Your notes':'Rhythm lock';$('held').textContent=`${count(visibleStock)} ${bagMode?'carried':'available'}`;
  const bagCount=count(state.inventory);$('bag-count').textContent=String(bagCount);$('bag-count').hidden=bagCount===0;$('bag').setAttribute('aria-label',`Open inventory, ${bagCount} notes`);
  $('listen').disabled=!recipe.length||!soundEnabled;$('undo').disabled=!state.phrase.length&&!continued;$('commit').disabled=!state.canAttempt;
  $('door-demo').disabled=!state.selectedDoor||!soundEnabled||continued;
  $('door-title').textContent=state.selectedDoor?doorNames[state.selectedDoor]:'Choose a door';
  $('door-hint').textContent=state.selectedDoor?doorHints[state.selectedDoor]:'Each door has its own rhythm lock.';
  for(const button of root.querySelectorAll('[data-door]')){button.setAttribute('aria-pressed',String(getChapterDoor(button.dataset.door)?.id===state.selectedDoor));button.disabled=continued;}
  for(const button of root.querySelectorAll('[data-person]'))button.disabled=continued;
  for(const button of root.querySelectorAll('[data-inspect]'))button.disabled=continued;
  for(const chest of root.querySelectorAll('[data-chest]')){const claimed=state.claimedSources.includes(chest.dataset.chest);chest.disabled=continued||claimed;chest.setAttribute('aria-label',claimed?'Delivery chest opened; notes collected':chest.dataset.chest==='depot-chest'?'Open the delivery chest':'Open the stamped chest');chest.querySelector('span').textContent=claimed?'Opened':'Open';}
  for(const button of root.querySelectorAll('[data-return]'))button.disabled=continued;
  $('revisit-room').hidden=!state.canRevisit;
  $('edit-hint').textContent=continued?'This is the answer you played. Revisit it to try another path.':'Choose notes from your satchel. Tap a placed note to take it back.';
  $('status').textContent=message;
  $('pack-heading').textContent='Room finds';$('ledger').hidden=!continued;
  $('ledger').innerHTML=continued?`<div><strong>${state.receipt.recipe.length}</strong><span>Used</span></div><div><strong>${count(state.inventory)}</strong><span>Carried</span></div><div><strong>0</strong><span>New on entry</span></div>`:'';
  $('pack').innerHTML='';
  $('pack-copy').textContent=(CHAPTER_ROOMS[state.roomId]?.sources??[]).filter(id=>CHAPTER_SOURCES[id].type!=='hidden'||state.claimedSources.includes(id)).map(id=>`${CHAPTER_SOURCES[id].label}: ${state.claimedSources.includes(id)?'collected':'waiting'}.`).join(' ');
  if($('menu-dialog').open)renderPause();
  if(!continued&&state.phase!=='terminal'&&$('outcome').open)$('outcome').close();
  $('ending').hidden=state.phase!=='terminal';$('outcome-close').hidden=continued;$('revisit').disabled=!state.canRevisit;
  $('replay-cutscene').hidden=continued||!content()?.cutscene?.length;
  if(state.phase==='terminal'){
    const ending=content().outcome??state.nextScene;
    $('outcome-kicker').textContent=ending.kicker??(ending.kind==='dead-end'?'A quiet dead end':ending.kind==='secret-ending'?'A hidden ending':'An ending');
    $('outcome-title').textContent=content().title??state.nextScene.title;
    $('outcome-copy').textContent=[ending.copy,ending.repair].filter(Boolean).join(' ');
    $('outcome-help').textContent=ending.kind==='dead-end'?'You can explore this place, revisit the last choice, or start a new run. Your discoveries stay in the journal.':`${count(state.inventory)===0?'Every carried note has found its place.':'Your unused notes remain in your satchel.'} Explore this ending, revisit your last choice, or start a new run to discover another route.`;
  }
  if(continued){const copy=doorCopyFor(state.receipt.doorId),terminal=isTerminalScene(state.nextScene);$('outcome-kicker').textContent=terminal?(state.nextScene.kind==='dead-end'?'A quiet dead end':state.nextScene.kind==='secret-ending'?'A hidden ending':'An ending'):'Continuation preview';$('outcome-title').textContent=state.nextScene.title;$('outcome-copy').textContent=terminal?[copy.deadCopy??state.nextScene.copy??'This route ends here.',copy.repair??state.nextScene.repair].filter(Boolean).join(' '):copy.previewCopy??state.nextScene.copy??'You have reached the next route.';$('outcome-help').textContent='Your carried notes are saved. Revisit this choice to explore another answer with the notes you spent restored.';}
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
function edit(action){roomView?.stop();stopAudio();if(!action())return;message=game.state.units===(game.state.targetUnits??8)?'The rhythm key is filled. Check the selected lock, then try the door.':'Arrange the notes for your chosen door.';render();save();}
function chooseDoor(id){stopAudio();if(!roomView?.withinReach(id)||!game.selectDoor(id))return;message=!developerMode&&game.state.roomId==='depot'&&!game.state.claimedSources.includes('nell-parcel')?'Ask Nell for the parcel before opening a door.':!developerMode&&game.state.roomId==='depot'&&!game.state.claimedSources.includes('depot-chest')?'Find the half note in the chest; every opening lock needs it.':`${doorNames[id]} selected. Hear its rhythm or ask a resident for a clue.`;openNotes('lock');save();}
function claim(id){
  const source=CHAPTER_SOURCES[id];if(!source)return;stopAudio();const target=source.character??activeScene.objects.find(item=>item.sourceId===id)?.id??id;if(!roomView?.withinReach(target))return;
  if(!game.claim(id)){message='These notes have already been collected.';render();notify(message);return;}
  message=!developerMode&&id==='nell-parcel'?'Nell gave you eight notes. The half note is in the chest.':!developerMode&&id==='depot-chest'?'Found a half note in the chest.':`${source.label} collected: ${source.recipe.map(kind=>shortNames[kind]).join(', ')}.`;
  if($('conversation-dialog').open)$('conversation-dialog').close();if($('lore-dialog').open)$('lore-dialog').close();
  if(source.type==='hidden'){const position=roomView?.state;activeSceneProject=null;renderScene(position);}
  render();save();notify(message);$('walk-floor').focus({preventScroll:true});
}
function commit(){
  roomView?.stop();stopAudio();if(!roomView?.withinReach(doorTargetId(game.state.selectedDoor)))return;
  if(!game.commit()){if(game.state.canAttempt){message='The lock stays closed. That phrase does not match this door’s rhythm. Your notes are safe.';render();$('announcement').textContent=message;}return;}
  const state=game.state;let changed=journey.traverse(state.lastTransition.id);
  if(isTerminalScene(state.nextScene))changed=journey.recordOutcome(state.nextScene.id)||changed;
  if(changed)saveJourney();selectedTopic='story';message=['room','terminal'].includes(state.phase)?content().arrival:'The lock opens. Your unused notes travel with you.';
  closePanels();render();save();void play(state.receipt.recipe);$('announcement').textContent=message;
  if(state.phase==='continued'){openPanel('outcome');$('revisit').focus({preventScroll:true});}else{notify(message);$('walk-floor').focus({preventScroll:true});}
  maybeEntrance();
}
function undo(){roomView?.stop();const wasBoundary=game.state.phase!=='room';stopAudio();if(!game.undo())return;message=wasBoundary?'Back at the same lock. Notes spent on this choice are restored.':'Note returned to your satchel.';render();save();if(wasBoundary)root.querySelector('[data-door="'+doorTargetId(game.state.selectedDoor)+'"]')?.focus({preventScroll:true});}
function revisitRoom(){roomView?.stop();stopAudio();if(!game.revisit())return;closePanels();message=!developerMode&&game.state.roomId==='depot'?'Back at the depot. Your entry rhythm and the notes collected beyond it have been rewound; discoveries stay in your journal.':'Back at the same lock. Notes spent on this choice are restored.';render();save();notify(message);$('walk-floor').focus({preventScroll:true});}
function restart(){stopCutscene();roomView?.stop();stopAudio();game.restart();restoreCutscenes(null);activeSceneProject=null;closePanels();selectedPerson=content().people[0]?.id??null;selectedTopic=getPersonReplies(content().people[0]??{})[0]?.id??null;message='A new run begins with an empty satchel. Nell and the chest are ready again.';render();save();$('walk-floor').focus({preventScroll:true});maybeEntrance();}
function interactWith(id){
  if(people.has(id)){stopAudio();selectedPerson=id;selectedTopic=Object.hasOwn(people.get(id),'intro')?null:getPersonReplies(people.get(id))[0]?.id??null;talk();openPanel('conversation-dialog');save();}
  else if(getChapterDoor(id)?.from===game.state.roomId)chooseDoor(id);
  else if(CHAPTER_SOURCES[id]?.type==='chest')claim(id);
  else if(observations.has(id))inspect(id);
  else if(id==='return-depot'||id==='return-previous')revisitRoom();
}

let actorDrag=null,editorPress=null;
function selectEditorObject(roomId,object){
 developerConsole.open({roomId,tab:object.type==='person'?'dialogue':object.type==='door'?'puzzles':object.type==='chest'?'notes':'rooms',personId:object.type==='person'?object.id:undefined,doorId:object.type==='door'?(object.doorId??object.id):undefined,sourceId:object.type==='chest'?(object.sourceId??object.id):undefined,objectId:['inspect','return'].includes(object.type)?object.id:undefined});
}
root.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(editingOpen&&developerConsole.activeTab==='cutscene'&&(button.dataset.person||button.dataset.cutsceneActor)){selectCutsceneActor(button.dataset.person??button.dataset.cutsceneActor);return;}
  const targetId=button.dataset.person??button.dataset.door??button.dataset.chest??button.dataset.inspect;
  if((editingOpen||event.shiftKey)&&targetId){
    developerConsole.open({roomId:activeScene.id,tab:button.dataset.person?'dialogue':button.dataset.door?'puzzles':button.dataset.chest?'notes':'rooms',personId:button.dataset.person,doorId:button.dataset.door,sourceId:button.dataset.chest,objectId:button.dataset.inspect});return;
  }
  if(editingOpen){if(button.id==='walk-floor'&&developerConsole.activeTab!=='cutscene')developerConsole.open({roomId:activeScene.id,tab:'rooms'});return;}
  if(button.dataset.person){roomView?.request(button.dataset.person);return;}
  if(button.dataset.topic){stopAudio();selectedTopic=button.dataset.topic;talk();if(selectedTopic==='route'&&game.state.phase!=='continued'&&journey.discoverHint((game.state.roomId==='depot'?'':game.state.roomId+'-')+selectedPerson+'-route'))saveJourney();save();return;}
  if(button.dataset.door){roomView?.request(button.dataset.door);return;}
  if(button.dataset.chest){roomView?.request(button.dataset.chest);return;}
  if(button.dataset.return){roomView?.request(button.dataset.return);return;}
  if(button.dataset.inspect){roomView?.request(button.dataset.inspect);return;}
  if(button.dataset.kind){edit(()=>game.add(button.dataset.kind));return;}
  if(button.dataset.remove!==undefined){edit(()=>game.remove(Number(button.dataset.remove)));return;}
  switch(button.id){
    case'demo':void play(getPersonReplies(people.get(selectedPerson)).find(reply=>reply.id===selectedTopic)?.demo??people.get(selectedPerson).demo??[]);break;
    case'developer-open':developerConsole.open({roomId:game.state.roomId});break;
    case'developer-end':returnToPublishedGame();break;
    case'door-demo':if(game.state.selectedDoor)void play(getChapterDoor(game.state.selectedDoor).recipe);break;
    case'take-parcel':claim(people.get(selectedPerson)?.sourceId);break;
    case'lore-search':claim(observations.get($('lore-dialog').dataset.observation)?.sourceId);break;
    case'ending':openPanel('outcome');break;
    case'replay-cutscene':closePanels();maybeEntrance({replay:true});break;
    case'revisit-room':revisitRoom();break;
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

$('room-map').addEventListener('pointerdown',event=>{
 if(!editingOpen||event.button!==0)return;
 const cutsceneActor=event.target.closest('[data-person],[data-cutscene-actor]');
 if(developerConsole.activeTab==='cutscene'&&cutsceneActor){
  editorPress={pointerId:event.pointerId,roomId:activeScene.id,object:{type:'cutscene-actor',id:cutsceneActor.dataset.person??cutsceneActor.dataset.cutsceneActor},startX:event.clientX,startY:event.clientY,moved:false};actorDrag=null;$('room-map').setPointerCapture(event.pointerId);return;
 }
 const button=event.target.closest('[data-person],[data-door],[data-chest],[data-inspect],[data-return]');if(!button)return;
 const id=button.dataset.person??button.dataset.door??button.dataset.chest??button.dataset.inspect??button.dataset.return;
 const object=editorProject.scenes[activeScene.id].objects.find(object=>object.id===id);if(!object)return;
 // A field blur can repaint the room before click. Keep the pressed identity
 // through pointerup instead of relying on the lifetime of its DOM button.
 editorPress={pointerId:event.pointerId,roomId:activeScene.id,object,startX:event.clientX,startY:event.clientY,moved:false};
 const actor=object.type==='person'?editorProject.scenes[activeScene.id].actors.find(actor=>actor.id===id):null;
 const rect=$('room-map').getBoundingClientRect();
 actorDrag=actor?{id:actor.id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:actor.feet.x,y:actor.feet.y,scale:rect.width/activeScene.geometry.width,moved:false}:null;
 $('room-map').setPointerCapture(event.pointerId);
});
$('room-map').addEventListener('pointermove',event=>{
 const press=editorPress;if(!press||event.pointerId!==press.pointerId||!editingOpen)return;
 if(Math.hypot(event.clientX-press.startX,event.clientY-press.startY)>=6)press.moved=true;
 const drag=actorDrag;if(!drag||!press.moved)return;drag.moved=true;
 const dx=(event.clientX-drag.startX)/drag.scale,dy=(event.clientY-drag.startY)/drag.scale;
 const {bounds}=activeScene.geometry;drag.nextX=Math.max(bounds.x+65,Math.min(bounds.x+bounds.width-65,drag.x+dx));drag.nextY=Math.max(bounds.y+45,Math.min(bounds.y+bounds.height-90,drag.y+dy));
 const sprite=$('room-map').querySelector('[data-actor="'+drag.id+'"]');sprite.style.left=`${drag.nextX/activeScene.geometry.width*100}%`;sprite.style.top=`${drag.nextY/activeScene.geometry.height*100}%`;sprite.style.zIndex=String(Math.round(drag.nextY)+1);
});
function finishEditorPress(event){
 const press=editorPress;if(!press||event.pointerId!==press.pointerId)return;
 const drag=actorDrag;editorPress=null;actorDrag=null;if(!editingOpen)return;
 if(press.object.type==='cutscene-actor'){if(!press.moved)selectCutsceneActor(press.object.id);return;}
 if(drag?.moved){event.preventDefault();if(!developerConsole.moveActor(drag.id,Math.round(drag.nextX),Math.round(drag.nextY))){activeSceneProject=null;renderScene(roomView?.state);render();}return;}
 if(!press.moved)selectEditorObject(press.roomId,press.object);
}
$('room-map').addEventListener('pointerup',finishEditorPress);
$('room-map').addEventListener('pointercancel',event=>{
 if(editorPress?.pointerId!==event.pointerId)return;const moved=actorDrag?.moved;editorPress=null;actorDrag=null;
 if(moved){activeSceneProject=null;renderScene(roomView?.state);render();}
});
for(const [button,panel]of [['help-close','help-dialog'],['help-done','help-dialog'],['conversation-close','conversation-dialog'],['notes-close','notes-dialog'],['lore-close','lore-dialog'],['lore-done','lore-dialog'],['menu-close','menu-dialog'],['outcome-close','outcome']])$(button).addEventListener('click',()=>$(panel).close());
for(const id of panelIds)$(id).addEventListener('close',()=>{roomView?.refresh();if(!panelOpen()&&game.state.phase==='continued'){openPanel('outcome');return;}const active=document.activeElement;if(!panelOpen()&&(!active||active===document.body||active===document.documentElement||active.closest('dialog')))$('walk-floor').focus({preventScroll:true});});
$('outcome').addEventListener('cancel',event=>{if(game.state.phase==='continued')event.preventDefault();});
function renderHelpNotes(){$('help-notes').innerHTML=NOTE_KINDS.map(kind=>`<div class="mg-help-note">${symbolMarkup(kind.id)}<span>${escapeHTML(kind.label)}</span><span>${beatText(kind)}</span></div>`).join('');}
renderHelpNotes();
document.addEventListener('keydown',event=>{
  if(event.key==='F2'&&!event.repeat&&!event.altKey&&!event.ctrlKey&&!event.metaKey){event.preventDefault();if(developerConsole.isOpen)developerConsole.close();else developerConsole.open({roomId:game.state.roomId});return;}
  if(editingOpen){if(event.key==='Escape'){event.preventDefault();developerConsole.close();}return;}
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
function background(){stopAudio();void audio.suspend();void previewAudio.suspend();}
window.addEventListener('blur',background);document.addEventListener('visibilitychange',()=>{if(document.hidden)background();});
window.addEventListener('pagehide',()=>{clearTimeout(toastTimer);stopAudio();void audio.destroy();void previewAudio.destroy();});

function persistedProject(project){
 const normalized=normalizeProject(project);
 if(!write(PROJECT_KEY,JSON.stringify(normalized)))throw new Error('The browser could not save this project. Export it to a file to keep your edits.');
 authoredProject=normalized;return normalized;
}
function switchRun({project,mode,nextGame,nextJourney,nextSaved=null}){
 stopCutscene();
 roomView?.stop();stopAudio();const previous=roomView;roomView=null;previous?.destroy();
 runtimeProject=project;developerMode=mode;game=nextGame;journey=nextJourney;saved=nextSaved;bindDefinitions();restoreCutscenes(saved?.roomCutscenes);
 audio.setDefinition({bpm:project.settings.bpm,noteKinds:NOTE_KINDS});audio.setEnabled(soundEnabled);
 const residents=content().people;selectedPerson=residents.some(person=>person.id===saved?.conversation?.person)?saved.conversation.person:residents[0]?.id??null;
 const choices=getPersonReplies(residents.find(person=>person.id===selectedPerson)??{});selectedTopic=choices.some(reply=>reply.id===saved?.conversation?.topic)?saved.conversation.topic:Object.hasOwn(residents.find(person=>person.id===selectedPerson)??{},'intro')?null:choices[0]?.id??null;
 activeScene=null;activeSceneProject=null;editorReturnPosition=null;editorReturnSelection=null;editorSignature='';editorProject=project;editingRoomId=game.state.roomId;
 write(DEV_ACTIVE_KEY,mode?'on':'off');recordRestoredJourney();renderHelpNotes();
 closePanels();if(developerConsole?.isOpen){editingOpen=false;root.classList.remove('developer-editing');developerConsole.close();}
 renderScene(saved?.positionRoomId===game.state.roomId?saved.roomPosition:null);render();if(mode)save({force:true});
 if(game.state.phase==='continued')openPanel('outcome');else $('walk-floor').focus({preventScroll:true});
 maybeEntrance();
}
function startPlaytest(project,options={}){
 const normalized=normalizeProject(project),candidate=createDungeonGame({definition:normalized,developer:true});
 if(options.roomId&&!candidate.developerTeleport(options.roomId))throw new Error('Choose a playable room for the test.');
 if(options.inventory&&!candidate.developerSetInventory(options.inventory))throw new Error('Use whole note quantities from 0 to 999.');
 persistedProject(normalized);if(!write(APPLIED_PROJECT_KEY,JSON.stringify(normalized)))throw new Error('The browser could not keep the applied project. Export it before testing.');appliedProject=normalized;
 const nextJourney=createJourney({manifest:createProjectManifest(normalized)});
 message='Developer playtest. Your published run is kept separately.';
 switchRun({project:normalized,mode:true,nextGame:candidate,nextJourney});notify(message);return true;
}
function returnToPublishedGame(){
 const published=readJSON(SAVE_KEY),candidate=createDungeonGame({saved:published});
 const nextJourney=createJourney({saved:readJSON(JOURNEY_KEY),manifest:CHAPTER_JOURNEY_MANIFEST});
 message='Returned to your published game. Developer changes stay in your saved project.';
 switchRun({project:shippedProject,mode:false,nextGame:candidate,nextJourney,nextSaved:published});notify(message);return true;
}
function updateEditorPreview(project,roomId=editingRoomId){
 const signature=JSON.stringify(project);if(editorSignature===signature&&editingRoomId===roomId)return true;
 let candidate;try{candidate=normalizeProject(project);}catch{return false;}
 if(cutsceneView?.state.preview)stopCutscene();
 editorSignature=signature;editorProject=candidate;editingRoomId=candidate.scenes[roomId]?roomId:candidate.settings.startRoomId;
 if(editingOpen){const position=roomView?.state;activeSceneProject=null;renderScene(position);render();}
 return true;
}
function editorOpened(){
 if(editingOpen)return;stopCutscene();roomView?.stop();stopAudio();editorReturnPosition={roomId:game.state.roomId,...roomView?.state};editorReturnSelection={game,person:selectedPerson,topic:selectedTopic};
 editorProject??=authoredProject;editingRoomId=editorProject.scenes[game.state.roomId]?game.state.roomId:editorProject.settings.startRoomId;
 closePanels();editingOpen=true;root.classList.add('developer-editing');activeSceneProject=null;
 renderScene(editorReturnPosition);render();
}
function editorClosed(){
 if(!editingOpen)return;stopCutscene();stopAudio();editingOpen=false;root.classList.remove('developer-editing');activeSceneProject=null;
 if(editorReturnSelection?.game===game){selectedPerson=editorReturnSelection.person;selectedTopic=editorReturnSelection.topic;}
 const position=editorReturnPosition?.roomId===game.state.roomId?editorReturnPosition:saved?.positionRoomId===game.state.roomId?saved.roomPosition:null;
 renderScene(position);render();if(!panelOpen()&&game.state.phase==='continued')openPanel('outcome');
}
function developerMutation(action){
 if(!developerMode)return false;roomView?.stop();stopAudio();const previewPosition=roomView?.state,previousRoom=game.state.roomId;if(!action())return false;
 if(editorReturnPosition?.roomId!==game.state.roomId)editorReturnPosition={roomId:game.state.roomId,...runtimeProject.scenes[game.state.roomId].geometry.start};
 journey.visit(game.state.roomId);saveJourney();activeSceneProject=null;closePanels();
 if(editingOpen&&previousRoom!==game.state.roomId)developerConsole.open({roomId:game.state.roomId,tab:'playtest'});
 renderScene(previousRoom===game.state.roomId?previewPosition:runtimeProject.scenes[game.state.roomId].geometry.start);render();save({force:true});developerConsole?.refresh();return true;
}

developerConsole=createDeveloperConsole({mount:document.body,getProject:()=>authoredProject,getState:()=>({...snapshot(),roomPosition:roomView?.state}),onOpen:editorOpened,onClose:editorClosed,onSelectRoom:(roomId,project)=>updateEditorPreview(project,roomId),onDraftChange:project=>updateEditorPreview(project),onApply:project=>startPlaytest(project),onPlaytest:startPlaytest,onReturnToGame:returnToPublishedGame,onSaveProject:persistedProject,
 onPreviewCutscene:previewCutscene,
 onCutsceneSelection:selection=>{const changed=pathSelection?.roomId!==selection?.roomId||pathSelection?.clipIndex!==selection?.clipIndex;pathSelection=selection;if(changed&&cutsceneView?.state.preview)cutsceneView.pause();renderCutscenePath();},
 onPreview:async(recipe,project)=>{const revision=++audioRevision;audio.stop();previewAudio.setDefinition({bpm:project.settings.bpm,noteKinds:project.noteKinds});await previewAudio.unlock();if(revision===audioRevision&&editingOpen)previewAudio.playPattern(recipe);},
 onSetInventory:stock=>developerMutation(()=>game.developerSetInventory(stock)),onTeleport:roomId=>developerMutation(()=>game.developerTeleport(roomId)),onResetSources:sourceId=>developerMutation(()=>game.developerResetSources(sourceId)),
});

renderScene(saved?.version===3&&saved.positionRoomId===game.state.roomId||saved?.version===2&&game.state.roomId==='depot'?saved.roomPosition:null);
render();
if(game.state.phase==='continued')openPanel('outcome');else $('walk-floor').focus({preventScroll:true});
maybeEntrance();
