/* The exploration camera is independent of the room editor and fishing clock. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root){root.createCodaCaveCamera=api.createCodaCaveCamera;root.createCodaRoomCamera=api.createCodaCaveCamera;}})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
 function createCodaCaveCamera(api={}){
  const canvas=api.canvas;if(!canvas)throw Error('The cave camera needs a canvas.');
  const W=finite(api.width,canvas.width||1000),H=finite(api.height,canvas.height||620),maxZoom=Math.max(1,finite(api.maxZoom,3));
  const viewportElement=api.viewportElement||canvas.parentElement,doc=canvas.ownerDocument,win=doc?.defaultView||(typeof window==='object'?window:globalThis),label=api.label||'Cave';
  const camera={x:0,y:0,zoom:1};let pinch=null,destroyed=false,controls=null,indicator=null,out=null,inside=null,sizedCanvas=false,mobileDefaultApplied=false,zoomChosen=false;
  const enabled=()=>!destroyed&&(typeof api.enabled!=='function'||api.enabled()===true);
  const isMobile=()=>typeof api.isMobile==='function'?api.isMobile():typeof api.isMobile==='boolean'?api.isMobile:win?.matchMedia?.('(max-width:760px),(pointer:coarse)').matches===true;
  function fitCanvas(){
   if(!canvas.style||!viewportElement)return;
   let cover=typeof api.coverViewport==='function'?api.coverViewport():api.coverViewport;
   if(cover===undefined)try{cover=win?.getComputedStyle?.(viewportElement).getPropertyValue('--coda-room-cover').trim()==='1';}catch{cover=false;}
   if(!cover){if(sizedCanvas){canvas.style.width='';canvas.style.height='';sizedCanvas=false;}return;}
   const width=viewportElement.clientWidth,height=viewportElement.clientHeight;if(!(width>0&&height>0))return;
   const scale=Math.max(width/W,height/H),cssWidth=(W*scale)+'px',cssHeight=(H*scale)+'px';
   if(canvas.style.width!==cssWidth)canvas.style.width=cssWidth;
   if(canvas.style.height!==cssHeight)canvas.style.height=cssHeight;
   sizedCanvas=true;
  }
  function viewport(){
   const bounds=canvas.getBoundingClientRect();if(!(bounds.width>0&&bounds.height>0)||!viewportElement?.getBoundingClientRect)return {left:0,top:0,width:W,height:H};
   const clip=viewportElement.getBoundingClientRect(),sx=clip.width/(viewportElement.offsetWidth||clip.width||1),sy=clip.height/(viewportElement.offsetHeight||clip.height||1),left=clip.left+(viewportElement.clientLeft||0)*sx,top=clip.top+(viewportElement.clientTop||0)*sy,width=(viewportElement.clientWidth||clip.width)*sx,height=(viewportElement.clientHeight||clip.height)*sy;
   const x=Math.max(bounds.left,left),y=Math.max(bounds.top,top),right=Math.min(bounds.left+bounds.width,left+width),bottom=Math.min(bounds.top+bounds.height,top+height);
   if(right<=x||bottom<=y)return {left:0,top:0,width:W,height:H};
   return {left:(x-bounds.left)*W/bounds.width,top:(y-bounds.top)*H/bounds.height,width:(right-x)*W/bounds.width,height:(bottom-y)*H/bounds.height};
  }
  function follow(){const focus=api.getFocus?.()||{x:W/2,y:H/2},view=viewport(),z=camera.zoom;camera.x=clamp(finite(focus.x,W/2)-(view.left+view.width/2)/z,-view.left/z,W-(view.left+view.width)/z)||0;camera.y=clamp(finite(focus.y,H/2)-(view.top+view.height/2)/z,-view.top/z,H-(view.top+view.height)/z)||0;}
  function refresh(){if(!controls)return;controls.hidden=!enabled();indicator.textContent=Math.round(camera.zoom*100)+'%';out.disabled=camera.zoom<=1;inside.disabled=camera.zoom>=maxZoom;}
  function update(){if(!mobileDefaultApplied&&!zoomChosen&&enabled()&&isMobile()){camera.zoom=clamp(finite(api.initialMobileZoom,2),1,maxZoom);mobileDefaultApplied=true;}fitCanvas();follow();refresh();}
  function setZoom(value){if(!Number.isFinite(value)||destroyed)return camera.zoom;zoomChosen=true;camera.zoom=clamp(value,1,maxZoom);fitCanvas();follow();refresh();return camera.zoom;}
  function onPinch(gesture){
   if(gesture?.phase==='end'){pinch=null;return;}
   if(!enabled()||!gesture||!(gesture.distance>0))return;
   if(gesture.phase==='start'){pinch={distance:gesture.distance,zoom:camera.zoom};api.onGestureStart?.();}
   else if(pinch)setZoom(pinch.zoom*gesture.distance/pinch.distance);
  }
  function toWorld(clientX,clientY){const bounds=canvas.getBoundingClientRect();return{x:camera.x+(clientX-bounds.left)*W/bounds.width/camera.zoom,y:camera.y+(clientY-bounds.top)*H/bounds.height/camera.zoom};}
  function begin(ctx){ctx.save();ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);}
  function end(ctx){ctx.restore();}
  function getState(){const gesture=api.getGestureState?.(),view=viewport();return{...camera,minZoom:1,maxZoom,pinching:!!(gesture?.pinching||gesture?.suppressed||pinch),following:!!gesture?.following,viewport:view,visibleWidth:view.width/camera.zoom,visibleHeight:view.height/camera.zoom};}
  if(api.controls!==false&&doc&&viewportElement){
   controls=doc.createElement('div');controls.className=api.className||'cave-camera-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label',label+' zoom controls');
   const make=(text,label,fn)=>{const button=doc.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',label);button.onclick=()=>{if(enabled())fn();};controls.append(button);return button;};
   const name=label.toLowerCase();out=make('−','Zoom '+name+' out',()=>setZoom(camera.zoom-.25));indicator=make('100%','Reset '+name+' zoom',()=>setZoom(1));inside=make('+','Zoom '+name+' in',()=>setZoom(camera.zoom+.25));
   viewportElement.append(controls);refresh();
  }
  function destroy(){if(destroyed)return;destroyed=true;pinch=null;controls?.remove();if(sizedCanvas){canvas.style.width='';canvas.style.height='';}}
  update();
  return{update,setZoom,zoomBy:amount=>setZoom(camera.zoom+amount),reset:()=>setZoom(1),onPinch,toWorld,begin,end,getState,destroy};
 }
 return{createCodaCaveCamera,createCodaRoomCamera:createCodaCaveCamera};
});
