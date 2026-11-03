/* Independent environment props over a complete, empty arcade backdrop.
 * Source canvases retain the original object dimensions and project identities. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaEnvironmentArt=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const WORLD=Object.freeze({width:1672,height:941}),BACKGROUND='empty-walls.png';
 const wallFixtures=typeof module==='object'&&module.exports?require('./wall-fixtures.js'):window.CodaWallFixtures;
 const pixelStyle=typeof module==='object'&&module.exports?require('./pixel-style.js'):window.CodaPixelStyle;
 const FIXTURES=Object.freeze(Object.fromEntries((wallFixtures?.CATALOG||[]).map(part=>[part.name,Object.freeze({file:'wall-fixtures/'+part.sprite+'.png',width:part.bounds[2],height:part.bounds[3],mirror:false})])));
 const rows=[
  ['lounge_sofa','lounge-couch-south.png',288,105],
  ['dance_left_couch','dance-couch-left-south.png',164,131],
  ['dance_right_couch','dance-couch-right-south.png',162,109],
  ['lounge_center_candle_table','table.png',86,70],
  ['lounge_northwest_candle_table','table.png',63,61],
  ['lounge_west_candle_table','table.png',52,41],
  ['boutique_counter','boutique-counter.png',127,81],
  ['boutique_mirror','mirror.png',55,103],
  ['main_counter','main-counter.png',361,142],
  ['dance_dj_console','dj-console.png',121,62],
  ['lounge_palm_left','palm.png',58,78],
  ['lounge_palm_top','palm.png',55,98,true],
  ['lounge_palm_south','palm.png',67,70],
  ['boutique_palm_right','palm.png',67,98,true],
  ['boutique_roof_palm','palm.png',66,87],
  ['boutique_left_palm','palm.png',58,70,true],
  ['dance_upper_right_palm','palm.png',67,90],
  ['dance_right_palm','palm.png',72,84,true],
  ['dance_far_right_palm','palm.png',67,96],
  ['dance_front_left_palm','palm.png',75,73,true],
  ['dance_front_mid_palm','palm.png',68,69],
  ['dance_front_center_palm','palm.png',70,73,true],
  ['dance_front_right_palm','palm.png',76,85],
  ['dance_front_second_right_palm','palm.png',68,85,true],
  ['main_counter_left_palm','palm.png',75,89],
  ['main_counter_right_palm','palm.png',72,93,true],
  ['hall_palm_west','palm.png',59,77],
  ['hall_palm_east','palm.png',62,80,true],
  ['piano_landing_palm','palm.png',80,85],
  ['piano_landing_palm_right','palm.png',58,93,true],
  ['dance_corner_palm','palm.png',79,88],
  ['obelisk_west','bollard.png',27,66],
  ['obelisk_middle','bollard.png',25,68],
  ['obelisk_east','bollard.png',24,65],
  ['obelisk_far_east','bollard.png',28,72],
  ['obelisk_corner','bollard.png',35,66]
 ];
 const OBJECTS=Object.freeze(Object.fromEntries(rows.map(([name,file,width,height,mirror=false])=>[name,Object.freeze({file,width,height,mirror})])));
 const FILES=Object.freeze([BACKGROUND,...new Set([...rows.map(row=>row[1]),...Object.values(FIXTURES).map(item=>item.file)])]);
 function validSourceSize(width,height,background=false){
  return Number.isSafeInteger(width)&&Number.isSafeInteger(height)&&width>0&&height>0&&width<=8192&&height<=8192&&width*height<=16777216&&(!background||width===WORLD.width&&height===WORLD.height);
 }
 function fitRect(sourceWidth,sourceHeight,width,height){
  if(!validSourceSize(sourceWidth,sourceHeight)||!validSourceSize(width,height))return null;
  const scale=Math.min(width/sourceWidth,height/sourceHeight),w=Math.max(1,Math.min(width,Math.round(sourceWidth*scale))),h=Math.max(1,Math.min(height,Math.round(sourceHeight*scale)));
  return {x:Math.floor((width-w)/2),y:Math.floor((height-h)/2),width:w,height:h};
 }
 function structuralBounds(part){
  if(!part||!['wall','wall-mask'].includes(part.type)||!Array.isArray(part.bounds)||part.bounds.length!==4)return null;
  const [x,y,width,height]=part.bounds;
  if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||x<0||y<0||!validSourceSize(width,height)||x+width>WORLD.width||y+height>WORLD.height)return null;
  if(part.poly!==undefined&&(!Array.isArray(part.poly)||part.poly.length<3||part.poly.length>512||part.poly.some(point=>!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite))))return null;
  return {x,y,width,height};
 }
 function create(options={}){
  const doc=options.document||(typeof document==='undefined'?null:document),base=options.baseUrl===undefined?'assets/environment/v1/':options.baseUrl;
  if(!doc||typeof doc.createElement!=='function')throw Error('Environment artwork requires a document.');
  if(typeof base!=='string'||!base.trim())throw Error('Environment artwork needs a base URL.');
  const baseUrl=base.endsWith('/')?base:base+'/',images=new Map(),objects=new Map(),structures=new Map();let loaded=false;
  const win=doc.defaultView||globalThis,timeoutMs=60000;
  const tasks=FILES.map(file=>new Promise((resolve,reject)=>{
   const image=doc.createElement('img');images.set(file,image);let finished=false,decoding=false;
   const clean=()=>{win.clearTimeout(timer);image.removeEventListener('load',onload);image.removeEventListener('error',onerror);};
   function finish(error){if(finished)return;finished=true;clean();if(error)reject(error);else resolve(image);}
   const timer=win.setTimeout(()=>finish(Error('Environment artwork timed out: '+file+'. Reload to retry.')),timeoutMs);
   const onerror=()=>finish(Error('Environment artwork could not load: '+file+'.'));
   async function onload(){
    if(finished||decoding)return;decoding=true;
    try{
     if(typeof image.decode==='function')await image.decode();
     if(!validSourceSize(image.naturalWidth,image.naturalHeight,file===BACKGROUND))throw Error('Environment artwork dimensions are invalid: '+file+'.');
     finish();
    }catch(error){finish(Error('Environment artwork could not decode: '+file+'. '+(error.message||'')));}
   }
   const styled=pixelStyle?.ENVIRONMENT[file];
   image.addEventListener('load',onload);image.addEventListener('error',onerror);image.src=styled?baseUrl+'../../decor/handdrawn/v1/'+styled+'.png?v='+pixelStyle.VERSION:baseUrl+file+(file===BACKGROUND?'?v=independent-wall-fixtures-20261101-1':'');
   if(image.complete&&image.naturalWidth)onload();
  }));
  const ready=Promise.all(tasks).then(()=>{loaded=true;});
  function canvas(width,height){const result=doc.createElement('canvas');result.width=width;result.height=height;const context=result.getContext('2d');if(!context)throw Error('Environment artwork needs Canvas rendering.');context.imageSmoothingEnabled=false;return [result,context];}
  function has(name){return typeof name==='string'&&(Object.prototype.hasOwnProperty.call(OBJECTS,name)||Object.prototype.hasOwnProperty.call(FIXTURES,name));}
  function object(name){
   if(!loaded||!has(name))return null;if(objects.has(name))return objects.get(name);
   const spec=OBJECTS[name]||FIXTURES[name],source=images.get(spec.file),rect=FIXTURES[name]?{x:0,y:0,width:spec.width,height:spec.height}:fitRect(source.naturalWidth,source.naturalHeight,spec.width,spec.height),[result,context]=canvas(spec.width,spec.height);
   if(spec.mirror){context.translate(spec.width,0);context.scale(-1,1);}
   // Keep the current world's sofa silhouettes and foot baselines while the
   // separate library copies retain the complete new hand-drawn proportions.
   const fitted=pixelStyle?.ENVIRONMENT_FIT[name];
   if(fitted)context.drawImage(source,...fitted.source,...fitted.target);
   else context.drawImage(source,rect.x,rect.y,rect.width,rect.height);
   objects.set(name,result);return result;
  }
  function structural(part){
   const bounds=structuralBounds(part);if(!loaded||!bounds)return null;
   const key=JSON.stringify([part.name,part.bounds,part.poly||null]);if(structures.has(key))return structures.get(key);
   const [result,context]=canvas(bounds.width,bounds.height);context.save();context.translate(-bounds.x,-bounds.y);
   if(part.poly){context.beginPath();context.moveTo(...part.poly[0]);for(const point of part.poly.slice(1))context.lineTo(...point);context.closePath();context.clip();}
   context.drawImage(images.get(BACKGROUND),0,0);context.restore();
   // Legacy wall crops can overlap newly exposed floor. Remove only the
   // reviewed southwest source overlap; saved object artwork is applied later.
   if(part.name==='dance_lower_wall_left'&&win.CodaForegroundFloorCompat){
    const image=context.getImageData(0,0,bounds.width,bounds.height),pixels=image.data;
    for(let y=0;y<bounds.height;y++)for(let x=0;x<bounds.width;x++)if(win.CodaForegroundFloorCompat.structuralFloorPixel(part,bounds.x+x+.5,bounds.y+y+.5))pixels[(y*bounds.width+x)*4+3]=0;
    context.putImageData(image,0,0);
   }
   structures.set(key,result);return result;
  }
  return Object.freeze({ready,isReady:()=>loaded,background:()=>images.get(BACKGROUND),object,has,structural});
 }
 return Object.freeze({WORLD,BACKGROUND,FILES,OBJECTS,FIXTURES,validSourceSize,fitRect,structuralBounds,create});
});
