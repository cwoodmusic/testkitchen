// Architectural faces sit entirely inside the hall's existing raised/blocked
// regions. The ceiling is a shallow frieze, never a roof over the playing field.
const HONEY=['#b57a3b','#c98e48','#d9a25b','#e5b672','#f0ca8b'];
const finite=Number.isFinite;
const valid=r=>r&&[r.x,r.y,r.w,r.h].every(finite)&&r.w>0&&r.h>0;
const fill=(c,x,y,w,h,color)=>{if(w<=0||h<=0)return;c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
function polygon(c,points,color){c.fillStyle=color;c.beginPath();for(let i=0;i<points.length;i++)i?c.lineTo(...points[i]):c.moveTo(...points[i]);c.closePath();c.fill();}
function clip(c,r){c.beginPath();c.rect(r.x,r.y,r.w,r.h);c.clip();c.imageSmoothingEnabled=false;}
function bezier(a,b,d,e,t){const u=1-t;return u*u*u*a+3*u*u*t*b+3*u*t*t*d+t*t*t*e;}
function contour(points,steps=22){const result=[];for(let i=0;i<=steps;i++){const t=i/steps;result.push([Math.round(bezier(points[0][0],points[1][0],points[2][0],points[3][0],t)/2)*2,Math.round(bezier(points[0][1],points[1][1],points[2][1],points[3][1],t)/2)*2]);}return result;}
function grain(c,r,seed=0){
 for(let y=r.y+5,n=0;y<r.y+r.h;y+=9,n++)for(let x=r.x+8+((n*23+seed)%61);x<r.x+r.w-10;x+=103){const w=Math.min(42+(n*13+seed)%43,r.x+r.w-x-4);fill(c,x,y,w,1,n%3?'#ffe0a51a':'#5d3c2416');if(n%4===0)fill(c,x+9,y+2,Math.min(26,w-9),1,'#8a592916');}
}

/** Recessed paired spotlights between broad satin-beech ceiling coffers. */
export function drawAcousticCeiling(c,width){
 if(!finite(width)||width<=144)return false;
 const r={x:72,y:0,w:width-144,h:176};c.save();clip(c,r);
 fill(c,r.x,r.y,r.w,r.h,'#c58b48');
 for(let x=72,i=0;x<width-72;x+=156,i++){
  fill(c,x+3,0,150,176,HONEY[1+i%3]);fill(c,x+3,0,4,176,'#f4d39b');fill(c,x+149,0,7,176,'#7d4e28');
  for(let y=18,row=0;y<160;y+=57,row++){
   const center=x+75+(row%2?15:-8),w=67-row*7,h=25;
   polygon(c,[[center-w/2-6,y-3],[center+w/2+4,y-3],[center+w/2,y+h+6],[center-w/2-10,y+h+6]],'#8d592e');
   fill(c,center-w/2,y,w,h,'#292928');fill(c,center-w/2+2,y+2,w-4,2,'#151c20');fill(c,center-w/2,y+h-2,w,2,'#f2c47d');
   for(const side of [-1,1]){const lx=center+side*w*.24;fill(c,lx-7,y+7,14,10,'#f4dfb7');fill(c,lx-5,y+8,10,7,'#fff2d7');fill(c,lx-3,y+8,6,5,'#ffffff');}
  }
  grain(c,{x:x+9,y:0,w:138,h:176},i*7);
 }
 fill(c,72,167,width-144,9,'#79502e');fill(c,72,166,width-144,2,'#f1c984');c.restore();return true;
}

/** Broad roof returns project above recessed side-gallery air, not a wall decal. */
export function drawAcousticShell(c,r,{right=false}={}){
 if(!valid(r))return false;
 c.save();clip(c,r);c.translate(right?r.x+r.w:r.x,r.y);if(right)c.scale(-1,1);
 fill(c,0,0,r.w,r.h,'#292326');
 // The outer structural wall carries the roof; the inboard space beneath it
 // is deliberately dark. Each return has a top, thick soffit and cut end.
 fill(c,0,0,44,r.h,'#9b6738');fill(c,2,0,8,r.h,'#e8be80');grain(c,{x:8,y:0,w:30,h:r.h},7);
 const step=r.h/6;
 for(let i=0;i<6;i++){
  const y=-32+i*step,reach=r.w-12-(i%2)*18;
  const top=contour([[28,y+18],[r.w*.35,y-54],[r.w*.75,y-24],[reach,y+42]]);
  const back=contour([[reach,y+92],[r.w*.74,y+28],[r.w*.39,y+10],[28,y+110]]);
  const lip=contour([[reach,y+65],[r.w*.74,y+2],[r.w*.39,y-12],[28,y+86]]);
  c.save();c.translate(8,30);polygon(c,[...top,...back],'#080d1478');c.restore();
  polygon(c,[...top,...back],'#6d4328');
  polygon(c,[...top,...lip],HONEY[2+i%2]);
  polygon(c,[[reach-9,y+39],[reach,y+42],[reach,y+92],[reach-9,y+87]],'#9f6937');
  lineAlong(c,top,'#f3d09a',4);lineAlong(c,lip,'#a16c3c',3);
  c.save();c.beginPath();[...top,...lip].forEach((p,n)=>n?c.lineTo(...p):c.moveTo(...p));c.closePath();c.clip();grain(c,{x:28,y:y-50,w:r.w-35,h:155},i*19);c.restore();
  // A short bracket visibly joins each return to the continuous roof wall.
  fill(c,21,y+27,22,70,'#745033');fill(c,24,y+28,10,62,'#d6aa70');fill(c,27,y+34,3,44,'#f1c98d');
  for(let j=0;j<3;j++){const vx=r.w-96+j*22,vy=y+112+j*2;fill(c,vx,vy,12,8,'#0e171c');fill(c,vx+2,vy,8,1,'#a5845a');}
 }
 c.restore();return true;
}
function lineAlong(c,points,color,width){c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke();}

/** A projecting soffit casts an open-bottom shadow, not a framed wall niche. */
export function drawAcousticAirBay(c,r){
 if(!valid(r))return false;
 c.save();clip(c,r);
 const shadow=c.createLinearGradient(0,r.y+24,0,r.y+r.h);
 shadow.addColorStop(0,'#0d141df5');shadow.addColorStop(.5,'#191f29e8');shadow.addColorStop(.82,'#1b202980');shadow.addColorStop(1,'#1b202900');
 // Tapered, staggered shadow edges fade back into the rear timber below.
 // No side posts or lower sill enclose the clouds like display screens.
 c.fillStyle=shadow;c.beginPath();for(const [i,p]of [[r.x,r.y+22],[r.x+r.w,r.y+22],[r.x+r.w-18,r.y+r.h*.83],[r.x+r.w-66,r.y+r.h],[r.x+54,r.y+r.h-8],[r.x+13,r.y+r.h*.77]].entries())i?c.lineTo(...p):c.moveTo(...p);c.closePath();c.fill();
 polygon(c,[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w-2,r.y+13],[r.x+6,r.y+10]],'#e0b77a');
 polygon(c,[[r.x+6,r.y+10],[r.x+r.w-2,r.y+13],[r.x+r.w-10,r.y+31],[r.x+16,r.y+25]],'#a4713e');
 polygon(c,[[r.x+16,r.y+25],[r.x+r.w-10,r.y+31],[r.x+r.w-18,r.y+38],[r.x+22,r.y+32]],'#5a3c2d');
 grain(c,{x:r.x+14,y:r.y,w:r.w-28,h:24},3);
 c.restore();return true;
}

/** The organ is surrounded by a red vertical acoustic bay, not a gilded wall. */
export function drawOrganAcousticPanels(c,r){
 if(!valid(r))return false;
 c.save();clip(c,r);fill(c,r.x,r.y,r.w,r.h,'#211d25');
 // Angled reveals lead back to the acoustic panels. The native pipe case
 // stands on a timber plinth in front, rather than floating on a red flat.
 polygon(c,[[r.x,r.y],[r.x+66,r.y+34],[r.x+66,r.y+r.h-28],[r.x,r.y+r.h]],'#b27c43');
 polygon(c,[[r.x+r.w,r.y],[r.x+r.w-66,r.y+34],[r.x+r.w-66,r.y+r.h-28],[r.x+r.w,r.y+r.h]],'#7e502f');
 fill(c,r.x,r.y,r.w,18,'#dfb57a');fill(c,r.x+12,r.y+18,r.w-24,9,'#6a4430');
 const count=9,gap=8,w=(r.w-160-(count-1)*gap)/count;
 for(let i=0;i<count;i++){
  const x=r.x+80+i*(w+gap),y=r.y+31+(i%2)*9,h=r.h-61-(i%2)*9;
  fill(c,x+4,y+6,w,h,'#100f17');fill(c,x,y,w-4,h-3,i%3?'#a62e49':'#c2465d');fill(c,x+3,y+1,3,h-5,'#db6b79');fill(c,x+w-10,y+3,5,h-5,'#6a2338');
  for(let yy=y+12;yy<y+h;yy+=23)fill(c,x+9,yy,w-24,1,'#f4a18c24');
 }
 fill(c,r.x+66,r.y+27,10,r.h-45,'#090f17');fill(c,r.x+r.w-76,r.y+27,10,r.h-45,'#090f17');
 polygon(c,[[r.x+8,r.y+r.h-17],[r.x+68,r.y+r.h-34],[r.x+r.w-68,r.y+r.h-34],[r.x+r.w-8,r.y+r.h-17]],'#d5ac71');
 fill(c,r.x+8,r.y+r.h-17,r.w-16,17,'#8e5b35');fill(c,r.x+9,r.y+r.h-17,r.w-18,3,'#edca93');
 c.restore();return true;
}
