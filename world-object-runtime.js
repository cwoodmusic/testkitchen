/* Shared source-to-scene transforms for artwork, light emitters and game anchors. */
window.createCodaWorldObjects = function (api) {
  'use strict';
  const {catalog,getAssets,getAnimation}=api;
  const byName=new Map(catalog.map(part=>[part.name,part]));
  function state(name) {
    const definition=byName.get(name);if(!definition)return null;
    const asset=getAssets().find(a=>a.origin?.name===name);
    if(!asset)return {definition,asset:null,visible:true,opacity:1,matrix:[1,0,0,1,0,0]};
    const anim=getAnimation(asset),angle=asset.rotation*Math.PI/180+anim.rot;
    const [x,y,w,h]=definition.bounds,sx=asset.w/w*anim.scale,sy=asset.h/h*anim.scale;
    const a=Math.cos(angle)*sx,b=Math.sin(angle)*sx,c=-Math.sin(angle)*sy,d=Math.cos(angle)*sy;
    return {definition,asset,visible:asset.visible,opacity:asset.opacity/100*anim.alpha,
      matrix:[a,b,c,d,asset.x+anim.dx-a*(x+w/2)-c*(y+h/2),asset.y+anim.dy-b*(x+w/2)-d*(y+h/2)]};
  }
  function point(object,x,y) {const [a,b,c,d,e,f]=object.matrix;return {x:a*x+c*y+e,y:b*x+d*y+f};}
  function games(originals) {
    return originals.flatMap((game,index)=>{
      const definition=catalog.find(p=>p.gameIndex===index),object=definition&&state(definition.name);
      if(!object)return [{...game,index,npcX:game.x,npcY:323}];
      if(!object.visible)return [];
      const anchor=point(object,game.x,game.y),approach=point(object,game.x,323);
      return [{...game,...anchor,index,npcX:approach.x,npcY:approach.y}];
    });
  }
  return {state,point,games};
};
