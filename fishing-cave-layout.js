/* Foot positions match the enlarged stone landing and the painted dock. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;if(root)root.CodaFishingCaveLayout=value;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const freeze=points=>Object.freeze(points.map(point=>Object.freeze(point)));
 const LAND=freeze([[70,260],[114,244],[180,235],[212,250],[226,274],[206,301],[168,315],[108,305],[70,285]]);
 const DOCK=freeze([[100,306],[143,295],[228,373],[228,392],[159,403],[104,353]]);
 const SPAWN=Object.freeze({x:135,y:285});
 const LADDER=Object.freeze({x:100,y:270,radius:34});
 const BOARDING=Object.freeze({x:218,y:380,radius:55});
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
 const isWater=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&((x-LAKE.x)/LAKE.rx)**2+((y-LAKE.y)/LAKE.ry)**2<.97&&!isShore(x,y);
 const isBoatWater=(x,y)=>[[0,0],[-18,0],[18,0],[0,-12],[0,12]].every(([dx,dy])=>isWater(x+dx,y+dy));
 const near=(point,target)=>!!point&&Math.hypot(point.x-target.x,point.y-target.y)<target.radius;
 return {LAND,DOCK,SPAWN,LADDER,BOARDING,LAKE,contains,isShore,isWater,isBoatWater,near};
});
