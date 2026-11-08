// The side entrances end on the same straight wall spines as their collision
// and snap geometry. Remove the outward returns and the small pavement lip
// between them so town paving meets the entire opening on one straight edge.
export const SIDE_ENTRANCE_TRIMS=Object.freeze([
 Object.freeze({x:0,y:348,w:33,h:287}),
 Object.freeze({x:1504,y:340,w:32,h:296})
]);

// Native terminal piers are scaled uniformly into the narrow side-wall spine.
// Their carved top, shaded face and plinth make an intentional stone ending,
// rather than the exposed cross-section left by cutting off the old return.
export const SIDE_ENTRANCE_CAPS=Object.freeze([
 Object.freeze({x:33,y:349,w:30,h:57,anchorX:48,anchorY:395}),
 Object.freeze({x:33,y:554,w:30,h:57,anchorX:48,anchorY:600}),
 Object.freeze({x:1474,y:349,w:30,h:57,anchorX:1488.5,anchorY:395}),
 Object.freeze({x:1474,y:554,w:30,h:57,anchorX:1488.5,anchorY:600})
]);
const capOutline=[[903,24],[906,19],[947,19],[950,24],[951,59],[946,64],[946,100],[941,104],[908,104],[903,100],[903,65],[900,61],[901,25]];

function nativePiece(c,image,sx,sy,sw,sh,x,y,w=sw,h=sh){
 const ix=image.width/1536,iy=image.height/1024;
 c.drawImage(image,sx*ix,sy*iy,sw*ix,sh*iy,x,y,w,h);
}
function endCap(c,image,p){
 c.save();
 c.beginPath();c.rect(p.x,0,p.w,1024);c.clip();
 c.translate(p.anchorX,p.anchorY);c.scale(30/53,30/53);
 c.beginPath();
 for(let i=0;i<capOutline.length;i++){
  const[x,y]=capOutline[i];if(i===0)c.moveTo(x-925,y-96);else c.lineTo(x-925,y-96);
 }
 c.closePath();c.clip();
 nativePiece(c,image,900,16,53,90,-25,-80);
 c.restore();
}

export function drawMusicSquareScene(c,image,w=2400,h=1600){
 c.drawImage(image,0,0,w,h);
 const sx=w/1536,sy=h/1024;
 c.save();c.scale(sx,sy);c.imageSmoothingEnabled=false;
 for(const r of SIDE_ENTRANCE_TRIMS)c.clearRect(r.x,r.y,r.w,r.h);
 // Clean cobbles behind each new termination replace the old corner face.
 // The lower wall joins its existing straight rail immediately below the cap.
 for(const [x,donor]of [[33,70],[1474,1430]]){
  nativePiece(c,image,donor,351,30,65,x,351);
  nativePiece(c,image,donor,548,30,58,x,548);
 }
 for(const p of SIDE_ENTRANCE_CAPS)endCap(c,image,p);
 c.restore();
}
