import test from 'node:test';
import assert from 'node:assert/strict';
import {residents,landmarks,HOME,START,roomPlan,atInteriorExit,interiorSolid,bridges,water,solid,canEnter,nearest,W,H} from './model.mjs';
test('every musician has a distinct home and an accessible front step',()=>{
 assert.equal(residents.length,18);assert.equal(new Set(residents.map(r=>r.id)).size,18);
 for(const h of residents){assert.ok(h.x>0&&h.x+h.w<W&&h.y+h.h<H);assert.equal(solid(h.door.x,h.door.y+14),false,h.id);assert.equal(nearest(h.door.x,h.door.y+14).id,h.id);}
});
test('river crossings are walkable but unbridged water blocks movement',()=>{
 for(const b of bridges){assert.ok(water(b.x,b.y));assert.equal(solid(b.x,b.y),false);}
 assert.equal(solid(1295,0),true);assert.equal(solid(1820,3660),true);
});
test('home invitations depend only on the active musician friendship',()=>{
 assert.equal(canEnter([], 'bach'),false);
 assert.equal(canEnter([{id:'bach',relationship:{count:4}}],'bach'),false);
 assert.equal(canEnter([{id:'bach',relationship:{count:5}}],'bach'),true);
 assert.equal(canEnter([{id:'bach',relationship:{count:10}}],'mozart'),false);
 assert.equal(canEnter([{id:'bach',relationship:{count:'5'}}],'bach'),false);
});
test('all front doors are connected to the town entrance by walkable terrain',()=>{
 const step=16,cols=W/step,rows=H/step,seen=new Uint8Array(cols*rows),queue=[[START.x,START.y]];seen[265*cols+275]=1;
 for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const index=ny/step*cols+nx/step;if(!seen[index]&&!solid(nx,ny)){seen[index]=1;queue.push([nx,ny]);}}}
 for(const h of residents){const x=Math.round(h.door.x/step),y=Math.round((h.door.y+14)/step);assert.equal(seen[y*cols+x],1,h.id+' must be reachable');}
});

test('interior dimensions equal the exterior ground footprint for every home',()=>{
 for(const h of [...residents,...landmarks.filter(l=>l.kind==='player')]){assert.equal(h.w,h.interior.width,h.id);assert.equal(h.h,h.interior.depth,h.id);assert.equal(h.door.x,h.x+h.w/2);assert.ok(!interiorSolid(h.w/2,h.h-36,h));assert.ok(interiorSolid(HOME.wall,h.h/2,h));assert.ok(interiorSolid(70,120,h),'furniture has physical collision');}
});
test('every functional room has a usable route from the front door',()=>{
 const home=residents[0],step=4,cols=home.w/step,seen=new Set(),queue=[[home.w/2,home.h-36]];
 const key=(x,y)=>y/step*cols+x/step;seen.add(key(...queue[0]));
 for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy] of [[4,0],[-4,0],[0,4],[0,-4]]){const nx=x+dx,ny=y+dy,k=key(nx,ny);if(!seen.has(k)&&!interiorSolid(nx,ny,home)){seen.add(k);queue.push([nx,ny]);}}}
 assert.deepEqual(roomPlan(home).map(r=>r.id),['bathroom','bedroom','entry','kitchen','living']);
 for(const [room,x,y] of [['bathroom',168,176],['bedroom',460,180],['kitchen',192,388],['living',456,464],['music nook',440,340]])assert.ok(seen.has(key(x,y)),room+' is reachable without walking through furniture or walls');
 assert.ok(atInteriorExit(home.w/2,home.h-36,home));
 assert.equal(atInteriorExit(100,home.h-36,home),false,'the front window is not a second exit');
});
