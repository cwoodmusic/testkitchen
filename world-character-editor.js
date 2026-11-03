/* Independent placement of the arcade's stationary live character sprites. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;if(root)root.CodaWorldCharacterEditor=value;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const DEFINITIONS={
  scholar:{id:'scholar',name:'The Scholar',x:298,y:213,depthOffset:27,activity:'relaxing',approaches:[[298,302]]},
  riff:{id:'riff',name:'Riff · Notes Shop',x:1352,y:480,depthOffset:0,approaches:[[1352,430],[1352,610]]},
  pip:{id:'pip',name:'Pip · Avatar Boutique',x:513,y:418,depthOffset:0,approaches:[[525,485]]}
 };
 const IDS=Object.keys(DEFINITIONS),FIELDS=['x','y','facing','layer','depthOffset','layerOrder','visible'];
 const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
 const finite=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
 const dimensions=(width,height)=>Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&width<=8192&&height<=8192;
 function validate(data,width,height){
  if(!dimensions(width,height)||!plain(data)||Object.keys(data).some(id=>!IDS.includes(id)))return false;
  return Object.values(data).every(patch=>plain(patch)&&Object.keys(patch).every(key=>FIELDS.includes(key))&&
   (!Object.hasOwn(patch,'x')||finite(patch.x,0,width))&&(!Object.hasOwn(patch,'y')||finite(patch.y,0,height))&&
   (!Object.hasOwn(patch,'facing')||['down','left','up','right'].includes(patch.facing))&&
   (!Object.hasOwn(patch,'layer')||['back','world','front'].includes(patch.layer))&&
   (!Object.hasOwn(patch,'depthOffset')||finite(patch.depthOffset,-height,height))&&
   (!Object.hasOwn(patch,'layerOrder')||finite(patch.layerOrder,-1000000,1000000))&&
   (!Object.hasOwn(patch,'visible')||typeof patch.visible==='boolean'));
 }
 function defaults(){return copy(DEFINITIONS);}
 function resolve(id,data={},width=1672,height=941){
  const definition=DEFINITIONS[id];if(!definition||!validate(data,width,height))return null;
  const patch=data[id]||{},x=patch.x??definition.x,y=patch.y??definition.y,layer=patch.layer||'world',depthOffset=patch.depthOffset??definition.depthOffset;
  const approaches=definition.approaches.map(([ax,ay])=>({x:clamp(ax+x-definition.x,0,width),y:clamp(ay+y-definition.y,0,height)}));
  const value={...copy(definition),...patch,x,y,layer,depthOffset,facing:patch.facing||'down',visible:patch.visible!==false,opacity:1,
   sortY:layer==='back'?-5000:layer==='front'?height+10000:y+depthOffset,approaches};
  if(id==='scholar'){value.approach={...approaches[0]};value.approachX=approaches[0].x;value.approachY=approaches[0].y;}
  return value;
 }
 function create(api={}){
  const {host,canvas}=api;if(!host||!canvas)throw Error('Character placement needs an editor host and canvas.');
  const doc=host.ownerDocument,width=api.width||canvas.width,height=api.height||canvas.height;
  if(!dimensions(width,height))throw Error('Character placement dimensions are invalid.');
  let selected=null,drag=null;
  const fields={},section=doc.createElement('section');section.className='dev-original';section.dataset.worldCharacterEditor='';
  const heading=doc.createElement('h3');heading.className='dev-heading';heading.textContent='NPC sprites';section.append(heading);
  const note=doc.createElement('p');note.className='dev-note';note.textContent='Select a character here or on the map, then drag to move them independently of furniture. Their interaction points move with them.';section.append(note);
  function control(key,label,type,options){
   const wrapper=doc.createElement('label');wrapper.className='studioField';wrapper.append(doc.createTextNode(label));
   const node=doc.createElement(type==='select'?'select':'input');node.dataset.worldCharacter=key;node.id='devCharacter'+key[0].toUpperCase()+key.slice(1);node.setAttribute('aria-label',label);
   if(type!=='select')node.type=type;
   if(options)for(const [value,text]of options){const option=doc.createElement('option');option.value=value;option.textContent=text;node.append(option);}
   wrapper.append(node);fields[key]=node;return wrapper;
  }
  section.append(control('select','Select NPC','select',[['','Choose a character'],...IDS.map(id=>[id,DEFINITIONS[id].name])]));
  const details=doc.createElement('div');details.dataset.worldCharacterDetails='';section.append(details);
  const coordinates=doc.createElement('div');coordinates.className='studioGrid';coordinates.append(control('x','NPC X','number'),control('y','NPC Y','number'));details.append(coordinates);
  Object.assign(fields.x,{min:'0',max:String(width),step:'1'});Object.assign(fields.y,{min:'0',max:String(height),step:'1'});
  details.append(control('layer','NPC layer','select',[['back','Background / behind actors'],['world','Actor depth'],['front','Foreground / above actors']]));
  details.append(control('depthOffset','NPC depth offset (px)','number'));Object.assign(fields.depthOffset,{min:String(-height),max:String(height),step:'1'});
  details.append(control('facing','NPC facing','select',[['down','Down'],['left','Left'],['up','Up'],['right','Right']]));
  const visible=control('visible','NPC visible','checkbox');visible.className='studioCheck';details.append(visible);
  const buttons=doc.createElement('div');buttons.className='dev-toolbar';details.append(buttons);
  const reset=doc.createElement('button');reset.type='button';reset.dataset.worldCharacter='reset';reset.textContent='Reset NPC position';buttons.append(reset);
  const pixels=doc.createElement('button');pixels.type='button';pixels.dataset.worldCharacter='pixels';pixels.textContent='Edit NPC sprite pixels';pixels.hidden=typeof api.editPixels!=='function';buttons.append(pixels);
  host.append(section);
  const canEdit=()=>api.canEdit?.()!==false;
  const data=()=>{const value=api.getData?.()||{};return validate(value,width,height)?value:{};};
  function states(){
   const current=api.getStates?.();if(Array.isArray(current))return current;if(current&&typeof current==='object')return Object.values(current);
   return IDS.map(id=>resolve(id,data(),width,height));
  }
  function state(id){return states().find(value=>value?.id===id)||resolve(id,data(),width,height);}
  function refresh(){
   fields.select.value=selected||'';details.hidden=!selected;
   const person=selected?state(selected):null;
   if(person)for(const key of ['x','y','layer','depthOffset','facing'])fields[key].value=String(person[key]??(key==='depthOffset'?0:''));
   fields.visible.checked=person?.visible!==false;
   for(const node of [...Object.values(fields),reset,pixels])node.disabled=!canEdit();
  }
  function choose(id,focus=true){
   if(!IDS.includes(id))id=null;cancelGesture();selected=id;
   if(id){api.onSelect?.(id);const person=state(id);if(focus&&person)api.focusWorld?.(person.x,person.y);}
   refresh();
  }
  function commit(patch){
   if(!selected||!canEdit())return false;finishGesture();const next=copy(data());next[selected]={...(next[selected]||{}),...patch};
   if(!validate(next,width,height))return false;
   const accepted=api.setData?.(next)!==false;refresh();return accepted;
  }
  fields.select.onchange=()=>{if(!canEdit()){refresh();return;}choose(fields.select.value);};
  for(const key of ['x','y','depthOffset'])fields[key].onchange=()=>{
   const value=Number(fields[key].value),min=key==='depthOffset'?-height:0,max=key==='x'?width:height;
   if(Number.isFinite(value))commit({[key]:clamp(value,min,max)});else refresh();
  };
  for(const key of ['layer','facing'])fields[key].onchange=()=>commit({[key]:fields[key].value});
  fields.visible.onchange=()=>commit({visible:fields.visible.checked});
  reset.onclick=()=>{
   if(!selected||!canEdit())return;finishGesture();const next=copy(data());if(next[selected]){delete next[selected].x;delete next[selected].y;if(!Object.keys(next[selected]).length)delete next[selected];}
   api.setData?.(next);refresh();api.onStatus?.('Restored '+DEFINITIONS[selected].name+' to the original position.');
  };
  pixels.onclick=()=>{if(selected&&canEdit())api.editPixels?.(selected);};
  function pointerDown(event){
   if(!canEdit()||event.button!==0)return false;const point=api.toWorld(event.clientX,event.clientY);
   const candidates=states().filter(person=>IDS.includes(person?.id)&&person.visible!==false).sort((a,b)=>(a.sortY??a.y)-(b.sortY??b.y));
   const person=candidates.reverse().find(value=>Math.abs(point.x-value.x)<=25&&point.y>=value.y-95&&point.y<=value.y+8);
   if(!person)return false;
   event.preventDefault?.();canvas.focus?.({preventScroll:true});choose(person.id,false);
   drag={id:event.pointerId,character:person.id,start:{x:point.x,y:point.y},origin:{x:person.x,y:person.y},preview:{x:person.x,y:person.y}};
   try{canvas.setPointerCapture(event.pointerId);}catch{}refresh();return true;
  }
  function pointerMove(event){
   if(!drag||event.pointerId!==drag.id)return false;if(!canEdit()){cancelGesture();return true;}
   const point=api.toWorld(event.clientX,event.clientY);drag.preview={x:clamp(Math.round(drag.origin.x+point.x-drag.start.x),0,width),y:clamp(Math.round(drag.origin.y+point.y-drag.start.y),0,height)};
   refresh();return true;
  }
  function release(previous){try{if(canvas.hasPointerCapture?.(previous.id))canvas.releasePointerCapture(previous.id);}catch{}}
  function finishGesture(){
   if(!drag)return false;const previous=drag;drag=null;release(previous);
   if(canEdit()&&(previous.preview.x!==previous.origin.x||previous.preview.y!==previous.origin.y)){
    const next=copy(data());next[previous.character]={...(next[previous.character]||{}),...previous.preview};
    api.setData?.(next);api.onStatus?.('Moved '+DEFINITIONS[previous.character].name+'. Undo is available.');
   }
   refresh();return true;
  }
  function cancelGesture(){if(!drag)return false;const previous=drag;drag=null;release(previous);refresh();return true;}
  function pointerEnd(event){if(!drag||event&&event.pointerId!==drag.id)return false;return finishGesture();}
  function drawOverlay(ctx,scale=1){
   const person=selected?state(selected):null;if(!person||person.visible===false)return;
   ctx.save();ctx.strokeStyle='#ffe19a';ctx.lineWidth=2/Math.max(.001,scale);ctx.setLineDash([5/Math.max(.001,scale),4/Math.max(.001,scale)]);ctx.strokeRect(person.x-25,person.y-95,50,103);ctx.restore();
  }
  refresh();return {getSelected:()=>selected,clearSelection:()=>choose(null,false),refresh,pointerDown,pointerMove,pointerEnd,finishGesture,cancelGesture,drawOverlay,
   getPreview:id=>drag?.character===id?{...drag.preview}:null,getState:()=>({selected,dragging:!!drag,preview:drag?{id:drag.character,...drag.preview}:null})};
 }
 return Object.freeze({validate,defaults,resolve,create});
});
