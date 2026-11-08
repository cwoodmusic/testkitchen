// The side entrances end on the same straight wall spines as their collision
// and snap geometry. Remove the outward returns and the small pavement lip
// between them so town paving meets the entire opening on one straight edge.
export const SIDE_ENTRANCE_TRIMS=Object.freeze([
 Object.freeze({x:0,y:348,w:33,h:287}),
 Object.freeze({x:1504,y:340,w:32,h:296})
]);

export function drawMusicSquareScene(c,image,w=2400,h=1600){
 c.drawImage(image,0,0,w,h);
 const sx=w/1536,sy=h/1024;
 for(const r of SIDE_ENTRANCE_TRIMS)c.clearRect(r.x*sx,r.y*sy,r.w*sx,r.h*sy);
}
