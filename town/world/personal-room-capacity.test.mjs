import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {getInteriorBase,configureUrbanInteriors} from './urban-interiors.mjs';
import {LEGACY_FURNITURE_ASSETS} from './legacy-furniture-definitions.mjs';
import {APARTMENT_DECOR} from './apartment-decor-definitions.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';
import {furnitureFacingBounds,furnitureFacingBoxes,furnitureFootCenter} from './furniture-facing.mjs';
import {furniturePresentationScale} from './private-furniture.mjs';
import {apartmentDecorBounds,apartmentDecorFootBounds,apartmentWallDecorBounds} from './personal-room-areas.mjs';
import {createRoomStorage,ROOM_KEY} from './urban-room.mjs';
import {createPlayerRoomSourceResolver} from './player-room-source.mjs';

const stock=createRequire(import.meta.url)('../../furniture-catalog.js'),manifest=JSON.parse(readFileSync(new URL('../assets/furniture-facings/manifest.json',import.meta.url))),catalog=new Map([...LEGACY_FURNITURE_ASSETS,...APARTMENT_DECOR,...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,{...a}]));
for(const id of ['furniture-0-180','furniture-1-180','furniture-2-180']){
 const asset=catalog.get(id),views={south:{w:asset.w,h:asset.h,footCenter:furnitureFootCenter(asset)}};
 for(const collection of manifest.collections)for(const [direction,view]of Object.entries(collection.views||{})){const cell=view.cells.find(c=>c.id===id);if(cell)views[direction]={w:cell.viewWidth,h:cell.viewHeight,footCenter:{x:cell.viewWidth*cell.footCenter[0],y:cell.viewHeight*cell.footCenter[1]}};}
 asset.getFacingView=direction=>views[direction];
}
configureUrbanInteriors(catalog);
const model=getInteriorBase({kind:'apartment',resident:'player'}),owner='guest',products=['furniture-sofa','furniture-bed','furniture-piano'];
const contains=(r,b)=>b.x>=r.x-1e-8&&b.y>=r.y-1e-8&&b.x+b.w<=r.x+r.w+1e-8&&b.y+b.h<=r.y+r.h+1e-8;
function storageFor(scene,owned,raw){let value=raw,writes=0;const disk={getItem:key=>key===ROOM_KEY?value:null,setItem(key,next){assert.equal(key,ROOM_KEY);writes++;value=next;}},room=createRoomStorage({storage:disk,owner,catalog,furniture:stock,owned:()=>owned,presentationScale:(item,a)=>furniturePresentationScale(item,scene,a),getBounds:(_item,a)=>(a.wallMounted?apartmentWallDecorBounds:apartmentDecorBounds)(scene),getFootBounds:(_item,a)=>a.wallMounted?null:apartmentDecorFootBounds(scene),getSolids:()=>scene.solids});return {room,disk,get raw(){return value;},get writes(){return writes;}};}
function relatives(product,rotation,scene=model){const a=catalog.get(product.asset),scale=product.scale*furniturePresentationScale({asset:product.asset},scene,a),placed={asset:product.asset,x:0,y:0,scale,rotation};return {visual:furnitureFacingBounds(a,placed),feet:furnitureFacingBoxes(a,placed),scale};}
function position(visual,feet,art,reserve){let x0=art.x-visual.x,x1=art.x+art.w-visual.x-visual.w,y0=art.y-visual.y,y1=art.y+art.h-visual.y-visual.h;for(const b of feet){x0=Math.max(x0,reserve.x-b.x);x1=Math.min(x1,reserve.x+reserve.w-b.x-b.w);y0=Math.max(y0,reserve.y-b.y);y1=Math.min(y1,reserve.y+reserve.h-b.y-b.h);}return x0<=x1+1e-8&&y0<=y1+1e-8?{x:(x0+x1)/2,y:(y0+y1)/2}:null;}

test('compact player art may rise above its unchanged clear feet reserve, inside the same physical room',()=>{
 assert.deepEqual({w:model.width,h:model.height},{w:1184,h:512});assert.deepEqual(apartmentDecorFootBounds(model)[0],{x:304,y:280,w:240,h:180});assert.deepEqual(apartmentDecorBounds(model)[0],{x:280,y:106,w:276,h:378});assert.equal(apartmentDecorFootBounds({kind:'apartment',resident:'player'}),null);
 const feet=apartmentDecorFootBounds(model);for(const r of feet)assert(!model.solids.some(b=>b.x<r.x+r.w&&b.x+b.w>r.x&&b.y<r.y+r.h&&b.y+b.h>r.y),'The original native bases remain outside the reserved feet region');
});

test('native flagship art uses all four actual facings at unchanged product scale, accepting every fitting base and rejecting oversized turns',()=>{
 const art=apartmentDecorBounds(model)[0],reserve=apartmentDecorFootBounds(model)[0];let accepted=0,rejected=0;
 for(const id of products){const product=stock.find(p=>p.id===id);assert(product);for(const rotation of [0,90,180,270]){const relative=relatives(product,rotation),at=position(relative.visual,relative.feet,art,reserve),f=storageFor(model,[id]);
   assert(relative.visual.w>0&&relative.visual.h>0);if(at){const result=f.room.place(id,at.x,at.y,rotation);assert.equal(result.ok,true,id+' facing'+rotation+': '+result.error);const saved=result.items[0];assert.equal(saved.scale,product.scale);assert.equal(saved.rotation,rotation);assert.equal(relatives(product,rotation).scale,relative.scale);accepted++;}
   else{const centered={x:art.x+(art.w-relative.visual.w)/2-relative.visual.x,y:art.y+(art.h-relative.visual.h)/2-relative.visual.y};assert(contains(art,{...relative.visual,x:relative.visual.x+centered.x,y:relative.visual.y+centered.y}));assert.equal(f.room.place(id,centered.x,centered.y,rotation).ok,false);assert.equal(f.writes,0);rejected++;}
  }}
 assert(accepted>=6);assert(rejected>=2);const sofa=stock.find(p=>p.id==='furniture-sofa');assert(Math.abs(relatives(sofa,0).visual.w-252)<1e-8);assert(Math.abs(relatives(sofa,90).visual.h-310.4644634)<1e-6);
 for(const id of products){const f=storageFor(model,[id]);assert.equal(f.room.place(id,424,440,0).ok,true,id+' is usable in the unchanged compact room');}
});

test('art containment does not excuse bases outside the reserve or inside a fixed wall, and room bounds remain strict',()=>{
 const id='furniture-sofa',product=stock.find(p=>p.id===id),f=storageFor(model,[id]);const wrong=f.room.place(id,424,320,0);assert.equal(wrong.ok,false);assert.match(wrong.error,/base/);assert.equal(f.writes,0);
 const wall={...model,solids:[...model.solids,{x:420,y:400,w:20,h:20}]},blocked=storageFor(wall,[id]);assert.equal(blocked.room.place(id,424,440,0).ok,false);assert.equal(blocked.writes,0);
 assert.equal(f.room.place(id,-100,440,0).ok,false);assert.equal(f.room.place(id,424,600,0).ok,false);assert.equal(f.writes,0);assert.equal(product.scale,1.75);
});

test('native purchased rugs retain their fixed scale and can cover free floor without inventing collision bases',()=>{
 const id='furniture-collection-showroom-victorian-parlor-rug',product=stock.find(p=>p.id===id);assert(product);const art=apartmentDecorBounds(model)[0];
 for(const rotation of [0,90,180,270]){const relative=relatives(product,rotation);assert.equal(relative.feet.length,0);const f=storageFor(model,[id]),at={x:art.x+(art.w-relative.visual.w)/2-relative.visual.x,y:art.y+(art.h-relative.visual.h)/2-relative.visual.y},result=f.room.place(id,at.x,at.y,rotation);assert.equal(result.ok,true,result.error);assert.equal(result.items[0].scale,product.scale);}
});

test('previous personal records keep their exact bytes and legacy validation without the new feet restriction',()=>{
 const saved={id:'room-furniture-sofa',item:'furniture-sofa',asset:'furniture-1-180',x:1800,y:900,scale:1.75,rotation:0},raw=JSON.stringify({version:1,owner,items:[saved]},null,3),resolverDisk={getItem:key=>key===ROOM_KEY?raw:null,setItem(){throw Error('Loading must not write');}},resolver=createPlayerRoomSourceResolver({storage:resolverDisk,owner,catalog,furniture:stock,owned:()=>['furniture-sofa']}),legacy=resolver.resolve(model);assert.notEqual(legacy,model);assert.equal(apartmentDecorFootBounds(legacy),null);
 const f=storageFor(legacy,['furniture-sofa'],raw),result=f.room.load();assert.equal(result.ok,true,result.error);assert.deepEqual(result.items,[saved]);assert.equal(f.raw,raw);assert.equal(f.writes,0);
});
