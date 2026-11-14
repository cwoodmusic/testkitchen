import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomLayoutModel} from './room-layout-model.mjs';
import {configureUrbanInteriors,getInteriorBase,residents} from './urban-interiors.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';
import {interiorWallNetworkGeometry} from './interior-wall-art.mjs';
import {furniturePresentationScale} from './private-furniture.mjs';

const catalog=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(asset=>[asset.id,asset]));
configureUrbanInteriors(catalog);
const modelFor=resident=>{const scene=getInteriorBase({kind:'apartment',resident});return {scene,model:createRoomLayoutModel({themeId:resident,scene,catalog})};};

// Independently walk actual inflated collision geometry. No editor placement
// or clearance helper supplies the expected accessibility result.
function reachable(scene){
 const radius=6,step=4,cols=Math.ceil(scene.width/step),rows=Math.ceil(scene.height/step),solids=scene.solids.map(box=>({x:box.x-radius,y:box.y-radius,w:box.w+radius*2,h:box.h+radius*2}));
 const clear=p=>p.x>=40&&p.y>=112&&p.x<=scene.width-40&&p.y<=scene.height-40&&!solids.some(b=>p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h);
 const at=index=>({x:(index%cols)*step+2,y:Math.floor(index/cols)*step+2});
 const segment=(a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)));for(let i=0;i<=n;i++)if(!clear({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;return true;};
 const blocked=new Uint8Array(cols*rows),seen=new Uint8Array(cols*rows),queue=new Int32Array(cols*rows);
 for(let i=0;i<blocked.length;i++)blocked[i]=clear(at(i))?0:1;
 const sx=Math.floor(scene.spawn.x/step),sy=Math.floor(scene.spawn.y/step);let tail=0;
 for(let y=sy-1;y<=sy+1;y++)for(let x=sx-1;x<=sx+1;x++){const i=y*cols+x;if(x>=0&&y>=0&&x<cols&&y<rows&&!blocked[i]&&!seen[i]&&segment(scene.spawn,at(i))){seen[i]=1;queue[tail++]=i;}}
 for(let head=0;head<tail;head++){const i=queue[head],x=i%cols,y=Math.floor(i/cols);for(const [X,Y]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const j=Y*cols+X;if(X>=0&&Y>=0&&X<cols&&Y<rows&&!seen[j]&&!blocked[j]){seen[j]=1;queue[tail++]=j;}}}
 return target=>{const x=Math.floor(target.x/step),y=Math.floor(target.y/step);for(let Y=y-1;Y<=y+1;Y++)for(let X=x-1;X<=x+1;X++){const i=Y*cols+X;if(X>=0&&Y>=0&&X<cols&&Y<rows&&seen[i]&&segment(at(i),target))return true;}return false;};
}

test('native furniture can occupy the old resident transit strip while the real destinations remain reachable',()=>{
 for(const [resident,x]of [['bach',900],['mozart',284]]){
  const {scene,model}=modelFor(resident),before=JSON.stringify(scene),saved=model.record();
  const result=model.add('collection-'+resident+'-dining-chair',{x,y:428});
  assert.equal(result.ok,true,resident+': an old NPC transit leg is ordinary floor, not a doorway');
  assert.equal(model.place().ok,true,resident+': a walkable detour is available');
  const reaches=reachable(model.scene),actor=model.scene.actors.find(actor=>actor.id===resident);
  assert(reaches(actor),resident+': the resident can still reach home');
  for(const door of model.scene.privacyDoors)assert(reaches({x:door.x+door.length/2,y:door.y}),resident+': the actual '+door.id+' opening is reachable');
  const restored=createRoomLayoutModel({themeId:resident,scene,catalog,record:model.record()});
  assert.deepEqual(restored.record(),model.record());assert.equal(JSON.stringify(scene),before);
  model.undo();assert.deepEqual(model.record(),saved);model.redo();assert.deepEqual(model.record(),restored.record());
 }
});

test('a native floor lamp can stand outside the real door slab instead of an invisible sixty-pixel halo',()=>{
 const {scene,model}=modelFor('bach'),door=scene.privacyDoors.find(door=>door.roomId==='bedroom'),opening=interiorWallNetworkGeometry(scene).apertures.find(aperture=>aperture.x===door.x);
 assert.deepEqual(opening,{x:258,y:326,w:36,h:16});
 assert.equal(model.add('collection-bach-table-lamp',{x:254,y:359}).ok,true);
 assert(model.held.boxes.every(box=>box.y>opening.y+opening.h+6),'The actual feet are beyond the aperture and avatar radius');
 assert.equal(model.place().ok,true);
 assert(reachable(model.scene)({x:door.x+door.length/2,y:door.y}),'The real opening remains accessible');
});

test('real walls, the actual privacy opening, actor and spawn positions still reject furniture atomically',()=>{
 for(const [position,error]of [[{x:372,y:250},/wall/],[{x:276,y:340},/doorways/],[{x:756,y:420},/doorways/],[{x:1092,y:428},/doorways/]]){
  const {model}=modelFor('bach'),before=JSON.stringify(model.record()),result=model.add('collection-bach-dining-chair',position);
  assert.equal(result.ok,false,JSON.stringify(position));assert.match(result.error,error);assert.equal(model.place().ok,false);assert.equal(JSON.stringify(model.record()),before);assert.equal(model.canUndo,false);
 }
});

test('standing points use the actual six-pixel body instead of obsolete full-size padding, including exact-touch rejection',()=>{
 const walls=[{x:0,y:0,w:600,h:106},{x:0,y:0,w:28,h:500},{x:572,y:0,w:28,h:500},{x:0,y:472,w:600,h:28}];
 const probes=[
  ['actor-clear',{x:124,y:246},true],['actor-touch',{x:118,y:246},false],
  ['spawn-clear',{x:324,y:446},true],['spawn-touch',{x:318,y:446},false],
  ['portal-clear',{x:300,y:440},true],['portal-touch',{x:300,y:443.5},false]
 ];
 for(const [kind,position,allowed]of probes){
  const scene={id:'standing-fixture',kind:'apartment',resident:'fixture',width:600,height:500,spawn:kind.startsWith('portal')?{x:400,y:400}:{x:300,y:430},actors:[{id:'resident',x:100,y:230}],walls,privacyDoors:[],items:[],solids:walls,rooms:[],windows:[],...(kind.startsWith('portal')?{portalExit:{threshold:{x:300,y:472},enterNormal:{x:0,y:-1},triggerHalfWidth:18}}:{})},model=createRoomLayoutModel({themeId:'standing-fixture',scene,catalog}),raw=JSON.stringify(model.record());
  const result=model.add('collection-bach-dining-chair',position);assert.equal(result.ok,allowed,kind);
  if(!allowed){assert.match(result.error,/doorways|arrival/);assert.equal(model.place().ok,false);assert.equal(JSON.stringify(model.record()),raw);continue;}
  assert.equal(model.place().ok,true,kind);const reaches=reachable(model.scene);
  for(const point of [scene.spawn,...scene.actors,...(scene.portalExit?[{x:300,y:448}]:[])])assert(reaches(point),kind+': the exact standing centre is collision-free and reachable');
 }
});

test('removing transit strips does not allow a furniture barrier to cut off the real door route',()=>{
 const barrier={id:'barrier',w:544,h:12,boxes:[{x:0,y:0,w:544,h:12}],solid:true,purpose:'counter'},art=new Map([[barrier.id,barrier]]),walls=[{x:0,y:0,w:600,h:106},{x:0,y:0,w:28,h:500},{x:572,y:0,w:28,h:500},{x:0,y:472,w:600,h:28},{x:290,y:106,w:16,h:54},{x:290,y:196,w:16,h:70}],scene={id:'route-fixture',kind:'apartment',resident:'fixture',width:600,height:500,spawn:{x:300,y:430},actors:[{id:'resident',x:100,y:230}],walls,privacyDoors:[{id:'bath',axis:'vertical',roomId:'bath',x:298,y:160,length:36,wallThickness:16}],items:[],solids:walls,rooms:[],windows:[]};
 const model=createRoomLayoutModel({themeId:'route-fixture',scene,catalog:art}),raw=JSON.stringify(model.record());
 const scale=1/furniturePresentationScale({asset:'barrier'},scene,barrier);
 assert.equal(model.add({asset:'barrier',scale},{x:300,y:390}).ok,true,'The wall-sized base is outside every door slab and standing point');
 assert.deepEqual(model.held.boxes,[{x:28,y:378,w:544,h:12}]);
 const result=model.place();assert.equal(result.ok,false);assert.match(result.error,/walkable route/);assert.equal(JSON.stringify(model.record()),raw);assert.equal(model.canUndo,false);
});

test('all thirty-one room templates retain physical wall ownership and a walkable real privacy opening',()=>{
 configureUrbanInteriors(catalog);
 const requests=[...residents.map(resident=>({kind:'apartment',resident:resident.id})),{kind:'apartment',resident:'player'},...SHOWROOMS.map(room=>({kind:'showroom',showroomId:room.id}))];
 assert.equal(requests.length,31);
 for(const request of requests){
  const scene=getInteriorBase(request),bases=new Set(scene.items.flatMap(item=>item.collisionBoxes||[])),structural=scene.solids.filter(box=>!bases.has(box));
  assert.equal(structural.length,scene.walls.length+4,scene.id+': only the actual partitions and outer shell are structural walls');
  const reaches=reachable(scene);
  for(const door of scene.privacyDoors)assert(reaches(door.axis==='vertical'?{x:door.x,y:door.y+door.length/2}:{x:door.x+door.length/2,y:door.y}),scene.id+': '+door.id+' remains walkable');
 }
});
