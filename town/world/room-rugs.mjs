import {drawHomeMaterialRug,warmHomeMaterials} from './home-materials.mjs?v=town-victorian-2';

/** Adapt authored bitmap rugs to the editor's ordinary floor-item pipeline. */
export function createRoomRugItems(scene,catalog){
 const items=[];
 for(const [index,rug]of (scene.rugs||[]).entries()){
  if(!rug.texture)continue;
  const roomRugId=rug.id||'rug-'+index,id='room-rug-'+roomRugId;
  if(!catalog.has(id)){
   const art={texture:rug.texture,...(rug.sourceRect?{sourceRect:{...rug.sourceRect}}:{})},asset={id,name:roomRugId==='victorian-bath-rug'?'Victorian bathroom rug':'Room rug',w:rug.w,h:rug.h,boxes:[],solid:false,collisionDefault:false,layer:'ground',wallMounted:false,purpose:'rug',roomRug:true,...art};
   let canvas,painted=false;
   asset.draw=c=>drawHomeMaterialRug(c,{...art,x:0,y:0,w:asset.w,h:asset.h});
   asset.ensureFull=()=>warmHomeMaterials({assets:[],decorativeRugTexture:art.texture});
   Object.defineProperty(asset,'canvas',{configurable:true,get(){
    if(typeof document==='undefined')return null;
    if(!canvas){canvas=document.createElement('canvas');canvas.width=Math.ceil(asset.w);canvas.height=Math.ceil(asset.h);}
    if(!painted)painted=asset.draw(canvas.getContext('2d'));return canvas;
   }});
   catalog.set(id,asset);
  }
  items.push({id,asset:id,roomRugId,x:rug.x+rug.w/2,y:rug.y+rug.h,w:rug.w,h:rug.h,rotation:rug.rotation||0,solid:false,layer:'ground',wallMounted:false,collisionBoxes:[]});
 }
 return items;
}
