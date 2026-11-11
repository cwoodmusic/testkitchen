import {musicSquareCollisionGeometry,musicSquareSceneParts,propCollisionBoxes,gazeboSceneParts,urbanBuildingCollision} from './scene-collision.mjs?v=family-rooms-1';
import {configureMusicWallArt,registerMusicWallAssets} from './music-wall-art.mjs?v=family-rooms-1';
import {musicSquareWalls} from './music-wall-geometry.mjs?v=family-rooms-1';
import {drawMusicSquareScene} from './music-square-entrances.mjs?v=family-rooms-1';
import {registerDecor} from './decor-pack.mjs?v=family-rooms-1';
import {registerLeisure} from './leisure-pack.mjs?v=family-rooms-1';
import {registerShowroomFurniture} from './showroom-furniture.mjs?v=family-rooms-1';
import {registerApartmentDecor} from './apartment-decor.mjs?v=family-rooms-1';
import {registerApartmentCollections} from './apartment-collections.mjs?v=family-rooms-1';
import {registerFamilyFurniture} from './family-furniture.mjs?v=family-rooms-1';
import {registerWhimsicalPlush} from './whimsical-plush.mjs?v=family-rooms-1';
import {registerLegacyFurnitureFacings} from './legacy-furniture-facings.mjs?v=family-rooms-1';
import {preparePlacedFacingArt} from './furniture-art-access.mjs?v=family-rooms-1';
import {arcadeGeometry,drawArcade} from './arcade.mjs?v=family-rooms-1';
import {constructionArt,stairArt,stairTreadBounds,overgrowthArt,estateArt,cliffDecorArt} from './detail-art.mjs?v=family-rooms-1';
import {estateDefinitions,estateBoxes} from './estates.mjs?v=family-rooms-1';
import {townArtSources,house} from '../art.mjs?v=family-rooms-1';
import {homeGeometry,ARCHITECTURES} from '../model.mjs';
import {registerUrbanDetails} from './urban-kit.mjs?v=family-rooms-1';
import {registerUrbanRoads} from './urban-roads.mjs?v=family-rooms-1';
import {registerRoadLights} from './road-light-art.mjs?v=family-rooms-1';
import {registerFestivalLights} from './festival-lights.mjs?v=family-rooms-1';
import {registerOperaBuilding} from './opera-building.mjs?v=family-rooms-1';
export const sources=townArtSources(),catalog=new Map();
function add(id,name,group,w,h,draw,boxes=[],layer='objects'){const a={id,name,group,w:Math.ceil(w),h:Math.ceil(h),boxes,layer};a.draw=draw;let cached;Object.defineProperty(a,'canvas',{configurable:true,get(){if(!cached){cached=document.createElement('canvas');cached.width=a.w;cached.height=a.h;draw(cached.getContext('2d'));}return cached;}});catalog.set(id,a);return a;}
function sprite(group,i,name,w,boxes,layer){const s=sources[group][i],h=w*s.sh/s.sw;return add(`${group}-${i}-${w}`,name,group,w,h,c=>c.drawImage(s.image,s.sx,s.sy,s.sw,s.sh,0,0,w,h),boxes?.(w,h)||[],layer);}
['Oak','Pine','Willow','Cherry','Apple'].forEach((n,i)=>[320,480,680].forEach((w,j)=>sprite('trees',i,`${['Young','Mature','Ancient'][j]} ${n}`,w,(w,h)=>[{x:w*.45,y:h-38,w:w*.1,h:35}])));
const floweringShrubs=sprite('trees',5,'Flowering shrubs',200,(w,h)=>[{x:w*.08,y:h*.57,w:w*.84,h:h*.41}]);floweringShrubs.npcAvoid=true;floweringShrubs.depthSorted=true;
['Fountain','Bench','Lamp post','Flower planter','Grand gazebo','Wishing well'].forEach((n,i)=>sprite('props',i,n,[360,150,65,130,960,180][i],(w,h)=>propCollisionBoxes(i,w,h)));
['Piano','Sofa','Bed','Kitchen counter','Stove','Dining table','Toilet','Shower','Vanity'].forEach((n,i)=>sprite('furniture',i,n,180,(w,h)=>[{x:10,y:h*.5,w:w-20,h:h*.5}]));
['Violin sign','Musical gate decoration','Lyre window','Notice board','Luthier bench','Cello monument'].forEach((n,i)=>sprite('music',i,n,[130,240,120,180,210,220][i]));
['Grass cliff cap','Mossy boulders','Reeds','Overhanging grass','Fern overgrowth','Rock outcrop'].forEach((n,i)=>sprite('landscape',i,n,[240,240,160,240,240,300][i],null,[2,3,4].includes(i)?'overgrowth':'objects'));
for(const [plan,p]of Object.entries(ARCHITECTURES))for(let style=0;style<6;style++){const h=homeGeometry(0,100,style,plan);h.style=style;h.renderElevation=0;add(`house-${plan}-${style}`,`${p.label} · ${['Slate','Rose','Stone','Sage','Ochre','Blue'][style]}`,'houses',h.w,h.h+100,c=>house(c,h),h.parts.map(r=>({x:r.x,y:r.y+100,w:r.w,h:r.h})));}
const squareGeometry=musicSquareCollisionGeometry();const square=add('music-square','Music Square · complete piazza','landmarks',2400,1600,c=>drawMusicSquareScene(c,sources.square),squareGeometry.boxes,'ground');square.polygons=squareGeometry.polygons;square.sceneParts=musicSquareSceneParts();square.scene=true;square.pavingSource=sources.square;
const gazebo=catalog.get('props-4-960');gazebo.sceneParts=gazeboSceneParts(gazebo.w,gazebo.h);
configureMusicWallArt(sources.square,constructionArt[7]);
for(const s of musicSquareWalls({x:1200,y:1600,scale:1,rotation:0})){const half=s.width/2;square.boxes.push({x:s.x-(s.dy?half:0),y:s.y-(s.dx?half:0),w:s.dx||s.width,h:s.dy||s.width});}
registerMusicWallAssets(add);
// Replace legacy IDs in place so saved maps pick up the detailed artwork.
for(let i=0;i<6;i++){const image=overgrowthArt[i],w=[448,448,512,448,448,384][i],h=w*image.height/image.width;add(i<4?`ivy-${i}`:`overgrowth-${i}`,['Trailing ivy','Climbing roses','Wisteria swag','Honeysuckle','Laurel hedge','Woodland ferns'][i],'overgrowth',w,h,c=>c.drawImage(image,0,0,w,h),[],'overgrowth');}
for(const [i,name]of ['Oak picket fence','Timber rail fence','Musical iron fence','Limestone wall','Brick garden wall','Plaster garden wall'].entries()){const image=constructionArt[[3,3,7,0,1,2][i]],w=384,h=192;add(`construction-${i}`,name,'construction',w,h,c=>c.drawImage(image,0,0,w,h),[{x:0,y:170,w,h:22}]);}
for(const finish of ['stone','wood','brick']){const image=stairArt[finish],b=stairTreadBounds(image);add(`steps-${finish}`,`${finish} stair flight`,'construction',384,336,c=>c.drawImage(image,b.x,b.y,b.w,b.h,0,0,384,336),[],'ground');}
add('cliff-detail','Mossy limestone cliff section','construction',384,256,c=>c.drawImage(constructionArt[11],0,0,384,256),[{x:0,y:236,w:384,h:20}]);
for(const a of estateDefinitions){const image=estateArt[a.index];const item=add(`estate-${a.id}`,a.name,'home estates',a.size,a.size,c=>{const pad=0;c.drawImage(image,image.width*pad,image.height*pad,image.width*(1-pad*2),image.height*(1-pad*2),0,0,a.size,a.size);},estateBoxes(a),'ground');item.pavingSource=image;item.resident=a.id;item.scene=true;}

const arcade=add('coda-arcade','Coda Arcade · exact interior footprint','landmarks',arcadeGeometry.w,arcadeGeometry.h,drawArcade);arcade.polygons=arcadeGeometry.polygons;arcade.door=arcadeGeometry.door;arcade.fixedScale=true;arcade.footprint=arcadeGeometry.bounds;arcade.interiorScale=arcadeGeometry.interiorScale;arcade.frontAtX=arcadeGeometry.frontAtX;

// Each urban building retains its real floor area under the tall facade.
// Door and collision coordinates are local canvas pixels, shared by play and
// builder walk test. Fifteen floors use the same 2304 × 1728 tower footprint.
for(const def of [
 {id:'coda-residences',name:'Coda Residences · 15-story apartments',file:'coda-residences.png',w:3014,h:4521,fw:2304,fh:1728,front:4491,kind:'tower'},
 {id:'coda-furnishings',name:'Coda Furnishings · furniture department store',file:'coda-furnishings.png',w:3354,h:2236,fw:3072,fh:2048,front:2160,kind:'shop'}
]){
 const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Urban building artwork could not load.'));i.src=new URL('../assets/urban/'+def.file,import.meta.url);});
 const footprint={x:(def.w-def.fw)/2,y:def.front-def.fh,w:def.fw,h:def.fh};
 const physical=urbanBuildingCollision(footprint,def.front);
 const a=add(def.id,def.name,'urban buildings',def.w,def.h,c=>c.drawImage(image,0,0,def.w,def.h),physical.boxes);
 a.urban=def.kind;a.fixedScale=true;a.footprint=footprint;a.door={x:def.w/2,y:def.front+20};a.frontAtX=x=>x>=physical.left&&x<=physical.right?physical.front:null;
}

for(const[i,id,name,w]of [[0,'cliff-ivy','Cliff ivy cascade',256],[1,'cliff-roses','Cliff climbing roses',240],[2,'cliff-roots','Hanging cliff roots',192],[3,'cliff-ledge','Fern-covered rock ledge',224],[4,'cliff-lantern','Cliff wall lantern',64],[5,'cliff-relief','Cliff lyre relief',128]]){const image=cliffDecorArt[i],h=w*image.height/image.width,a=add(id,name,'cliff faces',w,h,c=>c.drawImage(image,0,0,w,h));a.mountDefault=true;a.overhang=i<4;}

await registerDecor(catalog);
await registerShowroomFurniture(add);
await registerApartmentDecor(add);
await registerApartmentCollections(add);
await registerFamilyFurniture(add,catalog);
await registerWhimsicalPlush(add);
await registerLeisure(catalog);
registerUrbanRoads(add);
registerRoadLights(add,sources);
await registerFestivalLights(add,catalog);
await registerUrbanDetails(add);
await registerOperaBuilding(add);
await registerLegacyFurnitureFacings(catalog);
// Existing street furniture belongs in the city kit as well as its original
// category. Keep its saved-map ID, artwork and collision intact.
for(const a of catalog.values())if(a.urban||a.group==='street furniture'||['decor-14-01','decor-14-02','decor-14-03','decor-09-02','props-4-960','music-square','coda-arcade'].includes(a.id))a.kit='urban';
export async function preparePlacedArt(d){await preparePlacedFacingArt(d,catalog);}
