'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const lights=require('../dj-floodlights.js');
function asset(overrides={}){return {id:'rig',x:100,y:200,w:200,h:40,rotation:0,opacity:100,visible:true,floodLights:lights.defaults(),...overrides};}
function fixture(value=asset()){
 let assets=[value],time=0,quality='full',reduced=false,animation={};
 const renderer=lights.create({getAssets:()=>assets,getTime:()=>time,getQuality:()=>quality,reducedMotion:()=>reduced,getAnimation:()=>animation});
 return {renderer,time:value=>time=value,quality:value=>quality=value,reduced:value=>reduced=value,assets:value=>assets=value,animation:value=>animation=value};
}
function context(){
 const calls=[],stack=[];
 const ctx={calls,globalAlpha:.8,globalCompositeOperation:'source-over',shadowBlur:0,
  save(){stack.push({globalAlpha:this.globalAlpha,globalCompositeOperation:this.globalCompositeOperation,shadowBlur:this.shadowBlur});},restore(){Object.assign(this,stack.pop());},
  translate(...p){calls.push(['translate',...p]);},rotate(...p){calls.push(['rotate',...p]);},scale(...p){calls.push(['scale',...p]);},
  beginPath(){calls.push(['begin']);},moveTo(...p){calls.push(['move',...p]);},lineTo(...p){calls.push(['line',...p]);},closePath(){calls.push(['close']);},
  ellipse(...p){calls.push(['ellipse',...p]);},
  fill(){calls.push(['fill',this.globalAlpha,this.globalCompositeOperation]);},fillRect(...p){calls.push(['rect',this.globalAlpha,...p]);},
  createLinearGradient(...points){const stops=[];calls.push(['linear',points,stops]);return {addColorStop:(position,color)=>stops.push([position,color])};},
  createRadialGradient(...points){const stops=[];calls.push(['radial',points,stops]);return {addColorStop:(position,color)=>stops.push([position,color])};}};
 return ctx;
}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,actual+' should equal '+expected);

test('portable settings require only the supported bounded light controls',()=>{
 assert.equal(lights.validate(lights.defaults()),true);const copy=lights.defaults();copy.enabled=false;assert.equal(lights.defaults().enabled,true);
 for(const patch of [{version:2},{enabled:1},{speed:-1},{speed:4.01},{intensity:101},{intensity:NaN},{beamLength:19},{beamLength:501},{script:'alert(1)'}])assert.equal(lights.validate({...lights.defaults(),...patch}),false);
 for(const field of Object.keys(lights.defaults())){const next=lights.defaults();delete next[field];assert.equal(lights.validate(next),false);}
 for(const patch of [{speed:0,intensity:0,beamLength:20},{speed:4,intensity:100,beamLength:500}])assert.equal(lights.validate({...lights.defaults(),...patch}),true);
});

test('four can faces and beam origins share position, rotation, resize and animation',()=>{
 const f=fixture(asset({rotation:90,opacity:50}));f.animation({dx:5,dy:-7,rot:0,scale:2,alpha:.5});
 const rig=f.renderer.snapshot().rigs[0];assert.equal(rig.heads.length,4);near(rig.opacity,.25);near(rig.rotation,Math.PI/2);
 near(rig.x,105);near(rig.y,193);near(rig.heads[0].x,105-40*.33*2);near(rig.heads[0].y,193+(.170899-.5)*200*2);
 const first=rig.heads[0];near(first.localY,13.2);assert.ok(rig.heads.every(head=>Number.isFinite(head.x)&&Number.isFinite(head.y)));
 f.assets([asset({w:400,h:80})]);const resized=f.renderer.snapshot().rigs[0];near(resized.heads[0].localX,(.170899-.5)*400);near(resized.heads[0].localY,26.4);
});

test('mirrored floodlight beams follow the reflected artwork while local LED geometry stays intact',()=>{
 const value=asset({rotation:30,flipX:true,flipY:true}),f=fixture(value);
 f.animation({dx:5,dy:-7,rot:Math.PI/3,scale:2});
 const rig=f.renderer.snapshot().rigs[0];
 near(rig.scale,2);near(rig.scaleX,-2);near(rig.scaleY,-2);
 near(rig.rotation,Math.PI/2);near(rig.x,105);near(rig.y,193);
 const first=rig.heads[0];
 near(first.localX,(.170899-.5)*200);near(first.localY,40*.33);
 near(first.x,105+first.localY*2);near(first.y,193-first.localX*2);
 const beam=context();f.renderer.drawBeams(beam);
 assert.deepEqual(beam.calls.find(call=>call[0]==='scale'),['scale',-2,-2]);
 const mirroredFaces=context();f.renderer.drawFixture(mirroredFaces,value);
 value.flipX=false;value.flipY=false;
 const restored=f.renderer.snapshot().rigs[0];near(restored.scaleX,2);near(restored.scaleY,2);
 near(restored.heads[0].x,105-first.localY*2);near(restored.heads[0].y,193+first.localX*2);
 const normalFaces=context();f.renderer.drawFixture(normalFaces,value);
 assert.deepEqual(mirroredFaces.calls.filter(call=>call[0]==='ellipse'),normalFaces.calls.filter(call=>call[0]==='ellipse'),
  'The parent asset transform mirrors the seven-LED faces once; local face geometry must not mirror a second time');
});

test('the stage rig projects its four floor pools onto the dance tiles and transforms their endpoints',()=>{
 const stage=asset({x:391,y:524,w:210,h:48,floodLights:{...lights.defaults(),intensity:75,beamLength:280}});
 const f=fixture(stage),rig=f.renderer.snapshot().rigs[0];
 for(const head of rig.heads){
  near(head.y,539.84);near(head.endY,819.84);
  assert.ok(head.endX>120&&head.endX<680,'Floor pools must reach the painted dancefloor');
  near(head.endLocalY-head.localY,280);
 }
 const ctx=context();f.renderer.drawBeams(ctx);
 const gradients=ctx.calls.filter(call=>call[0]==='linear').filter((call,index)=>index%2===0);
 for(const [index,call]of gradients.entries())assert.deepEqual(call[1],[rig.heads[index].localX,rig.heads[index].localY,rig.heads[index].endLocalX,rig.heads[index].endLocalY]);
 stage.rotation=90;stage.flipX=true;f.animation({scale:1.5,dx:8,dy:-4});
 const turned=f.renderer.snapshot().rigs[0];
 for(const head of turned.heads){near(head.endX,399-head.endLocalY*1.5);near(head.endY,520-head.endLocalX*1.5);}
});

test('color cycles are gradual while speed zero and reduced motion remain stationary',()=>{
 const f=fixture();const first=f.renderer.snapshot().rigs[0].heads;f.time(.01);const next=f.renderer.snapshot().rigs[0].heads;
 assert.ok(next.every((head,index)=>Math.abs(head.hue-first[index].hue)<1));assert.notDeepEqual(next.map(head=>head.color),first.map(head=>head.color));
 f.time(12);assert.deepEqual(f.renderer.snapshot().rigs[0].heads.map(head=>head.color),first.map(head=>head.color));
 f.assets([asset({floodLights:{...lights.defaults(),speed:0}})]);f.time(25);assert.deepEqual(f.renderer.snapshot().rigs[0].heads.map(head=>head.color),first.map(head=>head.color));
 f.assets([asset()]);f.reduced(true);const still=f.renderer.snapshot().rigs[0].heads;f.time(100);assert.deepEqual(f.renderer.snapshot().rigs[0].heads,still);
});

test('full and lite render bounded beams with four floor pools and restore the caller context',()=>{
 const f=fixture(asset({opacity:50})),full=context();f.renderer.drawBeams(full);
 assert.equal(full.calls.filter(call=>call[0]==='linear').length,8);assert.equal(full.calls.filter(call=>call[0]==='radial').length,4);assert.equal(full.calls.filter(call=>call[0]==='fill').length,8);
 assert.ok(full.calls.filter(call=>call[0]==='fill').every(call=>call[1]===.4&&call[2]==='screen'));assert.equal(full.globalAlpha,.8);assert.equal(full.globalCompositeOperation,'source-over');
 f.quality('lite');const lite=context();f.renderer.drawBeams(lite);assert.equal(lite.calls.filter(call=>call[0]==='linear').length,4);assert.equal(lite.calls.filter(call=>call[0]==='radial').length,0);
 const faces=context();f.renderer.drawFixture(faces,asset());assert.equal(faces.calls.filter(call=>call[0]==='ellipse').length,4*7*2);assert.equal(faces.calls.filter(call=>call[0]==='rect').length,0,'Lite faces tint round LEDs without a rectangle over the can');assert.ok(faces.calls.filter(call=>call[0]==='fill').every(call=>call[2]==='source-over'));assert.equal(faces.globalAlpha,.8);
});

test('hidden, transparent, disabled, zero-power, and off-quality rigs emit nothing',()=>{
 const f=fixture();
 for(const value of [asset({visible:false}),asset({opacity:0}),asset({floodLights:{...lights.defaults(),enabled:false}}),asset({floodLights:{...lights.defaults(),intensity:0}})]){
  f.assets([value]);const ctx=context();f.renderer.drawBeams(ctx);f.renderer.drawFixture(ctx,value);assert.deepEqual(ctx.calls,[]);assert.equal(f.renderer.snapshot().rigs[0].enabled,false);
 }
 f.assets([asset()]);f.quality('off');const ctx=context();f.renderer.drawBeams(ctx);f.renderer.drawFixture(ctx,asset());assert.deepEqual(ctx.calls,[]);
 f.quality('full');f.assets([asset({floodLights:{...lights.defaults(),speed:'1'}}),asset({w:0})]);assert.deepEqual(f.renderer.snapshot().rigs,[]);
});
