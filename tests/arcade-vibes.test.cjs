'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {KEY,DEFINITIONS,GRADES,SCENERY_MAX_PIXELS,create}=require('../arcade-vibes.js');

function fixture(options={}){
 let level=1,quality='full',reduced=false,time=0;
 const values=new Map(),writes=[],body={dataset:{}};
 const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>{writes.push([key,value]);values.set(key,value);}};
 if(options.saved)values.set(KEY,JSON.stringify(options.saved));
 const vibe=create({body,storage,getLevel:()=>level,getQuality:()=>quality,reducedMotion:()=>reduced,getTime:()=>time,makeCanvas:canvas,...options.api});
 return {vibe,body,values,writes,level:value=>level=value,quality:value=>quality=value,reduced:value=>reduced=value,time:value=>time=value};
}
function context(){
 const calls=[],stack=[],sources=[];
 const g={calls,sources,globalAlpha:.4,globalCompositeOperation:'multiply',shadowBlur:11,lineWidth:7,lineCap:'butt',fillStyle:'original',strokeStyle:'original',
  save(){stack.push(Object.fromEntries(['globalAlpha','globalCompositeOperation','shadowBlur','lineWidth','lineCap','fillStyle','strokeStyle'].map(key=>[key,this[key]])));},
  restore(){Object.assign(this,stack.pop());},
  fillRect(...args){calls.push(['rect',...args,this.fillStyle,this.globalAlpha,this.globalCompositeOperation]);},
  drawImage(image,...args){sources.push(image);calls.push(['image',...args,this.globalAlpha]);},
  setTransform(...args){calls.push(['transform',...args]);},clearRect(...args){calls.push(['clear',...args]);},
  beginPath(){calls.push(['path']);},moveTo(...args){calls.push(['move',...args]);},lineTo(...args){calls.push(['line',...args]);},
  closePath(){},fill(){calls.push(['fill',this.fillStyle,this.globalAlpha]);},stroke(){calls.push(['stroke',this.strokeStyle,this.lineWidth]);},translate(){},scale(){},
  createRadialGradient(){return {addColorStop(){}};}
 };return g;
}
function canvas(){const g=context();return {width:0,height:0,getContext:()=>g};}

test('vibes unlock at the authored milestone levels and low-level choices cannot persist',()=>{
 assert.deepEqual(DEFINITIONS.map(item=>[item.id,item.minLevel]),[['classic',1],['glowstick',20],['spooky',30],['aurora',40],['festival',50]]);
 const f=fixture();assert.equal(f.vibe.setVibe('glowstick'),false);assert.equal(f.writes.length,0);assert.equal(f.vibe.getState().active,'classic');
 for(const definition of DEFINITIONS){f.level(definition.minLevel);assert.equal(f.vibe.setVibe(definition.id),true);assert.equal(f.vibe.getState().active,definition.id);}
 assert.equal(f.vibe.setVibe('__proto__'),false);assert.equal(f.vibe.setVibe('constructor'),false);
});

test('a saved high-level vibe never activates for another low-level player',()=>{
 const f=fixture({saved:{version:1,selected:'festival'}});assert.equal(f.vibe.getState().selected,'festival');assert.equal(f.vibe.getState().active,'classic');assert.equal(f.body.dataset.arcadeVibe,'classic');
 f.level(50);f.vibe.refresh();assert.equal(f.vibe.getState().active,'festival');assert.equal(f.body.dataset.arcadeVibe,'festival');
 f.level(1);f.vibe.refresh();assert.equal(f.vibe.getState().active,'classic');assert.equal(f.body.dataset.arcadeVibe,'classic');
 assert.equal(f.writes.length,0,'Changing profiles must not write or mint a reward');
});

test('preference persistence contains only the selected vibe and storage failures retain the visit choice',()=>{
 const f=fixture();f.level(20);assert.equal(f.vibe.setVibe('glowstick'),true);assert.deepEqual(JSON.parse(f.values.get(KEY)),{version:1,selected:'glowstick'});
 const broken=fixture({api:{storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}}});broken.level(20);assert.equal(broken.vibe.setVibe('glowstick'),true);assert.equal(broken.vibe.getState().persistent,false);assert.equal(broken.vibe.getState().active,'glowstick');
});

test('classic draws nothing and each unlocked atmosphere restores its Canvas state',()=>{
 const f=fixture(),g=context();assert.equal(f.vibe.drawAtmosphere(g,{width:1672,height:941,time:1}),false);assert.deepEqual(g.calls,[]);
 f.level(50);
 for(const definition of DEFINITIONS.slice(1)){
  f.vibe.setVibe(definition.id);const original={alpha:g.globalAlpha,operation:g.globalCompositeOperation,blur:g.shadowBlur};g.calls.length=0;
  assert.equal(f.vibe.drawAtmosphere(g,{width:1672,height:941,time:2,lights:[{x:800,y:250,radius:120,color:'#44bbff'}]}),true);assert.ok(g.calls.length>0&&g.calls.length<500);
  assert.deepEqual({alpha:g.globalAlpha,operation:g.globalCompositeOperation,blur:g.shadowBlur},original);
 }
});

test('reduced motion and Effects Off freeze decorations and keep draw work bounded',()=>{
 const f=fixture();f.level(50);
 for(const id of ['glowstick','spooky','aurora','festival']){
  f.vibe.setVibe(id);f.reduced(true);const first=context(),last=context();f.vibe.drawAtmosphere(first,{width:1000,height:620,time:0});f.vibe.drawAtmosphere(last,{width:1000,height:620,time:100});assert.deepEqual(first.calls,last.calls,id+' reduced motion');
  f.reduced(false);f.quality('off');const off=context();f.vibe.drawAtmosphere(off,{width:1000,height:620,time:50});assert.ok(off.calls.length<50);assert.equal(f.vibe.getState().quality,'off');f.quality('full');
 }
});

test('every character can receive a bright glowstick without touching its profile or leaving context effects',()=>{
 const f=fixture(),actor={x:400,y:300,scale:1,facing:'left',time:1},before=JSON.stringify(actor),g=context();
 assert.equal(f.vibe.drawCharacterGlow(g,actor),false);f.level(20);f.vibe.setVibe('glowstick');assert.equal(f.vibe.drawCharacterGlow(g,actor),true);
 assert.equal(JSON.stringify(actor),before);assert.equal(g.calls.filter(call=>call[0]==='stroke').length,3);assert.equal(g.shadowBlur,11);assert.equal(g.globalCompositeOperation,'multiply');assert.equal(g.globalAlpha,.4);
 f.quality('off');g.calls.length=0;f.vibe.drawCharacterGlow(g,actor);assert.equal(g.calls.filter(call=>call[0]==='image').length,0,'FX off keeps the rod but omits its glow atlas');assert.equal(g.calls.filter(call=>call[0]==='stroke').length,3);
 f.level(1);assert.equal(f.vibe.drawCharacterGlow(g,actor),false,'A profile switch is gated even before the next atmosphere pass');
});

test('malformed preferences, anchors and actor positions cannot activate or expand drawing',()=>{
 const f=fixture({saved:{version:1,selected:'constructor'}});assert.equal(f.vibe.getState().active,'classic');f.level(50);f.vibe.setVibe('festival');
 const g=context();f.vibe.drawAtmosphere(g,{width:Infinity,height:NaN,time:NaN,lights:Array.from({length:1000},()=>({x:NaN,y:4,radius:Infinity,color:'url(evil)'}))});assert.ok(g.calls.length<500);
 assert.equal(f.vibe.drawCharacterGlow(g,{x:Infinity,y:4}),false);f.vibe.destroy();assert.equal(f.body.dataset.arcadeVibe,undefined);assert.equal(f.vibe.setVibe('classic'),false);assert.equal(f.vibe.drawAtmosphere(g),false);
});


test('split grade and luminous effects retain draw order without covering glowstick cores',()=>{
 const f=fixture();f.level(50);f.vibe.setVibe('glowstick');
 const grade=context();assert.equal(f.vibe.drawAtmosphere(grade,{width:1000,height:620,phase:'grade',time:1}),true);
 assert.equal(grade.calls.length,1);assert.equal(grade.calls[0][0],'rect');assert.equal(grade.calls[0].at(-1),'source-over');
 const effects=context();f.vibe.drawAtmosphere(effects,{width:1000,height:620,phase:'effects',time:1});
 assert.equal(effects.calls[0].at(-1),'screen','The foreground atmosphere adds light instead of darkening held rods');
 assert.equal(effects.globalCompositeOperation,'multiply');
 f.quality('off');const quiet=context();f.vibe.drawAtmosphere(quiet,{width:1000,height:620,time:10});
 assert.equal(quiet.calls.length,2,'Effects Off keeps only the static grade and colour wash');
});

test('glowstick bloom lights the character and nearby floor while the white core remains crisp',()=>{
 const f=fixture(),g=context();f.level(20);f.vibe.setVibe('glowstick');
 f.vibe.drawCharacterGlow(g,{x:400,y:300,scale:1,facing:'down',time:1});
 const bloom=g.calls.filter(call=>call[0]==='image');assert.ok(bloom.some(call=>call[3]>=80),'A broad halo reaches outside the physical rod');
 assert.ok(bloom.some(call=>call[2]>=265),'A separate light reaches the feet and floor');
 assert.ok(g.calls.some(call=>call[0]==='stroke'&&call[1]==='#f1fff8'&&call[2]<2),'A narrow white core stays sharp');
});

test('Halloween wardrobes are diverse catalog-valid previews and never alter identities or saved outfits',()=>{
 const scope={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../character-renderer.js'),'utf8'),scope);
 const renderer=scope.window.createCodaCharacterRenderer(),f=fixture();f.level(50);f.vibe.setVibe('spooky');
 const identity=Object.freeze({skin:'#885c43',hair:'#211e28',hairstyle:'curly',eyewear:'sunglasses',name:'Original musician',faceDetail:'miles',shirt:'#28384e',accessory:'trumpet'}),before=JSON.stringify(identity),looks=[];
 const ids=['bach','mozart','beethoven','clara','joplin','ellington','ella','nina','miles','dj','chopin','haydn','captain-cadence','visitor-vee-jay'];
 for(const id of ids){
  const look=f.vibe.characterAppearance(identity,{id,role:'npc'}),normalized=renderer.normalizeProfile(look);
  assert.notEqual(look,identity);assert.equal(look.skin,identity.skin);assert.equal(look.hair,identity.hair);assert.equal(look.hairstyle,identity.hairstyle);assert.equal(look.faceDetail,identity.faceDetail);assert.equal(look.name,identity.name);
  for(const key of ['outfit','headwear','accessory','shoes'])assert.equal(normalized[key],look[key],id+' '+key+' is supported by the real renderer');
  looks.push(JSON.stringify([look.shirt,look.outfit,look.headwear,look.accessory]));
  assert.deepEqual(f.vibe.characterAppearance(identity,{id,role:'npc'}),look,'A costume stays stable while an NPC moves');
 }
 assert.ok(new Set(looks).size>=10,'Musicians should not share one generic Halloween look');
 assert.equal(JSON.stringify(identity),before);assert.equal(f.writes.length,1,'Rendering costumes never persists NPC outfits');
 assert.equal(f.vibe.characterAppearance(identity,{id:'player',role:'player'}),identity,'The player keeps their chosen outfit');
 f.vibe.setVibe('classic');assert.equal(f.vibe.characterAppearance(identity,{id:'miles',role:'npc'}),identity,'Turning off the vibe restores the original appearance');
 f.vibe.setVibe('spooky');f.level(1);assert.equal(f.vibe.characterAppearance(identity,{id:'bach',role:'npc'}),identity,'Changing players does not retain unlocked costume effects');
});

test('Halloween details stay below the face and restore the caller canvas transform and paint state',()=>{
 const f=fixture();f.level(50);f.vibe.setVibe('spooky');
 for(const id of ['beethoven','joplin','chopin','mozart','ellington','ella']){
  const g=context(),before={alpha:g.globalAlpha,operation:g.globalCompositeOperation,blur:g.shadowBlur};
  assert.equal(f.vibe.drawCharacterCostume(g,{id,role:'npc',x:400,y:300,scale:1,facing:'down'}),true);
  assert.ok(g.calls.filter(call=>call[0]==='rect').every(call=>call[2]>=273),'Costume details leave the composer face visible');
  assert.deepEqual({alpha:g.globalAlpha,operation:g.globalCompositeOperation,blur:g.shadowBlur},before);
 }
 assert.equal(f.vibe.drawCharacterCostume(context(),{id:'player',role:'player',x:400,y:300}),false);
 assert.equal(f.vibe.drawCharacterCostume(context(),{id:'chopin',role:'npc',x:NaN,y:300}),false);
});

test('isolated scenery uses the world grade while retaining its alpha and original source',()=>{
 const f=fixture(),source=Object.freeze({width:140,height:90});
 assert.equal(f.vibe.getGradeFill(),null);assert.equal(f.vibe.gradeImage(source),null);f.level(50);
 for(const id of ['glowstick','spooky','aurora','festival']){
  f.vibe.setVibe(id);const writes=f.writes.length,world=context();
  f.vibe.drawAtmosphere(world,{width:140,height:90,phase:'grade'});
  const graded=f.vibe.gradeImage(source),g=graded.getContext('2d'),wash=g.calls.find(call=>call[0]==='rect');
  assert.equal(graded.width,140);assert.equal(graded.height,90);assert.deepEqual(g.sources,[source]);
  assert.equal(f.vibe.getGradeFill(),GRADES[id]);assert.equal(wash.at(-3),world.calls[0].at(-3),'A cutout must receive exactly the same colour as the floor behind it');
  assert.equal(wash.at(-1),'source-atop','Tint only source alpha; transparent margins and soft edges cannot become rectangular cutouts');
  assert.equal(wash.at(-2),1);assert.equal(g.globalCompositeOperation,'source-over');assert.equal(g.imageSmoothingEnabled,false);
  assert.equal(f.writes.length,writes,'Drawing scenery never changes player preferences');
 }
 assert.deepEqual(source,{width:140,height:90});
});

test('scenery crops cache independently and mutable-source revisions repaint the same canvas',()=>{
 const f=fixture(),source={width:320,height:200};f.level(20);f.vibe.setVibe('glowstick');
 const first=f.vibe.gradeImage(source,{crop:[16,20,120,80],revision:1});
 assert.equal(first.width,120);assert.equal(first.height,80);
 assert.deepEqual(first.getContext('2d').calls.find(call=>call[0]==='image').slice(1,9),[16,20,120,80,0,0,120,80]);
 assert.equal(f.vibe.gradeImage(source,{crop:[16,20,120,80],revision:1}),first);
 assert.deepEqual(f.vibe.getSceneryCacheState(),{entries:1,pixels:9600,maxPixels:SCENERY_MAX_PIXELS,maxEntries:256,builds:1,hits:1,allocations:1,evictions:0});
 source.edited=true;assert.equal(f.vibe.gradeImage(source,{crop:[16,20,120,80],revision:2}),first,'Pixel edits update the existing allocation');
 const second=f.vibe.gradeImage(source,{crop:[140,20,120,80],revision:2});assert.notEqual(second,first);
 const otherSource=f.vibe.gradeImage({width:320,height:200},{crop:[16,20,120,80],revision:2});assert.notEqual(otherSource,first,'Source identity is distinct even when dimensions and crop match');
 assert.equal(f.vibe.getSceneryCacheState().builds,4);assert.equal(f.vibe.getSceneryCacheState().allocations,3);
});

test('scenery cache evicts the least recently used images and bounds oversized inputs',()=>{
 const f=fixture();f.level(50);f.vibe.setVibe('spooky');
 const left={width:2048,height:2048},right={width:2048,height:2048};
 const a=f.vibe.gradeImage(left),b=f.vibe.gradeImage(right);assert.equal(f.vibe.getSceneryCacheState().pixels,SCENERY_MAX_PIXELS);
 assert.equal(f.vibe.gradeImage(left),a);const c=f.vibe.gradeImage({width:1024,height:1024});
 assert.equal(a.width,2048);assert.equal(b.width,0,'Evicted GPU surfaces are released');assert.equal(c.width,1024);
 assert.equal(f.vibe.getSceneryCacheState().evictions,1);assert.ok(f.vibe.getSceneryCacheState().pixels<=SCENERY_MAX_PIXELS);
 const large=f.vibe.gradeImage({width:65536,height:65536});assert.ok(large.width*large.height<=SCENERY_MAX_PIXELS);assert.equal(large.width,large.height);
 const narrow=f.vibe.gradeImage({width:65536,height:1});assert.ok(narrow.width<=8192);assert.ok(narrow.width*narrow.height<=SCENERY_MAX_PIXELS);
 for(let n=0;n<300;n++)f.vibe.gradeImage({width:1,height:1});
 const state=f.vibe.getSceneryCacheState();assert.ok(state.entries<=state.maxEntries);assert.ok(state.pixels<=state.maxPixels);
});

test('switching vibes or players releases graded scenery instead of retaining an unlocked filter',()=>{
 const f=fixture(),source={width:40,height:50};f.level(50);f.vibe.setVibe('spooky');
 const spooky=f.vibe.gradeImage(source);f.vibe.setVibe('aurora');assert.equal(spooky.width,0);assert.equal(f.vibe.getSceneryCacheState().entries,0);
 const aurora=f.vibe.gradeImage(source);assert.notEqual(aurora,spooky);
 f.level(1);assert.equal(f.vibe.gradeImage(source),null);assert.equal(aurora.width,0);assert.equal(f.vibe.getSceneryCacheState().pixels,0);
 f.level(50);const restored=f.vibe.gradeImage(source);assert.ok(restored);f.vibe.destroy();assert.equal(restored.width,0);assert.equal(f.vibe.gradeImage(source),null);
});

test('incomplete sources and malformed crop or revision data cannot allocate scenery',()=>{
 const f=fixture(),source={width:100,height:100};f.level(50);f.vibe.setVibe('festival');
 for(const invalid of [null,undefined,'not an image',{width:0,height:10},{width:Infinity,height:10},{width:10,height:NaN},{complete:false,naturalWidth:100,naturalHeight:100},{complete:true,naturalWidth:0,naturalHeight:0}])assert.equal(f.vibe.gradeImage(invalid),null);
 for(const options of [null,[],{crop:[0,0,100]},{crop:[-1,0,1,1]},{crop:[0,0,0,10]},{crop:[90,90,20,20]},{crop:[0,0,Infinity,1]},{revision:{}},{revision:NaN}])assert.equal(f.vibe.gradeImage(source,options),null);
 assert.equal(f.vibe.getSceneryCacheState().allocations,0);
});
