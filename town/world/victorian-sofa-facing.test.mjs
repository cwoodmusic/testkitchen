import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {mirrorVictorianSofaLeft} from './victorian-sofa-facing.mjs';
import {registerApartmentCollections} from './apartment-collections.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {collectionImageRect} from './apartment-collection-art.mjs';
import {furnitureFacingBoxes,furnitureFacingBounds} from './furniture-facing.mjs';
import {createRoomLayoutModel} from './room-layout-model.mjs';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas'),ID='collection-showroom-victorian-parlor-sofa';
const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
function reflectedPixels(image,sx=0,sy=0,sw=image.width,sh=image.height){const c=createCanvas(sw,sh),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,sx,sy,sw,sh,0,0,sw,sh);const source=pixels(c),expected=new Uint8ClampedArray(source.length);for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)for(let k=0;k<4;k++)expected[(y*sw+x)*4+k]=source[(y*sw+sw-1-x)*4+k];return expected;}

test('the actual Victorian left sofa is a pixel-exact reflection of the right sofa with unchanged physics and saves',async()=>{
 const root=new URL('../assets/apartment-collections/',import.meta.url),all=JSON.parse(readFileSync(new URL('manifest.json',root))),directions=JSON.parse(readFileSync(new URL('directions-manifest.json',root))),owner='showroom-victorian-parlor',definition=APARTMENT_COLLECTION_ASSETS.find(a=>a.id===ID),base=all.collections.find(c=>c.owner===owner),direction=directions.collections.find(c=>c.owner===owner),before=JSON.stringify(definition),loads=[];
 const manifest={...all,collections:[{...base,cells:base.cells.filter(c=>c.slot==='sofa')}]},directionManifest={...directions,collections:[{...direction,views:Object.fromEntries(Object.entries(direction.views).map(([face,view])=>[face,{...view,cells:view.cells.filter(c=>c.slot==='sofa')}]))}]};
 const [asset]=await registerApartmentCollections((id,name,group,w,h,draw,boxes,layer)=>({id,name,group,w,h,draw,boxes,layer}),{definitions:[definition],manifest,directionManifest,overviewManifest:{cells:[]},createCanvas:()=>createCanvas(1,1),loadImage:async url=>{loads.push(new URL(url).pathname.split('/').at(-1));return loadImage(readFileSync(new URL(url)));}});
 const eastView=asset.getFacingView('east'),westView=asset.getFacingView('west'),oldFrame=direction.views.west.cells.find(c=>c.slot==='sofa'),oldRect=collectionImageRect({w:oldFrame.viewWidth,h:oldFrame.viewHeight},oldFrame),oldWest={id:westView.id,w:oldFrame.viewWidth,h:oldFrame.viewHeight,footCenter:{x:oldRect.x+oldFrame.footCenter[0]*oldRect.w,y:oldRect.y+oldFrame.footCenter[1]*oldRect.h}};
 assert.equal(westView.w,oldWest.w);assert.equal(westView.h,oldWest.h);assert.equal(westView.footCenter.x,westView.w-eastView.footCenter.x);assert.equal(westView.footCenter.y,eastView.footCenter.y);
 await asset.ensureFull('west');const east=asset.getFacingImage('east'),west=asset.getFacingImage('west');assert.deepEqual(pixels(west),reflectedPixels(east));assert(westView.ready);
 const source=asset.getFacingDrawSource('west',{native:true}),eastSource=asset.getFacingDrawSource('east',{native:true});assert.equal(source.sw,eastSource.sw);assert.equal(source.sh,eastSource.sh);assert.equal(source.quality,eastSource.quality);assert.deepEqual(pixels(source.image),reflectedPixels(eastSource.image,eastSource.sx,eastSource.sy,eastSource.sw,eastSource.sh));assert(!loads.some(file=>file.includes('-west-')),'The mismatched former left artwork is not loaded');
 const item={id:'sofa-1',asset:ID,x:300,y:280,w:144,h:100.8,rotation:90,solid:true},baseAsset={...definition,getFacingView:face=>face==='west'?oldWest:asset.getFacingView(face)},oldBoxes=furnitureFacingBoxes(baseAsset,item);Object.defineProperty(item,'collisionBoxes',{value:oldBoxes});
 const scene={id:'victorian-sofa-fixture',kind:'showroom',width:600,height:500,spawn:{x:300,y:430},walls:[],privacyDoors:[],rooms:[],rugs:[],items:[item],solids:oldBoxes,actors:[]},original=createRoomLayoutModel({themeId:'victorian-sofa-fixture',scene,catalog:new Map([[ID,baseAsset]])}),record=original.record(),restored=createRoomLayoutModel({themeId:'victorian-sofa-fixture',scene,catalog:new Map([[ID,asset]]),record});
 assert.deepEqual(furnitureFacingBoxes(asset,item),oldBoxes);assert.deepEqual(restored.record(),record);assert.deepEqual({id:asset.id,w:asset.w,h:asset.h,boxes:asset.boxes},{id:definition.id,w:definition.w,h:definition.h,boxes:definition.boxes});assert.equal(JSON.stringify(definition),before);
 const a=furnitureFacingBounds(baseAsset,item),b=furnitureFacingBounds(asset,item);for(const key of ['x','y','w','h'])assert(Math.abs(a[key]-b[key])<.0001,'Existing left bounds retain their reviewed anchor to subpixel precision');
});

test('overview and native source aliases mirror only their crop at its original resolution',async()=>{
 const atlas=createCanvas(250,500),c=atlas.getContext('2d');for(let x=0;x<250;x++){c.fillStyle=`rgb(${x},${(x*3)%255},${(x*7)%255})`;c.fillRect(x,0,1,500);}const east={id:ID+'|east',w:84,h:236,footCenter:{x:31,y:154},ready:true},oldWest={id:ID+'|west',w:84,h:236,footCenter:{x:42,y:154}},native={image:atlas,sx:17,sy:13,sw:198,sh:453,dx:0,dy:43,dw:84,dh:193,native:true,quality:'native',revision:1},overview={image:atlas,sx:7,sy:5,sw:8,sh:20,dx:6,dy:12,dw:65,dh:224,native:false,quality:'overview',revision:1},ensured=[],calls=[];let canvases=0;
 const asset={id:ID,getFacingView:face=>face==='east'?east:face==='west'?oldWest:null,getFacingImage:()=>atlas,getFacingDrawSource:(face,options)=>{calls.push({face,native:options?.native});return options?.native?native:overview;},ensureFull:async face=>{ensured.push(face);}};
 mirrorVictorianSofaLeft(asset,{createCanvas(){canvases++;return createCanvas(1,1);}});const view=asset.getFacingView('west');assert.equal(view.footCenter.x,53);assert.equal(canvases,0);assert.equal(calls.length,0,'Metadata lookups never request native or overview art');
 const preview=asset.getFacingDrawSource('west',{native:false});assert.equal(preview.sw,8);assert.equal(preview.sh,20);assert.equal(preview.dx,13);assert.equal(preview.dy,12);assert.equal(preview.quality,'overview');assert.deepEqual(pixels(preview.image),reflectedPixels(atlas,7,5,8,20));
 const detail=asset.getFacingDrawSource('west',{native:true});assert.equal(detail.sw,198);assert.equal(detail.sh,453);assert.equal(detail.dw,84);assert.equal(detail.dh,193);assert.equal(detail.quality,'native');assert.deepEqual(pixels(detail.image),reflectedPixels(atlas,17,13,198,453));
 const count=canvases;for(let i=0;i<30;i++){assert.equal(asset.getFacingDrawSource('west',{native:false}).image,preview.image);assert.equal(asset.getFacingDrawSource('west',{native:true}).image,detail.image);}assert.equal(canvases,count,'Steady frames reuse both reflected quality levels');assert(calls.every(call=>call.face==='east'));await asset.ensureFull('west');await asset.ensureFull('north');assert.deepEqual(ensured,['east','north']);
});

test('every other sofa, theme and facing keeps its existing APIs',()=>{
 for(const id of ['collection-bach-sofa','collection-showroom-art-deco-lounge-sofa','collection-showroom-victorian-parlor-reading-chair']){const getFacingView=()=>null,getFacingImage=()=>null,getFacingDrawSource=()=>null,ensureFull=()=>null,asset={id,getFacingView,getFacingImage,getFacingDrawSource,ensureFull};assert.equal(mirrorVictorianSofaLeft(asset),asset);assert.equal(asset.getFacingView,getFacingView);assert.equal(asset.getFacingImage,getFacingImage);assert.equal(asset.getFacingDrawSource,getFacingDrawSource);assert.equal(asset.ensureFull,ensureFull);}
});
