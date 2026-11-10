import test from 'node:test';
import assert from 'node:assert/strict';
import {spriteBounds,intersectsViewport,actorBounds} from './render-visibility.mjs';

test('tall artwork uses its full foot-anchored image instead of a giant circle below the building',()=>{
 const a={w:4608,h:3328},o={scale:1,rotation:0},b=spriteBounds(a,o,{x:8000,y:7000,offset:1});
 assert.deepEqual(b,{x:5696,y:3672,w:4608,h:3328});
 assert.equal(intersectsViewport(b,{x:7200,y:3700,w:1000,h:700}),true,'roof is visible while the ground anchor is far away');
 assert.equal(intersectsViewport(b,{x:7200,y:7100,w:1000,h:700}),false,'a fully offscreen building is skipped south of its steps');
});

test('rotated, scaled and mounted sprite bounds contain all four original corners',()=>{
 const a={w:800,h:1400};
 for(const rotation of [0,45,90,135,180,270])for(const scale of [.5,1,2])for(const offset of [.5,1]){
  const o={rotation,scale},p={x:1200,y:1600,offset},b=spriteBounds(a,o,p),r=rotation*Math.PI/180;
  for(const x of [-a.w/2,a.w/2])for(const y of [-a.h*offset,a.h*(1-offset)]){
   const X=p.x+(x*Math.cos(r)-y*Math.sin(r))*scale,Y=p.y+(x*Math.sin(r)+y*Math.cos(r))*scale;
   assert.ok(X>=b.x-1e-7&&X<=b.x+b.w+1e-7&&Y>=b.y-1e-7&&Y<=b.y+b.h+1e-7);
  }
 }
});

test('viewport culling retains edges, optional light margins and visible character heads',()=>{
 const view={x:100,y:100,w:500,h:500};
 assert.equal(intersectsViewport({x:600,y:120,w:50,h:50},view),true);
 assert.equal(intersectsViewport({x:640,y:120,w:50,h:50},view),false);
 assert.equal(intersectsViewport({x:640,y:120,w:50,h:50},view,50),true);
 assert.equal(intersectsViewport(actorBounds(350,800),view),true,'feet below the viewport can still have a visible head');
 assert.equal(intersectsViewport(actorBounds(350,1000),view),false);
});
