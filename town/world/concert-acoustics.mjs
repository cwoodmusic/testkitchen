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

/** Scalloped acoustic fins form a light face and a deep curved return. */
export function drawAcousticShell(c,r,{right=false}={}){
 if(!valid(r))return false;
 c.save();clip(c,r);c.translate(right?r.x+r.w:r.x,r.y);if(right)c.scale(-1,1);
 fill(c,0,0,r.w,r.h,'#ba7a36');grain(c,{x:0,y:0,w:r.w,h:r.h},7);
 for(let i=0;i<11;i++){
  const y=24+i*(r.h-82)/11,reach=r.w-12-(i%3)*10,top=contour([[26,y+8],[r.w*.43,y-19],[r.w*.77,y-16],[reach,y+30]]),lower=contour([[reach,y+52],[r.w*.76,y+7],[r.w*.46,y+22],[25,y+76]]);
  polygon(c,[...top,...lower],i%2?'#7e4c25':'#895127');
  const faceBottom=contour([[reach,y+39],[r.w*.77,y-1],[r.w*.47,y+10],[25,y+62]]);
  polygon(c,[...top,...faceBottom],HONEY[2+i%2]);
  const highlight=contour([[28,y+9],[r.w*.43,y-16],[r.w*.77,y-13],[reach-2,y+30]]);
  c.strokeStyle='#f4d196';c.lineWidth=3;c.beginPath();highlight.forEach((p,n)=>n?c.lineTo(...p):c.moveTo(...p));c.stroke();
  c.save();c.beginPath();[...top,...faceBottom].forEach((p,n)=>n?c.lineTo(...p):c.moveTo(...p));c.closePath();c.clip();grain(c,{x:30,y:y-10,w:r.w-40,h:75},i*11);c.restore();
  // Small dark ports follow the inner acoustic return rather than becoming
  // decorative holes across the timber stage or the audience's route.
  for(let j=0;j<3;j++){const vx=r.w-90+j*21,vy=y+56+j*2;fill(c,vx,vy,11,7,'#583b25');fill(c,vx+2,vy+1,7,5,'#222b2b');fill(c,vx+2,vy,7,1,'#efbf7a');}
 }
 fill(c,r.w-7,0,7,r.h,'#714724');fill(c,r.w-7,0,2,r.h,'#edc17b');c.restore();return true;
}

/** The organ is surrounded by a red vertical acoustic bay, not a gilded wall. */
export function drawOrganAcousticPanels(c,r){
 if(!valid(r))return false;
 c.save();clip(c,r);fill(c,r.x,r.y,r.w,r.h,'#3d242b');
 const gap=10,count=9,w=(r.w-32-(count-1)*gap)/count;
 for(let i=0;i<count;i++){
  const x=r.x+16+i*(w+gap),y=r.y+10+(i%2)*13,h=r.h-12-(i%2)*13;
  fill(c,x+4,y+6,w,h,'#201f26');fill(c,x,y,w-4,h-3,i%3?'#a62e49':'#c2465d');fill(c,x+3,y+1,4,h-5,'#db6b79');fill(c,x+w-11,y+3,6,h-5,'#6a2338');
  for(let yy=y+12;yy<r.y+r.h;yy+=23)fill(c,x+9,yy,w-24,1,'#f4a18c24');
 }
 fill(c,r.x,r.y,8,r.h,'#d39b50');fill(c,r.x+r.w-8,r.y,8,r.h,'#d39b50');c.restore();return true;
}
