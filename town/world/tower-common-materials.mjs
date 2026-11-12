// The shared tower architecture supplies the north wall plane and core
// recesses. These surfaces paint that geometry without adding scene objects.
const palettes=[
 {paper:'#c9c3ae',panel:'#3d5d59',runner:'#3f6261',wood:'#634b38'},
 {paper:'#c7c8b4',panel:'#52614d',runner:'#4b5d4e',wood:'#66513d'},
 {paper:'#cdc0b0',panel:'#665052',runner:'#62454e',wood:'#654b3d'},
 {paper:'#c1c6c3',panel:'#45586b',runner:'#43576c',wood:'#5e4a3c'}
];
const brass='#ad8952',brassLight='#d1b77a',walnut='#49392f',tiles=new Map(),MAX_TILES=20;
const authoredFrames=[
 [0,0,444,444],[444,0,443,444],[887,0,443,444],[1330,0,444,444],
 [0,444,444,443],[444,444,443,443],[887,444,443,443],[1330,444,444,443]
];
let authoredImage=null,authoredPromise=null;
export const towerCommonMaterialsReady=()=>Boolean(authoredImage);
export function getTowerCommonMaterialStats(){return {ready:Boolean(authoredImage),tiles:tiles.size,pixels:[...tiles.values()].reduce((n,t)=>n+t.width*t.height,0),maxTiles:MAX_TILES,sourcePixels:authoredImage?authoredImage.width*authoredImage.height:0};}
export function warmTowerCommonMaterials(){
 if(authoredPromise)return authoredPromise;
 const url=new URL('../assets/interiors/tower-common-materials-6e814586f781.webp',import.meta.url);
 authoredPromise=fetch(url).then(response=>{if(!response.ok)throw Error('Tower material artwork could not load.');return response.blob();}).then(async blob=>{
  if(typeof createImageBitmap==='function')return createImageBitmap(blob);
  const objectURL=URL.createObjectURL(blob);
  try{return await new Promise((resolve,reject)=>{const image=new Image();image.onload=async()=>{try{if(image.decode)await image.decode();resolve(image);}catch(error){reject(error);}};image.onerror=()=>reject(Error('Tower material artwork could not decode.'));image.src=objectURL;});}
  finally{URL.revokeObjectURL(objectURL);}
 }).then(image=>{authoredImage=image;for(const t of tiles.values())t.width=t.height=1;tiles.clear();});
 return authoredPromise;
}
const rect=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
const rgb=hex=>[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16));
function noise(c,w,h,color,seed,spread=5){
 const base=rgb(color),image=c.createImageData(w,h);let state=seed;
 for(let i=0;i<image.data.length;i+=4){state=(Math.imul(state,1664525)+1013904223)|0;const d=((state>>>25)-64)*spread/64;for(let k=0;k<3;k++)image.data[i+k]=Math.max(0,Math.min(255,base[k]+d));image.data[i+3]=255;}
 c.putImageData(image,0,0);
}
function tile(c,key,w,h,paint){
 let image=tiles.get(key);
 if(!image){image=(c.canvas.ownerDocument||document).createElement('canvas');image.width=w;image.height=h;paint(image.getContext('2d'));tiles.set(key,image);while(tiles.size>MAX_TILES){const first=tiles.keys().next().value,old=tiles.get(first);tiles.delete(first);old.width=old.height=1;}}
 else {tiles.delete(key);tiles.set(key,image);}
 return c.createPattern(image,'repeat');
}
function pattern(c,key,x,y,w,h,tw,th,paint){c.fillStyle=tile(c,key,tw,th,paint);c.fillRect(x,y,w,h);}
function colorize(c,x,y,w,h,color){if(!color)return;c.save();c.globalCompositeOperation='color';rect(c,x,y,w,h,color);c.restore();}
function donor(c,index,x,y,w,h,tw=384,th=tw,color){
 if(!authoredImage)return false;
 pattern(c,'authored-'+index+'-'+tw+'-'+th,x,y,w,h,tw,th,t=>{
  const [sx,sy,sw,sh]=authoredFrames[index],hw=tw/2,hh=th/2;t.imageSmoothingEnabled=false;
  // Mirrored quadrants keep the mineral/wood/thread field seamless without
  // growing or stretching a swatch across the entire room.
  for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++){t.save();t.translate(xx?tw:0,yy?th:0);t.scale(xx?-1:1,yy?-1:1);t.drawImage(authoredImage,sx+2,sy+2,sw-4,sh-4,0,0,hw,hh);t.restore();}
 });colorize(c,x,y,w,h,color);return true;
}
function molding(c,x,y,w,h){
 if(!authoredImage)return;
 c.save();c.translate(x,y);pattern(c,'authored-molding-'+h,0,0,w,h,288,h,t=>{t.imageSmoothingEnabled=false;t.drawImage(authoredImage,1332,485,440,30,0,0,288,h);});c.restore();
}
function stone(c,x,y,w,h,dark=false){
 if(donor(c,dark?1:0,x,y,w,h,384,384,dark?undefined:'#b7b09e'))return;
 pattern(c,'stone-'+dark,x,y,w,h,256,256,t=>{
  noise(t,256,256,dark?'#53615a':'#b7b09e',71,5);
  for(let yy=0;yy<256;yy+=64)for(let xx=0;xx<256;xx+=64){
   const n=(xx/64*7+yy/64*11)%5;
   rect(t,xx+1,yy+1,62,62,['#f2eadb08','#ffffff0a','#6e66500b','#b8b9a40a','#ffffff03'][n]);
   rect(t,xx,yy,64,1,dark?'#25382e':'#827d6b');rect(t,xx,yy,1,64,dark?'#25382e':'#827d6b');
   rect(t,xx+1,yy+1,62,1,dark?'#91a18b55':'#ede6ce88');rect(t,xx+1,yy+1,1,62,'#ffffff17');
   for(let i=0;i<3;i++){const vx=xx+8+(i*17+n*3)%46,vy=yy+7+(i*19+n*7)%47;rect(t,vx,vy,12+n*3,1,dark?'#c7ccb51c':'#6469541a');rect(t,vx+7,vy+1,5+n,1,'#d6d3bb17');}
  }
 });
}
function oak(c,x,y,w,h,color){
 if(donor(c,color==='#80674b'?3:2,x,y,w,h,384,384,color))return;
 pattern(c,'oak-'+color,x,y,w,h,288,144,t=>{
  noise(t,288,144,color,109,5);
  for(let yy=0,row=0;yy<144;yy+=18,row++)for(let xx=-72*(row%2),col=0;xx<288;xx+=144,col++){
   rect(t,xx,yy,144,1,'#342b2580');rect(t,xx,yy,1,18,'#342b2570');rect(t,xx+2,yy+1,141,1,'#d8be8b5c');
   rect(t,xx+2,yy+3,139,12,(row+col)%3?'#e5ce9b05':'#2e302418');
   for(let k=0;k<4;k++){const gx=xx+8+(row*23+k*19)%94,gy=yy+4+(row*3+k*7)%10;rect(t,gx,gy,20+(k*13+row*7)%38,1,k%2?'#2a282225':'#e7d0a41c');}
   if((row+col)%4===0){rect(t,xx+93,yy+8,5,2,'#302b2536');rect(t,xx+88,yy+7,15,1,'#c8a36b20');}
  }
 });
}
function frame(c,r,dark=walnut,light=brassLight){
 rect(c,r.x,r.y,r.w,2,dark);rect(c,r.x,r.y+r.h-2,r.w,2,dark);rect(c,r.x,r.y,2,r.h,dark);rect(c,r.x+r.w-2,r.y,2,r.h,dark);
 rect(c,r.x+3,r.y+3,r.w-6,1,light);rect(c,r.x+3,r.y+r.h-4,r.w-6,1,light);rect(c,r.x+3,r.y+3,1,r.h-6,light);rect(c,r.x+r.w-4,r.y+3,1,r.h-6,light);
}
function carpet(c,r,color,grand=false){
 rect(c,r.x-2,r.y+5,r.w+8,r.h+5,'#19242135');rect(c,r.x,r.y,r.w,r.h,'#3b302b');rect(c,r.x+2,r.y+2,r.w-4,r.h-4,brass);
 if(!donor(c,4,r.x+6,r.y+6,r.w-12,r.h-12,384,384,color))pattern(c,'weave-'+color,r.x+6,r.y+6,r.w-12,r.h-12,64,64,t=>{
  noise(t,64,64,color,37,4);
  for(let y=0;y<64;y+=3){rect(t,0,y,64,1,'#e9dfb409');for(let x=y%2;x<64;x+=4)rect(t,x,y,1,1,'#111e251b');}
 });
 frame(c,{x:r.x+9,y:r.y+9,w:r.w-18,h:r.h-18},'#d2b57888','#172b2d66');
 const horizontal=r.w>r.h,step=horizontal?44:56;
 if(horizontal){for(let x=r.x+24;x<r.x+r.w-20;x+=step){rect(c,x,r.y+16,12,2,'#cbb98766');rect(c,x,r.y+r.h-18,12,2,'#cbb98766');}}
 else for(let y=r.y+24;y<r.y+r.h-20;y+=step){rect(c,r.x+16,y,2,12,'#cbb98766');rect(c,r.x+r.w-18,y,2,12,'#cbb98766');}
 if(grand){
  const x=r.x+r.w/2,y=r.y+r.h*.55;
  c.save();c.strokeStyle='#d3bd825c';c.lineWidth=2;
  for(const radius of [74,83]){c.beginPath();c.ellipse(x,y,radius,radius*1.2,0,0,Math.PI*2);c.stroke();}
  for(let i=-2;i<=2;i++)rect(c,x-42,y+i*11,84,1,'#cbb98749');
  // A small lyre woven into the runner keeps the musical theme in the fabric.
  c.beginPath();c.moveTo(x-23,y-30);c.bezierCurveTo(x-38,y+8,x-20,y+33,x,y+33);c.bezierCurveTo(x+20,y+33,x+38,y+8,x+23,y-30);c.stroke();
  rect(c,x-25,y-30,50,3,'#cfb77e70');for(let dx=-12;dx<=12;dx+=8)rect(c,x+dx,y-27,1,52,'#cfb77e70');rect(c,x-21,y+34,42,3,'#cfb77e70');c.restore();
 }
}
function shadow(c,x,y,w,h,alpha=.18){const g=c.createLinearGradient(0,y,0,y+h);g.addColorStop(0,`rgba(18,29,29,${alpha})`);g.addColorStop(1,'rgba(18,29,29,0)');c.fillStyle=g;c.fillRect(x,y,w,h);}
function threshold(c,x,y,w){
 stone(c,x-w/2,y,w,24);frame(c,{x:x-w/2,y,w,h:24},'#4d5044','#cfbf9580');
 rect(c,x-w/2+8,y+6,w-16,2,'#ede4cc88');rect(c,x-w/2+8,y+20,w-16,2,'#3b423a55');shadow(c,x-w/2,y-1,w,7,.28);
}
function walls(c,s,p){
 const floorY=s.towerArchitecture?.northWallDepth||106,panelY=floorY-42;
 if(!donor(c,5,0,0,s.width,floorY,256,256,p.paper))pattern(c,'plaster-'+p.paper,0,0,s.width,floorY,96,96,t=>{noise(t,96,96,p.paper,41,3);for(let x=9;x<96;x+=24){rect(t,x,0,1,96,'#685b4310');rect(t,x+2,0,1,96,'#fff0d40c');}});
 rect(c,0,0,s.width,5,'#302d27');rect(c,0,5,s.width,4,brass);rect(c,0,9,s.width,2,'#efe0bc');rect(c,0,11,s.width,5,'#76664d4d');
 rect(c,0,panelY,s.width,39,walnut);rect(c,0,panelY,s.width,3,'#392f2b');rect(c,0,panelY+3,s.width,2,brassLight);rect(c,0,panelY+5,s.width,3,'#1c302d70');
 for(let x=32;x<s.width-24;x+=80){rect(c,x,panelY+10,70,22,'#253b36');rect(c,x+2,panelY+12,66,18,p.panel);rect(c,x+3,panelY+12,64,1,'#e8d7b240');rect(c,x+3,panelY+13,1,16,'#e8d7b229');rect(c,x+4,panelY+29,63,2,'#10272255');}
 if(authoredImage){c.save();c.translate(0,panelY+6);pattern(c,'authored-wainscot',0,0,s.width,32,288,36,t=>{t.imageSmoothingEnabled=false;t.drawImage(authoredImage,888,508,441,55,0,0,288,36);});colorize(c,0,0,s.width,32,p.panel);c.restore();molding(c,0,0,s.width,16);}
 rect(c,0,floorY-6,s.width,6,'#302b26');rect(c,0,floorY-7,s.width,2,brass);shadow(c,28,floorY,s.width-56,23,.24);
 for(const x of [0,s.width-28]){rect(c,x,0,28,s.height,'#342e29');rect(c,x+3,9,21,s.height-12,p.panel);rect(c,x+4,10,2,s.height-15,brass);rect(c,x+21,10,3,s.height-15,'#1e312d88');rect(c,x+8,13,10,s.height-20,'#b5a57413');}
 const y=s.height-28;rect(c,0,y,s.width,28,'#352e28');rect(c,3,y+2,s.width-6,3,brassLight);rect(c,3,y+5,s.width-6,17,p.panel);rect(c,3,y+20,s.width-6,3,'#1b2d28');rect(c,3,y+24,s.width-6,2,brass);
 const lamps=s.kind==='lobby'?[150,950,1354,2154]:[160,650,1654,2144];
 for(const x of lamps){
  const g=c.createRadialGradient(x,76,2,x,100,104);g.addColorStop(0,'#ffe2a937');g.addColorStop(.4,'#ffe2a916');g.addColorStop(1,'#ffe2a900');c.fillStyle=g;c.fillRect(x-104,0,208,204);
  rect(c,x-12,35,24,34,'#342e2866');rect(c,x-9,32,18,33,walnut);rect(c,x-7,33,14,29,brass);rect(c,x-5,36,10,21,'#f1d8a0');rect(c,x-2,36,3,21,'#fff0c7');rect(c,x-8,32,16,3,brassLight);rect(c,x-8,60,16,4,brass);rect(c,x-3,65,6,6,walnut);
 }
}
export function drawTowerCommonSurfaces(c,s){
 if(s.kind!=='hall'&&s.kind!=='lobby')return false;
 const grand=s.kind==='lobby',p=palettes[grand?0:Math.min(3,Math.floor((s.floor-2)/4))];c.save();
 if(grand){
  stone(c,0,0,s.width,s.height);
  for(const r of s.rooms){oak(c,r.x,r.y,r.w,r.h,'#80674b');frame(c,r,'#434b3b','#c8b78488');}
  for(const x of [52,s.width-64]){stone(c,x,106,12,s.height-160,true);rect(c,x+3,107,1,s.height-162,'#d8c39366');}
  frame(c,{x:50,y:130,w:s.width-100,h:s.height-180},'#596150','#d1be9277');
  for(const w of s.windows){const light=c.createLinearGradient(0,106,0,490);light.addColorStop(0,'#f0e9c62b');light.addColorStop(1,'#e2e8df00');c.fillStyle=light;c.fillRect(w.x-w.w/2-16,106,w.w+32,384);}
 }else{
  oak(c,0,0,s.width,s.height,p.wood);
  frame(c,{x:48,y:126,w:s.width-96,h:s.height-174},'#302f28','#b8a67d88');
  const coreLeft=s.stairs?.length===2?s.stairs[0].x-20:s.elevator.x-22,coreRight=s.stairs.at(-1).x+s.stairs.at(-1).w+20;
  stone(c,coreLeft,106,coreRight-coreLeft,216);frame(c,{x:coreLeft,y:106,w:coreRight-coreLeft,h:216},'#5a5a49','#d7c99a99');
 }
 for(const [i,r] of s.rugs.entries())carpet(c,r,grand?['#466465','#654a53','#52634e'][i]:p.runner,grand&&i===0);
 walls(c,s,p);
 // Core entrances can sit behind the main wall line. Their short stone
 // landings return to that line without painting wallpaper onto walkable floor.
 for(const r of s.towerArchitecture?.facadeRecesses||[]){stone(c,r.x,r.y,r.w,r.h);rect(c,r.x-2,r.y,2,r.h,walnut);rect(c,r.x+r.w,r.y,2,r.h,walnut);}
 for(const d of s.doors||[])threshold(c,d.x,d.y+d.h+3,d.w+28);
 if(s.elevator)threshold(c,s.elevator.x+s.elevator.w/2,s.elevator.y+s.elevator.h+4,s.elevator.w+26);
 for(const st of s.stairs||[])threshold(c,st.x+st.w/2,st.y+st.h+6,st.w+20);
 if(grand){threshold(c,s.width/2,s.height-58,356);rect(c,s.width/2-172,s.height-104,344,2,'#53625555');}
 c.restore();return true;
}
export function drawTowerCommonStairs(c,st,s){
 if(s.kind!=='hall'&&s.kind!=='lobby')return false;
 c.save();rect(c,st.x-8,st.y-7,st.w+16,st.h+18,'#302e28');
 for(let i=0;i<8;i++){
  const y=st.y+i*st.h/8,h=st.h/8;
  c.save();c.beginPath();c.rect(st.x,y,st.w,h);c.clip();stone(c,st.x,y,st.w,h);c.restore();
  rect(c,st.x,y,st.w,h,['#fff0d310','#272d291c','#fff0d306','#272d2923'][st.up?i%4:(7-i)%4]);
  rect(c,st.x+2,y+1,st.w-4,2,'#e6dbc080');rect(c,st.x+2,y+h-4,st.w-4,4,'#40483ec0');rect(c,st.x+3,y+h-5,st.w-6,1,'#847d6555');
  const joint=st.x+st.w*(i%2?.35:.65);rect(c,joint,y+3,1,Math.max(2,h-8),'#6a705749');
 }
 for(const x of [st.x-8,st.x+st.w+1]){
  rect(c,x,st.y-8,7,st.h+24,'#343a32');rect(c,x+1,st.y-7,4,st.h+22,brass);rect(c,x+2,st.y-6,1,st.h+20,'#ead29a');
  for(const y of [st.y-7,st.y+st.h/2,st.y+st.h+9]){rect(c,x-1,y,9,5,walnut);rect(c,x,y,7,2,brassLight);rect(c,x+3,y+2,1,1,'#f1deaa');}
 }
 shadow(c,st.x-6,st.y+st.h+10,st.w+12,12,.16);c.restore();return true;
}
