/* Foot positions match the top-down landing and its straight south-facing dock. */
(function(root,factory){const water=typeof module==='object'&&module.exports?require('./fishing-water.js'):root?.CodaFishingWater;const value=factory(water);if(typeof module==='object'&&module.exports)module.exports=value;if(root)root.CodaFishingCaveLayout=value;})(typeof window==='undefined'?null:window,function(water){
 'use strict';
 const freeze=points=>Object.freeze(points.map(point=>Object.freeze(point)));
 const LAND=freeze([[70,235],[330,235],[330,355],[70,355]]);
 const DOCK=freeze([[220,340],[320,340],[320,410],[220,410]]);
 const SPAWN=Object.freeze({x:135,y:285});
 const LADDER=Object.freeze({x:100,y:270,radius:34});
 const BOARDING=Object.freeze({x:270,y:395,radius:40});
 const BOAT_DOCK=Object.freeze({x:270,y:435});
 const DEPARTURE_WATER=freeze([[220,350],[400,350],[400,510],[220,510]]);
 const LAKE=Object.freeze({x:550,y:350,rx:360,ry:185});
 function contains(polygon,x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
   const [ax,ay]=polygon[j],[bx,by]=polygon[i],cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
   if(Math.abs(cross)<1e-6&&x>=Math.min(ax,bx)-1e-6&&x<=Math.max(ax,bx)+1e-6&&y>=Math.min(ay,by)-1e-6&&y<=Math.max(ay,by)+1e-6)return true;
   if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }
  return inside;
 }
 const isShore=(x,y)=>contains(LAND,x,y)||contains(DOCK,x,y);
 const isWater=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&!isShore(x,y)&&(water?.has('lantern-lake')?water.isWater('lantern-lake',x,y):((x-LAKE.x)/LAKE.rx)**2+((y-LAKE.y)/LAKE.ry)**2<.97||contains(DEPARTURE_WATER,x,y));
 const samples=water?.BOAT_SAMPLES||[[0,0],[-18,0],[18,0],[0,-12],[0,12]];
 const isBoatWater=(x,y)=>samples.every(([dx,dy])=>isWater(x+dx,y+dy));
 const near=(point,target)=>!!point&&Math.hypot(point.x-target.x,point.y-target.y)<target.radius;
 return {LAND,DOCK,SPAWN,LADDER,BOARDING,BOAT_DOCK,DEPARTURE_WATER,LAKE,contains,isShore,isWater,isBoatWater,near};
});
