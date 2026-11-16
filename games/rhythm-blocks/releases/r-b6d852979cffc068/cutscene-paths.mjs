import {findPath,isWalkable} from './room.mjs';

const NS='http://www.w3.org/2000/svg';
const COLORS=Object.freeze({nell:'#f7bd55',iris:'#93e49c',pip:'#7cdfff',mira:'#d7a4ff',oren:'#ffad95'});
const point=value=>value&&Number.isFinite(value.x)&&Number.isFinite(value.y);
const copy=value=>({x:value.x,y:value.y});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
let sequence=0;

/** A temporary, physical-floor path overlay. Only release commits an edit. */
export function createCutscenePathEditor({map,scene,clip,actorId=clip?.actor,onChange=()=>{}}={}){
 if(!map||!scene?.geometry)throw new TypeError('A path editor needs its room map and geometry.');
 const document=map.ownerDocument,svg=document.createElementNS(NS,'svg'),markerId=`cutscene-route-arrow-${++sequence}`;
 svg.classList.add('cutscene-path-overlay');svg.setAttribute('role','group');svg.setAttribute('aria-label','Selected character route');svg.setAttribute('preserveAspectRatio','none');
 const defs=document.createElementNS(NS,'defs'),marker=document.createElementNS(NS,'marker'),arrow=document.createElementNS(NS,'path');
 marker.id=markerId;marker.setAttribute('viewBox','0 0 10 10');marker.setAttribute('refX','8');marker.setAttribute('refY','5');marker.setAttribute('markerWidth','10');marker.setAttribute('markerHeight','10');marker.setAttribute('orient','auto');marker.setAttribute('markerUnits','strokeWidth');arrow.setAttribute('d','M0 0 L10 5 L0 10 Z');marker.append(arrow);defs.append(marker);svg.append(defs);
 const line=document.createElementNS(NS,'polyline');line.classList.add('cutscene-route-line');line.dataset.cutscenePathLine='';line.setAttribute('fill','none');line.setAttribute('marker-end',`url(#${markerId})`);svg.append(line);
 const handles=document.createElementNS(NS,'g');handles.classList.add('cutscene-route-points');svg.append(handles);
 const label=document.createElementNS(NS,'text');label.classList.add('cutscene-route-label');label.setAttribute('aria-hidden','true');svg.append(label);
 const status=document.createElement('span');status.className='sr-only';status.setAttribute('role','status');status.setAttribute('aria-live','polite');map.append(svg,status);
 let currentScene=scene,currentClip=clip,currentActor=actorId,points=[],drawnSegments=[],floor=null,scale=1,drag=null,destroyed=false,original='',lastLabel='';
 const routeCache=new Map();
 const removers=[];
 function listen(target,name,callback,options){target.addEventListener(name,callback,options);removers.push(()=>target.removeEventListener(name,callback,options));}
 function setScale(){
  const rect=map.getBoundingClientRect();scale=Math.max(.01,rect.width/currentScene.geometry.width);svg.style.setProperty('--cutscene-route-scale',String(scale));
  for(const handle of handles.children){const endpoint=handle.dataset.pathEndpoint==='true';handle.setAttribute('r',String((endpoint?13:11)/scale));}
  line.setAttribute('stroke-width',String(3/scale));label.setAttribute('font-size',String(12/scale));
 }
 function floorFor(value){const ids=new Set(value.actors?.map(actor=>actor.id)??[]);return{...value.geometry,obstacles:value.geometry.obstacles.filter(obstacle=>!ids.has(obstacle.id))};}
 function safePoint(requested,from=points[0]){
  const {bounds,radius,gridSize}=floor;
  const candidate={x:clamp(Math.round(requested.x/gridSize)*gridSize,bounds.x+radius,bounds.x+bounds.width-radius),y:clamp(Math.round(requested.y/gridSize)*gridSize,bounds.y+radius,bounds.y+bounds.height-radius)};
  if(isWalkable(floor,candidate))return candidate;
  const start=isWalkable(floor,from)?from:floor.start;
  try{const route=findPath(floor,start,candidate);if(route?.length)return copy(route.at(-1));if(route)return copy(start);}catch{/* A malformed draft keeps the last valid point. */}
  return copy(isWalkable(floor,from)?from:points.at(-1)??floor.start);
 }
 function routedPoints(){
  const drawn=points.length?[copy(points[0])]:[];drawnSegments=[];
  for(let index=1;index<points.length;index++){
   const from=drawn.at(-1),destination=points[index];
   if(!from)break;
   const key=[from.x,from.y,destination.x,destination.y].join('|');
   let route=routeCache.get(key);
   if(route===undefined){
    try{route=findPath(floor,from,destination)??[];}catch{route=[];}
    if(routeCache.size>=256)routeCache.clear();routeCache.set(key,route);
   }
   for(const next of route){
    const previous=drawn.at(-1);if(Math.hypot(next.x-previous.x,next.y-previous.y)<.000001)continue;
    // Visible navigation corners are independent of the authored handles. A
    // dragged point can add or remove several right-angle routing bends.
    drawn.push(copy(next));drawnSegments.push({from:previous,to:next,controlIndex:index-1});
   }
  }
  return drawn;
 }
 function paint(){
  line.setAttribute('points',routedPoints().map(at=>`${at.x},${at.y}`).join(' '));
  for(const [index,handle]of [...handles.children].entries()){handle.setAttribute('cx',String(points[index].x));handle.setAttribute('cy',String(points[index].y));}
  if(points.length){label.setAttribute('x',String(points[0].x+18/scale));label.setAttribute('y',String(points[0].y-18/scale));}
 }
 function render(){
  handles.replaceChildren();
  for(const [index,at]of points.entries()){
   const handle=document.createElementNS(NS,'circle'),end=index===points.length-1;
   handle.classList.add(index===0?'cutscene-route-start':'cutscene-route-handle');handle.dataset.pathPoint=String(index);handle.dataset.pathEndpoint=String(end);handle.setAttribute('cx',String(at.x));handle.setAttribute('cy',String(at.y));
   if(index>0){handle.setAttribute('role','button');handle.setAttribute('tabindex','0');handle.setAttribute('aria-label',end?'Move route destination':'Move route waypoint '+index);}
   else{handle.setAttribute('role','img');handle.setAttribute('aria-label','Route starting position');}
   handles.append(handle);
  }
  setScale();paint();
 }
 function payload(endpointChanged=false){const result={waypoints:points.slice(1,-1).map(copy),keepTarget:!endpointChanged};if(endpointChanged)result.destination=copy(points.at(-1));return result;}
 function commit(endpointChanged){
  const value=payload(endpointChanged);status.textContent=endpointChanged?'Route destination changed.':'Route waypoints changed.';
  onChange(value);
 }
 function world(event,rect){return{x:(event.clientX-rect.left)/rect.width*currentScene.geometry.width,y:(event.clientY-rect.top)/rect.height*currentScene.geometry.height};}
 function nearestSegment(at){
  let best=Infinity,index=0;
  for(const segment of drawnSegments){
   const a=segment.from,b=segment.to,dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
   const t=length?clamp(((at.x-a.x)*dx+(at.y-a.y)*dy)/length,0,1):0,distance=Math.hypot(at.x-a.x-t*dx,at.y-a.y-t*dy);
   if(distance<best){best=distance;index=segment.controlIndex;}
  }
  return index;
 }
 function pointerDown(event){
  if(destroyed||event.button!==0)return;
  const handle=event.target.closest?.('[data-path-point]'),onLine=event.target.closest?.('[data-cutscene-path-line]');
  if(!handle&&!onLine)return;
  let index=handle?Number(handle.dataset.pathPoint):-1;if(index===0)return;
  event.preventDefault();event.stopPropagation();
  const rect=map.getBoundingClientRect(),before=points.map(copy),at=world(event,rect);
  let inserted=false;
  if(index<0){if(points.length>=34)return;index=nearestSegment(at)+1;points.splice(index,0,safePoint(at,points[index-1]));inserted=true;render();}
  drag={pointerId:event.pointerId,index,rect,before,startX:event.clientX,startY:event.clientY,changed:inserted,endpoint:!inserted&&index===before.length-1};
  svg.setPointerCapture?.(event.pointerId);svg.classList.add('is-dragging');
 }
 function pointerMove(event){
  if(!drag||drag.pointerId!==event.pointerId)return;event.preventDefault();event.stopPropagation();
  const at=safePoint(world(event,drag.rect),points[drag.index-1]);
  if(at.x!==points[drag.index].x||at.y!==points[drag.index].y){points[drag.index]=at;drag.changed=true;paint();}
 }
 function pointerEnd(event,cancel=false){
  if(!drag||drag.pointerId!==event.pointerId)return;event.preventDefault();event.stopPropagation();
  const current=drag;drag=null;svg.classList.remove('is-dragging');
  if(cancel){points=current.before;render();return;}
  if(current.changed&&JSON.stringify(points)!==JSON.stringify(current.before))commit(current.endpoint);
 }
 function keydown(event){
  const handle=event.target.closest?.('[data-path-point]');if(!handle)return;
  const index=Number(handle.dataset.pathPoint);if(index<1||index>=points.length)return;
  const arrows={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(arrows[event.key]){
   event.preventDefault();event.stopPropagation();const [dx,dy]=arrows[event.key],size=floor.gridSize;
   points[index]=safePoint({x:points[index].x+dx*size,y:points[index].y+dy*size},points[index-1]);paint();commit(index===points.length-1);
  }else if(['Delete','Backspace'].includes(event.key)&&index<points.length-1){event.preventDefault();event.stopPropagation();points.splice(index,1);render();commit(false);}
 }
 function update(value={}){
  if(destroyed)return;
  if(value.scene)currentScene=value.scene;if(Object.hasOwn(value,'clip'))currentClip=value.clip;if(value.actorId)currentActor=value.actorId;
  floor=floorFor(currentScene);routeCache.clear();svg.setAttribute('viewBox',`0 0 ${currentScene.geometry.width} ${currentScene.geometry.height}`);svg.dataset.pathActor=currentActor??currentClip?.actor??'mira';
  const color=COLORS[svg.dataset.pathActor]??'#e8ca8e';svg.style.setProperty('--cutscene-route-color',color);arrow.setAttribute('fill',color);line.setAttribute('stroke',color);
  const path=Array.isArray(currentClip?.path)?currentClip.path.filter(point):[];
  const actor=currentScene.actors?.find(actor=>actor.id===currentActor);
  const start=point(currentClip?.from)?currentClip.from:path[0]??actor?.feet??floor.start;
  const end=point(currentClip?.to)?currentClip.to:path.at(-1)??start;
  // Router-generated elbows describe how to reach an authored stop; they are
  // not additional authored stops. Keep only real waypoint handles so moving
  // an endpoint cannot silently turn navigation corners into saved waypoints.
  const waypoints=Array.isArray(currentClip?.waypoints)?currentClip.waypoints.filter(point):[];
  points=[copy(start),...waypoints.map(copy),copy(end)];
  original=JSON.stringify(points);drag=null;
  const actorName=currentActor?currentActor[0].toUpperCase()+currentActor.slice(1):'Character';
  const description=`${actorName} route. Drag points or the arrow. Movement follows up, down, left or right.`;
  if(description!==lastLabel){lastLabel=description;svg.setAttribute('aria-label',description);label.textContent=actorName;}
  render();
 }
 listen(svg,'pointerdown',pointerDown);listen(svg,'pointermove',pointerMove);listen(svg,'pointerup',event=>pointerEnd(event));listen(svg,'pointercancel',event=>pointerEnd(event,true));listen(svg,'lostpointercapture',event=>{if(drag?.pointerId===event.pointerId)pointerEnd(event,true);});listen(svg,'keydown',keydown);
 if(globalThis.ResizeObserver){const observer=new ResizeObserver(()=>{if(!destroyed)setScale();});observer.observe(map);if(map.parentElement)observer.observe(map.parentElement);removers.push(()=>observer.disconnect());}
 else if(document.defaultView)listen(document.defaultView,'resize',setScale);
 update();
 return Object.freeze({element:svg,update,get state(){return{actorId:currentActor,points:points.map(copy),dirty:JSON.stringify(points)!==original};},destroy(){if(destroyed)return;destroyed=true;drag=null;for(const remove of removers)remove();svg.remove();status.remove();}});
}
