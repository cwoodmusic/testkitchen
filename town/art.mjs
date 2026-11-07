import {baseElevation,entryConnectors,annexFurniture,roomPlan,interiorWalls,interiorFurniture} from './model.mjs';
export const noise=(x,y,s=0)=>{const n=Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453;return n-Math.floor(n);};
export function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
export function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
const load=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Town artwork failed to load: '+src));i.src=new URL(src,import.meta.url);});
// Discover the opaque bounds in each equal atlas cell. This keeps the south
// threshold aligned to the real door rather than to transparent image margins.
function cells(image,columns=3,rows=2){const result=[];for(let i=0;i<columns*rows;i++){const ox=Math.floor(i%columns*image.width/columns),oy=Math.floor(Math.floor(i/columns)*image.height/rows),cw=Math.floor((i%columns+1)*image.width/columns)-ox,ch=Math.floor((Math.floor(i/columns)+1)*image.height/rows)-oy,c=document.createElement('canvas');c.width=cw;c.height=ch;const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(image,ox,oy,cw,ch,0,0,cw,ch);const pixels=cx.getImageData(0,0,cw,ch).data;let left=cw,top=ch,right=0,bottom=0;for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(pixels[(y*cw+x)*4+3]>40){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}result.push({image,sx:ox+left,sy:oy+top,sw:right-left+1,sh:bottom-top+1});}return result;}
const [houses,foliage,props,furniture,ground,music,landscape]=await Promise.all([load('assets/houses.png'),load('assets/foliage.png'),load('assets/props.png'),load('assets/furniture.png'),load('assets/ground.png'),load('assets/music-details.png'),load('assets/landscape-details.png')]);
const houseCells=cells(houses),treeCells=cells(foliage),propCells=cells(props),furnitureCells=cells(furniture,3,3),musicCells=cells(music),landscapeCells=cells(landscape);
export const materials=Array.from({length:4},(_,i)=>{const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.drawImage(ground,i%2*ground.width/2,Math.floor(i/2)*ground.height/2,ground.width/2,ground.height/2,0,0,512,512);return c;});
const tones={lawn:'saturate(.25) brightness(.84)',forest:'saturate(.32) brightness(.55)',orchard:'saturate(.3) sepia(.45) brightness(.9)',ridge:'saturate(.3) hue-rotate(12deg) brightness(.79)',garden:'saturate(.35) brightness(.83)',lantern:'saturate(.3) hue-rotate(25deg) brightness(.66)',meadow:'saturate(.25) sepia(.6) brightness(.95)',marsh:'saturate(.12) hue-rotate(38deg) brightness(.65)'};
const filtered=new Map();
function variant(image,tone){if(!tone)return image;const key=(image.src||'canvas')+tone;if(!filtered.has(key)){const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const g=c.getContext('2d');g.filter=tones[tone]||tone;g.drawImage(image,0,0);filtered.set(key,c);}return filtered.get(key);}
export function material(index,tone='lawn'){const key='material:'+index+':'+tone;if(!filtered.has(key)){const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.filter=tones[tone]||tone;g.drawImage(materials[index],0,0);filtered.set(key,c);}return filtered.get(key);}
function sprite(c,cell,x,y,w,h,tone){c.drawImage(variant(cell.image,tone),cell.sx,cell.sy,cell.sw,cell.sh,x,y,w,h);}
function buildingPart(c,cell,x,y,w,h,annex=false){const image=variant(cell.image,'saturate(.72) brightness(.88)'),roof=cell.sh*.7,front=cell.sh-roof;
 // Roof depth is drawn over the actual floor area; the south wall is a short
 // vertical projection, not a tall facade standing in for the entire house.
 c.drawImage(image,cell.sx,cell.sy,cell.sw,roof,x,y-100,w,h);
 if(!annex)c.drawImage(image,cell.sx,cell.sy+roof,cell.sw,front,x,y+h-100,w,100);
 else{for(let dx=0;dx<w;dx+=220){const ww=Math.min(220,w-dx);c.drawImage(image,cell.sx+cell.sw*.055,cell.sy+roof,cell.sw*.32,front,x+dx,y+h-100,ww,100);}}
 rect(c,x,y+h-100,w,4,'#26342d88');
}
export function housePart(c,h,p){const z=baseElevation(h.door?.x??h.x+h.w/2,h.porch?.y??h.y+h.h)+(h.porch?.rise||0),x=h.x+p.x,y=h.y+p.y-z;ellipse(c,x+p.w*.55,y+p.h+20,p.w*.54,32,'#10272455');buildingPart(c,houseCells[h.kind==='glasshouse'?3:h.style??0],x,y,p.w,p.h,p!==h.core&&!!h.core);if(p===h.core){musicalDetail(c,0,x+p.w*.27,y+p.h-112,66,90);if(h.style%2===0)musicalDetail(c,2,x+p.w*.73,y+p.h-88,52,52);}}
export function house(c,h){if(h.kind==='bandstand'){const z=baseElevation(h.x+h.w/2,h.y+h.h);sprite(c,propCells[4],h.x,h.y-z-100,h.w,h.h+100,'saturate(.55) brightness(.8)');return;}for(const p of [...(h.parts||[{x:0,y:0,w:h.w,h:h.h}])].sort((a,b)=>a.y+a.h-b.y-b.h))housePart(c,h,p);}
export function environmentDetail(c,index,x,y,w,h){sprite(c,landscapeCells[index],x,y,w,h,'saturate(.65) brightness(.85)');}
export function musicalDetail(c,index,x,y,w,h){sprite(c,musicCells[index],x,y,w,h,'saturate(.7) brightness(.9)');}
export function fountain(c,x,y){sprite(c,propCells[0],x-95,y-165,190,200);}
export function planter(c,x,y,w=110){const cell=propCells[3];sprite(c,cell,x-w/2,y-w*cell.sh/cell.sw,w,w*cell.sh/cell.sw);}
export function tree(c,x,y,size=1,type=0,tone='lawn'){const cell=treeCells[type%6],w=(type===5?180:480)*size,h=w*cell.sh/cell.sw;ellipse(c,x+25,y+10,w*.42,25*size,'#10272055');sprite(c,cell,x-w/2,y-h,w,h,tone);}
export function flower(c,x,y,color){rect(c,x,y,1,9,'#2a623c');rect(c,x-2,y-3,5,4,'#284e3b');rect(c,x-1,y-4,4,4,color);rect(c,x,y-3,1,1,'#ffe3a4');rect(c,x-3,y+3,3,2,'#528e48');}
export function fence(c,x,y,w){for(let dx=0;dx<w;dx+=28){rect(c,x+dx+2,y-28,7,34,'#3b4131');rect(c,x+dx,y-29,6,31,'#af996d');rect(c,x+dx+1,y-28,2,30,'#e0cc94');rect(c,x+dx-1,y-31,8,3,'#c8b17a');}for(const dy of [-19,-5]){rect(c,x,y+dy,w,5,'#756a4d');rect(c,x,y+dy,w,1,'#c2b382');}}
export function bench(c,x,y){const cell=propCells[1];sprite(c,cell,x,y-45,110,75);}
export function lamp(c,x,y){const cell=propCells[2];sprite(c,cell,x-24,y-155,48,160);}
const shade=['#755739','#b39463','#d2b17a','#edcf91'];
function wood(c,x,y,w,h){rect(c,x,y,w,h,shade[0]);for(let row=0;row<h;row+=12){rect(c,x,y+row,w,10,shade[1]);rect(c,x,y+row,w,1,shade[2]);for(let i=0;i<w;i+=38){const xx=x+i+(row%24?16:0);rect(c,xx,y+row,1,10,'#826641');rect(c,xx+5,y+row+4,14,1,'#bd9f6b');}}}
export function drawInterior(c,home){const core=home.core||{x:0,y:0,w:home.w,h:home.h};c.save();c.beginPath();for(const p of home.parts||[core])c.rect(p.x,p.y,p.w,p.h);c.clip();
 for(const r of home.annexes||[]){wood(c,r.x+12,r.y+12,r.w-24,r.h-24);rect(c,r.x,r.y,r.w,24,'#96876b');rect(c,r.x,r.y,16,r.h,'#716c55');rect(c,r.x+r.w-16,r.y,16,r.h,'#716c55');rect(c,r.x,r.y+r.h-16,r.w,16,'#716c55');c.fillStyle='#c6b592';c.font='16px Georgia';c.textAlign='center';c.fillText(r.name,r.x+r.w/2,r.y+50);}
 c.save();c.translate(core.x,core.y);c.scale(core.w/640,core.h/560);drawInteriorBase(c,{...home,core:undefined,annexes:undefined,w:640,h:560,interior:{width:640,depth:560}});c.restore();
 for(const r of home.annexes||[]){if(r.id==='wintergarden')environmentDetail(c,4,r.x+r.w-115,r.y+r.h-140,95,90);}
 for(const d of entryConnectors(home)){wood(c,d.x,d.y,d.w,d.h);if(d.axis==='x'){rect(c,d.x,d.y-4,d.w,6,'#b2a07a');rect(c,d.x,d.y+d.h-2,d.w,6,'#b2a07a');}else{rect(c,d.x-4,d.y,6,d.h,'#b2a07a');rect(c,d.x+d.w-2,d.y,6,d.h,'#b2a07a');}}
 const indices={piano:0,sofa:1};for(const f of annexFurniture(home)){if(f.kind==='bookcase'){wood(c,f.x,f.y,f.w,f.h);for(let x=f.x+5;x<f.x+f.w-8;x+=9){rect(c,x,f.y-16,7,40,['#8c6153','#697a69','#8a8194','#b09a6d'][Math.floor(x/9)%4]);rect(c,x+1,f.y-12,5,2,'#d9c9a2');rect(c,x+2,f.y+12,3,1,'#d9c9a2');}rect(c,f.x,f.y+f.h-3,f.w,4,'#b49a6b');}else if(f.kind==='desk'){wood(c,f.x,f.y,f.w,f.h-8);rect(c,f.x+8,f.y+f.h-8,5,12,'#675137');rect(c,f.x+f.w-13,f.y+f.h-8,5,12,'#675137');rect(c,f.x+24,f.y+15,58,28,'#e6d7b4');for(let j=0;j<5;j++)rect(c,f.x+30,f.y+20+j*4,43,1,'#8a7d61');ellipse(c,f.x+f.w-27,f.y+24,12,7,'#d6c29a');ellipse(c,f.x+f.w-27,f.y+22,8,4,'#655139');}else sprite(c,furnitureCells[indices[f.kind]??0],f.x,f.y,f.w,f.h);}
 c.restore();}
function drawInteriorBase(c,home){
 const w=home.interior.width,h=home.interior.depth,mid=w/2;
 rect(c,0,0,w,h,'#243c34');wood(c,16,64,w-32,h-80);
 // Wet spaces share a plumbing wall; private rooms open to the entry hall.
 for(const room of roomPlan(home).filter(r=>r.material==='tile')){rect(c,room.x,room.y,room.w,room.h,'#687e73');for(let y=room.y;y<room.y+room.h;y+=14)for(let x=room.x;x<room.x+room.w;x+=14){rect(c,x+1,y+1,12,12,(Math.floor(x/14)+Math.floor(y/14))%2?'#b4c5b3':'#8da99d');rect(c,x+2,y+2,10,1,'#d3ddc3');}}
 // Cutaway perimeter: thick walls, exterior-aligned south windows and threshold.
 rect(c,16,16,w-32,48,'#bda77f');for(let y=18;y<63;y+=7)for(let x=18;x<w-16;x+=28){rect(c,x+(y%2)*6,y,25,6,y%3?'#c0ab86':'#ddc9a2');}rect(c,16,60,w-32,5,'#685942');rect(c,16,60,w-32,1,'#efdcaa');
 for(const wall of interiorWalls(home)){const shadow=c.createLinearGradient(wall.x,wall.y,wall.x+24,wall.y+24);shadow.addColorStop(0,'#23362b80');shadow.addColorStop(1,'#23362b00');c.fillStyle=shadow;c.fillRect(wall.x+4,wall.y+8,wall.w+20,wall.h+16);rect(c,wall.x,wall.y,wall.w,wall.h,'#71674e');rect(c,wall.x,wall.y,Math.min(3,wall.w),wall.h,'#e3d3a3');rect(c,wall.x,wall.y,wall.w,3,'#eedfbc');if(wall.w>wall.h){rect(c,wall.x,wall.y+3,wall.w,wall.h-3,'#b59a72');rect(c,wall.x,wall.y+wall.h-2,wall.w,2,'#70563c');}}
 // Small, personal musical objects belong to the room, rather than a UI label.
 musicalDetail(c,2,w-91,30,36,36);rect(c,mid-28,23,56,33,'#66513b');rect(c,mid-24,27,48,25,home.color);c.fillStyle='#dbc493';c.font='22px Georgia';c.textAlign='center';c.fillText('♫',mid,49);
 for(const [gx,gy] of [[w-92,294],[w-78,100]]){const glow=c.createRadialGradient(gx,gy,4,gx,gy,65);glow.addColorStop(0,'#ffd69438');glow.addColorStop(1,'#ffd69400');c.fillStyle=glow;c.fillRect(gx-65,gy-65,130,130);}

 for(const wx of [Math.round(w*.2),Math.round(w*.8)]){rect(c,wx-29,24,58,32,'#655840');rect(c,wx-26,27,52,25,'#a0c6b4');rect(c,wx-25,28,50,3,'#dcead0');rect(c,wx-1,26,2,28,'#eedeb7');rect(c,wx-30,22,6,37,home.color);rect(c,wx+24,22,6,37,home.color);rect(c,wx-27,h-15,54,10,'#608c88');rect(c,wx-26,h-14,52,2,'#e8ddba');rect(c,wx-1,h-15,2,10,'#d1c098');}
 // Living room conversation grouping: sofa faces its coffee table, with a
 // separate instrument nook and a clear hall along the west side.
 rect(c,mid+73,382,w-mid-100,147,'#57443c');rect(c,mid+77,386,w-mid-108,139,home.color);for(let y=390;y<521;y+=5)for(let x=mid+81;x<w-35;x+=5){rect(c,x,y,2,1,'#e8d0a43d');if(x<mid+88||x>w-44||y<399||y>513)rect(c,x,y,2,2,'#e7ce8b');}
 // Entry runner keeps the circulation legible from the front door.
 rect(c,mid-31,302,62,h-320,'#684e48');rect(c,mid-27,306,54,h-328,'#b58d68');for(let y=310;y<h-28;y+=9){rect(c,mid-22,y,44,1,'#e3c293');}
 const atlasIndex={piano:0,sofa:1,bed:2,counter:3,stove:4,dining:5,toilet:6,shower:7,vanity:8};
 for(const f of interiorFurniture(home)){
  const {x,y,w:fw,h:fh}=f;ellipse(c,x+fw*.55,y+fh,fw*.52,5,'#20352c40');
  if(atlasIndex[f.kind]!==undefined){sprite(c,furnitureCells[atlasIndex[f.kind]],x,y,fw,fh);continue;}
  if(f.kind==='wardrobe'){wood(c,x,y,fw,fh);rect(c,x+4,y+4,fw/2-6,fh-8,'#ac8653');rect(c,x+fw/2+2,y+4,fw/2-6,fh-8,'#ac8653');rect(c,x+fw/2-5,y+fh/2,2,4,'#e6cd88');rect(c,x+fw/2+3,y+fh/2,2,4,'#e6cd88');}
  else if(f.kind==='fridge'){rect(c,x,y,fw,fh,'#d5d5bc');rect(c,x+3,y+3,fw-6,fh-6,'#e5e1c8');rect(c,x+4,y+24,fw-8,2,'#8b9b89');rect(c,x+fw-9,y+31,3,18,'#6f897d');rect(c,x+fw-9,y+8,3,12,'#6f897d');rect(c,x+10,y+36,12,15,'#c7aa7c');}
  else {wood(c,x,y,fw,fh-8);rect(c,x+6,y+fh-8,4,10,'#62492f');rect(c,x+fw-10,y+fh-8,4,10,'#62492f');rect(c,x+16,y+7,fw-32,14,'#eee1c0');for(let i=0;i<3;i++)rect(c,x+20,y+10+i*3,fw-40,1,'#9a8a69');ellipse(c,x+fw-13,y+11,6,4,'#e4cba0');ellipse(c,x+fw-13,y+10,4,2,'#69513a');}
 }
 // Keep the cutaway threshold legible without labels painted onto room floors.
 c.font='11px Georgia';c.textAlign='center';c.fillStyle='#6a624b';
 rect(c,mid-27,h-16,54,16,'#d2bb87');rect(c,mid-25,h-15,50,1,'#f4dfae');c.fillStyle='#d6c69b';c.font='12px Georgia';c.fillText('Outside ↓',mid,h-22);
}
