import {COLS,ROWS,RISE,TILE,cell,key,height,terrainHeight,surfaceAt,blocked} from '../world/model.mjs?v=queues-stage-1';

const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const tile=p=>({x:Math.floor(p.x/TILE),y:Math.floor(p.y/TILE)});
const inside=p=>p.x>=0&&p.y>=0&&p.x<COLS&&p.y<ROWS;

// A pier is a raised walkable structure, not a terrain edit. Water, lower
// ground and their masks remain intact beneath its deck and support posts.
export function planPier(doc,startWorld,endWorld,{width=2,level=1,catalog=new Map()}={}){
 const start=point(startWorld)?tile(startWorld):null,target=point(endWorld)?tile(endWorld):null;
 const fail=message=>({valid:false,start,end:target,edits:[],message});
 if(!start||!target||!inside(start)||!inside(target))return fail('Keep the pier inside the map.');
 const dx=target.x-start.x,dy=target.y-start.y,axis=Math.abs(dx)>=Math.abs(dy)?'ew':'ns',along=axis==='ew'?'x':'y',across=axis==='ew'?'y':'x',end={...start,[along]:target[along]};
 const initial=cell(doc,start.x,start.y),sx=(start.x+.5)*TILE,sy=(start.y+.5)*TILE;
 const deck=initial.pier?.level??(surfaceAt(doc,sx,sy)==='water'?Math.max(initial.level,Math.max(0,Math.min(8,Math.round(Number(level)||0)))):height(doc,sx,sy)/RISE);
 if(!Number.isInteger(deck)||deck<0||deck>8)return fail('Start on flat ground or an existing pier.');
 width=Math.max(1,Math.min(8,Math.round(Number(width)||1)));const radius=Math.floor(width/2),distance=Math.abs(end[along]-start[along]),sign=Math.sign(end[along]-start[along])||1,edits=[];
 for(let i=0;i<=distance;i++)for(let lane=-radius;lane<width-radius;lane++){
  const p={...start,[along]:start[along]+i*sign,[across]:start[across]+lane};if(!inside(p))return fail('The pier width extends outside the map.');
  const a=cell(doc,p.x,p.y);if(a.stairs)return fail('Keep the pier clear of stairs.');
  if(a.pier&&a.pier.level!==deck)return fail('Join a pier at the same deck level.');
  for(const u of [.03,.5,.97])for(const v of [.03,.5,.97])if(terrainHeight(doc,(p.x+u)*TILE,(p.y+v)*TILE)>deck*RISE+.01)return fail('The deck would cut through higher ground. Start at that higher level.');
  const next={...a,bridge:axis,finish:'wood',pier:{level:deck,axis}};delete next.sidewalkCurb;
  if(JSON.stringify(next)!==JSON.stringify(a))edits.push([key(p.x,p.y),next]);
 }
 const preview={...doc,cells:{...doc.cells,...Object.fromEntries(edits)}};
 // Production collision detects buildings, trees and fence runs. A pier must
 // remain clear at its center and near both edges, not merely look connected.
 for(let i=0;i<=distance;i++)for(let lane=-radius;lane<width-radius;lane++){
  const p={...start,[along]:start[along]+i*sign,[across]:start[across]+lane};
  for(const u of [.1,.5,.9])for(const v of [.1,.5,.9])if(blocked(preview,(p.x+u)*TILE,(p.y+v)*TILE,catalog))return fail('Clear the objects or fencing across this pier first.');
 }
 return {valid:true,start,end,from:deck,to:deck,level:deck,width,axis,edits,preview,message:`Timber pier · deck level ${deck} · ${width} tiles wide · release to build`};
}

export function drawPierGuide(c,plan,cam,w,h,flat=false){
 if(!plan)return;c.save();c.translate(w/2,h/2);c.scale(cam.zoom,cam.zoom);c.translate(-cam.x,-cam.y);c.strokeStyle=plan.valid?'#ffe095':'#ff9290';c.lineWidth=2/cam.zoom;
 if(plan.valid)for(const[k]of plan.edits){const[x,y]=k.split(',').map(Number);c.strokeRect(x*TILE,y*TILE-(flat?0:plan.level*RISE),TILE,TILE);}
 c.restore();
}
