import {W,H,SCALE,paths,residents,landmarks,bridges,water,riverX,solid} from './model.mjs';
import {noise as rand,rect,ellipse,flower,fence,house,tree,bench,lamp,materials,fountain,planter} from './art.mjs';
const TILE=8,COLS=W/TILE,ROWS=H/TILE;
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
// Catmull–Rom samples give the lanes continuous bends rather than straight
// connector strokes. Both surfaces and verge planting use this same raster.
export function curve(points){const out=[];for(let i=0;i<points.length-1;i++){const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)],steps=Math.max(1,Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/12));for(let j=0;j<=steps;j++){const t=j/steps,t2=t*t,t3=t2*t;out.push([0,1].map(k=>.5*(2*p1[k]+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3)));}}return out;}
function closest(point,samples){let target=samples[0],distance=Infinity;for(const q of samples){const d=Math.hypot(point[0]-q[0],point[1]-q[1]);if(d<distance){target=q;distance=d;}}return target;}
export function bakeTerrain(){const terrain=canvas(W,H),g=terrain.getContext('2d'),trees=[],road=new Uint8Array(COLS*ROWS);
 g.fillStyle=g.createPattern(materials[0],'repeat');g.fillRect(0,0,W,H);g.fillStyle='#20352a14';g.fillRect(0,0,W,H);
 // Broad irregular patches add soil, moss and sunlit grass at landscape scale.
 for(let i=0;i<2200;i++){const x=rand(i,6)*W,y=rand(i,7)*H;ellipse(g,x,y,20+rand(i,8)*100,12+rand(i,9)*65,i%2?'#8f9f4b0b':'#1648330d');}
 const publicCurves=paths.map(curve),publicPoints=publicCurves.flat();
 function stamp(samples,width,material=1){for(const [x,y] of samples){const radius=width*(.88+.1*Math.sin(x/130)+.07*Math.sin(y/93)),left=Math.max(0,Math.floor((x-radius)/TILE)),right=Math.min(COLS-1,Math.ceil((x+radius)/TILE)),top=Math.max(0,Math.floor((y-radius)/TILE)),bottom=Math.min(ROWS-1,Math.ceil((y+radius)/TILE));for(let yy=top;yy<=bottom;yy++)for(let xx=left;xx<=right;xx++){const px=xx*TILE+4,py=yy*TILE+4,edge=radius+Math.sin(xx*1.3+yy*.7)*3;if(Math.hypot(px-x,py-y)<edge&&!water(px,py))road[yy*COLS+xx]=Math.max(road[yy*COLS+xx],material);}}}
 for(const lane of publicCurves)stamp(lane,56);
 for(const h of [...residents,...landmarks.filter(l=>l.kind==='player')]){const start=[h.door.x,h.door.y+25],target=closest(start,publicPoints);const direction=Math.sign(target[0]-start[0])||1;stamp(curve([start,[start[0],start[1]+75],[start[0]+direction*65,(start[1]+target[1])/2+35],target]),29,2);}
 // A civic square follows the river bank rather than drawing a rectangle over it.
 for(let yy=493;yy<533;yy++)for(let xx=455;xx<600;xx++){const x=xx*TILE,y=yy*TILE;if(!water(x,y))road[yy*COLS+xx]=3;}
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const index=y*COLS+x,mat=road[index];if(!mat)continue;const px=x*TILE,py=y*TILE,r=rand(x,y),edge=!road[index-1]||!road[index+1]||!road[index-COLS]||!road[index+COLS];
 const surface=materials[mat===1?2:1];g.drawImage(surface,px%512,py%512,8,8,px,py,8,8);
 if(edge){for(let j=0;j<4;j++){const xx=px+Math.floor(rand(j,x+y)*8),yy=py+Math.floor(rand(j,y+x)*8);rect(g,xx,yy,1,3,'#477c35');rect(g,xx+1,yy+1,1,2,'#7e9e46');}if(r>.5)rect(g,px,py,2+Math.floor(r*3),3,'#3c6c36');}}
 // Water uses fine caustics and a broken moss-and-pebble bank, with no grid gaps.
 for(let y=0;y<H;y+=8)for(let x=0;x<W;x+=8){const wet=water(x+4,y+4);if(wet){const edge=[[12,0],[-12,0],[0,12],[0,-12]].some(([dx,dy])=>!water(x+dx,y+dy));g.drawImage(materials[3],x%512,y%512,8,8,x,y,8,8);if(edge)rect(g,x,y,8,2,'#b6c99188');}else if([[12,0],[-12,0],[0,12],[0,-12]].some(([dx,dy])=>water(x+dx,y+dy))){rect(g,x,y,8,8,'#718561');for(let j=0;j<3;j++){rect(g,x+rand(x,j)*6,y+rand(y,j)*6,2,2,['#a0ac86','#536f51','#bdc19a'][j]);}}}
 for(const b of bridges){const x=b.x-330,y=b.y-82;rect(g,x-5,y,670,164,'#3a4d3d');for(let dx=0;dx<660;dx+=13){rect(g,x+dx,y+4,11,156,['#9a8159','#ac9369','#bba177'][Math.floor(rand(dx,y)*3)]);rect(g,x+dx+1,y+4,1,156,'#d5bc86');for(let k=0;k<5;k++)rect(g,x+dx+3,y+15+k*27,1,11,'#806d4b');}for(const dy of [0,163]){rect(g,x-10,y+dy-10,680,9,'#566147');rect(g,x-10,y+dy-10,680,2,'#b9ac79');for(let dx=0;dx<=660;dx+=65){rect(g,x+dx,y+dy-29,9,43,'#5d6248');rect(g,x+dx,y+dy-29,3,43,'#b3a172');rect(g,x+dx-3,y+dy-32,15,5,'#d0bb83');}}}
 for(let y=6370;y<6840;y+=12){rect(g,5740,y,520,10,'#a88f62');rect(g,5740,y,520,1,'#d3bc88');for(let x=5743;x<6260;x+=80)rect(g,x,y+2,1,5,'#695e45');}
 // Dense leaf litter and wildflower banks follow real landscape pockets.
 for(let i=0;i<4800;i++){const x=rand(i,60)*W,y=rand(i,61)*H,index=Math.floor(y/TILE)*COLS+Math.floor(x/TILE);if(road[index]||water(x,y)||solid(x,y))continue;if(i%3===0)flower(g,x,y,['#f0cc79','#d4a7d1','#f2dfbe','#9fbedd'][i%4]);else{rect(g,x,y,1,6,'#759b53');rect(g,x-2,y+2,1,4,'#486f40');rect(g,x+2,y+3,1,3,'#9baa59');}}
 for(const h of residents){fence(g,h.x-36,h.y+h.h+145,h.w*.35);fence(g,h.x+h.w*.65,h.y+h.h+145,h.w*.43);for(let row=0;row<4;row++){rect(g,h.x-84,h.y+150+row*30,62,24,'#4a4835');for(let i=0;i<10;i++)flower(g,h.x-79+i*6,h.y+156+row*30,['#d69db9','#afc584','#d8c285','#b5b0d9'][row]);}trees.push({x:h.x+h.w+85,y:h.y+h.h-10,size:.55,type:5});if(h.style%2===0)bench(g,h.x-132,h.y+h.h+56);lamp(g,h.x+h.w+40,h.y+h.h+75);}
 const vacant=(x,y,margin=95)=>!water(x,y)&&!road[Math.floor(y/TILE)*COLS+Math.floor(x/TILE)]&&!residents.some(h=>x>h.x-margin&&x<h.x+h.w+margin&&y>h.y-150&&y<h.y+h.h+190)&&!landmarks.some(h=>h.w&&x>h.x-margin&&x<h.x+h.w+margin&&y>h.y-100&&y<h.y+h.h+130);
 for(let i=0;i<1500;i++){const x=130+rand(i,3)*(W-260),y=180+rand(i,9)*(H-360);if(!vacant(x,y))continue;const wild=x<550||x>8700||y<700||y>6200||x>7000&&y<1500;if(wild||rand(i,4)>.50)trees.push({x,y,size:.7+rand(i,8)*.55,type:x>7000||y<700?1:i%11===0?3:i%13===0?2:0});else if(i%3===0)trees.push({x,y,size:.35+rand(i,8)*.3,type:5});}
 for(let y=880;y<2320;y+=260)for(let x=620;x<1390;x+=240)if(vacant(x,y,20))trees.push({x,y,size:.7,type:4});
 for(let x=140;x<W-150;x+=50){if(Math.abs(x-riverX(260))<400)continue;const y=220+Math.round(Math.sin(x/440)*48);for(let row=0;row<4;row++)for(let col=0;col<4;col++){rect(g,x+col*12+(row%2)*5,y+row*14,11,13,['#667662','#7c8a70','#8e977a','#596f5c'][Math.floor(rand(x+col,row)*4)]);rect(g,x+col*12+(row%2)*5,y+row*14,11,2,'#acb18b');}trees.push({x,y:y-30,size:.45,type:5});}
 fountain(g,4070,4070);for(const [x,y] of [[3840,4190],[4300,4200],[4740,4040],[3700,3990]])planter(g,x,y,110);
 // Communal seats, riverside lamps, lilies and the old wishing tree.
 for(const [x,y] of [[3700,4220],[4250,4260],[6060,3400],[7320,2660],[2140,3960],[4360,5720]])bench(g,x,y);
 for(let y=1600;y<6000;y+=480)lamp(g,riverX(y)-250,y);
 for(let i=0;i<35;i++){const a=i*2.4,x=1820+Math.cos(a)*360,y=3660+Math.sin(a)*220;ellipse(g,x,y,13,6,'#336b4b');rect(g,x-5,y-4,7,2,'#7f9e63');if(i%3===0)flower(g,x,y-3,'#ecc2d5');}
 trees.push({x:1800,y:6080,size:2,type:2});
 // Ground shadows belong to the terrain; building sprites are depth-sorted at runtime.
 for(const h of [...residents,...landmarks.filter(l=>l.w)])ellipse(g,h.x+h.w*.54,h.y+h.h,h.w*.56,28,'#12332c45');
 return {terrain,trees,road};
}
