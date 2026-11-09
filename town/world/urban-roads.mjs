// One shared material field supplies roads, pavements and the terrain brush.
// Keep the connectivity geometry usable by project validation without a DOM.
const urbanTextures=typeof document==='undefined'?null:(await import('./urban-materials.mjs?v=showrooms-1')).urbanTextures;
export const ROAD_SIZE=1024,ROAD_MARGIN=128,ROAD_WIDTH=768;
const directions=['north','east','south','west'];
const definition=(id,name,open)=>Object.freeze({id:'urban-road-'+id,name,w:ROAD_SIZE,h:ROAD_SIZE,open:Object.freeze(open)});
export const roadDefinitions=Object.freeze([
 definition('straight-ns','Road · straight north–south',['north','south']),
 definition('straight-ew','Road · straight east–west',['east','west']),
 definition('corner-ne','Road · corner north–east',['north','east']),
 definition('corner-se','Road · corner south–east',['south','east']),
 definition('corner-sw','Road · corner south–west',['south','west']),
 definition('corner-nw','Road · corner north–west',['north','west']),
 definition('t-north','Road · T junction north',['north','east','west']),
 definition('t-east','Road · T junction east',['north','east','south']),
 definition('t-south','Road · T junction south',['east','south','west']),
 definition('t-west','Road · T junction west',['north','south','west']),
 definition('crossroads','Road · four-way intersection',directions),
 definition('end-north','Road · dead end north',['north']),
 definition('end-east','Road · dead end east',['east']),
 definition('end-south','Road · dead end south',['south']),
 definition('end-west','Road · dead end west',['west'])
]);
export function roadFootprint(def){
 const m=ROAD_MARGIN,w=ROAD_WIDTH,n=ROAD_SIZE;
 return [{x:m,y:m,w,h:w},...def.open.map(side=>({north:{x:m,y:0,w,h:m},east:{x:n-m,y:m,w:m,h:w},south:{x:m,y:n-m,w,h:m},west:{x:0,y:m,w:m,h:w}}[side]))];
}
export function snapUrbanAsset(asset,point){
 const step=Number(asset?.snap);if(!Number.isFinite(step)||step<=0)return {...point};
 return {...point,x:Math.round(point.x/step)*step,y:Math.round(point.y/step)*step};
}
function fill(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
function material(c,name,x,y,w,h,anchorX=0,anchorY=0){
 const pattern=c.createPattern(urbanTextures[name],'repeat');pattern.setTransform(new DOMMatrix().translate(anchorX,anchorY));c.fillStyle=pattern;c.fillRect(x,y,w,h);
}
const inside=(rect,x,y)=>x>=rect.x&&x<rect.x+rect.w&&y>=rect.y&&y<rect.y+rect.h;
function curb(c,x,y,length,vertical,asphaltFirst){
 // The lip lies on the sidewalk side. Only its small cast shadow crosses the
 // asphalt; adjoining modules share the exact same end profile and joints.
 const depth=12,offset=asphaltFirst?0:-depth;
 const box=(across,along,w,h,color)=>vertical?fill(c,x+across,y+along,w,h,color):fill(c,x+along,y+across,h,w,color);
 box(offset,0,depth,length,'#a29a87');box(offset+2,0,depth-3,length,'#c6beaa');
 box(offset+2,0,2,length,'#e1d8c2');box(asphaltFirst?-4:0,0,4,length,'#24313a70');
 for(let n=0;n<length;n+=64){box(offset,n,depth,2,'#716d6299');if(n+30<length)box(offset+5,n+29,3,3,'#8a847477');}
}
function roadCurbs(c,def){
 const rects=roadFootprint(def),axis=[0,128,896,1024];
 const paved=(x,y)=>rects.some(r=>inside(r,x,y));
 for(const x of [128,896])for(let i=0;i<3;i++){
  const y=axis[i],length=axis[i+1]-y,left=paved(x-1,y+length/2),right=paved(x+1,y+length/2);
  if(left!==right)curb(c,x,y,length,true,left);
 }
 for(const y of [128,896])for(let i=0;i<3;i++){
  const x=axis[i],length=axis[i+1]-x,above=paved(x+length/2,y-1),below=paved(x+length/2,y+1);
  if(above!==below)curb(c,x,y,length,false,above);
 }
}
function paint(c,width,height,rects){
 const cv=document.createElement('canvas');cv.width=width;cv.height=height;const g=cv.getContext('2d');
 g.fillStyle='#e1ddc5';for(const r of rects)g.fillRect(r.x,r.y,r.w,r.h);
 // Tiny chips keep markings within the same native pixel density as the road.
 g.globalCompositeOperation='destination-out';g.fillStyle='#00000060';
 for(const r of rects)for(let n=0;n<Math.ceil(r.w*r.h/140);n++){
  const x=r.x+((n*43+17)%Math.max(1,r.w)),y=r.y+((n*71+9)%Math.max(1,r.h));g.fillRect(x,y,2+(n%3),1+(n%2));
 }
 c.drawImage(cv,0,0);cv.width=cv.height=1;
}
function roadMarkings(c,def){
 const lines=[];
 if(def.open.length===2&&def.open.includes('north')&&def.open.includes('south'))for(let y=0;y<1024;y+=128)lines.push({x:507,y,w:10,h:64});
 else if(def.open.length===2&&def.open.includes('east')&&def.open.includes('west'))for(let x=0;x<1024;x+=128)lines.push({x,y:507,w:64,h:10});
 else for(const side of def.open){
  if(side==='north')lines.push({x:507,y:0,w:10,h:64});
  if(side==='south')lines.push({x:507,y:896,w:10,h:64});
  if(side==='west')lines.push({x:0,y:507,w:64,h:10});
  if(side==='east')lines.push({x:896,y:507,w:64,h:10});
 }
 paint(c,1024,1024,lines);
}
function drawRoad(c,def){
 material(c,'sidewalk',0,0,1024,1024,512,1024);
 c.save();c.beginPath();for(const r of roadFootprint(def))c.rect(r.x,r.y,r.w,r.h);c.clip();material(c,'asphalt',0,0,1024,1024,512,1024);c.restore();
 roadCurbs(c,def);roadMarkings(c,def);
}
function properties(a,{snap=64,...extra}={}){Object.assign(a,{kit:'urban',snap,fixedScale:true,collisionDefault:false},extra);return a;}
export function registerUrbanRoads(add){
 if(!urbanTextures)throw Error('Street artwork needs a browser canvas.');
 for(const def of roadDefinitions){const a=add(def.id,def.name,'urban roads',1024,1024,c=>drawRoad(c,def),[],'ground');properties(a,{snap:512,roadOpen:[...def.open],road:{open:[...def.open],width:768,sidewalk:128}});}
 const sidewalk=(id,name,w,h,draw)=>properties(add(id,name,'urban sidewalks',w,h,draw,[],'ground'));
 sidewalk('urban-sidewalk-panel','Sidewalk · large concrete slab panel',512,512,c=>material(c,'sidewalk',0,0,512,512,256,512));
 sidewalk('urban-sidewalk-strip','Sidewalk · concrete slab strip',512,128,c=>material(c,'sidewalk',0,0,512,128,256,128));
 sidewalk('urban-sidewalk-corner-outside','Sidewalk · outside corner',256,256,c=>{material(c,'sidewalk',0,0,256,256,128,256);curb(c,12,0,256,true,false);curb(c,0,12,256,false,false);});
 sidewalk('urban-sidewalk-corner-inside','Sidewalk · inside L corner',256,256,c=>{material(c,'sidewalk',0,0,128,256,128,256);material(c,'sidewalk',128,128,128,128,128,256);curb(c,128,0,128,true,false);curb(c,128,128,128,false,true);});
 sidewalk('urban-curb-straight','Curb · straight limestone edge',512,32,c=>{material(c,'sidewalk',0,0,512,32,256,32);curb(c,0,16,512,false,true);});
 sidewalk('urban-curb-corner','Curb · limestone corner',128,128,c=>{curb(c,0,12,128,false,false);curb(c,12,0,128,true,false);});
 sidewalk('urban-curb-ramp','Curb · accessible sidewalk ramp',192,128,c=>{
  material(c,'sidewalk',0,0,192,128,96,128);fill(c,0,96,192,32,'#6b747a35');
  for(let y=18;y<105;y+=14)for(let x=30;x<164;x+=14){fill(c,x,y,4,4,'#93856d');fill(c,x,y,4,1,'#d9c9a7');}
  for(const x of [0,180]){fill(c,x,0,12,128,'#a29a87');fill(c,x+2,0,3,128,'#ddd2b8');}
 });
 sidewalk('urban-street-island','Sidewalk · planted street island',128,384,c=>{
  material(c,'sidewalk',0,0,128,384,64,384);fill(c,12,12,104,360,'#a29a87');material(c,'brick',20,20,88,344,64,384);
  fill(c,22,22,84,3,'#c6beaa');fill(c,22,359,84,3,'#4f4b4180');
 });
 const marking=(id,name,w,h,rects)=>properties(add(id,name,'urban markings',w,h,c=>paint(c,w,h,rects),[],'ground'));
 marking('urban-crosswalk','Crosswalk · zebra crossing',768,192,Array.from({length:12},(_,i)=>({x:8+i*64,y:8,w:40,h:176})));
 marking('urban-stop-line','Road marking · stop line',768,16,[{x:0,y:0,w:768,h:16}]);
 marking('urban-lane-dashes','Road marking · dashed lane',512,12,Array.from({length:4},(_,i)=>({x:i*128,y:1,w:64,h:10})));
 marking('urban-parking-bay','Road marking · parking bay',256,512,[{x:0,y:0,w:10,h:512},{x:0,y:0,w:256,h:10},{x:0,y:502,w:256,h:10}]);
 for(const [id,name]of [['asphalt','Asphalt road'],['sidewalk','Concrete sidewalk · large slabs'],['brick','City brick paving']])properties(add('urban-paint-'+id,'Paint '+name.toLowerCase(),'urban surfaces',256,256,c=>material(c,id,0,0,256,256,128,256),[],'ground'),{paintSurface:id});
}
