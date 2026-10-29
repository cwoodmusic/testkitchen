/* Routes the shared pixel editor to original art, placed images and characters. */
(function(root){
 'use strict';
 root.createCodaWorldArtworkTools=function(api){
  const pixels=root.CodaArtworkEditor,clone=value=>JSON.parse(JSON.stringify(value));
  let editor=null;const composed=new WeakMap(),fragments=new WeakMap(),effectClips=new WeakMap();
  const rooms=()=>api.getRoomEditors?.()||[],assets=()=>api.getAssets(),originalId=name=>'object.'+name;
  function texture(id){return api.getRootData()[id];}
  function compose(id,source,patch){
   patch=patch||texture(id);if(!source||!patch)return source;
   const stamp=patch;let entries=composed.get(source);if(!entries){entries=new Map();composed.set(source,entries);}const cached=entries.get(id);
   if(cached?.stamp===stamp)return cached.canvas;
   const width=source.naturalWidth||source.width,height=source.naturalHeight||source.height;
   if(!pixels.validateTexture(patch,width,height))return source;
   const canvas=pixels.compose(source,patch);entries.set(id,{stamp,canvas});return canvas;
  }
  function sourceAsset(asset){return api.getAssetSource(asset);}
  function getTargets(){
   const result=[{id:'background.world',name:'Main arcade · Background',group:'Backgrounds',width:api.width,height:api.height},
    {id:'background.classroom',name:'Music classroom · Background',group:'Backgrounds'}];
   for(const room of rooms())result.push(...room.getArtworkTargets());
   for(const part of api.catalog)if(!part.permanentlyRemoved&&!assets().some(a=>a.origin?.name===part.name&&a.kind!=='builtin'))result.push({id:originalId(part.name),name:part.label||part.name.replaceAll('_',' '),group:'Existing arcade assets',width:part.bounds[2],height:part.bounds[3]});
   for(const asset of assets())if(!asset.origin||asset.kind!=='builtin')result.push({id:'asset.'+asset.id,name:asset.name,group:'Placed arcade assets'});
   result.push(...(api.characters?.getTargets()||[]));const seen=new Set();return result.filter(target=>!seen.has(target.id)&&!!seen.add(target.id));
  }
  function getData(){
   const result=clone(api.getRootData());
   for(const asset of assets())if(asset.artwork)result['asset.'+asset.id]=clone(asset.artwork);
   for(const room of rooms())Object.assign(result,room.getArtworkData());
   Object.assign(result,api.characters?.getData()||{});return result;
  }
  function getSource(id){
   if(id==='background.world')return api.getBackgroundSource();
   if(id==='background.classroom')return api.getClassroomSource?.();
   if(id.startsWith('character.'))return api.characters?.getSource(id);
   for(const room of rooms())if(room.getArtworkTargets().some(target=>target.id===id))return room.getArtworkSource(id);
   if(id.startsWith('object.'))return api.getObjectSource(id.slice(7));
   if(id.startsWith('asset.')){const asset=assets().find(a=>a.id===id.slice(6));return asset?sourceAsset(asset):null;}
   return null;
  }
  function previewRoom(id){return rooms().find(room=>room.hasArtworkAssetPreview?.(id));}
  function hasAssetPreview(id){return id==='background.world'?typeof api.drawAssetPreview==='function':!!previewRoom(id);}
  function drawAssetPreview(context,options){
   if(options.target==='background.world')return api.drawAssetPreview?.(context,options);
   return previewRoom(options.target)?.drawArtworkAssetPreview?.(context,options);
  }
  function applyData(next){
   if(api.canEdit?.()===false||!pixels.validate(next))return false;
   const previous=getData(),keys=new Set([...Object.keys(previous),...Object.keys(next)]),changed=[...keys].filter(key=>JSON.stringify(previous[key])!==JSON.stringify(next[key]));
   if(!changed.length)return true;
   const known=new Set(getTargets().map(target=>target.id));if(changed.some(key=>!known.has(key)))return false;
   // Each stroke addresses a single source. Keep that source's existing journal
   // authoritative, including the shared character and room undo histories.
   if(changed.every(key=>key.startsWith('character.')))return api.characters.onChange(next);
   for(const room of rooms()){
    const owned=new Set(room.getArtworkTargets().map(target=>target.id));
    if(changed.every(key=>owned.has(key)))return room.setArtworkData(next);
   }
   return api.applyRootData(next,changed)!==false;
  }
  function mount(host){
   editor=pixels.mount({host,getTargets,getSource,getData,onChange:applyData,canEdit:api.canEdit,hasAssetPreview,drawAssetPreview,onUndo:api.onUndo,onRedo:api.onRedo,getHistory:api.getHistory,onExit:api.onExit,fitOnFirstExpand:true,initialId:'background.world'});return editor;
  }
  function fragment(source,x,y){
   const patch=texture('background.world');if(!source||!patch)return source;
   const stamp=patch,cached=fragments.get(source);if(cached?.stamp===stamp&&cached.x===x&&cached.y===y)return cached.canvas;
   const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
   const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(source,0,0);const image=context.getImageData(0,0,canvas.width,canvas.height),data=image.data;
   for(const [key,runs]of Object.entries(patch.tiles)){
    const [tx,ty]=key.split(',').map(Number);
    for(const [start,length,color]of runs){const rgba=[1,3,5,7].map(offset=>parseInt(color.slice(offset,offset+2),16));
     for(let i=start;i<start+length;i++){
      const xx=tx*pixels.TILE+i%pixels.TILE-x,yy=ty*pixels.TILE+Math.floor(i/pixels.TILE)-y;
      if(xx<0||yy<0||xx>=canvas.width||yy>=canvas.height)continue;
      const at=(yy*canvas.width+xx)*4;if(!data[at+3])continue;data.set(rgba,at);
     }
    }
   }
   context.putImageData(image,0,0);fragments.set(source,{stamp,x,y,canvas});return canvas;
  }
  function effectClip(name){
   const patch=texture(originalId(name));if(!patch)return null;
   if(effectClips.has(patch))return effectClips.get(patch);
   const part=api.catalog.find(part=>part.name===name);if(!part)return null;
   const path=new Path2D();path.rect(-100000,-100000,200000,200000);
   for(const [key,runs]of Object.entries(patch.tiles)){
    const [tx,ty]=key.split(',').map(Number);
    for(const [start,length]of runs){const end=start+length;
     for(let at=start;at<end;){const count=Math.min(end-at,pixels.TILE-at%pixels.TILE);
      path.rect(part.bounds[0]+tx*pixels.TILE+at%pixels.TILE,part.bounds[1]+ty*pixels.TILE+Math.floor(at/pixels.TILE),count,1);at+=count;
     }
    }
   }
   effectClips.set(patch,path);return path;
  }
  return {mount,getTargets,getData,getSource,applyData,compose,fragment,
   objectImage:(name,source)=>compose(originalId(name),source),
   assetImage:(asset,source)=>compose('asset.'+asset.id,source,asset.artwork),
   effectClip,getEditor:()=>editor,getState:()=>editor?.getState()||null};
 };
})(window);
