import test from 'node:test';
import assert from 'node:assert/strict';
import {blank,blocked,height} from './model.mjs';
import {movePlayer} from './physics.mjs';
import {createPlayerCollisionIndex,PLAYER_COLLISION_BIN,PLAYER_COLLISION_MARGIN} from './player-collision-index.mjs';

const catalog=new Map([
 ['box',{w:180,h:240,boxes:[{x:30,y:190,w:120,h:40}]}],
 ['polygon',{w:250,h:180,polygons:[[[20,65],[210,80],[180,160],[40,150]]],boxes:[]}],
 ['plant',{w:192,h:160,boxes:[{x:0,y:64,w:192,h:96}],npcAvoid:true}],
 ['empty',{w:2000,h:3000,boxes:[]}]
]);
const object=(asset,x,y,extra={})=>({id:asset+'-'+x,asset,x,y,scale:1,rotation:0,collision:true,layer:'objects',...extra});
function compare(doc,index,p,points=[p]){const view=index.view(p);assert.strictEqual(view.cells,doc.cells);for(const q of points)assert.equal(blocked(view,q.x,q.y,catalog,q.from),blocked(doc,q.x,q.y,catalog,q.from),`collision mismatch at ${q.x},${q.y}`);return view;}

test('native box and polygon collision is identical at every cardinal rotation and authored scale',()=>{
 for(const asset of ['box','polygon'])for(const rotation of [0,90,180,270])for(const scale of [.25,.5,1,2,3]){
  const doc=blank();doc.objects.push(object(asset,2048,2048,{rotation,scale}));
  const index=createPlayerCollisionIndex({getProject:()=>doc,catalog,getRevision:()=>0});
  for(let y=1250;y<2850;y+=43)for(let x=1250;x<2850;x+=43)compare(doc,index,{x,y});
  const a=catalog.get(asset),local=asset==='box'?{x:90,y:210}:{x:110,y:110},r=rotation*Math.PI/180,dx=(local.x-a.w/2)*scale,dy=(local.y-a.h)*scale;
  const inside={x:2048+dx*Math.cos(r)-dy*Math.sin(r),y:2048+dx*Math.sin(r)+dy*Math.cos(r)};
  assert.equal(blocked(index.view(inside),inside.x,inside.y,catalog),true,`${asset} ${rotation} ${scale} was omitted`);
 }
});

test('one frame-start view covers maximum running motion at all four bin boundaries',()=>{
 assert.equal(PLAYER_COLLISION_BIN,512);assert.ok(PLAYER_COLLISION_MARGIN>780*.04);
 const doc=blank();doc.objects.push(object('box',2068,2100,{scale:.5}));doc.edges['v:32:31']={style:'iron',gate:false,open:false};
 const index=createPlayerCollisionIndex({getProject:()=>doc,catalog,getRevision:()=>0});
 for(const p of [{x:2047.9,y:2047.9},{x:2048.1,y:2047.9},{x:2047.9,y:2048.1},{x:2048.1,y:2048.1}]){
  const points=[];for(let y=-32;y<=32;y+=4)for(let x=-32;x<=32;x+=4)points.push({x:p.x+x,y:p.y+y});compare(doc,index,p,points);
 }
});

test('water, dry bridge decks, cliff height and stair heights keep the real original cells',()=>{
 const doc=blank();doc.cells['8,8']={surface:'water',level:0};doc.cells['9,8']={surface:'water',level:0,bridge:'ew'};
 doc.cells['10,8']={surface:'grass',level:3};doc.cells['11,8']={surface:'wood',level:0,stairs:'east',stairBase:0,stairRise:3,stairStart:0,stairEnd:1};
 const index=createPlayerCollisionIndex({getProject:()=>doc,catalog,getRevision:()=>0}),p={x:544,y:544};
 compare(doc,index,p,[{x:544,y:544},{x:608,y:544},{x:672,y:544,from:{x:638,y:544}},{x:711,y:544,from:{x:709,y:544}}]);
 const v=index.view(p);assert.equal(height(v,710,544),height(doc,710,544));
 doc.cells={'8,8':{surface:'grass',level:0}};
 assert.strictEqual(v.cells,doc.cells);assert.equal(blocked(v,544,544,catalog),false,'live cell-table replacement became stale');
});

test('gates keep original live references through open/close and offset Music Square segments',()=>{
 const doc=blank();doc.edges['h:8:8']={style:'iron',gate:true,open:false};doc.edges['w:700.5:520.25:0:64']={style:'music-square',gate:false,open:false};
 const index=createPlayerCollisionIndex({getProject:()=>doc,catalog,getRevision:()=>0}),p={x:544,y:512};
 const view=compare(doc,index,p,[p,{x:704,y:540}]);assert.strictEqual(view.edges['h:8:8'],doc.edges['h:8:8']);
 assert.equal(blocked(view,544,512,catalog),true);doc.edges['h:8:8'].open=true;
 assert.equal(blocked(index.view(p),544,512,catalog),false);doc.edges['h:8:8'].open=false;
 assert.equal(blocked(index.view(p),544,512,catalog),true);assert.equal(index.stats.builds,1);
});

test('explicit player collision flags and mounted decorations stay unchanged without NPC policy or radius',()=>{
 const doc=blank();doc.objects.push(object('plant',544,256,{collision:false}),object('box',900,256,{mount:{x:14,y:4,u:.5,v:.5}}),object('empty',544,400));
 const index=createPlayerCollisionIndex({getProject:()=>doc,catalog,getRevision:()=>0}),view=index.view({x:544,y:224});
 assert.equal(blocked(view,544,224,catalog),false);assert.equal(blocked(view,900,224,catalog),false);
 assert.equal(view.objects.length,0);assert.equal(view[Symbol.for('coda.town.collisionRadius')],undefined);assert.equal(doc.objects[0].collision,false);
});

test('indexing follows physical feet instead of a giant painted sprite rectangle',()=>{
 const local=new Map([['giant',{w:10000,h:10000,boxes:[{x:4900,y:9900,w:200,h:80}]}]]),doc=blank();
 doc.objects.push(object('giant',8000,11000));
 const index=createPlayerCollisionIndex({getProject:()=>doc,catalog:local,getRevision:()=>0});
 assert.equal(index.view({x:4000,y:6000}).objects.length,0);
 assert.strictEqual(index.view({x:8000,y:10950}).objects[0],doc.objects[0]);
 assert.equal(index.stats.large,0);assert.ok(index.stats.references<10);
});

test('authoritative revisions, object/edge identities, project replacement and explicit invalidation refresh candidates',()=>{
 let doc=blank(),revision=0;doc.objects.push(object('box',544,256));
 const index=createPlayerCollisionIndex({getProject:()=>doc,catalog,getRevision:()=>revision}),p={x:544,y:224};
 compare(doc,index,p);doc.objects[0].x=9000;revision++;assert.equal(index.view(p).objects.length,0);
 doc.objects=[object('box',544,256)];compare(doc,index,p);assert.equal(index.stats.builds,3);
 doc.edges={'h:8:3':{style:'wood',gate:false,open:false}};compare(doc,index,p);assert.equal(index.stats.builds,4);
 doc=structuredClone(doc);compare(doc,index,p);assert.equal(index.stats.builds,5);
 index.invalidate();compare(doc,index,p);assert.equal(index.stats.builds,6);
});

test('without a revision direct object edits, native geometry changes, gates, deletions and undo are detected',()=>{
 let doc=blank();const a={w:180,h:240,boxes:[{x:30,y:190,w:120,h:40}],polygons:[]},local=new Map([['box',a]]);
 doc.objects.push(object('box',544,256));const index=createPlayerCollisionIndex({getProject:()=>doc,catalog:local}),p={x:544,y:224};
 const verify=()=>{const v=index.view(p);for(let y=150;y<350;y+=17)for(let x=350;x<800;x+=17)assert.equal(blocked(v,x,y,local),blocked(doc,x,y,local));};
 verify();
 for(const change of [()=>doc.objects[0].x=700,()=>doc.objects[0].rotation=90,()=>doc.objects[0].scale=2,()=>doc.objects[0].collision=false,()=>doc.objects[0].collision=true,()=>doc.objects[0].mount={},()=>delete doc.objects[0].mount,()=>a.boxes[0].w=170,()=>a.polygons.push([[0,0],[60,0],[30,100]]),()=>a.polygons[0][0][0]=20,()=>doc.edges['w:500:180:64:0']={style:'iron',gate:true,open:false},()=>doc.edges['w:500:180:64:0'].open=true,()=>delete doc.edges['w:500:180:64:0'],()=>doc.objects.splice(0,1),()=>doc=structuredClone(doc)]){
  const before=index.stats.builds;change();verify();assert.ok(index.stats.builds>before,'direct geometry edit was not detected');
 }
});

test('the optimized and full physics take exactly the same sustained walking and running steps',()=>{
 const doc=blank();doc.objects.push(object('box',620,500));doc.edges['v:12:6']={style:'iron',gate:true,open:false};
 doc.cells['7,7']={surface:'wood',level:0,stairs:'east',stairBase:0,stairRise:1,stairStart:0,stairEnd:1};
 const full={x:420,y:480},fast={...full},index=createPlayerCollisionIndex({getProject:()=>doc,catalog,getRevision:()=>0});
 for(let frame=0;frame<300;frame++){
  const keys=new Set(frame<100?['d']:frame<180?['s','d','shift']:['a','shift']);
  const expected=movePlayer(doc,full,keys,.04,catalog),actual=movePlayer(index.view(fast),fast,keys,.04,catalog);
  assert.deepEqual(actual,expected);assert.deepEqual(fast,full);
 }
});

test('500+ placed objects and edges leave a small local working set with bounded reusable views',()=>{
 const doc=blank();for(let i=0;i<600;i++){const x=(i%30)*512+250,y=Math.floor(i/30)*512+300;doc.objects.push(object('box',x,y));doc.edges[`h:${Math.floor(x/64)}:${Math.floor(y/64)}`]={style:'wood',gate:false,open:false};}
 const index=createPlayerCollisionIndex({getProject:()=>doc,catalog,getRevision:()=>0,maxViews:4});
 for(let i=0;i<100;i++){const p={x:(i%30)*512+256,y:Math.floor(i/30)*512+256},v=index.view(p);assert.ok(v.objects.length<15);assert.ok(Object.keys(v.edges).length<15);assert.ok(index.stats.views<=4);}
 assert.equal(index.stats.sourceObjects,600);assert.equal(index.stats.sourceEdges,600);assert.equal(index.stats.builds,1);assert.equal(index.stats.geometryScans,0);assert.ok(index.stats.bins<=32*24);
 const p={x:1000,y:1000};index.view(p);const builds=index.stats.viewBuilds;index.view(p);assert.equal(index.stats.viewBuilds,builds);assert.ok(index.stats.hits>0);
});

test('very large physical objects avoid multiplying every placement into every world bin',()=>{
 const doc=blank(),local=new Map([['whole',{w:30000,h:30000,boxes:[{x:0,y:0,w:30000,h:30000}]}]]);
 for(let i=0;i<100;i++)doc.objects.push(object('whole',8000,12000));
 const index=createPlayerCollisionIndex({getProject:()=>doc,catalog:local,getRevision:()=>0});
 assert.equal(index.view({x:1000,y:1000}).objects.length,100);assert.equal(index.stats.large,100);assert.equal(index.stats.references,100);
});

test('warm authoritative frame views do not rescan placement geometry or source edges',()=>{
 let reads=0,edgeScans=0;const doc=blank(),o=object('box',544,256);Object.defineProperty(o,'x',{get(){reads++;return 544;},enumerable:true});doc.objects.push(o);
 doc.edges=new Proxy({'h:8:3':{style:'wood',gate:false,open:false}},{ownKeys(target){edgeScans++;return Reflect.ownKeys(target);}});
 const index=createPlayerCollisionIndex({getProject:()=>doc,catalog,getRevision:()=>0});index.view({x:544,y:224});reads=0;edgeScans=0;
 for(let i=0;i<100;i++)index.view({x:544+i*.1,y:224});assert.equal(reads,0);assert.equal(edgeScans,0);assert.equal(index.stats.builds,1);
});

test('views work with frozen documents and never modify authored placements or serialization',()=>{
 const doc=blank();doc.objects.push(Object.freeze(object('box',544,256)));Object.freeze(doc.objects);Object.freeze(doc.edges);Object.freeze(doc.cells);Object.freeze(doc);
 const before=JSON.stringify(doc),index=createPlayerCollisionIndex({getProject:()=>doc,catalog,getRevision:()=>0}),view=index.view({x:544,y:224});
 assert.strictEqual(view.objects[0],doc.objects[0]);assert.strictEqual(Object.getPrototypeOf(view),doc);assert.equal(JSON.stringify(doc),before);
 assert.equal(index.view(null),doc);assert.equal(createPlayerCollisionIndex({getProject:()=>null,catalog}).view({x:0,y:0}),null);
});
