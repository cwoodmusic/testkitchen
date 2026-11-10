import {assetImage} from './asset-color.mjs?v=opera-concert-1';

// Performers belong to the programme, never to the camera or the saved town.
// Coordinates are feet on the stage; the native seated renderer uses a hip
// anchor, so that conversion happens only while drawing.
const DEFAULT_STAGE=Object.freeze({x:768,y:300,w:2560,h:900,performerBounds:Object.freeze({x:1000,y:420,w:2096,h:680})});
const SCALE=2.5,SEAT_DROP=40,TAU=Math.PI*2;
const finite=(n,fallback)=>Number.isFinite(n)?n:fallback;
const text=value=>String(value??'').toLowerCase();
const bounded=(n,min,max)=>Math.max(min,Math.min(max,n));

function programmeType(program={}){
 // The published programme calls its jazz ensemble "new-orleans-band".
 // Read every descriptor: an ensemble label must not mask category:'jazz'.
 const category=[program.kind,program.category,program.ensemble,program.genre].map(text).join(' ');
 const pianist=text(program.pianist||program.composer||program.artist||program.title);
 const solo=category.includes('piano')||category.includes('recital')||category.includes('solo');
 const kind=category.includes('jazz')||category.includes('new-orleans')?'jazz':solo?'piano':'orchestra';
 return {kind,pianist:kind==='piano'?(pianist.includes('liszt')?'liszt':pianist.includes('debussy')?'debussy':'chopin'):null};
}

// Changing recordings within an ensemble does not respawn its musicians.
export function stagePerformanceSignature(program={}){
 const {kind,pianist}=programmeType(program);
 return pianist?`${kind}:${pianist}`:kind;
}

function stageGeometry(raw={}){
 const x=finite(raw.x,DEFAULT_STAGE.x),y=finite(raw.y,DEFAULT_STAGE.y);
 const w=Math.max(600,finite(raw.w,DEFAULT_STAGE.w)),h=Math.max(420,finite(raw.h,DEFAULT_STAGE.h));
 const source=raw.performerBounds||{};
 const bx=bounded(finite(source.x,x+w*.09),x+40,x+w-300);
 const by=bounded(finite(source.y,y+120),y+100,y+h-240);
 return {x,y,w,h,performerBounds:{x:bx,y:by,w:bounded(finite(source.w,w*.82),240,x+w-40-bx),h:bounded(finite(source.h,h-220),140,y+h-70-by)}};
}

const SKINS=['#e7bd9c','#a97757','#76503e','#d6a37c','#926446','#efcab0','#b88866','#684734'];
const HAIR=['#2d2730','#66504a','#b59b7b','#45332c','#b1a99b','#3b2931','#9b6c44','#27212b'];
const HAIRSTYLES=['short','buns','curly','bob','slick','ponytail','pixie','long'];
function musicianAppearance(index,jazz=false){
 return {name:'Coda musician',skin:SKINS[jazz?2+(index%3):index%SKINS.length],hair:HAIR[(index*3)%HAIR.length],shirt:jazz?['#ded0ab','#c6b591','#ece0bd','#b8ad95'][index%4]:['#292c38','#32303d','#282b34','#393340'][index%4],lowerColor:jazz?'#3a353c':'#292b36',hairstyle:HAIRSTYLES[(index*3)%HAIRSTYLES.length],outfit:jazz?'waistcoat':index%5===1?'gown':'tuxedo',headwear:jazz&&index%3!==1?'boater':'none',headwearColor:'#d6bc85',eyewear:!jazz&&index%11===4?'round':'none',accessory:'none',shoes:'oxfords'};
}
const CHOPIN=Object.freeze({name:'Frédéric Chopin',skin:'#e7c0a4',hair:'#49312b',shirt:'#302d42',lowerColor:'#35313e',hairstyle:'long',outfit:'coat',shoes:'chelsea',accessory:'none'});
const LISZT=Object.freeze({name:'Franz Liszt',skin:'#e4c4ad',hair:'#c3bfb9',shirt:'#242631',lowerColor:'#292a35',hairstyle:'long',outfit:'coat',headwear:'none',eyewear:'none',accessory:'none',shoes:'chelsea'});
const DEBUSSY=Object.freeze({name:'Claude Debussy',skin:'#dbb695',hair:'#372e2b',shirt:'#37333c',lowerColor:'#302e37',hairstyle:'curly',outfit:'suit',headwear:'none',eyewear:'none',accessory:'none',shoes:'oxfords'});
const PIANISTS=Object.freeze({chopin:CHOPIN,liszt:LISZT,debussy:DEBUSSY});

function actor(instrument,section,index,x,y,options={}){
 const id=options.id||`concert-${section}-${index}`;
 return {id,actorId:id,name:options.name||`${section} musician ${index+1}`,instrument,section,x:Math.round(x),y:Math.round(y),facing:options.facing||'down',seated:options.seated??!['double-bass','percussion','conductor','jazz'].includes(section),walking:false,activity:'playing',phase:(index*.618)%TAU,appearance:options.appearance||musicianAppearance(index,options.jazz),...options};
}
function prop(asset,x,y,w,h,depth,role,owner){return {asset,x:Math.round(x),y:Math.round(y),w,h,depth,role,owner};}
function rowX(bounds,index,count){return bounds.x+bounds.w*(index+.5)/count;}
function attachInstruments(performance){
 const {actors,props}=performance;
 for(const a of actors){
  if(a.instrument==='cello')props.push(prop('decor-02-01',a.x+24,a.y+6,67,119,a.y+.1,'instrument',a.id));
  if(a.instrument==='double-bass')props.push(prop('decor-02-03',a.x+37,a.y+7,90,169,a.y+.1,'instrument',a.id));
  if(a.instrument==='tuba')props.push(prop('decor-04-05',a.x+19,a.y+2,84,104,a.y+.1,'instrument',a.id));
  if(a.instrument==='timpani')props.push(prop('decor-03-12',a.x,a.y+6,151,112,a.y+.1,'instrument',a.id));
  if(a.instrument==='bass-drum')props.push(prop('decor-03-09',a.x+9,a.y+6,110,112,a.y+.1,'instrument',a.id));
  if(a.instrument==='gong')props.push(prop('decor-03-16',a.x+34,a.y+4,119,142,a.y+.1,'instrument',a.id));
  // The drummer sits behind the cymbal line. Position the kit forward so
  // its high cymbals cannot cover the seated player's head and shoulders.
  if(a.instrument==='drums')props.push(prop('decor-03-07',a.x,a.y+77,197,154,a.y+.1,'instrument',a.id));
 }
}

function orchestra(performance){
 const {stage,actors,props}=performance,b=stage.performerBounds;
 const rearY=b.y+50,rowStep=(b.h-80)/5;
 const rear=[['timpani','percussion'],['bass-drum','percussion'],['gong','percussion'],['horn','brass'],['horn','brass'],['trumpet','brass'],['trumpet','brass'],['trombone','brass'],['tuba','brass']];
 rear.forEach(([instrument,section],i)=>actors.push(actor(instrument,section,actors.length,rowX(b,i,9),rearY)));
 ['flute','flute','oboe','oboe','clarinet','clarinet','bassoon','bassoon'].forEach((instrument,i)=>actors.push(actor(instrument,'woodwind',actors.length,rowX(b,i,8),rearY+rowStep)));
 // Strings form four curved desks, with basses at the right/rear. Every desk
 // has room for a bow; the clear centre lane leads to the conductor's podium.
 const rows=[
  ['violin','violin','violin','violin','viola','cello','double-bass','double-bass','double-bass'],
  ['violin','violin','violin','violin','viola','viola','cello','cello','double-bass'],
  ['violin','violin','violin','violin','viola','viola','cello','cello'],
  ['violin','violin','violin','violin','violin','violin','viola','cello']
 ];
 rows.forEach((row,r)=>row.forEach((instrument,i)=>{
  const fraction=row.length===8?(i<4?(i+.5)/9:(i+1.5)/9):(i+.5)/9;
  const x=b.x+b.w*fraction,curve=Math.abs(fraction-.5)*22;
  const section=instrument==='double-bass'?'double-bass':'strings';
  actors.push(actor(instrument,section,actors.length,x,rearY+rowStep*(r+2)-curve));
 }));
 const conductor=actor('baton','conductor',actors.length,stage.x+stage.w/2,stage.y+stage.h-40,{facing:'up',seated:false,name:'Coda conductor',appearance:{...musicianAppearance(9),shirt:'#232632',outfit:'tuxedo',hairstyle:'curly',hair:'#a8a29c'}});
 actors.push(conductor);
 props.push(prop('decor-05-07',conductor.x,conductor.y+5,139,92,conductor.y-1,'podium',conductor.id));
 // Shared scores keep the forest of stands from hiding the musicians.
 for(const a of actors)if(['strings','woodwind','brass'].includes(a.section)&&Number(a.id.split('-').at(-1))%2===0)props.push(prop('decor-05-08',a.x+43,a.y+36,55,76,a.y+1,'score',a.id));
 attachInstruments(performance);
}

function jazz(performance){
 const {stage,actors,props}=performance,b=stage.performerBounds;
 const rhythm=[['piano',.16,.44,true],['banjo',.39,.35,false],['double-bass',.64,.35,false],['drums',.86,.44,true]];
 const front=[['cornet',.21],['cornet',.40],['trombone',.61],['clarinet',.81]];
 for(const [instrument,x,y,seated] of rhythm)actors.push(actor(instrument,'jazz',actors.length,b.x+b.w*x,b.y+b.h*y,{jazz:true,seated}));
 for(const [instrument,x] of front)actors.push(actor(instrument,'jazz',actors.length,b.x+b.w*x,b.y+b.h*.88,{jazz:true,seated:false}));
 const pianist=actors.find(a=>a.instrument==='piano');
 props.push(prop('decor-03-02',pianist.x,pianist.y+21,215,204,pianist.y-1,'piano',pianist.id));
 pianist.facing='up';
 attachInstruments(performance);
}

function recital(performance){
 const {stage,actors,props,pianist}=performance,b=stage.performerBounds;
 const x=stage.x+stage.w/2,y=Math.min(stage.y+stage.h-105,b.y+b.h*.92);
 const profile=PIANISTS[pianist];
 const a=actor('piano','solo',0,x,y,{id:pianist,name:profile.name,facing:'up',seated:true,appearance:{...profile}});
 actors.push(a);
 props.push(prop('decor-03-01',x,y+22,350,350,y-1,'piano',a.id));
}

/** A deterministic, self-contained stage arrangement for one programme. */
export function createStagePerformance(program={},options={}){
 const {kind,pianist}=programmeType(program),stage=stageGeometry(options.stage||{});
 const performance={kind,pianist,signature:stagePerformanceSignature(program),programmeId:String(program.id||program.title||kind),bpm:bounded(finite(program.bpm,kind==='jazz'?124:kind==='piano'?76:92),36,220),stage,actors:[],props:[]};
 if(kind==='jazz')jazz(performance);else if(kind==='piano')recital(performance);else orchestra(performance);
 performance.assetIds=[...new Set(performance.props.map(p=>p.asset))];
 return performance;
}

let nativeRenderer;
function defaultDrawNPC(){
 if(!nativeRenderer&&typeof window!=='undefined'&&window.createCodaCharacterRenderer)nativeRenderer=window.createCodaCharacterRenderer({worldScale:SCALE});
 return nativeRenderer?.drawNPC;
}
function catalogAsset(catalog,id){return catalog?.get?.(id)||catalog?.[id];}
function propDrawBounds(p,a){
 const width=Math.max(1,finite(a?.w,p.w)),height=Math.max(1,finite(a?.h,p.h));
 const scale=Math.min(p.w/width,p.h/height),w=width*scale,h=height*scale;
 return {x:p.x-w/2,y:p.y-h,w,h,scale};
}
function drawAsset(ctx,p,catalog){
 const a=catalogAsset(catalog,p.asset);if(!a)return false;
 const image=assetImage(a);if(!image)return false;
 const b=propDrawBounds(p,a);
 ctx.drawImage(image,Math.round(b.x),Math.round(b.y),Math.round(b.w),Math.round(b.h));
 return true;
}

/** Occupied stage floor, using the same aspect-preserving fit as the artwork.
 * Instrument silhouettes above a player's head do not become invisible walls.
 * The grand piano additionally occupies the soundboard, not only its legs.
 */
export function stageCollisionBoxes(performance,{catalog}={}){
 if(!performance)return [];
 const boxes=performance.actors.map(a=>({x:a.x-22,y:a.y-18,w:44,h:28,owner:a.id,role:'performer'}));
 for(const p of performance.props){
  const a=catalogAsset(catalog,p.asset),b=propDrawBounds(p,a);
  const native=a?.boxes?.length?a.boxes:[{x:(a?.w||p.w)*.16,y:(a?.h||p.h)*.76,w:(a?.w||p.w)*.68,h:(a?.h||p.h)*.22}];
  for(const r of native)boxes.push({x:b.x+r.x*b.scale,y:b.y+r.y*b.scale,w:r.w*b.scale,h:r.h*b.scale,owner:p.owner,role:p.role,asset:p.asset});
  if(p.asset==='decor-03-01')boxes.push({x:b.x+b.w*.10,y:b.y+b.h*.39,w:b.w*.80,h:b.h*.40,owner:p.owner,role:'piano-body',asset:p.asset});
 }
 return boxes;
}
function visible(bounds,view){return !view||bounds.x+bounds.w>=view.x&&bounds.x<=view.x+view.w&&bounds.y+bounds.h>=view.y&&bounds.y<=view.y+view.h;}
function rectangle(ctx,x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));}
function pixelLine(ctx,x1,y1,x2,y2,color,width=1){
 const length=Math.max(Math.abs(x2-x1),Math.abs(y2-y1));
 if(!length){rectangle(ctx,x1,y1,width,width,color);return;}
 const steps=Math.ceil(length);ctx.fillStyle=color;
 for(let i=0;i<=steps;i++){const t=i/steps;ctx.fillRect(Math.round(x1+(x2-x1)*t),Math.round(y1+(y2-y1)*t),width,width);}
}
function hand(ctx,x,y,skin){rectangle(ctx,x,y,4,3,skin);rectangle(ctx,x+1,y,2,1,'#e8c6a0');}
function arms(ctx,a,left,right){
 const skin=a.appearance.skin,shirt=a.appearance.shirt,offset=a.seated?8:0;
 pixelLine(ctx,-11,-22+offset,left[0],left[1],shirt,4);pixelLine(ctx,11,-22+offset,right[0],right[1],shirt,4);
 hand(ctx,...left,skin);hand(ctx,...right,skin);
}
function chair(ctx,a){
 if(!a.seated||a.instrument==='piano')return;
 rectangle(ctx,a.x-24,a.y-59,48,7,'#3c3334');rectangle(ctx,a.x-21,a.y-66,42,7,'#655044');
 rectangle(ctx,a.x-22,a.y-53,5,46,'#302d36');rectangle(ctx,a.x+17,a.y-53,5,46,'#302d36');
}

function violin(ctx,a,beat){
 const o=a.seated?8:0,sway=Math.round(Math.sin(beat+a.phase)*3),v=a.instrument==='viola';
 const wood=v?'#9e623c':'#c58049';
 rectangle(ctx,1,-24+o,7,3,'#412b2b');rectangle(ctx,0,-21+o,11,8,'#422a2a');rectangle(ctx,2,-22+o,7,10,wood);
 rectangle(ctx,-1,-19+o,4,5,wood);rectangle(ctx,8,-19+o,5,6,wood);rectangle(ctx,3,-21+o,2,8,'#e3ad67');
 pixelLine(ctx,8,-21+o,18,-28+o,'#4e342d',3);rectangle(ctx,17,-29+o,5,4,'#b67b48');
 pixelLine(ctx,5,-16+o,18,-27+o,'#eadab4');rectangle(ctx,4,-18+o,1,4,'#5b372b');rectangle(ctx,9,-18+o,1,4,'#5b372b');
 arms(ctx,a,[14,-25+o],[4+sway,-14+o]);
 pixelLine(ctx,-10+sway,-28+o,18+sway,-6+o,'#6c493a',2);pixelLine(ctx,-10+sway,-27+o,18+sway,-5+o,'#ead9ba');
}
function bowedBass(ctx,a,beat){
 const o=a.seated?8:0,motion=Math.sin(beat+a.phase),bass=a.instrument==='double-bass';
 arms(ctx,a,[bass?13:9,-25+o],[10+Math.round(motion*4),-11+o]);
 pixelLine(ctx,-8+motion*4,-16+o,23+motion*4,-9+o,'#4f342c',2);pixelLine(ctx,-8+motion*4,-15+o,23+motion*4,-8+o,'#e9d9b9');
}
function woodwind(ctx,a,beat){
 const o=a.seated?8:0,tap=Math.round(Math.sin(beat*2+a.phase));
 if(a.instrument==='flute'){
  pixelLine(ctx,-5,-27+o,28,-24+o,'#8e9da7',3);pixelLine(ctx,-5,-27+o,28,-24+o,'#d4d8cb');
  for(let x=3;x<26;x+=4)rectangle(ctx,x,-25+o,1,2,'#687a89');arms(ctx,a,[2,-24+o],[18,-23+o+tap]);
 }else{
  const bassoon=a.instrument==='bassoon',wood=bassoon?'#95623d':'#34313b';
  pixelLine(ctx,0,-27+o,12,bassoon?3:-5+o,wood,bassoon?4:3);
  if(bassoon)pixelLine(ctx,12,3,17,-26+o,'#b98750',3);
  for(let y=-21+o;y<-5+o;y+=4)rectangle(ctx,4+(y+21-o)/3,y,2,1,'#c8bd9a');
  rectangle(ctx,9,-5+o,7,3,bassoon?'#5e3c2d':'#222831');arms(ctx,a,[2,-19+o+tap],[7,-11+o-tap]);
 }
}
function brass(ctx,a,beat){
 const o=a.seated?8:0,tap=Math.round(Math.sin(beat*2+a.phase)),gold='#c39b52',light='#e9cd83',ink='#5c4839';
 if(a.instrument==='tuba'){arms(ctx,a,[5,-19+o],[13,-11+o+tap]);return;}
 if(a.instrument==='horn'){
  rectangle(ctx,-1,-21+o,15,14,ink);rectangle(ctx,1,-19+o,11,10,gold);rectangle(ctx,4,-17+o,5,5,'#38323a');
  pixelLine(ctx,2,-23+o,14,-16+o,light,2);rectangle(ctx,13,-19+o,7,8,gold);rectangle(ctx,19,-21+o,3,12,light);
  arms(ctx,a,[0,-20+o],[9,-13+o+tap]);return;
 }
 const slide=a.instrument==='trombone'?13+Math.round((Math.sin(beat+a.phase)+1)*3):0;
 pixelLine(ctx,0,-27+o,22+slide,-22+o,gold,3);pixelLine(ctx,0,-28+o,22+slide,-23+o,light);
 rectangle(ctx,21+slide,-25+o,5,9,ink);rectangle(ctx,21+slide,-24+o,3,7,light);
 if(slide){pixelLine(ctx,8,-19+o,34+slide,-15+o,gold,2);pixelLine(ctx,34+slide,-15+o,34+slide,-21+o,light,2);}
 else{rectangle(ctx,6,-21+o,12,4,gold);for(const x of [7,11,15])rectangle(ctx,x,-24+o,2,6,light);}
 arms(ctx,a,[5,-22+o],[13+(slide?slide*.5:0),-20+o+tap]);
}
function banjo(ctx,a,beat){
 const sway=Math.round(Math.sin(beat*2+a.phase)*2);
 rectangle(ctx,-4,-19,15,18,'#453331');rectangle(ctx,-6,-15,19,10,'#453331');rectangle(ctx,-3,-17,13,14,'#dbc7a0');
 rectangle(ctx,-2,-15,11,10,'#eadcc0');pixelLine(ctx,7,-19,23,-34,'#79533b',4);pixelLine(ctx,7,-18,24,-34,'#d8c48d');
 for(const x of [0,3,6])rectangle(ctx,x,-15,1,10,'#b09565');arms(ctx,a,[17,-28],[2+sway,-10]);
}
function percussion(ctx,a,beat){
 const o=a.seated?8:0,lift=Math.sin(beat*2+a.phase),left=-12,right=10;
 arms(ctx,a,[left,-17+o+lift*3],[right,-17+o-lift*3]);
 pixelLine(ctx,left,-16+o+lift*3,left-8,-30+o+lift*6,'#d6b98a',2);pixelLine(ctx,right+2,-16+o-lift*3,right+10,-30+o-lift*6,'#d6b98a',2);
 if(a.instrument!=='drums'){rectangle(ctx,left-9,-32+o+lift*6,5,5,'#e6d6b5');rectangle(ctx,right+9,-32+o-lift*6,5,5,'#e6d6b5');}
}
function pianoHands(ctx,a,beat){
 const o=a.seated?8:0,tap=Math.round(Math.sin(beat*3+a.phase));
 // Facing north, forearms reach forward onto the keyboard rather than
 // dangling in the seated renderer's neutral lap pose.
 arms(ctx,a,[-8,-22+o+tap],[5,-22+o-tap]);
 for(let i=0;i<3;i++){rectangle(ctx,-8+i,-23+o+tap,1,2,a.appearance.skin);rectangle(ctx,5+i,-23+o-tap,1,2,a.appearance.skin);}
}
function conductorHands(ctx,a,beat){
 const phase=beat*.5,left=[-15+Math.sin(phase)*6,-26+Math.cos(phase)*8],right=[13+Math.cos(phase)*9,-30+Math.sin(phase)*11];
 arms(ctx,a,left,right);pixelLine(ctx,right[0]+1,right[1],right[0]+9,right[1]-16,'#f1e4c0');
}
function drawPlaying(ctx,a,clock,bpm){
 const beat=clock*bpm/60*TAU;
 ctx.save();ctx.translate(a.x,a.y-(a.seated?SEAT_DROP:0));ctx.scale(SCALE,SCALE);
 switch(a.instrument){
  case 'violin':case 'viola':violin(ctx,a,beat);break;
  case 'cello':case 'double-bass':bowedBass(ctx,a,beat);break;
  case 'flute':case 'oboe':case 'clarinet':case 'bassoon':woodwind(ctx,a,beat);break;
  case 'trumpet':case 'cornet':case 'trombone':case 'horn':case 'tuba':brass(ctx,a,beat);break;
  case 'banjo':banjo(ctx,a,beat);break;
  case 'timpani':case 'bass-drum':case 'gong':case 'drums':percussion(ctx,a,beat);break;
  case 'piano':pianoHands(ctx,a,beat);break;
  case 'baton':conductorHands(ctx,a,beat);break;
 }
 ctx.restore();
}

const bodyCaches=new WeakMap();
function bodyCache(ctx,performance,drawNPC,createCanvas){
 let entry=bodyCaches.get(performance);if(entry?.drawNPC===drawNPC)return entry.images;
 const document=ctx.canvas?.ownerDocument;
 const make=createCanvas||(document?.createElement?()=>document.createElement('canvas'):typeof OffscreenCanvas==='function'?()=>new OffscreenCanvas(156,215):null);
 if(!make)return null;
 const images=new Map();
 for(const a of performance.actors){
  const canvas=make(156,215);if(!canvas?.getContext)return null;canvas.width=156;canvas.height=215;
  const c=canvas.getContext('2d');if(!c)return null;c.imageSmoothingEnabled=false;
  drawNPC(c,{...a,x:78,y:160,activity:'',emote:'',emoteTime:.6,walking:false},0);
  images.set(a,canvas);
 }
 bodyCaches.set(performance,{drawNPC,images});return images;
}

/** Draw native character bodies once, then animate instrument-specific hands
 * and bows. This keeps a 52-person orchestra inexpensive during walk testing.
 * `time` and `audioTime` are in seconds; audioTime follows the active recording.
 */
export function renderStagePerformance(ctx,performance,options={}){
 if(!ctx||!performance)return;
 const drawNPC=options.drawNPC||defaultDrawNPC();if(typeof drawNPC!=='function')return;
 const clock=options.reducedMotion?.6:finite(options.audioTime,finite(options.time,0));
 const images=bodyCache(ctx,performance,drawNPC,options.createCanvas);
 ctx.save();ctx.imageSmoothingEnabled=false;
 const queue=[],view=options.view||options.viewport;
 for(const a of performance.actors){
  if(!visible({x:a.x-90,y:a.y-215,w:180,h:240},view))continue;
  queue.push({depth:a.y-2,draw:()=>chair(ctx,a)});queue.push({depth:a.y,draw:()=>{
  const source=images?.get(a);
  if(source)ctx.drawImage(source,Math.round(a.x-78),Math.round(a.y-(a.seated?SEAT_DROP:0)-160));
  else drawNPC(ctx,{...a,y:a.y-(a.seated?SEAT_DROP:0),emoteTime:clock,walking:false},clock);
 }});queue.push({depth:a.y+.2,draw:()=>drawPlaying(ctx,a,clock,performance.bpm)});}
 for(const p of performance.props)if(visible({x:p.x-p.w/2,y:p.y-p.h,w:p.w,h:p.h},view))queue.push({depth:p.depth,draw:()=>drawAsset(ctx,p,options.catalog)});
 // The visiting player can share the same depth sort on the stage. Callers
 // own these drawables; the performance never moves or stores them.
 for(const item of options.extraDrawables||[])if(typeof item.draw==='function'&&(!item.bounds||visible(item.bounds,view)))queue.push({depth:finite(item.y,finite(item.depth,0)),draw:()=>item.draw(ctx)});
 queue.sort((a,b)=>a.depth-b.depth);for(const item of queue)item.draw();ctx.restore();
 return {performers:performance.actors.length,props:performance.props.length};
}
