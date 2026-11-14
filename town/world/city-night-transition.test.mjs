import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {renderCityNight} from './city-night.mjs';

const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas');
function fixture(run){
 const oldDocument=globalThis.document,oldMotion=globalThis.matchMedia;
 globalThis.document={createElement:()=>createCanvas(1,1)};globalThis.matchMedia=()=>({matches:true});
 try{
  const doc={cells:{},objects:[]};for(let y=0;y<=40;y++)for(let x=0;x<=40;x++)doc.cells[`${x},${y}`]={surface:'cobble',level:0};
  const catalog=new Map(),cam={x:1000,y:1000,zoom:1},canvas=createCanvas(160,120),c=canvas.getContext('2d');
  const paint=(state,background='#86a75c')=>{c.fillStyle=background;c.fillRect(0,0,160,120);renderCityNight(c,doc,cam,160,120,0,{catalog,...state});return c.getImageData(0,0,160,120).data;};
  return run({doc,catalog,cam,c,paint});
 }finally{
  if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
  if(oldMotion===undefined)delete globalThis.matchMedia;else globalThis.matchMedia=oldMotion;
 }
}
const pixel=(pixels,x=80,y=60)=>Array.from(pixels.slice((y*160+x)*4,(y*160+x)*4+4));

test('native pixels transition smoothly from original daylight to the existing night palette',()=>fixture(({doc,paint})=>{
 const raw=JSON.stringify(doc),samples=[0,.25,.5,.75,1].map(darkness=>pixel(paint({darkness,warmth:0})));
 assert.deepEqual(samples[0],[134,167,92,255]);
 for(let i=1;i<samples.length;i++)for(let channel=0;channel<3;channel++)assert(samples[i][channel]<samples[i-1][channel],`Channel ${channel} should darken gradually`);
 assert.deepEqual(samples.at(-1),pixel(paint({})),'Full cycle night retains the legacy native palette');
 assert.equal(JSON.stringify(doc),raw);
}));

test('native dusk and dawn pixels warm gradually and return to exact daylight at the cycle boundary',()=>fixture(({paint})=>{
 const daylight=pixel(paint({phase:'day',darkness:0,warmth:0})),dusk=pixel(paint({phase:'dusk',darkness:.5,warmth:1})),dawn=pixel(paint({phase:'dawn',darkness:.5,warmth:1})),cool=pixel(paint({darkness:.5,warmth:0}));
 assert(dusk[0]>cool[0]&&dawn[0]>cool[0],'Transition washes add warm light');assert.notDeepEqual(dusk,dawn);
 assert.deepEqual(pixel(paint({phase:'dawn',darkness:0,warmth:0})),daylight,'Completed dawn leaves no tint or night overlay');
 for(const phase of ['dusk','dawn']){
  const adjacent=pixel(paint({phase,darkness:.50001,warmth:1}));assert(adjacent.every((value,i)=>Math.abs(value-(phase==='dusk'?dusk:dawn)[i])<=1),'Adjacent transition fractions have no pixel jump');
 }
}));

test('native window bloom fades in with darkness instead of appearing at full strength during dusk',()=>fixture(({doc,catalog,paint})=>{
 const asset={id:'cycle-window',w:100,h:100,lightEmitters:[{u:.5,v:.5,kind:'window',radius:25,power:1}]};catalog.set(asset.id,asset);doc.objects=[{id:'window',asset:asset.id,x:1000,y:1050,rotation:0,scale:1}];
 const samples=[0,.25,.5,.75,1].map(darkness=>pixel(paint({darkness},'#000000')));
 assert.deepEqual(samples[0],[0,0,0,255]);for(let i=1;i<samples.length;i++)assert(samples[i][0]>samples[i-1][0],'Warm window intensity should increase gradually');
}));
