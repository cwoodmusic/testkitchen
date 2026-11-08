import {height} from './model.mjs?v=music-walls-1';

// These are source rectangles from Music Square itself. A native pixel is
// always the same size here as it is in the 2400 × 1600 placed square.
export const MUSIC_WALL_SCALE=2400/1536;
export const MUSIC_WALL_HEIGHT=52*MUSIC_WALL_SCALE;
export const MUSIC_WALL_WIDTH=29*MUSIC_WALL_SCALE;
export const musicWallDonors=Object.freeze({
 horizontal:Object.freeze({x:302,y:44,w:176,h:52}),
 vertical:Object.freeze({x:33,y:112,w:29,h:228}),
 post:Object.freeze({x:900,y:16,w:53,h:90,anchorX:925,anchorY:96})
});
let squareImage=null,gateImage=null;
export function configureMusicWallArt(image,ironGate=null){squareImage=image;gateImage=ironGate;}

function piece(c,image,sx,sy,sw,sh,x,y,w,h){
 if(image&&sw>0&&sh>0&&w>0&&h>0)c.drawImage(image,sx,sy,sw,sh,x,y,w,h);
}
function horizontal(c,length){
 const r=musicWallDonors.horizontal,bay=r.w*MUSIC_WALL_SCALE;
 for(let x=0;x<length;x+=bay){const n=Math.min(bay,length-x);piece(c,squareImage,r.x,r.y,n/MUSIC_WALL_SCALE,r.h,x,-MUSIC_WALL_HEIGHT,n,MUSIC_WALL_HEIGHT);}
}
function vertical(c,length){
 const r=musicWallDonors.vertical,bay=r.h*MUSIC_WALL_SCALE,left=(r.x-48)*MUSIC_WALL_SCALE;
 for(let y=0;y<length;y+=bay){const n=Math.min(bay,length-y);piece(c,squareImage,r.x,r.y,r.w,n/MUSIC_WALL_SCALE,left,y,MUSIC_WALL_WIDTH,n);}
}
function iron(c,length,axis){
 if(!gateImage){if(axis==='h')horizontal(c,length);else vertical(c,length);return;}
 if(axis==='h')piece(c,gateImage,gateImage.width*.235,gateImage.height*.16,gateImage.width*.53,gateImage.height*.77,0,-MUSIC_WALL_HEIGHT,length,MUSIC_WALL_HEIGHT);
 else{c.save();c.rotate(Math.PI/2);piece(c,gateImage,gateImage.width*.235,gateImage.height*.2,gateImage.width*.53,gateImage.height*.65,0,-18,length,36);c.restore();}
}

export function drawMusicWallRun(c,run){
 if(!squareImage)return;
 const {s,e,z=0,axis,start,end}=run,scale=Number.isFinite(e.wallScale)?e.wallScale:1,length=(end-start)/scale;
 if(length<=0||e.open)return;
 c.save();c.imageSmoothingEnabled=false;c.translate(s.x,s.y-z);c.scale(scale,scale);
 // The matching wall's own source contains its stone shading. Keep the cast
 // ground shadow outside that donor, so its native palette remains unchanged.
 c.fillStyle='#1b27252a';if(axis==='h')c.fillRect(0,0,length,7);else c.fillRect(-MUSIC_WALL_WIDTH/2,0,MUSIC_WALL_WIDTH+5,length);
 if(e.gate)iron(c,length,axis);else if(axis==='h')horizontal(c,length);else vertical(c,length);
 c.restore();
}

// The north-east gateway pilaster has a clean silhouette and exactly the same
// cap, flower rosette and molding as the ends of the square's existing walls.
const postOutline=[[903,24],[906,19],[947,19],[950,24],[951,59],[946,64],[946,100],[941,104],[908,104],[903,100],[903,65],[900,61],[901,25]];
function postAt(c,x,y,scale=1){
 if(!squareImage)return;
 const r=musicWallDonors.post;c.save();c.translate(x,y);c.scale(MUSIC_WALL_SCALE*scale,MUSIC_WALL_SCALE*scale);
 c.beginPath();for(let i=0;i<postOutline.length;i++){const[p,q]=postOutline[i];if(i===0)c.moveTo(p-r.anchorX,q-r.anchorY);else c.lineTo(p-r.anchorX,q-r.anchorY);}c.closePath();c.clip();
 piece(c,squareImage,r.x,r.y,r.w,r.h,r.x-r.anchorX,r.y-r.anchorY,r.w,r.h);c.restore();
}
export function drawMusicWallPost(c,p,d){
 const z=Number.isFinite(p.z)?p.z:d?height(d,p.x+2,p.y+2):0,scale=p.wallScale??p.e?.wallScale??1;
 if(p.gate&&gateImage){
  piece(c,gateImage,0,0,gateImage.width*.23,gateImage.height,p.x-14*scale,p.y-z-(MUSIC_WALL_HEIGHT+24)*scale,28*scale,(MUSIC_WALL_HEIGHT+32)*scale);return;
 }
 postAt(c,p.x,p.y-z,scale);
}

// Library entries also export as ordinary native PNG pieces. Their connected
// wall metadata lets the builder launch the fence tool from the same artwork.
export function registerMusicWallAssets(add){
 const straight=add('music-square-wall','Music Square · matching stone wall','construction',512,160,c=>{
  drawMusicWallRun(c,{s:{x:44,y:136},e:{},z:0,axis:'h',start:44,end:468});postAt(c,44,136);postAt(c,468,136);
 },[{x:16,y:126,w:480,h:25}]);
 Object.assign(straight,{kit:'urban',barrierStyle:'music-square',collisionDefault:true});
 const corner=add('music-square-wall-corner','Music Square · matching wall corner','construction',320,384,c=>{
  drawMusicWallRun(c,{s:{x:64,y:144},e:{},z:0,axis:'v',start:144,end:352});
  drawMusicWallRun(c,{s:{x:64,y:352},e:{},z:0,axis:'h',start:64,end:272});
  for(const[x,y]of [[64,144],[64,352],[272,352]])postAt(c,x,y);
 },[{x:40,y:144,w:48,h:221},{x:40,y:342,w:256,h:24}]);
 Object.assign(corner,{kit:'urban',barrierStyle:'music-square',collisionDefault:true});
 const post=add('music-square-wall-post','Music Square · stone wall pillar','construction',96,160,c=>postAt(c,48,136),[{x:9,y:126,w:78,h:26}]);
 Object.assign(post,{kit:'urban',collisionDefault:true});
}
