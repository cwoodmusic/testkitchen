/** Add the final chapter only to a recognizable, safely bound stock project. */
import {COMPLETE_ROUTE_ENTRY,FINAL_OUTCOME_ID} from './final-route.mjs';

export const COMPLETE_ROUTE_ROOMS=Object.freeze(['final-concourse','final-heart']);
export const COMPLETE_ROUTE_LOCATIONS=Object.freeze([...COMPLETE_ROUTE_ROOMS,FINAL_OUTCOME_ID]);
export const COMPLETE_ROUTE_DOORS=Object.freeze([COMPLETE_ROUTE_ENTRY,'concourse-heart','heart-complete']);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const own=(value,key)=>record(value)&&Object.hasOwn(value,key);
const clone=value=>structuredClone(value);
const comparable=value=>Array.isArray(value)?value.map(comparable):record(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,comparable(value[key])])):value;
const same=(left,right)=>JSON.stringify(comparable(left))===JSON.stringify(comparable(right));
const select=(value,fields)=>record(value)?Object.fromEntries(fields.filter(field=>Object.hasOwn(value,field)).map(field=>[field,value[field]])):value;
const entries=(value,fields)=>Object.entries(value??{}).sort(([left],[right])=>left.localeCompare(right)).map(([id,item])=>[id,select(item,fields)]);

/** The earlier campaign remains the baseline for its own migrations. */
export function withoutCompleteRoute(value){
 const project=clone(value);
 for(const key of ['rooms','terminals','content','scenes'])if(record(project?.[key]))for(const id of COMPLETE_ROUTE_LOCATIONS)delete project[key][id];
 if(record(project?.doors))for(const id of COMPLETE_ROUTE_DOORS)delete project.doors[id];
 if(Array.isArray(project?.rooms?.depot?.doors))project.rooms.depot.doors=project.rooms.depot.doors.filter(id=>id!==COMPLETE_ROUTE_ENTRY);
 if(record(project?.content?.depot?.doorCopy))delete project.content.depot.doorCopy[COMPLETE_ROUTE_ENTRY];
 if(Array.isArray(project?.scenes?.depot?.objects))project.scenes.depot.objects=project.scenes.depot.objects.filter(item=>item.id!==COMPLETE_ROUTE_ENTRY);
 if(Array.isArray(project?.scenes?.depot?.geometry?.targets))project.scenes.depot.geometry.targets=project.scenes.depot.geometry.targets.filter(item=>item.id!==COMPLETE_ROUTE_ENTRY);
 if(record(project?.settings))delete project.settings.completeRoute;
 return project;
}

function graph(project){
 if(!['rooms','doors','sources','terminals','previews','settings'].every(key=>record(project?.[key]))||!Array.isArray(project.noteKinds))return null;
 return {
  rooms:entries(project.rooms,['id','sources','doors']),
  doors:entries(project.doors,['id','canonicalId','from','to','recipe','revealAfter','requiresProgress']),
  sources:entries(project.sources,['id','type','roomId','recipe','character']),
  terminals:entries(project.terminals,['id','kind']),previews:entries(project.previews,['id','kind']),
  settings:select(project.settings,['startRoomId','initialInventory','terminalRooms','replayRisk']),
  notes:project.noteKinds.map(note=>select(note,['id','units','rest','subdivisions'])),
 };
}
const textKeys=new Set(['title','label','actionLabel','sourceLabel']);
function bindings(value){
 if(Array.isArray(value))return value.map(bindings);
 if(!record(value))return value;
 return Object.fromEntries(Object.entries(value).filter(([key])=>!textKeys.has(key)).map(([key,item])=>[key,bindings(item)]));
}
function depotShape(scene){
 return record(scene)?bindings(select(scene,['image','layoutRevision','layoutKind','actors','occluders','geometry','objects'])):null;
}

/** Preserve all authored prose, clocks, puzzles, positions, and explicit opt-outs. */
export function upgradeCompleteRouteProject(value,defaults){
 const project=clone(value);
 if(!record(project?.settings)||own(project.settings,'completeRoute')||project.settings.replayRisk!==true)return project;
 if(!COMPLETE_ROUTE_LOCATIONS.every(id=>own(defaults?.content,id)&&own(defaults?.scenes,id))||!COMPLETE_ROUTE_ROOMS.every(id=>own(defaults?.rooms,id))||!own(defaults?.terminals,FINAL_OUTCOME_ID)||!COMPLETE_ROUTE_DOORS.every(id=>own(defaults?.doors,id)))return project;
 // A partially authored extension is a deliberate project, not an old stock save.
 if(COMPLETE_ROUTE_LOCATIONS.some(id=>['rooms','terminals','content','scenes'].some(key=>own(project[key],id)))||COMPLETE_ROUTE_DOORS.some(id=>own(project.doors,id)))return project;
 const baseline=withoutCompleteRoute(defaults);
 if(!same(graph(project),graph(baseline))||!same(depotShape(project.scenes?.depot),depotShape(baseline.scenes?.depot)))return project;
 const door=defaults.scenes.depot.objects.find(item=>item.id===COMPLETE_ROUTE_ENTRY),target=defaults.scenes.depot.geometry.targets.find(item=>item.id===COMPLETE_ROUTE_ENTRY);
 if(!door||!target||project.scenes.depot.objects.some(item=>item.id===COMPLETE_ROUTE_ENTRY)||project.scenes.depot.geometry.targets.some(item=>item.id===COMPLETE_ROUTE_ENTRY))return project;
 for(const id of COMPLETE_ROUTE_ROOMS)project.rooms[id]=clone(defaults.rooms[id]);
 project.terminals[FINAL_OUTCOME_ID]=clone(defaults.terminals[FINAL_OUTCOME_ID]);
 for(const id of COMPLETE_ROUTE_LOCATIONS){project.content[id]=clone(defaults.content[id]);project.scenes[id]=clone(defaults.scenes[id]);}
 for(const id of COMPLETE_ROUTE_DOORS)project.doors[id]=clone(defaults.doors[id]);
 project.rooms.depot.doors.push(COMPLETE_ROUTE_ENTRY);
 project.scenes.depot.objects.push(clone(door));project.scenes.depot.geometry.targets.push(clone(target));
 project.content.depot.doorCopy={...project.content.depot.doorCopy,[COMPLETE_ROUTE_ENTRY]:clone(defaults.content.depot.doorCopy[COMPLETE_ROUTE_ENTRY])};
 project.settings.completeRoute=true;
 return project;
}
