import {cell,height,terrainHeight,surfaceAt,RISE,TILE} from './model.mjs?v=north-walls-1';

const same=(d,x,y,level)=>cell(d,x,y).pier?.level===level;
export function pierGeometry(d,x,y){
 const a=cell(d,x,y);if(!a.pier)return null;
 const z=a.pier.level*RISE,X=x*TILE,Y=y*TILE,ground=terrainHeight(d,X+TILE/2,Y+TILE/2),water=surfaceAt(d,X+TILE/2,Y+TILE/2)==='water';
 const joins={north:same(d,x,y-1,a.pier.level),east:same(d,x+1,y,a.pier.level),south:same(d,x,y+1,a.pier.level),west:same(d,x-1,y,a.pier.level)};
 const supportY=Y+TILE-8,top=supportY-z-2,supports=[];
 const support=offset=>{const px=X+offset,base=terrainHeight(d,px+5,supportY),wet=surfaceAt(d,px+5,supportY)==='water',waterline=supportY-base;return {x:px,y:top,w:10,h:Math.max(5,waterline+(wet?58:3)-top),waterline,ground:base,water:wet};};
 // Regular bents carry a long run; end bents and outside corners remain even
 // on the odd grid rows. Every post ends at real ground or below the water.
 if(!joins.south||y%2===0){
  if(!joins.west||x%2===0)supports.push(support(6));
  if(!joins.east)supports.push(support(TILE-16));
 }
 return {x:X,y:Y-z,w:TILE,h:TILE,z,ground,water,axis:a.pier.axis,joins,supports};
}

function post(c,p){
 c.fillStyle='#3d3028';c.fillRect(p.x,p.y,p.w,p.h);c.fillStyle='#725039';c.fillRect(p.x+2,p.y,p.w-3,p.h);c.fillStyle='#a27a50';c.fillRect(p.x+2,p.y,2,p.h);
 for(let at=p.y+9;at<p.y+p.h;at+=24){c.fillStyle='#49392c';c.fillRect(p.x+5,at,1,11);c.fillStyle='#c3945e55';c.fillRect(p.x+3,at+3,1,8);}
 c.fillStyle='#252d2b';c.fillRect(p.x,p.y+12,p.w,4);c.fillStyle='#9a9e90';c.fillRect(p.x+2,p.y+13,2,1);
 if(p.water&&p.y+p.h>p.waterline){const top=Math.max(p.y,p.waterline),g=c.createLinearGradient(0,top,0,p.y+p.h);g.addColorStop(0,'rgba(27,99,106,.22)');g.addColorStop(.55,'rgba(34,112,119,.62)');g.addColorStop(1,'rgba(34,112,119,.94)');c.fillStyle=g;c.fillRect(p.x,top,p.w,p.y+p.h-top);}
}
export function drawPier(c,d,x,y,wood){
 const g=pierGeometry(d,x,y);if(!g)return;
 c.save();for(const p of g.supports)post(c,p);
 // A weathered native wood field supplies grain and joints at its actual
 // world pixel scale; the edge fascia remains separate from the deck boards.
 if(wood){c.save();if(g.axis==='ew'){c.translate(g.x,g.y);c.rotate(Math.PI/2);c.drawImage(wood,(y%8)*TILE,(x%8)*TILE,TILE,TILE,0,-TILE,TILE,TILE);}else c.drawImage(wood,(x%8)*TILE,(y%8)*TILE,TILE,TILE,g.x,g.y,TILE,TILE);c.restore();}
 else{c.fillStyle='#9b7952';c.fillRect(g.x,g.y,TILE,TILE);}
 c.fillStyle='#44392c';if(!g.joins.south)c.fillRect(g.x,g.y+TILE-5,TILE,8);if(!g.joins.east)c.fillRect(g.x+TILE-5,g.y,5,TILE);if(!g.joins.west)c.fillRect(g.x,g.y,4,TILE);if(!g.joins.north)c.fillRect(g.x,g.y,TILE,4);
 c.fillStyle='#c1a375';if(!g.joins.north)c.fillRect(g.x+1,g.y+1,TILE-2,2);if(!g.joins.west)c.fillRect(g.x+1,g.y+1,2,TILE-2);if(!g.joins.south)c.fillRect(g.x+1,g.y+TILE-5,TILE-2,2);
 // Nail pairs are sparse world-anchored details, not painted footprints.
 c.fillStyle='#413c34';for(const px of [8,53])for(const py of [12,44])c.fillRect(g.x+px,g.y+py,2,2);c.restore();
}

// Higher southern terrain rows cover the main structure naturally. Only the
// submerged timber is restored after water rendering, clipped to visible water
// at that floor so it cannot paint over a bank, another deck, or a bridge.
export function submergedPierRuns(d,p){
 const runs=[];if(!p.water)return runs;
 for(let Y=Math.max(p.y,p.waterline);Y<p.y+p.h;Y+=2){
  const X=p.x+p.w/2,worldY=Y+p.ground+1,a=cell(d,Math.floor(X/TILE),Math.floor(worldY/TILE));
  if(a.bridge||a.pier||surfaceAt(d,X,worldY)!=='water'||Math.abs(terrainHeight(d,X,worldY)-p.ground)>.01)continue;
  // A taller bank farther south may project over the water sample. Its floor
  // or another elevated deck must cover the submerged timber too.
  let covered=false;for(let level=Math.floor(p.ground/RISE)+1;level<=8;level++)if(Math.abs(height(d,X,Y+level*RISE+1)-level*RISE)<.05){covered=true;break;}
  if(!covered)runs.push({x:p.x,y:Y,w:p.w,h:Math.min(2,p.y+p.h-Y)});
 }
 return runs;
}
export function drawPierSubmerged(c,d,x,y){
 const g=pierGeometry(d,x,y);if(!g)return;
 for(const p of g.supports){
  if(!p.water)continue;c.save();c.beginPath();let any=false;
  for(const r of submergedPierRuns(d,p)){c.rect(r.x,r.y,r.w,r.h);any=true;}
  if(any){c.clip();post(c,p);}c.restore();
 }
}
