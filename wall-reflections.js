/* Soft reflections of the empty backdrop on reviewed glass, below actors.
 * Projection and blur are cached; drawing never reads a live scene canvas. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaWallReflections=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const WIDTH=1672,HEIGHT=941;
 const FLOOR=Object.freeze([
  [[500,126],[1192,126],[1192,157],[1374,157],[1374,309],[1594,309],[1594,810],[859,810],[859,441],[681,441],[681,274],[500,274]],
  [[435,179],[681,179],[681,424],[435,424]],
  [[269,426],[727,426],[727,506],[269,506]],
  [[269,375],[358,375],[358,426],[269,426]],
  [[87,659],[247,659],[247,665],[185,665],[185,839],[119,839],[87,810]],
  [[724,507],[807,507],[807,806],[777,829],[728,837],[119,837],[96,812],[94,690],[174,658],[617,658],[617,649],[724,649]]
 ].map(p=>Object.freeze(p.map(Object.freeze))));
 const PROTECTED=Object.freeze([
  [[359,274],[681,274],[681,425],[359,425]],
  [[236,507],[725,507],[725,649],[236,649]],
  [[69,641],[247,641],[247,659],[69,659]],
  [[69,649],[87,649],[87,815],[69,815]],
  [[169,665],[204,665],[237,664],[271,664],[305,664],[339,664],[374,664],[408,664],[442,664],[477,664],[511,664],[545,664],[579,665],[618,665],[628,693],[639,723],[651,753],[662,784],[674,814],[685,845],[117,845],[125,814],[134,784],[143,753],[152,723],[161,693]],
  [[1419,811],[1419,783],[1427,773],[1435,767],[1517,767],[1528,776],[1535,785],[1535,812]],
  [[808,435],[860,435],[860,818],[808,818]]
 ].map(p=>Object.freeze(p.map(Object.freeze))));
 // source [x,y,w,h], floor [x,y,w,depth], strength. The contact is the
 // actual wall base, so reflections cannot float away from the architecture.
 const STRIPS=Object.freeze([
  {id:'arcade-north',source:[500,24,692,102],floor:[500,128,692,234],alpha:.20},
  {id:'piano-lab',source:[1193,15,181,140],floor:[1193,157,181,188],alpha:.10},
  {id:'hall-of-fame',source:[1380,138,211,168],floor:[1380,309,211,206],alpha:.16},
  {id:'boutique',source:[359,274,322,151],floor:[359,427,322,145],alpha:.16},
  {id:'dance-north',source:[236,510,489,138],floor:[236,650,489,166],alpha:.14},
  {id:'dance-west',source:[50,507,186,141],floor:[50,650,186,166],alpha:.14}
 ].map(item=>Object.freeze({...item,source:Object.freeze(item.source),floor:Object.freeze(item.floor)})));
 function inside(polygon,x,y){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
 }return hit;}
 function isGlassFloor(x,y){return FLOOR.some(p=>inside(p,x,y))&&!PROTECTED.some(p=>inside(p,x,y));}
 function trace(ctx,polygon){ctx.beginPath();ctx.moveTo(...polygon[0]);for(const point of polygon.slice(1))ctx.lineTo(...point);ctx.closePath();ctx.fill();}
 function create(api={}){
  const doc=api.document||(typeof document==='undefined'?null:document),cache=new WeakMap();let builds=0,error=null,lastQuality='full',active=false;
  const canvas=(width=WIDTH,height=HEIGHT)=>{const result=doc.createElement('canvas');result.width=width;result.height=height;return result;};
  function make(source){
   const output=canvas(),g=output.getContext('2d'),mask=canvas(),m=mask.getContext('2d');
   m.fillStyle='#fff';for(const polygon of FLOOR)trace(m,polygon);m.globalCompositeOperation='destination-out';for(const polygon of PROTECTED)trace(m,polygon);
   const clip=m.getImageData(0,0,WIDTH,HEIGHT);for(let at=3;at<clip.data.length;at+=4)if(clip.data[at]>0&&clip.data[at]<255){const index=(at-3)/4;clip.data[at]=isGlassFloor(index%WIDTH+.5,Math.floor(index/WIDTH)+.5)?255:0;}m.putImageData(clip,0,0);
   for(const strip of STRIPS){
    const [sx,sy,sw,sh]=strip.source,[x,y,w,depth]=strip.floor,light=canvas(sw,sh),s=light.getContext('2d',{willReadFrequently:true});
    s.drawImage(source,sx,sy,sw,sh,0,0,sw,sh);
    const pixels=s.getImageData(0,0,sw,sh),data=pixels.data;
    // Remove dark masonry before projecting. It contributes no rectangular
    // gray wash; bright colored brick edges and neon keep their real hue.
    for(let at=0;at<data.length;at+=4){const peak=Math.max(data[at],data[at+1],data[at+2]),value=Math.max(0,Math.min(1,(peak-25)/180));data[at+3]=Math.round(data[at+3]*Math.pow(value,1.5));}
    s.putImageData(pixels,0,0);
    const projection=canvas(),p=projection.getContext('2d');p.save();p.translate(x,y+depth);p.scale(1,-1);p.filter='blur(3px)';p.drawImage(light,0,0,sw,sh,0,0,w,depth);p.restore();
    p.globalCompositeOperation='destination-in';const fade=p.createLinearGradient(0,y,0,y+depth);fade.addColorStop(0,'rgba(255,255,255,.92)');fade.addColorStop(.24,'rgba(255,255,255,.72)');fade.addColorStop(.68,'rgba(255,255,255,.23)');fade.addColorStop(1,'rgba(255,255,255,0)');p.fillStyle=fade;p.fillRect(x-12,y-12,w+24,depth+24);
    g.globalAlpha=strip.alpha;g.drawImage(projection,0,0);
   }
   g.globalAlpha=1;g.globalCompositeOperation='destination-in';g.drawImage(mask,0,0);builds++;return output;
  }
  function draw(ctx,source){
   lastQuality=api.getQuality?.()||'full';active=false;
   if(!ctx||!source||!doc||lastQuality==='off'||source.complete!==undefined&&(!source.complete||!source.naturalWidth)||(source.naturalWidth||source.width)!==WIDTH||(source.naturalHeight||source.height)!==HEIGHT)return false;
   let projection=cache.get(source);
   if(projection===undefined){try{projection=make(source);error=null;}catch(reason){projection=null;error=reason?.message||String(reason);}cache.set(source,projection);}
   if(!projection)return false;
   ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=lastQuality==='lite'?.52:1;ctx.drawImage(projection,0,0);ctx.restore();active=true;return true;
  }
  return {draw,getState:()=>({active,quality:lastQuality,builds,error,regions:STRIPS.length})};
 }
 return Object.freeze({WIDTH,HEIGHT,FLOOR,PROTECTED,STRIPS,isGlassFloor,create});
});
