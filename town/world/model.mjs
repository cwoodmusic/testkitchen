import {validMask} from './organic-mask.mjs?v=opera-parallax-1';
import {validPaint} from './ground-paint.mjs?v=opera-parallax-1';
import {roundedUnder,curveUnder} from './round-geometry.mjs?v=opera-parallax-1';
export const TILE=64,RISE=48,COLS=256,ROWS=192;
export const MAX_PROJECT_LENGTH=64*1024*1024;
export const surfaces=['grass','cobble','dirt','water','wood','sand','asphalt','sidewalk','brick'];
export const barriers=['wood','rail','iron','limestone','brick','plaster','music-square'];
export const directions=['north','south','east','west'];
export function blank(){return {version:1,name:'My Coda Town',cells:{},edges:{},objects:[],spawn:{x:8192,y:6144}};}
export const key=(x,y)=>`${x},${y}`;
export function cell(d,x,y){return d.cells[key(x,y)]||{surface:'grass',level:0};}
export function stairProfile(a){return {base:a.stairBase??a.level,rise:a.stairRise??1,start:a.stairStart??0,end:a.stairEnd??1};}
export function clearStairs(a){for(const k of ['stairs','stairBase','stairRise','stairStart','stairEnd'])delete a[k];}
export function terrainHeight(d,x,y){const a=cell(d,Math.floor(x/TILE),Math.floor(y/TILE));if(!a.stairs){const q=roundedUnder(d,a,x,y);return (q?.kind==='height'?curveUnder(d,q).level:a.level)*RISE;}const q=stairProfile(a),fx=(x/TILE)%1,fy=(y/TILE)%1,t={north:1-fy,south:fy,east:fx,west:1-fx}[a.stairs],f=Math.max(0,Math.min(1,(t-q.start)/(q.end-q.start)));return (q.base+f*q.rise)*RISE;}
const TERRAIN_VIEW=Symbol.for('coda.town.terrainWithoutPierDecks'),terrainViews=new WeakMap();
export function terrainView(d){if(d[TERRAIN_VIEW])return d;if(!terrainViews.has(d))terrainViews.set(d,{...d,[TERRAIN_VIEW]:true});const view=terrainViews.get(d);Object.assign(view,d);return view;}
export function height(d,x,y){const a=cell(d,Math.floor(x/TILE),Math.floor(y/TILE));return a.pier&&!d[TERRAIN_VIEW]?a.pier.level*RISE:terrainHeight(d,x,y);}
export function surfaceAt(d,x,y){const a=cell(d,Math.floor(x/TILE),Math.floor(y/TILE)),q=roundedUnder(d,a,x,y);return q?curveUnder(d,q).surface:a.surface;}
export function edgeKey(a,b){if(a.y===b.y)return `h:${Math.min(a.x,b.x)}:${a.y}`;return `v:${a.x}:${Math.min(a.y,b.y)}`;}
export function connect(d,a,b,style,gate=false){let p={...a};while(p.x!==b.x||p.y!==b.y){const q={x:p.x+(p.x!==b.x?Math.sign(b.x-p.x):0),y:p.y+(p.x===b.x?Math.sign(b.y-p.y):0)};if(p.x>=0&&p.y>=0&&q.x>=0&&q.y>=0&&p.x<=COLS&&q.x<=COLS&&p.y<=ROWS&&q.y<=ROWS)d.edges[edgeKey(p,q)]={style,gate,open:false};p=q;}}
export function segment(k){
 const [axis,x,y,dx,dy]=k.split(':');
 return axis==='w'?{x:+x,y:+y,dx:+dx,dy:+dy}:{x:+x*TILE,y:+y*TILE,dx:axis==='h'?TILE:0,dy:axis==='v'?TILE:0};
}
function validBarrierEdge(k,e){
 if(!e||!barriers.includes(e.style)||typeof e.gate!=='boolean'||typeof e.open!=='boolean')return false;
 if(e.wallScale!==undefined&&(e.style!=='music-square'||!Number.isFinite(e.wallScale)||e.wallScale<.25||e.wallScale>3))return false;
 if(/^[hv]:\d+:\d+$/.test(k))return true;
 if(e.style!=='music-square'||!/^w:(?:\d+(?:\.\d{1,4})?):(?:\d+(?:\.\d{1,4})?):(?:\d+(?:\.\d{1,4})?):(?:\d+(?:\.\d{1,4})?)$/.test(k))return false;
 const s=segment(k);return ((s.dx>0&&s.dy===0)||(s.dy>0&&s.dx===0))&&Math.max(s.dx,s.dy)<=TILE+.0001;
}
export function pointInPolygon(x,y,p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function polygonBlocks(x,y,points,radius){
 if(pointInPolygon(x,y,points))return true;
 if(!radius)return false;
 const squared=radius*radius;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[j],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/length)):0;
  const X=x-a[0]-dx*t,Y=y-a[1]-dy*t;
  if(X*X+Y*Y<squared)return true;
 }
 return false;
}
export function blocked(d,x,y,catalog,from){
 if(x<12||y<12||x>COLS*TILE-12||y>ROWS*TILE-12)return true;
 const a=cell(d,Math.floor(x/TILE),Math.floor(y/TILE));
 const water=surfaceAt(d,x,y)==='water';
 if(d[Symbol.for('coda.town.waterNavigation')]?(!water||!!a.bridge):water&&!a.bridge)return true;
 if(from&&Math.abs(height(d,x,y)-height(d,from.x,from.y))>14)return true;
 for(const [k,e]of Object.entries(d.edges)){
  if(e.gate&&e.open)continue;
  const s=segment(k),px=Math.max(s.x,Math.min(s.x+s.dx,x)),py=Math.max(s.y,Math.min(s.y+s.dy,y));
  if(Math.hypot(x-px,y-py)<14)return true;
 }
 // Navigation views carry a foot radius without changing the saved map or
 // the player's explicit collision switches. Asset geometry stays shared.
 const radius=d[Symbol.for('coda.town.collisionRadius')]||0;
 for(const o of d.objects){
  if(o.mount||!o.collision)continue;
  const a=catalog.get(o.asset);if(!a)continue;
  const scale=o.scale||1,r=-(o.rotation||0)*Math.PI/180,dx=(x-o.x)/scale,dy=(y-o.y)/scale;
  const lx=dx*Math.cos(r)-dy*Math.sin(r)+a.w/2,ly=dx*Math.sin(r)+dy*Math.cos(r)+a.h,localRadius=radius/scale,pad=Math.max(10,localRadius);
  if(a.polygons?.some(p=>polygonBlocks(lx,ly,p,localRadius)))return true;
  for(const b of a.boxes||[])if(lx>b.x-pad&&lx<b.x+b.w+pad&&ly>b.y-pad&&ly<b.y+b.h+pad)return true;
 }
 return false;
}
export function parseProject(text,ids){if(text.length>MAX_PROJECT_LENGTH)throw Error('Project exceeds 64 MiB.');const d=JSON.parse(text),finite=v=>typeof v==='number'&&Number.isFinite(v),range=(v,a,b)=>finite(v)&&v>=a&&v<=b;if(d.version!==1||typeof d.name!=='string'||d.name.length>100||!d.cells||!d.edges||!Array.isArray(d.objects)||d.objects.length>10000||!d.spawn||!range(d.spawn.x,0,COLS*TILE)||!range(d.spawn.y,0,ROWS*TILE))throw Error('Invalid town project.');if(Object.keys(d.cells).length>COLS*ROWS||Object.keys(d.edges).length>100000)throw Error('Too many terrain cells or edges.');for(const [k,c] of Object.entries(d.cells)){const [x,y]=k.split(',').map(Number);if(k!==key(x,y)||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=COLS||y>=ROWS||!surfaces.includes(c.surface)||!Number.isInteger(c.level)||c.level<0||c.level>8||c.stairs&&!directions.includes(c.stairs)||c.bridge&&!['ns','ew'].includes(c.bridge))throw Error('Invalid terrain cell.');if(c.curves!==undefined){if(!Array.isArray(c.curves)||c.curves.length>8||c.stairs)throw Error('Invalid rounded terrain.');for(const q of c.curves)if(!q||q.mask!==undefined&&(!validMask(q.mask)||q.corner!=='nw'||q.r!==64||q.cx!==(x+1)*64||q.cy!==(y+1)*64||q.concave===true)||!range(q.cx,0,COLS*TILE)||!range(q.cy,0,ROWS*TILE)||!range(q.r,16,512)||!['nw','ne','sw','se'].includes(q.corner)||!['height','surface'].includes(q.kind)||q.concave!==undefined&&typeof q.concave!=='boolean'||q.under!==undefined&&(!q.under||typeof q.under!=='object'||Object.keys(q.under).some(k=>!['surface','level','paving','paint'].includes(k))||!surfaces.includes(q.under.surface)||!Number.isInteger(q.under.level)||q.under.level<0||q.under.level>8||q.under.paving!==undefined&&(typeof q.under.paving!=='string'||q.under.paving!=='auto'&&!ids.has(q.under.paving))||q.under.paint!==undefined&&!validPaint(q.under.paint,ids))||q.style!==undefined&&!['smooth','rocky','bevel'].includes(q.style)||q.lift!==undefined&&(!Number.isInteger(q.lift)||Math.abs(q.lift)>8)||!Number.isInteger(q.underX)||!Number.isInteger(q.underY)||q.underX<0||q.underX>=COLS||q.underY<0||q.underY>=ROWS)throw Error('Invalid terrain curve.');}if(c.pier!==undefined&&(!c.pier||typeof c.pier!=='object'||Object.keys(c.pier).some(k=>!['level','axis'].includes(k))||!Number.isInteger(c.pier.level)||c.pier.level<0||c.pier.level>8||!['ns','ew'].includes(c.pier.axis)||c.bridge!==c.pier.axis||c.stairs||c.pier.level<c.level))throw Error('Invalid pier.');if(c.sidewalkCurb!==undefined&&typeof c.sidewalkCurb!=='boolean')throw Error('Invalid sidewalk curb.');if(c.paint!==undefined&&!validPaint(c.paint,ids))throw Error('Invalid ground paint.');if(c.paving!==undefined&&c.paving!=='auto'&&(typeof c.paving!=='string'||!ids.has(c.paving)))throw Error('Invalid paving material.');if(['stairBase','stairRise','stairStart','stairEnd'].some(k=>c[k]!==undefined)){const q=stairProfile(c);if(!c.stairs||!range(q.base,0,8)||!range(q.rise,1e-10,8)||!range(q.start,0,1)||!range(q.end,0,1)||q.end<=q.start||q.base+q.rise>8+1e-8||q.rise/(q.end-q.start)>8+1e-8||c.level!==Math.floor(q.base))throw Error('Invalid stair profile.');}}for(const [k,e]of Object.entries(d.edges)){if(!validBarrierEdge(k,e))throw Error('Invalid fence or wall.');const s=segment(k);if(s.x+s.dx>COLS*TILE||s.y+s.dy>ROWS*TILE)throw Error('Fence outside map.');}for(const o of d.objects)if(!ids.has(o.asset)||!range(o.x,0,COLS*TILE)||!range(o.y,0,ROWS*TILE)||!range(o.scale,.25,3)||![0,90,180,270].includes(o.rotation)||!['objects','overgrowth','ground'].includes(o.layer)||typeof o.collision!=='boolean'||o.asset==='coda-arcade'&&o.scale!==1)throw Error('Invalid asset placement.');for(const o of d.objects)if(o.mount){const m=o.mount;if(!m||!Number.isInteger(m.x)||!Number.isInteger(m.y)||m.x<0||m.x>=COLS||m.y<0||m.y>=ROWS-1||!range(m.u,0,1)||!range(m.v,0,1))throw Error('Invalid cliff attachment.');}return d;}
export class History{constructor(){this.undo=[];this.redo=[];}record(d){this.undo.push(JSON.stringify(d));if(this.undo.length>35)this.undo.shift();this.redo=[];}back(d){if(!this.undo.length)return d;this.redo.push(JSON.stringify(d));return JSON.parse(this.undo.pop());}forward(d){if(!this.redo.length)return d;this.undo.push(JSON.stringify(d));return JSON.parse(this.redo.pop());}}
