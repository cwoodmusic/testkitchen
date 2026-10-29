/* Share the character pixel journal with the general artwork editor.
 * Characters keep their procedural clothing, walking, jumping and emotes.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root){root.CodaCharacterArtworkAdapter=api;root.createCodaCharacterArtworkAdapter=api.create;}
})(typeof window==='undefined'?null:window,function(root){
 'use strict';
 const WIDTH=80,HEIGHT=96,FACINGS=['down','left','up','right'];
 const FACING_NAMES={down:'Front',left:'Left',up:'Back',right:'Right'};
 const copy=value=>JSON.parse(JSON.stringify(value));
 const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 function dependencies(options={}){
  const pixel=options.pixelEditor||root?.CodaPixelEditor||(typeof require==='function'?require('./pixel-editor.js'):null),
   artwork=options.artworkEditor||root?.CodaArtworkEditor||(typeof require==='function'?require('./artwork-editor.js'):null);
  if(!pixel?.validate||!artwork?.validateTexture||!artwork?.normalizeTexture)throw Error('The artwork and character pixel tools must load first.');
  return {pixel,artwork};
 }
 function rgba(color){return color===null?'#00000000':color.length===7?color.toLowerCase()+'ff':color.toLowerCase();}
 function sparseColor(color){return color.endsWith('00')?null:color.endsWith('ff')?color.slice(0,7):color;}
 function pixelsToTexture(points,options={}){
  const {pixel,artwork}=dependencies(options);
  if(!pixel.validate({player:{down:points}}))return null;
  const tiles={},size=artwork.TILE;
  for(const [x,y,color]of points){
   const key=Math.floor(x/size)+','+Math.floor(y/size),index=(y%size)*size+x%size;
   (tiles[key]||(tiles[key]=[])).push([index,1,rgba(color)]);
  }
  for(const runs of Object.values(tiles))runs.sort((a,b)=>a[0]-b[0]);
  return artwork.normalizeTexture({width:WIDTH,height:HEIGHT,tiles});
 }
 function textureToPixels(texture,options={}){
  const {artwork}=dependencies(options);
  if(!artwork.validateTexture(texture)||texture.width!==WIDTH||texture.height!==HEIGHT)return null;
  const points=[],size=artwork.TILE;
  for(const [key,runs]of Object.entries(texture.tiles)){
   const [tx,ty]=key.split(',').map(Number);
   for(const [start,length,color]of runs)for(let at=start;at<start+length;at++){
    const x=tx*size+at%size,y=ty*size+Math.floor(at/size);
    points.push([x,y,sparseColor(color.toLowerCase())]);
   }
  }
  return points.sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
 }
 function create(api={}){
  const {pixel,artwork}=dependencies(api),options={pixelEditor:pixel,artworkEditor:artwork};
  if(!api.renderer?.renderPixelFrame)throw Error('Character artwork needs a character renderer.');
  const prefix='character.';
  function actors(){
   const supplied=api.getTargets?.()||pixel.TARGETS.map(id=>({id,name:id})),seen=new Set();
   return supplied.filter(actor=>actor&&pixel.TARGETS.includes(actor.id)&&!seen.has(actor.id)&&!!seen.add(actor.id));
  }
  function getTargets(){return actors().flatMap(actor=>FACINGS.map(facing=>({
   id:prefix+actor.id+'.'+facing,name:(actor.name||actor.label||actor.id)+' · '+FACING_NAMES[facing],
   width:WIDTH,height:HEIGHT,group:'Characters',character:actor.id,facing
  })));}
  function address(id){
   if(typeof id!=='string'||!id.startsWith(prefix))return null;
   const pieces=id.slice(prefix.length).split('.');
   if(pieces.length!==2||!FACINGS.includes(pieces[1])||!actors().some(actor=>actor.id===pieces[0]))return null;
   return {actor:pieces[0],facing:pieces[1]};
  }
  function sourceSprites(){const value=api.getSprites?.()||{};return pixel.normalize(value)||{};}
  function getData(){
   const sprites=sourceSprites(),result={};
   for(const actor of actors())for(const facing of FACINGS){
    const points=sprites[actor.id]?.[facing];if(!points?.length)continue;
    result[prefix+actor.id+'.'+facing]=pixelsToTexture(points,options);
   }
   return result;
  }
  function getSource(id){
   const target=address(id);if(!target)return null;
   const profile=api.getProfile?.(target.actor)||(target.actor==='player'?{}:api.renderer.appearanceFor?.(target.actor)||{});
   return api.renderer.renderPixelFrame(target.actor,profile,{facing:target.facing},0,{base:true});
  }
  function onChange(data){
   if(!object(data)||api.canEdit?.()===false)return false;
   // Validate every owned entry before changing the shared journal. Noncharacter
   // artwork belongs to the caller; unknown character IDs are never accepted.
   for(const [id,texture]of Object.entries(data))if(id.startsWith(prefix)){
    if(!address(id)||textureToPixels(texture,options)===null)return false;
   }
   const previous=sourceSprites(),next=copy(previous);
   for(const actor of actors()){
    delete next[actor.id];
    for(const facing of FACINGS){
     const id=prefix+actor.id+'.'+facing;if(!Object.hasOwn(data,id))continue;
     const points=textureToPixels(data[id],options);if(!points.length)continue;
     next[actor.id]||(next[actor.id]={});next[actor.id][facing]=points;
    }
   }
   const normalized=pixel.normalize(next);if(!normalized)return false;
   if(JSON.stringify(previous)===JSON.stringify(normalized))return true;
   return typeof api.setSprites==='function'&&api.setSprites(normalized)!==false;
  }
  return {getTargets,getSource,getData,onChange,setData:onChange};
 }
 return {WIDTH,HEIGHT,FACINGS,create,pixelsToTexture,textureToPixels};
});
