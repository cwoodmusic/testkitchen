import test from 'node:test';
import assert from 'node:assert/strict';
import {residents,allHomes,landmarks,START,ARCHITECTURES,roomPlan,atInteriorExit,interiorSolid,insideFootprint,bridges,water,solid,canEnter,nearest,W,H,paths,landStairs,canStep,canTravel,elevation,baseElevation,accessPath,townTrees,lakeShore,riverHalfWidth,MUSIC_SQUARE,terraces} from './model.mjs';
test('architectures have real wings, varied sizes and matching indoor/outdoor footprints',()=>{
 assert.equal(residents.length,18);assert.equal(new Set(residents.map(r=>r.id)).size,18);
 assert.equal(new Set(allHomes.map(h=>h.architecture)).size,5);
 assert.ok(Math.max(...allHomes.map(h=>h.floorArea))>2.5*Math.min(...allHomes.map(h=>h.floorArea)));
 for(const h of allHomes){assert.equal(h.w,h.interior.width);assert.equal(h.h,h.interior.depth);assert.ok(!interiorSolid(h.entry.x,h.entry.y,h),h.id+' entry is usable');assert.ok(atInteriorExit(h.entry.x,h.entry.y,h));assert.equal(nearest(h.door.x,h.door.y+14).id,h.id);assert.ok(!solid(h.door.x,h.door.y+14));assert.ok(h.x>0&&h.x+h.w<W&&h.y+h.h<H);}
 const court=residents.find(h=>h.architecture==='courtyard');assert.equal(insideFootprint(court.core.x+court.core.w/2,1100,court),false,'courtyard is an outdoor recess, not indoor floor');
 const l=residents.find(h=>h.architecture==='sidewing');assert.equal(insideFootprint(1200,100,l),false);assert.equal(insideFootprint(1200,600,l),true);
});
test('all streets and private approaches are axis aligned',()=>{
 for(const path of [...paths,...allHomes.map(accessPath)])for(let i=1;i<path.length;i++)assert.ok(path[i][0]===path[i-1][0]||path[i][1]===path[i-1][1]);
});
test('cliffs block walking but authored terrain stairs connect levels continuously',()=>{
 assert.equal(canStep({x:3000,y:3299},{x:3000,y:3301}),false);
 for(const s of landStairs){const from={x:s.x+(s.axis==='x'?0:s.w/2),y:s.y+(s.axis==='y'?0:s.h/2)},to={x:s.x+(s.axis==='x'?s.w:s.w/2),y:s.y+(s.axis==='y'?s.h:s.h/2)};assert.ok(canTravel(from,to),s.id+' stair is walkable');assert.equal(Math.round(Math.abs(elevation(from.x,from.y)-elevation(to.x,to.y))),Math.abs(s.from-s.to));}
});
test('porches require their stairway and have different physical heights',()=>{
 assert.ok(new Set(allHomes.map(h=>h.porch.rise)).size>=3);
 for(const h of allHomes){const s=h.stairs,p=h.porch,from={x:h.door.x,y:s.y+s.h+8},to={x:h.door.x,y:h.door.y+14};assert.ok(canTravel(from,to),h.id+' stairs connect to the door');assert.equal(Math.round(elevation(to.x,to.y)-baseElevation(h.door.x,p.y)),p.rise);assert.equal(canStep({x:p.x-2,y:p.y+p.h/2},{x:p.x+2,y:p.y+p.h/2}),false,h.id+' cannot walk through the raised side');}
});
test('river bridges work and open water blocks walking',()=>{
 for(const b of bridges){assert.ok(water(b.x,b.y));assert.ok(!solid(b.x,b.y));}
 assert.ok(solid(1950,6100));
});
test('the lake has real dry inlets and the river has variable banks',()=>{
 assert.ok(lakeShore.length>20);
 assert.equal(water(1760,5830),false,'the northern inlet is dry ground, unlike the old oval');
 assert.equal(water(1950,6100),true,'the central basin remains water');
 assert.ok(Math.abs(riverHalfWidth(1000)-riverHalfWidth(2200))>30);
});
test('home invitations remain tied to the active musician friendship',()=>{
 assert.equal(canEnter([], 'bach'),false);assert.equal(canEnter([{id:'bach',relationship:{count:4}}],'bach'),false);assert.equal(canEnter([{id:'bach',relationship:{count:5}}],'bach'),true);assert.equal(canEnter([{id:'bach',relationship:{count:10}}],'mozart'),false);assert.equal(canEnter([{id:'bach',relationship:{count:'5'}}],'bach'),false);
});
test('every room and wing has a walkable indoor route from its real entry',()=>{
 for(const architecture of Object.keys(ARCHITECTURES)){const home=allHomes.find(h=>h.architecture===architecture),step=8,cols=Math.ceil(home.w/step),rows=Math.ceil(home.h/step),seen=new Set(),queue=[[Math.round(home.entry.x/step)*step,Math.round(home.entry.y/step)*step]],key=(x,y)=>y/step*cols+x/step;seen.add(key(...queue[0]));
 for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=home.w||ny>=home.h)continue;const k=key(nx,ny);if(!seen.has(k)&&!interiorSolid(nx,ny,home)){seen.add(k);queue.push([nx,ny]);}}}
 for(const r of roomPlan(home)){const reached=queue.some(([x,y])=>x>r.x+20&&x<r.x+r.w-20&&y>r.y+20&&y<r.y+r.h-20);assert.ok(reached,architecture+' '+r.id+' has a usable doorway and furniture clearance');}
 }
});
test('mature trees are planted in groves and their trunks block walking',()=>{assert.ok(townTrees.length>100);for(const t of townTrees.slice(0,20)){assert.ok(480*t.size>400);assert.ok(solid(t.x,t.y));}});
test('every home is reachable from the arcade through real stairs and crossings',()=>{
 const step=32,cols=W/step,rows=H/step,seen=new Uint8Array(cols*rows),queue=new Int32Array(cols*rows),startX=Math.round(START.x/step),startY=Math.round(START.y/step),start=startY*cols+startX;let head=0,tail=1;queue[0]=start;seen[start]=1;
 while(head<tail){const index=queue[head++],ix=index%cols,iy=Math.floor(index/cols),from={x:ix*step,y:iy*step};for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=ix+dx,ny=iy+dy;if(nx<0||ny<0||nx>=cols||ny>=rows)continue;const next=ny*cols+nx;if(!seen[next]&&canTravel(from,{x:nx*step,y:ny*step})){seen[next]=1;queue[tail++]=next;}}}
 for(const home of allHomes){const x=Math.round(home.door.x/step),y=Math.round((home.door.y+14)/step);let reached=false;for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)if(seen[(y+dy)*cols+x+dx]&&canTravel({x:(x+dx)*step,y:(y+dy)*step},{x:home.door.x,y:home.door.y+14}))reached=true;assert.ok(reached,home.id+' must have a route to its elevated front door');}
});

test('Music Square has one centered fountain with clear circulation around it',()=>{
 const s=MUSIC_SQUARE;assert.equal(s.fountain.x,s.x+s.w/2);assert.equal(s.fountain.y,s.y+s.h/2);assert.ok(solid(s.center.x,s.center.y));for(const [dx,dy] of [[300,0],[-300,0],[0,240],[0,-240]])assert.ok(!solid(s.center.x+dx,s.center.y+dy));assert.ok(terraces.find(t=>t.id==='orchard').height>=240);
});
