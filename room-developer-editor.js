/* Room editing uses the same world coordinates as movement, never CSS pixels. */
(function(root){
 'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const color=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
 const finite=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
 const EMPTY=()=>({version:1,assets:[],collision:[],strokes:[],entities:{}});
 const ENTITY_FIELDS=['x','y','size','speciesId','color','accent','visible'];
 function artworkCore(){return root.CodaArtworkEditor||(typeof require==='function'?require('./artwork-editor.js'):null);}
 function layerSelectionCore(){return root.CodaLayerSelection||(typeof require==='function'?require('./layer-selection.js'):null);}
 function validTexture(value){return artworkCore()?.validateTexture?.(value)===true;}
 function validProject(value,width,height){
  if(width&&typeof width==='object'){height=width.height;width=width.width;}
  if(!finite(width,1,8192)||!finite(height,1,8192))return false;
  if(!value||value.version!==1||!Array.isArray(value.assets)||value.assets.length>150||!Array.isArray(value.collision)||!Array.isArray(value.strokes)||!value.entities||typeof value.entities!=='object'||Array.isArray(value.entities))return false;
  const cells=Math.ceil(width/10)*Math.ceil(height/10),ids=new Set();
  for(const asset of value.assets){
   if(!asset||typeof asset.id!=='string'||!/^[a-z0-9_-]{1,80}$/i.test(asset.id)||ids.has(asset.id)||typeof asset.name!=='string'||asset.name.length>100||!finite(asset.x,-width,width*2)||!finite(asset.y,-height,height*2)||!finite(asset.w,1,width*2)||!finite(asset.h,1,height*2)||!['background','world','foreground'].includes(asset.layer)||typeof asset.visible!=='boolean')return false;
   ids.add(asset.id);
   if(asset.data!==undefined&&(typeof asset.data!=='string'||asset.data.length>12*1024*1024||!/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=\r\n]+$/i.test(asset.data)))return false;
   if(!asset.data&&!asset.origin)return false;
   if(asset.origin){const origin=asset.origin;if(!Array.isArray(origin.bounds)||origin.bounds.length!==4||!origin.bounds.every(Number.isFinite)||origin.bounds[0]<0||origin.bounds[1]<0||origin.bounds[2]<1||origin.bounds[3]<1||origin.bounds[0]+origin.bounds[2]>width||origin.bounds[1]+origin.bounds[3]>height||!Array.isArray(origin.sample)||origin.sample.length!==2||!origin.sample.every(Number.isFinite)||origin.sample[0]<0||origin.sample[0]>width-1||origin.sample[1]<0||origin.sample[1]>height-1)return false;}
   if(asset.solid!==undefined&&typeof asset.solid!=='boolean')return false;
   if(asset.rotation!==undefined&&!finite(asset.rotation,-3600,3600))return false;
   if(asset.flipX!==undefined&&typeof asset.flipX!=='boolean'||asset.flipY!==undefined&&typeof asset.flipY!=='boolean')return false;
   if(asset.ignoreBackgroundMasks!==undefined&&typeof asset.ignoreBackgroundMasks!=='boolean')return false;
   if(asset.artwork!==undefined&&!validTexture(asset.artwork))return false;
  }
  if(value.artwork!==undefined&&!validTexture(value.artwork))return false;
  if(value.collision.length>cells||new Set(value.collision.map(entry=>entry?.[0])).size!==value.collision.length||!value.collision.every(entry=>Array.isArray(entry)&&entry.length===2&&Number.isInteger(entry[0])&&entry[0]>=0&&entry[0]<cells&&(entry[1]===0||entry[1]===1)))return false;
  if(value.strokes.length>2000||!value.strokes.every(stroke=>stroke&&['paint','erase'].includes(stroke.tool)&&[1,2,4,8,16,32].includes(stroke.size)&&Array.isArray(stroke.points)&&stroke.points.length>0&&stroke.points.length<=30000&&stroke.points.every(point=>Array.isArray(point)&&point.length===2&&finite(point[0],0,width)&&finite(point[1],0,height))&&(stroke.selection===undefined||layerSelectionCore()?.validate(stroke.selection,width,height)===true)))return false;
  if(Object.keys(value.entities).length>300)return false;
  for(const [id,patch]of Object.entries(value.entities)){
   if(['__proto__','constructor','prototype'].includes(id)||!/^[a-z0-9_-]{1,80}$/i.test(id)||!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(key=>!ENTITY_FIELDS.includes(key)))return false;
   if(patch.x!==undefined&&!finite(patch.x,0,width)||patch.y!==undefined&&!finite(patch.y,0,height)||patch.size!==undefined&&!finite(patch.size,.25,4)||patch.speciesId!==undefined&&(typeof patch.speciesId!=='string'||!/^[a-z0-9_-]{1,80}$/i.test(patch.speciesId))||patch.color!==undefined&&!color(patch.color)||patch.accent!==undefined&&!color(patch.accent)||patch.visible!==undefined&&typeof patch.visible!=='boolean')return false;
  }
  return true;
 }
 function createCodaRoomDeveloperEditor(api={}){
  const {host,canvas}=api;if(!host||!canvas)throw Error('Room editor needs a room and canvas.');
  const doc=host.ownerDocument,win=doc.defaultView||root,W=api.width||canvas.width,H=api.height||canvas.height,id=api.id||'room';
  const store='codaRoomProjectV1:'+id,COLS=Math.ceil(W/10);let storage=api.storage;
  if(storage===undefined)try{storage=win.localStorage;}catch{}
  let project=EMPTY(),opened=false,playtest=false,tab='objects',selected=null,mode='select',panTool=false,spaceHeld=false,gesture=null,destroyed=false,layerDirty=true,serial=0,pinching=null,projectRevision=0;
  let undo=[],redo=[],maskCanvas=null,erasedCanvas=null,promotedCanvas=null,paintPath=null,erasePath=null,normalPath=null,outsidePaintPath=null,maskImageSource=null,maskImageStamp='',maskBuilds=0,collisionMap=new Map(),entityVersions=new Map(),images=new Map(),loadError='',localProjectPresent=false;
  const camera={x:0,y:0,zoom:1},pointers=new Map(),TABS=['objects','collision','layers','project'];
  let pixelEditor=null,artworkEditor=null,educationEditor=null,backgroundCache=null,assetArtworkCache=new Map(),spriteUndo=[],spriteRedo=[],collisionOverlay=false,layerOverlay=false,brushHover=null;
  if(win.CodaPixelEditor&&api.renderer&&typeof api.getSharedSprites==='function'&&typeof api.setSharedSprites==='function')TABS.splice(3,0,'sprites');
  if(win.CodaArtworkEditor)TABS.splice(TABS.indexOf('project'),0,'artwork');
  if(win.CodaEducationEditor)TABS.splice(TABS.indexOf('project'),0,'education');
  let characterArtwork=null;
  if(win.CodaCharacterArtworkAdapter&&api.renderer&&api.getSharedSprites&&api.setSharedSprites)characterArtwork=win.CodaCharacterArtworkAdapter.create({renderer:api.renderer,getSprites:api.getSharedSprites,setSprites:api.setSharedSprites,getTargets:()=>api.getPixelTargets?.()||[{id:'player',name:'Your avatar'},...entities().filter(entity=>entity.kind!=='fish').map(entity=>({id:entity.id,name:entity.name}))],getProfile:entityId=>api.getPixelProfile?.(entityId)||(entityId==='player'?api.getAvatar?.()||{}:api.renderer.appearanceFor?.(entityId)||{})});
  const panel=doc.createElement('aside');panel.className='room-dev-console';panel.dataset.roomEditor=id;panel.hidden=true;panel.setAttribute('aria-label',(api.name||'Room')+' developer console');
  panel.innerHTML=`<div class="room-dev-head"><strong>⌘ ${escapeText(api.name||'Room')} editor</strong><button type="button" data-room-action="dock" aria-label="Move room console to the other side">⇄</button><button type="button" data-room-action="close" aria-label="Close room developer console">✕</button></div>
   <div class="room-dev-camera" role="group" aria-label="Editor camera"><button type="button" data-room-action="zoom-out" aria-label="Zoom out">−</button><button type="button" data-room-action="zoom-reset" aria-label="Reset editor zoom">100%</button><button type="button" data-room-action="zoom-in" aria-label="Zoom in">+</button><button type="button" data-room-action="pan" aria-pressed="false">✋ Pan</button></div>
   <div class="room-dev-overlays" role="group" aria-label="Editor overlays"><button type="button" data-room-action="show-collision" aria-pressed="false">Show collision</button><button type="button" data-room-action="show-layers" aria-pressed="false" title="Highlight foreground, background, and actor-depth layers">Show layers</button></div>
   <p class="room-dev-overlay-legend" hidden><span class="dev-key-blocked">Red: blocked</span> · <span class="dev-key-walkable">Green: walkable</span><br><span class="dev-key-background">Blue: background</span> · <span class="dev-key-depth">Gold: actor depth</span> · <span class="dev-key-foreground">Mint: foreground</span></p>
   <p class="room-dev-hint">C toggles Collision · L toggles Layers. Overlays show the room boundary and edits without changing your project.</p>
   <p class="room-dev-hint">Wheel or + / − zoom · right-drag, middle-drag, or Space-drag pans. Pan also works with one finger.</p>
   <nav class="room-dev-tabs" aria-label="Room developer tools" role="tablist">${TABS.map(name=>`<button type="button" data-room-tab="${name}" role="tab" aria-selected="${name==='objects'}">${name==='education'?'Lessons & exams':name[0].toUpperCase()+name.slice(1)}</button>`).join('')}</nav>
   <section data-room-pane="objects"><label>Room characters and fish<select data-room-field="entity"><option value="">Select a room character or fish</option></select></label><div data-room-entity-fields hidden><div class="room-dev-grid"><label>X<input data-room-field="entity-x" type="number" min="0" max="${W}" step="1"></label><label>Y<input data-room-field="entity-y" type="number" min="0" max="${H}" step="1"></label></div><div data-room-fish-fields hidden><label>Fish species<select data-room-field="species"></select></label><label>Fish size<input data-room-field="fish-size" type="number" min=".25" max="4" step=".1"></label><div class="room-dev-grid"><label>Body color<input data-room-field="fish-color" type="color"></label><label>Accent color<input data-room-field="fish-accent" type="color"></label></div></div><label class="room-dev-check"><input data-room-field="entity-visible" type="checkbox">Visible</label><button type="button" data-room-action="edit-character-artwork" hidden>Edit character pixels</button><button type="button" data-room-action="entity-reset">Restore selected character / fish</button></div>
    <hr><label>Room artwork<select data-room-field="asset"><option value="">Select room artwork</option></select></label><div class="room-dev-row"><button type="button" data-room-action="lift">Lift a region</button><button type="button" data-room-action="add-image">Add image</button></div><input data-room-field="image-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
    <div data-room-asset-fields hidden><label>Name<input data-room-field="asset-name" maxlength="100"></label><div class="room-dev-grid">${['x','y','w','h'].map(field=>`<label>${({x:'X',y:'Y',w:'Width',h:'Height'})[field]}<input data-room-field="asset-${field}" type="number" step="1"></label>`).join('')}</div><label>Layer<select data-room-field="asset-layer"><option value="background">Background</option><option value="world">Actor depth</option><option value="foreground">Foreground</option></select></label><label>Rotation °<input data-room-field="asset-rotation" type="number" min="-3600" max="3600" step="1"></label><div class="room-dev-row"><button type="button" data-room-action="asset-flip-x" aria-pressed="false">Flip horizontally</button><button type="button" data-room-action="asset-flip-y" aria-pressed="false">Flip vertically</button></div><div class="room-dev-row"><button type="button" data-room-action="asset-rotate-left">Rotate left 90°</button><button type="button" data-room-action="asset-rotate-right">Rotate right 90°</button></div><div data-room-origin-fields><p class="room-dev-hint">The source is a flat painting. Choose a clean floor/wall sample to cover the old artwork.</p><div class="room-dev-grid"><label>Sample X<input data-room-field="sample-x" type="number" step="1"></label><label>Sample Y<input data-room-field="sample-y" type="number" step="1"></label></div><button type="button" data-room-action="pick-sample">Pick floor / wall sample</button></div><label class="room-dev-check"><input data-room-field="ignore-background-masks" type="checkbox">Draw in front of background masks</label><p class="room-dev-hint">Keep this artwork at its chosen depth where Send to background masks overlap.</p><label class="room-dev-check"><input data-room-field="asset-visible" type="checkbox">Visible</label><label class="room-dev-check"><input data-room-field="asset-solid" type="checkbox">Solid walking footprint</label><button type="button" data-room-action="edit-artwork">Edit these pixels</button><div class="room-dev-row"><button type="button" data-room-action="asset-remove">Remove artwork</button><button type="button" data-room-action="asset-restore">Restore original</button></div></div>
    <p class="room-dev-hint">Select a character, fish, or lifted image. Drag to move it; drag its gold corner to resize. Fish stay still while editing.</p>
   </section>
   <section data-room-pane="collision" hidden><h3>Walking and collision</h3><p>Paint cells to block or open walking. Restore uses the room’s original boundary.</p><label>Collision brush<select data-room-field="collision-tool"><option value="block">Block walking</option><option value="open">Open walking</option><option value="restore">Restore original</option></select></label><label>Brush size<select data-room-field="collision-size"><option value="1">1 cell</option><option value="2">2 cells</option><option value="4">4 cells</option></select></label></section>
   <section data-room-pane="layers" hidden><h3>Foreground and background</h3><p>Paint room pixels in front of characters. Erase sends those pixels behind them.</p><label>Layer brush<select data-room-field="layer-tool"><option value="paint">Paint foreground</option><option value="erase">Send to background</option></select></label><div class="room-dev-row"><button type="button" data-room-action="layer-brush" aria-pressed="true">Brush</button><button type="button" data-room-action="layer-select" aria-pressed="false">Select</button></div><label>Selection shape<select data-room-field="layer-selection-shape"><option value="rectangle">Rectangle · drag an area</option><option value="manual">Manual shape · click around an area</option></select></label><div class="room-dev-row"><button type="button" data-room-action="layer-finish">Finish selection</button><button type="button" data-room-action="layer-fill">Fill selection</button><button type="button" data-room-action="layer-clear">Clear selection</button></div><p class="room-dev-hint">Select an area, choose Paint foreground or Send to background, then Fill selection. Double-click or Enter finishes a manual shape; Escape cancels it. Filling changes layer coverage, not the artwork’s colours.</p><label>Stroke shape<select data-room-field="layer-shape"><option value="pen">Freehand</option><option value="line">Line · drag a straight line</option></select></label><label>Brush size<select data-room-field="layer-size">${[1,2,4,8,16,32].map(size=>`<option${size===4?' selected':''}>${size}</option>`).join('')}</select></label><label class="room-dev-check"><input data-room-field="mask-visible" type="checkbox">Show foreground mask</label></section>
   <section data-room-pane="project" hidden><h3>${escapeText(api.name||'Room')} project</h3><p>Room artwork, fish/character changes, collision, and foreground edits save in this browser and travel with the complete world export.</p><div class="room-dev-row"><button type="button" data-room-action="save">Save room</button><button type="button" data-room-action="export">Export room JSON</button></div><div class="room-dev-row"><button type="button" data-room-action="import">Import room JSON</button><button type="button" data-room-action="reset">Reset room edits</button></div><input data-room-field="project-file" type="file" accept="application/json,.json" hidden></section>
   <footer class="room-dev-bottom"><div class="room-dev-row"><button type="button" data-room-action="undo">↶ Undo</button><button type="button" data-room-action="redo">↷ Redo</button><button type="button" data-room-action="playtest" aria-pressed="false">▶ Playtest</button></div><p data-room-status role="status">Room edits save locally.</p></footer>`;
  host.append(panel);
  if(win.CodaDeveloperTestMode){const test=doc.createElement('button');test.type='button';test.dataset.roomTestUnlocks='';test.textContent=win.CodaDeveloperTestMode.isEnabled()?'Exit test mode':'Test all unlocks';test.title='Try rewards in a temporary game without changing your real player.';test.onclick=()=>win.CodaDeveloperTestMode.isEnabled()?win.CodaDeveloperTestMode.exit():win.CodaDeveloperTestMode.enter();panel.querySelector('[data-room-pane="project"]').append(test);}
  let spritePane=null;
  if(TABS.includes('sprites')){spritePane=doc.createElement('section');spritePane.dataset.roomPane='sprites';spritePane.hidden=true;panel.querySelector('[data-room-pane="project"]').before(spritePane);}
  function mountSprites(){
   if(pixelEditor||!spritePane||!opened||tab!=='sprites')return;
   pixelEditor=win.CodaPixelEditor.mount({host:spritePane,renderer:api.renderer,getData:()=>api.getSharedSprites()||{},canEdit:canMutateUI,openArtwork:target=>{setTab('artwork');artworkEditor?.selectTarget(target);},
    getTargets:()=>api.getPixelTargets?.()||[{id:'player',name:'Your avatar'},...entities().filter(entity=>entity.kind!=='fish').map(entity=>({id:entity.id,name:entity.name}))],
    getProfile:entityId=>api.getPixelProfile?.(entityId)||(entityId==='player'?api.getAvatar?.()||{}:api.renderer.appearanceFor?.(entityId)||{}),
    onChange:next=>{if(!canMutateUI())return false;const before=copy(api.getSharedSprites()||{});if(api.setSharedSprites(copy(next))===false)return false;spriteUndo.push(before);if(spriteUndo.length>50)spriteUndo.shift();spriteRedo=[];refresh();status('Saved shared character pixel details.');return true;}});
   const grid=spritePane.querySelector('#pixelEditCanvas'),preview=spritePane.querySelector('#pixelLivePreview');if(grid)grid.id='roomPixelEditCanvas-'+id;if(preview)preview.id='roomPixelLivePreview-'+id;
  }
  function disposeSprites(){pixelEditor?.dispose();pixelEditor=null;}
  let educationPane=null;
  if(TABS.includes('education')){educationPane=doc.createElement('section');educationPane.dataset.roomPane='education';educationPane.hidden=true;panel.querySelector('[data-room-pane="project"]').before(educationPane);}
  function mountEducation(){
   if(educationEditor||!educationPane||!opened||playtest||tab!=='education')return;
   if(!win.CodaEducationContent?.getStore?.()){educationPane.textContent='Lesson editing tools could not load. Reload to try again.';return;}
   educationPane.replaceChildren();educationEditor=win.CodaEducationEditor.mount({host:educationPane,canEdit:canMutateUI,onExit:()=>{setTab('objects');canvas.focus({preventScroll:true});}});
  }
  let artworkPane=null;
  if(TABS.includes('artwork')){artworkPane=doc.createElement('section');artworkPane.dataset.roomPane='artwork';artworkPane.hidden=true;panel.querySelector('[data-room-pane="project"]').before(artworkPane);}
  const backgroundId='background.'+id,assetPrefix='room.'+id+'.asset.';
  function artworkTargets(){
   const image=backgroundBase(),targets=[{id:backgroundId,name:(api.name||'Room')+' background',width:image?.naturalWidth||image?.width||W,height:image?.naturalHeight||image?.height||H}];
   for(const asset of project.assets)targets.push({id:assetPrefix+asset.id,name:asset.name,width:asset.artwork?.width,height:asset.artwork?.height});
   return targets.concat(characterArtwork?.getTargets()||[]);
  }
  function getArtworkData(){
   const data={...(characterArtwork?.getData()||{})};if(project.artwork)data[backgroundId]=copy(project.artwork);
   for(const asset of project.assets)if(asset.artwork)data[assetPrefix+asset.id]=copy(asset.artwork);return data;
  }
  function getArtworkSource(target){
   if(target===backgroundId){const source=api.getBackground?.();if(!source)return null;if(source.complete===false&&typeof source.decode==='function')return source.decode().then(()=>source);return backgroundBase();}
   if(target.startsWith(assetPrefix)){const asset=project.assets.find(asset=>asset.id===target.slice(assetPrefix.length));if(!asset)return null;if(asset.data){const source=getImage(asset)||images.get(asset.data);return source?.complete&&source.naturalWidth?source:source?.decode?.().then(()=>source)||null;}return assetSource(asset);}
   return characterArtwork?.getSource(target)||null;
  }
  function setArtworkData(next,options={}){
   if(!win.CodaArtworkEditor?.validate(next))return false;
   const bgSource=backgroundBase();if(next[backgroundId]&&bgSource&&!win.CodaArtworkEditor.validateTexture(next[backgroundId],bgSource.naturalWidth||bgSource.width,bgSource.naturalHeight||bgSource.height))return false;
   for(const asset of project.assets){const value=next[assetPrefix+asset.id];if(!value)continue;const source=assetSource(asset);if(source&&!win.CodaArtworkEditor.validateTexture(value,source.naturalWidth||source.width,source.naturalHeight||source.height))return false;}
   const before=snapshot(),texture=value=>value&&Object.keys(value.tiles).length?copy(value):null;
   const bg=texture(next[backgroundId]);if(bg)project.artwork=bg;else delete project.artwork;
   for(const asset of project.assets){const value=texture(next[assetPrefix+asset.id]);if(value)asset.artwork=value;else delete asset.artwork;}
   backgroundCache=null;assetArtworkCache.clear();layerDirty=true;
   changed(before,'Saved room pixel artwork. Undo is available.');
   if(options.characters&&characterArtwork){
    const ids=new Set(characterArtwork.getTargets().map(target=>target.id)),characters=Object.fromEntries(Object.entries(next).filter(([key])=>ids.has(key))),current=characterArtwork.getData();
    if(JSON.stringify(current)!==JSON.stringify(characters)){const prior=copy(api.getSharedSprites()||{});if(characterArtwork.onChange(characters)===false)return false;undo.push({kind:'sprites',data:prior});if(undo.length>50)undo.shift();redo=[];refresh();status('Saved character pixel artwork.');}
   }
   return true;
  }
  function mountArtwork(){
   if(artworkEditor||!artworkPane||!opened||tab!=='artwork')return;
   artworkEditor=win.CodaArtworkEditor.mount({host:artworkPane,getTargets:artworkTargets,getSource:getArtworkSource,getData:getArtworkData,hasAssetPreview:hasArtworkAssetPreview,drawAssetPreview:drawArtworkAssetPreview,onChange:next=>active()&&(!api.canEdit||api.canEdit()!==false)&&setArtworkData(next,{characters:true}),onUndo:()=>{if(active()&&(!api.canEdit||api.canEdit()!==false))undoRedo(true);},onRedo:()=>{if(active()&&(!api.canEdit||api.canEdit()!==false))undoRedo(false);},getHistory:()=>({undo:undo.length,redo:redo.length}),canEdit:()=>active()&&(!api.canEdit||api.canEdit()!==false),startExpanded:true,fitOnFirstExpand:true,onExit:()=>setTab('objects'),initialId:selectedAsset()?assetPrefix+selectedAsset().id:backgroundId});
  }
  function disposeArtwork(){artworkEditor?.dispose();artworkEditor=null;}
  function characterHistory(){return tab==='sprites';}

  const button=doc.createElement('button');button.type='button';button.dataset.roomDevOpen=id;button.textContent='⌘ Developer';button.title='Open room developer console (F2)';button.setAttribute('aria-expanded','false');
  let heading=host.querySelector('.fishing-heading-actions')||host.querySelector('.piano-room-heading-actions');
  const pianoHeading=host.querySelector('.piano-room-heading');
  if(!heading&&pianoHeading){heading=doc.createElement('div');heading.className='piano-room-heading-actions';const returnButton=pianoHeading.querySelector('#closepiano');if(returnButton)heading.append(returnButton);pianoHeading.append(heading);}
  (heading||host.querySelector('header')||host).append(button);
  const field=name=>panel.querySelector('[data-room-field="'+name+'"]'),action=name=>panel.querySelector('[data-room-action="'+name+'"]');
  let layerSelecting=false;
  const layerSelection=win.CodaLayerSelection?.create({width:W,height:H,onChange:refreshLayerSelection});
  function refreshLayerSelection(){
   const state=layerSelection?.getState(),allowed=canMutateUI();
   action('layer-brush').setAttribute('aria-pressed',String(!layerSelecting));action('layer-select').setAttribute('aria-pressed',String(layerSelecting));
   action('layer-select').disabled=!allowed||!layerSelection;action('layer-brush').disabled=!allowed;
   field('layer-selection-shape').disabled=!allowed||!layerSelection;
   action('layer-fill').disabled=!allowed||!state?.selection||!!state.draft;
   action('layer-finish').disabled=!allowed||state?.shape!=='manual'||!state.draft||state.draft.length<3;
   action('layer-clear').disabled=!allowed||!state?.selection&&!state?.draft;
  }
  function finishLayerSelection(){
   if(!canMutateUI())return false;const done=layerSelection?.finish();
   status(done?'Selection ready. Choose Foreground or Send to background, then Fill selection.':'Click at least three corners of a shape with an area, then finish.');return done;
  }
  function doubleClick(event){
   const state=layerSelection?.getState();
   if(!active()||!canMutateUI()||tab!=='layers'||!layerSelecting||state?.shape!=='manual'||!state.draft?.length||event.button!==0||panTool||spaceHeld||pinching||gesture?.kind==='pan')return;
   event.preventDefault();event.stopImmediatePropagation();finishLayerSelection();
  }
  function fillLayerSelection(){
   if(!canMutateUI()||!layerSelection||layerSelection.getState().draft)return false;
   finishGesture();const selection=layerSelection.getSelection();if(!selection)return false;
   if(project.strokes.length>=2000){status('2,000 layer edit limit reached. Export room JSON before continuing.');return false;}
   const before=snapshot();project.strokes.push({tool:field('layer-tool').value,size:1,points:[[selection.x,selection.y]],selection});
   return changed(before,'Filled selection '+(field('layer-tool').value==='paint'?'in front of':'behind')+' characters. Undo is available.');
  }
  function escapeText(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  function status(text){panel.querySelector('[data-room-status]').textContent=text;}
  function backgroundBase(){const image=api.getBackground?.();return image&&(image.complete===undefined||image.complete)&&(image.naturalWidth||image.width)?image:null;}
  function background(){
   const image=backgroundBase();if(!image||!project.artwork||!win.CodaArtworkEditor||!win.CodaArtworkEditor.validateTexture(project.artwork,image.naturalWidth||image.width,image.naturalHeight||image.height))return image;
   if(backgroundCache?.source===image&&backgroundCache.texture===project.artwork)return backgroundCache.canvas;
   const canvas=win.CodaArtworkEditor.compose(image,project.artwork);backgroundCache={source:image,texture:project.artwork,canvas};return canvas||image;
  }
  function active(){return opened&&!playtest;}
  function canMutateUI(){return active()&&!destroyed&&(!api.canEdit||api.canEdit()!==false);}
  function getProject(){return copy(project);}
  function getCommittedProject(){
   const before=gesture?.before;if(!before)return getProject();
   return typeof before==='string'?JSON.parse(before):copy(before);
  }
  function snapshot(){return JSON.stringify(project);}
  function persist(){localProjectPresent=true;try{storage?.setItem(store,snapshot());return true;}catch{status('Browser storage is full or blocked. Export room JSON to preserve these edits.');return false;}}
  function changed(before,text='Saved room edits locally.'){
   if(before===snapshot())return false;projectRevision++;undo.push(before);if(undo.length>50)undo.shift();redo=[];collisionMap=new Map(project.collision);layerDirty=true;persist();api.onProjectChange?.(JSON.parse(before),getProject());refresh();status(text);return true;
  }
  function entities(){return (api.getEntities?.()||[]).filter(entity=>entity&&typeof entity.id==='string');}
  function applyEntity(entityId,patch){const normalized=api.onEntityChange?.(entityId,copy(patch||{}));if(patch&&Object.keys(patch).length&&normalized&&typeof normalized==='object'){const kept={};for(const field of ENTITY_FIELDS)if(Object.hasOwn(normalized,field))kept[field]=normalized[field];project.entities[entityId]={...patch,...kept};}entityVersions.set(entityId,JSON.stringify(project.entities[entityId]||{}));}
  function applyEntities(previous={}){for(const entityId of new Set([...Object.keys(previous),...Object.keys(project.entities)]))applyEntity(entityId,project.entities[entityId]||{});entityVersions.clear();}
  function syncEntities(){for(const entity of entities()){const patch=project.entities[entity.id],stamp=JSON.stringify(patch||{});if(entityVersions.get(entity.id)!==stamp){if(patch&&Object.keys(patch).length)applyEntity(entity.id,patch);else entityVersions.set(entity.id,'{}');}}}
  function artworkDimensionsValid(value,image){
   if(value.artwork&&image&&!win.CodaArtworkEditor?.validateTexture(value.artwork,image.naturalWidth||image.width,image.naturalHeight||image.height))return false;
   for(const asset of value.assets){if(!asset.artwork)continue;
    let sourceWidth,sourceHeight;
    if(asset.data){const source=images.get(asset.data);if(source?.complete&&source.naturalWidth){sourceWidth=source.naturalWidth;sourceHeight=source.naturalHeight;}}
    else if(asset.origin&&image){sourceWidth=Math.max(1,Math.round(asset.origin.bounds[2]*(image.naturalWidth||image.width)/W));sourceHeight=Math.max(1,Math.round(asset.origin.bounds[3]*(image.naturalHeight||image.height)/H));}
    if(sourceWidth&&!win.CodaArtworkEditor?.validateTexture(asset.artwork,sourceWidth,sourceHeight))return false;
   }return true;
  }
  async function validateArtworkProject(value){
   if(!validProject(value,W,H))return false;
   if(!value.artwork&&!value.assets.some(asset=>asset.artwork))return true;
   try{
    const image=await getArtworkSource(backgroundId);if(!artworkDimensionsValid(value,image))return false;
    for(const asset of value.assets){if(!asset.artwork||!asset.data)continue;let source=images.get(asset.data);
     if(!source){source=new win.Image();source.src=asset.data;images.set(asset.data,source);}
     if(!source.complete||!source.naturalWidth)await source.decode();
     if(!win.CodaArtworkEditor?.validateTexture(asset.artwork,source.naturalWidth,source.naturalHeight))return false;
    }return true;
   }catch{return false;}
  }
  function applyProject(value,options={}){
   if(!validProject(value,W,H)||!artworkDimensionsValid(value,backgroundBase())){status('This is not a valid room project. The current edits were kept.');return false;}
   finishGesture();layerSelection?.cancel();projectRevision++;const before=getProject(),oldEntities=project.entities;project=copy(value);collisionMap=new Map(project.collision);layerDirty=true;backgroundCache=null;assetArtworkCache.clear();images.clear();applyEntities(oldEntities);syncEntities();selected=null;
   if(options.persist!==false)persist();if(options.notify)api.onProjectChange?.(before,getProject());refresh();return true;
  }
  function clampCamera(){camera.zoom=clamp(camera.zoom,1,8);camera.x=clamp(camera.x,0,W-W/camera.zoom);camera.y=clamp(camera.y,0,H-H/camera.zoom);}
  function toWorld(clientX,clientY){const rect=canvas.getBoundingClientRect(),x=(clientX-rect.left)*W/rect.width,y=(clientY-rect.top)*H/rect.height;return active()?{x:camera.x+x/camera.zoom,y:camera.y+y/camera.zoom}:{x,y};}
  function zoom(value,pointer){const rect=canvas.getBoundingClientRect(),sx=pointer?(pointer.clientX-rect.left)*W/rect.width:W/2,sy=pointer?(pointer.clientY-rect.top)*H/rect.height:H/2,point={x:camera.x+sx/camera.zoom,y:camera.y+sy/camera.zoom};camera.zoom=clamp(Math.round(value*1000)/1000,1,8);camera.x=point.x-sx/camera.zoom;camera.y=point.y-sy/camera.zoom;clampCamera();refreshCamera();}
  function refreshCamera(){action('zoom-reset').textContent=Math.round(camera.zoom*100)+'%';action('zoom-out').disabled=camera.zoom<=1;action('zoom-in').disabled=camera.zoom>=8;action('pan').setAttribute('aria-pressed',String(panTool));canvas.classList.toggle('room-dev-panning',active()&&(panTool||spaceHeld));canvas.classList.toggle('room-dev-layer-brush',active()&&tab==='layers'&&!panTool&&!spaceHeld);}
  function setTab(name){finishGesture();layerSelection?.cancel();if(tab==='sprites'&&name!=='sprites')pixelEditor?.cancelGesture();if(name!=='artwork')artworkEditor?.cancelPaste?.(false);if(name!=='artwork'&&artworkEditor?.getState().expanded)artworkEditor.setExpanded(false);if(name!=='education'||!active())educationEditor?.setActive(false);brushHover=null;if(!TABS.includes(name))name='objects';tab=name;if(name==='collision')collisionOverlay=true;if(name==='layers')layerOverlay=true;mode='select';for(const node of panel.querySelectorAll('[data-room-pane]'))node.hidden=node.dataset.roomPane!==name;for(const node of panel.querySelectorAll('[data-room-tab]'))node.setAttribute('aria-selected',String(node.dataset.roomTab===name));refresh();if(tab==='artwork'&&active())artworkEditor?.setExpanded(true);if(tab==='education'&&active()){mountEducation();educationEditor?.setActive(true);educationEditor?.setExpanded(true);}}
  function setOverlay(name,value){if(!active())return;finishGesture();if(name==='collision')collisionOverlay=!!value;else layerOverlay=!!value;refresh();status((name==='collision'?'Collision grid':'Foreground layer mask')+(value?' shown.':' hidden.')+' Saved room edits are unchanged.');}
  function toggleTool(name){if(tab===name){if(name==='collision')collisionOverlay=false;else layerOverlay=false;setTab('objects');}else setTab(name);canvas.focus({preventScroll:true});}
  function open(name='objects'){if(destroyed)return;if(api.canEdit&&api.canEdit()===false){api.onCannotEdit?.();return;}opened=true;playtest=false;panel.hidden=false;host.classList.add('room-developer-open');button.setAttribute('aria-expanded','true');syncEntities();setTab(name);api.onActiveChange?.(true);if(!artworkEditor?.getState().expanded&&!educationEditor?.getState().expanded)canvas.focus({preventScroll:true});status(loadError||'Editing '+(api.name||'room')+'. Wheel zooms; right-drag pans.');}
  function close(){if(!opened)return;finishGesture();layerSelection?.cancel();disposeSprites();disposeArtwork();educationEditor?.setActive(false);opened=false;playtest=false;spaceHeld=false;brushHover=null;pointers.clear();pinching=null;panel.hidden=true;host.classList.remove('room-developer-open');button.setAttribute('aria-expanded','false');canvas.classList.remove('room-dev-panning');api.onActiveChange?.(false);canvas.focus({preventScroll:true});}
  function toggle(){if(opened)close();else open(tab);}
  function selectedEntity(){return selected?.type==='entity'?entities().find(entity=>entity.id===selected.id):null;}
  function selectedAsset(){return selected?.type==='asset'?project.assets.find(asset=>asset.id===selected.id):null;}
  function refresh(){
   syncEntities();refreshCamera();refreshLayerSelection();action('show-collision').setAttribute('aria-pressed',String(collisionOverlay));action('show-layers').setAttribute('aria-pressed',String(layerOverlay));action('show-collision').textContent=(collisionOverlay?'Hide':'Show')+' collision';action('show-layers').textContent=(layerOverlay?'Hide':'Show')+' layers';panel.querySelector('.room-dev-overlay-legend').hidden=playtest||!collisionOverlay&&!layerOverlay;action('show-collision').disabled=playtest;action('show-layers').disabled=playtest;field('mask-visible').checked=layerOverlay;field('mask-visible').disabled=playtest;action('undo').disabled=characterHistory()?!spriteUndo.length:!undo.length;action('redo').disabled=characterHistory()?!spriteRedo.length:!redo.length;action('playtest').setAttribute('aria-pressed',String(playtest));action('playtest').textContent=playtest?'■ Stop playtest':'▶ Playtest';panel.classList.toggle('room-dev-playtest',playtest);
   const entity=selectedEntity(),asset=selectedAsset();field('entity').replaceChildren(new win.Option('Select a room character or fish',''),...entities().map(item=>new win.Option(item.name||item.id,item.id)));field('entity').value=entity?.id||'';
   panel.querySelector('[data-room-entity-fields]').hidden=!entity;panel.querySelector('[data-room-fish-fields]').hidden=entity?.kind!=='fish';action('edit-character-artwork').hidden=!entity||entity.kind==='fish'||!characterArtwork?.getTargets().some(target=>target.id==='character.'+entity.id+'.down');
   if(entity){field('entity-x').value=Math.round(entity.x);field('entity-y').value=Math.round(entity.y);field('entity-visible').checked=entity.visible!==false;if(entity.kind==='fish'){field('species').replaceChildren(...(entity.speciesOptions||[]).map(option=>new win.Option(option.name,option.id)));field('species').value=entity.speciesId||'';field('fish-size').value=entity.size||1;field('fish-color').value=color(entity.color)?entity.color:'#557b92';field('fish-accent').value=color(entity.accent)?entity.accent:'#8edacb';}}
   field('asset').replaceChildren(new win.Option('Select room artwork',''),...project.assets.map(item=>new win.Option(item.name,item.id)));field('asset').value=asset?.id||'';panel.querySelector('[data-room-asset-fields]').hidden=!asset;
   if(asset){for(const key of ['name','x','y','w','h','layer'])field('asset-'+key).value=asset[key];field('asset-rotation').value=asset.rotation||0;action('asset-flip-x').setAttribute('aria-pressed',String(asset.flipX===true));action('asset-flip-y').setAttribute('aria-pressed',String(asset.flipY===true));field('asset-visible').checked=asset.visible;field('asset-solid').checked=!!asset.solid;field('ignore-background-masks').checked=asset.ignoreBackgroundMasks===true;panel.querySelector('[data-room-origin-fields]').hidden=!asset.origin;if(asset.origin){field('sample-x').value=asset.origin.sample[0];field('sample-y').value=asset.origin.sample[1];}}
   for(const name of ['asset-flip-x','asset-flip-y','asset-rotate-left','asset-rotate-right'])action(name).disabled=!asset||!canMutateUI();field('asset-rotation').disabled=!asset||!canMutateUI();
   if(tab==='sprites'&&opened){mountSprites();pixelEditor?.refresh();}
   if(tab==='artwork'&&opened){mountArtwork();artworkEditor?.refresh();}
   if(tab==='education'&&opened){if(playtest)educationEditor?.setActive(false);else{mountEducation();educationEditor?.refresh();}}
  }
  function editEntity(patch){if(!canMutateUI())return;const entity=selectedEntity();if(!entity)return;const before=snapshot();project.entities[entity.id]={...(project.entities[entity.id]||{}),...patch};applyEntity(entity.id,project.entities[entity.id]);changed(before,'Saved '+(entity.name||'character')+' changes.');}
  function editAsset(patch){if(!canMutateUI())return;const asset=selectedAsset();if(!asset)return;const before=snapshot();Object.assign(asset,patch);changed(before);}
  function undoRedo(isUndo){if(!canMutateUI()){finishGesture();return;}finishGesture();if(characterHistory()){const from=isUndo?spriteUndo:spriteRedo,to=isUndo?spriteRedo:spriteUndo;if(!from.length)return;const next=from.pop();to.push(copy(api.getSharedSprites()||{}));api.setSharedSprites(copy(next));refresh();status(isUndo?'Undid sprite edit.':'Redid sprite edit.');return;}const from=isUndo?undo:redo,to=isUndo?redo:undo;if(!from.length)return;const entry=from.pop();if(entry&&typeof entry==='object'&&entry.kind==='sprites'){to.push({kind:'sprites',data:copy(api.getSharedSprites()||{})});api.setSharedSprites(copy(entry.data));refresh();status(isUndo?'Undid character artwork edit.':'Redid character artwork edit.');return;}const before=getProject();to.push(snapshot());applyProject(JSON.parse(entry));api.onProjectChange?.(before,getProject());refresh();status(isUndo?'Undid room edit.':'Redid room edit.');}
  function assetLocal(asset,point,flipped=false){const angle=-(asset.rotation||0)*Math.PI/180,cs=Math.cos(angle),sn=Math.sin(angle),dx=point.x-asset.x,dy=point.y-asset.y;return {x:(dx*cs-dy*sn)*(flipped&&asset.flipX?-1:1),y:(dx*sn+dy*cs)*(flipped&&asset.flipY?-1:1)};}
  function assetCorner(asset){const angle=(asset.rotation||0)*Math.PI/180,cs=Math.cos(angle),sn=Math.sin(angle);return {x:asset.x+asset.w/2*cs-asset.h/2*sn,y:asset.y+asset.w/2*sn+asset.h/2*cs};}
  function hit(point){
   const current=selectedAsset(),corner=current&&assetCorner(current);if(corner&&Math.hypot(point.x-corner.x,point.y-corner.y)<12/camera.zoom)return {type:'asset',id:current.id,resize:true};
   const currentEntity=selectedEntity();if(currentEntity?.kind==='fish'&&Math.hypot(point.x-(currentEntity.x+(currentEntity.w||50)/2),point.y-(currentEntity.y+(currentEntity.h||30)/2))<12/camera.zoom)return {type:'entity',id:currentEntity.id,resize:true};
   for(const entity of entities().slice().reverse()){const w=entity.w||40,h=entity.h||64,top=entity.kind==='fish'?entity.y-h/2:entity.y-h;if(Math.abs(point.x-entity.x)<=w/2+6/camera.zoom&&point.y>=top-6/camera.zoom&&point.y<=top+h+6/camera.zoom)return {type:'entity',id:entity.id};}
   for(const asset of project.assets.slice().reverse()){const local=assetLocal(asset,point);if(Math.abs(local.x)<=asset.w/2&&Math.abs(local.y)<=asset.h/2)return {type:'asset',id:asset.id};}return null;
  }
  function paintCollision(point){const radius=Number(field('collision-size').value),tool=field('collision-tool').value,cx=Math.floor(point.x/10),cy=Math.floor(point.y/10);for(let dy=0;dy<radius;dy++)for(let dx=0;dx<radius;dx++){const x=cx+dx-Math.floor(radius/2),y=cy+dy-Math.floor(radius/2);if(x<0||y<0||x>=COLS||y>=Math.ceil(H/10))continue;const index=y*COLS+x;if(tool==='restore')collisionMap.delete(index);else collisionMap.set(index,tool==='block'?0:1);}project.collision=Array.from(collisionMap).sort((a,b)=>a[0]-b[0]);}
  function layerPoint(point){return [clamp(Math.floor(point.x),0,W-1),clamp(Math.floor(point.y),0,H-1)];}
  function addStrokePoint(point){const stroke=project.strokes.at(-1),next=layerPoint(point),last=stroke.points.at(-1);if(!last||last[0]!==next[0]||last[1]!==next[1]){if(gesture?.shape==='line'&&stroke.points.length>1)stroke.points[1]=next;else stroke.points.push(next);}layerDirty=true;}
  function eachStrokePixel(points,size,stamp){const half=Math.floor(size/2);for(let index=0;index<points.length;index++){const previous=(points[index-1]||points[index]).map(Math.floor),next=points[index].map(Math.floor);let [x,y]=previous;const dx=Math.abs(next[0]-x),dy=Math.abs(next[1]-y),sx=x<next[0]?1:-1,sy=y<next[1]?1:-1;let error=dx-dy;for(;;){stamp(x-half,y-half,size,size);if(x===next[0]&&y===next[1])break;const twice=2*error;if(twice>-dy){error-=dy;x+=sx;}if(twice<dx){error+=dx;y+=sy;}}}}
  function brushPreview(){if(!active()||tab!=='layers'||layerSelecting||!brushHover||panTool||spaceHeld||pinching)return null;const size=Number(field('layer-size').value),half=Math.floor(size/2),[x,y]=layerPoint(brushHover);return{x:Math.max(0,x-half),y:Math.max(0,y-half),w:Math.min(W,x-half+size)-Math.max(0,x-half),h:Math.min(H,y-half+size)-Math.max(0,y-half),size,tool:field('layer-tool').value};}
  function begin(event){
   if(!canMutateUI())return;event.preventDefault();event.stopImmediatePropagation();canvas.focus({preventScroll:true});pointers.set(event.pointerId,{clientX:event.clientX,clientY:event.clientY});try{canvas.setPointerCapture(event.pointerId);}catch{}
   if(pointers.size===2){cancelGesture();const points=[...pointers.values()];pinching={distance:Math.hypot(points[0].clientX-points[1].clientX,points[0].clientY-points[1].clientY),zoom:camera.zoom};return;}
   if(event.button===1||event.button===2||panTool||spaceHeld){gesture={kind:'pan',id:event.pointerId,clientX:event.clientX,clientY:event.clientY};return;}
   if(event.button!==0)return;const point=toWorld(event.clientX,event.clientY),before=snapshot();brushHover=point;
   if(tab==='collision'){gesture={kind:'collision',id:event.pointerId,before,last:point};paintCollision(point);return;}
   if(tab==='layers'&&layerSelecting&&layerSelection){layerSelection.down(layerPoint(point));gesture={kind:'layer-select',id:event.pointerId};return;}
   if(tab==='layers'){project.strokes.push({tool:field('layer-tool').value,size:Number(field('layer-size').value),points:[]});gesture={kind:'layer',shape:field('layer-shape').value,id:event.pointerId,before};addStrokePoint(point);return;}
   if(tab!=='objects')return;
   if(mode==='sample'){const asset=selectedAsset();if(asset?.origin){asset.origin.sample=[clamp(Math.floor(point.x),0,W-1),clamp(Math.floor(point.y),0,H-1)];changed(before);}mode='select';return;}
   if(mode==='lift'){gesture={kind:'lift',id:event.pointerId,before,start:point,end:point};return;}
   const target=hit(point);selected=target;if(target){const object=target.type==='entity'?selectedEntity():selectedAsset();gesture={kind:target.resize?'resize':'move',id:event.pointerId,before,start:point,origin:copy(object),target};}refresh();
  }
  function move(event){
   if(!active())return;if(!canMutateUI()){cancelGesture();return;}event.preventDefault();event.stopImmediatePropagation();brushHover=toWorld(event.clientX,event.clientY);if(pointers.has(event.pointerId))pointers.set(event.pointerId,{clientX:event.clientX,clientY:event.clientY});
   if(pinching&&pointers.size===2){const points=[...pointers.values()],distance=Math.hypot(points[0].clientX-points[1].clientX,points[0].clientY-points[1].clientY);zoom(pinching.zoom*distance/Math.max(1,pinching.distance),{clientX:(points[0].clientX+points[1].clientX)/2,clientY:(points[0].clientY+points[1].clientY)/2});return;}
   if(!gesture||gesture.id!==event.pointerId)return;
   if(gesture.kind==='pan'){const rect=canvas.getBoundingClientRect();camera.x+=(gesture.clientX-event.clientX)*W/rect.width/camera.zoom;camera.y+=(gesture.clientY-event.clientY)*H/rect.height/camera.zoom;gesture.clientX=event.clientX;gesture.clientY=event.clientY;clampCamera();return;}
   const point=toWorld(event.clientX,event.clientY);
   if(gesture.kind==='collision'){const last=gesture.last,distance=Math.hypot(point.x-last.x,point.y-last.y),steps=Math.max(1,Math.ceil(distance/5));for(let i=1;i<=steps;i++)paintCollision({x:last.x+(point.x-last.x)*i/steps,y:last.y+(point.y-last.y)*i/steps});gesture.last=point;return;}
   if(gesture.kind==='layer-select'){layerSelection?.move(layerPoint(point));return;}
   if(gesture.kind==='layer'){addStrokePoint(point);return;}if(gesture.kind==='lift'){gesture.end=point;return;}
   const target=gesture.target,object=target.type==='entity'?selectedEntity():selectedAsset();if(!object)return;
   if(target.type==='entity'){
    const patch=gesture.kind==='resize'?{size:clamp((gesture.origin.size||1)*Math.max(.1,(point.x-gesture.origin.x)/(Math.max(1,gesture.origin.w||50)/2)),.25,4)}:{x:clamp(Math.round(gesture.origin.x+point.x-gesture.start.x),0,W),y:clamp(Math.round(gesture.origin.y+point.y-gesture.start.y),0,H)};
    project.entities[target.id]={...(project.entities[target.id]||{}),...patch};applyEntity(target.id,project.entities[target.id]);
   }else if(gesture.kind==='resize'){const local=assetLocal(gesture.origin,point),start=assetLocal(gesture.origin,gesture.start);object.w=clamp(Math.round(gesture.origin.w+(local.x-start.x)*2),1,W*2);object.h=clamp(Math.round(gesture.origin.h+(local.y-start.y)*2),1,H*2);}else{object.x=clamp(Math.round(gesture.origin.x+point.x-gesture.start.x),-W,W*2);object.y=clamp(Math.round(gesture.origin.y+point.y-gesture.start.y),-H,H*2);}
  }
  function finishGesture(){if(!canMutateUI()){pixelEditor?.cancelGesture();artworkEditor?.cancelGesture();cancelGesture();return;}pixelEditor?.finishGesture();artworkEditor?.finishGesture();const previous=gesture;gesture=null;if(!previous)return;
   if(previous.kind==='layer-select'){layerSelection?.end();refreshLayerSelection();return;}
   if(previous.kind==='lift'){
    const x=clamp(Math.floor(Math.min(previous.start.x,previous.end.x)),0,W-1),y=clamp(Math.floor(Math.min(previous.start.y,previous.end.y)),0,H-1),w=clamp(Math.ceil(Math.abs(previous.end.x-previous.start.x)),1,W-x),h=clamp(Math.ceil(Math.abs(previous.end.y-previous.start.y)),1,H-y);
    if(w>=3&&h>=3&&background()&&project.assets.length<150){const asset={id:'room-asset-'+Date.now().toString(36)+'-'+(++serial),name:'Lifted artwork '+(project.assets.length+1),x:x+w/2,y:y+h/2,w,h,layer:'world',visible:true,solid:false,origin:{bounds:[x,y,w,h],sample:[clamp(x+w+8,0,W-16),clamp(y+h+8,0,H-16)]}};project.assets.push(asset);selected={type:'asset',id:asset.id};}mode='select';
   }
   if(previous.before)changed(previous.before);refresh();
  }
  function cancelGesture(){
   const previous=gesture;gesture=null;
   if(previous?.kind==='layer-select')layerSelection?.cancel();
   if(previous?.before&&previous.before!==snapshot()){
    const oldEntities=project.entities;project=JSON.parse(previous.before);collisionMap=new Map(project.collision);layerDirty=true;applyEntities(oldEntities);
    // A freely swimming fish may not have a saved override yet. Restore its
    // live position from before the drag without adding a persistent override.
    if(previous.target?.type==='entity'&&previous.origin){const patch={};for(const key of ENTITY_FIELDS)if(Object.hasOwn(previous.origin,key))patch[key]=previous.origin[key];api.onEntityChange?.(previous.target.id,patch);entityVersions.set(previous.target.id,JSON.stringify(project.entities[previous.target.id]||{}));}
   }
   if(previous?.kind==='lift')mode='select';
   refresh();
  }
  function end(event){if(!active())return;if(!canMutateUI())cancelGesture();event.preventDefault();event.stopImmediatePropagation();pointers.delete(event.pointerId);if(pointers.size<2)pinching=null;if(gesture?.id===event.pointerId)finishGesture();try{if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);}catch{}}
  function cancel(event){
   if(active()){event.preventDefault();event.stopImmediatePropagation();}
   pointers.delete(event.pointerId);if(pointers.size<2)pinching=null;
   if(gesture?.id===event.pointerId)cancelGesture();
   try{if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);}catch{}
  }
  function wheel(event){if(!active())return;event.preventDefault();event.stopImmediatePropagation();finishGesture();zoom(camera.zoom+(event.deltaY<0?.25:-.25),event);}
  function typing(target){return target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName);}
  function keyDown(event){
   if(event.target?.closest?.('[data-education-editor]')&&event.key!=='F2')return;
   const insideArtwork=event.target?.closest?.('[data-artwork-editor]'),insideSprites=event.target?.closest?.('.pixel-editor');
   if(event.key!=='F2'&&(insideArtwork||insideSprites&&(!(event.ctrlKey||event.metaKey)||!['z','y'].includes(event.key.toLowerCase()))))return;
   if(host.hidden||destroyed)return;if(opened&&tab==='artwork'&&artworkEditor?.getState().expanded&&event.key==='Escape')return;if(event.key==='F2'&&!typing(event.target)){event.preventDefault();event.stopImmediatePropagation();toggle();return;}
   if(!opened)return;if(active()&&tab==='layers'&&event.key==='Escape'&&!typing(event.target)&&(layerSelection?.getState().draft||layerSelection?.getSelection())){event.preventDefault();event.stopImmediatePropagation();cancelGesture();if(layerSelection?.getState().draft)layerSelection.cancel();else layerSelection?.clear();status('Layer selection cancelled.');return;}if(tab==='artwork'&&event.target?.closest?.('[data-artwork-editor]')&&event.key==='Escape'&&artworkEditor?.getState().stroke)return;if(event.key==='Escape'&&!typing(event.target)){event.preventDefault();event.stopImmediatePropagation();if(playtest){playtest=false;api.onActiveChange?.(true);refresh();}else close();return;}
   if(!active())return;
   if(event.key==='Tab')return;
   if(typing(event.target)){event.stopImmediatePropagation();return;}
   if(event.target?.closest?.('button')&&panel.contains(event.target)&&['Enter',' '].includes(event.key)){event.stopImmediatePropagation();return;}
   if((tab==='sprites'&&event.target?.closest?.('.pixel-editor')||tab==='artwork'&&event.target?.closest?.('[data-artwork-editor]'))&&!event.ctrlKey&&!event.metaKey)return;
   event.preventDefault();event.stopImmediatePropagation();const key=event.key.toLowerCase();
   if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.repeat&&(key==='c'||key==='l')){toggleTool(key==='c'?'collision':'layers');return;}
   if((event.ctrlKey||event.metaKey)&&key==='z'){undoRedo(!event.shiftKey);return;}if((event.ctrlKey||event.metaKey)&&key==='y'){undoRedo(false);return;}
   if(tab==='layers'&&key==='enter'&&layerSelection?.getState().draft){finishLayerSelection();return;}
   if(event.code==='Space'){spaceHeld=true;refreshCamera();return;}if(['+','=','-','_','0'].includes(key)){zoom(key==='0'?1:camera.zoom+(['+','='].includes(key)?.25:-.25));return;}
   if((key==='delete'||key==='backspace')&&selectedAsset()){action('asset-remove').click();return;}
   const dx=key==='arrowright'?1:key==='arrowleft'?-1:0,dy=key==='arrowdown'?1:key==='arrowup'?-1:0;if(dx||dy){const amount=event.shiftKey?10:1,entity=selectedEntity(),asset=selectedAsset();if(entity)editEntity({x:clamp(entity.x+dx*amount,0,W),y:clamp(entity.y+dy*amount,0,H)});else if(asset)editAsset({x:asset.x+dx*amount,y:asset.y+dy*amount});else{camera.x+=dx*30/camera.zoom;camera.y+=dy*30/camera.zoom;clampCamera();}}
  }
  function keyUp(event){if(event.target?.closest?.('[data-education-editor]'))return;if(event.code==='Space'){spaceHeld=false;refreshCamera();}if(event.target?.closest?.('button')&&panel.contains(event.target)&&['Enter',' '].includes(event.key)){event.stopImmediatePropagation();return;}if(active()&&!typing(event.target)&&!(tab==='sprites'&&event.target?.closest?.('.pixel-editor')||tab==='artwork'&&event.target?.closest?.('.artwork-editor'))){event.preventDefault();event.stopImmediatePropagation();}}
  function blur(){spaceHeld=false;brushHover=null;cancelGesture();layerSelection?.cancel();pixelEditor?.cancelGesture();artworkEditor?.cancelGesture();for(const pointerId of pointers.keys())try{if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);}catch{}pointers.clear();pinching=null;refreshCamera();}
  function getImage(asset){if(!asset.data)return null;let image=images.get(asset.data);if(!image){image=new win.Image();image.onload=()=>{layerDirty=true;};images.set(asset.data,image);image.src=asset.data;}return image.complete&&image.naturalWidth?image:null;}
  function assetSource(asset){
   if(asset.data)return getImage(asset);
   const image=background();if(!asset.origin||!image)return null;
   const [x,y,w,h]=asset.origin.bounds,sx=(image.naturalWidth||image.width)/W,sy=(image.naturalHeight||image.height)/H;
   const key='source:'+asset.id,cached=assetArtworkCache.get(key);if(cached?.source===image&&cached.origin===JSON.stringify(asset.origin.bounds))return cached.canvas;
   const canvas=doc.createElement('canvas');canvas.width=Math.max(1,Math.round(w*sx));canvas.height=Math.max(1,Math.round(h*sy));const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,x*sx,y*sy,w*sx,h*sy,0,0,canvas.width,canvas.height);assetArtworkCache.set(key,{source:image,origin:JSON.stringify(asset.origin.bounds),canvas});return canvas;
  }
  function drawAsset(ctx,asset){
   if(!asset.visible)return;let image=assetSource(asset);if(!image)return;
   if(asset.artwork&&win.CodaArtworkEditor?.validateTexture(asset.artwork,image.naturalWidth||image.width,image.naturalHeight||image.height)){const cached=assetArtworkCache.get(asset.id);if(cached?.source===image&&cached.texture===asset.artwork)image=cached.canvas;else{const composed=win.CodaArtworkEditor.compose(image,asset.artwork);assetArtworkCache.set(asset.id,{source:image,texture:asset.artwork,canvas:composed});image=composed||image;}}
   ctx.save();ctx.translate(asset.x,asset.y);ctx.rotate((asset.rotation||0)*Math.PI/180);ctx.scale(asset.flipX?-1:1,asset.flipY?-1:1);ctx.imageSmoothingEnabled=false;ctx.drawImage(image,-asset.w/2,-asset.h/2,asset.w,asset.h);ctx.restore();
  }
  function hasArtworkAssetPreview(target){return target===backgroundId;}
  function drawArtworkAssetPreview(ctx,{target,width,height}){
   if(!hasArtworkAssetPreview(target))return;const source=backgroundBase();ctx.save();ctx.scale((width||source?.naturalWidth||source?.width||W)/W,(height||source?.naturalHeight||source?.height||H)/H);
   try{for(const layer of ['background','world','foreground'])for(const asset of project.assets)if(asset.layer===layer)drawAsset(ctx,asset);}finally{ctx.restore();}
  }
  function drawPatches(ctx){const image=background();if(!image)return;const sx=(image.naturalWidth||image.width)/W,sy=(image.naturalHeight||image.height)/H;for(const asset of project.assets){if(!asset.origin)continue;const [x,y,w,h]=asset.origin.bounds,[sampleX,sampleY]=asset.origin.sample,tile=Math.min(16,W-sampleX,H-sampleY);if(tile<1)continue;ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();for(let yy=y;yy<y+h;yy+=tile)for(let xx=x;xx<x+w;xx+=tile)ctx.drawImage(image,sampleX*sx,sampleY*sy,tile*sx,tile*sy,xx,yy,tile,tile);ctx.restore();}}
  function maskPath(pixels,inverse=false){
   const path=new win.Path2D();if(inverse)path.rect(0,0,W,H);
   for(let y=0;y<H;y++)for(let x=0;x<W;){
    if(pixels[(y*W+x)*4+3]<128){x++;continue;}
    const left=x;while(x<W&&pixels[(y*W+x)*4+3]>=128)x++;
    path.rect(left,y,x-left,1);
   }
   return path;
  }
  function buildMask(){
   const image=background(),stamp=image?(image.src||'')+':'+(image.naturalWidth||image.width)+'x'+(image.naturalHeight||image.height):'';
   if(image!==maskImageSource||stamp!==maskImageStamp){maskImageSource=image;maskImageStamp=stamp;layerDirty=true;}
   if(!layerDirty)return;
   if(!maskCanvas){
    maskCanvas=doc.createElement('canvas');maskCanvas.width=W;maskCanvas.height=H;
    erasedCanvas=doc.createElement('canvas');erasedCanvas.width=W;erasedCanvas.height=H;
    promotedCanvas=doc.createElement('canvas');promotedCanvas.width=W;promotedCanvas.height=H;
   }
   const ctx=maskCanvas.getContext('2d',{willReadFrequently:true}),erased=erasedCanvas.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,W,H);erased.clearRect(0,0,W,H);
   for(const stroke of project.strokes){
    ctx.globalCompositeOperation=stroke.tool==='erase'?'destination-out':'source-over';ctx.fillStyle='#69ffd0';
    erased.globalCompositeOperation=stroke.tool==='paint'?'destination-out':'source-over';erased.fillStyle='#fff';
    const stamp=(x,y,w,h)=>{ctx.fillRect(x,y,w,h);erased.fillRect(x,y,w,h);};
    if(stroke.selection)win.CodaLayerSelection.eachSpan(stroke.selection,stamp);else eachStrokePixel(stroke.points,stroke.size,stamp);
   }
   ctx.globalCompositeOperation=erased.globalCompositeOperation='source-over';
   const painted=ctx.getImageData(0,0,W,H).data,sentBack=erased.getImageData(0,0,W,H).data;
   paintPath=maskPath(painted);erasePath=maskPath(sentBack);outsidePaintPath=maskPath(painted,true);
   normalPath=new win.Path2D(outsidePaintPath);normalPath.addPath(erasePath);
   const promoted=promotedCanvas.getContext('2d');promoted.clearRect(0,0,W,H);
   if(image){promoted.imageSmoothingEnabled=false;promoted.drawImage(image,0,0,W,H);drawPatches(promoted);}
   promoted.globalCompositeOperation='destination-in';promoted.drawImage(maskCanvas,0,0);promoted.globalCompositeOperation='source-over';
   // Cleaned room pixels and asset fragments share world-space masks. Never
   // disable a painted rectangle merely because its original art was lifted.
   layerDirty=false;maskBuilds++;
  }
  function beforeActor(asset,playerY){return asset.layer==='background'||asset.layer==='world'&&asset.y+asset.h/2<=playerY;}
  function drawAssets(ctx,predicate,path){
   // Choose each asset's clip without regrouping them, so translucent images
   // retain their authored list order when only some bypass background masks.
   for(const asset of project.assets){
    if(!predicate(asset))continue;const clip=typeof path==='function'?path(asset):path;
    ctx.save();if(clip)ctx.clip(clip,'evenodd');drawAsset(ctx,asset);ctx.restore();
   }
  }
  function beforeScene(ctx){ctx.save();if(active()){clampCamera();ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);}}
  function afterBackground(ctx,playerY=H){
   drawPatches(ctx);
   if(!project.strokes.length){drawAssets(ctx,asset=>beforeActor(asset,playerY));return;}
   buildMask();
   drawAssets(ctx,asset=>beforeActor(asset,playerY),outsidePaintPath);
   drawAssets(ctx,asset=>!beforeActor(asset,playerY)&&asset.ignoreBackgroundMasks!==true,erasePath);
  }
  function afterScene(ctx,playerY=H){
   if(!project.strokes.length)drawAssets(ctx,asset=>!beforeActor(asset,playerY));
   else{
    buildMask();drawAssets(ctx,asset=>!beforeActor(asset,playerY),asset=>asset.ignoreBackgroundMasks===true?outsidePaintPath:normalPath);
    ctx.drawImage(promotedCanvas,0,0);
    // Preserve the same object order on both sides of the actor. The painted
    // pieces use their current image, alpha, position and size instead of a
    // frozen background sample, and the erase mask can lower any asset layer.
    drawAssets(ctx,asset=>beforeActor(asset,playerY),paintPath);
    drawAssets(ctx,asset=>!beforeActor(asset,playerY),paintPath);
   }
   if(active())drawOverlay(ctx);ctx.restore();
  }
  function drawOverlay(ctx){
   ctx.save();ctx.lineWidth=1/camera.zoom;
   if(layerOverlay){ctx.fillStyle='#58a9ff1f';ctx.fillRect(0,0,W,H);if(maskCanvas&&project.strokes.length){ctx.save();ctx.globalAlpha=.58;ctx.drawImage(maskCanvas,0,0);ctx.restore();}for(const asset of project.assets){if(!asset.visible)continue;const color=asset.layer==='background'?'#70b6ff':asset.layer==='foreground'?'#69ffd0':'#ffd46b';ctx.strokeStyle=color;ctx.lineWidth=2/camera.zoom;ctx.save();ctx.translate(asset.x,asset.y);ctx.rotate((asset.rotation||0)*Math.PI/180);ctx.strokeRect(-asset.w/2,-asset.h/2,asset.w,asset.h);ctx.fillStyle=color;ctx.font=11/camera.zoom+'px monospace';ctx.fillText((asset.layer==='background'?'Background':asset.layer==='foreground'?'Foreground':'Actor depth')+' · '+asset.name,-asset.w/2,-asset.h/2-4/camera.zoom);ctx.restore();}}
   if(collisionOverlay){const x0=Math.max(0,Math.floor(camera.x/10)),y0=Math.max(0,Math.floor(camera.y/10)),x1=Math.min(COLS,Math.ceil((camera.x+W/camera.zoom)/10)),y1=Math.min(Math.ceil(H/10),Math.ceil((camera.y+H/camera.zoom)/10));for(let cy=y0;cy<y1;cy++)for(let cx=x0;cx<x1;cx++){const x=cx*10,y=cy*10,base=api.baseWalkable?api.baseWalkable(x+5,y+5):true,value=walkable(x+5,y+5,base);ctx.fillStyle=value?'#48ebb03d':'#ff3e663d';ctx.fillRect(x,y,Math.min(10,W-x),Math.min(10,H-y));}ctx.lineWidth=1.5/camera.zoom;for(const [index,value]of collisionMap){const x=index%COLS*10,y=Math.floor(index/COLS)*10;ctx.strokeStyle=value?'#75ffd0':'#ff8094';ctx.strokeRect(x+.5/camera.zoom,y+.5/camera.zoom,10-1/camera.zoom,10-1/camera.zoom);}}
   const preview=brushPreview();if(preview){ctx.fillStyle=preview.tool==='paint'?'#64ffe080':'#ffcc6480';const stroke=gesture?.kind==='layer'&&gesture.shape==='line'?project.strokes.at(-1):null;if(stroke)eachStrokePixel(stroke.points,stroke.size,(x,y,w,h)=>ctx.fillRect(x,y,w,h));else ctx.fillRect(preview.x,preview.y,preview.w,preview.h);const scale=camera.zoom*canvas.getBoundingClientRect().width/W,line=1/Math.max(.001,scale);if(!stroke&&preview.w>line&&preview.h>line){ctx.lineWidth=line;ctx.strokeStyle=preview.tool==='paint'?'#64ffe0':'#ffcc64';ctx.strokeRect(preview.x+line/2,preview.y+line/2,preview.w-line,preview.h-line);}}
   if(tab==='layers')layerSelection?.draw(ctx,camera.zoom*canvas.getBoundingClientRect().width/W);
   if(tab==='objects'){const entity=selectedEntity(),asset=selectedAsset();ctx.strokeStyle='#ffe19a';ctx.lineWidth=2/camera.zoom;
    if(asset){const corner=assetCorner(asset);ctx.save();ctx.translate(asset.x,asset.y);ctx.rotate((asset.rotation||0)*Math.PI/180);ctx.strokeRect(-asset.w/2,-asset.h/2,asset.w,asset.h);ctx.restore();ctx.fillStyle='#ffce65';ctx.fillRect(corner.x-4/camera.zoom,corner.y-4/camera.zoom,8/camera.zoom,8/camera.zoom);}
    else if(entity){const w=entity.w||40,h=entity.h||64,top=entity.kind!=='fish'?entity.y-h:entity.y-h/2,left=entity.x-w/2;ctx.strokeRect(left,top,w,h);if(entity.kind==='fish'){ctx.fillStyle='#ffce65';ctx.fillRect(entity.x+w/2-4/camera.zoom,entity.y+h/2-4/camera.zoom,8/camera.zoom,8/camera.zoom);}}
   }
   if(gesture?.kind==='lift'){ctx.strokeStyle='#ffe19a';ctx.setLineDash([5/camera.zoom,4/camera.zoom]);ctx.strokeRect(gesture.start.x,gesture.start.y,gesture.end.x-gesture.start.x,gesture.end.y-gesture.start.y);}ctx.restore();
  }
  function walkable(x,y,base){if(!finite(x,0,W-.001)||!finite(y,0,H-.001))return false;const cell=collisionMap.get(Math.floor(y/10)*COLS+Math.floor(x/10));if(cell!==undefined)return cell===1;for(const asset of project.assets){if(!asset.visible||!asset.solid)continue;const local=assetLocal(asset,{x,y},true);if(Math.abs(local.x)<asset.w*.4&&local.y>asset.h*.2&&local.y<asset.h*.5)return false;}return !!base;}
  function exportProject(){finishGesture();const value={format:'CodaArcadeRoomProject',room:id,width:W,height:H,...getProject()},blob=new win.Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=win.URL.createObjectURL(blob),link=doc.createElement('a');link.href=url;link.download='coda-'+id+'-room.json';link.click();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);status('Exported room project JSON.');}
  button.onclick=toggle;action('close').onclick=close;action('dock').onclick=()=>panel.classList.toggle('room-dev-dock-right');for(const node of panel.querySelectorAll('[data-room-tab]'))node.onclick=()=>setTab(node.dataset.roomTab);
  action('show-collision').onclick=()=>setOverlay('collision',!collisionOverlay);action('show-layers').onclick=()=>setOverlay('layers',!layerOverlay);field('mask-visible').onchange=()=>setOverlay('layers',field('mask-visible').checked);
  action('zoom-in').onclick=()=>zoom(camera.zoom+.25);action('zoom-out').onclick=()=>zoom(camera.zoom-.25);action('zoom-reset').onclick=()=>zoom(1);action('pan').onclick=()=>{finishGesture();panTool=!panTool;refreshCamera();};action('undo').onclick=()=>undoRedo(true);action('redo').onclick=()=>undoRedo(false);
  action('playtest').onclick=()=>{finishGesture();layerSelection?.cancel();playtest=!playtest;api.onActiveChange?.(!playtest);refresh();status(playtest?'Playtest: room walking uses your current edits.':'Editing resumed.');canvas.focus({preventScroll:true});};
  action('layer-select').onclick=()=>{if(!canMutateUI()||!layerSelection)return;finishGesture();layerSelecting=true;refreshLayerSelection();status('Drag a rectangle, or choose Manual shape and click its corners.');canvas.focus({preventScroll:true});};
  action('layer-brush').onclick=()=>{if(!canMutateUI())return;finishGesture();layerSelection?.cancel();layerSelecting=false;refreshLayerSelection();canvas.focus({preventScroll:true});};
  field('layer-selection-shape').onchange=()=>{if(!canMutateUI())return;finishGesture();layerSelecting=true;layerSelection?.setShape(field('layer-selection-shape').value);refreshLayerSelection();};
  action('layer-fill').onclick=fillLayerSelection;action('layer-finish').onclick=finishLayerSelection;action('layer-clear').onclick=()=>{if(!canMutateUI())return;cancelGesture();layerSelection?.clear();status('Layer selection cleared. Artwork and layer edits kept.');};
  for(const name of ['layer-tool','layer-size','layer-shape'])field(name).onchange=()=>finishGesture();
  field('entity').onchange=()=>{selected=field('entity').value?{type:'entity',id:field('entity').value}:null;refresh();};field('asset').onchange=()=>{selected=field('asset').value?{type:'asset',id:field('asset').value}:null;refresh();};
  for(const key of ['x','y'])field('entity-'+key).onchange=()=>editEntity({[key]:clamp(Number(field('entity-'+key).value)||0,0,key==='x'?W:H)});
  field('species').onchange=()=>{const entity=selectedEntity();if(entity?.speciesOptions?.some(option=>option.id===field('species').value))editEntity({speciesId:field('species').value});};field('fish-size').onchange=()=>editEntity({size:clamp(Number(field('fish-size').value)||1,.25,4)});field('fish-color').onchange=()=>editEntity({color:field('fish-color').value});field('fish-accent').onchange=()=>editEntity({accent:field('fish-accent').value});field('entity-visible').onchange=()=>editEntity({visible:field('entity-visible').checked});
  action('edit-character-artwork').onclick=()=>{const entity=selectedEntity();if(!entity)return;setTab('artwork');artworkEditor?.selectTarget('character.'+entity.id+'.down');};
  action('entity-reset').onclick=()=>{if(!canMutateUI())return;const entity=selectedEntity();if(!entity)return;const before=snapshot();delete project.entities[entity.id];api.onEntityChange?.(entity.id,{});entityVersions.set(entity.id,'{}');changed(before,'Restored character / fish defaults.');};
  for(const key of ['name','x','y','w','h','layer'])field('asset-'+key).onchange=()=>{let value=field('asset-'+key).value;if(['x','y','w','h'].includes(key))value=clamp(Number(value)||1,key==='w'||key==='h'?1:key==='x'?-W:-H,key==='x'||key==='w'?W*2:H*2);editAsset({[key]:value});};field('asset-visible').onchange=()=>editAsset({visible:field('asset-visible').checked});field('asset-solid').onchange=()=>editAsset({solid:field('asset-solid').checked});field('ignore-background-masks').onchange=()=>editAsset({ignoreBackgroundMasks:field('ignore-background-masks').checked});
  field('asset-rotation').onchange=()=>{const value=Number(field('asset-rotation').value);if(Number.isFinite(value))editAsset({rotation:clamp(value,-3600,3600)});else refresh();};
  action('asset-flip-x').onclick=()=>{const asset=selectedAsset();if(asset)editAsset({flipX:asset.flipX!==true});};action('asset-flip-y').onclick=()=>{const asset=selectedAsset();if(asset)editAsset({flipY:asset.flipY!==true});};
  for(const [name,delta]of [['asset-rotate-left',-90],['asset-rotate-right',90]])action(name).onclick=()=>{const asset=selectedAsset();if(asset)editAsset({rotation:((((asset.rotation||0)+delta+180)%360)+360)%360-180});};
  for(const [key,index]of [['sample-x',0],['sample-y',1]])field(key).onchange=()=>{if(!canMutateUI())return;const asset=selectedAsset();if(!asset?.origin)return;const before=snapshot();asset.origin.sample[index]=clamp(Number(field(key).value)||0,0,index?H-1:W-1);changed(before);};
  action('edit-artwork').onclick=()=>{const asset=selectedAsset();if(!asset)return;setTab('artwork');artworkEditor?.selectTarget(assetPrefix+asset.id);};
  action('pick-sample').onclick=()=>{mode='sample';status('Click a clean floor or wall area to use as the source patch.');canvas.focus({preventScroll:true});};action('lift').onclick=()=>{if(!background()){status('Wait for the room artwork to load before lifting a region.');return;}mode='lift';status('Drag a rectangle around the artwork to move.');canvas.focus({preventScroll:true});};
  action('asset-remove').onclick=()=>{const asset=selectedAsset();if(asset)editAsset({visible:false});};action('asset-restore').onclick=()=>{if(!canMutateUI())return;const asset=selectedAsset();if(!asset)return;const before=snapshot();project.assets=project.assets.filter(item=>item.id!==asset.id);selected=null;changed(before,'Restored original room artwork.');};
  action('add-image').onclick=()=>field('image-file').click();field('image-file').onchange=async event=>{const file=event.target.files?.[0];event.target.value='';if(!file||!canMutateUI())return;try{if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>8*1024*1024||project.assets.length>=150)throw Error('Choose PNG, JPEG, WebP, or GIF artwork up to 8 MB.');const data=await new Promise((resolve,reject)=>{const reader=new win.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);}),image=await new Promise((resolve,reject)=>{const image=new win.Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=data;});if(destroyed||!canMutateUI())return;if(image.width>8192||image.height>8192)throw Error('Image exceeds 8192 pixels.');const before=snapshot(),scale=Math.min(1,250/image.width,200/image.height),asset={id:'room-asset-'+Date.now().toString(36)+'-'+(++serial),name:file.name.slice(0,100),x:camera.x+W/camera.zoom/2,y:camera.y+H/camera.zoom/2,w:Math.max(1,Math.round(image.width*scale)),h:Math.max(1,Math.round(image.height*scale)),data,layer:'world',visible:true,solid:false};project.assets.push(asset);selected={type:'asset',id:asset.id};changed(before);}catch(error){status(error.message||'The image could not load.');}};
  action('save').onclick=()=>{if(!canMutateUI()){finishGesture();status('Editing is unavailable. The current project was kept.');return;}finishGesture();if(persist())status('Saved '+(api.name||'room')+' edits in this browser.');};action('export').onclick=exportProject;action('import').onclick=()=>field('project-file').click();field('project-file').onchange=async event=>{const file=event.target.files?.[0];event.target.value='';if(!file||!canMutateUI())return;try{if(file.size>20*1024*1024)throw Error('Room project is too large.');const data=JSON.parse(await file.text());if(data.room&&data.room!==id||data.width&&data.width!==W||data.height&&data.height!==H)throw Error('Choose a project exported from this room.');if(!validProject(data,W,H))throw Error('This is not a valid room project. The current edits were kept.');await Promise.all(data.assets.filter(asset=>asset.data).map(asset=>new Promise((resolve,reject)=>{const image=new win.Image();image.onload=()=>image.naturalWidth>8192||image.naturalHeight>8192?reject(Error('An embedded image exceeds 8192 pixels.')):asset.artwork&&!win.CodaArtworkEditor?.validateTexture(asset.artwork,image.naturalWidth,image.naturalHeight)?reject(Error('Edited artwork dimensions do not match the embedded image.')):resolve();image.onerror=()=>reject(Error('An embedded image could not be decoded. Current edits were kept.'));image.src=asset.data;})));if(destroyed)return;if(!await validateArtworkProject(data))throw Error('Edited artwork dimensions do not match this room. Current edits were kept.');if(!canMutateUI())return;const before=snapshot();if(!applyProject(data,{persist:false}))return;changed(before,'Imported room project. Undo is available.');}catch(error){status(error.message||'Could not read room project.');}};
  action('reset').onclick=()=>{if(!canMutateUI())return;const before=snapshot();applyProject(EMPTY(),{persist:false});changed(before,'Restored the original room. Undo is available.');};
  const leave=()=>{if(!gesture)brushHover=null;};canvas.addEventListener('pointerleave',leave,true);
  canvas.addEventListener('pointerdown',begin,true);canvas.addEventListener('pointermove',move,true);canvas.addEventListener('pointerup',end,true);canvas.addEventListener('pointercancel',cancel,true);canvas.addEventListener('lostpointercapture',cancel,true);canvas.addEventListener('dblclick',doubleClick,true);canvas.addEventListener('wheel',wheel,{capture:true,passive:false});const contextMenu=event=>{if(active()){event.preventDefault();event.stopImmediatePropagation();}};canvas.addEventListener('contextmenu',contextMenu,true);
  win.addEventListener('keydown',keyDown,true);win.addEventListener('keyup',keyUp,true);win.addEventListener('blur',blur);
  try{const raw=storage?.getItem(store);localProjectPresent=raw!==null&&raw!==undefined;if(raw){const saved=JSON.parse(raw);if(validProject(saved,W,H)){if(saved.artwork||saved.assets.some(asset=>asset.artwork)){const revision=projectRevision;validateArtworkProject(saved).then(valid=>{if(destroyed||revision!==projectRevision)return;if(valid)applyProject(saved,{persist:false});else{loadError='Saved pixel artwork dimensions do not match this room. Import a valid backup.';status(loadError);}});}else applyProject(saved,{persist:false});}else loadError='Saved room edits are invalid. Original room kept; import a valid backup.';}}catch{loadError='Saved room edits could not load. Original room kept.';}
  refresh();
  function destroy(){if(destroyed)return;close();educationEditor?.dispose();destroyed=true;canvas.removeEventListener('pointerleave',leave,true);canvas.removeEventListener('pointerdown',begin,true);canvas.removeEventListener('pointermove',move,true);canvas.removeEventListener('pointerup',end,true);canvas.removeEventListener('pointercancel',cancel,true);canvas.removeEventListener('lostpointercapture',cancel,true);canvas.removeEventListener('dblclick',doubleClick,true);canvas.removeEventListener('wheel',wheel,true);canvas.removeEventListener('contextmenu',contextMenu,true);win.removeEventListener('keydown',keyDown,true);win.removeEventListener('keyup',keyUp,true);win.removeEventListener('blur',blur);pixelEditor?.dispose();artworkEditor?.dispose();panel.remove();button.remove();images.clear();}
  return {open,close,toggle,isOpen:()=>opened,isEditing:active,isPlaytest:()=>opened&&playtest,hasLocalProject:()=>localProjectPresent,getProject,getCommittedProject,applyProject,validateArtworkProject,getBackground:background,getArtworkEditor:()=>artworkEditor,getArtworkTargets:artworkTargets,getArtworkSource,getArtworkData,setArtworkData,hasArtworkAssetPreview,drawArtworkAssetPreview,getBackgroundArtwork:()=>project.artwork?copy(project.artwork):null,setBackgroundArtwork:value=>{const next=getArtworkData();if(value)next[backgroundId]=value;else delete next[backgroundId];return setArtworkData(next);},getEntityOverride:entityId=>copy(project.entities[entityId]||{}),toWorld,walkable,beforeScene,afterBackground,afterScene,destroy,getState:()=>({open:opened,editing:active(),playtest,tab,artwork:artworkEditor?.getState()||null,overlays:{collision:collisionOverlay,layers:layerOverlay,visible:active()},brush:brushPreview(),layerSelection:layerSelection?{...layerSelection.getState(),active:layerSelecting}:null,selected:copy(selected),camera:{...camera},panTool,undo:undo.length,redo:redo.length,renderCache:{maskBuilds},project:getProject()})};
 }
 root.createCodaRoomDeveloperEditor=createCodaRoomDeveloperEditor;
 root.CodaRoomDeveloperEditor={validateProject:validProject,emptyProject:EMPTY};
 if(typeof module==='object'&&module.exports)module.exports={createCodaRoomDeveloperEditor,validateProject:validProject,emptyProject:EMPTY};
})(typeof window==='object'?window:globalThis);
