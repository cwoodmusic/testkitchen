import test from 'node:test';
import assert from 'node:assert/strict';
import {renderCityNight,cityFireflies,cityLights,fireflyPose,cityLightBounds,cityLightVisible} from './city-night.mjs';

test('directional lamp glow follows the upright view at every facing without loading sprite images',()=>{
 const asset={id:'decor-14-01',w:100,h:300,boxes:[{x:40,y:260,w:20,h:40}],getFacingView:()=>({w:100,h:300,footCenter:{x:50,y:280}}),getFacingImage(){throw Error('Light geometry must not request artwork');}};
 const catalog=new Map([[asset.id,asset]]),doc={cells:{'15,15':{surface:'grass',level:2}},objects:[]};
 for(const rotation of [0,90,180,270]){
  doc.objects=[{asset:asset.id,x:1000,y:1000,scale:1,rotation}];const [lamp]=cityLights(doc,catalog);
  assert(lamp.y<lamp.gy-200,'The glow fell below its upright lamp at '+rotation);
  if(rotation===0){assert.equal(lamp.x,1000);assert.equal(lamp.y,670);assert.equal(lamp.gy,916);}
 }
});

function context(){
 const stack=[];
 return {
  globalAlpha:1,globalCompositeOperation:'source-over',imageSmoothingEnabled:false,fillStyle:'#123456',saves:0,restores:0,commands:[],
  save(){this.saves++;stack.push({globalAlpha:this.globalAlpha,globalCompositeOperation:this.globalCompositeOperation,imageSmoothingEnabled:this.imageSmoothingEnabled,fillStyle:this.fillStyle});},
  restore(){this.restores++;assert(stack.length>0);Object.assign(this,stack.pop());},
  get stackDepth(){return stack.length;},
  setTransform(){},scale(){},clearRect(){},
  createRadialGradient(){return {addColorStop(){}};},
  drawImage(_image,...coordinates){this.commands.push({kind:'image',coordinates,alpha:this.globalAlpha,composite:this.globalCompositeOperation,smoothing:this.imageSmoothingEnabled});},
  fillRect(...coordinates){this.commands.push({kind:'rect',coordinates,alpha:this.globalAlpha,composite:this.globalCompositeOperation,color:this.fillStyle});}
 };
}
function canvasDocument(){return {createElement(){const c=context();return {width:0,height:0,getContext:()=>c};}};}
function expectedFireflyCommands(doc,catalog,cam,w,h,time,baseAlpha){
 const commands=[];
 for(const f of cityFireflies(doc,catalog,cam,w,h,time)){
  const p={x:(f.x-cam.x)*cam.zoom+w/2,y:(f.y-cam.y)*cam.zoom+h/2},r=Math.max(6,f.glowRadius*cam.zoom);
  if(p.x<-r||p.y<-r||p.x>w+r||p.y>h+r)continue;
  // This is the prior saved-state behaviour: each particle begins with the
  // caller's alpha, multiplies its own pulse, then restores that caller alpha.
  const alpha=baseAlpha*f.alpha,size=Math.max(1.5,f.size*cam.zoom);
  commands.push({kind:'image',coordinates:[p.x-r,p.y-r,r*2,r*2],alpha,composite:'screen',smoothing:true});
  commands.push({kind:'rect',coordinates:[Math.round(p.x-size/2),Math.round(p.y-size/2),size,size],alpha,composite:'screen',color:'rgba(234,255,173,.92)'});
 }
 return commands;
}

test('larger firefly bloom preserves caller opacity and uses only the outer canvas state save',()=>{
 const previousDocument=globalThis.document;globalThis.document=canvasDocument();
 try{
  const doc={cells:{},objects:[]},catalog=new Map(),cam={x:2500,y:3300,zoom:.8},w=1280,h=800;
  for(const baseAlpha of [1,.37]){
   const c=context();Object.assign(c,{globalAlpha:baseAlpha,globalCompositeOperation:'multiply',fillStyle:'#73513c'});
   for(const time of [0,1.75,43]){
    c.commands=[];c.saves=0;c.restores=0;
    const expected=expectedFireflyCommands(doc,catalog,cam,w,h,time,baseAlpha);
    assert(expected.length>=8,'The scene must contain several visible fireflies');
    renderCityNight(c,doc,cam,w,h,time,{catalog});
    // The first two commands composite the unchanged darkness and bloom fields.
    assert.deepEqual(c.commands.slice(2),expected);
    assert.equal(c.saves,1);assert.equal(c.restores,1);assert.equal(c.stackDepth,0);
    assert.equal(c.globalAlpha,baseAlpha);assert.equal(c.globalCompositeOperation,'multiply');assert.equal(c.imageSmoothingEnabled,false);assert.equal(c.fillStyle,'#73513c');
   }
  }
 }finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});


test('fireflies take continuous curved flights with hovering pauses and independent flashes',()=>{
 const speeds=[],positions=[],flashes=[];
 for(const seed of [.12,.43,.89]){
  const period=5.2+seed*3.1;
  for(let n=4;n<12;n++){
   const t=(n-seed*13)*period,a=fireflyPose(500,700,seed,t-.0001),b=fireflyPose(500,700,seed,t+.0001);
   assert(Math.hypot(b.x-a.x,b.y-a.y)<.02,'A new flight must join smoothly, without a terrain or waypoint jump');
  }
  const localSpeeds=[],alphas=[];
  for(let t=0;t<40;t+=.025){
   const a=fireflyPose(500,700,seed,t),b=fireflyPose(500,700,seed,t+.01),speed=Math.hypot(b.x-a.x,b.y-a.y)/.01;
   assert(Number.isFinite(speed)&&speed<220,'Flight remains smooth and bounded rather than teleporting');
   assert(Math.hypot(a.x-500,a.y-700)<220,'Each insect stays near its own home patch');
   assert(a.glowRadius>=48&&a.glowRadius<=66&&a.glowRadius>22*2,'Soft halo is more than twice the old radius while the insect stays tiny');
   localSpeeds.push(speed);alphas.push(a.alpha);
  }
  assert(Math.min(...localSpeeds)<3&&Math.max(...localSpeeds)>30,'Each insect alternates hovering and faster flight');
  assert(Math.min(...alphas)<.03&&Math.max(...alphas)>.95,'Flashes have a dark interval and a distinct bright pulse');
  speeds.push(localSpeeds);positions.push(fireflyPose(500,700,seed,7));flashes.push(fireflyPose(500,700,seed,7).alpha);
 }
 assert.notDeepEqual(speeds[0],speeds[1]);assert.notEqual(positions[0].x,positions[1].x);assert(new Set(flashes).size>1,'All insects must not pulse in unison');
});

test('world-anchored fireflies retain their poses across camera motion and freeze for reduced motion',()=>{
 const doc={cells:{},objects:[]},catalog=new Map(),cam={x:2500,y:3300,zoom:.8};
 const a=cityFireflies(doc,catalog,cam,1280,800,12),b=cityFireflies(doc,catalog,{...cam,x:2540,y:3320},1280,800,12),byId=new Map(b.map(f=>[f.id,f]));
 const common=a.filter(f=>byId.has(f.id));assert(common.length>8);for(const f of common)assert.deepEqual(f,byId.get(f.id),'Panning cannot move a world firefly');
 const original=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:true});
 try{assert.deepEqual(cityFireflies(doc,catalog,cam,1280,800,0),cityFireflies(doc,catalog,cam,1280,800,100));}
 finally{if(original===undefined)delete globalThis.matchMedia;else globalThis.matchMedia=original;}
});

test('larger glow culling retains offscreen lamps, their ground pools, and tall upward beams',()=>{
 const cam={x:0,y:0,zoom:1},lamp={x:730,y:0,gx:730,gy:300,radius:430,kind:'lamp'};
 const bounds=cityLightBounds(lamp);assert.equal(bounds.x,730-430*1.55);assert(bounds.y+bounds.h>=300+430*1.55);
 assert(cityLightVisible(lamp,cam,200,200),'The expanded halo reaches the view while its source is offscreen');
 assert(cityLightVisible({...lamp,x:0,y:-1400,gx:0,gy:0},cam,200,200),'A tall lamp still lights its visible ground pool');
 assert(cityLightVisible({x:0,y:1100,radius:50,kind:'uplight',beamHeight:1000,beamWidth:200},cam,200,200),'An upward beam remains visible above its offscreen fixture');
 assert.equal(cityLightVisible({...lamp,x:5000,gx:5000},cam,200,200),false);
});

test('moving and flashing insects reuse cached glow brushes without per-frame canvas or gradient allocation',()=>{
 const original=globalThis.document;let canvases=0,gradients=0;
 globalThis.document={createElement(){canvases++;const c=context();c.createRadialGradient=()=>{gradients++;return {addColorStop(){}};};return {width:0,height:0,getContext:()=>c};}};
 try{
  const c=context(),doc={cells:{},objects:[]},catalog=new Map(),cam={x:2500,y:3300,zoom:.8};
  renderCityNight(c,doc,cam,1280,800,0,{catalog});const before={canvases,gradients};
  for(let n=1;n<90;n++)renderCityNight(c,doc,cam,1280,800,n/60,{catalog});
  assert.deepEqual({canvases,gradients},before,'Flashing changes alpha and flight position, not the cached gradient pixels');
 }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});

test('actual lamp, window, neon, door and uplight render fields extend beyond their old bloom sizes',()=>{
 const original=globalThis.document;
 try{
  for(const kind of ['lamp','window','neon','door','uplight']){
   const made=[];globalThis.document={createElement(){const c=context(),canvas={width:0,height:0,getContext:()=>c,context:c};made.push(canvas);return canvas;}};
   const id=kind==='door'?'coda-furnishings':'test-'+kind;
   const asset={id,w:1000,h:1000,...(kind==='door'?{}:{lightEmitters:[{u:.5,v:.5,kind,radius:100,power:1,beamHeight:400,beamWidth:200}]})};
   const doc={cells:{},objects:[{id:'fixture',asset:id,x:1000,y:1000,scale:1,rotation:0}]},before=JSON.stringify(doc),catalog=new Map([[id,asset]]),c=context();
   renderCityNight(c,doc,{x:1000,y:700,zoom:1},800,800,0,{catalog});
   const bloom=made[1].context.commands.filter(c=>c.kind==='image'),width=Math.max(...bloom.map(c=>c.coordinates[2])),height=Math.max(...bloom.map(c=>c.coordinates[3]));
   if(kind==='lamp'||kind==='neon')assert(width>=310,kind+' halo grows beyond the old200px diameter');
   else if(kind==='window')assert(width>=270,'Window glow grows beyond the old170px diameter');
   else if(kind==='door')assert(width>=1054,'The doorway halo grows beyond the old680px diameter');
   else assert(width>192&&height>312,'An uplight beam spreads wider and higher than its original field');
   assert.equal(JSON.stringify(doc),before,'Night effects must not change placed assets or terrain');
  }
 }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});


test('authored concert-hall doorway lights retain a finite ground anchor for their larger halo',()=>{
 const asset={id:'test-concert-door',w:1000,h:1000,lightEmitters:[{u:.5,v:.85,kind:'door',radius:430,power:1}]};
 const doc={cells:{},objects:[{asset:asset.id,x:2000,y:2000,scale:1,rotation:0}]};
 const [light]=cityLights(doc,new Map([[asset.id,asset]]));
 assert.equal(light.kind,'door');assert.equal(light.gx,2000);assert.equal(light.gy,2000);assert(light.y<light.gy);assert(Object.values(cityLightBounds(light)).every(Number.isFinite));
});
