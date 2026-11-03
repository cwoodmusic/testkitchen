/* Sparse, reversible pixel details for the JavaScript character renderer. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;if(root)root.CodaPixelEditor=value;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const WIDTH=80,HEIGHT=96,ORIGIN={x:40,y:80},DIRECTIONS=['down','left','up','right'];
 const TARGETS=['player','scholar','bach','schoenberg','handel','vivaldi','mozart','beethoven','clara','joplin','ellington','ella','nina','miles','dj','chopin','captain-cadence','haydn','riff','pip','vee-jay','zizi','metronome'];
 const copy=value=>JSON.parse(JSON.stringify(value));
 const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const normalizedColor=value=>value===null||value?.length===9&&value.slice(-2).toLowerCase()==='00'?null:value?.length===9&&value.slice(-2).toLowerCase()==='ff'?value.slice(0,7).toLowerCase():value?.toLowerCase();
 function validate(data){
  if(!object(data)||Object.keys(data).some(id=>!TARGETS.includes(id)))return false;
  return Object.entries(data).every(([,views])=>object(views)&&Object.keys(views).every(direction=>DIRECTIONS.includes(direction))&&Object.values(views).every(points=>{
   if(!Array.isArray(points)||points.length>WIDTH*HEIGHT)return false;const seen=new Set();
   return points.every(point=>Array.isArray(point)&&point.length===3&&Number.isInteger(point[0])&&point[0]>=0&&point[0]<WIDTH&&Number.isInteger(point[1])&&point[1]>=0&&point[1]<HEIGHT&&(point[2]===null||typeof point[2]==='string'&&/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(point[2]))&&!seen.has(point[1]*WIDTH+point[0])&&!!seen.add(point[1]*WIDTH+point[0]));
  }));
 }
 function normalize(data){if(!validate(data))return null;const result={};for(const id of TARGETS){if(!data[id])continue;const views={};for(const direction of DIRECTIONS){const points=data[id][direction];if(points?.length)views[direction]=points.map(([x,y,color])=>[x,y,normalizedColor(color)]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);}if(Object.keys(views).length)result[id]=views;}return result;}
 function changePixels(data,id,direction,points,color){
  if(!validate(data)||!TARGETS.includes(id)||!DIRECTIONS.includes(direction)||!(color===undefined||color===null||typeof color==='string'&&/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(color)))return null;
  const next=copy(data),values=new Map((next[id]?.[direction]||[]).map(point=>[point[1]*WIDTH+point[0],point]));
  for(const point of points){const [x,y]=point;if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=WIDTH||y<0||y>=HEIGHT)continue;const key=y*WIDTH+x;if(color===undefined)values.delete(key);else values.set(key,[x,y,normalizedColor(color)]);}
  next[id]??={};next[id][direction]=Array.from(values.values());return normalize(next);
 }
 function linePoints(a,b){let [x,y]=a;const [tx,ty]=b,dx=Math.abs(tx-x),dy=-Math.abs(ty-y),sx=x<tx?1:-1,sy=y<ty?1:-1,result=[];let error=dx+dy;while(true){result.push([x,y]);if(x===tx&&y===ty)break;const twice=2*error;if(twice>=dy){error+=dy;x+=sx;}if(twice<=dx){error+=dx;y+=sy;}}return result;}
 function floodPixels(rgba,x,y){
  if(!rgba||rgba.length!==WIDTH*HEIGHT*4||!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=WIDTH||y<0||y>=HEIGHT)return [];
  const origin=(y*WIDTH+x)*4,color=Array.from(rgba.slice(origin,origin+4)),visited=new Uint8Array(WIDTH*HEIGHT),pending=[y*WIDTH+x],result=[];
  while(pending.length){const at=pending.pop();if(visited[at])continue;visited[at]=1;const offset=at*4;if(!color.every((value,index)=>rgba[offset+index]===value))continue;const xx=at%WIDTH,yy=Math.floor(at/WIDTH);result.push([xx,yy]);if(xx)pending.push(at-1);if(xx<WIDTH-1)pending.push(at+1);if(yy)pending.push(at-WIDTH);if(yy<HEIGHT-1)pending.push(at+WIDTH);}
  return result;
 }
 function mount(api={}){
  const host=api.host,renderer=api.renderer;if(!host||!renderer?.renderPixelFrame)throw Error('Pixel editing needs a host and character renderer.');
  const doc=host.ownerDocument,win=doc.defaultView;let target='player',facing='down',tool='pencil',color='#ff5f97',zoom=4,mode='walk',showGrid=true,animated=true,working=null,stroke=null,frame=0,destroyed=false,lastTime=0,source=null,selection=null,paste=null,pastePosition=null,pasteCanvas=null;
  let pickerReturnTool='pencil',sampledKey=null,stamp=null,stampPosition=null,stampWidthChoice=null,stampHeightChoice=null;
  const el=(tag,className,text)=>{const node=doc.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
  const button=(text,action)=>{const node=el('button','',text);node.type='button';node.onclick=action;return node;};
  const field=(label,node)=>{const wrapper=el('label','pixel-field');wrapper.append(doc.createTextNode(label),node);return wrapper;};
  const select=(label,values)=>{const node=el('select');node.setAttribute('aria-label',label);for(const value of values){const option=el('option','',value.label||value.name||value.id);option.value=value.id;node.append(option);}return node;};
  host.classList.add('pixel-editor');host.replaceChildren();
  host.append(el('h3','dev-heading','Pixel sprite details'),el('p','dev-note','Paint one pixel at a time. Drag Select around pixels, Copy, then Paste and click where they belong. Stamp (S) captures selected pixels with Ctrl/Command-click; width and height resize the copies. Eyedropper samples an exact colour. Escape cancels a paste. Each direction keeps its own details and animation.'));
  const targets=(api.getTargets?.()||TARGETS.map(id=>({id,name:id}))).filter(item=>TARGETS.includes(item.id));if(!targets.length)targets.push({id:'player',name:'Your avatar'});target=targets[0].id;
  const targetSelect=select('Sprite character',targets),facingSelect=select('Sprite direction',[{id:'down',label:'Front'},{id:'left',label:'Left'},{id:'up',label:'Back'},{id:'right',label:'Right'}]);
  const toolbar=el('div','pixel-fields');toolbar.append(field('Character',targetSelect),field('Facing',facingSelect));host.append(toolbar);
  const toolSelect=select('Pixel tool',[{id:'pencil',label:'Pencil'},{id:'select',label:'Select rectangle'},{id:'stamp',label:'Stamp selected pixels'},{id:'erase',label:'Eraser'},{id:'picker',label:'Eyedropper · pick colour'},{id:'fill',label:'Fill connected colour'},{id:'restore',label:'Restore original pixel'},{id:'pan',label:'Pan canvas'}]);
  const colorInput=el('input');colorInput.type='color';colorInput.value=color;colorInput.setAttribute('aria-label','Pixel colour');
  const tools=el('div','pixel-fields');tools.append(field('Tool',toolSelect),field('Colour',colorInput));host.append(tools);
  const hexInput=el('input');hexInput.type='text';hexInput.value=color+'ff';hexInput.maxLength=9;hexInput.spellcheck=false;hexInput.setAttribute('aria-label','Pixel exact hex colour');host.append(field('Exact colour · #RRGGBBAA',hexInput));
  const editTools=el('div','pixel-actions pixel-selection-tools');editTools.setAttribute('role','group');editTools.setAttribute('aria-label','Pixel selection and colour tools');
  const selectButton=button('Select',()=>chooseTool('select'));selectButton.dataset.pixelSelect='';
  const copyButton=button('Copy',copySelection);copyButton.dataset.pixelCopy='';copyButton.title='Copy selected pixels (Ctrl/Cmd+C)';
  const pasteButton=button('Paste',beginPaste);pasteButton.dataset.pixelPaste='';pasteButton.title='Preview copied pixels (Ctrl/Cmd+V)';
  const pickerButton=button('Eyedropper',()=>chooseTool('picker'));pickerButton.dataset.pixelEyedropper='';pickerButton.title='Sample the exact pixel colour (I or Alt-click)';
  const stampButton=button('Stamp',()=>chooseTool('stamp'));stampButton.dataset.pixelStamp='';stampButton.title='Select pixels, then Ctrl/Command-click to capture them. Click to stamp copies (S).';editTools.append(selectButton,copyButton,pasteButton,stampButton,pickerButton);host.append(editTools);
  const stampTools=el('div','pixel-fields');stampTools.dataset.pixelStampControls='';const stampWidthInput=el('input'),stampHeightInput=el('input');for(const [input,name,max]of [[stampWidthInput,'width',WIDTH],[stampHeightInput,'height',HEIGHT]]){input.type='number';input.min='1';input.max=String(max);input.step='1';input.placeholder='Selected '+name;input.dataset[name==='width'?'pixelStampWidth':'pixelStampHeight']='';input.setAttribute('aria-label','Stamp '+name+' in pixels');}const captureStampButton=button('Capture selection',()=>captureStamp(cursor));captureStampButton.dataset.pixelCaptureStamp='';stampTools.append(field('Stamp width',stampWidthInput),field('Stamp height',stampHeightInput),captureStampButton);host.append(stampTools);
  if(typeof api.openArtwork==='function'){const full=button('Full-screen pixel editor',()=>{commit();clearTransient();api.openArtwork('character.'+target+'.'+facing);});full.dataset.pixelFullScreen='';host.append(full);}
  const palette=el('div','pixel-palette');palette.setAttribute('role','group');palette.setAttribute('aria-label','Pixel colour palette');
  for(const swatch of ['#171424','#ffffff','#999ca6','#626875','#e5ad75','#704633','#ff5f97','#6ce4da','#f4d77e','#7756a5','#3e6baf','#58a369']){const choose=button('',()=>setColor(swatch));choose.className='pixel-swatch';choose.style.background=swatch;choose.setAttribute('aria-label','Use colour '+swatch);palette.append(choose);}host.append(palette);
  const zoomSelect=select('Pixel zoom',[1,2,3,4,6,8,12].map(value=>({id:String(value),label:value+'×'})));zoomSelect.value=String(zoom);
  const gridToggle=el('input');gridToggle.type='checkbox';gridToggle.checked=true;gridToggle.setAttribute('aria-label','Show pixel grid');const gridLabel=field('Show grid',gridToggle);gridLabel.classList.add('pixel-check');
  const viewTools=el('div','pixel-fields');viewTools.append(field('Zoom',zoomSelect),gridLabel);host.append(viewTools);
  const scroller=el('div','pixel-grid-scroll'),canvas=el('canvas','pixel-grid');canvas.id='pixelEditCanvas';canvas.tabIndex=0;canvas.setAttribute('aria-label','Editable pixel grid. Arrow keys move the cursor; Space paints. Drag Select, then copy and paste. Enter places a paste and Escape cancels it.');scroller.append(canvas);host.append(scroller);
  const status=el('p','pixel-status','Choose a pixel to edit.');status.setAttribute('role','status');status.setAttribute('aria-live','polite');host.append(status);
  const resets=el('div','pixel-actions');resets.append(button('Reset this direction',()=>reset(false)),button('Reset this character',()=>reset(true)));host.append(resets);
  const previewHeading=el('h4','','Live preview'),preview=el('canvas','pixel-preview');preview.id='pixelLivePreview';preview.width=160;preview.height=192;preview.setAttribute('aria-label','Animated sprite preview');
  const modeSelect=select('Sprite preview movement',[{id:'idle',label:'Idle'},{id:'walk',label:'Walk'},{id:'emote',label:'Equipped emote'}]);modeSelect.value=mode;
  const animateToggle=el('input');animateToggle.type='checkbox';animateToggle.checked=true;animateToggle.setAttribute('aria-label','Animate sprite preview');const animateLabel=field('Animate preview',animateToggle);animateLabel.classList.add('pixel-check');
  const motionTools=el('div','pixel-fields');motionTools.append(field('Movement',modeSelect),animateLabel);host.append(previewHeading,motionTools,preview,button('Export facing as PNG',exportPNG),el('p','studioTip','Sprite edits are included in Save project, Export JSON, and the console Undo / Redo controls. Boutique choices still work under your pixel details.'));
  let cursor={x:40,y:45};
  function data(){return working||normalize(api.getData?.()||{})||{};}
  function profile(){return api.getProfile?.(target)|| (target==='player'?{}:renderer.appearanceFor(target));}
  const selectionCore=()=>win.CodaPixelSelection;
  const editable=()=>!destroyed&&api.canEdit?.()!==false;
  const typing=node=>!!node?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
  function setColor(value){if(typeof value!=='string'||!/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value))return false;color=value.toLowerCase();colorInput.value=color.slice(0,7);hexInput.value=color.length===7?color+'ff':color;hexInput.removeAttribute('aria-invalid');status.textContent='Colour '+hexInput.value+'.';return true;}
  function syncSelectionTools(){const core=selectionCore();copyButton.disabled=!core||!selection;pasteButton.disabled=!core?.clipboard.has()||!editable();selectButton.setAttribute('aria-pressed',String(tool==='select'));pickerButton.setAttribute('aria-pressed',String(tool==='picker'));syncStampControls();}
  function clearTransient(){selection=null;paste=null;pastePosition=null;stamp=null;stampPosition=null;stampWidthChoice=null;stampHeightChoice=null;stampWidthInput.value=stampHeightInput.value='';syncSelectionTools();}
  function chooseTool(value){if(stroke)commit();paste=null;pastePosition=null;if(value==='picker'){if(tool!=='picker')pickerReturnTool=tool;}else pickerReturnTool=value;tool=value;toolSelect.value=value;canvas.style.touchAction=tool==='pan'?'pan-x pan-y':'none';syncSelectionTools();drawGrid();canvas.focus({preventScroll:true});status.textContent=tool==='stamp'?'Ctrl/Command-click to capture the selected pixels, then click to stamp.':tool==='select'?'Drag around the exact pixels to copy.':tool==='picker'?'Click a pixel to sample its exact RGBA colour.':'Choose a pixel to edit.';}
  function syncStampControls(){stampTools.hidden=tool!=='stamp';stampButton.disabled=!editable()||!selectionCore();stampButton.setAttribute('aria-pressed',String(tool==='stamp'));captureStampButton.disabled=!editable()||!selection;stampWidthInput.disabled=stampHeightInput.disabled=!editable();}
  function clearStamp(){stamp=null;stampPosition=null;drawGrid();status.textContent='Stamp cleared. Select pixels and Ctrl/Command-click to capture another stamp.';}
  function resizeStamp(){if(!stamp)return true;const w=stampWidthChoice??stamp.sourceClip.width,h=stampHeightChoice??stamp.sourceClip.height,clip=selectionCore()?.resizeClip(stamp.sourceClip,w,h);if(!clip)return false;stamp={...stamp,clip};stampWidthInput.value=String(w);stampHeightInput.value=String(h);drawGrid();return true;}
  function captureStamp(point){
   if(!editable()||!selectionCore()||!source)return false;if(stroke)commit();paste=null;pastePosition=null;
   if(!selection){status.textContent='Use Select to drag around the pixels to capture, then choose Stamp.';return false;}
   const sourceClip=selectionCore().copyPixels(source.getContext('2d').getImageData(0,0,WIDTH,HEIGHT).data,WIDTH,HEIGHT,selection);if(!sourceClip)return false;
   stamp={sourceClip,target,facing};stampPosition={...(point||{x:selection.x,y:selection.y})};if(!resizeStamp()){clearStamp();return false;}status.textContent='Captured '+sourceClip.width+' × '+sourceClip.height+' pixels. Click to stamp '+stamp.clip.width+' × '+stamp.clip.height+' copies. Ctrl/Command-click captures again.';return true;
  }
  function commitStamp(point){
   if(!editable())return false;if(!stamp){status.textContent='Select pixels, then Ctrl/Command-click to capture the stamp first.';return false;}if(stamp.target!==target||stamp.facing!==facing){clearStamp();return false;}
   const position=point||stampPosition||cursor,points=selectionCore()?.stampPixels(stamp.clip,WIDTH,HEIGHT,position.x,position.y)||[],next=copy(normalize(api.getData?.()||{})||{}),values=new Map((next[target]?.[facing]||[]).map(point=>[point[1]*WIDTH+point[0],point]));
   if(!points.length){status.textContent='Move the stamp onto the image before placing it.';return false;}for(const [x,y,value]of points)values.set(y*WIDTH+x,[x,y,normalizedColor(value)]);next[target]??={};next[target][facing]=Array.from(values.values());stampPosition={...position};working=normalize(next);commit();return true;
  }
  function stampSizeChanged(input,axis){if(!editable())return;const value=input.value===''?null:Number(input.value),max=axis==='width'?WIDTH:HEIGHT;if(value!==null&&(!Number.isSafeInteger(value)||value<1||value>max)){input.setAttribute('aria-invalid','true');return;}input.removeAttribute('aria-invalid');if(axis==='width')stampWidthChoice=value;else stampHeightChoice=value;resizeStamp();}
  stampWidthInput.oninput=()=>stampSizeChanged(stampWidthInput,'width');stampHeightInput.oninput=()=>stampSizeChanged(stampHeightInput,'height');
  function copySelection(){
   const core=selectionCore();if(!core||!selection||!source){status.textContent='Use Select to drag around the pixels you want to copy.';return false;}
   const clip=core.copyPixels(source.getContext('2d').getImageData(0,0,WIDTH,HEIGHT).data,WIDTH,HEIGHT,selection);
   if(!clip||!core.clipboard.set(clip))return false;
   syncSelectionTools();status.textContent='Copied '+clip.width+' × '+clip.height+' pixels. Choose Paste, then click where they belong.';return true;
  }
  function beginPaste(){
   if(!editable())return false;const clip=selectionCore()?.clipboard.get();if(!clip){status.textContent='Copy some pixels before choosing Paste.';return false;}
   if(stroke)commit();paste={clip,target,facing};pastePosition={...cursor};syncSelectionTools();drawGrid();canvas.focus({preventScroll:true});status.textContent='Paste preview · click or press Enter to place · Escape cancels.';return true;
  }
  function commitPaste(){
   if(!paste||!pastePosition)return false;if(!editable()||paste.target!==target||paste.facing!==facing){paste=null;pastePosition=null;refresh();status.textContent='Paste cancelled. Editing is unavailable.';return false;}
   const points=selectionCore()?.stampPixels(paste.clip,WIDTH,HEIGHT,pastePosition.x,pastePosition.y)||[],next=copy(normalize(api.getData?.()||{})||{}),values=new Map((next[target]?.[facing]||[]).map(point=>[point[1]*WIDTH+point[0],point]));
   for(const [x,y,value]of points)values.set(y*WIDTH+x,[x,y,normalizedColor(value)]);
   if(points.length){next[target]??={};next[target][facing]=Array.from(values.values());working=normalize(next);}
   paste=null;pastePosition=null;commit();if(!points.length)status.textContent='Paste is outside this image. No pixels changed.';return !!points.length;
  }
  function pixels(options={}){return renderer.renderPixelFrame(target,profile(),{facing,walking:false},0,{pixelEdits:data(),...options});}
  function pasteImage(){
   const placement=paste&&pastePosition?{...paste,position:pastePosition}:tool==='stamp'&&stamp&&stampPosition?{...stamp,position:stampPosition}:null;if(!placement)return source;
   pasteCanvas??=doc.createElement('canvas');pasteCanvas.width=WIDTH;pasteCanvas.height=HEIGHT;const g=pasteCanvas.getContext('2d',{willReadFrequently:true});g.drawImage(source,0,0);
   const image=g.getImageData(0,0,WIDTH,HEIGHT),clip=placement.clip,position=placement.position,left=Math.max(0,position.x),top=Math.max(0,position.y),right=Math.min(WIDTH,position.x+clip.width),bottom=Math.min(HEIGHT,position.y+clip.height);
   for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){const index=(y-position.y)*clip.width+x-position.x;if(clip.mask&&!clip.mask[index])continue;const from=index*4;image.data.set(clip.pixels.subarray(from,from+4),(y*WIDTH+x)*4);}
   g.putImageData(image,0,0);return pasteCanvas;
  }
  function drawGrid(){
   source=pixels();if(!source)return;canvas.width=WIDTH*zoom;canvas.height=HEIGHT*zoom;canvas.style.width=canvas.width+'px';canvas.style.height=canvas.height+'px';const g=canvas.getContext('2d');g.imageSmoothingEnabled=false;
   const tile=Math.max(4,zoom*4);for(let y=0;y<canvas.height;y+=tile)for(let x=0;x<canvas.width;x+=tile){g.fillStyle=((x/tile+y/tile)%2)?'#293246':'#39445b';g.fillRect(x,y,tile,tile);}g.drawImage(pasteImage(),0,0,canvas.width,canvas.height);
   if(showGrid&&zoom>=3){g.strokeStyle='#d9e5ff24';g.lineWidth=1;g.beginPath();for(let x=0;x<=WIDTH;x++){g.moveTo(x*zoom+.5,0);g.lineTo(x*zoom+.5,canvas.height);}for(let y=0;y<=HEIGHT;y++){g.moveTo(0,y*zoom+.5);g.lineTo(canvas.width,y*zoom+.5);}g.stroke();}
   const placement=paste&&pastePosition?{...paste,position:pastePosition}:tool==='stamp'&&stamp&&stampPosition?{...stamp,position:stampPosition}:null,outline=placement?{...placement.position,width:placement.clip.width,height:placement.clip.height}:selection;
   if(outline){g.save();g.strokeStyle='#121526';g.lineWidth=3;g.strokeRect(outline.x*zoom+.5,outline.y*zoom+.5,outline.width*zoom-1,outline.height*zoom-1);g.strokeStyle=placement?'#ffe17f':'#f0ffff';g.lineWidth=1;g.setLineDash([5,3]);g.strokeRect(outline.x*zoom+.5,outline.y*zoom+.5,outline.width*zoom-1,outline.height*zoom-1);g.restore();}
   g.strokeStyle='#a7ffde';g.lineWidth=1;g.strokeRect(cursor.x*zoom+.5,cursor.y*zoom+.5,Math.max(1,zoom-1),Math.max(1,zoom-1));
   syncSelectionTools();
  }
  function drawPreview(time){const motion={facing,walking:mode==='walk',phase:time*7,emote:mode==='emote'?(profile().emote||'wave'):null,emoteTime:time};const image=renderer.renderPixelFrame(target,profile(),motion,time,{pixelEdits:data()});if(!image)return;const g=preview.getContext('2d');g.clearRect(0,0,preview.width,preview.height);g.imageSmoothingEnabled=false;g.drawImage(image,0,0,preview.width,preview.height);}
  function tick(time){frame=0;if(destroyed||!host.isConnected||!host.getClientRects().length)return;lastTime=time/1000;drawPreview(animated?lastTime:0);if(animated)frame=win.requestAnimationFrame(tick);}
  function start(){if(frame)win.cancelAnimationFrame(frame);frame=0;drawPreview(animated?lastTime:0);if(animated&&host.isConnected&&host.getClientRects().length)frame=win.requestAnimationFrame(tick);}
  function refresh(){if(destroyed)return;drawGrid();start();}
  function commit(){const next=working;working=null;stroke=null;if(!next){if(!destroyed)refresh();return;}const previous=normalize(api.getData?.()||{})||{};if(!editable()){refresh();status.textContent='Editing is unavailable. Pixel details were kept.';return;}if(JSON.stringify(previous)!==JSON.stringify(next)){try{if(api.onChange?.(next)===false)throw Error('unavailable');status.textContent='Pixel details applied. Undo is available.';}catch{status.textContent='Pixel details could not be saved. Try again.';}}refresh();}
  function locate(event){const box=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(WIDTH-1,Math.floor((event.clientX-box.left)*canvas.width/box.width/zoom))),y:Math.max(0,Math.min(HEIGHT-1,Math.floor((event.clientY-box.top)*canvas.height/box.height/zoom)))};}
  function sample(point,temporary=false){cursor=point;if(!source)return;const value=source.getContext('2d').getImageData(point.x,point.y,1,1).data;setColor('#'+Array.from(value,channel=>channel.toString(16).padStart(2,'0')).join(''));if(tool==='picker'&&!temporary)chooseTool(pickerReturnTool);else drawGrid();status.textContent='Copied '+hexInput.value+'. '+(tool==='picker'?'Eyedropper ready.':toolSelect.selectedOptions[0].textContent+' ready.');}
  function paint(point,last){cursor=point;if(tool==='picker'){sample(point);return;}if(!editable())return;
   let points=last?linePoints([last.x,last.y],[point.x,point.y]):[[point.x,point.y]];
   if(tool==='fill')points=floodPixels(source.getContext('2d').getImageData(0,0,WIDTH,HEIGHT).data,point.x,point.y);
   working=changePixels(data(),target,facing,points,tool==='erase'?null:tool==='restore'?undefined:color);drawGrid();drawPreview(lastTime);status.textContent='Pixel '+point.x+', '+point.y+' · '+(tool==='erase'?'transparent':tool==='restore'?'original':color);
  }
  function down(event){if(event.button!==0)return;const point=locate(event);if(event.altKey){event.preventDefault();canvas.focus({preventScroll:true});sample(point,true);return;}if(tool==='stamp'){event.preventDefault();canvas.focus({preventScroll:true});cursor=point;stampPosition={...point};if(event.ctrlKey||event.metaKey)captureStamp(point);else commitStamp(point);return;}if(paste){event.preventDefault();cursor=point;pastePosition={...point};commitPaste();return;}if(tool==='pan'){if(event.pointerType!=='touch'){event.preventDefault();stroke={id:event.pointerId,pan:true,x:event.clientX,y:event.clientY,left:scroller.scrollLeft,top:scroller.scrollTop};canvas.setPointerCapture?.(event.pointerId);}return;}event.preventDefault();canvas.focus({preventScroll:true});if(tool==='select'){paste=null;pastePosition=null;selection=selectionCore()?.rectangle([point.x,point.y],[point.x,point.y],WIDTH,HEIGHT)||null;stroke={id:event.pointerId,select:true,start:point};cursor=point;canvas.setPointerCapture?.(event.pointerId);drawGrid();return;}if(tool==='picker'){sample(point);return;}if(!editable())return;working=copy(normalize(api.getData?.()||{})||{});stroke={id:event.pointerId,last:point};canvas.setPointerCapture?.(event.pointerId);paint(point);if(tool==='fill')commit();}
  function move(event){const point=locate(event);if(paste&&!stroke){cursor=point;pastePosition={...point};drawGrid();return;}if(tool==='stamp'&&stamp&&!stroke){cursor=point;stampPosition={...point};drawGrid();return;}if(!stroke||event.pointerId!==stroke.id)return;event.preventDefault();if(stroke.pan){scroller.scrollLeft=stroke.left+stroke.x-event.clientX;scroller.scrollTop=stroke.top+stroke.y-event.clientY;return;}if(stroke.select){cursor=point;selection=selectionCore()?.rectangle([stroke.start.x,stroke.start.y],[point.x,point.y],WIDTH,HEIGHT)||null;drawGrid();return;}paint(point,stroke.last);stroke.last=point;}
  function up(event){if(!stroke||event.pointerId!==stroke.id)return;event.preventDefault();const selected=stroke.select;commit();if(selected&&selection)status.textContent='Selected '+selection.width+' × '+selection.height+' pixels. Choose Copy.';}
  function cancel(event){if(stroke&&event.pointerId===stroke.id){if(stroke.select)selection=null;working=null;stroke=null;refresh();status.textContent='Stroke cancelled.';}}
  function reset(all){if(!editable())return;clearTransient();const next=copy(data());if(all)delete next[target];else if(next[target])delete next[target][facing];working=normalize(next);commit();}
  function exportPNG(){const image=pixels();if(!image)return;const link=doc.createElement('a');link.download='coda-'+target+'-'+facing+'.png';link.href=image.toDataURL('image/png');link.click();}
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',event=>{if(stroke?.id===event.pointerId)commit();});
  canvas.addEventListener('keydown',event=>{if(event.ctrlKey||event.metaKey){if(event.key==='Enter'&&tool==='stamp'){event.preventDefault();event.stopPropagation();if(!event.repeat)captureStamp(cursor);}return;}if(event.repeat&&sampledKey===(event.code||event.key)){event.preventDefault();event.stopPropagation();return;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();event.stopPropagation();const dx=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0,dy=event.key==='ArrowDown'?1:event.key==='ArrowUp'?-1:0;if(paste&&pastePosition){pastePosition={x:Math.max(1-paste.clip.width,Math.min(WIDTH-1,pastePosition.x+dx)),y:Math.max(1-paste.clip.height,Math.min(HEIGHT-1,pastePosition.y+dy))};}else if(tool==='stamp'&&stamp){const position=stampPosition||cursor;stampPosition={x:Math.max(1-stamp.clip.width,Math.min(WIDTH-1,position.x+dx)),y:Math.max(1-stamp.clip.height,Math.min(HEIGHT-1,position.y+dy))};cursor={x:Math.max(0,Math.min(WIDTH-1,stampPosition.x)),y:Math.max(0,Math.min(HEIGHT-1,stampPosition.y))};}else cursor={x:Math.max(0,Math.min(WIDTH-1,cursor.x+dx)),y:Math.max(0,Math.min(HEIGHT-1,cursor.y+dy))};drawGrid();status.textContent=paste?'Paste preview · Enter places · Escape cancels.':'Pixel '+cursor.x+', '+cursor.y;}else if(event.code==='Space'||event.key==='Enter'){event.preventDefault();event.stopPropagation();if(paste){commitPaste();return;}if(tool==='stamp'){if(!event.repeat)commitStamp(stampPosition||cursor);return;}if(tool==='pan'||tool==='select'){status.textContent=tool==='select'?'Drag to select a rectangle, then choose Copy.':'Drag to pan the canvas, then choose a painting tool.';return;}if(tool==='picker'){sample(cursor);sampledKey=event.code||event.key;return;}if(!editable())return;working=copy(data());paint(cursor);commit();}});
  canvas.addEventListener('keyup',event=>{if(sampledKey===(event.code||event.key))sampledKey=null;});
  function shortcuts(event){if(typing(event.target))return;const key=event.key.toLowerCase(),command=event.ctrlKey||event.metaKey;if(command&&(key==='c'||key==='v')){event.preventDefault();event.stopPropagation();key==='c'?copySelection():beginPaste();return;}if(!command&&(key==='i'||key==='s')){event.preventDefault();event.stopPropagation();chooseTool(key==='i'?'picker':'stamp');return;}if(event.key==='Escape'&&(paste||selection||stroke||stamp)){event.preventDefault();event.stopPropagation();if(stamp){clearStamp();return;}working=null;stroke=null;clearTransient();refresh();status.textContent='Selection or paste cancelled.';}}
  host.addEventListener('keydown',shortcuts);
  for(const [control,action]of [[targetSelect,()=>{clearTransient();target=targetSelect.value;}],[facingSelect,()=>{clearTransient();facing=facingSelect.value;}],[toolSelect,()=>{chooseTool(toolSelect.value);}],[zoomSelect,()=>{zoom=Number(zoomSelect.value);}],[gridToggle,()=>{showGrid=gridToggle.checked;}],[modeSelect,()=>{mode=modeSelect.value;}],[animateToggle,()=>{animated=animateToggle.checked;}]])control.addEventListener('change',()=>{if(stroke)commit();action();refresh();});
  colorInput.addEventListener('input',()=>setColor(colorInput.value));hexInput.addEventListener('input',()=>{if(!setColor(hexInput.value))hexInput.setAttribute('aria-invalid','true');});refresh();
  function cancelGesture(){sampledKey=null;if(stroke||paste){working=null;stroke=null;paste=null;pastePosition=null;refresh();status.textContent='Stroke or paste cancelled.';}}
  const hidden=()=>{if(doc.hidden)cancelGesture();};win.addEventListener('blur',cancelGesture);doc.addEventListener('visibilitychange',hidden);
  return {refresh,finishGesture:commit,cancelGesture,getState:()=>({target,facing,tool,color,zoom,mode,animated,grid:showGrid,stroke:!!stroke,selection:selection?{...selection}:null,stampReady:!!stamp,stampSize:stamp?{width:stamp.clip.width,height:stamp.clip.height}:null,stampSourceSize:stamp?{width:stamp.sourceClip.width,height:stamp.sourceClip.height}:null,stampPosition:stampPosition?{...stampPosition}:null,pasting:!!paste,pastePosition:pastePosition?{...pastePosition}:null,clipboard:!!selectionCore()?.clipboard.has(),edits:copy(data()),cursor:{...cursor}}),dispose(){if(destroyed)return;destroyed=true;working=null;stroke=null;paste=null;selection=null;stamp=null;stampPosition=null;host.removeEventListener('keydown',shortcuts);win.removeEventListener('blur',cancelGesture);doc.removeEventListener('visibilitychange',hidden);if(frame)win.cancelAnimationFrame(frame);host.replaceChildren();}};
 }
 return {WIDTH,HEIGHT,ORIGIN,DIRECTIONS,TARGETS,validate,normalize,changePixels,linePoints,floodPixels,mount};
});
