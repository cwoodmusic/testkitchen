export {findStart,movePlayer,toggleGate,follow} from './physics.mjs?v=music-walls-1';
export {render} from './render.mjs?v=music-walls-1';
export {catalog,preparePlacedArt} from './catalog.mjs?v=music-walls-1';
export {PLAYER_SCALE,GAIT_PER_PIXEL} from './player-settings.mjs?v=music-walls-1';
export const PIXEL_GRID=2;
export function resizeSurface(canvas,{planning=false}={}){const grid=planning?1:PIXEL_GRID,w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.ceil(w/grid)||canvas.height!==Math.ceil(h/grid)){canvas.width=Math.ceil(w/grid);canvas.height=Math.ceil(h/grid);}const ctx=canvas.getContext('2d');ctx.setTransform(1/grid,0,0,1/grid,0,0);ctx.imageSmoothingEnabled=false;return {ctx,width:w,height:h};}
