import {COLS,ROWS,TILE,RISE,cell,key,segment,terrainHeight,surfaceAt} from '../world/model.mjs?v=family-rooms-1';
import {musicSquareWalls} from '../world/music-wall-geometry.mjs?v=family-rooms-1';

const EPS=1e-7,DEFAULT=Object.freeze({surface:'grass',level:0});
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const unique=values=>values.sort((a,b)=>a-b).filter((n,i,a)=>!i||n-a[i-1]>EPS);
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function intersects(a,b,s){
 const c={x:s.x,y:s.y},d={x:s.x+s.dx,y:s.y+s.dy};
 if(Math.max(a.x,b.x)<s.x-EPS||Math.min(a.x,b.x)>d.x+EPS||Math.max(a.y,b.y)<s.y-EPS||Math.min(a.y,b.y)>d.y+EPS)return false;
 const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
 return abC*abD<=EPS&&cdA*cdB<=EPS;
}

/** Authored physical baselines only: ordinary objects never partition land. */
export function elevationBarriers(doc){
 const walls=[];
 for(const [k,e]of Object.entries(doc.edges||{})){
  if(e.gate&&e.open)continue;
  const s=segment(k);
  if(Object.values(s).every(Number.isFinite)&&s.dx>=0&&s.dy>=0&&s.dx+s.dy>0)walls.push(s);
 }
 for(const o of doc.objects||[])if(o.asset==='music-square'&&!o.mount)for(const s of musicSquareWalls(o))walls.push({x:s.x,y:s.y,dx:s.dx,dy:s.dy});
 return walls;
}

/**
 * Select the connected dry floor at a clicked height, including enclosed yards.
 * Walls partition their actual world coordinates, even inside a terrain tile.
 * The local portal graph is refined only where walls/organic shores require it;
 * ordinary flat terrain remains one node per tile (49,152 on a blank map).
 * Its final cell mask works with the existing terrain raise/lower and history.
 */
export function selectElevationRegion(doc,p){
 if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>=COLS*TILE||p.y>=ROWS*TILE)return null;
 const seedCell=cell(doc,Math.floor(p.x/TILE),Math.floor(p.y/TILE));
 if(seedCell.stairs||surfaceAt(doc,p.x,p.y)==='water')return null;
 const level=terrainHeight(doc,p.x,p.y)/RISE;
 if(!Number.isInteger(level))return null;
 const walls=elevationBarriers(doc),wallTiles=new Map(),tiles=new Array(COLS*ROWS);
 // Index continuous segments once, including both sides of a tile boundary.
 for(const wall of walls){
  const x0=clamp(Math.floor((wall.x-EPS)/TILE),0,COLS-1),x1=clamp(Math.floor((wall.x+wall.dx+EPS)/TILE),0,COLS-1);
  const y0=clamp(Math.floor((wall.y-EPS)/TILE),0,ROWS-1),y1=clamp(Math.floor((wall.y+wall.dy+EPS)/TILE),0,ROWS-1);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const id=y*COLS+x;let list=wallTiles.get(id);if(!list)wallTiles.set(id,list=[]);list.push(wall);}
 }
 const eligible=(x,y)=>surfaceAt(doc,x,y)!=='water'&&Math.abs(terrainHeight(doc,x,y)/RISE-level)<EPS;
 function tileAt(x,y){
  if(x<0||x>=COLS||y<0||y>=ROWS)return null;
  const id=y*COLS+x;
  if(tiles[id]!==undefined)return tiles[id]||null;
  const data=doc.cells[key(x,y)]||DEFAULT;
  if(data.stairs||!data.curves?.length&&(data.surface==='water'||data.level!==level)){tiles[id]=false;return null;}
  const X=x*TILE,Y=y*TILE,local=wallTiles.get(id)||[],xs=[X,X+TILE],ys=[Y,Y+TILE];
  for(const s of local){xs.push(clamp(s.x,X,X+TILE),clamp(s.x+s.dx,X,X+TILE));ys.push(clamp(s.y,Y,Y+TILE),clamp(s.y+s.dy,Y,Y+TILE));}
  // Organic masks use four-world-pixel cells; analytic curves use the same
  // conservative sampling so a thin wet sliver cannot join two dry patches.
  if(data.curves?.length)for(let n=4;n<TILE;n+=4){xs.push(X+n);ys.push(Y+n);}
  const t={id,x,y,data,walls:local,xs:unique(xs),ys:unique(ys),patches:new Map()};
  t.columns=t.xs.length-1;t.rows=t.ys.length-1;
  tiles[id]=t;return t;
 }
 function patchAt(t,col,row){
  const id=row*t.columns+col;let a=t.patches.get(id);if(a)return a;
  const x0=t.xs[col],x1=t.xs[col+1],y0=t.ys[row],y1=t.ys[row+1],x=(x0+x1)/2,y=(y0+y1)/2;
  a={tile:t,col,row,x0,x1,y0,y1,x,y,eligible:!t.data.curves?.length||eligible(x,y),visited:false};t.patches.set(id,a);return a;
 }
 function interval(coords,value){let lo=0,hi=coords.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(value<coords[mid])hi=mid;else lo=mid;}return lo;}
 function routeClear(a,b,portal){
  for(const s of a.tile.walls)if(intersects(a,portal,s)||intersects(portal,b,s))return false;
  if(a.tile!==b.tile)for(const s of b.tile.walls)if(intersects(a,portal,s)||intersects(portal,b,s))return false;
  if(!a.tile.data.curves?.length&&!b.tile.data.curves?.length)return true;
  for(const [from,to]of [[a,portal],[portal,b]]){
   const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/4));
   for(let i=0;i<=steps;i++){const f=i/steps;if(!eligible(from.x+(to.x-from.x)*f,from.y+(to.y-from.y)*f))return false;}
  }
  return true;
 }
 const startTile=tileAt(Math.floor(p.x/TILE),Math.floor(p.y/TILE));if(!startTile)return null;
 const start=patchAt(startTile,interval(startTile.xs,p.x),interval(startTile.ys,p.y));
 if(!start?.eligible)return null;
 const queue=[start],selected=new Uint8Array(COLS*ROWS),cells=[];start.visited=true;
 let x0=COLS,y0=ROWS,x1=0,y1=0;
 function enqueue(a,b,portal){if(b?.eligible&&!b.visited&&routeClear(a,b,portal)){b.visited=true;queue.push(b);}}
 for(let next=0;next<queue.length;next++){
  const a=queue[next],t=a.tile;
  if(!selected[t.id]){selected[t.id]=1;cells.push(key(t.x,t.y));x0=Math.min(x0,t.x);x1=Math.max(x1,t.x);y0=Math.min(y0,t.y);y1=Math.max(y1,t.y);}
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
   const col=a.col+dx,row=a.row+dy;
   if(col>=0&&col<t.columns&&row>=0&&row<t.rows){
    const b=patchAt(t,col,row),portal=dx?{x:dx>0?a.x1:a.x0,y:a.y}:{x:a.x,y:dy>0?a.y1:a.y0};enqueue(a,b,portal);continue;
   }
   const other=tileAt(t.x+dx,t.y+dy);if(!other)continue;
   // Different cells can have different subdivisions. Connect only through
   // a positive-width common portal, never diagonally through a corner.
   const count=dx?other.rows:other.columns;
   for(let i=0;i<count;i++){
    const b=dx?patchAt(other,dx>0?0:other.columns-1,i):patchAt(other,i,dy>0?0:other.rows-1);
    const lo=Math.max(dx?a.y0:a.x0,dx?b.y0:b.x0),hi=Math.min(dx?a.y1:a.x1,dx?b.y1:b.x1);
    if(hi-lo<=EPS)continue;
    enqueue(a,b,dx?{x:dx>0?a.x1:a.x0,y:(lo+hi)/2}:{x:(lo+hi)/2,y:dy>0?a.y1:a.y0});
   }
  }
 }
 return cells.length?{x0,y0,x1,y1,shape:'elevation',cells,level,seed:{x:p.x,y:p.y}}:null;
}
