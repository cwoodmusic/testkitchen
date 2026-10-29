const test=require('node:test'),assert=require('node:assert/strict');
const {createCodaFishingCaveEffects,buildWaterCells,CRYSTALS,LANTERNS}=require('../fishing-cave-effects.js');
function context(){return {calls:[],canvas:null,save(){this.calls.push(['save']);},restore(){this.calls.push(['restore']);},clearRect(...a){this.calls.push(['clear',...a]);},fillRect(...a){this.calls.push(['rect',...a]);},drawImage(...a){this.calls.push(['image',...a]);},beginPath(){},moveTo(){},lineTo(){},ellipse(){},stroke(){},createRadialGradient(){this.calls.push(['gradient']);return {addColorStop(){}};}};}
function fixture(options={}){let quality='full',reduced=false,allowed=options.isWater||((x,y)=>x>=200&&x<900&&y>=170&&y<540),canvases=[];const make=(width,height)=>{const g=context(),canvas={width,height,getContext:()=>g};g.canvas=canvas;canvases.push(canvas);return canvas;};const effects=createCodaFishingCaveEffects({isWater:(x,y)=>allowed(x,y),getQuality:()=>quality,reducedMotion:()=>reduced,createCanvas:make});return {effects,canvases,ctx:context(),quality:value=>quality=value,reduced:value=>reduced=value,water:value=>allowed=value};}

test('water cells stay completely inside the actual lake and exclude a new land peninsula',()=>{
 const allowed=(x,y)=>x>=12&&x<44&&y>=8&&y<40&&!(x<28&&y<28),mask=buildWaterCells(60,50,4,allowed);
 assert.ok(mask.count>0);for(let y=0;y<mask.rows;y++)for(let x=0;x<mask.columns;x++)if(mask.cells[y*mask.columns+x])for(const dx of [0,3.999])for(const dy of [0,3.999])assert.ok(allowed(x*4+dx,y*4+dy));
 assert.equal(mask.cells[3*mask.columns+4],0,'Land inside the ellipse must stay dark');
});
test('the water raster is cached between refresh intervals and bounded independently of world canvas size',()=>{
 const f=fixture();f.effects.drawWater(f.ctx,{time:1});const first=f.effects.snapshot();assert.equal(first.maskBuilds,1);assert.deepEqual(first.waterRaster,[250,155]);assert.ok(first.waterCells>0);f.effects.drawWater(f.ctx,{time:1.01});assert.equal(f.effects.snapshot().waterRefreshes,first.waterRefreshes);f.effects.drawWater(f.ctx,{time:1.06});assert.equal(f.effects.snapshot().waterRefreshes,first.waterRefreshes+1);assert.equal(f.effects.snapshot().maskBuilds,1);
});
test('crystal and lantern glows reuse their textures without per-frame gradients',()=>{
 const f=fixture();f.effects.drawLights(f.ctx,{time:0});const count=f.canvases.length;assert.ok(count>1&&count<CRYSTALS.length+LANTERNS.length);f.effects.drawLights(f.ctx,{time:3});assert.equal(f.canvases.length,count);assert.equal(f.effects.snapshot().crystalCount,CRYSTALS.length);assert.equal(f.effects.snapshot().lanternCount,LANTERNS.length);assert.equal(f.ctx.calls.filter(call=>call[0]==='gradient').length,0);
});
test('moving boats emit limited wake rings; shore, teleports and stopped boats do not',()=>{
 const f=fixture();f.effects.drawWater(f.ctx,{time:0,boat:{x:300,y:300}});f.effects.drawWater(f.ctx,{time:.2,boat:{x:304,y:300}});assert.equal(f.effects.snapshot().ripples.length,1);f.effects.drawWater(f.ctx,{time:.5,boat:{x:304,y:300}});assert.equal(f.effects.snapshot().ripples.length,1);f.effects.drawWater(f.ctx,{time:.7,boat:{x:700,y:300}});assert.equal(f.effects.snapshot().ripples.length,1,'A mooring teleport is not a wake');assert.equal(f.effects.ripple(50,50,{time:.8}),false);for(let i=0;i<70;i++)f.effects.ripple(400,300,{time:1});assert.equal(f.effects.snapshot().ripples.length,28);f.effects.drawWater(f.ctx,{time:6,boat:{x:700,y:300}});assert.equal(f.effects.snapshot().ripples.length,0);
});
test('lite reduces water refresh and particles; off performs no drawing or allocation',()=>{
 const f=fixture();f.quality('off');f.effects.drawWater(f.ctx,{time:0});f.effects.drawLights(f.ctx,{time:0});assert.equal(f.canvases.length,0);assert.equal(f.ctx.calls.length,0);assert.equal(f.effects.ripple(300,300),false);f.quality('lite');f.effects.drawWater(f.ctx,{time:1});const refresh=f.effects.snapshot().waterRefreshes;f.effects.drawWater(f.ctx,{time:1.04});assert.equal(f.effects.snapshot().waterRefreshes,refresh);assert.equal(f.effects.snapshot().moteCount,9);for(let i=0;i<25;i++)f.effects.ripple(400,300,{time:1});assert.equal(f.effects.snapshot().ripples.length,12);
});
test('reduced motion retains static light but freezes caustics and disables motes, drips and wakes',()=>{
 const f=fixture();f.reduced(true);f.effects.drawWater(f.ctx,{time:1,boat:{x:300,y:300}});f.effects.drawLights(f.ctx,{time:1});const first=f.effects.snapshot();f.effects.drawWater(f.ctx,{time:6,boat:{x:340,y:300}});assert.equal(f.effects.snapshot().waterRefreshes,first.waterRefreshes);assert.equal(f.effects.snapshot().moteCount,0);assert.equal(f.effects.snapshot().ripples.length,0);assert.equal(f.effects.ripple(400,300),false);assert.ok(f.effects.snapshot().textureCount>0);
});
test('changed geometry rebuilds one water mask, and disposal releases surfaces and prevents further drawing',()=>{
 const f=fixture();f.effects.drawWater(f.ctx,{time:0});const count=f.effects.snapshot().waterCells;f.water((x,y)=>x>500&&x<700&&y>250&&y<400);f.effects.invalidateGeometry();f.effects.drawWater(f.ctx,{time:1});assert.equal(f.effects.snapshot().maskBuilds,2);assert.ok(f.effects.snapshot().waterCells<count);f.effects.dispose();const calls=f.ctx.calls.length;f.effects.drawWater(f.ctx,{time:4});f.effects.drawLights(f.ctx,{time:4});assert.equal(f.ctx.calls.length,calls);assert.equal(f.effects.snapshot().disposed,true);assert.equal(f.effects.snapshot().textureCount,0);assert.equal(f.effects.snapshot().waterRaster,null);
});
