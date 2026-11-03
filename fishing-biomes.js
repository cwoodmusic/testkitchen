/* Connected fishing screens and habitat rules. No catch journals are rewritten. */
(function(root,factory){
 const layout=typeof module==='object'&&module.exports?require('./fishing-cave-layout.js'):root?.CodaFishingCaveLayout;
 const water=typeof module==='object'&&module.exports?require('./fishing-water.js'):root?.CodaFishingWater;
 const api=factory(layout,water);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaFishingBiomes=api;
})(typeof window==='undefined'?null:window,function(layout,water){
 'use strict';
 const freeze=Object.freeze,WIDTH=1000,HEIGHT=620,DEFAULT_SCREEN='lantern-lake';
 const BIOME_IDS=freeze(['cave','swamp','ocean']),ALL_METERS=freeze(['4/4','6/8','2/2']),EMPTY=freeze([]);
 const BIOMES=freeze(Object.fromEntries([
  {id:'cave',name:'Cave Lake',meter:'4/4',color:'#49e2ef',waterColor:'#082d67',fogColor:'#79d7ee',fogOpacity:0,description:'Clear crystal waters and four steady beats.'},
  {id:'swamp',name:'Underground Swamp',meter:'6/8',color:'#8de5a0',waterColor:'#183f39',fogColor:'#a6c5aa',fogOpacity:.21,description:'Misty reed beds with a swaying six-eight pulse.'},
  {id:'ocean',name:'Ocean Expanse',meter:'2/2',color:'#62c9ff',waterColor:'#073d70',fogColor:'#8fcce8',fogOpacity:.035,description:'Open blue water and broad cut-time beats.'}
 ].map(value=>[value.id,freeze({...value,meters:freeze([value.meter])})])));
 const definitions=[
  ['lantern-lake','Lantern Lake','cave',0,0,'assets/world/rhythm-fishing-cave.png'],
  ['glowstone-narrows','Glowstone Narrows','cave',0,1,'assets/world/fishing/glowstone-narrows.png'],
  ['mistfen-channel','Mistfen Channel','swamp',1,0,'assets/world/fishing/mistfen-channel.png'],
  ['mosswater-basin','Mosswater Basin','swamp',1,1,'assets/world/fishing/mosswater-basin.png'],
  ['tidegate-inlet','Tidegate Inlet','ocean',2,0,'assets/world/fishing/tidegate-inlet.png'],
  ['starlit-expanse','Starlit Expanse','ocean',2,1,'assets/world/fishing/starlit-expanse.png']
 ];
 const at=(column,row)=>definitions.find(value=>value[3]===column&&value[4]===row)?.[0]||null;
 const SCREENS=freeze(definitions.map(([id,name,biome,column,row,background])=>freeze({id,name,biome,column,row,background,neighbors:freeze({north:at(column,row-1),south:at(column,row+1),east:at(column+1,row),west:at(column-1,row)})})));
 const SCREEN_BY_ID=freeze(Object.fromEntries(SCREENS.map(screen=>[screen.id,screen]))),BIOME_BY_ID=BIOMES;
 const SHARED_FISH_IDS=freeze(['silver-minnow','cave-guppy','bluegill']),shared=new Set(SHARED_FISH_IDS),habitats=freeze({cave:freeze(['cave']),swamp:freeze(['swamp']),ocean:freeze(['ocean'])});
 const meterBiome=freeze({'4/4':'cave','6/8':'swamp','2/2':'ocean'});
 const aliases=freeze({left:'west',right:'east',up:'north',down:'south','-1':'west','1':'east',n:'north',s:'south',e:'east',w:'west'});
 const directions=freeze(['north','south','east','west']);
 const CORRIDORS=freeze({north:freeze({x:500,y:-30,width:100,height:280}),south:freeze({x:500,y:450,width:100,height:200}),east:freeze({x:800,y:300,width:230,height:100}),west:freeze({x:-30,y:300,width:330,height:100})});
 const anchors=freeze({north:freeze({x:550,y:10}),south:freeze({x:550,y:610}),east:freeze({x:990,y:350}),west:freeze({x:10,y:350})});
 const opposite=freeze({north:'south',south:'north',east:'west',west:'east'});
 const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
 const directionFor=value=>directions.includes(value)?value:Object.prototype.hasOwnProperty.call(aliases,String(value))?aliases[String(value)]:null;
 function screenFor(value){const id=typeof value==='string'?value:value?.id;return typeof id==='string'&&Object.prototype.hasOwnProperty.call(SCREEN_BY_ID,id)?SCREEN_BY_ID[id]:null;}
 function biomeFor(value){
  const id=typeof value==='string'?value:value?.biome||value?.id;
  if(typeof id!=='string')return null;
  if(Object.prototype.hasOwnProperty.call(BIOMES,id))return BIOMES[id];
  return Object.prototype.hasOwnProperty.call(SCREEN_BY_ID,id)?BIOMES[SCREEN_BY_ID[id].biome]:null;
 }
 function nextScreen(value,direction){const screen=screenFor(value),side=directionFor(direction);return screen&&side?screenFor(screen.neighbors[side]):null;}
 function availableMeters(value){return value===undefined||value===null?ALL_METERS:biomeFor(value)?.meters||EMPTY;}
 function fishHabitats(fish){
  const id=typeof fish==='string'?fish:fish?.id;if(shared.has(id))return BIOME_IDS;
  const meter=typeof fish==='object'&&fish?(fish.meter||fish.timeSignature):null,biome=Object.prototype.hasOwnProperty.call(meterBiome,meter)?meterBiome[meter]:null;
  return biome?habitats[biome]:EMPTY;
 }
 function isFishInBiome(fish,biome){const target=biomeFor(biome);return !!target&&fishHabitats(fish).includes(target.id);}
 function isWater(value,x,y){
  const screen=screenFor(value);if(!screen||!Number.isFinite(x)||!Number.isFinite(y))return false;
  if(screen.id===DEFAULT_SCREEN&&layout?.isShore(x,y))return false;
  if(water?.has(screen.id))return water.isWater(screen.id,x,y);
  const lake=layout?.LAKE||{x:550,y:350,rx:360,ry:185};
  const lakeWater=((x-lake.x)/lake.rx)**2+((y-lake.y)/lake.ry)**2<.97;
  if(screen.id===DEFAULT_SCREEN&&typeof layout?.isWater==='function'?layout.isWater(x,y):lakeWater)return true;
  return directions.some(side=>{
   if(!screen.neighbors[side])return false;const c=CORRIDORS[side];
   return x>=c.x&&x<=c.x+c.width&&y>=c.y&&y<=c.y+c.height;
  });
 }
 function isBoatWater(value,x,y){return (water?.BOAT_SAMPLES||[[0,0],[-18,0],[18,0],[0,-12],[0,12]]).every(([dx,dy])=>isWater(value,x+dx,y+dy));}
 function entryFor(side,point={}){
  if(side==='east')return freeze({x:38,y:clamp(Number.isFinite(point.y)?point.y:350,320,380)});
  if(side==='west')return freeze({x:962,y:clamp(Number.isFinite(point.y)?point.y:350,320,380)});
  if(side==='south')return freeze({x:clamp(Number.isFinite(point.x)?point.x:550,520,580),y:38});
  return freeze({x:clamp(Number.isFinite(point.x)?point.x:550,520,580),y:582});
 }
 const portalCache=new Map();
 function portalsFor(value){
  const screen=screenFor(value);if(!screen)return EMPTY;if(portalCache.has(screen.id))return portalCache.get(screen.id);
  const result=freeze(directions.filter(side=>screen.neighbors[side]).map(direction=>{
   const target=screenFor(screen.neighbors[direction]);
   return freeze({id:screen.id+'-'+direction,direction,...anchors[direction],radius:45,toId:target.id,targetId:target.id,label:target.name,name:target.name,biome:target.biome,corridor:CORRIDORS[direction],entry:entryFor(direction)});
  }));portalCache.set(screen.id,result);return result;
 }
 function portalFor(value,direction){const side=directionFor(direction);return side?portalsFor(value).find(portal=>portal.direction===side)||null:null;}
 function transitionFor(value,boat){
  const screen=screenFor(value);if(!screen||!boat||!isBoatWater(screen,boat.x,boat.y))return null;
  const side=boat.x<=26?'west':boat.x>=974?'east':boat.y<=26?'north':boat.y>=594?'south':null;
  if(!side||!screen.neighbors[side])return null;
  const target=screenFor(screen.neighbors[side]),entry=entryFor(side,boat);
  return freeze({fromId:screen.id,toId:target.id,direction:side,entry,screen:target,biome:BIOMES[target.biome],portal:portalFor(screen,side)});
 }
 return freeze({WIDTH,HEIGHT,DEFAULT_SCREEN,BIOMES,BIOME_BY_ID,BIOME_IDS,SCREENS,SCREEN_BY_ID,SHARED_FISH_IDS,CORRIDORS,screenFor,biomeFor,nextScreen,availableMeters,fishHabitats,isFishInBiome,isWater,isBoatWater,portalsFor,portalFor,transitionFor,oppositeDirection:value=>opposite[directionFor(value)]||null});
});
