export {findStart,movePlayer,toggleGate,follow} from './physics.mjs';
export {render} from './render.mjs';
export {catalog} from './catalog.mjs';
export const PIXEL_GRID=2;
export function resizeSurface(canvas){const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.ceil(w/PIXEL_GRID)||canvas.height!==Math.ceil(h/PIXEL_GRID)){canvas.width=Math.ceil(w/PIXEL_GRID);canvas.height=Math.ceil(h/PIXEL_GRID);}const ctx=canvas.getContext('2d');ctx.setTransform(1/PIXEL_GRID,0,0,1/PIXEL_GRID,0,0);ctx.imageSmoothingEnabled=false;return {ctx,width:w,height:h};}
