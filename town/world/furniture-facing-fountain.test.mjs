import test from 'node:test';
import assert from 'node:assert/strict';
import {drawFacingFountainMotion} from './furniture-facing-fountain.mjs';
import {furnitureFacingDrawSource} from './furniture-facing-source.mjs';

const placement={x:900,y:700,w:105,h:354,direction:'east'};
const context=()=>{const calls=[];return {calls,save(){calls.push(['save']);},translate(...p){calls.push(['translate',...p]);},scale(...p){calls.push(['scale',...p]);},restore(){calls.push(['restore']);},rotate(){throw Error('The selected native view must stay upright');}};};

test('the selected native drinking-fountain view keeps its graded water overlay at the upright image rectangle',()=>{
 const a={id:'decor-06-09',name:'Stone drinking fountain',pack:'town-decor-256'},image={width:70,height:236,name:'east-native'},graded={width:70,height:236,name:'graded-east'},c=context();let gradeCalls=0,waterCalls=0;
 Object.defineProperty(a,'canvas',{get(){throw Error('An East fountain overlay must not access the South canvas');}});
 const source={image,sx:0,sy:0,sw:70,sh:236,native:true};
 assert.equal(drawFacingFountainMotion(c,a,placement,source,1.25,{native:true,gradeImage(asset,raw){gradeCalls++;assert.equal(asset,a);assert.equal(raw,image);return graded;},drawMotion(ctx,asset,selected,time){waterCalls++;assert.equal(ctx,c);assert.equal(asset,a);assert.equal(selected,graded);assert.equal(time,1.25);}}),true);
 assert.equal(gradeCalls,1);assert.equal(waterCalls,1);assert.deepEqual(c.calls,[['save'],['translate',900,700],['scale',1.5,1.5],['restore']]);
});

test('overflow, previews, pending sources and ordinary furniture cannot create fountain masks or read a native image',()=>{
 const a={id:'decor-06-09',name:'Stone drinking fountain'},c=context(),protectedSource={native:true,get image(){throw Error('Overflow must not read a native image');}};
 const options={gradeImage(){throw Error('No preview grading canvas');},drawMotion(){throw Error('No preview water mask');}};
 assert.equal(drawFacingFountainMotion(c,a,placement,protectedSource,1,{...options,native:false}),false);
 assert.equal(drawFacingFountainMotion(c,a,placement,{native:false,get image(){throw Error('Do not inspect the shared overview atlas');}},1,options),false);
 assert.equal(drawFacingFountainMotion(c,{id:'bench',name:'Wood bench'},placement,protectedSource,1,options),false);
 assert.equal(drawFacingFountainMotion(c,a,placement,{native:true,image:null},1,options),false);
 assert.equal(drawFacingFountainMotion(c,a,placement,{native:true,image:{width:512,height:512},sx:32,sy:64,sw:32,sh:32},1,options),false,'A shared atlas crop must never be sampled as one fountain');
 assert.deepEqual(c.calls,[]);
});

test('native fountain grading is cached by the selected image and overview frames never create canvases or full requests',()=>{
 const previous=globalThis.document,grades=[],image={width:70,height:236,name:'east-native'},atlas={width:512,height:512};
 let requests=0,compiles=0,ready=false,water=0,southReads=0;
 globalThis.document={createElement(){const canvas={width:0,height:0},g={filter:'none',drawImage(raw){grades.push({canvas,filter:this.filter,raw});}};canvas.getContext=()=>g;return canvas;}};
 const a={id:'decor-06-09',name:'Stone drinking fountain',pack:'town-decor-256',getFacingDrawSource(direction,{native}){
  assert.equal(direction,'east');if(!native)return {image:atlas,sx:0,sy:0,sw:32,sh:32,native:false};
  if(!ready){requests++;compiles++;ready=true;}return {image,sx:0,sy:0,sw:70,sh:236,native:true};
 }};
 Object.defineProperty(a,'canvas',{get(){southReads++;throw Error('No hidden South getter');}});
 try{
  for(let i=0;i<30;i++)drawFacingFountainMotion(context(),a,placement,furnitureFacingDrawSource(a,placement,{native:false}),i/12,{native:false,drawMotion(){water++;}});
  assert.equal(requests,0);assert.equal(compiles,0);assert.equal(grades.length,0);assert.equal(water,0);
  for(let i=0;i<30;i++)drawFacingFountainMotion(context(),a,placement,furnitureFacingDrawSource(a,placement,{native:true}),i/12,{native:true,drawMotion(ctx,asset,selected){water++;assert.notEqual(selected,image);}});
  assert.equal(requests,1);assert.equal(compiles,1);assert.equal(grades.length,1);assert.equal(grades[0].raw,image);assert.equal(grades[0].filter,'saturate(.84) brightness(.96)');assert.equal(water,30);assert.equal(southReads,0);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
