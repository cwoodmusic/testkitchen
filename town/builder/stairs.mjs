import {COLS,ROWS,cell,key,stairProfile,blocked,height} from '../world/model.mjs?v=opera-shells-1';
const inside=p=>Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<COLS&&p.y<ROWS;
const round=v=>Math.round(v*1e9)/1e9;
export function planStairs(doc,start,target,{width=3,finish='stone',catalog=new Map()}={}){
 const fail=message=>({valid:false,message,start,end:target,edits:[]});
 if(!inside(start)||!inside(target))return fail('Keep both ends inside the map.');
 const dx=target.x-start.x,dy=target.y-start.y,axis=Math.abs(dx)>=Math.abs(dy)?'x':'y',end={...start,[axis]:target[axis]};
 if(start[axis]===end[axis])return fail('Drag from one ground level to a different level.');
 const levelAt=p=>height(doc,(p.x+.5)*64,(p.y+.5)*64)/48;
 const from=levelAt(start),to=levelAt(end);if(Math.min(from,to)<0||Math.max(from,to)>8)return fail('Choose ground levels between 0 and 8.');if(Math.abs(from-to)<1e-8)return fail('The ends are at the same height. Drag onto higher or lower ground.');
 const low=from<to?start:end,high=from<to?end:start,lowLevel=Math.min(from,to),highLevel=Math.max(from,to),step=Math.sign(high[axis]-low[axis]),distance=Math.abs(high[axis]-low[axis]),direction=axis==='x'?step>0?'east':'west':step>0?'south':'north';
 width=Math.max(1,Math.min(15,Math.floor(Number(width)||1)));const radius=Math.floor(width/2),edits=[];
 for(let i=0;i<=distance;i++)for(let lane=-radius;lane<width-radius;lane++){
  const p={...low,[axis]:low[axis]+step*i,[axis==='x'?'y':'x']:low[axis==='x'?'y':'x']+lane};if(!inside(p))return fail('The stair width extends outside the map.');
  const a=cell(doc,p.x,p.y);if(a.surface==='water')return fail('Stairs need dry ground. Use a bridge over water.');
  const begin=i===0?.5:0,end=i===distance?.5:1,base=round(lowLevel+(highLevel-lowLevel)*(i+begin-.5)/distance),rise=round((highLevel-lowLevel)*(end-begin)/distance);
  const next={...a,surface:finish==='wood'?'wood':'cobble',level:Math.floor(base),stairs:direction,stairBase:base,stairRise:rise,stairStart:begin,stairEnd:end,finish};delete next.bridge;delete next.pier;delete next.sidewalkCurb;delete next.curves;
  edits.push([key(p.x,p.y),next]);
 }
 const preview={...doc,cells:{...doc.cells,...Object.fromEntries(edits)}};
 // Keep stairs usable: existing houses, trunks and fencing must be cleared first.
 for(const[k,a]of edits){const[x,y]=k.split(',').map(Number);for(const t of [a.stairStart+.001,(a.stairStart+a.stairEnd)/2,a.stairEnd-.001]){const fx=direction==='east'?t:direction==='west'?1-t:.5,fy=direction==='south'?t:direction==='north'?1-t:.5;if(blocked(preview,(x+fx)*64,(y+fy)*64,catalog))return fail('Clear the objects or fencing across this stairway first.');}}
 return {valid:true,start,end,from,to,direction,width,edits,preview,message:`${from} → ${to} · ${width} tiles wide · release to build`};
}
export function drawStairGuide(c,plan,cam,w,h,flat=false){if(!plan)return;c.save();c.translate(w/2,h/2);c.scale(cam.zoom,cam.zoom);c.translate(-cam.x,-cam.y);c.strokeStyle=plan.valid?'#ffe095':'#ff9290';c.fillStyle=plan.valid?'#ffe095':'#ff9290';c.lineWidth=3/cam.zoom;if(plan.valid){for(const[k,a]of plan.edits){const[x,y]=k.split(',').map(Number),q=stairProfile(a);c.strokeRect(x*64,y*64-(flat?0:q.base*48),64,64);}}const a=plan.start,b=plan.end;if(a&&b){const x=(a.x+.5)*64,y=(a.y+.5)*64-(flat?0:(plan.from||0)*48),xx=(b.x+.5)*64,yy=(b.y+.5)*64-(flat?0:(plan.to||0)*48);c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();for(const[p,q]of [[x,y],[xx,yy]]){c.beginPath();c.arc(p,q,6/cam.zoom,0,Math.PI*2);c.fill();}}c.restore();}
