import {blank,key,COLS,ROWS} from './model.mjs?v=town-compact-island-1';

// A separate, unsaved tour. Creating it never reads or replaces the builder map.
export function createUrbanTour(){
 const d=blank();d.name='Coda Town · Urban District';d.spawn={x:5000,y:6180};
 const ground=(x,y,w,h,surface='cobble')=>{
  const left=Math.max(0,Math.floor(x/64)),top=Math.max(0,Math.floor(y/64));
  const right=Math.min(COLS,Math.ceil((x+w)/64)),bottom=Math.min(ROWS,Math.ceil((y+h)/64));
  for(let yy=top;yy<bottom;yy++)for(let xx=left;xx<right;xx++)d.cells[key(xx,yy)]={surface,level:0,...(surface==='cobble'?{paving:'music-square'}:{})};
 };
 let n=0;
 const put=(asset,x,y,{collision=true,layer='objects',scale=1}={})=>d.objects.push({id:'urban-tour-'+(++n),asset,x,y,scale,rotation:0,layer,collision});
 // Broad, straight streets connect the homes, shops, piazza and arcade.
 ground(2752,6080,10816,768);ground(7104,3712,768,8192);
 ground(3392,4096,3264,2240);ground(7808,3776,3712,2560);
 ground(3840,7872,6656,2496);ground(10496,10752,4480,1152);
 ground(12096,6528,768,4800);
 put('coda-residences',5000,6000);
 put('coda-furnishings',9600,6000);
 put('music-square',7488,9984,{layer:'ground'});
 put('coda-arcade',12544,11264);
 // Two generous planted pergolas provide quieter places beside Music Square.
 ground(4544,8896,1216,768,'wood');ground(9152,8896,1216,768,'wood');
 put('decor-09-02',5152,9408);put('decor-09-02',9760,9408);
 for(const [x,y] of [[4544,9728],[5760,9728],[9152,9728],[10368,9728]])put('decor-06-01',x,y);
 for(const [x,y] of [[3520,6528],[6464,6528],[8256,6528],[10944,6528],[6976,7488],[8000,7488],[10880,11072],[14592,11072]])put('decor-14-01',x,y);
 for(const [x,y] of [[4352,6048],[5632,6048],[8640,6048],[10560,6048],[6528,8192],[8512,8192]])put('decor-08-03',x,y);
 // Full-size street trees frame city blocks; the entrances remain clear.
 for(const [x,y,i] of [[3008,4480,0],[3072,5824,0],[6464,4672,1],[6656,5760,0],[7680,4672,4],[11840,4672,0],[11968,5760,4],[3200,7808,1],[3264,9472,0],[3968,10304,3],[5728,11072,0],[8960,10944,3],[10368,10432,4],[14784,7808,1],[14976,9536,0]])put(`trees-${i}-680`,x,y);
 for(const [x,y] of [[3456,7168],[6272,7168],[8384,7168],[10816,7168],[3968,8512],[10752,8576],[11520,11904]])put('trees-5-200',x,y,{collision:false});
 return d;
}
