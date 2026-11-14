import {AUTHORED_MOTION_CORRECTIONS} from './authored-motion-data.mjs?v=town-review-3';
import {correctedArtMotion} from './parallel-art-motion.mjs?v=town-front-facing-2';

/**
 * Add reviewed native-glass geometry before accepted replacement art attaches
 * its own masks. Discovery and registration read metadata only. Native image,
 * ready and canvas getters remain the original provider's lazy descriptors.
 */
export function registerAuthoredMotion(catalog,{corrections=AUTHORED_MOTION_CORRECTIONS}={}){
 const prepared=new Map(),keys=new Set(),attached=[];
 for(const correction of corrections){
  const {id,facing,world,motionGeometry,identity}=correction,key=id+'|'+facing,asset=catalog.get(id);
  if(keys.has(key))throw Error('Duplicate authored motion view: '+key);keys.add(key);
  if(!asset||typeof asset.getFacingView!=='function'||!['south','west','north','east'].includes(facing))throw Error('Missing authored motion view: '+key);
  let record=prepared.get(asset);if(!record){record={asset,original:asset.getFacingView,views:new Map()};prepared.set(asset,record);}
  const view=record.original.call(asset,facing,{image:false});
  if(!view||view.w!==world?.w||view.h!==world?.h)throw Error('Authored motion dimensions changed: '+key);
  const original=view.motion??(facing==='south'?asset.motion:null);
  if(original&&identity)throw Error('Authored motion must preserve its existing identity: '+key);
  if(!original&&!identity)throw Error('New authored motion needs a stable identity: '+key);
  const motion=correctedArtMotion(original??identity,motionGeometry),descriptors=Object.getOwnPropertyDescriptors(view);
  descriptors.motion={value:motion,enumerable:true,configurable:true};
  const replacement=Object.create(Object.getPrototypeOf(view),descriptors);record.views.set(facing,replacement);attached.push({id,facing,motion});
  if(facing==='south'){
   const descriptor=Object.getOwnPropertyDescriptor(asset,'motion');
   if(descriptor&&!descriptor.configurable&&!descriptor.writable)throw Error('Authored South motion is not replaceable: '+id);
   record.southMotion=motion;
  }
 }
 for(const {asset,original,views,southMotion}of prepared.values()){
  asset.getFacingView=function(facing='south',options){return views.get(facing)??original.call(this,facing,options);};
  if(southMotion)asset.motion=southMotion;
 }
 return attached;
}
