import {arcadeGeometry,drawArcade} from './arcade.mjs';
import {constructionArt,overgrowthArt,estateArt} from './detail-art.mjs';
import {estateDefinitions,estateBoxes} from './estates.mjs';
import {townArtSources,house} from '../art.mjs';
import {homeGeometry,ARCHITECTURES} from '../model.mjs';
export const sources=townArtSources(),catalog=new Map();
function add(id,name,group,w,h,draw,boxes=[],layer='objects'){const a={id,name,group,w:Math.ceil(w),h:Math.ceil(h),boxes,layer};a.draw=draw;let cached;Object.defineProperty(a,'canvas',{get(){if(!cached){cached=document.createElement('canvas');cached.width=a.w;cached.height=a.h;draw(cached.getContext('2d'));}return cached;}});catalog.set(id,a);return a;}
function sprite(group,i,name,w,boxes,layer){const s=sources[group][i],h=w*s.sh/s.sw;return add(`${group}-${i}-${w}`,name,group,w,h,c=>c.drawImage(s.image,s.sx,s.sy,s.sw,s.sh,0,0,w,h),boxes?.(w,h)||[],layer);}
['Oak','Pine','Willow','Cherry','Apple'].forEach((n,i)=>[320,480,680].forEach((w,j)=>sprite('trees',i,`${['Young','Mature','Ancient'][j]} ${n}`,w,(w,h)=>[{x:w*.45,y:h-38,w:w*.1,h:35}])));
sprite('trees',5,'Flowering shrubs',200);
['Fountain','Bench','Lamp post','Flower planter','Grand gazebo','Wishing well'].forEach((n,i)=>sprite('props',i,n,[360,150,65,130,960,180][i],(w,h)=>i===4?[{x:0,y:h-110,w:35,h:110},{x:w-35,y:h-110,w:35,h:110},{x:0,y:h-145,w:w,h:24}]:[{x:w*.15,y:h-45,w:w*.7,h:40}]));
['Piano','Sofa','Bed','Kitchen counter','Stove','Dining table','Toilet','Shower','Vanity'].forEach((n,i)=>sprite('furniture',i,n,180,(w,h)=>[{x:10,y:h*.5,w:w-20,h:h*.5}]));
['Violin sign','Musical gate decoration','Lyre window','Notice board','Luthier bench','Cello monument'].forEach((n,i)=>sprite('music',i,n,[130,240,120,180,210,220][i]));
['Grass cliff cap','Mossy boulders','Reeds','Overhanging grass','Fern overgrowth','Rock outcrop'].forEach((n,i)=>sprite('landscape',i,n,[240,240,160,240,240,300][i],null,[2,3,4].includes(i)?'overgrowth':'objects'));
for(const [plan,p]of Object.entries(ARCHITECTURES))for(let style=0;style<6;style++){const h=homeGeometry(0,100,style,plan);h.style=style;h.renderElevation=0;add(`house-${plan}-${style}`,`${p.label} · ${['Slate','Rose','Stone','Sage','Ochre','Blue'][style]}`,'houses',h.w,h.h+100,c=>house(c,h),h.parts.map(r=>({x:r.x,y:r.y+100,w:r.w,h:r.h})));}
const square=add('music-square','Music Square · complete piazza','landmarks',2400,1600,c=>c.drawImage(sources.square,0,0,2400,1600),[{x:950,y:580,w:500,h:400}],'ground');square.scene=true;square.pavingSource=sources.square;
// Replace legacy IDs in place so saved maps pick up the detailed artwork.
for(let i=0;i<6;i++){const image=overgrowthArt[i],w=[448,448,512,448,448,384][i],h=w*image.height/image.width;add(i<4?`ivy-${i}`:`overgrowth-${i}`,['Trailing ivy','Climbing roses','Wisteria swag','Honeysuckle','Laurel hedge','Woodland ferns'][i],'overgrowth',w,h,c=>c.drawImage(image,0,0,w,h),[],'overgrowth');}
for(const [i,name]of ['Oak picket fence','Timber rail fence','Musical iron fence','Limestone wall','Brick garden wall','Plaster garden wall'].entries()){const image=constructionArt[[3,3,7,0,1,2][i]],w=384,h=192;add(`construction-${i}`,name,'construction',w,h,c=>c.drawImage(image,0,0,w,h),[{x:0,y:170,w,h:22}]);}
for(const [i,finish]of ['stone','wood','brick'].entries())add(`steps-${finish}`,`${finish} stair flight`,'construction',384,336,c=>c.drawImage(constructionArt[8+i],0,0,384,336),[],'ground');
add('cliff-detail','Mossy limestone cliff section','construction',384,256,c=>c.drawImage(constructionArt[11],0,0,384,256),[{x:0,y:236,w:384,h:20}]);
for(const a of estateDefinitions){const image=estateArt[a.index];const item=add(`estate-${a.id}`,a.name,'home estates',a.size,a.size,c=>{const pad=0;c.drawImage(image,image.width*pad,image.height*pad,image.width*(1-pad*2),image.height*(1-pad*2),0,0,a.size,a.size);},estateBoxes(a),'ground');item.pavingSource=image;item.resident=a.id;item.scene=true;}

const arcade=add('coda-arcade','Coda Arcade · exact interior footprint','landmarks',arcadeGeometry.w,arcadeGeometry.h,drawArcade);arcade.polygons=arcadeGeometry.polygons;arcade.door=arcadeGeometry.door;arcade.fixedScale=true;arcade.footprint=arcadeGeometry.bounds;
