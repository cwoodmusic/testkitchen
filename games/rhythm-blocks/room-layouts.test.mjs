import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {CAMPAIGN_SCENES} from './campaign-scenes.mjs';
import {SCENES} from './scenes.mjs';
import {CAMPAIGN_PLAN} from './campaign-data.mjs';
import {ROOM_CUTSCENES} from './cutscene-content.mjs';
import {createDefaultProject,validateProject,normalizeProject} from './developer-project.mjs';
import {createRoomWalker,isWalkable,findPath} from './room.mjs';
import {ROOM_LAYOUTS,ROOM_LAYOUT_REVISION} from './room-layout-config.mjs';
import {PREVIOUS_ROOM_LAYOUT_SCENES,PREVIOUS_ROOM_LAYOUT_PHYSICAL_CLIPS,VARIED_ROOM_IDS,upgradeStockRoomLayouts} from './room-layouts.mjs';

const clone=value=>structuredClone(value);
const jsonClone=value=>JSON.parse(JSON.stringify(value));
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
function previousProject(){
 const project=clone(createDefaultProject());
 for(const id of VARIED_ROOM_IDS){
  project.scenes[id]=clone(PREVIOUS_ROOM_LAYOUT_SCENES[id]);
  const physical=new Map(PREVIOUS_ROOM_LAYOUT_PHYSICAL_CLIPS[id].map(clip=>[clip.id,clip]));
  project.content[id].cutscene=project.content[id].cutscene.map(clip=>clip.kind==='dialogue'?clip:clone(physical.get(clip.id)));
 }
 return project;
}
function walk(room,destination){
 const walker=createRoomWalker({room});assert(walker.goTo(destination));let frames=0;
 while(walker.state.moving&&frames++<1000){walker.update(50);assert(isWalkable(room,walker.state));}
 assert(frames<1000);assert(Math.hypot(walker.state.x-destination.x,walker.state.y-destination.y)<.001);
}

test('six selected rooms have distinct fitted floorplans while the four established introductions remain exact',()=>{
 assert.equal(VARIED_ROOM_IDS.length,6);assert.equal(new Set(VARIED_ROOM_IDS.map(id=>ROOM_LAYOUTS[id].kind)).size,6);
 for(const id of VARIED_ROOM_IDS){
  const scene=CAMPAIGN_SCENES[id];assert.equal(scene.image,`assets/rooms/${id}-layout.webp`);assert(existsSync(new URL(scene.image,import.meta.url)));
  assert.equal(scene.layoutRevision,ROOM_LAYOUT_REVISION);assert.equal(scene.layoutKind,ROOM_LAYOUTS[id].kind);
  assert.equal(scene.geometry.width,1536);assert.equal(scene.geometry.height,1024);assert.deepEqual(scene.geometry.start,{x:768,y:920,facing:'up'});
  assert(Object.isFrozen(scene));assert(Object.isFrozen(scene.geometry.obstacles));
  assert(isWalkable(scene.geometry,scene.geometry.start));
 }
 for(const [id,scene]of Object.entries(SCENES))assert.equal(CAMPAIGN_SCENES[id],scene);
});

test('new architecture blocks its pictured footprint but preserves intentional loops, crossings and alcoves',()=>{
 const probes={
  'garden-fork':{blocked:[[768,590]],floor:[[500,590],[1020,590],[768,760]]},
  'workshop-fork':{blocked:[[600,490],[950,650]],floor:[[700,600],[850,560],[1220,560]]},
  'canal-fork':{blocked:[[350,570],[790,570],[1220,570]],floor:[[540,570],[1030,570],[190,570],[1360,570]]},
  'garden-alcove':{blocked:[[1300,450]],floor:[[960,450],[1160,660],[1330,650]]},
  'workshop-alcove':{blocked:[[300,430],[1250,430]],floor:[[768,430],[800,620],[1000,630]]},
  'canal-final':{blocked:[[350,780],[1250,780]],floor:[[768,800],[700,500],[1100,390]]},
 };
 for(const [id,{blocked,floor}]of Object.entries(probes)){
  const room=CAMPAIGN_SCENES[id].geometry;
  for(const [x,y]of blocked)assert.equal(isWalkable(room,{x,y}),false,`${id} blocks ${x},${y}`);
  for(const [x,y]of floor){assert(isWalkable(room,{x,y}),`${id} opens ${x},${y}`);walk(room,{x,y});}
 }
 const garden=CAMPAIGN_SCENES['garden-fork'].geometry;
 const around=findPath(garden,garden.start,{x:768,y:400});assert(around.some(point=>point.x<564||point.x>972),'The central planter creates a real detour.');
 const workshop=CAMPAIGN_SCENES['workshop-fork'].geometry,door=workshop.targets.find(target=>target.type==='door').approach;
 assert(findPath(workshop,workshop.start,door).some(point=>point.x<378||point.x>813),'Staggered workbays alter the route to the doors.');
});

test('new floorplans preserve every gate, pickup binding and exact graph transaction',()=>{
 const plan=clone(CAMPAIGN_PLAN);
 for(const id of VARIED_ROOM_IDS){
  const before=PREVIOUS_ROOM_LAYOUT_SCENES[id],after=CAMPAIGN_SCENES[id];
  assert.deepEqual(after.objects.filter(object=>object.type==='door').map(({id,doorId,revealAfter})=>({id,doorId,revealAfter})),before.objects.filter(object=>object.type==='door').map(({id,doorId,revealAfter})=>({id,doorId,revealAfter})));
  assert.deepEqual(after.objects.filter(object=>object.sourceId).map(({id,sourceId})=>({id,sourceId})),before.objects.filter(object=>object.sourceId).map(({id,sourceId})=>({id,sourceId})));
  for(const target of after.geometry.targets){assert(isWalkable(after.geometry,target.approach),`${id}/${target.id}`);assert(findPath(after.geometry,after.geometry.start,target.approach),`${id}/${target.id}`);}
 }
 assert.deepEqual(CAMPAIGN_PLAN,plan);
});

test('unchanged published scenes upgrade with matching physical tracks while edited speech and resources remain exact',()=>{
 const project=previousProject();
 for(const id of VARIED_ROOM_IDS){
  const line=project.content[id].cutscene.find(clip=>clip.kind==='dialogue');line.text=`An authored observation in ${id}.`;line.startTile=123;line.durationTiles=77;line.authorMemo={keep:['exact',id]};
 }
 const before=clone(project),upgraded=upgradeStockRoomLayouts(freeze(project));
 assert.deepEqual(project,before,'Upgrading never mutates its caller.');
 for(const id of VARIED_ROOM_IDS){
  assert.deepEqual(upgraded.scenes[id],jsonClone(CAMPAIGN_SCENES[id]));
  assert.deepEqual(upgraded.content[id].cutscene.filter(clip=>clip.kind!=='dialogue'),jsonClone(ROOM_CUTSCENES[id].filter(clip=>clip.kind!=='dialogue')));
  assert.deepEqual(upgraded.content[id].cutscene.filter(clip=>clip.kind==='dialogue'),before.content[id].cutscene.filter(clip=>clip.kind==='dialogue'));
 }
 for(const field of ['rooms','previews','terminals','sources','doors','noteKinds','settings','player','cast'])assert.deepEqual(upgraded[field],before[field],field);
 const validation=validateProject(upgraded);assert(validation.valid,validation.errors.join('\n'));
 assert.deepEqual(upgradeStockRoomLayouts(upgraded),upgraded,'The layout upgrade is idempotent.');
});

test('custom art, geometry, actors, hit regions, masks or physical choreography opt a room out of migration',()=>{
 const edits=[
  (project,id)=>{project.scenes[id].image='data:image/png;base64,custom';},
  (project,id)=>{project.scenes[id].geometry.obstacles.push({id:'author-wall',x:600,y:760,width:40,height:40});},
  (project,id)=>{project.scenes[id].actors[0].feet.x++;},
  (project,id)=>{project.scenes[id].objects[0].rect.x++;},
  (project,id)=>{project.scenes[id].occluders[0].depth++;},
  (project,id)=>{project.content[id].cutscene.find(clip=>clip.kind==='walk').destination={x:700,y:800};},
  (project,id)=>{project.content[id].cutscene.find(clip=>clip.kind==='walk').durationTiles++;},
  (project,id)=>{project.content[id].cutscene.find(clip=>clip.kind==='gesture').startTile++;},
  (project,id)=>{project.content[id].cutscene.find(clip=>clip.kind==='emote').authorMemo='custom cue';},
  (project,id)=>{project.content[id].cutscene=[];},
 ];
 for(const id of VARIED_ROOM_IDS)for(const edit of edits){
  const project=previousProject();edit(project,id);const before=clone(project),upgraded=upgradeStockRoomLayouts(project);
  assert.deepEqual(upgraded.scenes[id],before.scenes[id],id);assert.deepEqual(upgraded.content[id].cutscene,before.content[id].cutscene,id);assert.deepEqual(project,before);
  const other=VARIED_ROOM_IDS.find(room=>room!==id);assert.equal(upgraded.scenes[other].layoutRevision,ROOM_LAYOUT_REVISION,'One authored room does not suppress unrelated stock upgrades.');
 }
});

test('older stock projects with no cutscene field upgrade before new matching introduction tracks are supplied',()=>{
 const project=previousProject();for(const id of VARIED_ROOM_IDS)delete project.content[id].cutscene;
 const upgraded=upgradeStockRoomLayouts(project);
 for(const id of VARIED_ROOM_IDS){assert.equal(upgraded.scenes[id].layoutRevision,ROOM_LAYOUT_REVISION);assert.equal(Object.hasOwn(upgraded.content[id],'cutscene'),false);}
 const normalized=normalizeProject(project);
 for(const id of VARIED_ROOM_IDS){assert.equal(normalized.scenes[id].layoutRevision,ROOM_LAYOUT_REVISION);assert.deepEqual(normalized.content[id].cutscene,jsonClone(ROOM_CUTSCENES[id]));}
 const explicit=previousProject();explicit.content['garden-fork'].cutscene=null;
 assert.deepEqual(upgradeStockRoomLayouts(explicit).scenes['garden-fork'],PREVIOUS_ROOM_LAYOUT_SCENES['garden-fork']);
});
