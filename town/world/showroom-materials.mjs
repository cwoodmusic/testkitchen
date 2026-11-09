// Small, repeatable pixel textures keep the eight room finishes at the same
// scale as the native furniture. They are painted once, then cached with the
// interior background; no texture work runs in the animation loop.
const textures=new Map();
const pixel=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
const hash=(x,y,seed=1)=>{let n=Math.imul(x+17,374761393)^Math.imul(y+43,668265263)^seed;n=Math.imul(n^(n>>>13),1274126177);return (n^(n>>>16))>>>0;};
function line(c,x0,y0,x1,y1,color,width=2){
 const steps=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))/2;
 for(let i=0;i<=steps;i++){const t=steps?i/steps:0;pixel(c,x0+(x1-x0)*t,y0+(y1-y0)*t,width,width,color);}
}
function speckle(c,w,h,colors,density=200){
 for(let i=0;i<density;i++){const x=hash(i,3)%w,y=hash(i,7)%h;pixel(c,x,y,i%9===0?3:1,1,colors[i%colors.length]);}
}
function plank(c,x,y,w,h,p,vertical=false,seed=0){
 const [base,light,dark]=p;
 pixel(c,x,y,w,h,dark);pixel(c,x+1,y+1,w-2,h-2,base);
 pixel(c,x+2,y+2,vertical?2:w-4,vertical?h-4:2,light);
 pixel(c,x+w-3,y+3,1,h-5,dark+'70');pixel(c,x+3,y+h-3,w-5,1,dark+'80');
 const length=vertical?h:w,breadth=vertical?w:h;
 for(let i=0;i<Math.floor(breadth/4);i++){
  const start=4+hash(i,seed)%Math.max(1,Math.floor(length*.45)),extent=Math.min(length-start-3,12+hash(i,seed+9)%Math.max(1,Math.floor(length*.65)));
  if(vertical)pixel(c,x+4+i*4,y+start,1,extent,i%3?light+'50':dark+'40');
  else pixel(c,x+start,y+4+i*4,extent,1,i%3?light+'50':dark+'40');
 }
}
function floorTile(c,pattern,p,size){
 const [base,light,dark,accent=light,grout=dark]=p;pixel(c,0,0,size,size,base);
 if(pattern==='herringbone'){
  // Four-to-one planks interlock along diagonal bands. Each band alternates
  // a complete horizontal board with a vertical one, without square panels.
  for(let y=-4;y<size/16+4;y++)for(let x=-4;x<size/16+4;x++){
   const band=((x+y)%8+8)%8;
   if(band===0)plank(c,x*16,y*16,64,16,p,false,x+y);
   else if(band===4)plank(c,x*16,y*16,16,64,p,true,x-y);
  }
 }else if(pattern==='parquet'){
  for(let y=0;y<size;y+=64)for(let x=0;x<size;x+=64){
   const vertical=(x/64+y/64)%2===0;
   for(let n=0;n<4;n++)plank(c,x+(vertical?n*16:0),y+(vertical?0:n*16),vertical?16:64,vertical?64:16,n%3?p:[accent,light,dark],vertical,x+y+n);
  }
 }else if(pattern==='whitewashed-planks'){
  for(let y=0;y<size;y+=32)for(let x=-128;x<size;x+=128)plank(c,x+(y/32%2)*64,y,128,32,(x+y)%3?p:[accent,light,dark],false,x+y);
 }else if(pattern==='diamond-marble'){
  pixel(c,0,0,size,size,dark);
  for(let y=-64;y<size;y+=64)for(let x=-64;x<size;x+=64){
   c.fillStyle=base;c.beginPath();c.moveTo(x+32,y+2);c.lineTo(x+62,y+32);c.lineTo(x+32,y+62);c.lineTo(x+2,y+32);c.closePath();c.fill();
   line(c,x+15,y+26,x+29,y+35,light,1);line(c,x+29,y+35,x+45,y+30,light,1);
   pixel(c,x+29,y+29,6,6,accent);pixel(c,x+31,y+31,2,2,light);
   pixel(c,x+62,y+30,4,4,accent);pixel(c,x+30,y+62,4,4,accent);
  }
 }else if(pattern==='terracotta'){
  pixel(c,0,0,size,size,grout);
  for(let y=0;y<size;y+=32)for(let x=-32;x<size;x+=64){
   const xx=x+(y/32%2)*32,color=hash(x,y)%3?base:accent;
   pixel(c,xx+2,y+2,60,28,dark);pixel(c,xx+3,y+3,58,25,color);pixel(c,xx+5,y+4,54,2,light+'90');
   for(let i=0;i<8;i++)pixel(c,xx+5+hash(i,x+y)%50,y+7+hash(i,y+x+9)%15,2,1,i%2?dark+'40':light+'50');
  }
 }else if(pattern==='slate-mosaic'){
  pixel(c,0,0,size,size,grout);
  for(let y=0;y<size;y+=32)for(let x=-32;x<size;x+=64){
   const xx=x+(y/32%2)*32,color=hash(x,y)%3?base:accent;
   pixel(c,xx+2,y+2,60,28,color);pixel(c,xx+4,y+3,54,2,light+'90');
   line(c,xx+8,y+22,xx+34,y+16,dark+'50',1);line(c,xx+34,y+16,xx+51,y+19,light+'60',1);
  }
 }else if(pattern==='checkerboard'){
  for(let y=0;y<size;y+=64)for(let x=0;x<size;x+=64){
   const color=(x/64+y/64)%2?dark:base;pixel(c,x,y,64,64,grout);pixel(c,x+2,y+2,60,60,color);
   pixel(c,x+4,y+4,56,2,light+'55');line(c,x+10,y+40,x+28,y+29,accent+'50',1);line(c,x+28,y+29,x+45,y+34,accent+'50',1);
  }
 }else{
  // Industrial poured concrete uses broad slabs, fine aggregate and worn seams.
  for(let y=0;y<size;y+=128)for(let x=0;x<size;x+=128){
   pixel(c,x,y,128,128,grout);pixel(c,x+2,y+2,125,125,base);pixel(c,x+3,y+3,122,1,light+'80');pixel(c,x+3,y+125,122,1,dark+'70');
   for(let i=0;i<9;i++)pixel(c,x+hash(i,4)%128,y+(i%2?1:126),3,2,accent+'70');
  }
 }
 speckle(c,size,size,[light+'30',dark+'20'],Math.floor(size*size/80));
}
function flower(c,x,y,p){
 const [,light,dark,accent=light]=p;
 line(c,x,y+10,x+2,y-8,dark,1);pixel(c,x-4,y+3,5,2,dark);pixel(c,x+2,y-2,5,2,dark);
 for(const [dx,dy]of [[-4,0],[4,0],[0,-4],[0,4]])pixel(c,x+dx-1,y+dy-9,4,4,accent);
 pixel(c,x,y-8,2,2,light);
}
function wallpaperTile(c,pattern,p,size){
 const [base,light,dark,accent=light]=p;pixel(c,0,0,size,size,base);
 if(pattern==='exposed-brick'){
  for(let y=0;y<size;y+=16)for(let x=-32;x<size;x+=48){
   const xx=x+(y/16%2)*24;pixel(c,xx+1,y+1,45,13,hash(x,y)%3?base:accent);pixel(c,xx+2,y+2,43,1,light+'90');pixel(c,xx+2,y+13,43,1,dark);
   pixel(c,xx,y,48,1,dark);pixel(c,xx,y,1,16,dark);pixel(c,xx+8,y+7,12,1,light+'50');
  }
 }else if(pattern==='coastal-stripe'){
  for(let x=0;x<size;x+=32){pixel(c,x,0,14,size,light);pixel(c,x+16,0,3,size,dark+'70');pixel(c,x+23,0,5,size,accent);}
  for(let y=0;y<size;y+=8)pixel(c,0,y,size,1,base+'40');
 }else if(pattern==='deco-fan'){
  for(let y=-16;y<size;y+=32)for(let x=-32;x<size;x+=48){
   const cx=x+(y/32%2)*24+24,cy=y+31;
   for(const radius of [12,20,28])for(let step=0;step<=32;step++){const a=Math.PI+step*Math.PI/32;pixel(c,cx+Math.cos(a)*radius,cy+Math.sin(a)*radius,1,2,accent);}
   for(const dx of [-19,0,19])line(c,cx,cy,cx+dx,cy-22,light+'80',1);
   pixel(c,cx-1,cy-2,3,3,light);
  }
 }else if(pattern==='damask'){
  for(let y=-16;y<size;y+=48)for(let x=-24;x<size;x+=48){
   const cx=x+24+(y/48%2)*24,cy=y+24;
   line(c,cx,cy-20,cx,cy+20,accent,1);
   for(const side of [-1,1]){
    for(let k=0;k<3;k++){const yy=cy-13+k*10;line(c,cx,yy+7,cx+side*10,yy-2,accent,2);pixel(c,cx+side*10-2,yy-4,5,5,light+'90');}
    line(c,cx,cy+12,cx+side*14,cy+2,accent,1);pixel(c,cx+side*14-2,cy,4,4,accent);
   }
   pixel(c,cx-2,cy-23,5,5,light);
  }
 }else if(pattern==='botanical-leaf'){
  for(let y=-16;y<size;y+=48)for(let x=-16;x<size;x+=32){
   line(c,x+8,y+42,x+22,y,accent,1);
   for(let k=0;k<4;k++){const yy=y+k*10,xx=x+22-k*3;line(c,xx,yy+5,xx-10,yy-1,light,3);line(c,xx,yy+8,xx+9,yy+1,dark,3);}
   pixel(c,x+21,y,3,3,accent);
  }
 }else if(pattern==='geometric'){
  for(let y=-16;y<size;y+=32)for(let x=-16;x<size;x+=32){
   line(c,x+16,y+2,x+29,y+16,accent,2);line(c,x+29,y+16,x+16,y+30,accent,2);line(c,x+16,y+30,x+3,y+16,light,2);line(c,x+3,y+16,x+16,y+2,light,2);
   pixel(c,x+13,y+13,6,6,dark);pixel(c,x+15,y+15,2,2,accent);
  }
 }else if(pattern==='cafe-lattice'){
  for(let y=-32;y<size;y+=32)for(let x=-32;x<size;x+=32){
   line(c,x,y,x+32,y+32,accent+'A0',1);line(c,x+32,y,x,y+32,accent+'A0',1);pixel(c,x+14,y+14,5,5,dark);pixel(c,x+15,y+15,3,3,light);
  }
 }else{
  // Small blue toile sprigs on warm plaster.
  for(let y=-16;y<size;y+=48)for(let x=-16;x<size;x+=48)flower(c,x+22+(y/48%2)*16,y+24,p);
 }
 speckle(c,size,size,[light+'20',dark+'18'],Math.floor(size*size/160));
}
function texture(finish,kind){
 const colors=finish.colors||['#a58b68','#dac49b','#6b5848','#bfa278','#554d44'];
 const key=kind+'|'+finish.pattern+'|'+colors.join('|');
 if(textures.has(key))return textures.get(key);
 const cv=document.createElement('canvas');cv.width=cv.height=kind==='floor'?256:96;
 const c=cv.getContext('2d');c.imageSmoothingEnabled=false;
 (kind==='floor'?floorTile:wallpaperTile)(c,finish.pattern,colors,cv.width);textures.set(key,cv);return cv;
}
export function drawShowroomFloor(c,room){
 const finish=room.floorFinish||room.floor;if(!finish)return;
 c.save();c.beginPath();c.rect(room.x,room.y,room.w,room.h);c.clip();c.translate(room.x,room.y);c.fillStyle=c.createPattern(texture(finish,'floor'),'repeat');c.fillRect(0,0,room.w,room.h);
 const edge=finish.colors?.[2]||'#493b36';pixel(c,0,0,room.w,3,edge);pixel(c,0,0,3,room.h,edge);pixel(c,room.w-3,0,3,room.h,edge);pixel(c,0,room.h-3,room.w,3,edge);c.restore();
}
export function drawShowroomWallpaper(c,room){
 const finish=room.wallpaper;if(!finish)return;
 const [base,light,dark,accent=light]=finish.colors||['#526d63','#c8aa77','#3e534b','#bba075'];
 for(const area of room.wallpaperAreas||[]){
  c.save();c.beginPath();c.rect(area.x,area.y,area.w,area.h);c.clip();c.translate(room.x,room.y);c.fillStyle=c.createPattern(texture(finish,'wallpaper'),'repeat');c.fillRect(area.x-room.x,area.y-room.y,area.w,area.h);c.restore();
  pixel(c,area.x,area.y,area.w,3,dark);pixel(c,area.x+2,area.y+3,area.w-4,3,light);pixel(c,area.x+3,area.y+6,area.w-6,2,accent);
  const baseY=area.y+area.h-22;pixel(c,area.x,baseY,area.w,22,dark);pixel(c,area.x+3,baseY+3,area.w-6,15,base);
  for(let x=area.x+12;x<area.x+area.w-14;x+=48){pixel(c,x,baseY+5,1,11,light+'90');pixel(c,x+3,baseY+5,32,1,accent+'70');}
  pixel(c,area.x,baseY-3,area.w,3,accent);pixel(c,area.x,area.y+area.h-3,area.w,3,dark);pixel(c,area.x+2,area.y+area.h-4,area.w-4,1,light);
 }
}
