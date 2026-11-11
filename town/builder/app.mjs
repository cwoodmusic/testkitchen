import {createTownRecovery} from './recovery.mjs?v=door-price-2';
import {groundTexture} from '../world/ground-render.mjs?v=door-price-2';
import {assetFilter} from '../world/asset-color.mjs?v=door-price-2';
import {curveUnder} from '../world/round-geometry.mjs?v=door-price-2';
import {roundTerrain} from './round-terrain.mjs?v=door-price-2';
import {paintGround} from './ground-brush.mjs?v=door-price-2';
import {planWaterFill} from './water-fill.mjs?v=door-price-2';
import {planLandFill} from './land-fill.mjs?v=door-price-2';
import {planOrganicEdges} from './organic-edges.mjs?v=door-price-2';
import {createSandFootprints} from '../world/sand-footprints.mjs?v=door-price-2';
import {createAmbientNPCs} from '../world/ambient-npcs.mjs?v=door-price-2';
import {createPlayerCollisionIndex} from '../world/player-collision-index.mjs?v=door-price-2';
import {readNightPreference,saveNightPreference} from '../world/lighting-settings.mjs?v=door-price-2';
import {readNPCPreference,saveNPCPreference} from './preview-settings.mjs?v=door-price-2';
import {hitCliff,mountPose,attach,cliffFace} from '../world/cliff-mount.mjs?v=door-price-2';
import {pavingTexture} from '../world/paving.mjs?v=door-price-2';
import {planStairs,drawStairGuide} from './stairs.mjs?v=door-price-2';
import {planPier,drawPierGuide} from './piers.mjs?v=door-price-2';
import {levelColors} from '../world/elevation-view.mjs?v=door-price-2';
import {regionBetween,regionFromPolygon,regionHeightEdits,selectionCount} from './region.mjs?v=door-price-2';
import {selectElevationRegion} from './elevation-select.mjs?v=door-price-2';
import {blank,cell,height,terrainHeight,key,connect,segment,clearStairs,parseProject,History,surfaces,barriers,COLS,ROWS} from '../world/model.mjs?v=door-price-2';
import {catalog,sources,preparePlacedArt} from '../world/catalog.mjs?v=door-price-2';
import {render,resizeSurface,findStart,movePlayer,toggleGate,follow,PLAYER_SCALE,GAIT_PER_PIXEL} from '../world/runtime.mjs?v=door-price-2';
import {openDatabase,saveProject} from '../world/storage.mjs?v=door-price-2';
import {createZip} from '../../studio/zip.js';
import {createUrbanController} from '../world/urban.mjs?v=door-price-2';
import {createConcertAudio} from '../world/concert-audio.mjs?v=door-price-2';
import {mountConcertControls} from '../world/concert-controls.mjs?v=door-price-2';
import {CONCERT_PROGRAMME} from '../world/concert-programme.mjs?v=door-price-2';
import {isUrbanAsset} from '../world/urban-kit.mjs?v=door-price-2';
import {snapUrbanAsset} from '../world/urban-roads.mjs?v=door-price-2';
import {musicWallNode,planMusicWall} from '../world/music-wall-geometry.mjs?v=door-price-2';
import {cardinalFacing,facingRotation,supportsFurnitureFacing} from '../world/furniture-facing.mjs?v=door-price-2';
import {furnitureFacingPointHit,ensureFacingArt} from '../world/furniture-art-access.mjs?v=door-price-2';
const $=id=>document.getElementById(id),canvas=$('map'),ctx=canvas.getContext('2d'),history=new History(),ids=new Set(catalog.keys());let doc=blank(),tool='select',asset=catalog.keys().next().value,selected=null,region=null,hover=null,pointer=null,walk=false,player={...doc.spawn},keys=new Set(),dirty=false,saveTimer,db=null,stairPreview=null,pierPreview=null;
const character=window.createCodaCharacterRenderer({worldScale:PLAYER_SCALE});let avatar=character.normalizeProfile({}),facing='down',walking=false,walkPhase=0;addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.type==='coda-town-state-result'&&e.data.avatar)avatar=character.normalizeProfile(e.data.avatar);});if(parent!==window)parent.postMessage({type:'coda-town-state'},location.origin);
let assetTicket=0,loadingAsset=false,pendingAttach=null,libraryThumbObserver=null;
const cam={x:8192,y:6144,zoom:.45};
// All authored edits advance this hint; previews also carry a distinct document.
let terrainRevision=0;
const playerCollision=createPlayerCollisionIndex({getProject:()=>doc,catalog,getRevision:()=>terrainRevision});
let recovery=null;
let night=readNightPreference();
let npcsVisible=readNPCPreference();
const ambient=createAmbientNPCs({getProject:()=>doc,catalog,getRevision:()=>terrainRevision,getPlayer:()=>walk&&!urban.active?player:null});
const footprints=createSandFootprints({getProject:()=>doc});
function reflectFacingLabels(a){const base=facingRotation(a?.authoredFacing?a.facing:'south');for(const option of $('rotation').options){const direction=cardinalFacing(base+Number(option.value));option.textContent=direction[0].toUpperCase()+direction.slice(1);}}
function warmFacing(){const a=catalog.get(selected?.asset||asset);Promise.resolve(ensureFacingArt(a,Number($('rotation').value))).catch(()=>{});}
function reflectLighting(){const b=$('lightingToggle');b.textContent=night?'City night':'Daylight';b.setAttribute('aria-pressed',String(night));b.classList.toggle('active',night);}
$('lightingToggle').onclick=()=>{night=!night;saveNightPreference(night);reflectLighting();canvas.focus();};reflectLighting();
function reflectNPCs(){const b=$('npcToggle');b.textContent=npcsVisible?'NPCs on':'NPCs off';b.setAttribute('aria-pressed',String(npcsVisible));b.classList.toggle('active',npcsVisible);}
$('npcToggle').onclick=()=>{npcsVisible=!npcsVisible;saveNPCPreference(npcsVisible);reflectNPCs();canvas.focus();};reflectNPCs();
const urban=createUrbanController({canvas,getProject:()=>doc,getPlayer:()=>player,onConversation:(id,active,viewer)=>ambient.setConversation(id,active,viewer),getResidents:scene=>npcsVisible?(scene?ambient.interiorActors(scene):ambient.actors):[],getConcert:()=>concert,preview:true});
const concert=createConcertAudio({programme:CONCERT_PROGRAMME,getProject:()=>doc,getScene:()=>urban.scene});
mountConcertControls(concert,{canvas,onProgramme:()=>urban.showProgramme()});
const status=t=>$('status').textContent=t;
const cornerStyles=[{id:'smooth',label:'Smooth round'},{id:'rocky',label:'Rocky irregular'},{id:'bevel',label:'Beveled'}];let cornerStyleIndex=0,groundPaintShape='round';
function cycleCornerStyle(){cornerStyleIndex=(cornerStyleIndex+1)%cornerStyles.length;$('cornerStyle').textContent='Corners: '+cornerStyles[cornerStyleIndex].label+' ↻';if(tool==='round')$('hint').textContent=cornerStyles[cornerStyleIndex].label+' · brush inside or outside corners · click Round corners again to change style';}
$('cornerStyle').onclick=cycleCornerStyle;
const tools={select:'Select / move',region:'Select land',place:'Place asset',ground:'Paint ground',blend:'Blend ground',raise:'Raise ground',lower:'Lower ground',round:'Round corners',organic:'Organic edges',level:'Set level',steps:'Steps',water:'Lake / river',fillWater:'Fill water level',fillLand:'Fill land',bridge:'Bridge',pier:'Pier',fence:'Fence / wall',gate:'Gate',erase:'Erase',spawn:'Walk start',hand:'Pan'};
for(const [id,label]of Object.entries(tools)){const b=document.createElement('button');b.textContent=label;b.dataset.tool=id;b.onclick=()=>setTool(id);$('tools').append(b);}function setTool(t){if(['fillWater','fillLand'].includes(t)){selected=null;clearRegion();}if(t==='round'&&tool==='round')cycleCornerStyle();$('cornerStyle').hidden=t!=='round';$('organicSettings').hidden=t!=='organic';$('groundBrushSettings').hidden=!['ground','blend'].includes(t);pendingAttach=null;tool=t;updateGroundControls();const panel=$('inspector'),target=t==='region'?null:['place','select'].includes(t)?$('assetName'):$('buildSettingsTitle');panel.scrollTop=target?Math.max(0,target.offsetTop-panel.offsetTop-12):0;if(['place','select','ground','blend','organic'].includes(t)&&$('heightView').value==='plan'){$('heightView').value='art';$('heightLegend').hidden=true;}if(!walk)$('hint').textContent=t==='organic'?'Brush along shores or cliff edges · Strength controls irregularity · Ctrl+Z undo':t==='round'?cornerStyles[cornerStyleIndex].label+' · brush inside or outside corners · click Round corners again to change style':t==='ground'?(squareGround()?'Square tiles · drag to fill whole tiles · brush size sets tile width':'Round brush · drag to paint · adjust size, hardness and opacity'):t==='blend'?'Blend brush · drag across material edges · opacity controls strength':t==='fillWater'?'Click ground to fill the connected area at that height · Ctrl+Z undo':t==='fillLand'?'Click land or water to replace its connected material · other materials and height changes stop the fill · Ctrl+Z undo':['fence','gate'].includes(t)&&$('barrier').value==='music-square'?'Drag from a Music Square wall to extend it · follow the gold snap marker · release to finish':t==='pier'?'Drag from shore to build a supported pier · brush size sets deck width · Terrain level sets height when starting on water':t==='steps'?'Drag between lower and higher ground · width and finish set in Build settings':t==='region'?($('selectionShape').value==='elevation'?'Click a land patch · select its connected elevation or enclosed yard · water, walls and closed gates stop selection · Escape clears':$('selectionShape').value==='freeform'?'Draw a freeform boundary · release to select · Escape clears':'Drag a land rectangle · use Raise / Lower selected land · Escape clears'):'Drag to paint · right drag to pan · wheel to zoom';document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));if(t==='fillLand')reflectFillMaterial();}setTool('select');
for(const [id,values]of [['surface',surfaces.filter(s=>s!=='water')],['barrier',barriers]])for(const value of values){const o=document.createElement('option');o.value=value;o.textContent=id==='surface'?({asphalt:'Asphalt road',sidewalk:'Concrete sidewalk · large slabs',brick:'City brick paving'}[value]||value):value==='music-square'?'Music Square wall':value;$(id).append(o);}
function squareGround(){return tool==='ground'&&groundPaintShape==='square';}
function groundWidth(){return Math.max(1,Math.min(15,Math.round(Number($('brush').value)||1)));}
function updateGroundControls(){
 const square=squareGround();$('groundShape').value=tool==='blend'?'round':groundPaintShape;$('groundShape').disabled=tool==='blend';$('softGroundControls').hidden=square;
 $('groundBrushHelp').textContent=square?'Square tiles fill the complete tile at full strength. Sidewalks automatically join and add outside curbs. Brush size sets the number of tiles across.':'Paint with a round, soft-edged brush. Blend ground softens existing material transitions. Water uses Lake / river.';
 $('brush').min=square?'1':'.25';$('brush').step=square?'1':'.25';if(square)$('brush').value=groundWidth();
}
$('groundShape').onchange=()=>{groundPaintShape=$('groundShape').value;updateGroundControls();if(tool==='ground')$('hint').textContent=squareGround()?'Square tiles · drag to fill whole tiles · brush size sets tile width':'Round brush · drag to paint · adjust size, hardness and opacity';};
$('brush').addEventListener('change',()=>{if(squareGround())$('brush').value=groundWidth();});
function reflectFillMaterial(){if(tool==='fillLand')$('hint').textContent='Fill land: '+($('surface').selectedOptions[0]?.textContent||'grass')+' · click land or water to fill its connected material · Ctrl+Z undo';}
$('surface').addEventListener('change',reflectFillMaterial);$('paving').addEventListener('change',reflectFillMaterial);
$('edgeStrength').oninput=()=>{$('edgeStrengthValue').textContent=$('edgeStrength').value+'%';};$('edgeStrength').oninput();
for(const id of ['brushHardness','brushOpacity']){$(id).oninput=()=>{$(id+'Value').textContent=$(id).value+'%';};$(id).oninput();}
for(const a of catalog.values())if(a.pavingSource){const o=document.createElement('option');o.value=a.id;o.textContent=a.name;$('paving').append(o);}
for(const group of new Set([...catalog.values()].map(a=>a.group))){const o=document.createElement('option');o.value=group;o.textContent=group+' ('+[...catalog.values()].filter(a=>a.group===group).length+')';$('category').append(o);}
const urbanOption=document.createElement('option');urbanOption.value='@urban';urbanOption.textContent='Urban kit · buildings, streets & details';$('category').insertBefore(urbanOption,$('category').children[1]);
const isLeisureAsset=a=>a.group==='picnic'||a.group==='beach';
const leisureOption=document.createElement('option');leisureOption.value='@leisure';leisureOption.textContent='Picnic & beach · '+[...catalog.values()].filter(isLeisureAsset).length+' assets';$('category').insertBefore(leisureOption,$('category').children[2]);
function paintUrbanSurface(a){
 asset=a.id;selected=null;loadingAsset=false;$('surface').value=a.paintSurface;groundPaintShape='square';$('brush').value=a.paintSurface==='asphalt'?12:a.paintSurface==='sidewalk'?2:4;setTool('ground');status(a.name+' · drag to paint · choose Square tiles or Round soft brush');
}
function library(){
 const list=$('library'),category=$('category').value,terms=$('search').value.toLowerCase().trim().split(/\s+/).filter(Boolean);list.replaceChildren();
 libraryThumbObserver?.disconnect();const painters=new WeakMap();
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){painters.get(entry.target)?.();painters.delete(entry.target);observer.unobserve(entry.target);}},{rootMargin:'160px'}):null;libraryThumbObserver=observer;
 $('urbanKitHelp').hidden=category!=='@urban'&&!category.startsWith('urban ');
 $('leisureKitHelp').hidden=category!=='@leisure';
 $('assetLibraryTitle').textContent=category==='@leisure'?'Picnic & beach · '+[...catalog.values()].filter(isLeisureAsset).length:'Asset library · '+catalog.size;
 $('search').placeholder=category==='@leisure'?'Search blankets, baskets, beach chairs…':'Search roads, sidewalks, hydrants…';
 for(const[id,value]of [['urbanKit','@urban'],['leisureKit','@leisure'],['allAssets','']])$(id).classList.toggle('active',category===value);
 for(const a of catalog.values()){
  if(category&&(category==='@urban'?!isUrbanAsset(a):category==='@leisure'?!isLeisureAsset(a):a.group!==category))continue;
  const searchable=(a.name+' '+a.group+' '+a.id).toLowerCase();if(!terms.every(term=>searchable.includes(term)||term.length>2&&term.endsWith('s')&&searchable.includes(term.slice(0,-1))))continue;
  const b=document.createElement('button');b.className='asset';b.title=a.name+(a.snap?' · snaps to the street grid':'');b.dataset.asset=a.id;
  const thumb=document.createElement('canvas');thumb.width=100;thumb.height=85;const paint=()=>{const c=thumb.getContext('2d'),view=a.getFacingView?.('south',{image:false}),w=view?.w||a.w,h=view?.h||a.h,s=Math.min(100/w,85/h);c.save();c.translate((100-w*s)/2,(85-h*s)/2);c.scale(s,s);c.filter=assetFilter(a);a.draw(c);c.restore();};if(observer){painters.set(thumb,paint);observer.observe(thumb);}else paint();b.append(thumb,document.createTextNode(a.name));
  b.onclick=async()=>{
   const ticket=++assetTicket;if(a.barrierStyle){chooseMusicWalls();return;}if(a.paintSurface){paintUrbanSurface(a);return;}
   asset=a.id;selected=null;if(a.authoredFacing)$('rotation').value='0';$('assetName').textContent=a.name;reflectFacingLabels(a);$('mountSurface').value=a.mountDefault?'cliff':'ground';$('mountSurface').disabled=!!(a.scene||a.fixedScale);$('mountHeight').disabled=true;$('layer').value=a.layer;$('collision').checked=a.collisionDefault??(a.boxes.length>0||!!a.polygons?.length);$('collision').disabled=!!a.mountDefault;$('scale').disabled=!!a.fixedScale;if(a.fixedScale)$('scale').value=1;setTool('place');
   if(a.snap)$('hint').textContent='Click to place · street pieces snap to the grid · choose Rotation to turn a piece';
   loadingAsset=!!a.ensureFull;if(loadingAsset){status('Loading '+a.name+'…');try{await ensureFacingArt(a,Number($('rotation').value));if(ticket===assetTicket){loadingAsset=false;status('Ready to place '+a.name);}}catch(e){if(ticket===assetTicket){loadingAsset=false;status(e.message);setTool('select');}}}
  };list.append(b);
 }
}
function showKit(category){$('category').value=category;$('search').value='';library();}
$('urbanKit').onclick=()=>showKit('@urban');$('leisureKit').onclick=()=>showKit('@leisure');$('allAssets').onclick=()=>showKit('');$('search').oninput=library;$('category').onchange=library;
const initialKit=new URLSearchParams(location.search).get('kit');if(initialKit==='urban')$('category').value='@urban';else if(initialKit==='leisure')$('category').value='@leisure';
library();
function changed(){terrainRevision++;dirty=true;clearTimeout(saveTimer);status('Saving locally…');saveTimer=setTimeout(saveLocal,350);}
function checkpoint(){history.record(doc);}
function chooseMusicWalls(){++assetTicket;loadingAsset=false;selected=null;clearRegion();$('barrier').value='music-square';setTool('fence');status('Music Square stone wall · start a drag near an existing wall or pillar');}
$('musicWalls').onclick=chooseMusicWalls;
$('barrier').onchange=()=>{if(['fence','gate'].includes(tool))setTool(tool);};
function paintMusicWall(p){
 const previous=pointer.musicNode,node=musicWallNode(doc,p,previous,{radius:previous?24:96,existingRadius:previous?24:32});if(!node)return;
 if(previous){const edits=planMusicWall(previous,node,tool==='gate').filter(([k,e])=>{const old=doc.edges[k];return !old||old.style!==e.style||old.gate!==e.gate||old.open!==e.open||(old.wallScale||1)!==e.wallScale;});
  if(edits.length){if(!pointer.musicRecorded){checkpoint();pointer.musicRecorded=true;}Object.assign(doc.edges,Object.fromEntries(edits));changed();}
 }
 pointer.musicNode=node;
}
function drawMusicWallGuide(c,width,heightPixels){
 if(walk||!hover||!['fence','gate'].includes(tool)||$('barrier').value!=='music-square')return;
 const previous=pointer?.musicNode,p=musicWallNode(doc,hover.p,previous,{radius:previous?24:96,existingRadius:previous?24:32});if(!p)return;
 c.save();c.translate(width/2,heightPixels/2);c.scale(cam.zoom,cam.zoom);c.translate(-cam.x,-cam.y);const y=p.y-($('heightView').value==='plan'?0:height(doc,p.x,p.y));c.strokeStyle=p.anchor?'#ffe1a0':'#d6e0c5';c.fillStyle=p.anchor?'#ffe1a033':'#d6e0c522';c.lineWidth=2/cam.zoom;c.beginPath();c.arc(p.x,y,8/cam.zoom,0,Math.PI*2);c.fill();c.stroke();
 if(p.anchor){c.font=`12px system-ui`;c.scale(1/cam.zoom,1/cam.zoom);c.fillStyle='#17291fe8';const text=p.baked?'Attach to Music Square':'Join wall';const x=p.x*cam.zoom+12,Y=y*cam.zoom-12;c.fillRect(x-4,Y-14,c.measureText(text).width+8,20);c.fillStyle='#ffe1a0';c.fillText(text,x,Y);}
 c.restore();
}
$('cliffMount').onclick=()=>{$('category').value='cliff faces';$('search').value='';library();$('library').querySelector('[data-asset="cliff-ivy"]')?.click();};
$('mountSurface').onchange=()=>{pendingAttach=null;$('mountHeight').disabled=$('mountSurface').value!=='cliff'||!selected?.mount;$('collision').disabled=$('mountSurface').value==='cliff';if(selected&&$('mountSurface').value==='ground'&&selected.mount){checkpoint();selected.y=(selected.mount.y+1)*64+16;delete selected.mount;changed();}else if($('mountSurface').value==='cliff'){if($('heightView').value==='plan'){$('heightView').value='art';$('heightLegend').hidden=true;}if(selected&&!selected.mount){setTool('select');pendingAttach=selected;status('Click an exposed cliff face to attach the selected asset.');}else status('Place or drag the asset onto an exposed south-facing cliff face.');}};
$('mountHeight').oninput=()=>{$('mountHeightLabel').textContent=$('mountHeight').value+'%';};$('mountHeight').onchange=()=>{if(selected?.mount){checkpoint();selected.mount.v=Number($('mountHeight').value)/100;changed();}};

function showRegion(){const count=selectionCount(region);$('regionInfo').textContent=region?.preview?'Drawing freeform boundary · release to select':region?region.shape==='elevation'?`Elevation / enclosed area · Level ${region.level} · ${count.toLocaleString()} land tiles selected`:region.shape==='freeform'?`Freeform · ${count} tiles selected`:`${region.x1-region.x0+1} × ${region.y1-region.y0+1} tiles · ${count} selected`:'Choose Select land, then click an elevation area or draw a rectangle / freeform boundary.';for(const id of ['raiseRegion','lowerRegion'])$(id).disabled=!count||!!region?.preview;$('clearRegion').disabled=!region;}
$('selectionShape').onchange=()=>{setTool('region');selected=null;};
function selectElevationAt(p){
 if($('heightView').value!=='plan'&&hover?.face){clearRegion();status('Click a flat land surface to select its elevation area.');return;}
 region=selectElevationRegion(doc,p);showRegion();
 status(region?`Level ${region.level} · ${selectionCount(region).toLocaleString()} land tiles selected · bounded by height changes, water, walls and closed gates.`:'Click dry, flat land to select an elevation area. Water and stairs are boundaries.');
}
function updateLasso(p,finish=false){
 let points=pointer.regionPoints;const last=points[points.length-1];
 if(finish||Math.hypot(p.x-last.x,p.y-last.y)>=8){if(points.length>=4096){points=points.filter((_,i)=>i%2===0);pointer.regionPoints=points;}points.push({x:p.x,y:p.y});}
 region=regionFromPolygon(points,{preview:!finish});showRegion();
}
function clearRegion(){region=null;showRegion();}
function refreshRegionLevel(){if(region?.shape==='elevation')region={...region,level:terrainHeight(doc,region.seed.x,region.seed.y)/48};showRegion();}
function adjustRegion(delta){if(walk)return;const edits=regionHeightEdits(doc,region,delta);if(!edits.length){status('Selected land is already at the height limit.');return;}checkpoint();for(const [k,a]of edits)doc.cells[k]=a;if(region.shape==='elevation')refreshRegionLevel();changed();}
$('raiseRegion').onclick=()=>adjustRegion(1);$('lowerRegion').onclick=()=>adjustRegion(-1);$('clearRegion').onclick=clearRegion;
$('selectLand').onclick=()=>{setTool('region');selected=null;};$('selectAllLand').onclick=()=>{$('selectionShape').value='rectangle';setTool('region');selected=null;region=regionBetween({x:0,y:0},{x:COLS-1,y:ROWS-1});showRegion();};
for(let i=0;i<levelColors.length;i++){const s=document.createElement('span');s.textContent=i;s.style.background=levelColors[i];$('levelSwatches').append(s);}$('heightView').onchange=()=>{$('heightLegend').hidden=$('heightView').value==='art';};

async function saveLocal(){if(recovery?.writeBlocked){status('Browser save is protected. Use Recover map or Save project to keep this tab’s work.');return;}try{if(!db)throw Error('Local database unavailable');await saveProject(db,doc);dirty=false;status('Saved in this browser · '+doc.objects.length+' assets');}catch(e){status('Local save failed — use Save project to keep your work.');}}
recovery=createTownRecovery({getDatabase:()=>db,getProject:()=>doc,ids,prepare:preparePlacedArt,download,status,install:(next,{initial=false,fit=true}={})=>{if(!initial)checkpoint();clearTimeout(saveTimer);doc=next;terrainRevision++;selected=null;clearRegion();$('name').value=doc.name;dirty=false;if(fit){cam.x=COLS*32;cam.y=ROWS*32;cam.zoom=Math.min(canvas.clientWidth/(COLS*64),canvas.clientHeight/(ROWS*64))*.95;}}});
let databaseError;try{db=await openDatabase();}catch(e){databaseError=e;}
await recovery.loadInitial(databaseError);$('name').value=doc.name;
$('name').onchange=()=>{checkpoint();doc.name=$('name').value||'My Coda Town';changed();};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
$('save').onclick=()=>download(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}),'coda-town.json');
$('open').onclick=()=>$('file').click();$('file').onchange=async()=>{try{const f=$('file').files[0];if(!f)return;const next=parseProject(await f.text(),ids);await recovery.replace(next);}catch(e){status(e.message);}$('file').value='';};
$('new').onclick=()=>{if((doc.objects.length||Object.keys(doc.cells).length||Object.keys(doc.edges).length)&&!confirm('Start a blank map? Save project first if you want a separate backup. Undo can restore this map.'))return;checkpoint();doc=blank();selected=null;clearRegion();$('name').value=doc.name;changed();};
$('undo').onclick=()=>{doc=history.back(doc);selected=null;$('name').value=doc.name;refreshRegionLevel();changed();};$('redo').onclick=()=>{doc=history.forward(doc);selected=null;refreshRegionLevel();changed();};
function png(c){return new Promise(resolve=>c.toBlob(resolve,'image/png'));}
async function assetPNG(a,direction='south'){await a.ensureFull?.(direction);const view=a.getFacingView?.(direction),c=document.createElement('canvas');c.width=Math.ceil(view?.w||a.w);c.height=Math.ceil(view?.h||a.h);const g=c.getContext('2d');g.filter=assetFilter(a);if(view)g.drawImage(a.getFacingImage(direction),0,0,c.width,c.height);else a.draw(g);const blob=await png(c);c.width=c.height=1;return blob;}
async function exportAssetPack(urbanOnly=false){
 $('pack').disabled=true;$('urbanPack').disabled=true;
 try{
  const assets=[...catalog.values()].filter(a=>!urbanOnly||isUrbanAsset(a));status('Packing artwork and collision metadata…');const entries=[],meta=[];
  for(const a of assets){
   entries.push({name:`assets/${a.id}.png`,data:await assetPNG(a)});
   meta.push({id:a.id,name:a.name,width:a.w,height:a.h,anchor:{x:a.w/2,y:a.h},mountAnchor:{x:a.w/2,y:a.h/2},collision:a.boxes,polygons:a.polygons||[],fixedScale:!!a.fixedScale,interiorScale:a.interiorScale||1,footprint:a.footprint||null,door:a.door||null,paving:a.pavingSource?{texture:`ground/paving-${a.id}.png`}:null,layer:a.layer,resident:a.resident||null,urban:a.urban||null,kit:a.kit||null,snap:a.snap||null,paintSurface:a.paintSurface||null,barrierStyle:a.barrierStyle||null,lightEmitters:a.lightEmitters||null,wallMounted:!!a.wallMounted,purpose:a.purpose||null,connections:a.roadOpen||null,scene:!!a.scene,mountDefault:!!a.mountDefault,facing:a.facing||'south'});
   if(supportsFurnitureFacing(a)){const facings={};for(const direction of ['south','west','north','east']){const view=a.getFacingView(direction,{image:false});if(!view)continue;const actual=view.facing||direction,image=direction==='south'?`assets/${a.id}.png`:`assets/facings/${a.id}-${actual}.png`;if(direction!=='south')entries.push({name:image,data:await assetPNG(a,direction)});facings[actual]={image,width:view.w,height:view.h,footCenter:view.footCenter,rotation:facingRotation(direction),motion:view.motion||null};}meta.at(-1).facings=facings;}
  }
  for(const surface of surfaces)entries.push({name:`ground/${surface}.png`,data:await png(surface==='cobble'?pavingTexture():groundTexture(surface))});
  for(const a of assets)if(a.pavingSource)entries.push({name:`ground/paving-${a.id}.png`,data:await png(pavingTexture(a.id))});
  entries.push({name:'catalog.json',data:new Blob([JSON.stringify(meta,null,2)])},{name:'README.txt',data:new Blob(['Coda Town artwork. Positions and collision use the original physical asset dimensions and bottom-center anchor. The facings records specify separate artwork dimensions and floor centers, including South. Align a facing footCenter to the rotated center of the original collision bounds (or original anchor for assets without collision), then apply the placement scale; the PNG bottom edge is not the floor anchor. Street connections, snap grid and ground material shortcuts are listed in catalog.json. Roads, sidewalks, manholes and markings are walkable. Street props and buildings include physical collision. Asphalt, sidewalk and brick paint use the same native textures as the modular street assets. Music Square is a complete ground scene; use the fence tool for editable barriers.'])});
  download(await createZip(entries),urbanOnly?'coda-urban-assets.zip':'coda-town-assets.zip');status((urbanOnly?'Urban kit':'Asset pack')+' downloaded · '+assets.length+' assets');
 }catch(e){status('Asset export failed: '+e.message);}finally{$('pack').disabled=false;$('urbanPack').disabled=false;}
}
$('pack').onclick=()=>exportAssetPack();$('urbanPack').onclick=()=>exportAssetPack(true);
function select(o){selected=o;if(!o)return;$('inspector').scrollTop=Math.max(0,$('assetName').offsetTop-$('inspector').offsetTop-12);$('mountSurface').disabled=!!(catalog.get(o.asset).scene||catalog.get(o.asset).fixedScale);$('mountSurface').value=o.mount?'cliff':'ground';$('mountHeight').disabled=!o.mount;$('collision').disabled=!!o.mount;if(o.mount){$('mountHeight').value=Math.round(o.mount.v*100);$('mountHeightLabel').textContent=$('mountHeight').value+'%';}$('scale').disabled=!!catalog.get(o.asset).fixedScale;$('assetName').textContent=catalog.get(o.asset).name;reflectFacingLabels(catalog.get(o.asset));for(const id of ['scale','rotation','layer'])$(id).value=o[id];$('collision').checked=o.collision;}
for(const id of ['scale','rotation','layer','collision'])$(id).onchange=()=>{if(id==='rotation')warmFacing();if(!selected)return;checkpoint();selected[id]=id==='collision'?$(id).checked:id==='layer'?$(id).value:Number($(id).value);selected.scale=Math.max(.25,Math.min(3,selected.scale));changed();};
$('delete').onclick=()=>{if(selected){checkpoint();doc.objects=doc.objects.filter(o=>o!==selected);selected=null;changed();}};$('duplicate').onclick=()=>{if(selected){checkpoint();const step=catalog.get(selected.asset).snap||64,o={...selected,id:crypto.randomUUID(),x:Math.min(COLS*64,selected.x+step),y:Math.min(ROWS*64,selected.y+step)};if(o.mount){const m={...o.mount,x:o.mount.x+1};attach(o,cliffFace(doc,m.x,m.y)?m:{...o.mount,u:(o.mount.u+.3)%1});}doc.objects.push(o);select(o);changed();}};
function placement(p){p=snapUrbanAsset(catalog.get(asset),p);p={x:Math.max(0,Math.min(COLS*64,p.x)),y:Math.max(0,Math.min(ROWS*64,p.y))};const o={id:crypto.randomUUID(),asset,x:p.x,y:p.y,scale:catalog.get(asset).fixedScale?1:Math.max(.25,Math.min(3,Number($('scale').value)||1)),rotation:Number($('rotation').value),layer:$('layer').value,collision:$('collision').checked};if($('mountSurface').value==='cliff'){const m=hover?.face;if(!m)return null;attach(o,m);const a=catalog.get(o.asset),f=cliffFace(doc,m.x,m.y);if(!a.overhang)o.scale=Math.max(.25,Math.min(o.scale,f.depth/a.h));}return o;}
function screen(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left-r.width/2)/cam.zoom+cam.x,y:(e.clientY-r.top-r.height/2)/cam.zoom+cam.y};}
function world(e){const p=screen(e);if($('heightView').value==='plan'&&!walk)return p;for(let y=Math.floor((p.y+432)/64);y>=Math.floor(p.y/64);y--){const x=Math.floor(p.x/64),a=cell(doc,x,y),z=(a.pier?.level??a.level)*48;if(p.y>=y*64-z&&p.y<(y+1)*64-z&&(!a.curves||Math.abs(height(doc,p.x,p.y+z)-z)<.1))return {x:p.x,y:p.y+z};for(const q of a.curves||[]){const z=curveUnder(doc,q).level*48,Y=p.y+z;if(Y>=y*64&&Y<(y+1)*64&&Math.abs(height(doc,p.x,Y)-z)<.1)return {x:p.x,y:Y};}}return p;}
function pick(p){return [...doc.objects].reverse().find(o=>{const a=catalog.get(o.asset),pose=mountPose(doc,o);if(!pose)return false;
 const facingHit=furnitureFacingPointHit(a,o,pose,p);if(facingHit!==null)return facingHit;
 const r=-o.rotation*Math.PI/180,dx=(p.x-pose.x)/o.scale,dy=(p.y-pose.y)/o.scale,x=dx*Math.cos(r)-dy*Math.sin(r)+a.w/2,y=dx*Math.sin(r)+dy*Math.cos(r)+a.h*pose.offset;return x>=0&&y>=0&&x<a.w&&y<a.h&&a.canvas.getContext('2d').getImageData(Math.floor(x),Math.floor(y),1,1).data[3]>40;});}
function groundOptions(){return {size:Math.max(16,Math.min(960,Number($('brush').value)*64||64)),hardness:Number($('brushHardness').value)/100,opacity:Number($('brushOpacity').value)/100,surface:$('surface').value,paving:$('paving').value,mode:tool==='blend'?'blend':'paint'};}
function squareGroundDab(p){
 const width=groundWidth(),radius=Math.floor(width/2),cx=Math.floor(p.x/64),cy=Math.floor(p.y/64),edits=[];
 for(let y=cy-radius;y<cy-radius+width;y++)for(let x=cx-radius;x<cx-radius+width;x++){
  const k=key(x,y);if(x<0||y<0||x>=COLS||y>=ROWS||pointer.seen.has(k))continue;pointer.seen.add(k);
  const a=cell(doc,x,y);if(a.stairs||a.bridge||a.surface==='water')continue;
  const surface=$('surface').value,paving=surface==='cobble'?$('paving').value:undefined;
  const sidewalkCurb=surface==='sidewalk';
  if(a.surface===surface&&a.paving===paving&&!a.paint&&(a.sidewalkCurb===true)===sidewalkCurb)continue;
  const next={...a,surface};delete next.paint;if(sidewalkCurb)next.sidewalkCurb=true;else delete next.sidewalkCurb;if(paving)next.paving=paving;else delete next.paving;edits.push([k,next]);
 }
 if(!edits.length)return;if(!pointer.groundRecorded){checkpoint();pointer.groundRecorded=true;}
 for(const[k,a]of edits)doc.cells[k]=a;changed();
}
function squareGroundStroke(p){
 const from=pointer.groundLast||p;pointer.groundLast={...p};squareGroundDab(from);
 let x=Math.floor(from.x/64),y=Math.floor(from.y/64);const endX=Math.floor(p.x/64),endY=Math.floor(p.y/64),dx=p.x-from.x,dy=p.y-from.y,sx=Math.sign(dx),sy=Math.sign(dy);
 let tx=sx?((x+(sx>0?1:0))*64-from.x)/dx:Infinity,ty=sy?((y+(sy>0?1:0))*64-from.y)/dy:Infinity;
 const stepX=sx?64/Math.abs(dx):Infinity,stepY=sy?64/Math.abs(dy):Infinity;
 for(let guard=0;(x!==endX||y!==endY)&&guard<1024;guard++){
  if(Math.abs(tx-ty)<1e-10){squareGroundDab({x:(x+sx+.5)*64,y:(y+.5)*64});x+=sx;y+=sy;tx+=stepX;ty+=stepY;}
  else if(tx<ty){x+=sx;tx+=stepX;}else{y+=sy;ty+=stepY;}
  squareGroundDab({x:(x+.5)*64,y:(y+.5)*64});
 }
}
function groundDab(p){const result=tool==='organic'?planOrganicEdges(doc,p,{size:groundOptions().size,strength:Number($('edgeStrength').value)/100}):paintGround(doc,p,groundOptions());if(!result.changed&&!result.edits.length)return;if(!pointer.groundRecorded){checkpoint();pointer.groundRecorded=true;}for(const[k,a]of result.edits)doc.cells[k]=a;changed();}
function groundStroke(p,finish=false){
 if(squareGround()){squareGroundStroke(p);return;}
 const spacing=Math.max(4,Math.min(tool==='organic'?24:64,groundOptions().size*.12));
 if(!pointer.groundLast){groundDab(p);pointer.groundLast={...p};pointer.groundDistance=0;return;}
 const from=pointer.groundLast,dx=p.x-from.x,dy=p.y-from.y,distance=Math.hypot(dx,dy);let offset=spacing-(pointer.groundDistance||0);
 for(;offset<=distance;offset+=spacing)groundDab({x:from.x+dx*offset/distance,y:from.y+dy*offset/distance});
 pointer.groundDistance=((pointer.groundDistance||0)+distance)%spacing;pointer.groundLast={...p};
 if(finish&&pointer.groundDistance>.01){groundDab(p);pointer.groundDistance=0;}
}
function paint(p){if(['ground','blend','organic'].includes(tool)){groundStroke(p);return;}const x=Math.floor(p.x/64),y=Math.floor(p.y/64);if(x<0||y<0||x>=COLS||y>=ROWS)return;if(tool==='round'){const stamp=key(x,y);if(pointer.seen.has(stamp))return;pointer.seen.add(stamp);const result=roundTerrain(doc,p,$('brush').value,cornerStyles[cornerStyleIndex].id);if(result.edits.length){if(!pointer.roundRecorded){checkpoint();pointer.roundRecorded=true;}for(const[k,a]of result.edits)doc.cells[k]=a;changed();}else status('Brush an inside or outside corner of raised ground, water or a painted path.');return;}const node={x:Math.round(p.x/64),y:Math.round(p.y/64)};if(['fence','gate'].includes(tool)){if(pointer.node)connect(doc,pointer.node,node,$('barrier').value,tool==='gate');pointer.node=node;return;}if(tool==='select'&&selected){if(selected.mount||$('mountSurface').value==='cliff'){if(hover?.face){attach(selected,hover.face);$('mountHeight').disabled=false;$('mountHeight').value=Math.round(hover.face.v*100);$('mountHeightLabel').textContent=$('mountHeight').value+'%';}return;}const target=snapUrbanAsset(catalog.get(selected.asset),{x:p.x-pointer.offset.x,y:p.y-pointer.offset.y});selected.x=Math.max(0,Math.min(COLS*64,target.x));selected.y=Math.max(0,Math.min(ROWS*64,target.y));return;}if(['place','hand','select','spawn','steps','pier','fillWater','fillLand'].includes(tool))return;const b=Math.max(1,Math.min(15,Number($('brush').value)||1)),radius=Math.floor(b/2);for(let yy=y-radius;yy<y-radius+b;yy++)for(let xx=x-radius;xx<x-radius+b;xx++){const k=key(xx,yy);if(xx<0||yy<0||xx>=COLS||yy>=ROWS||pointer.seen.has(k))continue;pointer.seen.add(k);let a={...cell(doc,xx,yy)};if(tool==='erase'){delete doc.cells[k];for(const ek of Object.keys(doc.edges)){const s=segment(ek);if(Math.floor(s.x/64)===xx&&Math.floor(s.y/64)===yy)delete doc.edges[ek];}continue;}if(tool==='water'){a.surface='water';delete a.paint;delete a.sidewalkCurb;clearStairs(a);delete a.bridge;delete a.pier;}if(tool==='raise'){if(a.pier){delete a.pier;delete a.bridge;}delete a.curves;a.level=Math.min(8,a.level+1);clearStairs(a);}if(tool==='lower'){if(a.pier){delete a.pier;delete a.bridge;}delete a.curves;a.level=Math.max(0,a.level-1);clearStairs(a);}if(tool==='level'){if(a.pier){delete a.pier;delete a.bridge;}delete a.curves;a.level=Math.max(0,Math.min(8,Number($('level').value)||0));clearStairs(a);}if(tool==='bridge'){delete a.pier;clearStairs(a);a.bridge=$('bridge').value;a.finish=$('finish').value;}doc.cells[k]=a;}}
function fillTerrainAt(p){
 const result=tool==='fillLand'?planLandFill(doc,p,{surface:$('surface').value,paving:$('paving').value}):planWaterFill(doc,p);
 if(result.edits.length){checkpoint();for(const[k,a]of result.edits)doc.cells[k]=a;changed();}
 status(result.message);$('hint').textContent=result.message+' · Ctrl+Z undo';
}
function updateStairPreview(p){stairPreview=planStairs(doc,pointer.stairStart,{x:Math.floor(p.x/64),y:Math.floor(p.y/64)},{width:$('brush').value,finish:$('finish').value,catalog});status(stairPreview.message);}
function updatePierPreview(p){pierPreview=planPier(doc,pointer.pierStart,p,{width:Number($('brush').value),level:Number($('level').value),catalog});status(pierPreview.message);}
canvas.onpointerleave=()=>{if(!pointer)hover=null;};canvas.oncontextmenu=e=>e.preventDefault();canvas.onpointerdown=e=>{if(walk){urban.handlePointer(e);return;}if(tool==='place'&&loadingAsset){status('Artwork is loading. Please place it when ready.');return;}canvas.focus();canvas.setPointerCapture(e.pointerId);const p=world(e);hover={x:Math.floor(p.x/64),y:Math.floor(p.y/64),p,face:hitCliff(doc,screen(e))};if(pendingAttach){if(hover.face){checkpoint();attach(pendingAttach,hover.face);const target=pendingAttach;pendingAttach=null;select(target);changed();}else status('Click the vertical rock face to attach the selected asset.');return;}if(tool==='place'&&$('mountSurface').value==='cliff'&&!hover.face){status('Point at a vertical south-facing cliff face to attach this asset.');return;}pointer={last:{x:e.clientX,y:e.clientY},pan:e.button!==0||tool==='hand'||keys.has(' '),seen:new Set(),node:null};if(pointer.pan)return;if(['fence','gate'].includes(tool)&&$('barrier').value==='music-square'){pointer.musicWall=true;paintMusicWall(p);return;}if(['fillWater','fillLand'].includes(tool)){pointer.terrainFill=true;if($('heightView').value!=='plan'&&hover.face){status(tool==='fillLand'?'Click a flat ground or water surface to fill with the selected material.':'Click a flat ground surface to fill with water.');return;}fillTerrainAt(p);return;}if(tool==='pier'){selected=null;pointer.pierStart={...p};updatePierPreview(p);return;}if(tool==='steps'){selected=null;pointer.stairStart={x:Math.floor(p.x/64),y:Math.floor(p.y/64)};updateStairPreview(p);return;}if(tool==='region'){selected=null;if($('selectionShape').value==='elevation'){pointer.regionClick=true;selectElevationAt(p);return;}if($('selectionShape').value==='freeform'){pointer.regionPoints=[{x:p.x,y:p.y}];region=regionFromPolygon(pointer.regionPoints,{preview:true});}else{pointer.regionStart={x:Math.floor(p.x/64),y:Math.floor(p.y/64)};region=regionBetween(pointer.regionStart,pointer.regionStart);}showRegion();return;}if(!['round','ground','blend','organic'].includes(tool))checkpoint();if(tool==='select'){select(pick(screen(e)));if(selected)pointer.offset={x:p.x-selected.x,y:p.y-selected.y};}if(tool==='place'){const o=placement(p);if(o){doc.objects.push(o);select(o);}}if(tool==='spawn')doc.spawn={x:p.x,y:p.y};paint(p);if(!['round','ground','blend','organic'].includes(tool))changed();};
canvas.onpointermove=e=>{if(walk)return;const p=world(e);hover={x:Math.floor(p.x/64),y:Math.floor(p.y/64),p,face:hitCliff(doc,screen(e))};$('hoverLevel').textContent=`Level ${Math.round(height(doc,hover.p.x,hover.p.y)/48*10)/10}`;if(!pointer)return;if(pointer.pan){cam.x-=(e.clientX-pointer.last.x)/cam.zoom;cam.y-=(e.clientY-pointer.last.y)/cam.zoom;pointer.last={x:e.clientX,y:e.clientY};}else if(pointer.musicWall){paintMusicWall(p);}else if(pointer.terrainFill||pointer.regionClick){return;}else if(pointer.pierStart){updatePierPreview(p);}else if(pointer.stairStart){updateStairPreview(p);}else if(pointer.regionPoints){updateLasso(p);}else if(pointer.regionStart){region=regionBetween(pointer.regionStart,{x:Math.floor(p.x/64),y:Math.floor(p.y/64)});showRegion();}else{paint(p);if(!['round','ground','blend','organic'].includes(tool))changed();}};canvas.onpointerup=e=>{if(pointer?.musicWall&&!pointer.pan)paintMusicWall(world(e));if(pointer&&!pointer.pan&&['ground','blend','organic'].includes(tool))groundStroke(world(e),true);if(pointer?.regionPoints)updateLasso(world(e),true);if(pointer?.pierStart){updatePierPreview(world(e));if(pierPreview.valid&&pierPreview.edits.length){checkpoint();for(const[k,a]of pierPreview.edits)doc.cells[k]=a;changed();}else status(pierPreview.message);}if(pointer?.stairStart){updateStairPreview(world(e));if(stairPreview.valid){checkpoint();for(const[k,a]of stairPreview.edits)doc.cells[k]=a;changed();}else status(stairPreview.message);}pointer=null;stairPreview=null;pierPreview=null;};canvas.onpointercancel=()=>{pointer=null;stairPreview=null;pierPreview=null;if(region?.preview)clearRegion();};canvas.onwheel=e=>{e.preventDefault();if(walk&&urban.active){urban.zoom(e.deltaY);return;}const before=screen(e);cam.zoom=Math.max(.035,Math.min(2,cam.zoom*Math.exp(-e.deltaY*.001)));const after=screen(e);cam.x+=before.x-after.x;cam.y+=before.y-after.y;},{passive:false};
$('play').onclick=async()=>{if(recovery.writeBlocked){await recovery.open('The existing saved data is protected. Restore or download a map before using Play.');return;}try{clearTimeout(saveTimer);if(!db)db=await openDatabase();await saveProject(db,doc);dirty=false;location.href='../?map=builder';}catch(e){status('Could not save for play: '+e.message);}};
$('fit').onclick=()=>{cam.x=COLS*32;cam.y=ROWS*32;cam.zoom=Math.min(canvas.clientWidth/(COLS*64),canvas.clientHeight/(ROWS*64))*.95;};
function toggleWalk(){walk=!walk;if(!walk)urban.reset();keys.clear();if(walk){try{player=findStart(doc,catalog);}catch(e){walk=false;status(e.message);return;}cam.zoom=.8;canvas.focus();}$('mapTools').hidden=walk;$('mapTools').style.display=walk?'none':'';$('heightView').disabled=walk;$('heightLegend').hidden=walk||$('heightView').value==='art';$('walk').textContent=walk?'Stop walk test':'Walk test';$('hint').textContent=walk?'WASD / arrows · Shift run · Walk through doors · E interact · Escape back':'Drag to paint · right drag to pan · wheel to zoom';}$('walk').onclick=toggleWalk;
window.onkeydown=e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;if(walk&&urban.keydown(e)){keys.clear();return;}keys.add(e.key.toLowerCase());if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.key==='Escape'){pendingAttach=null;pointer=null;stairPreview=null;pierPreview=null;if(walk)toggleWalk();else clearRegion();}if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();$('undo').click();}if(e.key==='Delete'&&!walk)$('delete').click();if(walk&&e.key.toLowerCase()==='e'&&!e.repeat){if(toggleGate(doc,player))changed();}};window.onkeyup=e=>keys.delete(e.key.toLowerCase());window.onblur=()=>keys.clear();window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
let last=performance.now();function frame(now){const dt=Math.min(.04,(now-last)/1000);last=now;if(hover){const levelText=`Level ${Math.round(height(doc,hover.p.x,hover.p.y)/48*10)/10}`;if($('hoverLevel').textContent!==levelText)$('hoverLevel').textContent=levelText;}const surface=resizeSurface(canvas,{planning:!walk&&$('heightView').value==='plan'});concert.updateContext(urban.scene);if(npcsVisible)ambient.update(dt,now/1000);if(walk){urban.tick();if(urban.frame(ctx,keys,dt,now,surface.width,surface.height,(c,x,y,state)=>character.drawPlayer(c,avatar,{x,y,...state},now/1000))){requestAnimationFrame(frame);return;}const motion=movePlayer(playerCollision.view(player),player,urban.blocked?new Set():keys,dt,catalog);if(motion.facing)facing=motion.facing;walking=motion.walking;walkPhase=(walkPhase+motion.surfaceDistance*GAIT_PER_PIXEL)%(Math.PI*2);follow(cam,player,doc);}footprints.update([...(walk?[{id:'__player__',...player,walking}]:[]),...(npcsVisible&&(walk||$('heightView').value==='art')?ambient.actors:[])],now/1000);render(ctx,pierPreview?.preview||stairPreview?.preview||doc,cam,surface.width,surface.height,{terrainRevision,night,time:now/1000,npcs:npcsVisible&&(walk||$('heightView').value==='art')?ambient.actors:[],drawNPC:ambient.draw,drawFootprints:(c,d,t)=>footprints.draw(c,d,t),heightView:walk?'art':$('heightView').value,grid:$('grid').checked,collision:$('showCollision').checked,selected:walk?null:selected,region:walk?null:region,hover:walk||['ground','blend','organic'].includes(tool)?null:hover,brush:!walk&&hover&&['ground','blend','organic'].includes(tool)?{x:hover.p.x,y:hover.p.y,size:squareGround()?groundWidth()*64:groundOptions().size,hardness:tool==='organic'?0:squareGround()?1:groundOptions().hardness,organic:tool==='organic',blend:tool==='blend',shape:squareGround()?'square':'round'}:null,ghost:!walk&&pendingAttach&&hover?.face?attach({...pendingAttach},hover.face):!walk&&tool==='place'&&hover?placement(hover.p):null,player:walk?player:null,drawPlayer:(c,x,y)=>character.drawPlayer(c,avatar,{x,y,facing,walking,phase:walkPhase},now/1000)});if(!walk){drawStairGuide(ctx,stairPreview,cam,surface.width,surface.height,$('heightView').value==='plan');if(pierPreview)drawPierGuide(ctx,pierPreview,cam,surface.width,surface.height,$('heightView').value==='plan');drawMusicWallGuide(ctx,surface.width,surface.height);}requestAnimationFrame(frame);}requestAnimationFrame(frame);
// Read-only hooks support browser verification without modifying arcade progress.
addEventListener('keydown',e=>{if(walk||e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.key.toLowerCase()!=='r'||e.target.closest?.('input,select,textarea')||!(tool==='place'||tool==='select'&&selected))return;e.preventDefault();$('rotation').value=String((Number($('rotation').value)+90)%360);$('rotation').dispatchEvent(new Event('change'));});
window.townBuilder={get project(){return doc;},catalog,cam,urban,ambient,footprints,concert,playerCollision,get night(){return night;},get npcsVisible(){return npcsVisible;},get region(){return region;},get tool(){return tool;},recovery};
