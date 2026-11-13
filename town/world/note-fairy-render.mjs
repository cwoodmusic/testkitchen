import {flyingNotePose} from './rhythm-hunt-motion.mjs?v=town-store-halls-1';
import {drawCatchNote} from './town-game-audio.mjs?v=town-store-halls-1';

const palettes={
 yellow:{ink:'#fff0a5',edge:'#ffcf62',wing:'#fff3b6',shade:'#76591e'},
 blue:{ink:'#dcf8ff',edge:'#70d8ff',wing:'#bfefff',shade:'#194e77'}
};
const star=(c,x,y,r)=>{c.beginPath();c.moveTo(x,y-r);c.lineTo(x+r*.3,y-r*.25);c.lineTo(x+r,y);c.lineTo(x+r*.3,y+r*.25);c.lineTo(x,y+r);c.lineTo(x-r*.3,y+r*.25);c.lineTo(x-r,y);c.lineTo(x-r*.3,y-r*.25);c.closePath();c.fill();};

/** A bare musical glyph carries the light, wings and glitter of a tiny fairy. */
export function drawNoteFairy(c,token,{time=0,z=0,reducedMotion=false}={}){
 const pose=flyingNotePose(token,time,z,reducedMotion),palette=palettes[token.color==='blue'?'blue':'yellow'],phase=Number.isFinite(token.phase)?token.phase:0,t=reducedMotion?0:time,
  glyphScale=token.value==='sixteenth-group'?.5:token.value==='eighth-pair'?.58:.64,
  flutter=reducedMotion?.65:.35+Math.abs(Math.sin(t*16+phase))*.65;
 c.save();c.translate(pose.x,pose.y);
 // Fine wings never form a backdrop around the notation. Their opening changes
 // with flight, while the glyph keeps its upright, readable musical shape.
 c.save();c.fillStyle=palette.wing;c.globalAlpha*=.3;
 for(const side of [-1,1]){
  c.beginPath();c.ellipse(side*(11+flutter*3),-5,8+flutter*4,3.5,side*-.48,0,Math.PI*2);c.fill();
  c.beginPath();c.ellipse(side*11,4,6+flutter*2,2.5,side*.45,0,Math.PI*2);c.fill();
 }
 c.restore();
 // A short glitter trail follows the actual heading. Three tiny stars and two
 // fading motes replace the old large circular badge; all work is bounded.
 const speed=Math.hypot(token.vx||0,token.vy||0),dx=speed?(token.vx||0)/speed:Math.cos(phase),dy=speed?(token.vy||0)/speed:Math.sin(phase);
 for(let i=0;i<3;i++){
  const life=reducedMotion?(i+.3)/3:((t*.85+phase*.13+i/3)%1+1)%1,
   distance=18+life*22,cross=Math.sin(phase+i*2.1)*9,x=-dx*distance-dy*cross,y=-dy*distance+dx*cross,
   twinkle=reducedMotion?.55:.32+Math.pow((Math.sin(t*5+phase+i*2)+1)/2,2)*.56;
  c.save();c.fillStyle=i===1?palette.ink:palette.edge;c.globalAlpha*=(1-life*.65)*twinkle;star(c,x,y,1.5+(1-life)*1.7);c.restore();
 }
 c.save();c.fillStyle=palette.ink;c.globalAlpha*=.45;
 for(const [x,y]of [[-18,16],[20,-18]]){const flicker=reducedMotion?1:.6+Math.sin(t*7+phase+x)*.4;c.fillRect(x,y,1.5*flicker,1.5*flicker);}
 c.restore();
 // The offset dark ink is a small contrast edge on grass and paving, not a glow.
 c.save();c.fillStyle=c.strokeStyle=palette.shade;c.globalAlpha*=.75;drawCatchNote(c,token.value,1.2,1.2,glyphScale);c.restore();
 c.fillStyle=palette.ink;c.strokeStyle=palette.edge;drawCatchNote(c,token.value,0,0,glyphScale);
 c.restore();
 const glyphWidth=token.value==='sixteenth-group'?34:token.value==='eighth-pair'?29:19;
 return {...pose,bounds:{x:pose.x-47,y:pose.y-47,w:94,h:94},glyphBounds:{x:pose.x-glyphWidth/2,y:pose.y-20,w:glyphWidth,h:40}};
}
