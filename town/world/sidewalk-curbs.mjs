import {cell,height,COLS,ROWS,TILE,RISE} from './model.mjs?v=opera-parallax-1';
import {roundedUnder,curveUnder,clipCurves} from './round-geometry.mjs?v=opera-parallax-1';
import {readPaint,PAINT_GRID,PAINT_STEP} from './ground-paint.mjs?v=opera-parallax-1';

export const SIDEWALK_CURB_DEPTH=12;
const STEP=4,EPS=.08,paintFields=new WeakMap();
const sides=[
 {side:'north',dx:1,dy:0,nx:0,ny:1,ox:0,oy:0},
 {side:'east',dx:0,dy:1,nx:-1,ny:0,ox:1,oy:0},
 {side:'south',dx:1,dy:0,nx:0,ny:-1,ox:0,oy:1},
 {side:'west',dx:0,dy:1,nx:1,ny:0,ox:0,oy:0}
];
const inMap=(x,y)=>x>=0&&y>=0&&x<COLS*TILE&&y<ROWS*TILE;
const owner=a=>a.sidewalkCurb===true&&a.surface==='sidewalk'&&!a.paint&&!a.stairs&&!a.bridge;

function visibleSidewalk(d,x,y,z){
 if(!inMap(x,y)||Math.abs(height(d,x,y)-z)>EPS)return false;
 const a=cell(d,Math.floor(x/TILE),Math.floor(y/TILE));
 // A curb does not close the end of a stair flight or bridge at this height.
 if(a.stairs||a.bridge)return true;
 const q=roundedUnder(d,a,x,y),layer=q?curveUnder(d,q):a;
 if(!layer.paint)return layer.surface==='sidewalk';
 if(!paintFields.has(layer.paint))paintFields.set(layer.paint,readPaint(layer));
 const f=paintFields.get(layer.paint),px=Math.floor((x%TILE)/PAINT_STEP),py=Math.floor((y%TILE)/PAINT_STEP),i=(py*PAINT_GRID+px)*f.materials.length;
 let strongest=0;for(let j=1;j<f.materials.length;j++)if(f.weights[i+j]>f.weights[i+strongest])strongest=j;
 return f.materials[strongest].surface==='sidewalk';
}
function ownsStrip(d,a,x,y,s,t){
 if(!a.curves?.length)return true;
 const X=x*TILE+s.ox*TILE+s.dx*t,Y=y*TILE+s.oy*TILE+s.dy*t;
 // Keep the entire lip on the uncut foreground. Native contour samples are
 // four pixels wide, matching the shoreline and material brush resolution.
 return [EPS,SIDEWALK_CURB_DEPTH-EPS].every(depth=>!roundedUnder(d,a,X+s.nx*depth,Y+s.ny*depth));
}

// Only square-painted cells generate borders. Actual adjacent sidewalk still
// joins them regardless of how that adjacent surface was originally painted.
export function sidewalkCurbSegments(d,x,y){
 if(x<0||y<0||x>=COLS||y>=ROWS)return [];
 const a=cell(d,x,y);if(!owner(a))return [];
 const z=a.level*RISE,result=[];
 for(const s of sides){
  const nx=x-s.nx,ny=y-s.ny,b=cell(d,nx,ny);
  if(!a.curves?.length&&!b.curves?.length&&!b.paint&&!b.stairs&&!b.bridge){
   // The usual rectangular pavement only needs four adjacent-cell reads.
   // Subtile sampling is reserved for an actual painted or cut boundary.
   const neighborInMap=nx>=0&&ny>=0&&nx<COLS&&ny<ROWS;
   if(!neighborInMap||b.surface!=='sidewalk'||b.level!==a.level)result.push({side:s.side,x:x*TILE+s.ox*TILE,y:y*TILE+s.oy*TILE,dx:s.dx*TILE,dy:s.dy*TILE,z,shadow:!neighborInMap||b.level<=a.level});
   continue;
  }
  let run=null;
  for(let t=0;t<TILE;t+=STEP){
   const at=t+STEP/2,X=x*TILE+s.ox*TILE+s.dx*at,Y=y*TILE+s.oy*TILE+s.dy*at;
   const nx=X-s.nx*EPS,ny=Y-s.ny*EPS;
   const exposed=ownsStrip(d,a,x,y,s,at)&&!visibleSidewalk(d,nx,ny,z);
   const shadow=!inMap(nx,ny)||height(d,nx,ny)<=z+EPS;
   if(exposed&&run&&run.shadow===shadow){run.dx+=s.dx*STEP;run.dy+=s.dy*STEP;continue;}
   if(run)result.push(run);
   run=exposed?{side:s.side,x:x*TILE+s.ox*TILE+s.dx*t,y:y*TILE+s.oy*TILE+s.dy*t,dx:s.dx*STEP,dy:s.dy*STEP,z,shadow}:null;
  }
  if(run)result.push(run);
 }
 return result;
}

// The inside turn of an L also occupies the small corner of its diagonal
// sidewalk cell. A corner cap joins the two straight lips without a pinhole.
export function sidewalkCurbCorners(d,x,y){
 const a=cell(d,x,y);if(!owner(a)||a.curves?.length)return [];
 const z=a.level*RISE,result=[];
 for(const [sx,sy,name]of [[-1,-1,'nw'],[1,-1,'ne'],[-1,1,'sw'],[1,1,'se']]){
  const X=(x+(sx>0?1:0))*TILE,Y=(y+(sy>0?1:0))*TILE;
  const b=cell(d,x+sx,y),c=cell(d,x,y+sy);
  if(!owner(b)||!owner(c)||b.level!==a.level||c.level!==a.level)continue;
  if(visibleSidewalk(d,X+sx*EPS,Y+sy*EPS,z))continue;
  if(!visibleSidewalk(d,X+sx*EPS,Y-sy*EPS,z)||!visibleSidewalk(d,X-sx*EPS,Y+sy*EPS,z))continue;
  result.push({corner:name,x:X,y:Y,z,sx,sy});
 }
 return result;
}

function box(c,s,along,across,length,depth,color){
 c.fillStyle=color;
 if(s.side==='north')c.fillRect(s.x+along,s.y+across,length,depth);
 else if(s.side==='south')c.fillRect(s.x+along,s.y-across-depth,length,depth);
 else if(s.side==='west')c.fillRect(s.x+across,s.y+along,depth,length);
 else c.fillRect(s.x-across-depth,s.y+along,depth,length);
}
function point(s,along,depth){
 return s.side==='north'?[s.x+along,s.y+depth]:s.side==='south'?[s.x+along,s.y-depth]:s.side==='west'?[s.x+depth,s.y+along]:[s.x-depth,s.y+along];
}
function meets(a,b,x,y){
 return a.some(s=>s.side===b&&(Math.abs(s.x-x)<EPS&&Math.abs(s.y-y)<EPS||Math.abs(s.x+s.dx-x)<EPS&&Math.abs(s.y+s.dy-y)<EPS));
}
function drawLip(c,s,segments){
 const length=s.dx+s.dy,vertical=!!s.dy,first=vertical?'north':'west',last=vertical?'south':'east';
 const miterStart=meets(segments,first,s.x,s.y),miterEnd=meets(segments,last,s.x+s.dx,s.y+s.dy);
 c.save();
 if(miterStart||miterEnd){
  const inset=Math.min(SIDEWALK_CURB_DEPTH,length/(miterStart&&miterEnd?2:1));
  const polygon=[point(s,0,0),point(s,length,0),point(s,length-(miterEnd?inset:0),SIDEWALK_CURB_DEPTH),point(s,miterStart?inset:0,SIDEWALK_CURB_DEPTH)];
  c.beginPath();c.moveTo(...polygon[0]);for(const p of polygon.slice(1))c.lineTo(...p);c.closePath();c.clip();
 }
 const forward=s.side==='north'||s.side==='west';
 box(c,s,0,0,length,12,'#a29a87');box(c,s,0,forward?2:1,length,9,'#c6beaa');box(c,s,0,forward?2:8,length,2,'#e1d8c2');
 const phase=vertical?s.y:s.x;
 for(let at=Math.ceil(phase/64)*64;at<phase+length;at+=64)box(c,s,at-phase,0,Math.min(2,phase+length-at),12,'#716d6299');
 for(let at=Math.ceil((phase-29)/64)*64+29;at+3<phase+length;at+=64)if(at>=phase)box(c,s,at-phase,5,3,3,'#8a847477');
 c.restore();
}
function drawInsideCorner(c,p){
 const x=p.x-(p.sx>0?12:0),y=p.y-(p.sy>0?12:0);
 c.fillStyle='#a29a87';c.fillRect(x,y,12,12);
 c.fillStyle='#c6beaa';c.fillRect(x+2,y+2,9,9);
 c.fillStyle='#e1d8c2';c.fillRect(x+2,y+2,2,9);c.fillRect(x+2,y+2,9,2);
}
export function drawSidewalkCurbs(c,d,x,y){
 const segments=sidewalkCurbSegments(d,x,y);if(!segments.length&&!owner(cell(d,x,y)))return;
 const a=cell(d,x,y),corners=sidewalkCurbCorners(d,x,y);if(!segments.length&&!corners.length)return;
 c.save();c.translate(0,-a.level*RISE);
 for(const s of segments)if(s.shadow)box(c,s,0,-4,s.dx+s.dy,4,'#24313a70');
 c.save();if(a.curves?.length)clipCurves(c,a,x,y,0);
 for(const s of segments)drawLip(c,s,segments);
 for(const p of corners)drawInsideCorner(c,p);
 c.restore();c.restore();
}
