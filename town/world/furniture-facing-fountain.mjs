import {assetImage} from './asset-color.mjs?v=furniture-facings-1';
import {drawFountainMotion,supportsFountainMotion} from './fountain-motion.mjs?v=furniture-facings-1';

function grade(asset,image){const proxy=Object.create(asset);Object.defineProperty(proxy,'canvas',{value:image});return assetImage(proxy);}

// A fountain's cyan-water mask must sample its selected native view, never
// the shared overview atlas or a South canvas hidden behind another facing.
export function drawFacingFountainMotion(ctx,asset,placement,source,time,{native=true,gradeImage=grade,drawMotion=drawFountainMotion}={}){
 if(!native||source?.native!==true||!supportsFountainMotion(asset))return false;
 const image=source.image;if(!image||!(image.width>0&&image.height>0))return false;
 // Native draw descriptors cover their whole view canvas. Preview descriptors
 // are atlas crops and deliberately never enter this small foreground effect.
 if((source.sx??0)!==0||(source.sy??0)!==0||source.sw!==image.width||source.sh!==image.height)return false;
 const selected=gradeImage(asset,image);
 ctx.save();ctx.translate(placement.x,placement.y);ctx.scale(placement.w/selected.width,placement.h/selected.height);
 drawMotion(ctx,asset,selected,time);ctx.restore();return true;
}
