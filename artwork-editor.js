/* Lossless, reversible artwork pixels. Only source-size images are allocated;
 * the editor viewport stays small even when a room is magnified 64 times. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaArtworkEditor=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const TILE=64,MAX_DIMENSION=8192,MAX_AREA=16777216,MAX_RUNS=262144;
 const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const safeId=id=>typeof id==='string'&&/^[a-z0-9._:-]{1,120}$/i.test(id)&&!id.split(/[.:]/).some(part=>['__proto__','prototype','constructor'].includes(part));
 const color=value=>typeof value==='string'&&/^#[0-9a-f]{8}$/i.test(value);
 const dimensions=(width,height)=>Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&width<=MAX_DIMENSION&&height<=MAX_DIMENSION&&width*height<=MAX_AREA;
 const clone=value=>JSON.parse(JSON.stringify(value));
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const pack=value=>{const text=value.slice(1);return (parseInt(text.slice(0,2),16)|parseInt(text.slice(2,4),16)<<8|parseInt(text.slice(4,6),16)<<16|parseInt(text.slice(6,8),16)<<24)>>>0;};
 const unpack=value=>'#'+[value&255,value>>>8&255,value>>>16&255,value>>>24&255].map(v=>v.toString(16).padStart(2,'0')).join('');
 function validateTexture(texture,width,height){
  if(!object(texture)||Object.keys(texture).some(key=>!['width','height','tiles'].includes(key))||!dimensions(texture.width,texture.height)||!object(texture.tiles))return false;
  if(width!==undefined&&texture.width!==width||height!==undefined&&texture.height!==height)return false;
  const keys=Object.keys(texture.tiles);if(keys.length>Math.ceil(texture.width/TILE)*Math.ceil(texture.height/TILE))return false;
  let count=0;
  for(const key of keys){
   if(!/^(0|[1-9]\d*),(0|[1-9]\d*)$/.test(key))return false;
   const [tx,ty]=key.split(',').map(Number),tw=Math.min(TILE,texture.width-tx*TILE),th=Math.min(TILE,texture.height-ty*TILE),runs=texture.tiles[key];
   if(tw<=0||th<=0||!Array.isArray(runs)||(count+=runs.length)>MAX_RUNS)return false;
   let end=0;
   for(const run of runs){
    if(!Array.isArray(run)||run.length!==3||!Number.isInteger(run[0])||!Number.isInteger(run[1])||run[0]<end||run[1]<1||run[0]+run[1]>th*TILE||!color(run[2]))return false;
    const last=run[0]+run[1]-1;
    if(tw<TILE&&(Math.floor(run[0]/TILE)!==Math.floor(last/TILE)||run[0]%TILE+run[1]>tw))return false;
    end=run[0]+run[1];
   }
  }
  return true;
 }
 function normalizeTexture(texture){
  if(!validateTexture(texture))return null;
  const result={width:texture.width,height:texture.height,tiles:{}};
  for(const key of Object.keys(texture.tiles).sort((a,b)=>{const [ax,ay]=a.split(',').map(Number),[bx,by]=b.split(',').map(Number);return ay-by||ax-bx;})){
   const runs=[];
   for(const [start,length,raw]of texture.tiles[key]){
    const value=raw.toLowerCase(),last=runs.at(-1);
    if(last&&last[0]+last[1]===start&&last[2]===value)last[1]+=length;
    else runs.push([start,length,value]);
   }
   if(runs.length)result.tiles[key]=runs;
  }
  return result;
 }
 function validate(data){
  if(!object(data)||Object.keys(data).length>1024)return false;
  let count=0;
  for(const [id,texture]of Object.entries(data)){
   if(!safeId(id)||!validateTexture(texture))return false;
   for(const runs of Object.values(texture.tiles))if((count+=runs.length)>MAX_RUNS)return false;
  }
  return true;
 }
 function normalize(data){
  if(!validate(data))return null;
  const result={};for(const id of Object.keys(data).sort()){const texture=normalizeTexture(data[id]);if(Object.keys(texture.tiles).length)result[id]=texture;}return result;
 }
 function dense(texture,width,height){
  const mask=new Uint8Array(width*height),values=new Uint32Array(width*height);
  if(texture)for(const [key,runs]of Object.entries(texture.tiles)){
   const [tx,ty]=key.split(',').map(Number);
   for(const [start,length,value]of runs){const rgba=pack(value);for(let i=start;i<start+length;i++){const at=(ty*TILE+Math.floor(i/TILE))*width+tx*TILE+i%TILE;mask[at]=1;values[at]=rgba;}}
  }
  return {mask,values};
 }
 function fromDense(width,height,mask,values){
  const texture={width,height,tiles:{}},colors=new Map();
  for(let ty=0;ty<Math.ceil(height/TILE);ty++)for(let tx=0;tx<Math.ceil(width/TILE);tx++){
   const runs=[],tw=Math.min(TILE,width-tx*TILE),th=Math.min(TILE,height-ty*TILE);
   for(let yy=0;yy<th;yy++)for(let xx=0;xx<tw;xx++){
    const at=(ty*TILE+yy)*width+tx*TILE+xx;if(!mask[at])continue;
    const value=values[at];if(!colors.has(value))colors.set(value,unpack(value));const text=colors.get(value),index=yy*TILE+xx,last=runs.at(-1);
    if(last&&last[0]+last[1]===index&&last[2]===text)last[1]++;else runs.push([index,1,text]);
   }
   if(runs.length)texture.tiles[tx+','+ty]=runs;
  }
  return texture;
 }
 function changePixels(data,id,width,height,points,value){
  if(!validate(data)||!safeId(id)||!dimensions(width,height)||data[id]&&!validateTexture(data[id],width,height)||!(value===undefined||value===null||color(value)))return null;
  const next=clone(data),{mask,values}=dense(data[id],width,height),rgba=value===undefined?0:pack(value===null?'#00000000':value);
  for(const point of points){if(!Array.isArray(point)||point.length!==2)continue;const [x,y]=point;if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height)continue;const at=y*width+x;mask[at]=value===undefined?0:1;values[at]=rgba;}
  const texture=fromDense(width,height,mask,values);if(Object.keys(texture.tiles).length)next[id]=texture;else delete next[id];return normalize(next);
 }
 function composePixels(original,texture){
  if(!validateTexture(texture)||!original||original.length!==texture.width*texture.height*4)throw Error('Artwork dimensions do not match its original pixels.');
  const result=new Uint8ClampedArray(original);
  for(const [key,runs]of Object.entries(texture.tiles)){
   const [tx,ty]=key.split(',').map(Number);
   for(const [start,length,value]of runs){const rgba=pack(value);for(let i=start;i<start+length;i++){const at=((ty*TILE+Math.floor(i/TILE))*texture.width+tx*TILE+i%TILE)*4;result[at]=rgba&255;result[at+1]=rgba>>>8&255;result[at+2]=rgba>>>16&255;result[at+3]=rgba>>>24&255;}}
  }
  return result;
 }
 function compose(source,texture){
  const width=source?.naturalWidth||source?.width,height=source?.naturalHeight||source?.height;
  if(!dimensions(width,height)||!validateTexture(texture,width,height))throw Error('Artwork dimensions do not match its original image.');
  const doc=source.ownerDocument||(typeof document==='undefined'?null:document);if(!doc)throw Error('Artwork composition requires a document.');
  const canvas=doc.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);
  const image=ctx.getImageData(0,0,width,height);image.data.set(composePixels(image.data,texture));ctx.putImageData(image,0,0);return canvas;
 }
 function linePoints(a,b){let [x,y]=a;const [tx,ty]=b,dx=Math.abs(tx-x),dy=-Math.abs(ty-y),sx=x<tx?1:-1,sy=y<ty?1:-1,result=[];let error=dx+dy;while(true){result.push([x,y]);if(x===tx&&y===ty)break;const twice=2*error;if(twice>=dy){error+=dy;x+=sx;}if(twice<=dx){error+=dx;y+=sy;}}return result;}
 function mount(api={}){
  const host=api.host;if(!host?.ownerDocument||typeof api.getSource!=='function')throw Error('Artwork editing needs a host and original image sources.');
  const doc=host.ownerDocument,win=doc.defaultView;let target=api.initialId||'',tool='pencil',rgba='#ff5f97ff',zoom=4,showGrid=true,spaceHeld=false,spacePanned=false,gesture=null,cursor=null,width=0,height=0,panX=0,panY=0,original=null,composite=null,imageData=null,mask=null,values=null,sourceImage=null,sourceStamp=null,loading=false,destroyed=false,loadToken=0,drawFrame=0,expanded=false,placeholder=null,returnFocus=null,nativeFullscreen=false,expansionVersion=0,selection=null,pastePreview=null,firstExpandFitPending=false,firstExpandFitted=false;
  let assetsVisible=false;
  let pickerReturnTool='pencil',sampledKey=null,stamp=null,stampPosition=null,stampWidthChoice=null,stampHeightChoice=null;
  const el=(tag,className,text)=>{const node=doc.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
  const button=(text,action,key)=>{const node=el('button','',text);node.type='button';node.onclick=action;if(key)node.dataset[key]='';return node;};
  const field=(text,node)=>{const label=el('label','artwork-field');label.append(doc.createTextNode(text),node);return label;};
  const select=(label,items,key)=>{const node=el('select');node.setAttribute('aria-label',label);if(key)node.dataset[key]='';for(const [value,text]of items){const option=el('option','',text);option.value=String(value);node.append(option);}return node;};
  host.classList.add('artwork-editor');host.dataset.artworkEditor='';host.replaceChildren();
  const heading=el('div','artwork-heading'),title=el('h3','dev-heading','Pixel artwork'),expand=button('⛶ Full screen',()=>setExpanded(!expanded),'artworkExpand');expand.setAttribute('aria-expanded','false');const exit=button('Exit pixel editor',exitEditor,'artworkExit');heading.append(title,expand,exit);host.append(heading);
  host.append(el('p','artwork-help','Drag Select around an area, then Copy and Paste (Ctrl/Cmd+C and Ctrl/Cmd+V). Click or press Enter to place a paste; Escape cancels it. Stamp (S) captures selected pixels with Ctrl/Command-click; change its width and height, then click to place copies. Eyedropper samples an exact pixel colour. Right-drag or hold Space to pan; use the wheel to zoom.'));
  const targetSelect=select('Artwork to edit',[],'artworkTarget');host.append(field('Background, asset or character',targetSelect));
  const tools=el('div','artwork-controls'),toolSelect=select('Artwork tool',[['pencil','Pencil'],['select','Select rectangle'],['stamp','Stamp selected pixels'],['line','Straight line'],['erase','Eraser'],['restore','Restore original'],['picker','Eyedropper'],['fill','Fill connected colour'],['pan','Pan']],'artworkTool');
  const colorInput=el('input');colorInput.type='color';colorInput.value=rgba.slice(0,7);colorInput.setAttribute('aria-label','Artwork colour');colorInput.dataset.artworkColor='';
  const hexInput=el('input');hexInput.type='text';hexInput.value=rgba;hexInput.maxLength=9;hexInput.spellcheck=false;hexInput.setAttribute('aria-label','Artwork exact hex colour');hexInput.dataset.artworkHex='';
  const colorGroup=el('div','artwork-colour');colorGroup.append(colorInput,hexInput);tools.append(field('Tool',toolSelect),field('Colour · #RRGGBBAA',colorGroup));host.append(tools);
  const selectionTools=el('div','artwork-selection-tools');
  const selectButton=button('Select',()=>selectTool('select'),'artworkSelect'),copyButton=button('Copy',copySelection,'artworkCopy'),pasteButton=button('Paste',beginPaste,'artworkPaste'),pickerButton=button('Eyedropper',()=>selectTool('picker'),'artworkPicker');
  selectButton.title='Drag a rectangle to select pixels (M)';copyButton.title='Copy selected pixels (Ctrl/Cmd+C)';pasteButton.title='Preview copied pixels (Ctrl/Cmd+V)';pickerButton.title='Sample exact RGBA colour (I), or hold Alt and click';
  const stampButton=button('Stamp',()=>selectTool('stamp'),'artworkStamp');stampButton.title='Select pixels, then Ctrl/Command-click to capture them. Click to stamp copies (S).';selectionTools.append(selectButton,copyButton,pasteButton,stampButton,pickerButton);host.append(selectionTools);
  const stampTools=el('div','artwork-controls');stampTools.dataset.artworkStampControls='';const stampWidthInput=el('input'),stampHeightInput=el('input');for(const [input,name]of [[stampWidthInput,'width'],[stampHeightInput,'height']]){input.type='number';input.min='1';input.step='1';input.max='8192';input.placeholder='Selected '+name;input.dataset[name==='width'?'artworkStampWidth':'artworkStampHeight']='';input.setAttribute('aria-label','Stamp '+name+' in pixels');}const captureStampButton=button('Capture selection',()=>captureStamp(cursor),'artworkCaptureStamp');stampTools.append(field('Stamp width',stampWidthInput),field('Stamp height',stampHeightInput),captureStampButton);host.append(stampTools);
  const viewTools=el('div','artwork-view-tools'),zoomSelect=select('Artwork zoom',[.25,.5,1,2,4,8,12,16,24,32,48,64].map(value=>[value,value+'×']),'artworkZoom');zoomSelect.value=String(zoom);
  const grid=el('input');grid.type='checkbox';grid.checked=true;grid.setAttribute('aria-label','Show artwork pixel grid');grid.dataset.artworkGrid='';const gridLabel=field('Pixel grid',grid);gridLabel.classList.add('artwork-check');
  const assetToggle=el('input');assetToggle.type='checkbox';assetToggle.setAttribute('aria-label','Show assets while editing background');assetToggle.dataset.artworkAssets='';const assetLabel=field('Show assets',assetToggle);assetLabel.classList.add('artwork-assets-toggle');assetLabel.hidden=true;
  const fit=button('Fit image',fitView,'artworkFit');viewTools.append(field('Zoom',zoomSelect),fit,gridLabel,assetLabel);host.append(viewTools);
  const stage=el('div','artwork-stage'),canvas=el('canvas','artwork-canvas');canvas.dataset.artworkCanvas='';canvas.tabIndex=0;canvas.setAttribute('aria-label','Pixel artwork canvas. Select an area and copy or paste with Ctrl or Command. Arrow keys move the pixel cursor or paste; Enter places pixels. Escape cancels a paste. Hold Space and drag to pan.');stage.append(canvas);host.append(stage);
  const status=el('p','artwork-status','Choose artwork to begin.');status.dataset.artworkStatus='';status.setAttribute('role','status');host.append(status);
  const actions=el('div','artwork-actions');
  const undoButton=typeof api.onUndo==='function'?button('↶ Undo',()=>history('undo'),'artworkUndo'):null,redoButton=typeof api.onRedo==='function'?button('↷ Redo',()=>history('redo'),'artworkRedo'):null;
  if(undoButton)actions.append(undoButton);if(redoButton)actions.append(redoButton);
  actions.append(button('Export PNG',exportPNG,'artworkExport'),button('Reset artwork',reset,'artworkReset'));host.append(actions);
  const palette=el('div','artwork-palette');palette.setAttribute('aria-label','Artwork colour palette');for(const value of ['#000000ff','#ffffffff','#808080ff','#ff5599ff','#53d9ffff','#ffe177ff','#7755aaff','#58a369ff']){const b=button('',()=>setColor(value));b.style.background=value.slice(0,7);b.setAttribute('aria-label','Use colour '+value.slice(0,7));palette.append(b);}host.append(palette);
  function editable(){return !destroyed&&!loading&&!!composite&&api.canEdit?.()!==false;}
  function hasAssetPreview(){return typeof api.drawAssetPreview==='function'&&api.hasAssetPreview?.(target)===true;}
  function syncAssetPreview(){assetLabel.hidden=!hasAssetPreview();assetToggle.checked=assetsVisible;assetToggle.disabled=!editable();}
  function currentData(){return normalize(api.getData?.()||{})||{};}
  function setStatus(text){status.textContent=text;syncSelectionActions();syncAssetPreview();}
  function selectionCore(){return win.CodaPixelSelection;}
  function syncSelectionActions(){const ready=editable(),core=selectionCore();selectButton.disabled=!ready||!core;copyButton.disabled=!ready||!selection||!core;pasteButton.disabled=!ready||!core?.clipboard.has();pickerButton.disabled=!ready;selectButton.setAttribute('aria-pressed',String(tool==='select'));pickerButton.setAttribute('aria-pressed',String(tool==='picker'));syncStampControls();}
  function syncHistory(){const state=api.getHistory?.();if(undoButton)undoButton.disabled=api.canEdit?.()===false||!!state&&!state.undo;if(redoButton)redoButton.disabled=api.canEdit?.()===false||!!state&&!state.redo;syncSelectionActions();syncAssetPreview();}
  function history(which){if(api.canEdit?.()===false)return;cancelPaste(false);finishGesture();const callback=which==='undo'?api.onUndo:api.onRedo;try{callback?.();refresh();}catch(error){setStatus(error.message||'History could not be changed.');}}

  function setColor(value){if(/^#[0-9a-f]{6}$/i.test(value))value+='ff';if(!color(value))return false;rgba=value.toLowerCase();hexInput.value=rgba;colorInput.value=rgba.slice(0,7);hexInput.removeAttribute('aria-invalid');return true;}
  function targets(){return (api.getTargets?.()||[]).filter(item=>item&&safeId(item.id));}
  function syncTargets(){const list=targets();targetSelect.replaceChildren();for(const item of list){const option=el('option','',item.name||item.label||item.id);option.value=item.id;targetSelect.append(option);}if(!list.some(item=>item.id===target))target=list[0]?.id||'';targetSelect.value=target;return list;}
  function resize(){if(destroyed)return;const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;requestDraw();}fitInitialExpansion();}
  function fitInitialExpansion(){if(!firstExpandFitPending||firstExpandFitted||!expanded||loading||!composite||canvas.width<2||canvas.height<2)return;firstExpandFitPending=false;firstExpandFitted=true;fitView();}
  function requestDraw(){if(!drawFrame&&!destroyed)drawFrame=win.requestAnimationFrame(()=>{drawFrame=0;draw();});}
  function draw(){
   const g=canvas.getContext('2d');g.clearRect(0,0,canvas.width,canvas.height);g.imageSmoothingEnabled=false;
   const checker=12;for(let yy=0;yy<canvas.height;yy+=checker)for(let xx=0;xx<canvas.width;xx+=checker){g.fillStyle=((xx/checker+yy/checker)&1)?'#253047':'#35415b';g.fillRect(xx,yy,checker,checker);}
   if(!composite)return;
   const sx=Math.max(0,Math.floor(-panX/zoom)),sy=Math.max(0,Math.floor(-panY/zoom)),ex=Math.min(width,Math.ceil((canvas.width-panX)/zoom)),ey=Math.min(height,Math.ceil((canvas.height-panY)/zoom));
   if(ex>sx&&ey>sy)g.drawImage(composite,sx,sy,ex-sx,ey-sy,panX+sx*zoom,panY+sy*zoom,(ex-sx)*zoom,(ey-sy)*zoom);
   const placement=pastePreview||(tool==='stamp'&&stamp&&stampPosition?{...stamp,...stampPosition}:null);
   if(placement){
    const p=placement,cx=Math.max(0,sx-p.x),cy=Math.max(0,sy-p.y),right=Math.min(p.clip.width,ex-p.x),bottom=Math.min(p.clip.height,ey-p.y);
    if(right>cx&&bottom>cy){
     const left=panX+(p.x+cx)*zoom,top=panY+(p.y+cy)*zoom,w=(right-cx)*zoom,h=(bottom-cy)*zoom;
     g.save();g.beginPath();g.rect(left,top,w,h);g.clip();
     for(let yy=Math.max(0,Math.floor(top/checker)*checker);yy<Math.min(canvas.height,top+h);yy+=checker)for(let xx=Math.max(0,Math.floor(left/checker)*checker);xx<Math.min(canvas.width,left+w);xx+=checker){g.fillStyle=((xx/checker+yy/checker)&1)?'#253047':'#35415b';g.fillRect(xx,yy,checker,checker);}
     g.globalAlpha=.82;g.drawImage(p.surface,cx,cy,right-cx,bottom-cy,left,top,w,h);g.restore();
    }
   }
   if(assetsVisible&&hasAssetPreview()){
    g.save();try{g.beginPath();g.rect(panX,panY,width*zoom,height*zoom);g.clip();g.translate(panX,panY);g.scale(zoom,zoom);api.drawAssetPreview(g,{target,width,height});}finally{g.restore();}
   }
   if(showGrid&&zoom>=8&&ex>sx&&ey>sy){g.strokeStyle='#d7eaff38';g.lineWidth=1;g.beginPath();for(let xx=sx;xx<=ex;xx++){const x=Math.round(panX+xx*zoom)+.5;g.moveTo(x,Math.max(0,panY));g.lineTo(x,Math.min(canvas.height,panY+height*zoom));}for(let yy=sy;yy<=ey;yy++){const y=Math.round(panY+yy*zoom)+.5;g.moveTo(Math.max(0,panX),y);g.lineTo(Math.min(canvas.width,panX+width*zoom),y);}g.stroke();}
   const outline=(rect,colour)=>{if(!rect)return;g.save();g.lineWidth=1;g.setLineDash([5,3]);g.strokeStyle='#101827';g.strokeRect(Math.round(panX+rect.x*zoom)-.5,Math.round(panY+rect.y*zoom)-.5,Math.max(1,rect.width*zoom+1),Math.max(1,rect.height*zoom+1));g.strokeStyle=colour;g.strokeRect(Math.round(panX+rect.x*zoom)+.5,Math.round(panY+rect.y*zoom)+.5,Math.max(1,rect.width*zoom-1),Math.max(1,rect.height*zoom-1));g.restore();};
   outline(selection,'#b8fff2');if(placement)outline({x:placement.x,y:placement.y,width:placement.clip.width,height:placement.clip.height},'#ffe48f');
   if(cursor){g.strokeStyle='#ffffff';g.lineWidth=1;g.strokeRect(Math.round(panX+cursor.x*zoom)+.5,Math.round(panY+cursor.y*zoom)+.5,Math.max(1,zoom-1),Math.max(1,zoom-1));g.strokeStyle='#111827';g.strokeRect(Math.round(panX+cursor.x*zoom)-.5,Math.round(panY+cursor.y*zoom)-.5,Math.max(2,zoom+1),Math.max(2,zoom+1));}
  }
  function keepVisible(){panX=clamp(panX,Math.min(20,canvas.width-width*zoom-20),Math.max(20,canvas.width-width*zoom-20));panY=clamp(panY,Math.min(20,canvas.height-height*zoom-20),Math.max(20,canvas.height-height*zoom-20));}
  function syncZoomSelect(fitted=false){
   const value=String(zoom);let custom=zoomSelect.querySelector('[data-artwork-custom-zoom]');
   const preset=Array.from(zoomSelect.options).some(option=>option!==custom&&option.value===value);
   if(preset)custom?.remove();else{if(!custom){custom=el('option');custom.dataset.artworkCustomZoom='';zoomSelect.prepend(custom);}custom.value=value;custom.textContent=String(Math.round(zoom*1000)/1000)+'×'+(fitted?' · Fit':'');}
   zoomSelect.value=value;
  }
  function setZoom(next,anchor){if(!Number.isFinite(next)||next<.125||next>64)return;finishGesture();const a=anchor||{x:canvas.width/2,y:canvas.height/2},wx=(a.x-panX)/zoom,wy=(a.y-panY)/zoom;zoom=next;panX=a.x-wx*zoom;panY=a.y-wy*zoom;syncZoomSelect();keepVisible();requestDraw();setStatus('Zoom '+Math.round(zoom*100)+'% · '+width+' × '+height+' pixels.');}
  function fitView(){if(!composite)return;finishGesture();zoom=Math.min(64,Math.max(.125,Math.min((canvas.width-24)/width,(canvas.height-24)/height)));panX=Math.round((canvas.width-width*zoom)/2);panY=Math.round((canvas.height-height*zoom)/2);syncZoomSelect(true);requestDraw();setStatus(width+' × '+height+' pixels · Fit view.');}
  function loadBuffers(){
   const texture=currentData()[target];if(texture&&!validateTexture(texture,width,height))throw Error('Saved artwork dimensions no longer match this image.');
   ({mask,values}=dense(texture,width,height));imageData=original.getContext('2d',{willReadFrequently:true}).getImageData(0,0,width,height);
   if(texture)imageData.data.set(composePixels(imageData.data,texture));composite.getContext('2d').putImageData(imageData,0,0);
  }
  async function refresh(){
   if(destroyed)return;syncHistory();const list=syncTargets();syncAssetPreview();if(!target||!list.length){setStatus('There is no editable artwork in this room.');return;}
   if(gesture)cancelGesture();cancelPaste(false);const token=++loadToken;loading=true;syncSelectionActions();
   try{
    const source=await api.getSource(target);if(token!==loadToken||destroyed)return;
    if(source?.decode&&source.complete===false)await source.decode();if(token!==loadToken||destroyed)return;
    const w=source?.naturalWidth||source?.width,h=source?.naturalHeight||source?.height;if(!dimensions(w,h))throw Error('This image is too large to edit. Maximum: 8192 pixels per side and 16 million pixels.');
    const viewChanged=sourceStamp!==target||width!==w||height!==h,changed=sourceImage!==source||viewChanged;sourceImage=source;sourceStamp=target;width=w;height=h;
    if(changed){original=doc.createElement('canvas');original.width=width;original.height=height;original.getContext('2d',{willReadFrequently:true}).drawImage(source,0,0);composite=doc.createElement('canvas');composite.width=width;composite.height=height;cursor=null;selection=null;if(viewChanged){clearStamp(false);stampWidthChoice=null;stampHeightChoice=null;stampWidthInput.value=stampHeightInput.value='';}}
    loadBuffers();loading=false;resize();if(viewChanged)fitView();else requestDraw();setStatus(width+' × '+height+' pixels · Edits save with the project.');
   }catch(error){if(token!==loadToken||destroyed)return;loading=false;composite=null;setStatus(error.message||'This artwork could not be loaded.');requestDraw();}
  }
  function local(event){const box=canvas.getBoundingClientRect();return {x:(event.clientX-box.left)*canvas.width/Math.max(1,box.width),y:(event.clientY-box.top)*canvas.height/Math.max(1,box.height)};}
  function locate(event,limit=false){const point=local(event),x=Math.floor((point.x-panX)/zoom),y=Math.floor((point.y-panY)/zoom);if(!limit&&(x<0||y<0||x>=width||y>=height))return null;return {x:clamp(x,0,width-1),y:clamp(y,0,height-1)};}
  function renderPixel(at){const offset=at*4;if(mask[at]){const value=values[at];imageData.data[offset]=value&255;imageData.data[offset+1]=value>>>8&255;imageData.data[offset+2]=value>>>16&255;imageData.data[offset+3]=value>>>24&255;}else{const data=gesture?.originalRGBA||original.getContext('2d').getImageData(0,0,width,height).data;for(let c=0;c<4;c++)imageData.data[offset+c]=data[offset+c];}}
  function upload(bounds){if(!bounds)return;const ctx=composite.getContext('2d');ctx.putImageData(imageData,0,0,bounds.x,bounds.y,bounds.right-bounds.x+1,bounds.bottom-bounds.y+1);requestDraw();}
  function applyPoints(points,value){let box=null;const indices=[];for(const [x,y]of points){const at=y*width+x;indices.push(at);mask[at]=value===undefined?0:1;values[at]=value===undefined?0:pack(value);renderPixel(at);if(!box)box={x,y,right:x,bottom:y};else{box.x=Math.min(box.x,x);box.y=Math.min(box.y,y);box.right=Math.max(box.right,x);box.bottom=Math.max(box.bottom,y);}}upload(box);return indices;}
  function sample(point,temporary=false){const at=(point.y*width+point.x)*4;setColor('#'+Array.from(imageData.data.slice(at,at+4),v=>v.toString(16).padStart(2,'0')).join(''));if(tool==='picker'&&!temporary)selectTool(pickerReturnTool);setStatus('Copied '+rgba+' from pixel '+point.x+', '+point.y+'. '+(tool==='picker'?'Eyedropper ready.':toolSelect.selectedOptions[0].textContent+' ready.'));}
  function selectTool(value){
   if(!['pencil','select','stamp','line','erase','restore','picker','fill','pan'].includes(value))return false;
   finishGesture();cancelPaste(false);if(value==='picker'){if(tool!=='picker')pickerReturnTool=tool;}else pickerReturnTool=value;tool=value;toolSelect.value=value;canvas.classList.toggle('is-pan-tool',tool==='pan');
   setStatus(tool==='stamp'?'Ctrl/Command-click to capture the selected pixels, then click to stamp.':tool==='select'?'Drag around the exact pixels to copy.':tool==='line'?'Drag from the first pixel to the last, then release.':tool==='picker'?'Click an artwork pixel to sample its exact RGBA colour.':'Tool: '+tool+'.');requestDraw();return true;
  }
  function syncStampControls(){
   stampTools.hidden=tool!=='stamp';stampButton.disabled=!editable()||!selectionCore();stampButton.setAttribute('aria-pressed',String(tool==='stamp'));captureStampButton.disabled=!editable()||!selection;
   stampWidthInput.max=String(width||8192);stampHeightInput.max=String(height||8192);stampWidthInput.disabled=stampHeightInput.disabled=!editable();
  }
  function clearStamp(announce=true){stamp=null;stampPosition=null;requestDraw();if(announce)setStatus('Stamp cleared. Select pixels and Ctrl/Command-click to capture another stamp.');}
  function resizeStamp(){
   if(!stamp)return true;const w=stampWidthChoice??stamp.sourceClip.width,h=stampHeightChoice??stamp.sourceClip.height,clip=selectionCore()?.resizeClip(stamp.sourceClip,w,h);if(!clip)return false;
   const surface=doc.createElement('canvas');surface.width=w;surface.height=h;const context=surface.getContext('2d'),image=context.createImageData(w,h);image.data.set(clip.pixels);context.putImageData(image,0,0);stamp={...stamp,clip,surface};stampWidthInput.value=String(w);stampHeightInput.value=String(h);requestDraw();return true;
  }
  function captureStamp(point){
   if(!editable()||!selectionCore())return false;finishGesture();cancelPaste(false);
   if(!selection){setStatus('Use Select to drag around the pixels to capture, then choose Stamp.');return false;}
   const sourceClip=selectionCore().copyPixels(imageData.data,width,height,selection);if(!sourceClip)return false;
   stamp={sourceClip,target,imageWidth:width,imageHeight:height};stampPosition={...(point||{x:selection.x,y:selection.y})};if(!resizeStamp()){clearStamp(false);return false;}
   setStatus('Captured '+sourceClip.width+' × '+sourceClip.height+' pixels. Click to stamp '+stamp.clip.width+' × '+stamp.clip.height+' copies. Ctrl/Command-click captures again.');return true;
  }
  function commitStamp(point){
   if(!editable())return false;if(!stamp){setStatus('Select pixels, then Ctrl/Command-click to capture the stamp first.');return false;}
   if(stamp.target!==target||stamp.imageWidth!==width||stamp.imageHeight!==height){clearStamp();return false;}
   const p=point||stampPosition||cursor;if(!p)return false;const points=selectionCore()?.stampPixels(stamp.clip,width,height,p.x,p.y)||[];if(!points.length){setStatus('Move the stamp onto the image before placing it.');return false;}
   stampPosition={...p};gesture={id:-1,tool:'stamp'};let x0=width,y0=height,x1=0,y1=0;
   for(const [x,y,value]of points){const at=y*width+x;mask[at]=1;values[at]=pack(value);renderPixel(at);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
   upload({x:x0,y:y0,right:x1,bottom:y1});finishGesture();return true;
  }
  function stampSizeChanged(input,axis){
   if(!editable())return;const value=input.value===''?null:Number(input.value),limit=axis==='width'?width:height;if(value!==null&&(!Number.isSafeInteger(value)||value<1||value>limit)){input.setAttribute('aria-invalid','true');return;}
   input.removeAttribute('aria-invalid');if(axis==='width')stampWidthChoice=value;else stampHeightChoice=value;resizeStamp();
  }
  stampWidthInput.oninput=()=>stampSizeChanged(stampWidthInput,'width');stampHeightInput.oninput=()=>stampSizeChanged(stampHeightInput,'height');
  function copySelection(){
   const core=selectionCore();if(!editable()||!core)return false;finishGesture();
   if(!selection){setStatus('Choose Select and drag around the pixels to copy.');return false;}
   const clip=core.copyPixels(imageData.data,width,height,selection);if(!clip||!core.clipboard.set(clip)){setStatus('Those selected pixels could not be copied.');return false;}
   setStatus('Copied '+clip.width+' × '+clip.height+' pixels. Choose Paste to place a copy.');canvas.focus({preventScroll:true});return true;
  }
  function beginPaste(){
   if(!editable())return false;finishGesture();const clip=selectionCore()?.clipboard.get();
   if(!clip){setStatus('Select an area and Copy it first.');return false;}
   const point=cursor||{x:clamp(Math.floor((canvas.width/2-panX)/zoom),0,width-1),y:clamp(Math.floor((canvas.height/2-panY)/zoom),0,height-1)};
   const surface=doc.createElement('canvas');surface.width=clip.width;surface.height=clip.height;const pg=surface.getContext('2d'),pixels=pg.createImageData(clip.width,clip.height);pixels.data.set(clip.pixels);pg.putImageData(pixels,0,0);
   pastePreview={clip,surface,x:point.x,y:point.y,target,token:loadToken};cursor={...point};requestDraw();setStatus('Move the copied area, then click or press Enter to place it. Escape cancels.');canvas.focus({preventScroll:true});return true;
  }
  function cancelPaste(announce=true){if(!pastePreview)return false;pastePreview=null;requestDraw();if(announce)setStatus('Paste cancelled. Copied pixels are still available.');else syncSelectionActions();return true;}
  function commitPaste(){
   const paste=pastePreview;if(!paste||!editable())return false;
   if(paste.target!==target||paste.token!==loadToken){cancelPaste();return false;}
   const x0=Math.max(0,paste.x),y0=Math.max(0,paste.y),right=Math.min(width,paste.x+paste.clip.width),bottom=Math.min(height,paste.y+paste.clip.height);
   if(right<=x0||bottom<=y0){setStatus('Move the paste onto the artwork before placing it.');return false;}
   pastePreview=null;gesture={id:-1,tool:'paste'};
   const data=paste.clip.pixels;
   for(let y=y0;y<bottom;y++)for(let x=x0;x<right;x++){
    const at=y*width+x,from=((y-paste.y)*paste.clip.width+x-paste.x)*4,offset=at*4;
    mask[at]=1;values[at]=(data[from]|data[from+1]<<8|data[from+2]<<16|data[from+3]<<24)>>>0;
    for(let c=0;c<4;c++)imageData.data[offset+c]=data[from+c];
   }
   selection={x:x0,y:y0,width:right-x0,height:bottom-y0};upload({x:x0,y:y0,right:right-1,bottom:bottom-1});finishGesture();return true;
  }
  function rawPoint(event){const point=local(event);return {x:Math.floor((point.x-panX)/zoom),y:Math.floor((point.y-panY)/zoom)};}
  function updateSelection(point){const core=selectionCore();selection=core?.rectangle([gesture.anchor.x,gesture.anchor.y],[point.x,point.y],width,height)||null;cursor=point;requestDraw();if(selection)setStatus('Selected '+selection.width+' × '+selection.height+' pixels · Copy to reuse them.');}
  function begin(point,event){gesture={id:event.pointerId,anchor:point,last:point,line:tool==='line'||event.shiftKey,mask:mask.slice(),values:values.slice(),originalRGBA:original.getContext('2d',{willReadFrequently:true}).getImageData(0,0,width,height).data,preview:[],tool,value:tool==='erase'?'#00000000':tool==='restore'?undefined:rgba};}
  function strokeTo(point){if(!gesture||gesture.pan)return;cursor=point;if(gesture.line){const old=gesture.preview;for(const at of old){mask[at]=gesture.mask[at];values[at]=gesture.values[at];renderPixel(at);}if(old.length)composite.getContext('2d').putImageData(imageData,0,0);gesture.preview=applyPoints(linePoints([gesture.anchor.x,gesture.anchor.y],[point.x,point.y]),gesture.value);}else applyPoints(linePoints([gesture.last.x,gesture.last.y],[point.x,point.y]),gesture.value);gesture.last=point;setStatus('Pixel '+point.x+', '+point.y+' · '+(gesture.line?'Line preview · release to apply':gesture.tool==='restore'?'original':gesture.value));}
  function fill(point){
   const at=(point.y*width+point.x)*4,source=Array.from(imageData.data.slice(at,at+4)),seen=new Uint8Array(width*height),pending=new Uint32Array(width*height);let head=0,tail=1;pending[0]=point.y*width+point.x;seen[pending[0]]=1;const value=pack(rgba);let minX=width,minY=height,maxX=0,maxY=0;
   while(head<tail){const index=pending[head++],offset=index*4;if(!source.every((channel,c)=>imageData.data[offset+c]===channel))continue;const x=index%width,y=Math.floor(index/width);mask[index]=1;values[index]=value;renderPixel(index);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
    for(const next of [x?index-1:-1,x<width-1?index+1:-1,y?index-width:-1,y<height-1?index+width:-1])if(next>=0&&!seen[next]){seen[next]=1;pending[tail++]=next;}
   }
   if(minX<width)upload({x:minX,y:minY,right:maxX,bottom:maxY});
  }
  function finishGesture(){
   if(!gesture)return;const previous=gesture;gesture=null;if(previous.pan){canvas.classList.remove('is-panning');return;}if(previous.select){requestDraw();if(selection)setStatus('Selected '+selection.width+' × '+selection.height+' pixels · Copy to reuse them.');return;}
   const next=currentData(),texture=fromDense(width,height,mask,values);if(Object.keys(texture.tiles).length)next[target]=texture;else delete next[target];
   if(JSON.stringify(next)===JSON.stringify(currentData())){requestDraw();return;}
   if(api.canEdit?.()===false){loadBuffers();requestDraw();setStatus('Editing is not available for this profile.');return;}
   try{if(api.onChange?.(next)===false)throw Error('This edit could not be saved. Export or undo other edits to make room.');syncHistory();setStatus('Pixels applied · Undo is available in the console.');}catch(error){loadBuffers();requestDraw();setStatus(error.message||'The pixels could not be saved.');}
  }
  function cancelGesture(){if(!gesture)return;const previous=gesture;gesture=null;if(previous.select)selection=previous.selectionBefore||null;spaceHeld=false;canvas.classList.remove('is-panning');if(composite)loadBuffers();requestDraw();setStatus('Stroke cancelled.');}
  function down(event){
   if(!editable()||gesture||![0,2].includes(event.button))return;const pan=event.button===2||tool==='pan'&&!event.altKey||spaceHeld;if(!pan&&!pastePreview&&!(tool==='stamp'&&stamp)&&!locate(event))return;event.preventDefault();event.stopPropagation();canvas.focus({preventScroll:true});canvas.setPointerCapture?.(event.pointerId);
   if(pan){if(spaceHeld)spacePanned=true;const point=local(event);gesture={id:event.pointerId,pan:true,x:point.x,y:point.y,panX,panY};canvas.classList.add('is-panning');return;}
   if(tool==='stamp'&&!event.altKey){const point=rawPoint(event);cursor=locate(event,true);stampPosition={...point};if(event.ctrlKey||event.metaKey)captureStamp(point);else commitStamp(point);requestDraw();return;}
   if(pastePreview){const point=rawPoint(event);pastePreview.x=point.x;pastePreview.y=point.y;commitPaste();return;}
   const point=locate(event);cursor=point;if(tool==='picker'||event.altKey){sample(point,event.altKey);requestDraw();return;}
   if(tool==='select'){if(!selectionCore())return;gesture={id:event.pointerId,select:true,anchor:point,selectionBefore:selection};updateSelection(point);return;}
   begin(point,event);if(tool==='fill'){fill(point);finishGesture();}else strokeTo(point);
  }
  function move(event){
   if(!composite)return;
   if(!gesture){const point=locate(event);cursor=point;if(pastePreview){const raw=rawPoint(event);pastePreview.x=raw.x;pastePreview.y=raw.y;}if(tool==='stamp'&&stamp)stampPosition=rawPoint(event);requestDraw();return;}
   if(gesture.id!==event.pointerId)return;event.preventDefault();event.stopPropagation();
   if(gesture.pan){const point=local(event);panX=gesture.panX+point.x-gesture.x;panY=gesture.panY+point.y-gesture.y;keepVisible();requestDraw();return;}
   if(api.canEdit?.()===false){cancelGesture();return;}if(gesture.select)updateSelection(locate(event,true));else strokeTo(locate(event,true));
  }
  function up(event){if(gesture?.id!==event.pointerId)return;event.preventDefault();event.stopPropagation();if(gesture.select)updateSelection(locate(event,true));else if(!gesture.pan)strokeTo(locate(event,true));finishGesture();}
  function stopKey(event){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();}
  function keydown(event){
   if(destroyed)return;const inside=event.target===canvas||host.contains(event.target);if(!inside)return;
   const typing=event.target?.closest?.('input,textarea,select,[contenteditable="true"]')||event.target?.isContentEditable;
   if(event.key==='Escape'&&(pastePreview||gesture||selection||stamp)){stopKey(event);if(stamp){clearStamp();}else if(pastePreview){cancelPaste();selection=null;requestDraw();}else if(gesture)cancelGesture();else{selection=null;requestDraw();setStatus('Selection cleared.');}return;}
   if(expanded&&event.key==='Escape'){stopKey(event);exitEditor();return;}
   if(typing)return;
   if(event.repeat&&sampledKey===event.key){stopKey(event);return;}
   const command=event.ctrlKey||event.metaKey,key=event.key.toLowerCase();
   if(command&&key==='c'&&selection){stopKey(event);copySelection();return;}
   if(command&&key==='v'&&selectionCore()?.clipboard.has()){stopKey(event);beginPaste();return;}
   if(command&&key==='a'&&editable()&&selectionCore()){stopKey(event);finishGesture();cancelPaste(false);selection={x:0,y:0,width,height};setStatus('Selected all '+width+' × '+height+' pixels.');requestDraw();return;}
   if(!command&&!event.altKey&&['i','m','b','s'].includes(key)){stopKey(event);selectTool(key==='i'?'picker':key==='m'?'select':key==='s'?'stamp':'pencil');return;}
   if(command&&key==='enter'&&tool==='stamp'){stopKey(event);if(!event.repeat)captureStamp(cursor);return;}
   if(event.target!==canvas)return;
   if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
    stopKey(event);if(!composite)return;cursor=cursor||{x:clamp(Math.floor((canvas.width/2-panX)/zoom),0,width-1),y:clamp(Math.floor((canvas.height/2-panY)/zoom),0,height-1)};
    const dx=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0,dy=event.key==='ArrowDown'?1:event.key==='ArrowUp'?-1:0;
    if(pastePreview){pastePreview.x=clamp(pastePreview.x+dx,1-pastePreview.clip.width,width-1);pastePreview.y=clamp(pastePreview.y+dy,1-pastePreview.clip.height,height-1);cursor={x:clamp(pastePreview.x,0,width-1),y:clamp(pastePreview.y,0,height-1)};}
    else if(tool==='stamp'&&stamp){const point=stampPosition||cursor;stampPosition={x:clamp(point.x+dx,1-stamp.clip.width,width-1),y:clamp(point.y+dy,1-stamp.clip.height,height-1)};cursor={x:clamp(stampPosition.x,0,width-1),y:clamp(stampPosition.y,0,height-1)};}else cursor={x:clamp(cursor.x+dx,0,width-1),y:clamp(cursor.y+dy,0,height-1)};
    const px=panX+cursor.x*zoom,py=panY+cursor.y*zoom;if(px<0||px+zoom>canvas.width)panX=canvas.width/2-cursor.x*zoom;if(py<0||py+zoom>canvas.height)panY=canvas.height/2-cursor.y*zoom;requestDraw();setStatus('Pixel '+cursor.x+', '+cursor.y+(pastePreview?' · Enter places the paste.':'.'));return;
   }
   if(event.code==='Space'){stopKey(event);if(!event.repeat)spacePanned=false;spaceHeld=true;return;}
   if(event.key==='Enter'){stopKey(event);if(pastePreview){commitPaste();return;}if(!editable()||!cursor)return;if(tool==='stamp'){if(!event.repeat)commitStamp(stampPosition||cursor);return;}if(tool==='picker'){sample(cursor);sampledKey=event.key;}else if(!['pan','select'].includes(tool)){begin(cursor,{pointerId:-1,shiftKey:false});if(tool==='fill')fill(cursor);else strokeTo(cursor);finishGesture();}return;}
   if(['+','=','-','_'].includes(event.key)){stopKey(event);setZoom(clamp(zoom*(event.key==='-'||event.key==='_'?.5:2),.125,64));}
  }
  function keyup(event){if(sampledKey===event.key)sampledKey=null;if(event.code!=='Space'||!spaceHeld)return;stopKey(event);if(!spacePanned&&!gesture&&!pastePreview&&event.target===canvas&&editable()&&cursor&&!['pan','select'].includes(tool)){if(tool==='picker')sample(cursor);else if(tool==='stamp')commitStamp(stampPosition||cursor);else{begin(cursor,{pointerId:-1,shiftKey:false});if(tool==='fill')fill(cursor);else strokeTo(cursor);finishGesture();}}spaceHeld=false;spacePanned=false;}
  function wheel(event){if(!composite)return;event.preventDefault();event.stopPropagation();const levels=[.125,.25,.5,1,2,4,8,12,16,24,32,48,64],next=event.deltaY<0?levels.find(value=>value>zoom):[...levels].reverse().find(value=>value<zoom);if(next)setZoom(next,local(event));}
  function exportPNG(){if(!composite)return;finishGesture();const link=doc.createElement('a');link.download='coda-'+target.replace(/[^a-z0-9_-]/gi,'-')+'.png';link.href=composite.toDataURL('image/png');link.click();}
  function reset(){if(!editable())return;cancelPaste(false);clearStamp(false);selection=null;finishGesture();const next=currentData();delete next[target];try{if(api.onChange?.(next)===false)throw Error('Reset could not be saved.');loadBuffers();requestDraw();setStatus('Original artwork restored · Undo is available.');}catch(error){setStatus(error.message);}}
  function restorePortal(){const focus=returnFocus;returnFocus=null;if(placeholder?.parentNode)placeholder.parentNode.insertBefore(host,placeholder);placeholder?.remove();placeholder=null;host.classList.remove('is-expanded');expand.textContent='⛶ Full screen';expand.title='Full screen';expand.setAttribute('aria-label','Full screen');expand.setAttribute('aria-expanded','false');requestDraw();win.requestAnimationFrame(()=>{resize();focus?.focus?.({preventScroll:true});});}
  function setExpanded(value){
   value=!!value;if(destroyed||value===expanded)return;if(!value)cancelPaste(false);finishGesture();expanded=value;firstExpandFitPending=value&&api.fitOnFirstExpand===true&&!firstExpandFitted;const version=++expansionVersion;
   if(value){returnFocus=doc.activeElement;placeholder=doc.createComment('Artwork editor position');host.before(placeholder);const fullscreenRoot=doc.fullscreenElement; (fullscreenRoot||doc.body).append(host);host.classList.add('is-expanded');expand.textContent='↙';expand.title='Return to console';expand.setAttribute('aria-label','Return to console');expand.setAttribute('aria-expanded','true');resize();canvas.focus({preventScroll:true});if(!fullscreenRoot&&typeof host.requestFullscreen==='function'){nativeFullscreen=true;Promise.resolve(host.requestFullscreen()).then(()=>{if(destroyed||!expanded||version!==expansionVersion){if(doc.fullscreenElement===host)Promise.resolve(doc.exitFullscreen()).catch(()=>{});}}).catch(()=>{if(version===expansionVersion)nativeFullscreen=false;resize();});}}
   else{nativeFullscreen=false;if(doc.fullscreenElement===host)Promise.resolve(doc.exitFullscreen()).catch(()=>{});restorePortal();}
   api.onExpandedChange?.(expanded);
  }
  function fullscreenChanged(){if(destroyed)return;if(nativeFullscreen&&doc.fullscreenElement!==host){nativeFullscreen=false;if(expanded){expanded=false;restorePortal();api.onExpandedChange?.(false);}}resize();}
  function exitEditor(){cancelPaste(false);finishGesture();if(typeof api.onExit==='function')api.onExit();else setExpanded(false);}
  function hidden(){if(doc.hidden)cancelGesture();}
  function blur(){spaceHeld=false;sampledKey=null;cancelGesture();}
  function selectTarget(id){if(!targets().some(item=>item.id===id))return false;cancelPaste(false);clearStamp(false);selection=null;finishGesture();target=id;targetSelect.value=id;refresh();return true;}
  targetSelect.onchange=()=>selectTarget(targetSelect.value);toolSelect.onchange=()=>selectTool(toolSelect.value);colorInput.oninput=()=>setColor(colorInput.value+rgba.slice(7));hexInput.onchange=()=>{if(!setColor(hexInput.value)){hexInput.setAttribute('aria-invalid','true');setStatus('Enter #RRGGBB or #RRGGBBAA, for example #53d9ffff.');}};zoomSelect.onchange=()=>setZoom(Number(zoomSelect.value));grid.onchange=()=>{showGrid=grid.checked;requestDraw();};
  assetToggle.onchange=()=>{if(!editable()||!hasAssetPreview()){syncAssetPreview();return;}finishGesture();assetsVisible=assetToggle.checked;requestDraw();setStatus(assetsVisible?'Asset guide shown. Paint and sample the background underneath.':'Asset guide hidden.');};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',event=>{if(gesture?.id===event.pointerId)cancelGesture();});canvas.addEventListener('lostpointercapture',event=>{if(gesture?.id===event.pointerId)cancelGesture();});canvas.addEventListener('contextmenu',event=>event.preventDefault());canvas.addEventListener('wheel',wheel,{passive:false});
  doc.addEventListener('keydown',keydown,true);doc.addEventListener('keyup',keyup,true);doc.addEventListener('visibilitychange',hidden);doc.addEventListener('fullscreenchange',fullscreenChanged);win.addEventListener('blur',blur);win.addEventListener('resize',resize);
  const observer=typeof win.ResizeObserver==='function'?new win.ResizeObserver(resize):null;observer?.observe(stage);resize();refresh();if(api.startExpanded===true)setExpanded(true);
  return {refresh,selectTarget,finishGesture,cancelGesture,setExpanded,selectTool,copySelection,beginPaste,commitPaste,cancelPaste,getState:()=>({target,tool,color:rgba,rgba,zoom,grid:showGrid,assetsVisible,assetPreviewAvailable:hasAssetPreview(),expanded,loading,width,height,pan:{x:panX,y:panY},cursor:cursor?{...cursor}:null,stroke:!!gesture,selection:selection?{...selection}:null,stampReady:!!stamp,stampSize:stamp?{width:stamp.clip.width,height:stamp.clip.height}:null,stampSourceSize:stamp?{width:stamp.sourceClip.width,height:stamp.sourceClip.height}:null,stampPosition:stampPosition?{...stampPosition}:null,pasting:pastePreview?{x:pastePreview.x,y:pastePreview.y,width:pastePreview.clip.width,height:pastePreview.clip.height}:null,clipboard:!!selectionCore()?.clipboard.has(),viewport:{width:canvas.width,height:canvas.height},edits:currentData()}),dispose(){if(destroyed)return;cancelPaste(false);selection=null;cancelGesture();if(expanded)setExpanded(false);destroyed=true;stamp=null;stampPosition=null;++loadToken;observer?.disconnect();if(drawFrame)win.cancelAnimationFrame(drawFrame);doc.removeEventListener('keydown',keydown,true);doc.removeEventListener('keyup',keyup,true);doc.removeEventListener('visibilitychange',hidden);doc.removeEventListener('fullscreenchange',fullscreenChanged);win.removeEventListener('blur',blur);win.removeEventListener('resize',resize);host.classList.remove('artwork-editor','is-expanded');delete host.dataset.artworkEditor;host.replaceChildren();}};
 }
 return {TILE,MAX_DIMENSION,MAX_AREA,MAX_RUNS,validateTexture,normalizeTexture,validate,normalize,changePixels,composePixels,compose,linePoints,mount};
});
