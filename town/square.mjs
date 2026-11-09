import {MUSIC_SQUARE,baseElevation} from './model.mjs';
import {squareScene} from './art.mjs?v=map-recovery-1';
export function drawMusicSquare(c){const s=MUSIC_SQUARE,z=baseElevation(s.center.x,s.center.y);squareScene(c,s.x,s.y-z,s.w,s.h);}
