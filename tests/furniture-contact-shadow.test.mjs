import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createFurnitureContactShadowPainter,drawFurnitureContactShadow} from '../town/world/furniture-contact-shadow.mjs';
import {registerApartmentCollections} from '../town/world/apartment-collections.mjs';
import {registerFamilyFurniture} from '../town/world/family-furniture.mjs';
import {FAMILY_FURNITURE_ASSETS} from '../town/world/family-furniture-definitions.mjs';
import {furnitureFacingPlacement,furnitureFacingBoxes,furnitureFacingDepth} from '../town/world/furniture-facing.mjs';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
const root=path.resolve('town/assets/apartment-collections');
function trackedPainter(){
 let allocations=0,reads=0,maxWidth=0,maxHeight=0;
 const painter=createFurnitureContactShadowPainter({createCanvas(){
  allocations++;const canvas=createCanvas(1,1),original=canvas.getContext.bind(canvas);canvas.getContext=(...args)=>{
   const c=original(...args),read=c.getImageData.bind(c);c.getImageData=(...args)=>{reads++;maxWidth=Math.max(maxWidth,canvas.width);maxHeight=Math.max(maxHeight,canvas.height);return read(...args);};return c;
  };return canvas;
 }});
 return {painter,get allocations(){return allocations;},get reads(){return reads;},get maxWidth(){return maxWidth;},get maxHeight(){return maxHeight;}};
}
function context({throwFill=false}={}){
 const stack=[],state={fillStyle:'#bada55',globalAlpha:.6},ellipses=[];let restores=0;
 const c={ellipses,get depth(){return stack.length;},get restores(){return restores;},get fillStyle(){return state.fillStyle;},set fillStyle(value){state.fillStyle=value;},get globalAlpha(){return state.globalAlpha;},set globalAlpha(value){state.globalAlpha=value;},save(){stack.push({...state});},restore(){Object.assign(state,stack.pop());restores++;},beginPath(){},ellipse(...args){ellipses.push(args);},fill(){if(throwFill)throw Error('paint failed');}};
 return c;
}
const untouched=()=>new Proxy({},{get(){throw Error('A skipped contact shadow must not touch the destination context');},set(){throw Error('A skipped contact shadow must not touch the destination context');}});
function silhouette({w=100,h=120,x=10,y=25,width=80,height=90}={}){const image=createCanvas(w,h),c=image.getContext('2d');c.fillStyle='#876543';c.fillRect(x,y,width,height);return image;}
function opaqueBounds(image){
 const {data,width,height}=image.getContext('2d').getImageData(0,0,image.width,image.height);let left=width,right=0,top=height,bottom=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>=192){left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);}
 return {left:left/width,right:right/width,top:top/height,bottom:bottom/height};
}
const pixels=image=>createHash('sha256').update(image.getContext('2d').getImageData(0,0,image.width,image.height).data).digest('hex');
const near=(a,b,tolerance=1e-8)=>assert(Math.abs(a-b)<=tolerance,`${a} versus ${b} (tolerance ${tolerance})`);

let catalogPromise;
async function nativeCatalog(){
 if(catalogPromise)return catalogPromise;
 catalogPromise=(async()=>{
  const catalog=new Map(),add=(id,name,group,w,h,draw,boxes,layer)=>{const asset={id,name,group,w,h,boxes,layer};catalog.set(id,asset);return asset;},json=async file=>JSON.parse(await readFile(path.join(root,file),'utf8')),image=async file=>loadImage(String(file).startsWith('file:')?new URL(file):path.join(root,String(file)));
  await registerApartmentCollections(add,{createCanvas:()=>createCanvas(1,1),loadImage:image,fetchManifest:()=>json('manifest.json'),fetchDirections:()=>json('directions-manifest.json')});
  await registerFamilyFurniture(add,catalog,{createCanvas:()=>createCanvas(1,1),loadImage:image,manifest:await json('large-furniture/manifest.json'),definitions:FAMILY_FURNITURE_ASSETS.filter(a=>a.id==='family-showroom-victorian-parlor-coffee-table')});
  return catalog;
 })();return catalogPromise;
}

test('real Victorian long tables and sofas cast shallow shadows at their pictured feet in all four facings',async()=>{
 const catalog=await nativeCatalog(),tracker=trackedPainter(),cases=[['collection-showroom-victorian-parlor-sofa',144,100.8],['family-showroom-victorian-parlor-coffee-table',157.5,81]],directions=[['south',0],['west',90],['north',180],['east',270]];
 for(const [id,w,h]of cases)for(const [direction,rotation]of directions){
  const asset=catalog.get(id);await asset.ensureFull(direction);const item=Object.freeze({asset:id,x:330,y:430,w,h,rotation}),facing=furnitureFacingPlacement(asset,item),before={item:JSON.stringify(item),boxes:JSON.stringify(asset.boxes),physics:furnitureFacingBoxes(asset,item),depth:furnitureFacingDepth(asset,item),pixels:pixels(facing.image)},c=context(),bounds=opaqueBounds(facing.image);
  assert.equal(tracker.painter.draw(c,asset,item,facing),true,id+'/'+direction);assert.equal(c.ellipses.length,1);assert.equal(c.depth,0);assert.equal(c.fillStyle,'#bada55');assert.equal(c.globalAlpha,.6);
  const [x,y,rx,ry,angle]=c.ellipses[0],tolerance=Math.max(facing.w,facing.h)/96*2.1;
  assert(x-rx>=facing.x+bounds.left*facing.w-tolerance&&x+rx<=facing.x+bounds.right*facing.w+tolerance,'A side sprite must not borrow its much wider saved width for the shadow');
  near(y,facing.y+bounds.bottom*facing.h,tolerance);
  assert(y>facing.y+(bounds.top+(bounds.bottom-bounds.top)*.85)*facing.h,'The ellipse belongs below the pictured feet, not at a legacy midbody foot anchor');
  assert(rx*2<=facing.w&&ry<=Math.max(.75,facing.w*.04)&&ry<=3&&ry<rx*.16,'Contact shadows stay shallow and entirely within the native silhouette width');assert.equal(angle,0);
  if(direction==='east'||direction==='west')assert(y>facing.screenFootCenter.y+facing.h*.15,'East/west shadows must clear the old midbody screenFootCenter');
  assert.equal(JSON.stringify(item),before.item);assert.equal(JSON.stringify(asset.boxes),before.boxes);assert.deepEqual(furnitureFacingBoxes(asset,item),before.physics);assert.equal(furnitureFacingDepth(asset,item),before.depth);assert.equal(pixels(facing.image),before.pixels,'Measuring a shadow cannot mask, crop or recolor the source furniture');
 }
 assert.equal(tracker.allocations,1);assert.equal(tracker.painter.stats.allocations,1);assert(tracker.maxWidth<=96&&tracker.maxHeight<=96);
 assert.equal(typeof drawFurnitureContactShadow,'function');
});

test('alpha threshold and bottom contact band ignore soft baked shadows and opaque upper overhangs',()=>{
 const image=createCanvas(120,180),c=image.getContext('2d');c.fillStyle='#765432';c.fillRect(4,5,112,80);c.fillRect(30,70,12,90);c.fillRect(76,70,12,90);c.fillStyle='rgba(0,0,0,.4)';c.fillRect(0,160,120,20);
 const tracker=trackedPainter(),geometry=tracker.painter.geometry(image,{ready:true});assert(geometry);
 assert(geometry.left<.1&&geometry.right>.9,'The complete opaque picture includes the upper overhang');
 assert(geometry.contactLeft>.2&&geometry.contactRight<.8,'Only actual feet in the bottom band determine contact width');
 near(geometry.bottom,160/180,.025);assert(Object.isFrozen(geometry));assert(geometry.bottom<.95,'A baked translucent floor shadow cannot move the contact point below the feet');
 const item={x:0,y:0},facing={image,x:50,y:60,w:120,h:180,view:{ready:true}},destination=context();assert(tracker.painter.draw(destination,{},item,facing));
 const [x,y,rx,ry]=destination.ellipses[0];assert(x-rx>50+20&&x+rx<50+100);assert(y<60+171&&y>60+151);assert(ry<=3);
});

test('one bounded sampler serves every image and repeated warm draws perform no alpha readbacks',()=>{
 const tracker=trackedPainter(),image=silhouette(),facing={image,x:100,y:200,w:180,h:220,view:{ready:true,revision:0}},item=Object.freeze({x:10,y:20,rotation:90}),asset=Object.freeze({id:'chair'}),first=tracker.painter.geometry(image,{ready:true,revision:0});assert(first);
 const reads=tracker.reads;
 for(let i=0;i<250;i++){const c=context();assert(tracker.painter.draw(c,asset,item,facing));assert.equal(c.depth,0);}
 assert.equal(tracker.reads,reads,'The frame loop cannot read alpha again after the image is warm');
 for(let i=0;i<12;i++)assert(tracker.painter.geometry(silhouette({w:140+i,h:300+i}),{ready:true}));
 assert.equal(tracker.allocations,1);assert.equal(tracker.painter.stats.allocations,1);assert(tracker.maxWidth<=96&&tracker.maxHeight<=96);
});

test('readiness, image dimensions and explicit revisions invalidate cached contact geometry',()=>{
 const tracker=trackedPainter(),image=silhouette(),draw=(y)=>{const c=image.getContext('2d');c.clearRect(0,0,image.width,image.height);c.fillStyle='#654321';c.fillRect(20,y,40,15);};
 assert.equal(tracker.painter.geometry(image,{ready:false,revision:0}),null);assert.equal(tracker.allocations,0);
 const a=tracker.painter.geometry(image,{ready:true,revision:0}),reads=tracker.reads;assert(a);assert.deepEqual(tracker.painter.geometry(image,{ready:true,revision:0}),a);assert.equal(tracker.reads,reads);
 draw(40);assert.equal(tracker.painter.geometry(image,{ready:false,revision:0}),null);assert.equal(tracker.reads,reads);
 const b=tracker.painter.geometry(image,{ready:true,revision:0});assert(b.bottom<a.bottom-.3);assert.equal(tracker.reads,reads+1);
 draw(75);const d=tracker.painter.geometry(image,{ready:true,revision:1});assert(d.bottom>b.bottom+.2);assert.equal(tracker.reads,reads+2);
 image.width=160;image.height=240;draw(200);const resized=tracker.painter.geometry(image,{ready:true,revision:1});assert(resized);assert(resized.contactRight<d.contactRight);assert.equal(tracker.reads,reads+3);assert.equal(tracker.allocations,1);
});

test('pending and blank art, unsupported facings, rugs, wall pieces and supported objects draw nothing',()=>{
 const tracker=trackedPainter(),image=silhouette(),normal={image,x:0,y:0,w:100,h:120,view:{ready:true}},asset={id:'coffee-table'},item={x:0,y:0};
 for(const [a,i,f]of [[asset,item,null],[asset,item,{...normal,image:null}],[asset,item,{...normal,w:0}],[asset,item,{...normal,x:NaN}],[asset,item,{...normal,view:{ready:false}}],[{...asset,layer:'ground'},item,normal],[asset,{...item,layer:'ground'},normal],[{...asset,purpose:'rug'},item,normal],[asset,{...item,furnitureRole:'rug'},normal],[{...asset,wallMounted:true},item,normal],[asset,{...item,wallMounted:true},normal],[asset,{...item,supportedBy:'coffee-table'},normal],[asset,{...item,supportedBy:'north-wall'},normal]])assert.equal(tracker.painter.draw(untouched(),a,i,f),false);
 assert.equal(tracker.allocations,0);
 const blank=createCanvas(40,60),facing={...normal,image:blank};assert.equal(tracker.painter.draw(untouched(),asset,item,facing),false);const reads=tracker.reads;assert.equal(tracker.painter.draw(untouched(),asset,item,facing),false);assert.equal(tracker.reads,reads,'A blank ready canvas remains a cached miss');
});

test('the destination canvas state is restored even when filling a contact shadow throws',()=>{
 const tracker=trackedPainter(),c=context({throwFill:true}),image=silhouette();assert.throws(()=>tracker.painter.draw(c,{},Object.freeze({x:0,y:0}),{image,x:0,y:0,w:100,h:120,view:{ready:true}}),/paint failed/);
 assert.equal(c.depth,0);assert.equal(c.restores,1);assert.equal(c.fillStyle,'#bada55');assert.equal(c.globalAlpha,.6);
});
