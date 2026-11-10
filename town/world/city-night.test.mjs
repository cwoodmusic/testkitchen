import test from 'node:test';
import assert from 'node:assert/strict';
import {renderCityNight,cityFireflies,cityLights} from './city-night.mjs';

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
  const p={x:(f.x-cam.x)*cam.zoom+w/2,y:(f.y-cam.y)*cam.zoom+h/2},r=Math.max(3,22*cam.zoom);
  if(p.x<-r||p.y<-r||p.x>w+r||p.y>h+r)continue;
  // This is the prior saved-state behaviour: each particle begins with the
  // caller's alpha, multiplies its own pulse, then restores that caller alpha.
  const alpha=baseAlpha*f.alpha,size=Math.max(1.5,f.size*cam.zoom);
  commands.push({kind:'image',coordinates:[p.x-r,p.y-r,r*2,r*2],alpha,composite:'screen',smoothing:true});
  commands.push({kind:'rect',coordinates:[Math.round(p.x-size/2),Math.round(p.y-size/2),size,size],alpha,composite:'screen',color:'rgba(234,255,173,.92)'});
 }
 return commands;
}

test('firefly draw commands retain the exact prior opacity and bloom while using only the outer canvas state save',()=>{
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
