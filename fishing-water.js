/* Navigation follows each screen's painted shoreline, including its bays.
 * The same shoreline is shared by steering, fish movement and water effects. */
(function(root,factory){
 const data=typeof module==='object'&&module.exports?require('./fishing-water-regions.js'):root?.CodaFishingWaterRegions;
 const api=factory(data);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaFishingWater=api;
})(typeof window==='undefined'?null:window,function(data){
 'use strict';
 const WIDTH=1000,HEIGHT=620,ROW_HEIGHT=4;
 const BOAT_SAMPLES=Object.freeze([[0,0],[-18,0],[18,0],[0,-12],[0,12],[-18,-12],[18,-12],[-18,12],[18,12]].map(Object.freeze));
 const records=new Map();
 function prepare(points){
  if(!Array.isArray(points)||points.length<3||points.some(point=>!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)))throw Error('Invalid fishing shoreline.');
  const rows=[];
  // Only edges crossing a query's horizontal row can affect its ray or touch
  // its boundary. Index them once, retaining exact fractional coordinates.
  for(let i=0,j=points.length-1;i<points.length;j=i++){
   const [ax,ay]=points[j],[bx,by]=points[i],edge={ax,ay,bx,by,dx:bx-ax,dy:by-ay,left:Math.min(ax,bx),right:Math.max(ax,bx),top:Math.min(ay,by),bottom:Math.max(ay,by)};
   for(let row=Math.floor(edge.top/ROW_HEIGHT);row<=Math.floor(edge.bottom/ROW_HEIGHT);row++)(rows[row]||(rows[row]=[])).push(edge);
  }
  return {rows,left:Math.min(...points.map(point=>point[0])),right:Math.max(...points.map(point=>point[0])),top:Math.min(...points.map(point=>point[1])),bottom:Math.max(...points.map(point=>point[1]))};
 }
 if(data?.version===1&&data.width===WIDTH&&data.height===HEIGHT)for(const [id,region]of Object.entries(data.screens))records.set(id,{region,outer:prepare(region.outer),holes:(region.holes||[]).map(prepare)});
 function contains(polygon,x,y){
  if(x<polygon.left||x>polygon.right||y<polygon.top||y>polygon.bottom)return false;
  let inside=false;
  for(const edge of polygon.rows[Math.floor(y/ROW_HEIGHT)]||[]){
   const cross=(x-edge.ax)*edge.dy-(y-edge.ay)*edge.dx;
   if(Math.abs(cross)<1e-7&&x>=edge.left&&x<=edge.right&&y>=edge.top&&y<=edge.bottom)return true;
   if((edge.ay>y)!==(edge.by>y)&&x<edge.dx*(y-edge.ay)/edge.dy+edge.ax)inside=!inside;
  }
  return inside;
 }
 const key=value=>typeof value==='string'?value:value?.id;
 function isWater(value,x,y){
  const record=records.get(key(value));
  return !!record&&Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=WIDTH&&y>=0&&y<=HEIGHT&&contains(record.outer,x,y)&&!record.holes.some(hole=>contains(hole,x,y));
 }
 const isBoatWater=(value,x,y)=>BOAT_SAMPLES.every(([dx,dy])=>isWater(value,x+dx,y+dy));
 return Object.freeze({WIDTH,HEIGHT,BOAT_SAMPLES,has:value=>records.has(key(value)),regionFor:value=>records.get(key(value))?.region||null,isWater,isBoatWater});
});
