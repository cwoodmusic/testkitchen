/* The three known Notes-counter icons share the jade/mint counter palette.
 * Recolor a cached render source, never the embedded project PNG or user edits. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaMainCounterPalette=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const IDS=new Set(['asset-40','asset-41','asset-42']),SOURCE_LENGTH=216694,SOURCE_HASH=0x0a8b972d;
 const knownSources=new Map();
 function matches(asset){
  if(asset?.kind!=='image'||!IDS.has(asset.id)||typeof asset.data!=='string'||asset.data.length!==SOURCE_LENGTH)return false;
  if(knownSources.has(asset.data))return knownSources.get(asset.data);
  let hash=2166136261;
  for(let index=0;index<asset.data.length;index++)hash=Math.imul(hash^asset.data.charCodeAt(index),16777619)>>>0;
  const result=hash===SOURCE_HASH;if(knownSources.size>=8)knownSources.delete(knownSources.keys().next().value);knownSources.set(asset.data,result);return result;
 }
 function recolorPixels(pixels){
  const result=new Uint8ClampedArray(pixels);
  for(let index=0;index<result.length;index+=4){
   const r=pixels[index],g=pixels[index+1],b=pixels[index+2],peak=Math.max(r,g,b),low=Math.min(r,g,b),spread=peak-low;
   if(!pixels[index+3]||spread<14)continue;
   let hue=peak===r?((g-b)/spread)%6:peak===g?(b-r)/spread+2:(r-g)/spread+4;
   hue=(hue*60+360)%360;
   const bright=Math.max(0,Math.min(1,(peak-80)/175));
   if(hue>=160&&hue<=215){
    result[index]=peak*(.28+.57*bright);result[index+1]=peak;result[index+2]=peak*(.60+.32*bright);
   }else if(hue>=235&&hue<=330){
    result[index]=peak*(.14+.18*bright);result[index+1]=peak*(.55+.41*bright);result[index+2]=peak*(.30+.26*bright);
   }
  }
  return result;
 }
 function create(options={}){
  const doc=options.document||(typeof document==='undefined'?null:document),cache=new WeakMap();
  function image(asset,source){
   if(options.enabled?.()===false||!source||!matches(asset))return source;
   if(source.complete!==undefined&&(!source.complete||!source.naturalWidth))return source;
   const width=source.naturalWidth||source.width,height=source.naturalHeight||source.height;
   if(!doc||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)return source;
   if(cache.has(source))return cache.get(source);
   const canvas=doc.createElement('canvas');canvas.width=width;canvas.height=height;
   const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(source,0,0);
   const pixels=context.getImageData(0,0,width,height);pixels.data.set(recolorPixels(pixels.data));context.putImageData(pixels,0,0);
   cache.set(source,canvas);return canvas;
  }
  return {image};
 }
 return Object.freeze({create,matches,recolorPixels});
});
