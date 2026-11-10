import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {inflateSync} from 'node:zlib';
import {APARTMENT_DECOR,APARTMENT_DECOR_ALIASES,apartmentImageRect,registerApartmentDecor} from './apartment-decor.mjs';
import {SHOWROOM_FURNITURE} from './showroom-furniture-definitions.mjs';
import {blank,blocked} from './model.mjs';

const file=def=>new URL('../assets/apartments/'+def.file,import.meta.url);
const dimensions=bytes=>({width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)});
function pixels(bytes){
 const {width,height}=dimensions(bytes);assert.equal(bytes[24],8);assert.equal(bytes[25],6);assert.equal(bytes[28],0);
 const parts=[];for(let at=8;at<bytes.length;){const size=bytes.readUInt32BE(at),type=bytes.toString('ascii',at+4,at+8);if(type==='IDAT')parts.push(bytes.subarray(at+8,at+8+size));at+=size+12;}
 const packed=inflateSync(Buffer.concat(parts)),stride=width*4,out=new Uint8Array(stride*height),paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
 for(let y=0;y<height;y++){
  const filter=packed[y*(stride+1)];
  for(let x=0;x<stride;x++){
   const at=y*stride+x,left=x>=4?out[at-4]:0,up=y?out[at-stride]:0,corner=y&&x>=4?out[at-stride-4]:0;
   out[at]=(packed[y*(stride+1)+1+x]+(filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,corner)))&255;
  }
 }
 return {width,height,data:out};
}

test('48 apartment props provide distinct practical, playful and authentic-midcentury roles',()=>{
 assert.equal(APARTMENT_DECOR.length,48);assert.equal(new Set(APARTMENT_DECOR.map(d=>d.id)).size,48);
 for(const category of ['midcentury','playful','practical'])assert.equal(APARTMENT_DECOR.filter(d=>d.category===category).length,16);
 for(const purpose of ['bed','sofa','kitchen-sink','stove','fridge','bath-vanity','shower','toilet','bathtub','wardrobe','dining-table','plush','rug','wall-art'])assert(APARTMENT_DECOR.some(d=>d.purpose===purpose),purpose);
 for(const def of APARTMENT_DECOR){
  assert(def.id.startsWith('apartment-'));assert(def.w>0&&def.h>0);
  for(const box of def.boxes)assert(box.x>=0&&box.y>=0&&box.w>0&&box.h>0&&box.x+box.w<=def.w&&box.y+box.h<=def.h,def.id+' footprint must fit its canvas');
  if(def.purpose==='rug'||def.wallMounted){assert.equal(def.solid,false);assert.equal(def.boxes.length,0);}
 }
});

test('all packed cutouts exist, have clear transparent borders and contain no hidden colored matte',()=>{
 for(const def of [...APARTMENT_DECOR,...APARTMENT_DECOR_ALIASES]){
  const {width,height,data}=pixels(readFileSync(file(def)));let visible=0;
  assert(width>=30&&height>=30,def.id+' must retain detailed native art');
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const at=(y*width+x)*4,alpha=data[at+3];
   if(alpha===0)assert.equal(data[at]+data[at+1]+data[at+2],0,def.id+' transparent RGB');
   else{visible++;assert(alpha>=16,def.id+' stray near-transparent gutter pixel');}
   if(x===0||y===0||x===width-1||y===height-1)assert.equal(alpha,0,def.id+' clipped border');
  }
  assert(visible>1000,def.id+' cannot be an empty placeholder');
  const rect=apartmentImageRect(def,{width,height});
  assert(Math.abs(rect.w/rect.h-width/height)<1e-9,def.id+' must retain native aspect ratio');
  assert(rect.x>=0&&rect.y>=0&&rect.x+rect.w<=def.w+1e-9);assert(Math.abs(rect.y+rect.h-def.h)<1e-9);
 }
});

test('legacy midcentury purchases retain IDs, canvases, boxes and showroom metadata',()=>{
 assert.equal(APARTMENT_DECOR_ALIASES.length,2);
 for(const def of APARTMENT_DECOR_ALIASES){
  const old=SHOWROOM_FURNITURE.find(d=>d.id===def.id);assert(old);
  assert.equal(def.w,old.w);assert.equal(def.h,old.h);assert.deepEqual(def.boxes,old.boxes);assert.equal(def.showroomId,old.showroomId);assert.equal(def.role,old.role);
  assert(APARTMENT_DECOR.some(d=>d.id===def.aliasOf));
 }
});

test('practical furniture blocks its floor footprint while rugs and wall decorations stay nonblocking',()=>{
 for(const def of APARTMENT_DECOR){
  const d=blank(),o={id:'fixture',asset:def.id,x:8192,y:6144,scale:1,rotation:0,collision:true,layer:def.layer};d.objects=[o];
  const catalog=new Map([[def.id,def]]),point=(x,y)=>({x:o.x+x-def.w/2,y:o.y+y-def.h});
  for(const box of def.boxes){const p=point(box.x+box.w/2,box.y+box.h/2);assert(blocked(d,p.x,p.y,catalog),def.id+' floor footprint');}
  if(!def.boxes.length){const p=point(def.w/2,def.h/2);assert(!blocked(d,p.x,p.y,catalog),def.id+' should remain nonblocking');}
 }
});

test('registration exposes every prop and preserved alias with independent boxes and native contain-fit art',async()=>{
 const previous=globalThis.Image,calls=[];
 globalThis.Image=class{set src(url){this.url=url;Object.assign(this,dimensions(readFileSync(fileURLToPath(url))));queueMicrotask(()=>this.onload());}};
 try{
  const registered=await registerApartmentDecor((id,name,group,w,h,draw,boxes,layer)=>{
   const images=[];draw({drawImage:(...args)=>images.push(args)});calls.push({id,images});return {id,name,group,w,h,boxes,layer};
  });
  assert.equal(registered.length,50);assert.equal(calls.length,50);
  assert.equal(registered.filter(a=>a.group==='apartment furniture').length,48);
  for(let index=0;index<registered.length;index++){
   const a=registered[index],def=[...APARTMENT_DECOR,...APARTMENT_DECOR_ALIASES][index];
   assert.equal(a.kit,'urban');assert.equal(a.facing,'south');assert.equal(a.collisionDefault,def.solid);
   assert.deepEqual(a.boxes,def.boxes);if(a.boxes.length)assert.notStrictEqual(a.boxes[0],def.boxes[0]);
   assert.equal(calls[index].images[0].length,5);
   if(def.aliasOf){assert.equal(a.showroomId,'midcentury-studio');assert.equal(a.furnitureRole,def.role);}
   for(const light of a.lightEmitters)assert(light.u>=0&&light.u<=1&&light.v>=0&&light.v<=1);
  }
 }finally{globalThis.Image=previous;}
});
