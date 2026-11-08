import {groundMaterials} from '../world/ground-paint.mjs?v=urban-assets-2';
import {planTerrainFill} from './water-fill.mjs?v=land-fill-1';

// A land bucket reclaims the clicked connected water body. Existing land is
// its shoreline, even where that land shares the same physical height.
export function planLandFill(doc,p,{surface='grass',paving='auto'}={}){
 if(!groundMaterials.includes(surface)||surface==='cobble'&&(typeof paving!=='string'||!paving.length))return {edits:[],level:null,count:0,message:'Choose a land material in Ground before filling.'};
 return planTerrainFill(doc,p,{surface,paving,sourceWaterOnly:true});
}
