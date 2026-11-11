import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInteriorPortalArt,getDoorVisualGeometry,getPrivacyDoorVisualGeometry,getElevatorVisualGeometry,interiorPortalVisualDepth,PORTAL_ART_LIMITS,warmInteriorPortalArt,interiorPortalArtReady} from './interior-portal-art.mjs';
import {createAutomaticDoors} from './automatic-doors.mjs';

const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;};
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} should equal ${b}`);
function context(){
 const calls=[],stack=[],c={calls,fillStyle:'#010203',globalAlpha:.67,globalCompositeOperation:'source-over',imageSmoothingEnabled:true,lineWidth:3,matrix:[1,0,0,1,0,0]};
 for(const name of ['fillRect','beginPath','lineTo','moveTo','closePath','fill','rect','clip','drawImage'])c[name]=(...args)=>{for(const arg of args)if(typeof arg==='number')assert(Number.isFinite(arg),`${name} received ${arg}`);calls.push({name,args});};
 c.save=()=>stack.push({fillStyle:c.fillStyle,globalAlpha:c.globalAlpha,globalCompositeOperation:c.globalCompositeOperation,imageSmoothingEnabled:c.imageSmoothingEnabled,lineWidth:c.lineWidth,matrix:[...c.matrix]});
 c.restore=()=>{assert(stack.length,'balanced context restore');Object.assign(c,stack.pop());};
 c.translate=(x,y)=>{assert(Number.isFinite(x)&&Number.isFinite(y));c.matrix[4]+=x;c.matrix[5]+=y;};
 c.transform=(...a)=>{assert.equal(a.length,6);for(const n of a)assert(Number.isFinite(n));c.matrix=a;calls.push({name:'transform',args:a});};
 c.stack=stack;return c;
}
function rig(options={}){
 const canvases=[],createCanvas=(width,height)=>{const cc=context(),canvas={width,height,getContext:()=>cc};cc.canvas=canvas;canvases.push(canvas);return canvas;};
 return {canvases,art:createInteriorPortalArt({createCanvas,...options}),c:context()};
}
const entry=freeze({id:'room-clara',x:430,y:112,w:170,h:190,number:'7A',color:'#557267'});
const privateDoor=freeze({id:'bedroom',roomId:'bedroom',axis:'vertical',x:420,y:218,length:132,swing:1,color:'#557267',trim:'#c6aa78'});
const elevator=freeze({x:1032,y:112,w:240,h:150,floor:7});

test('privacy leaves retain the existing ground hinges and exact cardinal closed/open poses',()=>{
 const cases=[
  [{axis:'vertical',hinge:'start',swing:1},[100,205],[100,327],[222,205]],
  [{axis:'vertical',hinge:'end',swing:-1},[100,327],[100,205],[-22,327]],
  [{axis:'horizontal',hinge:'start',swing:1},[105,200],[227,200],[105,78]],
  [{axis:'horizontal',hinge:'end',swing:-1},[227,200],[105,200],[227,322]]
 ];
 for(const [attrs,hinge,closed,opened]of cases){
  const d=freeze({x:100,y:200,length:132,...attrs});
  for(const [op,tip]of [[0,closed],[1,opened]]){
   const g=getPrivacyDoorVisualGeometry(d,op);assert.deepEqual([g.hinge.x,g.hinge.y],hinge);assert.deepEqual([g.tip.x,g.tip.y],tip);near(Math.hypot(g.tip.x-g.hinge.x,g.tip.y-g.hinge.y),122);
  }
  const g=getPrivacyDoorVisualGeometry(d,.5);near(Math.hypot(g.vector.x,g.vector.y),1);near(Math.hypot(g.tip.x-g.hinge.x,g.tip.y-g.hinge.y),122);
 }
});

test('front and side entrances use their original thresholds without moving the crossing',()=>{
 const front=getDoorVisualGeometry(entry);assert.equal(front.floorY,302);assert.deepEqual(front.opening,{x:357,y:132,w:146,h:170});
 const d=freeze({x:999,y:999,w:156,h:190,facing:'right',threshold:{x:1216,y:224},enterNormal:{x:-1,y:0},triggerHalfWidth:64});
 const g=getDoorVisualGeometry(d);assert.deepEqual(g.gapStart,{x:1216,y:165});assert.deepEqual(g.gapEnd,{x:1216,y:283});assert.equal(g.privacy,true);
 assert.equal((g.gapStart.y+g.gapEnd.y)/2,d.threshold.y);assert.equal(getDoorVisualGeometry(d,1).tip.x,1098);
});

test('visual height does not alter a leaf footprint or its actor-sort depth',()=>{
 const small=getPrivacyDoorVisualGeometry(privateDoor,.4),tall=getPrivacyDoorVisualGeometry({...privateDoor,visualHeight:240},.4);
 assert.deepEqual(small.hinge,tall.hinge);assert.deepEqual(small.tip,tall.tip);assert.equal(small.depth,tall.depth);assert.equal(interiorPortalVisualDepth(privateDoor,.4),small.depth);
 assert.equal(interiorPortalVisualDepth(entry,1),302);
 assert.equal(getDoorVisualGeometry(entry,-12).openness,0);assert.equal(getDoorVisualGeometry(entry,42).openness,1);assert.equal(getDoorVisualGeometry(entry,NaN).openness,0);
});

test('lift fascia rises above the existing footprint and preserves every floor threshold',()=>{
 for(const floor of [1,2,7,15]){
  const d={...elevator,floor},g=getElevatorVisualGeometry(d);assert.equal(g.floorY,262);assert.equal(g.opening.y+g.opening.h,262);assert.equal(g.opening.x+g.opening.w/2,1152);assert(g.opening.h>=162);assert(g.bounds.y<d.y);assert.equal(d.floor,floor);
 }
 const lobby=getElevatorVisualGeometry({x:1040,y:112,w:224,h:210});assert.equal(lobby.floorY,322);
 const store=getElevatorVisualGeometry({x:1424,y:128,w:224,h:180});assert.equal(store.floorY,308);
});

test('all rendered states preserve caller context and immutable scene definitions',()=>{
 const {art,c}=rig(),before={fillStyle:c.fillStyle,globalAlpha:c.globalAlpha,globalCompositeOperation:c.globalCompositeOperation,imageSmoothingEnabled:c.imageSmoothingEnabled,lineWidth:c.lineWidth,matrix:[...c.matrix]},definitions=JSON.stringify([entry,privateDoor,elevator]);
 for(const op of [0,.01,.5,.99,1]){
  art.drawInteriorDoor(c,entry,op);art.drawPrivacyDoor(c,privateDoor,op);art.drawPrivacyDoor(c,freeze({...privateDoor,axis:'horizontal',hinge:'end',roomId:'bathroom'}),op);art.drawElevatorPortal(c,elevator,{openness:op,floors:15});
 }
 for(const [key,value]of Object.entries(before))assert.deepEqual(c[key],value,key);assert.equal(c.stack.length,0);assert.equal(JSON.stringify([entry,privateDoor,elevator]),definitions);assert(c.calls.some(call=>call.name==='drawImage'));
});

test('animation reuses native leaves and frames instead of rerasterizing each openness',()=>{
 const {art,c}=rig();for(const op of [0,.25,.5,.75,1]){art.drawInteriorDoor(c,entry,op);art.drawPrivacyDoor(c,privateDoor,op);art.drawElevatorPortal(c,elevator,{openness:op});}
 const warm=art.stats();assert(warm.builds>0);assert(warm.pixels>100000);
 for(let i=0;i<500;i++){const op=(i%101)/100;art.drawInteriorDoor(c,entry,op);art.drawPrivacyDoor(c,privateDoor,op);art.drawElevatorPortal(c,elevator,{openness:op});}
 assert.equal(art.stats().builds,warm.builds);assert.equal(art.stats().entries,warm.entries);assert.equal(art.stats().pixels,warm.pixels);
});

test('texture and palette bounds survive many owners and evicted rooms recover',()=>{
 const {art,c,canvases}=rig({maxEntries:6,maxPixels:100000});
 for(let i=0;i<90;i++){const color='#'+(0x345678+i*127).toString(16);art.drawInteriorDoor(c,{...entry,number:String(i),color},.2);const s=art.stats();assert(s.entries<=6);assert(s.pixels<=100000);assert(s.palettes<=PORTAL_ART_LIMITS.palettes);}
 assert(canvases.some(cv=>cv.width===0&&cv.height===0),'eviction disposes the old backing store');const old=art.stats().builds;art.drawInteriorDoor(c,entry,.2);assert(art.stats().builds>old);art.clear();assert.equal(art.stats().entries,0);assert.equal(art.stats().pixels,0);assert.equal(art.stats().palettes,0);
});

test('missing canvas support and oversized textures still draw a complete fallback',()=>{
 const c=context(),art=createInteriorPortalArt({createCanvas:()=>null,maxPixels:100});
 art.drawInteriorDoor(c,entry,.5);art.drawPrivacyDoor(c,privateDoor,.3);art.drawElevatorPortal(c,elevator,{openness:.2});assert.equal(art.stats().builds,0);assert.equal(art.stats().pixels,0);assert(c.calls.filter(x=>x.name==='fillRect').length>100);assert.equal(c.stack.length,0);
});

test('door drawing cannot advance, unlock, or otherwise change the existing automatic-door trace',()=>{
 const allowed=(_door,actor,isPlayer)=>!isPlayer&&actor.id==='clara',door=freeze({id:'clara',threshold:{x:400,y:300},enterNormal:{x:0,y:-1},triggerHalfWidth:85}),a=createAutomaticDoors([door],{canOpen:allowed}),b=createAutomaticDoors([door],{canOpen:allowed}),{art,c}=rig(),guest={x:400,y:340},owner={id:'clara',x:400,y:320};
 for(let step=0;step<110;step++){
  const actors=step<25?[owner]:[];a.update(.02,guest,actors);b.update(.02,guest,actors);const open=a.openness(door);art.drawInteriorDoor(c,{...entry,...door},open);
  assert.equal(a.openness(door),b.openness(door));assert.equal(a.blocked(400,300,16,guest,true),b.blocked(400,300,16,guest,true));assert(a.blocked(400,300,16,guest,true),'friendship lock still blocks the guest even while owner opens it');
 }
});

test('store/tower indicators clamp to their actual floor count without changing routing data',()=>{
 const {art,c}=rig();const store=freeze({...elevator,floor:15});assert.equal(art.drawElevatorPortal(c,store,{floors:2}).floor,2);assert.equal(art.drawElevatorPortal(c,elevator,{floors:15}).floor,7);assert.equal(art.drawElevatorPortal(c,{...elevator,floor:0},{floors:15}).floor,1);assert.equal(store.floor,15);
});

test('one shared material load invalidates fallback textures once, then animation remains cached',async()=>{
 const {art,c}=rig();art.drawInteriorDoor(c,entry,0);const previous=art.stats().builds,oldFetch=globalThis.fetch,oldBitmap=globalThis.createImageBitmap;let requests=0,decodes=0;
 globalThis.fetch=async url=>{requests++;assert(String(url).includes('portal-materials-0af76c98c1c1.webp'));return {ok:true,blob:async()=>({})};};
 globalThis.createImageBitmap=async()=>{decodes++;return {width:1024,height:1536};};
 try{
  const first=warmInteriorPortalArt();assert.strictEqual(warmInteriorPortalArt(),first);await first;assert(interiorPortalArtReady());assert.equal(requests,1);assert.equal(decodes,1);
  art.drawInteriorDoor(c,entry,0);assert(art.stats().builds>previous);assert.equal(art.stats().sourcePixels,1024*1536);const ready=art.stats().builds;for(const op of [.1,.3,.5,.8,0])art.drawInteriorDoor(c,entry,op);assert.equal(art.stats().builds,ready);assert.equal(requests,1);assert.equal(c.stack.length,0);
 }finally{globalThis.fetch=oldFetch;if(oldBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=oldBitmap;}
});
