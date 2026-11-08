// Road-scale fixtures reuse the town's detailed native ironwork and lantern.
// The physical anchor is the pole foot, even when an arm reaches over a road.
export const roadLightDefinitions=Object.freeze([
 {id:'urban-roadlight-heritage',name:'Tall road light · heritage lantern',w:544,h:704,variant:'single'},
 {id:'urban-roadlight-double',name:'Tall road light · double boulevard lanterns',w:640,h:704,variant:'double'},
 {id:'urban-roadlight-neon',name:'Tall road light · cyan arcade lantern',w:576,h:736,variant:'neon'}
]);
export const uplightDefinitions=Object.freeze([
 {id:'urban-uplight-warm',name:'Ground uplight · warm architectural wash',color:[255,214,151]},
 {id:'urban-uplight-cyan',name:'Ground uplight · cyan facade wash',color:[86,225,255]},
 {id:'urban-uplight-magenta',name:'Ground uplight · magenta facade wash',color:[255,97,202]}
]);

function nativeLamp(c,source,w,h,side=1,cyan=false){
 const scale=h/source.sh,post=source.sw*.28;
 c.save();c.translate(w/2,0);c.scale(side,1);
 c.drawImage(source.image,source.sx,source.sy,source.sw,source.sh,-post*scale,0,source.sw*scale,h);
 if(cyan){
  // A cool glass lens remains legible in daylight. Night bloom is rendered
  // separately so the detailed metal and native character pixels stay crisp.
  const x=(source.sw*.785-post)*scale,y=h*.345;
  c.globalCompositeOperation='screen';c.fillStyle='#48dfff8c';c.beginPath();c.ellipse(x,y,24,39,0,0,Math.PI*2);c.fill();
 }
 c.restore();
}
function lampEmitters(def){
 const ratio=247/476,arm=(.785-.28)*ratio*def.h/def.w;
 const item={v:.345,groundU:.5,groundV:1,radius:430,power:1.1,kind:'lamp'};
 return def.variant==='double'?[{...item,u:.5-arm},{...item,u:.5+arm}]:[{...item,u:.5+arm,...(def.variant==='neon'?{color:[118,230,255],radius:460}: {})}];
}
function drawUplight(c,color){
 const rgb=color.join(',');
 c.fillStyle='#17222ad9';c.beginPath();c.ellipse(38,25,34,8,0,0,Math.PI*2);c.fill();
 c.fillStyle='#27313a';c.fillRect(7,11,62,15);c.fillStyle='#71808a';c.fillRect(9,10,58,3);
 c.fillStyle='#18262b';c.fillRect(13,3,50,15);c.fillStyle='#a2a99d';c.fillRect(15,3,46,2);
 c.fillStyle=`rgb(${rgb})`;c.fillRect(21,6,34,7);c.fillStyle='#f3f6db';c.fillRect(23,6,30,2);
 c.fillStyle='#35454c';for(let x=17;x<62;x+=7)c.fillRect(x,18,3,5);
 c.fillStyle='#d3c6a0';for(const x of [12,62]){c.fillRect(x,15,2,2);c.fillRect(x,23,2,2);}
}
export function registerRoadLights(add,sources){
 const lamp=sources.props[2];
 for(const def of roadLightDefinitions){
  const a=add(def.id,def.name,'urban street lighting',def.w,def.h,c=>{
   if(def.variant==='double')nativeLamp(c,lamp,def.w,def.h,-1);
   nativeLamp(c,lamp,def.w,def.h,1,def.variant==='neon');
  },[{x:def.w/2-42,y:def.h-40,w:84,h:40}]);
  Object.assign(a,{kit:'urban',facing:'south',collisionDefault:true,lightEmitters:lampEmitters(def)});
 }
 for(const def of uplightDefinitions){
  const a=add(def.id,def.name,'urban street lighting',76,34,c=>drawUplight(c,def.color),[],'objects');
  Object.assign(a,{kit:'urban',facing:'south',collisionDefault:false,lightEmitters:[{u:.5,v:.24,kind:'uplight',color:def.color,radius:370,beamHeight:410,beamWidth:190,power:1.08}]});
 }
}
