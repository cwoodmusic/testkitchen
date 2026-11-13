import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {HOME_MATERIAL_SUITES,getHomeMaterialSuite,applyHomeMaterialSuite} from './home-material-definitions.mjs';
import {APARTMENT_COLLECTION_OWNERS} from './apartment-collection-definitions.mjs';

test('every collection owner has an independent named dry and sanitary material suite',()=>{
 assert.deepEqual(HOME_MATERIAL_SUITES.map(s=>s.owner).sort(),[...APARTMENT_COLLECTION_OWNERS].sort());
 for(const key of ['name','floor','wall','wet']){
  const values=HOME_MATERIAL_SUITES.map(s=>key==='name'?s.name:s.construction[key]);assert.equal(new Set(values).size,31,'Distinct constructions are required for '+key);
 }
 for(const suite of HOME_MATERIAL_SUITES){
  assert.equal(getHomeMaterialSuite(suite.owner),suite);assert(Object.isFrozen(suite));assert.equal(new Set(suite.assets).size,4);
  for(const finish of [suite.floor,suite.wallpaper,suite.bedroomFloor,suite.kitchenFloor,suite.wetFloor,suite.wetWallpaper]){assert(finish.homeMaterial);assert.equal(finish.owner,suite.owner);assert(finish.texture?.startsWith(suite.owner+'-')||finish.surfaceStyle);assert(finish.colors.every(color=>/^#[0-9a-f]{6}$/i.test(color)));}
  assert.notEqual(suite.floor.texture,suite.wetFloor.texture);assert.equal(suite.wetWallpaper.texture,null,'Wet floor artwork must never repeat up bathroom walls');assert.equal(suite.wetWallpaper.surfaceStyle,'ceramic-wall');assert.equal(suite.bedroomFloor.surfaceStyle,'carpet');assert.notEqual(suite.kitchenFloor.surfaceStyle,'carpet');
 }
 assert.equal(getHomeMaterialSuite('not-a-resident'),null);
});

test('all31 authored suites ship complete distinct native tile files within a fixed decode budget',()=>{
 const root=new URL('../assets/home-materials/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',root))),files=manifest.collections.flatMap(c=>c.files);
 assert.equal(manifest.owners,31);assert.equal(manifest.textures,124);assert.equal(files.length,124);assert.equal(new Set(files.map(f=>f.file)).size,124);assert(manifest.pixels<4*1024*1024);
 assert.deepEqual(manifest.collections.map(c=>c.owner).sort(),HOME_MATERIAL_SUITES.map(c=>c.owner).sort());
 for(const suite of HOME_MATERIAL_SUITES){const shipped=manifest.collections.find(c=>c.owner===suite.owner);assert.deepEqual(shipped.files.map(f=>f.file).sort(),suite.assets.slice().sort());}
 for(const file of files){assert(file.width>0&&file.height>0);assert.equal(createHash('sha256').update(readFileSync(new URL(file.file,root))).digest('hex'),file.sha256,file.file);}
 for(const suffix of ['floor','wall','wet-floor'])assert.equal(new Set(manifest.collections.map(c=>c.files.find(f=>f.file===c.owner+'-'+suffix+'.webp').sha256)).size,31,'Each owner needs actual distinct '+suffix+' art');
});

test('surface binding preserves every physical rectangle, furnishing and interaction',()=>{
 const scene={kind:'apartment',width:2304,height:1120,rooms:[{name:'Bathroom',functionalRole:'bathroom',x:36,y:112,w:598,h:330},{name:'Studio',functionalRole:'living',x:1584,y:496,w:684,h:588,wallpaperAreas:[{x:1584,y:390,w:684,h:88}]}],walls:[{x:650,y:106,w:20,h:112}],privacyDoors:[{id:'private',x:660,y:218,length:152}],items:[{asset:'owned',x:1800,y:800,rotation:90}],solids:[{x:650,y:106,w:20,h:112}],zones:[{id:'decorate',x:962,y:715,w:380,h:300}],spawn:{x:1152,y:975},ownedDecor:[{productId:'owned-chair'}]};
 const before=structuredClone(scene),items=scene.items,solids=scene.solids,zones=scene.zones;
 assert.equal(applyHomeMaterialSuite(scene,'player'),scene);assert.equal(scene.items,items);assert.equal(scene.solids,solids);assert.equal(scene.zones,zones);
 for(const key of ['items','solids','zones','spawn','ownedDecor','width','height'])assert.deepEqual(scene[key],before[key]);
 for(let i=0;i<scene.rooms.length;i++)for(const key of ['name','functionalRole','x','y','w','h'])assert.deepEqual(scene.rooms[i][key],before.rooms[i][key]);
 for(let i=0;i<scene.walls.length;i++)for(const key of ['x','y','w','h'])assert.equal(scene.walls[i][key],before.walls[i][key]);
 assert.equal(scene.rooms[0].floorFinish,scene.homeMaterialSuite.wetFloor);assert.equal(scene.rooms[1].floorFinish,scene.homeMaterialSuite.floor);assert.deepEqual(scene.rooms[1].wallpaperAreas,before.rooms[1].wallpaperAreas);
 assert.deepEqual(scene.privacyDoors.map(({color,trim,...door})=>door),before.privacyDoors);
});

test('repeated room warmups reuse decoded bitmaps and never create DOM images',async()=>{
 const old={document:globalThis.document,fetch:globalThis.fetch,createImageBitmap:globalThis.createImageBitmap};let fetches=0,decodes=0;const urls=[];
 globalThis.document={createElement(){throw Error('Materials must not use DOM image decoding');}};
 globalThis.fetch=async url=>{fetches++;urls.push(String(url));return {ok:true,blob:async()=>({url:String(url)})};};
 globalThis.createImageBitmap=async()=>{decodes++;return {width:192,height:96};};
 try{const fresh=await import('./home-materials.mjs?material-bitmap-cache-test'),suite=getHomeMaterialSuite('showroom-midcentury-studio');await fresh.warmHomeMaterials(suite);await fresh.warmHomeMaterials(suite);assert.equal(fetches,4);assert.equal(decodes,4);assert(urls.every(url=>url.endsWith('?material-bitmap-cache-test')));assert.deepEqual(fresh.getHomeMaterialCacheStats(),{textures:4,ready:4,pixels:4*192*96});}
 finally{for(const [key,value]of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});


test('bedrooms, kitchens, living rooms and bathrooms get separate appropriate finishes without changing their floor regions',()=>{
 const roles=['apartment','bedroom','kitchen','dining','living','bathroom'];
 for(const suite of HOME_MATERIAL_SUITES){
  const scene={rooms:roles.map((functionalRole,i)=>({functionalRole,name:functionalRole,x:i*20,y:112,w:120,h:160})),walls:[],privacyDoors:[],items:[],solids:[],zones:[],spawn:{x:20,y:300}},before=scene.rooms.map(r=>[r.x,r.y,r.w,r.h]);applyHomeMaterialSuite(scene,suite.owner);
  const byRole=new Map(scene.rooms.map(r=>[r.functionalRole,r]));assert.equal(byRole.get('bedroom').floorFinish,suite.bedroomFloor);assert.equal(byRole.get('kitchen').floorFinish,suite.kitchenFloor);assert.equal(byRole.get('bathroom').floorFinish,suite.wetFloor);assert.equal(byRole.get('bathroom').wallpaper,suite.wetWallpaper);assert.equal(byRole.get('living').floorFinish,suite.floor);
  assert.equal(new Set(['bedroom','kitchen','bathroom','living'].map(role=>byRole.get(role).floorFinish.id)).size,4);assert.equal(byRole.get('dining').floorOverlay,false,'Semantic dining nook must not repaint a rectangle across an open-plan boundary');assert.deepEqual(scene.rooms.map(r=>[r.x,r.y,r.w,r.h]),before);
 }
 const botanical=getHomeMaterialSuite('showroom-botanical-conservatory'),mcm=getHomeMaterialSuite('showroom-midcentury-studio');assert(botanical.floor.presentation.opacity>=.75);assert(botanical.wallpaper.presentation.opacity>=.65);assert(mcm.floor.presentation.opacity>=.65);assert.equal(botanical.floor.presentation.scale,.5);assert.notEqual(botanical.floor.presentation.color,botanical.floor.colors[0]);
});

test('small patterned surfaces share world phase and cache their detail once instead of generating each frame',async()=>{
 const old={document:globalThis.document,fetch:globalThis.fetch,createImageBitmap:globalThis.createImageBitmap};let canvases=0;const transforms=[];
 const ctx=()=>({globalAlpha:1,save(){},restore(){},beginPath(){},rect(){},clip(){},fillRect(){},createPattern(){return {setTransform(value){transforms.push(value);}};}});
 globalThis.document={createElement(){canvases++;return {width:0,height:0,getContext:ctx};}};globalThis.fetch=async()=>({ok:true,blob:async()=>({})});globalThis.createImageBitmap=async()=>({width:192,height:96});
 try{
  const material=await import('./home-materials.mjs?room-contrast-pattern-cache-test'),suite=getHomeMaterialSuite('showroom-midcentury-studio');await material.warmHomeMaterials(suite);
  const c=ctx();for(const x of [0,128])material.drawHomeMaterialFloor(c,{x,y:0,w:128,h:160,floorFinish:suite.floor});assert.equal(transforms.length,2);assert.deepEqual(transforms[0],transforms[1]);assert.equal(transforms[0].e,0);assert.equal(transforms[0].f,0,'Adjacent rectangles use the same world-aligned texture, never a local room offset');
  for(const row of HOME_MATERIAL_SUITES){material.drawHomeMaterialFloor(c,{x:0,y:0,w:128,h:128,floorFinish:row.bedroomFloor});material.drawHomeMaterialFloor(c,{x:0,y:0,w:128,h:128,floorFinish:row.kitchenFloor});material.drawHomeMaterialWallpaper(c,{wallpaper:row.wetWallpaper,wallpaperAreas:[{x:0,y:0,w:128,h:106}]});}
  const first=material.getHomeSurfacePatternCacheStats();assert.equal(canvases,93);assert.equal(first.entries,93);assert(first.entries<=first.maxEntries&&first.pixels<=first.maxPixels);
  for(const row of HOME_MATERIAL_SUITES)for(const finish of [row.bedroomFloor,row.kitchenFloor])material.drawHomeMaterialFloor(c,{x:0,y:0,w:128,h:128,floorFinish:finish});assert.equal(canvases,93,'Re-entry reuses every procedural tile');
 }finally{for(const [key,value]of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});


test('Botanical and Midcentury bathrooms replace the busy mirrored wet repeat with quiet square floor tiles',()=>{
 const expected=new Map([['showroom-botanical-conservatory','stone'],['showroom-midcentury-studio','porcelain']]);
 for(const suite of HOME_MATERIAL_SUITES){
  if(expected.has(suite.owner)){assert.equal(suite.wetFloor.texture,null);assert.equal(suite.wetFloor.surfaceStyle,expected.get(suite.owner));assert.equal(suite.wetFloor.presentation.scale,.5);assert.notEqual(suite.wetFloor.pattern,suite.wetWallpaper.pattern);assert.notDeepEqual(suite.wetFloor.colors,suite.wetWallpaper.colors,'Floor and wall retain separate values and tile layouts');}
  else {assert.equal(suite.wetFloor.texture,suite.owner+'-wet-floor.webp');assert.equal(suite.wetFloor.surfaceStyle,undefined,'Other29 authored fancy bathroom floors stay intact');}
 }
});

function canvasDecodeBytes(bytes){
 if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return bytes;
 // The node test decoder rejects PNG's optional C2PA chunk. Decode the exact
 // original IDAT pixels without that chunk in memory; keep the shipped file.
 const chunks=[bytes.subarray(0,8)];for(let at=8;at<bytes.length;){const end=at+bytes.readUInt32BE(at)+12;if(bytes.toString('ascii',at+4,at+8)!=='caBX')chunks.push(bytes.subarray(at,end));at=end;}return Buffer.concat(chunks);
}
function pixelMaterialRenderer(textures=new Map()){
 const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas'),base=new URL('./home-materials.mjs',import.meta.url);
 const source=readFileSync(base,'utf8').replace(/^export \{[^\n]*\n/m,'').replaceAll('export ','').replaceAll('import.meta.url',JSON.stringify(base.href))+'\n({warmHomeMaterials,drawHomeMaterialWallpaper,drawHomeMaterialFloor,drawHomeMaterialRug,getHomeMaterialCacheStats})',operations={fetches:0,decodes:0,canvases:0};
 const renderer=runInNewContext(source,{URL,document:{createElement(){operations.canvases++;return createCanvas(1,1);}},fetch:async url=>{operations.fetches++;return {ok:true,blob:async()=>textures.get(new URL(url).pathname.split('/').at(-1))||loadImage(canvasDecodeBytes(readFileSync(new URL(url))))};},createImageBitmap:async image=>{operations.decodes++;return image;}});
 return {...renderer,createCanvas,operations};
}
const materialPixels=(canvas,r)=>canvas.getContext('2d').getImageData(r.x,r.y,r.w,r.h).data;
const materialHasColor=(pixels,rgb)=>{for(let i=0;i<pixels.length;i+=4)if(rgb.every((value,k)=>Math.abs(pixels[i+k]-value)<=2))return true;return false;};
const dadoArtRect=(wall,style)=>({x:wall.x,y:wall.y+wall.h-22+style.insetTop,w:wall.w,h:22-style.insetTop-style.insetBottom});

test('fitted dado contains the complete native ornament between caps instead of cropping or overpainting its ends',async()=>{
 const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas'),art=createCanvas(40,44),a=art.getContext('2d');
 a.fillStyle='#164bcc';a.fillRect(0,0,40,44);a.fillStyle='#eb2832';a.fillRect(0,0,40,4);a.fillStyle='#17be44';a.fillRect(0,40,40,4);
 const renderer=pixelMaterialRenderer(new Map([['probe-dado.webp',art]])),finish={homeMaterial:true,colors:['#d5c6ab','#bfa166','#30231e','#997c52'],texture:null,trimTexture:'probe-dado.webp',trimPresentation:{scaleX:.65,fitHeight:true,insetTop:2,insetBottom:4}};
 await renderer.warmHomeMaterials({assets:['probe-dado.webp']});
 const area={x:11,y:9,w:90,h:106},room={wallpaper:finish,wallpaperAreas:[area]},canvas=renderer.createCanvas(140,140),c=canvas.getContext('2d');c.imageSmoothingEnabled=false;renderer.drawHomeMaterialWallpaper(c,room);
 const dadoY=area.y+area.h-22,inner=dadoArtRect(area,finish.trimPresentation),pixels=materialPixels(canvas,inner);
 for(const color of [[235,40,50],[22,75,204],[23,190,68]])assert(materialHasColor(pixels,color),'Every native top, middle and bottom marker remains inside the framed ornament');
 assert.deepEqual([...materialPixels(canvas,{x:area.x+10,y:dadoY,w:1,h:1})],[191,161,102,255],'The top has one continuous gold cap');
 assert.deepEqual([...materialPixels(canvas,{x:area.x+10,y:dadoY+1,w:1,h:1})],[48,35,30,255],'A dark shadow separates the cap from the complete motif');
 assert.deepEqual([...materialPixels(canvas,{x:area.x+10,y:dadoY+19,w:1,h:1})],[48,35,30,255],'The lower moulding sits below the artwork');
 const legacy=renderer.createCanvas(140,140),lc=legacy.getContext('2d');lc.imageSmoothingEnabled=false;renderer.drawHomeMaterialWallpaper(lc,{...room,wallpaper:{...finish,trimPresentation:{scaleX:.65,scaleY:1}}});
 const old=materialPixels(legacy,{x:area.x,y:dadoY,w:area.w,h:22});
 assert.equal(materialHasColor(old,[23,190,68]),false,'The opt-in fit must not change the legacy authored-repeat presentation');
});

test('Victorian framed frieze preserves horizontal phase across wall joins and fits each wall height locally',async()=>{
 const renderer=pixelMaterialRenderer(),suite=getHomeMaterialSuite('showroom-victorian-parlor');await renderer.warmHomeMaterials(suite);
 const style=suite.wallpaper.trimPresentation;assert.equal(style.fitHeight,true);assert.equal(style.style,'complete-scroll');assert.equal(style.insetTop,4);assert.equal(style.insetBottom,4);
 for(const other of HOME_MATERIAL_SUITES)if(other!==suite){assert.equal(other.wallpaper.trimPresentation.fitHeight,undefined,'The other30 authored trim presentations stay unchanged');assert.equal(other.wallpaper.trimPresentation.style,undefined);}
 const wall={x:13,y:7,w:296,h:106},whole=renderer.createCanvas(340,160),joined=renderer.createCanvas(340,160),shifted=renderer.createCanvas(340,160),paint=(canvas,areas)=>{const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;renderer.drawHomeMaterialWallpaper(c,{wallpaper:suite.wallpaper,wallpaperAreas:areas});};
 paint(whole,[wall]);paint(joined,[{...wall,w:151},{...wall,x:164,w:145}]);paint(shifted,[{...wall,y:21,h:74}]);
 const art=dadoArtRect(wall,style);
 assert.deepEqual(materialPixels(joined,art),materialPixels(whole,art),'Splitting a wall must not restart the gold ornament repeat');
 assert.deepEqual(materialPixels(shifted,dadoArtRect({...wall,y:21,h:74},style)),materialPixels(whole,art),'A different wall height still contains the same full ornament, with its baseline anchored locally');
});

test('complete Victorian scrolls have visible breathing room above and below every floral motif',async()=>{
 const renderer=pixelMaterialRenderer(),suite=getHomeMaterialSuite('showroom-victorian-parlor'),wallpaper={...suite.wallpaper,trimPresentation:{...suite.wallpaper.trimPresentation,opacity:0}};
 const wall={x:13,y:7,w:296,h:106},canvas=renderer.createCanvas(340,140),c=canvas.getContext('2d');c.imageSmoothingEnabled=false;renderer.drawHomeMaterialWallpaper(c,{wallpaper,wallpaperAreas:[wall]});
 const style=wallpaper.trimPresentation,rect=dadoArtRect(wall,style),art=materialPixels(canvas,rect),inkRows=[];
 for(let y=0;y<rect.h;y++){let ink=0;for(let x=0;x<rect.w;x++){const i=(y*rect.w+x)*4;if(art[i]>150&&art[i+1]>110&&art[i+2]>55)ink++;}if(ink)inkRows.push(y);}
 assert(inkRows.length>=5,'The bounded band actually draws detailed gold flowers and scrolling vines');
 assert(inkRows[0]>=2,'The complete petal tips have clear space below the top moulding');
 assert(inkRows.at(-1)<rect.h-2,'The full vine curls stay clear of the bottom moulding');
 assert(style.insetTop+inkRows[0]>=4,'The motif leaves at least four full-band pixels above its highest tip');
 assert(style.insetBottom+rect.h-1-inkRows.at(-1)>=4,'The motif leaves at least four full-band pixels below its lowest curl');
});

test('floor material, clipping and glaze use visual floor bounds without changing the logical room',async()=>{
 const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas'),blue=createCanvas(4,4);blue.getContext('2d').fillStyle='#0000ff';blue.getContext('2d').fillRect(0,0,4,4);
 const renderer=pixelMaterialRenderer(new Map([['probe-floor.webp',blue]])),finish={homeMaterial:true,colors:['#ff0000'],texture:'probe-floor.webp',glaze:.5};await renderer.warmHomeMaterials({assets:['probe-floor.webp']});
 const room={x:32,y:30,w:30,h:24,floorBounds:{x:8,y:11,w:91,h:70},floorFinish:finish},before=structuredClone(room),canvas=renderer.createCanvas(120,100),c=canvas.getContext('2d');c.imageSmoothingEnabled=false;renderer.drawHomeMaterialFloor(c,room);
 const inside=[...materialPixels(canvas,{x:10,y:13,w:1,h:1})],middle=[...materialPixels(canvas,{x:40,y:40,w:1,h:1})];
 assert.deepEqual(inside,middle,'The texture and glaze extend through the full visual kitchen floor');assert(inside[0]>110&&inside[2]>110&&inside[3]===255);
 for(const point of [{x:7,y:20},{x:99,y:20},{x:20,y:10},{x:20,y:81}])assert.equal(materialPixels(canvas,{...point,w:1,h:1})[3],0,'Painting remains clipped to the visual floor boundary');
 assert.deepEqual(room,before,'Painting never moves the logical room or its floor region');
 const legacy=renderer.createCanvas(120,100),lc=legacy.getContext('2d');renderer.drawHomeMaterialFloor(lc,{...room,floorBounds:undefined});assert.equal(materialPixels(legacy,{x:10,y:13,w:1,h:1})[3],0);assert.equal(materialPixels(legacy,{x:40,y:40,w:1,h:1})[3],255,'Other room floors still use their original bounds');
});

test('Victorian bathroom rug draws detailed cropped native art in its exact rectangle and reuses the decoded bitmap',async()=>{
 const renderer=pixelMaterialRenderer(),suite=getHomeMaterialSuite('showroom-victorian-parlor'),assets=suite.assets,rug={x:12,y:11,w:96,h:56,texture:suite.decorativeRugTexture,sourceRect:{x:104,y:110,w:1436,h:738}},before=structuredClone(rug),canvas=renderer.createCanvas(120,80),c=canvas.getContext('2d');
 assert.equal(rug.texture,'victorian-bath-rug.png');assert.equal(assets.length,4,'The optional rug does not alter the four authored material assets');
 assert.equal(renderer.drawHomeMaterialRug(c,{x:12,y:11,w:96,h:56}),false);assert.equal(renderer.drawHomeMaterialRug(c,rug),false,'Unready artwork reports fallback instead of drawing a substitute');
 await renderer.warmHomeMaterials(suite);assert.equal(renderer.getHomeMaterialCacheStats().ready,5);assert.equal(renderer.operations.fetches,5);assert.equal(renderer.operations.decodes,5);assert.equal(renderer.operations.canvases,0,'Warming native rugs does not allocate procedural decoder canvases');
 const allocations={...renderer.operations};await renderer.warmHomeMaterials(suite);assert.deepEqual(renderer.operations,allocations,'Re-entering the suite reuses every decoded material and rug');assert.equal(suite.assets,assets);
 c.imageSmoothingEnabled=true;assert.equal(renderer.drawHomeMaterialRug(c,rug),true);assert.equal(c.imageSmoothingEnabled,true,'Nearest-pixel rug drawing restores the surrounding context');
 const pixels=materialPixels(canvas,{x:0,y:0,w:120,h:80}),colors=new Set();let left=120,right=0,top=80,bottom=0,opaque=0;
 for(let y=0;y<80;y++)for(let x=0;x<120;x++){
  const i=(y*120+x)*4,alpha=pixels[i+3];if(x<rug.x||x>=rug.x+rug.w||y<rug.y||y>=rug.y+rug.h){assert.equal(alpha,0,'The native asset adds no painted pixels or extra shadow outside the existing rug rectangle');continue;}
  if(alpha>=240){opaque++;colors.add([pixels[i],pixels[i+1],pixels[i+2]].join(','));left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 }
 assert(opaque>2000&&colors.size>150,'The 96×56 mat retains substantial native weaving, fringe and ornamental color detail');
 assert(right-left+1>=90&&bottom-top+1>=50,'The source crop fills the intended mat instead of shrinking transparent source margins into it');
 assert.deepEqual(rug,before,'Native art does not alter rug geometry or source metadata');assert.deepEqual(renderer.operations,allocations,'Painting allocates no new image decoder or texture request');
});
