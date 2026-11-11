/** Geometry/save baseline for cosmetic room, corridor and doorway work.
 * Run with --root <immutable tree> --output <json>, then compare the final tree
 * using --baseline <json>. --allow-price-changes permits only explicit price
 * increases; all other fields still compare exactly. No browser/storage/map writes.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const args=process.argv.slice(2),option=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];},root=resolve(option('--root',new URL('..',import.meta.url).pathname)),load=name=>import(pathToFileURL(resolve(root,'town/world/'+name+'.mjs')));
const [{getInterior,configureUrbanInteriors,residents,apartmentDecorBounds,apartmentWallDecorBounds},{SHOWROOMS,STORE_TRAFFIC,STORE_VERTICAL_CORE},{APARTMENT_COLLECTION_ASSETS},{APARTMENT_DECOR},{SHOWROOM_FURNITURE},{decorDefinitions},{createRoomStorage,ROOM_KEY},{residentHomePose,interiorJourneyPose,journeyDuration},{createAutomaticDoors,createAutomaticPortalGate}]=await Promise.all(['urban-interiors','showroom-layout','apartment-collection-definitions','apartment-decor-definitions','showroom-furniture-definitions','decor-definitions','urban-room','resident-journey','automatic-doors'].map(load));
const png=readFileSync(resolve(root,'town/assets/furniture.png')),atlas=JSON.parse(readFileSync(resolve(root,'town/assets/decor/atlas.json'))),catalog=new Map(Array.from({length:9},(_,i)=>[`furniture-${i}-180`,{w:180,h:Math.ceil(180*png.readUInt32BE(20)/png.readUInt32BE(16)),boxes:[]} ]));
for(const d of decorDefinitions){const cell=atlas.find(a=>a.family===d.family).cells[d.index],s=Math.min(d.maxW/cell.w,d.maxH/cell.h);catalog.set(d.id,{w:Math.ceil(cell.w*s),h:Math.ceil(cell.h*s),boxes:[]});}
for(const d of SHOWROOM_FURNITURE)catalog.set(d.id,{...d,furnitureRole:d.role});
for(const d of [...APARTMENT_DECOR,...APARTMENT_COLLECTION_ASSETS])catalog.set(d.id,d);
configureUrbanInteriors(catalog);
const select=(o,keys)=>Object.fromEntries(keys.filter(k=>o?.[k]!==undefined).map(k=>[k,o[k]]));
const spatial=['id','x','y','w','h','length','axis','facing','floorY','threshold','enterNormal','triggerHalfWidth','approachDistance','doorId','roomId'];
const scenes=[...Array.from({length:15},(_,i)=>({kind:i?'hall':'lobby',floor:i+1})),...residents.map(r=>({kind:'apartment',resident:r.id,floor:r.floor})),{kind:'apartment',resident:'player',floor:15},...SHOWROOMS.map(s=>({kind:'showroom',showroomId:s.id,floor:s.storeFloor})),{kind:'shop',floor:1},{kind:'shop',floor:2}];
const models=scenes.map(scene=>{const m=getInterior(scene);return {scene,...select(m,['id','kind','floor','resident','width','height','spawn','exit','elevator','stairs']),solids:m.solids,walls:m.walls.map(w=>select(w,['x','y','w','h'])),rooms:m.rooms.map(r=>select(r,['id','x','y','w','h','functionalRole','point'])),zones:m.zones.map(z=>select(z,[...spatial,'action','floor','resident','showroomId','targetFloor','arrival'])),doors:(m.doors||[]).map(d=>select(d,[...spatial,'number','showroomId'])),privacyDoors:(m.privacyDoors||[]).map(d=>select(d,spatial)),portalExit:m.portalExit?{...select(m.portalExit,spatial),door:m.portalExit.door?select(m.portalExit.door,spatial):undefined}:null,items:m.items.map(i=>({...select(i,['id','asset','x','y','w','h','solid','rotation','depth','slot','furnitureRole','fixtureRole','supportedBy']),collisionBoxes:i.collisionBoxes})),actors:m.actors.map(a=>select(a,['id','x','y','facing']))};});
assert.equal(models.length,48);
const stock=createRequire(import.meta.url)(resolve(root,'furniture-catalog.js')),player={kind:'apartment',resident:'player',floor:15},saved={id:'room-legacy-geranium',item:'furniture-geranium',asset:'decor-08-01',x:1800,y:900,scale:1},raw=JSON.stringify({version:1,owner:'guest',items:[saved]}),memory=new Map([[ROOM_KEY,raw]]);let writes=0;
const room=createRoomStorage({storage:{getItem:k=>memory.get(k),setItem:(k,v)=>{writes++;memory.set(k,v);}},owner:'guest',catalog,furniture:stock,owned:()=>[saved.item],getBounds:(_item,a)=>a.wallMounted?apartmentWallDecorBounds(player):apartmentDecorBounds(player),getSolids:()=>getInterior(player).solids});
assert.equal(room.load().ok,true);assert.deepEqual(room.snapshot(),[saved]);assert.equal(writes,0);assert.equal(memory.get(ROOM_KEY),raw);
const journeys=residents.map(r=>({id:r.id,home:residentHomePose(r.id),directions:['out','home'].map(direction=>{const duration=journeyDuration(r.id,direction);return {direction,duration,samples:Array.from({length:41},(_,n)=>interiorJourneyPose(r.id,direction,duration*n/40))};})}));
// Predictive opening, occupancy hold, close behind, locks and arrival hysteresis.
const fixture={id:'baseline-door',threshold:{x:400,y:200},enterNormal:{x:0,y:-1},triggerHalfWidth:70},manager=createAutomaticDoors([fixture]),actor={id:'test-player',x:400,y:420},doorTrace=[];
for(let n=0;n<50;n++){actor.y=420-n*6;manager.update(.025,actor,[]);doorTrace.push({y:actor.y,open:manager.openness(fixture),blocked:manager.blocked(actor.x,actor.y)});}actor.y=100;for(let n=0;n<60;n++){manager.update(.025,actor,[]);doorTrace.push({y:actor.y,open:manager.openness(fixture),blocked:manager.blocked(actor.x,actor.y)});}assert.equal(manager.openness(fixture),0);
const gate=createAutomaticPortalGate(),point={x:400,y:240};gate.arrive(point);const gateTrace=[gate.update(.1,point,{x:0,y:-1},[fixture])?.id||null];point.y=280;gate.update(.1,point,{x:0,y:1},[fixture]);for(let n=0;n<4;n++)gate.update(.1,point,{x:0,y:0},[fixture]);point.y=240;gateTrace.push(gate.update(.025,point,{x:0,y:-1},[fixture])?.id||null);assert.deepEqual(gateTrace,[null,fixture.id]);
const payload={schema:1,models,playerSave:{key:ROOM_KEY,raw,loaded:room.snapshot(),writes,floorBounds:apartmentDecorBounds(player),wallBounds:apartmentWallDecorBounds(player)},showroomRoutes:SHOWROOMS.map(s=>select(s,['id','storeFloor','x','y','w','h','threshold','enterNormal','triggerHalfWidth','entry','lobbyApproach','lobbyReturn','visitRoute','exitRoute'])),storeTraffic:STORE_TRAFFIC,storeVerticalCore:STORE_VERTICAL_CORE,journeys,doorTrace,gateTrace,stock:stock.map(p=>select(p,['id','asset','price','scale'])),sourceMapHash:createHash('sha256').update(readFileSync(resolve(root,'town/maps/coda-town-uploaded-3.json'))).digest('hex')};
const canonical=v=>JSON.stringify(v,(_k,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value),encoded=canonical(payload),hash=createHash('sha256').update(encoded).digest('hex');
const baseline=option('--baseline',null),allowPriceChanges=args.includes('--allow-price-changes');let changedPrices=0;
if(baseline){
 const b=JSON.parse(readFileSync(baseline)),changed=[];
 function diff(a,v,path='payload'){if(JSON.stringify(a)===JSON.stringify(v))return;if(a&&v&&typeof a==='object'&&typeof v==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(v)]))diff(a[k],v[k],path+'.'+k);}else if(changed.length<20)changed.push({path,before:v,after:a});}
 if(allowPriceChanges){
  // An explicit economy revision may raise prices, while every model, saved
  // placement, product ID/asset/scale and route still matches the old baseline.
  const stripPrices=value=>({...value,stock:value.stock.map(({price,...product})=>product)});
  const current=JSON.parse(encoded),before=stripPrices(b.payload),after=stripPrices(current);diff(after,before);
  assert.deepEqual(after,before,'Non-price geometry/save/portal contract changed: '+JSON.stringify(changed));
  for(let i=0;i<current.stock.length;i++){const now=current.stock[i].price,old=b.payload.stock[i].price;assert(Number.isInteger(now)&&now>=old,'Authorized repricing must retain a valid non-decreasing price: '+current.stock[i].id);if(now!==old)changedPrices++;}
 }else{diff(JSON.parse(encoded),b.payload);assert.equal(hash,b.hash,'Geometry/save/portal fingerprint changed: '+JSON.stringify(changed));}
}
const result={root,hash,payload};if(option('--output',null))writeFileSync(option('--output'),JSON.stringify(result,null,2));console.log(JSON.stringify({models:models.length,privateHomes:31,commonFloors:15,storeFloors:2,hash,baselineMatches:!!baseline&&!changedPrices,geometryAndSavesMatch:!!baseline,authorizedPriceChanges:changedPrices,oldSaveUnchanged:true,mapHash:payload.sourceMapHash}));
