import {cell,height,COLS,ROWS,TILE} from './model.mjs?v=opera-parallax-1';
import {roundedUnder,curveUnder} from './round-geometry.mjs?v=opera-parallax-1';
import {readPaint,PAINT_GRID,PAINT_STEP} from './ground-paint.mjs?v=opera-parallax-1';

const fields=new WeakMap(),EPS=1e-7;
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);

// Use the visible material, rather than the original tile below a soft brush.
// Rounded under-floors use the receiving tile's local paint coordinates, just
// as native terrain rendering does.
export function sandCoverage(doc,x,y){
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=COLS*TILE||y>=ROWS*TILE)return 0;
 const a=cell(doc,Math.floor(x/TILE),Math.floor(y/TILE));if(a.stairs||a.bridge)return 0;
 const q=roundedUnder(doc,a,x,y),layer=q?curveUnder(doc,q):a;
 if(!layer.paint)return layer.surface==='sand'?1:0;
 if(!fields.has(layer.paint))fields.set(layer.paint,readPaint(layer));
 const f=fields.get(layer.paint),at=(Math.floor((y%TILE)/PAINT_STEP)*PAINT_GRID+Math.floor((x%TILE)/PAINT_STEP))*f.materials.length;
 let strongest=0;for(let j=1;j<f.materials.length;j++)if(f.weights[at+j]>f.weights[at+strongest])strongest=j;
 return f.materials[strongest].surface==='sand'?f.weights[at+strongest]/255:0;
}

export function footprintOpacity(mark,time,lifetime=4.5){
 const age=Math.max(0,time-mark.born);if(age>=lifetime)return 0;
 const fade=Math.min(1,(lifetime-age)/Math.min(2.2,lifetime));
 return .6*mark.coverage*fade*fade*(3-2*fade);
}

// Footprints are a small, bounded visual history. Nothing is stored in the
// project: edits, undo and imports can replace a map without carrying tracks.
export function createSandFootprints({getProject,step=44,lifetime=4.5,maxMarks=256}={}){
 step=Math.max(20,Math.min(100,Number(step)||44));lifetime=Math.max(1,Math.min(12,Number(lifetime)||4.5));maxMarks=Math.max(2,Math.min(1024,Math.round(Number(maxMarks)||256)));
 let activeDoc=null,lastTime=-Infinity,marks=[],actors=new Map();
 function reset(){activeDoc=null;lastTime=-Infinity;marks=[];actors=new Map();}
 function emit(doc,p,dx,dy,state,born){
  // A human-sized shoe, offset to alternating sides of the walked line.
  const side=state.side,stateX=-dy,stateY=dx,x=p.x+stateX*side*9,y=p.y+stateY*side*9;
  state.side=-side;
  const z=height(doc,x,y),points=[[0,0],[0,6],[0,-6],[3,5],[-3,5],[3,-5],[-3,-5]];let coverage=1;
  for(const [across,along]of points){const X=x+stateX*across+dx*along,Y=y+stateY*across+dy*along,value=sandCoverage(doc,X,Y);if(value<.5||Math.abs(height(doc,X,Y)-z)>3)return;coverage=Math.min(coverage,value);}
  marks.push({x,y,angle:Math.atan2(dy,dx)+Math.PI/2,born,coverage,side});
  if(marks.length>maxMarks)marks.splice(0,marks.length-maxMarks);
 }
 function update(list,time=0){
  const doc=getProject?.();if(!doc)return;const now=Number.isFinite(time)?time:0;
  if(doc!==activeDoc||now<lastTime){reset();activeDoc=doc;}
  lastTime=now;marks=marks.filter(mark=>now-mark.born<lifetime);
  const present=new Set();
  for(const actor of list||[]){
   if(!valid(actor)||actor.hidden)continue;const id=actor.id??actor;if(present.has(id))continue;present.add(id);
   let state=actors.get(id);
   if(!state){actors.set(id,{x:actor.x,y:actor.y,time:now,until:step/2,side:-1});continue;}
   const dx=actor.x-state.x,dy=actor.y-state.y,distance=Math.hypot(dx,dy),dt=now-state.time;
   const teleported=distance>Math.max(160,step*4)||distance>Math.max(36,dt*1400+24)||dt>.45;
   if(actor.walking&&distance>EPS&&!teleported&&dt>0){
    const vx=dx/distance,vy=dy/distance;let moved=0;
    while(state.until<=distance-moved+EPS){
     moved+=state.until;emit(doc,{x:state.x+vx*moved,y:state.y+vy*moved},vx,vy,state,state.time+dt*moved/distance);state.until=step;
    }
    state.until-=distance-moved;
   }else if(teleported)state.until=step/2;
   state.x=actor.x;state.y=actor.y;state.time=now;
  }
  // Hidden pedestrians resume from their current position; toggling them on
  // cannot connect two camera locations with a long line of old footsteps.
  for(const id of actors.keys())if(!present.has(id))actors.delete(id);
 }
 function draw(c,doc=activeDoc,time=lastTime){
  if(!doc||doc!==activeDoc)return;
  for(const mark of marks){
   const alpha=footprintOpacity(mark,time,lifetime);if(alpha<.002||sandCoverage(doc,mark.x,mark.y)<.5)continue;
   c.save();c.translate(Math.round(mark.x),Math.round(mark.y-height(doc,mark.x,mark.y)));c.rotate(mark.angle);c.globalAlpha*=alpha;
   // Two tiny recesses plus a sunny rim read as impressions, not black shoes.
   c.fillStyle='#795738';c.fillRect(-3,-5,6,6);c.fillRect(-2,-6,4,1);c.fillRect(-2,2,5,4);
   c.fillStyle='#aa8250';c.fillRect(-2,-5,4,5);c.fillRect(-1,2,3,3);
   c.fillStyle='#e3c58d';c.fillRect(-3,-6,1,7);c.fillRect(-2,5,5,1);
   c.restore();
  }
 }
 return {update,draw,reset,get marks(){return marks.map(mark=>({...mark}));}};
}
