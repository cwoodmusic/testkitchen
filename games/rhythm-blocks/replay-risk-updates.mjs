/** Upgrade only the old shipped graph and its untouched paid-exit locations. */
import {NOTE_KINDS} from './engine.mjs';
import {CHAPTER_ROOMS,CHAPTER_DOORS,CHAPTER_SOURCES,CHAPTER_TERMINALS} from './chapter.mjs';
import {CAMPAIGN_SCENES} from './campaign-scenes.mjs';
import {CAMPAIGN_CONTENT} from './campaign-content.mjs';

export const REPLAY_RISK_DETOURS=Object.freeze({
 'dead-brambles':'bramble-return-gate',
 'dead-aviary':'aviary-return-gate',
 'dead-echo':'echo-return-gate',
});
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const list=value=>Array.isArray(value)?value:[];
const clone=value=>structuredClone(value);
const comparable=value=>Array.isArray(value)?value.map(comparable):record(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,comparable(value[key])])):value;
const same=(left,right)=>JSON.stringify(comparable(left))===JSON.stringify(comparable(right));
const sorted=entries=>Object.entries(entries??{}).sort(([left],[right])=>left.localeCompare(right));
const ids=new Set(Object.keys(REPLAY_RISK_DETOURS)),gateIds=new Set(Object.values(REPLAY_RISK_DETOURS));
const textKeys=new Set(['title','label','actionLabel','sourceLabel']);
function structural(value){
 if(Array.isArray(value))return value.map(structural);
 if(!record(value))return value;
 return Object.fromEntries(Object.entries(value).filter(([key])=>!textKeys.has(key)).map(([key,item])=>[key,structural(item)]));
}
function graph(project){
 if(!record(project?.rooms)||!record(project.doors)||!record(project.sources)||!record(project.terminals)||!record(project.settings))return null;
 const select=(value,fields)=>record(value)?Object.fromEntries(fields.filter(field=>Object.hasOwn(value,field)).map(field=>[field,value[field]])):value;
 return {
  rooms:sorted(project.rooms).map(([id,room])=>[id,select(room,['id','sources','doors'])]),
  doors:sorted(project.doors).map(([id,door])=>[id,select(door,['id','canonicalId','from','to','recipe','revealAfter'])]),
  sources:sorted(project.sources).map(([id,source])=>[id,select(source,['id','type','roomId','recipe','character'])]),
  terminals:sorted(project.terminals).map(([id,terminal])=>[id,select(terminal,['id','kind'])]),
  previews:sorted(project.previews).map(([id,preview])=>[id,select(preview,['id','kind'])]),
  startRoomId:project.settings.startRoomId,
  initialInventory:project.settings.initialInventory,
  terminalRooms:project.settings.terminalRooms,
  notes:list(project.noteKinds).map(note=>select(note,['id','units','rest','subdivisions'])),
 };
}
function sceneShape(scene){
 if(!record(scene))return null;
 return structural({image:scene.image,layoutRevision:scene.layoutRevision,layoutKind:scene.layoutKind,actors:scene.actors,occluders:scene.occluders,geometry:scene.geometry,objects:scene.objects});
}
function stockGraph({previous=false}={}){
 const rooms=Object.fromEntries(Object.entries(CHAPTER_ROOMS).filter(([id])=>!previous||!ids.has(id)));
 const doors=Object.fromEntries(Object.entries(CHAPTER_DOORS).filter(([id])=>!previous||!gateIds.has(id)));
 const terminals={...CHAPTER_TERMINALS};
 if(previous)for(const id of ids)terminals[id]={id,kind:'dead-end'};
 return graph({rooms,doors,sources:CHAPTER_SOURCES,terminals,previews:{},settings:{startRoomId:'depot',initialInventory:Object.fromEntries(NOTE_KINDS.map(note=>[note.id,0])),terminalRooms:true},noteKinds:NOTE_KINDS.map(note=>({...note,subdivisions:['eighth-pair','sixteenth-pair'].includes(note.id)?2:note.id==='sixteenth-group'?4:1}))});
}
function formerScene(id){
 const scene=clone(CAMPAIGN_SCENES[id]),gateId=REPLAY_RISK_DETOURS[id];
 if(!scene?.objects?.some(item=>item.id===gateId)||!scene.geometry?.targets?.some(item=>item.id===gateId))return null;
 scene.objects=scene.objects.filter(item=>item.id!==gateId&&item.id!=='return-previous');
 scene.objects.push({id:'return-previous',type:'return',label:'Revisit this choice',rect:{x:680,y:920,width:176,height:90},actionLabel:'Revisit this choice'});
 scene.geometry.targets=scene.geometry.targets.filter(item=>item.id!==gateId&&item.id!=='return-previous');
 scene.geometry.targets.push({id:'return-previous',type:'return',label:'Revisit this choice',x:768,y:960,approach:{x:768,y:910},range:85});
 return scene;
}

/** Explicit policies and custom puzzles/layouts keep their authored behavior. */
export function upgradeReplayRiskProject(project){
 const result=clone(project);
 if(!record(result?.settings)||Object.hasOwn(result.settings,'replayRisk'))return result;
 if(!Object.entries(REPLAY_RISK_DETOURS).every(([id,gateId])=>CHAPTER_ROOMS[id]&&CHAPTER_DOORS[gateId]))return result;
 const shape=graph(project);
 if(same(shape,stockGraph())&&Object.keys(REPLAY_RISK_DETOURS).every(id=>same(sceneShape(project.scenes?.[id]),sceneShape(CAMPAIGN_SCENES[id])))){
  result.settings.replayRisk=true;return result;
 }
 if(!same(shape,stockGraph({previous:true})))return result;
 for(const id of ids)if(!same(sceneShape(project.scenes?.[id]),sceneShape(formerScene(id))))return result;
 for(const [id,gateId]of Object.entries(REPLAY_RISK_DETOURS)){
  const {kind,...former}=result.terminals[id];
  result.rooms[id]={...clone(CHAPTER_ROOMS[id]),...former,sources:[],doors:[gateId]};
  delete result.terminals[id];
  result.doors[gateId]=clone(CHAPTER_DOORS[gateId]);
  const scene=result.scenes[id],current=CAMPAIGN_SCENES[id];scene.kind='room';
  const door=current.objects.find(item=>item.id===gateId),target=current.geometry.targets.find(item=>item.id===gateId);
  scene.objects=scene.objects.map(item=>item.id==='return-previous'?{...item,...clone(door)}:item);
  scene.geometry.targets=scene.geometry.targets.map(item=>item.id==='return-previous'?{...item,...clone(target)}:item);
  const content=result.content?.[id];
  if(record(content))content.doorCopy={...content.doorCopy,[gateId]:clone(CAMPAIGN_CONTENT[id].doorCopy[gateId])};
 }
 result.settings.replayRisk=true;
 return result;
}
