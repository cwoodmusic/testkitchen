'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {POINTS,LOUNGE_POINTS,brightness,create}=require('../floor-stars.js');
const regions=JSON.parse(fs.readFileSync(path.join(__dirname,'../scripts/cosmic-floor-regions.json'),'utf8'));
const lounge=JSON.parse(fs.readFileSync(path.join(__dirname,'../scripts/lounge-floor-regions.json'),'utf8'));
function inPolygon([x,y],polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
 const [ax,ay]=polygon[i],[bx,by]=polygon[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)hit=!hit;
}return hit;}
function onFloor(point){return lounge.polygons.some(polygon=>inPolygon(point,polygon))||regions.floorPolygons.some(polygon=>inPolygon(point,polygon))&&
 !regions.protectedPolygons.some(polygon=>inPolygon(point,polygon))&&
 !regions.protectedBounds.some(([x,y,w,h])=>point[0]>=x&&point[0]<x+w&&point[1]>=y&&point[1]<y+h);}
function context(){return {calls:[],save(){},restore(){},fillRect(x,y,w,h){this.calls.push({x,y,w,h,alpha:this.globalAlpha,color:this.fillStyle});}};}

test('the sparse star glyphs stay on exposed floor and outside walls and dance tiles',()=>{
 assert.equal(POINTS.length,53);assert.equal(LOUNGE_POINTS.length,5);
 assert.deepEqual(POINTS.slice(48),LOUNGE_POINTS,'The lounge adds stars without moving or rephasing the original floor stars');
 assert.ok(POINTS.slice(0,48).every(point=>!lounge.polygons.some(polygon=>inPolygon(point,polygon))));
 for(const [index,point] of POINTS.entries()){
  for(const [dx,dy]of [[-3,-3],[-3,3],[3,-3],[3,3]])assert.ok(onFloor([point[0]+dx,point[1]+dy]),'Star '+index+' must stay inside the floor mask');
  for(const other of POINTS.slice(index+1))assert.ok(Math.hypot(point[0]-other[0],point[1]-other[1])>45,'Stars must stay sparse');
 }
});

test('slow staggered pulses and gentle flickers remain bounded without full flashes',()=>{
 let increasing=0,decreasing=0;
 for(let index=0;index<POINTS.length;index++){
  let previous=brightness(index,0);
  for(let time=.04;time<22;time+=.04){
   const value=brightness(index,time);assert.ok(value>=.1&&value<=.81);
   assert.ok(Math.abs(value-previous)<.12,'A pulse or flicker must not jump between frames');previous=value;
  }
  const change=brightness(index,2)-brightness(index,0);if(change>.05)increasing++;if(change<-.05)decreasing++;
 }
 assert.ok(increasing>5&&decreasing>5,'Stars must not all pulse in unison');
});

test('quiet preferences hold static stars and FX Off hides the effect',()=>{
 let time=0,quiet=false,motion=true,quality='full';
 const stars=create({getTime:()=>time,reducedMotion:()=>quiet,getAnimation:()=>motion,getQuality:()=>quality});
 const first=stars.snapshot();time=2;assert.notDeepEqual(stars.snapshot().stars,first.stars);
 for(const preference of ['quiet','motion']){
  quiet=preference==='quiet';motion=preference!=='motion';
  const fixed=stars.snapshot();time+=7;assert.equal(fixed.animated,false);assert.deepEqual(stars.snapshot(),fixed);
 }
 const ctx=context();stars.draw(ctx);assert.equal(ctx.calls.length,POINTS.length*3);assert.equal(ctx.shadowBlur,0);
 assert.ok(ctx.calls.every(call=>call.w<=5&&call.h<=5&&call.alpha>0&&call.alpha<=1));
 quality='off';const off=context();stars.draw(off);assert.equal(off.calls.length,0);assert.equal(stars.snapshot().visible,false);
 assert.ok(stars.snapshot().stars.every(star=>star.alpha===0));
});
