import {HOME,roomPlan,interiorWalls,interiorFurniture} from './model.mjs';
export const noise=(x,y,s=0)=>{const n=Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453;return n-Math.floor(n);};
export function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
export function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
const load=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Town artwork failed to load: '+src));i.src=new URL(src,import.meta.url);});
// Discover the opaque bounds in each equal atlas cell. This keeps the south
// threshold aligned to the real door rather than to transparent image margins.
function cells(image,columns=3,rows=2){const result=[];for(let i=0;i<columns*rows;i++){const ox=Math.floor(i%columns*image.width/columns),oy=Math.floor(Math.floor(i/columns)*image.height/rows),cw=Math.floor((i%columns+1)*image.width/columns)-ox,ch=Math.floor((Math.floor(i/columns)+1)*image.height/rows)-oy,c=document.createElement('canvas');c.width=cw;c.height=ch;const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(image,ox,oy,cw,ch,0,0,cw,ch);const pixels=cx.getImageData(0,0,cw,ch).data;let left=cw,top=ch,right=0,bottom=0;for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(pixels[(y*cw+x)*4+3]>40){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}result.push({image,sx:ox+left,sy:oy+top,sw:right-left+1,sh:bottom-top+1});}return result;}
const [houses,foliage,props,furniture,ground]=await Promise.all([load('assets/houses.png'),load('assets/foliage.png'),load('assets/props.png'),load('assets/furniture.png'),load('assets/ground.png')]);
const houseCells=cells(houses),treeCells=cells(foliage),propCells=cells(props),furnitureCells=cells(furniture,3,3);
export const materials=Array.from({length:4},(_,i)=>{const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.drawImage(ground,i%2*ground.width/2,Math.floor(i/2)*ground.height/2,ground.width/2,ground.height/2,0,0,512,512);return c;});
function sprite(c,cell,x,y,w,h){c.drawImage(cell.image,cell.sx,cell.sy,cell.sw,cell.sh,x,y,w,h);}
export function house(c,h){ellipse(c,h.x+h.w*.55,h.y+h.h-5,h.w*.57,35,'#102f2970');if(h.kind==='bandstand'){sprite(c,propCells[4],h.x,h.y-120,h.w,h.h+120);return;}sprite(c,houseCells[h.kind==='glasshouse'?3:h.style??0],h.x,h.y-100,h.w,h.h+100);}
export function fountain(c,x,y){sprite(c,propCells[0],x-95,y-165,190,200);}
export function planter(c,x,y,w=110){const cell=propCells[3];sprite(c,cell,x-w/2,y-w*cell.sh/cell.sw,w,w*cell.sh/cell.sw);}
export function tree(c,x,y,size=1,type=0){const cell=treeCells[type%6],w=(type===5?180:230)*size,h=w*cell.sh/cell.sw;ellipse(c,x+10,y,w*.38,13*size,'#11352c45');sprite(c,cell,x-w/2,y-h,w,h);}
export function flower(c,x,y,color){rect(c,x,y,1,9,'#2a623c');rect(c,x-2,y-3,5,4,'#284e3b');rect(c,x-1,y-4,4,4,color);rect(c,x,y-3,1,1,'#ffe3a4');rect(c,x-3,y+3,3,2,'#528e48');}
export function fence(c,x,y,w){for(let dx=0;dx<w;dx+=28){rect(c,x+dx+2,y-28,7,34,'#3b4131');rect(c,x+dx,y-29,6,31,'#af996d');rect(c,x+dx+1,y-28,2,30,'#e0cc94');rect(c,x+dx-1,y-31,8,3,'#c8b17a');}for(const dy of [-19,-5]){rect(c,x,y+dy,w,5,'#756a4d');rect(c,x,y+dy,w,1,'#c2b382');}}
export function bench(c,x,y){const cell=propCells[1];sprite(c,cell,x,y-45,110,75);}
export function lamp(c,x,y){const cell=propCells[2];sprite(c,cell,x-24,y-155,48,160);}
const shade=['#755739','#b39463','#d2b17a','#edcf91'];
function wood(c,x,y,w,h){rect(c,x,y,w,h,shade[0]);for(let row=0;row<h;row+=12){rect(c,x,y+row,w,10,shade[1]);rect(c,x,y+row,w,1,shade[2]);for(let i=0;i<w;i+=38){const xx=x+i+(row%24?16:0);rect(c,xx,y+row,1,10,'#826641');rect(c,xx+5,y+row+4,14,1,'#bd9f6b');}}}
export function drawInterior(c,home){
 const w=home.interior.width,h=home.interior.depth,mid=w/2;
 rect(c,0,0,w,h,'#243c34');wood(c,16,64,w-32,h-80);
 // Wet spaces share a plumbing wall; private rooms open to the entry hall.
 for(const room of roomPlan(home).filter(r=>r.material==='tile')){rect(c,room.x,room.y,room.w,room.h,'#687e73');for(let y=room.y;y<room.y+room.h;y+=14)for(let x=room.x;x<room.x+room.w;x+=14){rect(c,x+1,y+1,12,12,(Math.floor(x/14)+Math.floor(y/14))%2?'#b4c5b3':'#8da99d');rect(c,x+2,y+2,10,1,'#d3ddc3');}}
 // Cutaway perimeter: thick walls, exterior-aligned south windows and threshold.
 rect(c,16,16,w-32,48,'#bda77f');for(let y=18;y<63;y+=7)for(let x=18;x<w-16;x+=28){rect(c,x+(y%2)*6,y,25,6,y%3?'#c0ab86':'#ddc9a2');}rect(c,16,60,w-32,5,'#685942');rect(c,16,60,w-32,1,'#efdcaa');
 for(const wall of interiorWalls(home)){rect(c,wall.x-2,wall.y+6,wall.w+4,wall.h,'#24392e55');rect(c,wall.x,wall.y,wall.w,wall.h,'#8b8264');rect(c,wall.x,wall.y,Math.min(3,wall.w),wall.h,'#e3d3a3');rect(c,wall.x,wall.y,wall.w,3,'#eedfbc');}
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
 // Room names sit on the cutaway edge, not over the furniture or walk routes.
 c.font='11px Georgia';c.textAlign='center';c.fillStyle='#6a624b';c.fillText('BATH',mid/2,259);c.fillText('BEDROOM',mid+mid/2,259);
 rect(c,mid-27,h-16,54,16,'#d2bb87');rect(c,mid-25,h-15,50,1,'#f4dfae');c.fillStyle='#d6c69b';c.font='12px Georgia';c.fillText('Outside ↓',mid,h-22);
}
