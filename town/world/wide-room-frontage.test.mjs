import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {wideRoomSouthExteriorGeometry,drawWideRoomSouthExterior,drawWideRoomEntrance} from './wide-room-frontage.mjs';
import {getHomeMaterialSuite} from './home-material-definitions.mjs';
import {getInteriorPortalArtCacheStats} from './interior-portal-art.mjs?v=opera-parallax-1';
import {getInteriorBase,residents} from './urban-interiors.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';
const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas');
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;};
const scene=(owner='showroom-victorian-parlor',extra={})=>({id:owner,kind:'showroom',collectionOwner:owner,width:1184,height:512,color:'#704633',trim:'#c09b6b',wideRoomExpansion:{previousHeight:448,depth:64,previousFloorBottom:420,newFloorBottom:484},homeMaterialSuite:getHomeMaterialSuite(owner),portalExit:{doorId:'showroom-victorian-parlor',threshold:{x:1092,y:484},enterNormal:{x:0,y:-1},triggerHalfWidth:18,door:{id:'showroom-victorian-parlor',threshold:{x:1092,y:484},enterNormal:{x:0,y:1},triggerHalfWidth:18,virtual:true,clearOpening:true}},items:[],solids:[],...extra});
const rgba=(context,x,y)=>[...context.getImageData(x,y,1,1).data];
const canvasFor=s=>createCanvas(s.width,s.height+130);
function recordingContext(){
 const stack=[],c={fillStyle:'#123456',globalAlpha:.7,imageSmoothingEnabled:true,matrix:[1,0,0,1,3,5]};
 for(const name of ['fillRect','beginPath','rect','clip','moveTo','lineTo','closePath','fill','drawImage'])c[name]=()=>{};
 c.save=()=>stack.push({fillStyle:c.fillStyle,globalAlpha:c.globalAlpha,imageSmoothingEnabled:c.imageSmoothingEnabled,matrix:[...c.matrix]});
 c.restore=()=>{assert(stack.length,'Canvas saves and restores must balance');Object.assign(c,stack.pop());};
 c.translate=(x,y)=>{c.matrix[4]+=x;c.matrix[5]+=y;};c.transform=(...matrix)=>{c.matrix=matrix;};return {c,stack};
}

test('only expanded private rooms get a frontage and its physical entrance stays untouched',()=>{
 for(const s of [null,{},scene('bach',{wideRoomExpansion:null}),scene('bach',{kind:'shop'}),scene('bach',{width:NaN})])assert.equal(wideRoomSouthExteriorGeometry(s),null);
 const s=freeze(scene()),before=JSON.stringify(s),g=wideRoomSouthExteriorGeometry(s);
 assert.equal(g.seam,s.height-28);assert.equal(g.floorY,s.height+78);assert.equal(g.bounds.y+g.bounds.h,s.height+108);assert.equal(g.door.threshold.x,s.portalExit.threshold.x);assert.equal(g.door.threshold.y,s.height+78);assert.equal(g.door.triggerHalfWidth,18);assert(!g.door.axis);assert.equal(g.opening.w,36);
 assert.deepEqual(g.parts.map(p=>[p.x,p.x+p.w]),[[0,g.opening.x],[g.opening.x+g.opening.w,s.width]]);assert.equal(JSON.stringify(s),before);
});

test('the entire static passage remains clear through the cap, facade and plinth',()=>{
 const s=freeze(scene()),cv=canvasFor(s),c=cv.getContext('2d'),g=drawWideRoomSouthExterior(c,s);
 for(let y=g.seam;y<=g.floorY+25;y++)for(let x=g.opening.x;x<g.opening.x+g.opening.w;x++)assert.equal(rgba(c,x,y)[3],0,`Static wall crosses the real doorway at ${x},${y}`);
 for(const x of [g.opening.x-6,g.opening.x+g.opening.w+6])for(const y of [g.seam+2,g.seam+30,g.floorY-10,g.floorY+2])assert(rgba(c,x,y)[3]>0,`The adjoining exterior is missing at ${x},${y}`);
});

test('native frontage pixels stay below the physical floor and within the shared visual bounds',()=>{
 for(const owner of ['showroom-victorian-parlor','showroom-coastal-bedroom','showroom-industrial-loft','showroom-cyberpunk','player']){
  const s=freeze(scene(owner)),cv=canvasFor(s),c=cv.getContext('2d');drawWideRoomSouthExterior(c,s);drawWideRoomEntrance(c,s,.5);const p=c.getImageData(0,0,cv.width,cv.height).data,g=wideRoomSouthExteriorGeometry(s);let count=0;
  for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++)if(p[(y*cv.width+x)*4+3]){count++;assert(y>=g.seam,`${owner} paints over the playable room`);assert(y<s.height+108,`${owner} exceeds the camera's visual allowance`);}
  assert(count>70000,`${owner} should expose a complete textured face`);
  const colors=new Set();for(let y=g.seam+14;y<g.floorY-20;y++)for(let x=40;x<400;x++){const at=(y*cv.width+x)*4;if(p[at+3])colors.add([...p.slice(at,at+4)].join(','));}assert(colors.size>8,`${owner} must have masonry/grain detail rather than one flat slab`);
 }
});

test('upright doors share the exact clear width and animate without mutating scene or drawing state',()=>{
 const s=freeze(scene('player',{kind:'apartment',resident:'player',residentInfo:{number:'15A'}})),before=JSON.stringify(s),{c,stack}=recordingContext(),transform=[...c.matrix];
 for(const openness of [0,.25,.5,.75,1]){const g=drawWideRoomEntrance(c,s,openness);assert.equal(g.kind,'front');assert.equal(g.privacy,false);assert.equal(g.span,36);assert.equal(g.floorY,s.height+78);assert.equal(g.openness,openness);}
 assert.equal(c.fillStyle,'#123456');assert.equal(c.globalAlpha,.7);assert.equal(c.imageSmoothingEnabled,true);assert.deepEqual(c.matrix,transform);assert.equal(stack.length,0);assert.equal(JSON.stringify(s),before);
 const closed=canvasFor(s),opened=canvasFor(s);drawWideRoomEntrance(closed.getContext('2d'),s,0);drawWideRoomEntrance(opened.getContext('2d'),s,1);assert.notDeepEqual(closed.toBuffer('image/png'),opened.toBuffer('image/png'),'The leaf must really move instead of remaining a static entrance');
});

test('room themes retain distinct facade materials and left/right entrances stay aligned',()=>{
 const styles=new Set(),palettes=new Set();for(const owner of ['showroom-victorian-parlor','showroom-coastal-bedroom','showroom-industrial-loft','showroom-cyberpunk']){
  for(const x of [92,1092]){const s=scene(owner,{portalExit:{threshold:{x,y:484}}}),g=wideRoomSouthExteriorGeometry(s);assert.equal(g.door.threshold.x,x);styles.add(g.style);palettes.add(g.palette.base);}
 }
 assert.deepEqual([...styles].sort(),['brick','metal','siding','stone']);assert.equal(palettes.size,4);
 const apartment=scene('bach',{kind:'apartment',resident:'bach',portalExit:null,zones:[{id:'hall',action:'exit',x:1050,w:204}],width:2304});assert.equal(wideRoomSouthExteriorGeometry(apartment).door.threshold.x,1152);
});

test('all31 fresh rooms and preserved wide sources have aligned entrances while saved compact homes draw no new architecture',()=>{
 const requests=[...residents.map(r=>({kind:'apartment',resident:r.id})),{kind:'apartment',resident:'player'},...SHOWROOMS.map(r=>({kind:'showroom',showroomId:r.id}))],fresh=requests.map(getInteriorBase),models=fresh.flatMap(s=>[s,...(s.roomLayoutLegacySources||[])]);let wide=0,compact=0;
 assert.equal(fresh.length,31);assert(fresh.every(s=>s.wideRoomExpansion));assert.equal(models.length,84);
 for(const s of models){
  const before=JSON.stringify(s),cv=canvasFor(s),c=cv.getContext('2d'),g=wideRoomSouthExteriorGeometry(s);
  if(s.wideRoomExpansion){wide++;assert(g);assert.equal(g.door.threshold.x,s.portalExit.threshold.x);assert.equal(g.seam,s.portalExit.threshold.y);assert.equal(g.door.threshold.y-g.seam,106);drawWideRoomSouthExterior(c,s);assert.equal(drawWideRoomEntrance(c,s,.5).span,36);}
  else{compact++;assert.equal(g,null);assert.equal(drawWideRoomSouthExterior(c,s),null);assert.equal(drawWideRoomEntrance(c,s),null);assert.equal(c.getImageData(0,0,cv.width,cv.height).data.some(value=>value!==0),false);}
  assert.equal(JSON.stringify(s),before,`${s.id}: drawing must preserve architecture, portals, furniture and saves`);
 }
 assert.equal(wide,74);assert.equal(compact,10);
});

test('animated entrance reuses the bounded shared door artwork cache',()=>{
 const oldDocument=globalThis.document;globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');return createCanvas(1,1);}};
 try{
  const s=scene(),cv=canvasFor(s),c=cv.getContext('2d');for(const openness of [0,.5,1])drawWideRoomEntrance(c,s,openness);const warm=getInteriorPortalArtCacheStats();assert(warm.entries>0);
  for(let n=0;n<300;n++)drawWideRoomEntrance(c,s,(n%101)/100);
  const after=getInteriorPortalArtCacheStats();assert.equal(after.builds,warm.builds);assert.equal(after.entries,warm.entries);assert.equal(after.pixels,warm.pixels);assert(after.entries<=after.maxEntries);assert(after.pixels<=after.maxPixels);
 }finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
});
