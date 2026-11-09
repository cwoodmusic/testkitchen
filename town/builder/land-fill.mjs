import {groundMaterials} from '../world/ground-paint.mjs?v=queues-stage-1';
import {planTerrainFill} from './water-fill.mjs?v=queues-stage-1';

// Replace the clicked material on its connected physical floor. The same
// bucket can repaint dry land or reclaim water without crossing its shore.
export function planLandFill(doc,p,{surface='grass',paving='auto'}={}){
 if(!groundMaterials.includes(surface)||surface==='cobble'&&(typeof paving!=='string'||!paving.length))return {edits:[],level:null,count:0,message:'Choose a land material in Ground before filling.'};
 return planTerrainFill(doc,p,{surface,paving,matchSourceMaterial:true});
}
