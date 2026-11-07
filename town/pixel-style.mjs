// Shared art palette and pixel grid for every environment asset.
const hex=s=>[parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)];
const palette=[
 '16232b','21343b','2c4446','3a5652','526d63','758879','9ca68a','c5c4a3',
 '18372b','234c32','32633b','427b42','57934a','73a753','94b965','becb85',
 '203f39','2d5a46','3f7753','5b9160','7ba572','a4b88a',
 '302c31','493b36','614c3c','7b6146','94754f','b08e60','c8aa77','e0c695',
 '413b40','5b5051','776966','958578','b1a18a','d1bea2','e8d6b3','f5e6c8',
 '3b303b','5b3e48','7b5159','a06b6d','c38a83','dbaa94',
 '293246','3b4a61','536580','72859b','99a6b5','c1c9c5',
 '3c334d','584765','75617d','97819b','b6a1b4',
 '214755','2b6371','3c8190','61a0a7','8fbfc1','c1dcd0',
 '795832','a5783d','cda056','ebc679','ffe1a0','fff0c1'
].map(hex);
const lookup=new Int16Array(32768).fill(-1);
export function pixelPalette(canvas){const c=canvas.getContext('2d',{willReadFrequently:true}),frame=c.getImageData(0,0,canvas.width,canvas.height),d=frame.data;for(let i=0;i<d.length;i+=4){if(d[i+3]<32){d[i+3]=0;continue;}const key=(d[i]>>3)*1024+(d[i+1]>>3)*32+(d[i+2]>>3);let best=lookup[key];if(best<0){best=0;let distance=Infinity;for(let j=0;j<palette.length;j++){const p=palette[j],r=d[i]-p[0],g=d[i+1]-p[1],b=d[i+2]-p[2],delta=r*r*.9+g*g*1.2+b*b;if(delta<distance){distance=delta;best=j;}}lookup[key]=best;}const p=palette[best];d[i]=p[0];d[i+1]=p[1];d[i+2]=p[2];d[i+3]=d[i+3]>224?255:Math.round(d[i+3]/32)*32;}c.putImageData(frame,0,0);return canvas;}
export const PIXEL_GRID=2;
export const FENCE={height:56,railingHeight:42,postWidth:14,bay:96};
