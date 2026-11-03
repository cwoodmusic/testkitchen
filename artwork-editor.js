/* Lossless, reversible artwork pixels. Only source-size images are allocated;
 * the editor viewport stays small even when a room is magnified 64 times. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaArtworkEditor=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const TILE=64,MAX_DIMENSION=8192,MAX_AREA=16777216,MAX_RUNS=262144;
 let editorSequence=0;
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
 const linearRGB=Float64Array.from({length:256},(_,value)=>{const channel=value/255;return channel<=.04045?channel/12.92:Math.pow((channel+.055)/1.055,2.4);});
 const srgbByte=value=>Math.round(clamp(value<=.0031308?value*12.92:1.055*Math.pow(value,1/2.4)-.055,0,1)*255);
 function selectionContains(selection,x,y){
  if(!selection)return true;
  if(x<selection.x||y<selection.y||x>=selection.x+selection.width||y>=selection.y+selection.height)return false;
  if(!Array.isArray(selection.points))return true;
  const points=selection.points,px=x,py=y;let inside=false;
  for(let index=0,last=points.length-1;index<points.length;last=index++){
   const a=points[last],b=points[index],dx=b[0]-a[0],dy=b[1]-a[1],cross=(px-a[0])*dy-(py-a[1])*dx;
   if(Math.abs(cross)<1e-8&&px>=Math.min(a[0],b[0])&&px<=Math.max(a[0],b[0])&&py>=Math.min(a[1],b[1])&&py<=Math.max(a[1],b[1]))return true;
   if((a[1]>py)!==(b[1]>py)&&px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }return inside;
 }
 function createBlendingStroke(rgba,width,height,options={},feather=false){
  const radius=options.radius===undefined?8:options.radius,strength=options.strength===undefined?.35:options.strength,selection=options.selection?clone(options.selection):null;
  if(!dimensions(width,height)||!rgba||rgba.length!==width*height*4||!(['[object Uint8ClampedArray]','[object Uint8Array]'].includes(Object.prototype.toString.call(rgba))||Array.isArray(rgba)&&rgba.every(value=>Number.isInteger(value)&&value>=0&&value<=255))||!Number.isInteger(radius)||radius<1||radius>64||!Number.isFinite(strength)||strength<0||strength>1)return null;
  if(selection&&(!Number.isInteger(selection.x)||!Number.isInteger(selection.y)||!dimensions(selection.width,selection.height)||selection.x<0||selection.y<0||selection.x+selection.width>width||selection.y+selection.height>height||selection.points&&(!Array.isArray(selection.points)||selection.points.length<3||selection.points.length>512||selection.points.some(point=>!Array.isArray(point)||point.length!==2||!point.every(Number.isSafeInteger)||point[0]<0||point[1]<0||point[0]>=width||point[1]>=height))))return null;
  if(options.protectedMask&&(!(options.protectedMask instanceof Uint8Array)||options.protectedMask.length!==width*height))return null;
  const source=new Uint8ClampedArray(rgba),protection=options.protectedMask?new Uint8Array(options.protectedMask):null,coverage=new Uint16Array(width*height),blur=feather?Math.ceil(radius/3):Math.min(8,Math.ceil(radius/3)),channels=feather?5:4;
  const clip=selection?{left:selection.x,top:selection.y,right:selection.x+selection.width-1,bottom:selection.y+selection.height-1}:{left:0,top:0,right:width-1,bottom:height-1};
  let sums=new Float64Array(0),sampled=0,visited=0;
  function integral(left,top,right,bottom){
   const w=right-left+1,h=bottom-top+1,stride=w+1,total=(w+1)*(h+1)*channels;if(sums.length<total)sums=new Float64Array(total);else sums.fill(0,0,total);
   for(let y=0;y<h;y++){let red=0,green=0,blue=0,alpha=0,count=0;
    for(let x=0;x<w;x++){const px=left+x,py=top+y,index=py*width+px,at=index*4,a=source[at+3];sampled++;
     if((a||feather)&&!protection?.[index]&&selectionContains(selection,px,py)){red+=linearRGB[source[at]]*a;green+=linearRGB[source[at+1]]*a;blue+=linearRGB[source[at+2]]*a;alpha+=a;count++;}
     const to=((y+1)*stride+x+1)*channels,above=(y*stride+x+1)*channels;sums[to]=sums[above]+red;sums[to+1]=sums[above+1]+green;sums[to+2]=sums[above+2]+blue;sums[to+3]=sums[above+3]+alpha;if(feather)sums[to+4]=sums[above+4]+count;
    }
   }return {left,top,stride};
  }
  function sum(table,left,top,right,bottom,channel){const a=((top-table.top)*table.stride+left-table.left)*channels+channel,b=((top-table.top)*table.stride+right-table.left+1)*channels+channel,c=((bottom-table.top+1)*table.stride+left-table.left)*channels+channel,d=((bottom-table.top+1)*table.stride+right-table.left+1)*channels+channel;return sums[d]-sums[b]-sums[c]+sums[a];}
  function applySegment(a,b=a){
   const changes=new Map();let bounds=null;
   if(!Array.isArray(a)||!Array.isArray(b)||a.length!==2||b.length!==2||![...a,...b].every(value=>Number.isFinite(value)&&Math.abs(value)<=MAX_DIMENSION*2)||!strength)return {changes:[],bounds};
   const parts=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/32));
   for(let part=0;part<parts;part++){
    const ax=a[0]+(b[0]-a[0])*part/parts,ay=a[1]+(b[1]-a[1])*part/parts,bx=a[0]+(b[0]-a[0])*(part+1)/parts,by=a[1]+(b[1]-a[1])*(part+1)/parts;
    const left=Math.max(clip.left,Math.floor(Math.min(ax,bx)-radius)),right=Math.min(clip.right,Math.ceil(Math.max(ax,bx)+radius)),top=Math.max(clip.top,Math.floor(Math.min(ay,by)-radius)),bottom=Math.min(clip.bottom,Math.ceil(Math.max(ay,by)+radius));if(right<left||bottom<top)continue;
    const table=integral(Math.max(clip.left,left-blur),Math.max(clip.top,top-blur),Math.min(clip.right,right+blur),Math.min(clip.bottom,bottom+blur)),dx=bx-ax,dy=by-ay,length=dx*dx+dy*dy;
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){visited++;const index=y*width+x,at=index*4,alpha=source[at+3];if(!feather&&!alpha||protection?.[index]||!selectionContains(selection,x,y))continue;
     const t=length?clamp(((x-ax)*dx+(y-ay)*dy)/length,0,1):0,distance=Math.hypot(x-ax-t*dx,y-ay-t*dy);if(distance>=radius)continue;
     const edge=1-distance/radius,weight=Math.round(strength*edge*edge*(3-2*edge)*65535+1e-8);if(weight<=coverage[index])continue;coverage[index]=weight;
     const x0=Math.max(clip.left,x-blur),x1=Math.min(clip.right,x+blur),y0=Math.max(clip.top,y-blur),y1=Math.min(clip.bottom,y+blur),totalAlpha=sum(table,x0,y0,x1,y1,3);if(totalAlpha<=0)continue;
     const amount=weight/65535;let red,green,blue,nextAlpha=alpha;
     if(feather){
      // Real canvas edges count as transparent; protected and unselected samples
      // do not. This avoids creating a cut along a protection/selection boundary.
      const full=(blur*2+1)**2,inImage=(Math.min(width-1,x+blur)-Math.max(0,x-blur)+1)*(Math.min(height-1,y+blur)-Math.max(0,y-blur)+1),count=sum(table,x0,y0,x1,y1,4)+full-inImage;
      if(!count)continue;const blurredAlpha=totalAlpha/count,mixedAlpha=alpha*(1-amount)+blurredAlpha*amount;nextAlpha=Math.round(mixedAlpha);
      // Feather opacity at edges, keeping fully opaque interior details sharp.
      if(nextAlpha===alpha)continue;
      if(!nextAlpha){red=green=blue=0;}
      else{
       red=srgbByte((linearRGB[source[at]]*alpha*(1-amount)+sum(table,x0,y0,x1,y1,0)/count*amount)/mixedAlpha);
       green=srgbByte((linearRGB[source[at+1]]*alpha*(1-amount)+sum(table,x0,y0,x1,y1,1)/count*amount)/mixedAlpha);
       blue=srgbByte((linearRGB[source[at+2]]*alpha*(1-amount)+sum(table,x0,y0,x1,y1,2)/count*amount)/mixedAlpha);
      }
     }else{
      red=srgbByte(linearRGB[source[at]]*(1-amount)+sum(table,x0,y0,x1,y1,0)/totalAlpha*amount);green=srgbByte(linearRGB[source[at+1]]*(1-amount)+sum(table,x0,y0,x1,y1,1)/totalAlpha*amount);blue=srgbByte(linearRGB[source[at+2]]*(1-amount)+sum(table,x0,y0,x1,y1,2)/totalAlpha*amount);
      if(red===source[at]&&green===source[at+1]&&blue===source[at+2])continue;
     }
     changes.set(index,(red|green<<8|blue<<16|nextAlpha<<24)>>>0);if(!bounds)bounds={x,y,right:x,bottom:y};else{bounds.x=Math.min(bounds.x,x);bounds.y=Math.min(bounds.y,y);bounds.right=Math.max(bounds.right,x);bounds.bottom=Math.max(bounds.bottom,y);}
    }
   }return {changes:Array.from(changes),bounds};
  }
  return {applySegment,getStats:()=>({sampled,visited})};
 }
 function createSmoothingStroke(rgba,width,height,options={}){return createBlendingStroke(rgba,width,height,options);}
 function createFeatheringStroke(rgba,width,height,options={}){return createBlendingStroke(rgba,width,height,options,true);}
 // Hard-edged source-pixel brushes and shapes. No canvas antialiasing is used.
 function* brushPixels(points,size=1,shape='square',width=MAX_DIMENSION,height=MAX_DIMENSION){
  size=clamp(Math.round(size)||1,1,128);const left=Math.floor((size-1)/2),right=size-1-left,seen=new Set();
  for(const [cx,cy]of points)for(let y=Math.max(0,cy-left);y<=Math.min(height-1,cy+right);y++)for(let x=Math.max(0,cx-left);x<=Math.min(width-1,cx+right);x++){
   if(shape==='round'&&size>1&&Math.hypot((x-cx+(left-right)/2)/(size/2),(y-cy+(left-right)/2)/(size/2))>1)continue;
   const key=y*width+x;if(!seen.has(key)){seen.add(key);yield [x,y];}
  }
 }
 function* shapePixels(a,b,kind='rectangle',filled=false,stroke=1,width=MAX_DIMENSION,height=MAX_DIMENSION){
  const left=Math.max(0,Math.min(a[0],b[0])),right=Math.min(width-1,Math.max(a[0],b[0])),top=Math.max(0,Math.min(a[1],b[1])),bottom=Math.min(height-1,Math.max(a[1],b[1]));
  stroke=clamp(Math.round(stroke)||1,1,128);const rx=(right-left+1)/2,ry=(bottom-top+1)/2,cx=(left+right)/2,cy=(top+bottom)/2,ix=rx-stroke,iy=ry-stroke;
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
   if(kind==='ellipse'){
    const inside=((x-cx)/rx)**2+((y-cy)/ry)**2<=1,inner=ix>0&&iy>0&&((x-cx)/ix)**2+((y-cy)/iy)**2<1;
    if(inside&&(filled||!inner))yield [x,y];
   }else if(filled||x-left<stroke||right-x<stroke||y-top<stroke||bottom-y<stroke)yield [x,y];
  }
 }
 function mount(api={}){
  const host=api.host;if(!host?.ownerDocument||typeof api.getSource!=='function')throw Error('Artwork editing needs a host and original image sources.');
  const doc=host.ownerDocument,win=doc.defaultView;let target=api.initialId||'',tool='pencil',rgba='#ff5f97ff',zoom=4,showGrid=true,spaceHeld=false,spacePanned=false,gesture=null,cursor=null,width=0,height=0,panX=0,panY=0,original=null,composite=null,imageData=null,mask=null,values=null,sourceImage=null,sourceStamp=null,loading=false,destroyed=false,loadToken=0,drawFrame=0,expanded=false,placeholder=null,returnFocus=null,nativeFullscreen=false,expansionVersion=0,selection=null,pastePreview=null,firstExpandFitPending=false,firstExpandFitted=false;
  let assetsVisible=false,smoothRadius=8,smoothStrength=35,protection=null,protectionCount=0,protectionVisible=true,protectionCanvas=null,protectionImage=null,protectionUndo=[],selectionShape='rectangle',draftSelection=[],draftSelectionBefore=null;
  let selectionCache=null,controlsVisible=true,controlsChosen=false;
  let brushSize=1,brushShape='square',shapeFilled=false;
  let pickerReturnTool='pencil',sampledKey=null,stamp=null,stampPosition=null,stampWidthChoice=null,stampHeightChoice=null;
  const el=(tag,className,text)=>{const node=doc.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
  const button=(text,action,key)=>{const node=el('button','',text);node.type='button';node.onclick=action;if(key)node.dataset[key]='';return node;};
  const field=(text,node)=>{const label=el('label','artwork-field');label.append(doc.createTextNode(text),node);return label;};
  const select=(label,items,key)=>{const node=el('select');node.setAttribute('aria-label',label);if(key)node.dataset[key]='';for(const [value,text]of items){const option=el('option','',text);option.value=String(value);node.append(option);}return node;};
  host.classList.add('artwork-editor');host.dataset.artworkEditor='';host.replaceChildren();
  const heading=el('div','artwork-heading'),title=el('h3','dev-heading','Pixel artwork'),expand=button('⛶ Full screen',()=>setExpanded(!expanded),'artworkExpand');expand.setAttribute('aria-expanded','false');const exit=button('Exit pixel editor',exitEditor,'artworkExit'),controlsToggle=button('Hide controls',()=>setControlsVisible(!controlsVisible),'artworkControlsToggle');controlsToggle.hidden=true;heading.append(title,controlsToggle,expand,exit);host.append(heading);
  host.append(el('p','artwork-help','Select a rectangle or manual shape to edit only its inside; everything outside is automatically masked. Fill selection colours the whole selected area. Drag inside a finished selection to cut and move its pixels; Escape cancels. Shift-drag starts a new selection inside the current one. Clear selection to edit the whole image again. Choose an asset and brush Feather edges across its coloured/transparent boundary to blend it into the background. Radius and strength control the fade. Use Smooth gradients (U) to soften colour transitions. Paint a protection mask to keep details sharp, or choose Protect selection, then Clear selection to smooth around that protected shape. Manual shapes finish with Enter or Finish selection. Copy and Paste use Ctrl/Cmd+C and Ctrl/Cmd+V; Enter places a paste and Escape cancels it. Stamp (S) captures selected pixels with Ctrl/Command-click. Right-drag or hold Space to pan; use the wheel to zoom.'));
  const targetSelect=select('Artwork to edit',[],'artworkTarget');host.append(field('Background, asset or character',targetSelect));
  const tools=el('div','artwork-controls'),toolSelect=select('Artwork tool',[['pencil','Pencil'],['smooth',api.extendedTools?'Blend brush':'Smooth gradients'],['feather','Feather edges'],['protect','Mask protected areas'],['unprotect','Unmask areas'],['select','Select area'],['move','Move selection'],['stamp','Stamp selected pixels'],['line','Straight line'],...(api.extendedTools?[['rectangle','Rectangle shape'],['ellipse','Ellipse shape']]:[]),['erase','Eraser'],['restore','Restore original'],['picker','Eyedropper'],['fill','Fill connected colour'],['pan','Pan']],'artworkTool');
  const colorInput=el('input');colorInput.type='color';colorInput.value=rgba.slice(0,7);colorInput.setAttribute('aria-label','Artwork colour');colorInput.dataset.artworkColor='';
  const hexInput=el('input');hexInput.type='text';hexInput.value=rgba;hexInput.maxLength=9;hexInput.spellcheck=false;hexInput.setAttribute('aria-label','Artwork exact hex colour');hexInput.dataset.artworkHex='';
  const colorGroup=el('div','artwork-colour');colorGroup.append(colorInput,hexInput);tools.append(field('Tool',toolSelect),field('Colour · #RRGGBBAA',colorGroup));host.append(tools);
  const paintTools=el('div','artwork-controls');paintTools.dataset.artworkPaintControls='';
  const brushSizeInput=el('input');brushSizeInput.type='number';brushSizeInput.min='1';brushSizeInput.max='128';brushSizeInput.step='1';brushSizeInput.value='1';brushSizeInput.setAttribute('aria-label','Brush size in pixels');brushSizeInput.dataset.artworkBrushSize='';
  const brushShapeSelect=select('Pencil brush shape',[['square','Square'],['round','Round']],'artworkBrushShape'),shapeFillSelect=select('Shape fill',[['outline','Outline'],['solid','Solid fill']],'artworkShapeFill');
  paintTools.append(field('Brush size · pixels',brushSizeInput),field('Brush shape',brushShapeSelect),field('Draw shapes',shapeFillSelect));paintTools.hidden=!api.extendedTools;host.append(paintTools);
  const selectionTools=el('div','artwork-selection-tools');
  const selectButton=button('Select',()=>selectTool('select'),'artworkSelect'),copyButton=button('Copy',copySelection,'artworkCopy'),pasteButton=button('Paste',beginPaste,'artworkPaste'),pickerButton=button('Eyedropper',()=>selectTool('picker'),'artworkPicker');
  selectButton.title='Select an area with the chosen selection shape (M)';copyButton.title='Copy selected pixels (Ctrl/Cmd+C)';pasteButton.title='Preview copied pixels (Ctrl/Cmd+V)';pickerButton.title='Sample exact RGBA colour (I), or hold Alt and click';
  const stampButton=button('Stamp',()=>selectTool('stamp'),'artworkStamp'),clearSelectionButton=button('Clear selection',clearSelection,'artworkClearSelection');stampButton.title='Select pixels, then Ctrl/Command-click to capture them. Click to stamp copies (S).';clearSelectionButton.title='Remove the selection and outside mask. Painted protection and artwork pixels are kept.';const fillSelectionButton=button('Fill selection',fillSelection,'artworkFillSelection'),moveSelectionButton=button('Move selection',()=>selectTool('move'),'artworkMoveSelection');fillSelectionButton.title='Fill every selected pixel with the current RGBA colour';moveSelectionButton.title='Drag the selected pixels to a new position; the source becomes transparent. Escape cancels.';selectionTools.append(selectButton,fillSelectionButton,moveSelectionButton,copyButton,pasteButton,stampButton,pickerButton,clearSelectionButton);host.append(selectionTools);
  const stampTools=el('div','artwork-controls');stampTools.dataset.artworkStampControls='';const stampWidthInput=el('input'),stampHeightInput=el('input');for(const [input,name]of [[stampWidthInput,'width'],[stampHeightInput,'height']]){input.type='number';input.min='1';input.step='1';input.max='8192';input.placeholder='Selected '+name;input.dataset[name==='width'?'artworkStampWidth':'artworkStampHeight']='';input.setAttribute('aria-label','Stamp '+name+' in pixels');}const captureStampButton=button('Capture selection',()=>captureStamp(cursor),'artworkCaptureStamp');stampTools.append(field('Stamp width',stampWidthInput),field('Stamp height',stampHeightInput),captureStampButton);host.append(stampTools);
  const smoothTools=el('div','artwork-controls');smoothTools.classList.add('artwork-brush-controls');smoothTools.dataset.artworkSmoothControls='';smoothTools.dataset.artworkBrushControls='';const smoothRadiusInput=el('input'),smoothStrengthInput=el('input');
  for(const [input,label,max,value,key]of [[smoothRadiusInput,'Smoothing brush radius',64,smoothRadius,'artworkSmoothRadius'],[smoothStrengthInput,'Smoothing strength',100,smoothStrength,'artworkSmoothStrength']]){input.type='number';input.min='1';input.max=String(max);input.step='1';input.value=String(value);input.setAttribute('aria-label',label);input.dataset[key]='';}
  const strengthField=field('Strength %',smoothStrengthInput);smoothTools.append(field('Brush radius · source pixels',smoothRadiusInput),strengthField);host.append(smoothTools);
  const maskTools=el('div','artwork-selection-tools');maskTools.classList.add('artwork-protection-tools');maskTools.dataset.artworkProtectionTools='';const showProtection=el('input');showProtection.type='checkbox';showProtection.checked=protectionVisible;showProtection.setAttribute('aria-label','Show protection mask');showProtection.dataset.artworkProtectionVisible='';
  const showProtectionLabel=field('Show protection mask',showProtection);showProtectionLabel.classList.add('artwork-check');const clearProtectionButton=button('Clear protection mask',clearProtection,'artworkProtectionClear'),undoProtectionButton=button('Undo mask',undoProtection,'artworkProtectionUndo'),protectSelectionButton=button('Protect selection',protectSelection,'artworkProtectSelection');maskTools.append(showProtectionLabel,protectSelectionButton,undoProtectionButton,clearProtectionButton);host.append(maskTools);
  const shapeTools=el('div','artwork-controls'),shapeSelect=select('Selection shape',[['rectangle','Rectangle'],['manual','Manual polygon'],...(api.extendedTools?[['freehand','Freehand lasso']]:[])],'artworkSelectionShape'),finishSelectionButton=button('Finish selection',finishSelection,'artworkFinishSelection');shapeTools.classList.add('artwork-selection-shape-controls');shapeTools.dataset.artworkSelectionShapeControls='';shapeSelect.value=selectionShape;shapeTools.append(field('Selection shape',shapeSelect),finishSelectionButton);selectionTools.after(shapeTools);

  const viewTools=el('div','artwork-view-tools'),zoomSelect=select('Artwork zoom',[.25,.5,1,2,4,8,12,16,24,32,48,64].map(value=>[value,value+'×']),'artworkZoom');zoomSelect.value=String(zoom);
  const grid=el('input');grid.type='checkbox';grid.checked=true;grid.setAttribute('aria-label','Show artwork pixel grid');grid.dataset.artworkGrid='';const gridLabel=field('Pixel grid',grid);gridLabel.classList.add('artwork-check');
  const assetToggle=el('input');assetToggle.type='checkbox';assetToggle.setAttribute('aria-label','Show assets while editing background');assetToggle.dataset.artworkAssets='';const assetLabel=field('Show assets',assetToggle);assetLabel.classList.add('artwork-assets-toggle');assetLabel.hidden=true;
  const fit=button('Fit image',fitView,'artworkFit');viewTools.append(field('Zoom',zoomSelect),fit,gridLabel,assetLabel);host.append(viewTools);
  const stage=el('div','artwork-stage'),canvas=el('canvas','artwork-canvas');canvas.dataset.artworkCanvas='';canvas.tabIndex=0;canvas.setAttribute('aria-label','Pixel artwork canvas. Select an area, use Fill selection to colour it, or drag inside to cut and move it. Copy or paste with Ctrl or Command. Arrow keys move the pixel cursor or paste; Enter places pixels. Escape cancels a paste. Hold Space and drag to pan.');stage.append(canvas);host.append(stage);
  const status=el('p','artwork-status','Choose artwork to begin.');status.dataset.artworkStatus='';status.setAttribute('role','status');host.append(status);
  const actions=el('div','artwork-actions');
  const undoButton=typeof api.onUndo==='function'?button('↶ Undo',()=>history('undo'),'artworkUndo'):null,redoButton=typeof api.onRedo==='function'?button('↷ Redo',()=>history('redo'),'artworkRedo'):null;
  if(undoButton)actions.append(undoButton);if(redoButton)actions.append(redoButton);
  actions.append(button('Export PNG',exportPNG,'artworkExport'),button('Reset artwork',reset,'artworkReset'));host.append(actions);
  const palette=el('div','artwork-palette');palette.setAttribute('aria-label','Artwork colour palette');for(const value of ['#000000ff','#ffffffff','#808080ff','#ff5599ff','#53d9ffff','#ffe177ff','#7755aaff','#58a369ff']){const b=button('',()=>setColor(value));b.style.background=value.slice(0,7);b.setAttribute('aria-label','Use colour '+value.slice(0,7));palette.append(b);}host.append(palette);
  const sidebar=el('section','artwork-sidebar');sidebar.id='coda-artwork-controls-'+(++editorSequence);sidebar.dataset.artworkSidebar='';sidebar.setAttribute('aria-label','Pixel editor controls');controlsToggle.setAttribute('aria-controls',sidebar.id);
  const help=host.querySelector('.artwork-help'),helpDetails=el('details','artwork-help-details');helpDetails.append(el('summary','','Help and shortcuts'),help);
  for(const node of Array.from(host.children))if(![heading,stage,status].includes(node))sidebar.append(node);
  sidebar.append(helpDetails);heading.after(sidebar);
  const drawerScrim=button('',()=>setControlsVisible(false),'artworkControlsScrim');drawerScrim.className='artwork-drawer-scrim';drawerScrim.setAttribute('aria-label','Close pixel editor controls');drawerScrim.tabIndex=-1;host.append(drawerScrim);
  function portraitControls(){return win.matchMedia?.('(max-width:699px) and (orientation:portrait)').matches===true;}
  function applyControlsVisibility(){
   if(expanded&&!controlsVisible&&(sidebar.contains(doc.activeElement)||doc.activeElement===drawerScrim))controlsToggle.focus({preventScroll:true});
   sidebar.hidden=expanded&&!controlsVisible;host.classList.toggle('controls-hidden',expanded&&!controlsVisible);controlsToggle.hidden=!expanded;controlsToggle.textContent=controlsVisible?'Hide controls':'Show controls';controlsToggle.setAttribute('aria-expanded',String(controlsVisible));
  }
  function setControlsVisible(value){
   if(destroyed)return false;finishGesture();controlsChosen=true;controlsVisible=!!value;
   if(!controlsVisible&&sidebar.contains(doc.activeElement))controlsToggle.focus({preventScroll:true});
   applyControlsVisibility();resize();return controlsVisible;
  }
  function editable(){return !destroyed&&!loading&&!!composite&&api.canEdit?.()!==false;}
  function hasAssetPreview(){return typeof api.drawAssetPreview==='function'&&api.hasAssetPreview?.(target)===true;}
  function syncAssetPreview(){assetLabel.hidden=!hasAssetPreview();assetToggle.checked=assetsVisible;assetToggle.disabled=!editable();}
  function currentData(){return normalize(api.getData?.()||{})||{};}
  function setStatus(text){status.textContent=text;syncSelectionActions();syncAssetPreview();}
  function selectionCore(){return win.CodaPixelSelection;}
  // Source-pixel scanlines keep editing, copied shapes and the visible mask exact.
  // Cache them when selection changes rather than testing every polygon per frame.
  function selectedArea(){
   if(!selection){selectionCache=null;return null;}
   if(selectionCache?.source===selection&&selectionCache.width===width&&selectionCache.height===height)return selectionCache;
   const area={source:selection,width,height,pixels:null,count:selection.width*selection.height,inside:new win.Path2D(),outside:new win.Path2D()};
   if(!selection.points)area.inside.rect(selection.x,selection.y,selection.width,selection.height);
   else{
    area.pixels=new Uint8Array(selection.width*selection.height);area.count=0;
    const left=selection.x,right=left+selection.width,points=selection.points;
    for(let y=selection.y;y<selection.y+selection.height;y++){
     const intersections=[],ranges=[];
     const add=(start,end)=>{start=Math.max(left,start);end=Math.min(right-1,end);if(end>=start)ranges.push([start,end]);};
     for(let i=0,j=points.length-1;i<points.length;j=i++){
      const [ax,ay]=points[j],[bx,by]=points[i];
      if(y===ay)add(ax,ax);if(y===by)add(bx,bx);
      if(ay===by){if(y===ay)add(Math.min(ax,bx),Math.max(ax,bx));continue;}
      if((ay>y)!==(by>y))intersections.push((bx-ax)*(y-ay)/(by-ay)+ax);
     }
     intersections.sort((a,b)=>a-b);
     for(let i=0;i+1<intersections.length;i+=2)add(Math.ceil(intersections[i]-1e-9),Math.floor(intersections[i+1]+1e-9));
     ranges.sort((a,b)=>a[0]-b[0]);const merged=[];
     for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1]+1)last[1]=Math.max(last[1],range[1]);else merged.push(range);}
     for(const [start,end]of merged){const offset=(y-selection.y)*selection.width+start-left,length=end-start+1;area.pixels.fill(1,offset,offset+length);area.count+=length;area.inside.rect(start,y,length,1);}
    }
   }
   area.outside.rect(0,0,width,height);area.outside.addPath(area.inside);selectionCache=area;return area;
  }
  function selectionAllows(x,y){
   if(!selection)return true;
   if(x<selection.x||y<selection.y||x>=selection.x+selection.width||y>=selection.y+selection.height)return false;
   const area=selectedArea();return !area.pixels||area.pixels[(y-selection.y)*selection.width+x-selection.x]===1;
  }
  function clipSelection(context){
   const area=selectedArea();if(!area)return;const transform=context.getTransform();context.translate(panX,panY);context.scale(zoom,zoom);context.clip(area.inside);context.setTransform(transform);
  }
  function drawSelectionMask(context){
   const area=selectedArea();if(!area)return;context.save();context.translate(panX,panY);context.scale(zoom,zoom);context.fillStyle='#1a102c9c';context.fill(area.outside,'evenodd');context.restore();
  }

  function syncSelectionActions(){const ready=editable(),core=selectionCore();selectButton.disabled=!ready||!core;copyButton.disabled=!ready||!selection||!core;fillSelectionButton.disabled=moveSelectionButton.disabled=!ready||!selection||!core;moveSelectionButton.setAttribute('aria-pressed',String(tool==='move'));pasteButton.disabled=!ready||!core?.clipboard.has();pickerButton.disabled=!ready;clearSelectionButton.disabled=!selection&&!draftSelection.length;selectButton.setAttribute('aria-pressed',String(tool==='select'));pickerButton.setAttribute('aria-pressed',String(tool==='picker'));syncStampControls();syncBrushControls();}
  function syncBrushControls(){const ready=editable();paintTools.hidden=!api.extendedTools||!['pencil','erase','restore','line','rectangle','ellipse'].includes(tool);brushSizeInput.disabled=!ready;brushShapeSelect.disabled=!ready;shapeFillSelect.disabled=!ready;smoothTools.hidden=!['smooth','feather','protect','unprotect'].includes(tool);strengthField.hidden=!['smooth','feather'].includes(tool);smoothRadiusInput.setAttribute('aria-label',tool==='feather'?'Feathering brush radius':'Smoothing brush radius');smoothStrengthInput.setAttribute('aria-label',tool==='feather'?'Feathering strength':'Smoothing strength');smoothRadiusInput.disabled=!ready;smoothStrengthInput.disabled=!ready;showProtection.disabled=!ready;clearProtectionButton.disabled=!ready||!protectionCount;undoProtectionButton.disabled=!ready||!protectionUndo.length;protectSelectionButton.disabled=!ready||!selection;shapeSelect.disabled=!ready;finishSelectionButton.hidden=selectionShape!=='manual';finishSelectionButton.disabled=!ready||draftSelection.length<3;showProtection.checked=protectionVisible;}
  function resetProtection(){protection=new Uint8Array(width*height);protectionCount=0;protectionUndo=[];protectionCanvas=doc.createElement('canvas');protectionCanvas.width=width;protectionCanvas.height=height;protectionImage=protectionCanvas.getContext('2d').createImageData(width,height);}
  function protectionPixel(index){const at=index*4;protectionImage.data[at]=235;protectionImage.data[at+1]=73;protectionImage.data[at+2]=180;protectionImage.data[at+3]=protection[index]?100:0;}
  function rebuildProtection(){if(!protectionCanvas)return;for(let index=0;index<protection.length;index++)protectionPixel(index);protectionCanvas.getContext('2d').putImageData(protectionImage,0,0);requestDraw();}
  function uploadProtection(bounds){if(bounds)protectionCanvas.getContext('2d').putImageData(protectionImage,0,0,bounds.x,bounds.y,bounds.right-bounds.x+1,bounds.bottom-bounds.y+1);requestDraw();}
  function rememberProtection(previous){protectionUndo.push(previous);if(protectionUndo.length>8)protectionUndo.shift();}
  function clearProtection(){if(!editable()||!protectionCount)return false;finishGesture();rememberProtection(protection.slice());protection.fill(0);protectionCount=0;rebuildProtection();setStatus('Protection mask cleared. Artwork pixels are unchanged.');return true;}
  function undoProtection(){if(!editable()||!protectionUndo.length)return false;finishGesture();protection=protectionUndo.pop();protectionCount=protection.reduce((sum,value)=>sum+Number(value!==0),0);rebuildProtection();setStatus('Protection mask restored. Artwork pixels are unchanged.');return true;}
  function protectSelection(){if(!editable()||!selection)return false;finishGesture();const previous=protection.slice();let changed=false;for(let y=selection.y;y<selection.y+selection.height;y++)for(let x=selection.x;x<selection.x+selection.width;x++){if(!selectionContains(selection,x,y))continue;const index=y*width+x;if(!protection[index]){protection[index]=1;protectionCount++;changed=true;}}if(changed){rememberProtection(previous);rebuildProtection();}setStatus(protectionCount+' protected pixels. Clear the selection to blend around this shape.');return changed;}
  function paintProtectionSegment(a,b,value){const left=Math.max(0,Math.floor(Math.min(a.x,b.x)-smoothRadius)),right=Math.min(width-1,Math.ceil(Math.max(a.x,b.x)+smoothRadius)),top=Math.max(0,Math.floor(Math.min(a.y,b.y)-smoothRadius)),bottom=Math.min(height-1,Math.ceil(Math.max(a.y,b.y)+smoothRadius)),dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;let bounds=null;
   for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){if(!selectionContains(selection,x,y))continue;const t=length?clamp(((x-a.x)*dx+(y-a.y)*dy)/length,0,1):0;if(Math.hypot(x-a.x-t*dx,y-a.y-t*dy)>smoothRadius)continue;const index=y*width+x,next=value?1:0;if(protection[index]===next)continue;protectionCount+=next?1:-1;protection[index]=next;protectionPixel(index);if(!bounds)bounds={x,y,right:x,bottom:y};else{bounds.x=Math.min(bounds.x,x);bounds.y=Math.min(bounds.y,y);bounds.right=Math.max(bounds.right,x);bounds.bottom=Math.max(bounds.bottom,y);}}
   uploadProtection(bounds);
  }
  function clearSelection(){if(!selection&&!draftSelection.length)return false;if(gesture?.moving)cancelGesture();else if(gesture?.select)gesture=null;else finishGesture();cancelPaste(false);selection=null;draftSelection=[];draftSelectionBefore=null;requestDraw();setStatus('Selection and outside mask cleared. Painted protection and artwork pixels are kept.');return true;}
  function finishSelection(){if(!editable()||draftSelection.length<3)return false;const next=selectionCore()?.polygonSelection?.(draftSelection,width,height);if(!next){setStatus('Choose at least three corners enclosing an area.');return false;}selection=next;draftSelection=[];draftSelectionBefore=null;requestDraw();setStatus('Manual shape selected · '+selection.width+' × '+selection.height+' pixels. Outside the shape is masked; edit inside or Clear selection.');return true;}
  function syncHistory(){const state=api.getHistory?.();if(undoButton)undoButton.disabled=api.canEdit?.()===false||!!state&&!state.undo;if(redoButton)redoButton.disabled=api.canEdit?.()===false||!!state&&!state.redo;syncSelectionActions();syncAssetPreview();}
  function history(which){if(api.canEdit?.()===false)return;cancelPaste(false);if(gesture?.moving)cancelGesture();else finishGesture();const callback=which==='undo'?api.onUndo:api.onRedo;try{callback?.();refresh();}catch(error){setStatus(error.message||'History could not be changed.');}}

  function setColor(value){if(/^#[0-9a-f]{6}$/i.test(value))value+='ff';if(!color(value))return false;rgba=value.toLowerCase();hexInput.value=rgba;colorInput.value=rgba.slice(0,7);hexInput.removeAttribute('aria-invalid');return true;}
  function targets(){return (api.getTargets?.()||[]).filter(item=>item&&safeId(item.id));}
  function syncTargets(){const list=targets();targetSelect.replaceChildren();for(const item of list){const option=el('option','',item.name||item.label||item.id);option.value=item.id;targetSelect.append(option);}if(!list.some(item=>item.id===target))target=list[0]?.id||'';targetSelect.value=target;return list;}
  function resize(){
   if(destroyed)return;
   if(expanded&&!controlsChosen){const visible=!portraitControls();if(controlsVisible!==visible){controlsVisible=visible;applyControlsVisibility();}}
   const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
   if(canvas.width!==w||canvas.height!==h){const oldWidth=canvas.width,oldHeight=canvas.height;canvas.width=w;canvas.height=h;if(composite&&oldWidth>1&&oldHeight>1){panX+=(w-oldWidth)/2;panY+=(h-oldHeight)/2;}requestDraw();}
   fitInitialExpansion();
  }
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
     g.save();clipSelection(g);g.beginPath();
     if(p.clip.mask){for(let yy=cy;yy<bottom;yy++){let start=-1;for(let xx=cx;xx<=right;xx++){const active=xx<right&&p.clip.mask[yy*p.clip.width+xx];if(active&&start<0)start=xx;if(!active&&start>=0){g.rect(panX+(p.x+start)*zoom,panY+(p.y+yy)*zoom,(xx-start)*zoom,zoom);start=-1;}}}}else g.rect(left,top,w,h);g.clip();
     for(let yy=Math.max(0,Math.floor(top/checker)*checker);yy<Math.min(canvas.height,top+h);yy+=checker)for(let xx=Math.max(0,Math.floor(left/checker)*checker);xx<Math.min(canvas.width,left+w);xx+=checker){g.fillStyle=((xx/checker+yy/checker)&1)?'#253047':'#35415b';g.fillRect(xx,yy,checker,checker);}
     g.globalAlpha=.82;g.drawImage(p.surface,cx,cy,right-cx,bottom-cy,left,top,w,h);g.restore();
    }
   }
   if(assetsVisible&&hasAssetPreview()){
    g.save();try{g.beginPath();g.rect(panX,panY,width*zoom,height*zoom);g.clip();g.translate(panX,panY);g.scale(zoom,zoom);api.drawAssetPreview(g,{target,width,height});}finally{g.restore();}
   }
   if(protectionVisible&&protectionCount&&protectionCanvas&&ex>sx&&ey>sy)g.drawImage(protectionCanvas,sx,sy,ex-sx,ey-sy,panX+sx*zoom,panY+sy*zoom,(ex-sx)*zoom,(ey-sy)*zoom);
   drawSelectionMask(g);
   if(showGrid&&zoom>=8&&ex>sx&&ey>sy){g.strokeStyle='#d7eaff38';g.lineWidth=1;g.beginPath();for(let xx=sx;xx<=ex;xx++){const x=Math.round(panX+xx*zoom)+.5;g.moveTo(x,Math.max(0,panY));g.lineTo(x,Math.min(canvas.height,panY+height*zoom));}for(let yy=sy;yy<=ey;yy++){const y=Math.round(panY+yy*zoom)+.5;g.moveTo(Math.max(0,panX),y);g.lineTo(Math.min(canvas.width,panX+width*zoom),y);}g.stroke();}
   const outline=(rect,colour)=>{if(!rect)return;g.save();g.lineWidth=1;g.setLineDash([5,3]);if(rect.points){g.beginPath();rect.points.forEach((point,index)=>g[index?'lineTo':'moveTo'](panX+(point[0]+.5)*zoom,panY+(point[1]+.5)*zoom));g.closePath();g.strokeStyle='#101827';g.lineWidth=3;g.stroke();g.strokeStyle=colour;g.lineWidth=1;g.stroke();}else{g.strokeStyle='#101827';g.strokeRect(Math.round(panX+rect.x*zoom)-.5,Math.round(panY+rect.y*zoom)-.5,Math.max(1,rect.width*zoom+1),Math.max(1,rect.height*zoom+1));g.strokeStyle=colour;g.strokeRect(Math.round(panX+rect.x*zoom)+.5,Math.round(panY+rect.y*zoom)+.5,Math.max(1,rect.width*zoom-1),Math.max(1,rect.height*zoom-1));}g.restore();};
   outline(selection,'#b8fff2');if(placement)outline({x:placement.x,y:placement.y,width:placement.clip.width,height:placement.clip.height},'#ffe48f');
   if(draftSelection.length){g.save();g.beginPath();draftSelection.forEach((point,index)=>g[index?'lineTo':'moveTo'](panX+(point[0]+.5)*zoom,panY+(point[1]+.5)*zoom));if(cursor)g.lineTo(panX+(cursor.x+.5)*zoom,panY+(cursor.y+.5)*zoom);g.setLineDash([5,3]);g.strokeStyle='#b8fff2';g.lineWidth=2;g.stroke();for(const point of draftSelection){g.fillStyle='#b8fff2';g.fillRect(panX+(point[0]+.5)*zoom-3,panY+(point[1]+.5)*zoom-3,6,6);}g.restore();}
   if(cursor){if(['smooth','feather','protect','unprotect'].includes(tool)){g.save();g.beginPath();g.arc(panX+(cursor.x+.5)*zoom,panY+(cursor.y+.5)*zoom,smoothRadius*zoom,0,Math.PI*2);g.strokeStyle='#111827';g.lineWidth=3;g.stroke();g.strokeStyle=['smooth','feather'].includes(tool)?'#ffffff':'#ffb5e9';g.lineWidth=1;g.stroke();g.restore();}else{g.strokeStyle='#ffffff';g.lineWidth=1;g.strokeRect(Math.round(panX+cursor.x*zoom)+.5,Math.round(panY+cursor.y*zoom)+.5,Math.max(1,zoom-1),Math.max(1,zoom-1));g.strokeStyle='#111827';g.strokeRect(Math.round(panX+cursor.x*zoom)-.5,Math.round(panY+cursor.y*zoom)-.5,Math.max(2,zoom+1),Math.max(2,zoom+1));}}
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
    if(changed){original=doc.createElement('canvas');original.width=width;original.height=height;original.getContext('2d',{willReadFrequently:true}).drawImage(source,0,0);composite=doc.createElement('canvas');composite.width=width;composite.height=height;cursor=null;selection=null;if(viewChanged){resetProtection();draftSelection=[];clearStamp(false);stampWidthChoice=null;stampHeightChoice=null;stampWidthInput.value=stampHeightInput.value='';}}
    loadBuffers();if(!protection)resetProtection();loading=false;resize();if(viewChanged)fitView();else requestDraw();setStatus(width+' × '+height+' pixels · Edits save with the project.');
   }catch(error){if(token!==loadToken||destroyed)return;loading=false;composite=null;setStatus(error.message||'This artwork could not be loaded.');requestDraw();}
  }
  function local(event){const box=canvas.getBoundingClientRect();return {x:(event.clientX-box.left)*canvas.width/Math.max(1,box.width),y:(event.clientY-box.top)*canvas.height/Math.max(1,box.height)};}
  function locate(event,limit=false){const point=local(event),x=Math.floor((point.x-panX)/zoom),y=Math.floor((point.y-panY)/zoom);if(!limit&&(x<0||y<0||x>=width||y>=height))return null;return {x:clamp(x,0,width-1),y:clamp(y,0,height-1)};}
  function renderPixel(at){const offset=at*4;if(mask[at]){const value=values[at];imageData.data[offset]=value&255;imageData.data[offset+1]=value>>>8&255;imageData.data[offset+2]=value>>>16&255;imageData.data[offset+3]=value>>>24&255;}else{const data=gesture?.originalRGBA||original.getContext('2d').getImageData(0,0,width,height).data;for(let c=0;c<4;c++)imageData.data[offset+c]=data[offset+c];}}
  function upload(bounds){if(!bounds)return;const ctx=composite.getContext('2d');ctx.putImageData(imageData,0,0,bounds.x,bounds.y,bounds.right-bounds.x+1,bounds.bottom-bounds.y+1);requestDraw();}
  function applyPoints(points,value){let box=null;const indices=[];for(const [x,y]of points){if(!selectionAllows(x,y))continue;const at=y*width+x;indices.push(at);mask[at]=value===undefined?0:1;values[at]=value===undefined?0:pack(value);renderPixel(at);if(!box)box={x,y,right:x,bottom:y};else{box.x=Math.min(box.x,x);box.y=Math.min(box.y,y);box.right=Math.max(box.right,x);box.bottom=Math.max(box.bottom,y);}}upload(box);return indices;}
  function sample(point,temporary=false){const at=(point.y*width+point.x)*4;setColor('#'+Array.from(imageData.data.slice(at,at+4),v=>v.toString(16).padStart(2,'0')).join(''));if(tool==='picker'&&!temporary)selectTool(pickerReturnTool);setStatus('Copied '+rgba+' from pixel '+point.x+', '+point.y+'. '+(tool==='picker'?'Eyedropper ready.':toolSelect.selectedOptions[0].textContent+' ready.'));}
  function selectTool(value){
   if(!['pencil','smooth','feather','protect','unprotect','select','move','stamp','line','rectangle','ellipse','erase','restore','picker','fill','pan'].includes(value))return false;
   finishGesture();cancelPaste(false);if(value!=='select'&&draftSelection.length){selection=draftSelectionBefore;draftSelection=[];draftSelectionBefore=null;}if(value==='picker'){if(tool!=='picker')pickerReturnTool=tool;}else pickerReturnTool=value;tool=value;toolSelect.value=value;canvas.classList.toggle('is-pan-tool',tool==='pan');canvas.classList.toggle('is-move-tool',tool==='move');
   setStatus(tool==='feather'?'Brush across an asset edge to fade colour into transparency. Radius and strength control the blend.':tool==='smooth'?'Drag to soften colour transitions. Protected areas and transparent edges stay intact.':tool==='protect'?'Paint a protection mask to keep areas unchanged by smoothing or feathering.':tool==='unprotect'?'Brush away protection where smoothing or feathering should apply.':tool==='stamp'?'Ctrl/Command-click to capture the selected pixels, then click to stamp.':tool==='move'?'Drag the selected pixels to move them. The source becomes transparent; Escape cancels.':tool==='select'?selectionShape==='manual'?'Click around a shape, then choose Finish selection or press Enter.':'Drag to select pixels; drag inside a selection to move them. Fill selection colours the entire area.':tool==='line'?'Drag from the first pixel to the last, then release.':tool==='picker'?'Click an artwork pixel to sample its exact RGBA colour.':'Tool: '+tool+'.');requestDraw();return true;
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
   const p=point||stampPosition||cursor;if(!p)return false;const points=(selectionCore()?.stampPixels(stamp.clip,width,height,p.x,p.y)||[]).filter(([x,y])=>selectionAllows(x,y));if(!points.length){setStatus(selection?'The stamp is outside the selected area. Clear selection to place it elsewhere.':'Move the stamp onto the image before placing it.');return false;}
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
   const data=paste.clip.pixels;let bounds=null;
   for(let y=y0;y<bottom;y++)for(let x=x0;x<right;x++){
    const clipIndex=(y-paste.y)*paste.clip.width+x-paste.x;if(!selectionAllows(x,y)||paste.clip.mask&&!paste.clip.mask[clipIndex])continue;const at=y*width+x,from=clipIndex*4,offset=at*4;
    if(!bounds){bounds={x,y,right:x,bottom:y};gesture={id:-1,tool:'paste'};}else{bounds.x=Math.min(bounds.x,x);bounds.y=Math.min(bounds.y,y);bounds.right=Math.max(bounds.right,x);bounds.bottom=Math.max(bounds.bottom,y);}
    mask[at]=1;values[at]=(data[from]|data[from+1]<<8|data[from+2]<<16|data[from+3]<<24)>>>0;
    for(let c=0;c<4;c++)imageData.data[offset+c]=data[from+c];
   }
   if(!bounds){setStatus(selection?'The paste is outside the selected area. Move it inside or Clear selection.':'The copied shape has no pixels over the artwork.');return false;}
   pastePreview=null;upload(bounds);finishGesture();return true;
  }
  function fillSelection(){
   if(!editable()||!selection||!selectionCore())return false;finishGesture();cancelPaste(false);
   gesture={id:-1,tool:'fill-selection'};const value=pack(rgba);
   for(let y=selection.y;y<selection.y+selection.height;y++)for(let x=selection.x;x<selection.x+selection.width;x++){
    if(!selectionAllows(x,y))continue;const at=y*width+x;mask[at]=1;values[at]=value;renderPixel(at);
   }
   upload({x:selection.x,y:selection.y,right:selection.x+selection.width-1,bottom:selection.y+selection.height-1});finishGesture();return true;
  }
  function beginMove(point,event){
   if(!selection||!selectionCore()){setStatus('Select an area before moving pixels.');return false;}
   const clip=selectionCore().copyPixels(imageData.data,width,height,selection);if(!clip)return false;
   begin(point,event);Object.assign(gesture,{moving:true,tool:'move',line:false,clip,selectionBefore:clone(selection),dx:0,dy:0,moveBounds:null});
   canvas.classList.add('is-moving-selection');setStatus('Drag to move selected pixels. Release to place; Escape cancels.');return true;
  }
  function moveSelectionTo(point){
   const moving=gesture;if(!moving?.moving)return;const before=moving.selectionBefore;
   const dx=clamp(point.x-moving.anchor.x,-before.x,width-before.x-before.width),dy=clamp(point.y-moving.anchor.y,-before.y,height-before.y-before.height);
   if(dx===moving.dx&&dy===moving.dy)return;
   // Restore the previous preview before cutting and pasting the frozen source.
   // This keeps overlapping moves lossless and bounds work to the affected area.
   const oldBounds=moving.moveBounds;
   if(oldBounds)for(const rect of [before,{...before,x:before.x+moving.dx,y:before.y+moving.dy}]){
    for(let y=rect.y;y<rect.y+rect.height;y++)for(let x=rect.x;x<rect.x+rect.width;x++){
     const at=y*width+x;mask[at]=moving.mask[at];values[at]=moving.values[at];renderPixel(at);
    }
   }
   moving.dx=dx;moving.dy=dy;selection={...before,x:before.x+dx,y:before.y+dy,...(before.points?{points:before.points.map(([x,y])=>[x+dx,y+dy])}:{})};
   moving.moveBounds=null;
   if(dx||dy){
    const clip=moving.clip;
    for(let y=0;y<clip.height;y++)for(let x=0;x<clip.width;x++){
     if(clip.mask&&!clip.mask[y*clip.width+x])continue;const at=(before.y+y)*width+before.x+x;mask[at]=1;values[at]=0;renderPixel(at);
    }
    for(let y=0;y<clip.height;y++)for(let x=0;x<clip.width;x++){
     const index=y*clip.width+x;if(clip.mask&&!clip.mask[index])continue;const from=index*4,at=(selection.y+y)*width+selection.x+x,data=clip.pixels;
     mask[at]=1;values[at]=(data[from]|data[from+1]<<8|data[from+2]<<16|data[from+3]<<24)>>>0;renderPixel(at);
    }
    moving.moveBounds={x:Math.min(before.x,selection.x),y:Math.min(before.y,selection.y),right:Math.max(before.x,selection.x)+before.width-1,bottom:Math.max(before.y,selection.y)+before.height-1};
   }
   const bounds=moving.moveBounds,dirty=oldBounds&&bounds?{x:Math.min(oldBounds.x,bounds.x),y:Math.min(oldBounds.y,bounds.y),right:Math.max(oldBounds.right,bounds.right),bottom:Math.max(oldBounds.bottom,bounds.bottom)}:oldBounds||bounds;
   upload(dirty);cursor={x:clamp(point.x,0,width-1),y:clamp(point.y,0,height-1)};setStatus('Move selection · '+dx+', '+dy+' pixels · Release to place; Escape cancels.');
  }
  function rawPoint(event){const point=local(event);return {x:Math.floor((point.x-panX)/zoom),y:Math.floor((point.y-panY)/zoom)};}
  function updateSelection(point){if(gesture.freehand){const points=gesture.points,last=points.at(-1);if(!last||last[0]!==point.x||last[1]!==point.y)points.push([point.x,point.y]);if(points.length>500)gesture.points=points.filter((_,index)=>index%2===0);draftSelection=gesture.points;cursor=point;requestDraw();return;}const core=selectionCore();selection=core?.rectangle([gesture.anchor.x,gesture.anchor.y],[point.x,point.y],width,height)||null;cursor=point;requestDraw();if(selection)setStatus('Selected '+selection.width+' × '+selection.height+' pixels · Outside is masked; edit inside or Clear selection.');}
  function begin(point,event){gesture={id:event.pointerId,anchor:point,last:point,line:!['smooth','feather','protect','unprotect'].includes(tool)&&(['line','rectangle','ellipse'].includes(tool)||event.shiftKey),mask:mask.slice(),values:values.slice(),originalRGBA:original.getContext('2d',{willReadFrequently:true}).getImageData(0,0,width,height).data,preview:[],tool,value:tool==='erase'?'#00000000':tool==='restore'?undefined:rgba};if(tool==='smooth'||tool==='feather')gesture.smoothing=(tool==='feather'?createFeatheringStroke:createSmoothingStroke)(imageData.data,width,height,{radius:smoothRadius,strength:smoothStrength/100,selection,protectedMask:protection});if(tool==='protect'||tool==='unprotect'){gesture.protectionBefore=protection.slice();gesture.protectionCountBefore=protectionCount;}}
  function strokeTo(point){if(!gesture||gesture.pan)return;cursor=point;if(gesture.tool==='smooth'||gesture.tool==='feather'){const result=gesture.smoothing?.applySegment([gesture.last.x,gesture.last.y],[point.x,point.y]);if(result){for(const [at,value]of result.changes){mask[at]=1;values[at]=value;renderPixel(at);}upload(result.bounds);}gesture.last=point;requestDraw();setStatus((gesture.tool==='feather'?'Feather edges':'Smooth gradients')+' · radius '+smoothRadius+' · strength '+smoothStrength+'%');return;}if(gesture.tool==='protect'||gesture.tool==='unprotect'){paintProtectionSegment(gesture.last,point,gesture.tool==='protect');gesture.last=point;setStatus(protectionCount+' protected pixels · smoothing and feathering skip these areas.');return;}if(gesture.line){const old=gesture.preview;for(const at of old){mask[at]=gesture.mask[at];values[at]=gesture.values[at];renderPixel(at);}if(old.length)composite.getContext('2d').putImageData(imageData,0,0);gesture.preview=applyPoints(['rectangle','ellipse'].includes(gesture.tool)?shapePixels([gesture.anchor.x,gesture.anchor.y],[point.x,point.y],gesture.tool,shapeFilled,brushSize,width,height):brushPixels(linePoints([gesture.anchor.x,gesture.anchor.y],[point.x,point.y]),brushSize,brushShape,width,height),gesture.value);}else applyPoints(brushPixels(linePoints([gesture.last.x,gesture.last.y],[point.x,point.y]),brushSize,brushShape,width,height),gesture.value);gesture.last=point;setStatus('Pixel '+point.x+', '+point.y+' · '+(gesture.line?'Line preview · release to apply':gesture.tool==='restore'?'original':gesture.value));}
  function fill(point){
   const at=(point.y*width+point.x)*4,source=Array.from(imageData.data.slice(at,at+4)),seen=new Uint8Array(width*height),pending=new Uint32Array(width*height);let head=0,tail=1;pending[0]=point.y*width+point.x;seen[pending[0]]=1;const value=pack(rgba);let minX=width,minY=height,maxX=0,maxY=0;
   while(head<tail){const index=pending[head++],offset=index*4;const x=index%width,y=Math.floor(index/width);if(!selectionAllows(x,y)||!source.every((channel,c)=>imageData.data[offset+c]===channel))continue;mask[index]=1;values[index]=value;renderPixel(index);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
    for(const next of [x?index-1:-1,x<width-1?index+1:-1,y?index-width:-1,y<height-1?index+width:-1])if(next>=0&&!seen[next]){seen[next]=1;pending[tail++]=next;}
   }
   if(minX<width)upload({x:minX,y:minY,right:maxX,bottom:maxY});
  }
  function finishGesture(commitMove=false){
   if(gesture?.moving&&!commitMove){cancelGesture();return;}
   if(!gesture)return;const previous=gesture;gesture=null;canvas.classList.remove('is-moving-selection');if(previous.pan){canvas.classList.remove('is-panning');return;}if(previous.select){if(previous.freehand){selection=selectionCore()?.polygonSelection(previous.points,width,height)||previous.selectionBefore;draftSelection=[];draftSelectionBefore=null;}requestDraw();if(selection)setStatus('Selected '+selection.width+' × '+selection.height+' pixels · Outside is masked; edit inside or Clear selection.');return;}
   if(previous.protectionBefore){if(api.canEdit?.()===false){protection=previous.protectionBefore;protectionCount=previous.protectionCountBefore;rebuildProtection();setStatus('Editing is not available for this profile.');return;}if(protectionCount!==previous.protectionCountBefore||protection.some((value,index)=>value!==previous.protectionBefore[index]))rememberProtection(previous.protectionBefore);requestDraw();setStatus(protectionCount+' protected pixels · Undo mask is available.');return;}
   const next=currentData(),texture=fromDense(width,height,mask,values);if(Object.keys(texture.tiles).length)next[target]=texture;else delete next[target];
   if(JSON.stringify(next)===JSON.stringify(currentData())){requestDraw();return;}
   if(api.canEdit?.()===false){if(previous.moving)selection=previous.selectionBefore;loadBuffers();requestDraw();setStatus('Editing is not available for this profile.');return;}
   try{if(api.onChange?.(next)===false)throw Error('This edit could not be saved. Export or undo other edits to make room.');syncHistory();setStatus('Pixels applied · Undo is available in the console.');}catch(error){if(previous.moving)selection=previous.selectionBefore;loadBuffers();requestDraw();setStatus(error.message||'The pixels could not be saved.');}
  }
  function cancelGesture(){if(!gesture)return;const previous=gesture;gesture=null;canvas.classList.remove('is-moving-selection');if(previous.freehand){draftSelection=[];draftSelectionBefore=null;}if(previous.select||previous.moving)selection=previous.selectionBefore||null;if(previous.protectionBefore){protection=previous.protectionBefore;protectionCount=previous.protectionCountBefore;rebuildProtection();}spaceHeld=false;canvas.classList.remove('is-panning');if(composite)loadBuffers();requestDraw();setStatus('Stroke cancelled.');}
  function down(event){
   if(!editable()||gesture||![0,2].includes(event.button))return;const pan=event.button===2||tool==='pan'&&!event.altKey||spaceHeld;if(!pan&&!pastePreview&&!(tool==='stamp'&&stamp)&&!locate(event))return;event.preventDefault();event.stopPropagation();canvas.focus({preventScroll:true});canvas.setPointerCapture?.(event.pointerId);
   if(pan){if(spaceHeld)spacePanned=true;const point=local(event);gesture={id:event.pointerId,pan:true,x:point.x,y:point.y,panX,panY};canvas.classList.add('is-panning');return;}
   if(tool==='stamp'&&!event.altKey){const point=rawPoint(event);cursor=locate(event,true);stampPosition={...point};if(event.ctrlKey||event.metaKey)captureStamp(point);else commitStamp(point);requestDraw();return;}
   if(pastePreview){const point=rawPoint(event);pastePreview.x=point.x;pastePreview.y=point.y;commitPaste();return;}
   const point=locate(event);cursor=point;if(tool==='picker'||event.altKey){sample(point,event.altKey);requestDraw();return;}
   if(tool==='move'||tool==='select'&&!event.shiftKey&&selection&&!draftSelection.length&&selectionAllows(point.x,point.y)){beginMove(point,event);return;}
   if(tool==='select'){if(!selectionCore())return;if(selectionShape==='manual'){if(!draftSelection.length){draftSelectionBefore=selection;selection=null;}const last=draftSelection.at(-1);if(!last||last[0]!==point.x||last[1]!==point.y)draftSelection.push([point.x,point.y]);setStatus('Manual selection · '+draftSelection.length+' points. Finish selection or press Enter.');requestDraw();return;}gesture={id:event.pointerId,select:true,anchor:point,selectionBefore:selection,freehand:selectionShape==='freehand',points:[]};if(gesture.freehand){draftSelectionBefore=selection;selection=null;}updateSelection(point);return;}
   begin(point,event);if(tool==='fill'){fill(point);finishGesture();}else strokeTo(point);
  }
  function move(event){
   if(!composite)return;
   if(!gesture){const point=locate(event);cursor=point;if(pastePreview){const raw=rawPoint(event);pastePreview.x=raw.x;pastePreview.y=raw.y;}if(tool==='stamp'&&stamp)stampPosition=rawPoint(event);requestDraw();return;}
   if(gesture.id!==event.pointerId)return;event.preventDefault();event.stopPropagation();
   if(gesture.pan){const point=local(event);panX=gesture.panX+point.x-gesture.x;panY=gesture.panY+point.y-gesture.y;keepVisible();requestDraw();return;}
   if(api.canEdit?.()===false){cancelGesture();return;}if(gesture.moving)moveSelectionTo(rawPoint(event));else if(gesture.select)updateSelection(locate(event,true));else strokeTo(locate(event,true));
  }
  function up(event){if(gesture?.id!==event.pointerId)return;event.preventDefault();event.stopPropagation();if(gesture.moving)moveSelectionTo(rawPoint(event));else if(gesture.select)updateSelection(locate(event,true));else if(!gesture.pan)strokeTo(locate(event,true));finishGesture(true);}
  function stopKey(event){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();}
  function keydown(event){
   if(destroyed)return;const inside=event.target===canvas||host.contains(event.target);if(!inside)return;
   const typing=event.target?.closest?.('input,textarea,select,[contenteditable="true"]')||event.target?.isContentEditable;
   if(event.key==='Escape'&&draftSelection.length){stopKey(event);if(gesture?.freehand){cancelGesture();return;}draftSelection=[];selection=draftSelectionBefore;draftSelectionBefore=null;requestDraw();setStatus('Manual selection cancelled.');return;}
   if(event.key==='Enter'&&draftSelection.length&&!typing){stopKey(event);if(gesture?.freehand)finishGesture();else finishSelection();return;}
   if(event.key==='Escape'&&(pastePreview||gesture||selection||stamp)){stopKey(event);if(gesture?.moving){cancelGesture();return;}if(stamp){clearStamp();}else if(pastePreview){cancelPaste();selection=null;requestDraw();}else if(gesture)cancelGesture();else{selection=null;requestDraw();setStatus('Selection cleared.');}return;}
   if(expanded&&event.key==='Escape'){stopKey(event);exitEditor();return;}
   if(typing)return;
   if(gesture?.moving){stopKey(event);return;}
   if(event.repeat&&sampledKey===event.key){stopKey(event);return;}
   const command=event.ctrlKey||event.metaKey,key=event.key.toLowerCase();
   if(command&&key==='c'&&selection){stopKey(event);copySelection();return;}
   if(command&&key==='v'&&selectionCore()?.clipboard.has()){stopKey(event);beginPaste();return;}
   if(command&&key==='a'&&editable()&&selectionCore()){stopKey(event);finishGesture();cancelPaste(false);draftSelection=[];draftSelectionBefore=null;selection={x:0,y:0,width,height};setStatus('Selected all '+width+' × '+height+' pixels.');requestDraw();return;}
   if(api.extendedTools&&!command&&!event.altKey&&['[',']'].includes(key)){stopKey(event);finishGesture();brushSize=clamp(brushSize+(key===']'?1:-1),1,128);brushSizeInput.value=String(brushSize);setStatus('Brush size: '+brushSize+' source pixels.');return;}
   if(api.extendedTools&&!command&&!event.altKey&&['e','l','r','o','f'].includes(key)){stopKey(event);selectTool({e:'erase',l:'line',r:'rectangle',o:'ellipse',f:'fill'}[key]);return;}
   if(!command&&!event.altKey&&['i','m','b','s','u'].includes(key)){stopKey(event);selectTool(key==='i'?'picker':key==='m'?'select':key==='s'?'stamp':key==='u'?'smooth':'pencil');return;}
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
   if(event.key==='Enter'){stopKey(event);if(pastePreview){commitPaste();return;}if(!editable()||!cursor)return;if(tool==='stamp'){if(!event.repeat)commitStamp(stampPosition||cursor);return;}if(tool==='picker'){sample(cursor);sampledKey=event.key;}else if(!['pan','select','move'].includes(tool)){begin(cursor,{pointerId:-1,shiftKey:false});if(tool==='fill')fill(cursor);else strokeTo(cursor);finishGesture();}return;}
   if(['+','=','-','_'].includes(event.key)){stopKey(event);setZoom(clamp(zoom*(event.key==='-'||event.key==='_'?.5:2),.125,64));}
  }
  function keyup(event){if(sampledKey===event.key)sampledKey=null;if(event.code!=='Space'||!spaceHeld)return;stopKey(event);if(!spacePanned&&!gesture&&!pastePreview&&event.target===canvas&&editable()&&cursor&&!['pan','select','move'].includes(tool)){if(tool==='picker')sample(cursor);else if(tool==='stamp')commitStamp(stampPosition||cursor);else{begin(cursor,{pointerId:-1,shiftKey:false});if(tool==='fill')fill(cursor);else strokeTo(cursor);finishGesture();}}spaceHeld=false;spacePanned=false;}
  function wheel(event){if(!composite)return;event.preventDefault();event.stopPropagation();const levels=[.125,.25,.5,1,2,4,8,12,16,24,32,48,64],next=event.deltaY<0?levels.find(value=>value>zoom):[...levels].reverse().find(value=>value<zoom);if(next)setZoom(next,local(event));}
  function exportPNG(){if(!composite)return;finishGesture();const link=doc.createElement('a');link.download='coda-'+target.replace(/[^a-z0-9_-]/gi,'-')+'.png';link.href=composite.toDataURL('image/png');link.click();}
  function reset(){if(!editable())return;if(gesture?.moving)cancelGesture();cancelPaste(false);clearStamp(false);selection=null;finishGesture();const next=currentData();delete next[target];try{if(api.onChange?.(next)===false)throw Error('Reset could not be saved.');loadBuffers();requestDraw();setStatus('Original artwork restored · Undo is available.');}catch(error){setStatus(error.message);}}
  function restorePortal(){const focus=returnFocus;returnFocus=null;if(placeholder?.parentNode)placeholder.parentNode.insertBefore(host,placeholder);placeholder?.remove();placeholder=null;host.classList.remove('is-expanded');applyControlsVisibility();expand.textContent='⛶ Full screen';expand.title='Full screen';expand.setAttribute('aria-label','Full screen');expand.setAttribute('aria-expanded','false');requestDraw();win.requestAnimationFrame(()=>{resize();focus?.focus?.({preventScroll:true});});}
  function setExpanded(value){
   value=!!value;if(destroyed||value===expanded)return;if(!value){cancelPaste(false);if(gesture?.moving)cancelGesture();}finishGesture();expanded=value;firstExpandFitPending=value&&api.fitOnFirstExpand===true&&!firstExpandFitted;const version=++expansionVersion;
   if(value){returnFocus=doc.activeElement;placeholder=doc.createComment('Artwork editor position');host.before(placeholder);const fullscreenRoot=doc.fullscreenElement; (fullscreenRoot||doc.body).append(host);host.classList.add('is-expanded');if(!controlsChosen)controlsVisible=!portraitControls();applyControlsVisibility();expand.textContent='↙';expand.title='Return to console';expand.setAttribute('aria-label','Return to console');expand.setAttribute('aria-expanded','true');resize();canvas.focus({preventScroll:true});if(!fullscreenRoot&&typeof host.requestFullscreen==='function'){nativeFullscreen=true;Promise.resolve(host.requestFullscreen()).then(()=>{if(destroyed||!expanded||version!==expansionVersion){if(doc.fullscreenElement===host)Promise.resolve(doc.exitFullscreen()).catch(()=>{});}}).catch(()=>{if(version===expansionVersion)nativeFullscreen=false;resize();});}}
   else{nativeFullscreen=false;if(doc.fullscreenElement===host)Promise.resolve(doc.exitFullscreen()).catch(()=>{});restorePortal();}
   api.onExpandedChange?.(expanded);
  }
  function fullscreenChanged(){if(destroyed)return;if(nativeFullscreen&&doc.fullscreenElement!==host){nativeFullscreen=false;if(expanded){expanded=false;restorePortal();api.onExpandedChange?.(false);}}resize();}
  function exitEditor(){cancelPaste(false);if(gesture?.moving)cancelGesture();finishGesture();if(typeof api.onExit==='function')api.onExit();else setExpanded(false);}
  function hidden(){if(doc.hidden)cancelGesture();}
  function blur(){spaceHeld=false;sampledKey=null;cancelGesture();}
  function selectTarget(id){if(!targets().some(item=>item.id===id))return false;if(gesture?.moving)cancelGesture();cancelPaste(false);clearStamp(false);selection=null;draftSelection=[];draftSelectionBefore=null;finishGesture();target=id;targetSelect.value=id;refresh();return true;}
  brushSizeInput.onchange=()=>{finishGesture();brushSize=clamp(Math.round(Number(brushSizeInput.value))||1,1,128);brushSizeInput.value=String(brushSize);setStatus('Brush size: '+brushSize+' source pixels.');};brushShapeSelect.onchange=()=>{finishGesture();brushShape=brushShapeSelect.value==='round'?'round':'square';};shapeFillSelect.onchange=()=>{finishGesture();shapeFilled=shapeFillSelect.value==='solid';};
  smoothRadiusInput.onchange=()=>{finishGesture();const value=Number(smoothRadiusInput.value);smoothRadius=clamp(Number.isFinite(value)?Math.round(value):8,1,64);smoothRadiusInput.value=String(smoothRadius);requestDraw();};smoothStrengthInput.onchange=()=>{finishGesture();const value=Number(smoothStrengthInput.value);smoothStrength=clamp(Number.isFinite(value)?Math.round(value):35,1,100);smoothStrengthInput.value=String(smoothStrength);requestDraw();};showProtection.onchange=()=>{protectionVisible=showProtection.checked;requestDraw();};shapeSelect.onchange=()=>{finishGesture();if(draftSelection.length)selection=draftSelectionBefore;draftSelection=[];draftSelectionBefore=null;selectionShape=['manual','freehand'].includes(shapeSelect.value)?shapeSelect.value:'rectangle';syncBrushControls();requestDraw();};
  targetSelect.onchange=()=>selectTarget(targetSelect.value);toolSelect.onchange=()=>selectTool(toolSelect.value);colorInput.oninput=()=>setColor(colorInput.value+rgba.slice(7));hexInput.onchange=()=>{if(!setColor(hexInput.value)){hexInput.setAttribute('aria-invalid','true');setStatus('Enter #RRGGBB or #RRGGBBAA, for example #53d9ffff.');}};zoomSelect.onchange=()=>setZoom(Number(zoomSelect.value));grid.onchange=()=>{showGrid=grid.checked;requestDraw();};
  assetToggle.onchange=()=>{if(!editable()||!hasAssetPreview()){syncAssetPreview();return;}finishGesture();assetsVisible=assetToggle.checked;requestDraw();setStatus(assetsVisible?'Asset guide shown. Paint and sample the background underneath.':'Asset guide hidden.');};
  canvas.addEventListener('dblclick',event=>{if(tool==='select'&&selectionShape==='manual'&&draftSelection.length){event.preventDefault();event.stopPropagation();finishSelection();}});canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',event=>{if(gesture?.id===event.pointerId)cancelGesture();});canvas.addEventListener('lostpointercapture',event=>{if(gesture?.id===event.pointerId)cancelGesture();});canvas.addEventListener('contextmenu',event=>event.preventDefault());canvas.addEventListener('wheel',wheel,{passive:false});
  doc.addEventListener('keydown',keydown,true);doc.addEventListener('keyup',keyup,true);doc.addEventListener('visibilitychange',hidden);doc.addEventListener('fullscreenchange',fullscreenChanged);win.addEventListener('blur',blur);win.addEventListener('resize',resize);
  const observer=typeof win.ResizeObserver==='function'?new win.ResizeObserver(resize):null;observer?.observe(stage);resize();refresh();if(api.startExpanded===true)setExpanded(true);
  return {refresh,selectTarget,finishGesture,cancelGesture,setExpanded,setControlsVisible,selectTool,fillSelection,copySelection,beginPaste,commitPaste,cancelPaste,getState:()=>({target,tool,brush:{size:brushSize,shape:brushShape,filled:shapeFilled},color:rgba,rgba,zoom,grid:showGrid,assetsVisible,assetPreviewAvailable:hasAssetPreview(),expanded,controlsVisible:!expanded||controlsVisible,loading,width,height,pan:{x:panX,y:panY},cursor:cursor?{...cursor}:null,stroke:!!gesture,selection:selection?clone(selection):null,draftSelection:draftSelection.map(point=>point.slice()),selectionShape,selectionMask:{active:!!selection,protected:selection?width*height-selectedArea().count:0},smoothing:{radius:smoothRadius,strength:smoothStrength},protection:{count:protectionCount,visible:protectionVisible,undo:protectionUndo.length},stampReady:!!stamp,stampSize:stamp?{width:stamp.clip.width,height:stamp.clip.height}:null,stampSourceSize:stamp?{width:stamp.sourceClip.width,height:stamp.sourceClip.height}:null,stampPosition:stampPosition?{...stampPosition}:null,pasting:pastePreview?{x:pastePreview.x,y:pastePreview.y,width:pastePreview.clip.width,height:pastePreview.clip.height}:null,clipboard:!!selectionCore()?.clipboard.has(),viewport:{width:canvas.width,height:canvas.height},edits:currentData()}),dispose(){if(destroyed)return;cancelPaste(false);selection=null;cancelGesture();if(expanded)setExpanded(false);destroyed=true;stamp=null;stampPosition=null;++loadToken;observer?.disconnect();if(drawFrame)win.cancelAnimationFrame(drawFrame);doc.removeEventListener('keydown',keydown,true);doc.removeEventListener('keyup',keyup,true);doc.removeEventListener('visibilitychange',hidden);doc.removeEventListener('fullscreenchange',fullscreenChanged);win.removeEventListener('blur',blur);win.removeEventListener('resize',resize);host.classList.remove('artwork-editor','is-expanded','controls-hidden');delete host.dataset.artworkEditor;host.replaceChildren();}};
 }
 return {TILE,MAX_DIMENSION,MAX_AREA,MAX_RUNS,validateTexture,normalizeTexture,validate,normalize,changePixels,composePixels,compose,linePoints,brushPixels,shapePixels,createSmoothingStroke,createFeatheringStroke,mount};
});
