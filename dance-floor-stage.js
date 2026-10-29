/* Temporary dance-floor blocking and smooth poses; game timing stays in the rhythm engine. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaDanceFloorStage=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const FLOOR_BOUNDS=Object.freeze({x:119,y:667,width:564,height:176});
 const STAGE_BOUNDS=Object.freeze({x:115,y:540,width:600,height:320});
 const PLAYER_SPOT=Object.freeze({x:395,y:755});
 const NPC_SPOTS=Object.freeze([{x:310,y:720},{x:480,y:720},{x:395,y:805}].map(Object.freeze));
 const WATCHER_SPOTS=Object.freeze([{x:185,y:720},{x:620,y:740},{x:185,y:800},{x:620,y:805},{x:220,y:690},{x:565,y:690},{x:150,y:760},{x:650,y:760}].map(Object.freeze));
 const VECTORS=Object.freeze({left:Object.freeze({x:-1,y:0}),right:Object.freeze({x:1,y:0}),up:Object.freeze({x:0,y:-1}),down:Object.freeze({x:0,y:1})});
 const STEP_SECONDS=.4,FALL_SECONDS=.66,SEPARATION=44;
 const finitePoint=value=>value&&Number.isFinite(value.x)&&Number.isFinite(value.y);
 const inside=point=>point.x>=FLOOR_BOUNDS.x+16&&point.x<=FLOOR_BOUNDS.x+FLOOR_BOUNDS.width-16&&point.y>=FLOOR_BOUNDS.y+16&&point.y<=FLOOR_BOUNDS.y+FLOOR_BOUNDS.height-16;
 const copyPoint=point=>({x:point.x,y:point.y});
 function create(api={}){
  const player=api.player,npcs=Array.isArray(api.npcs)?api.npcs:[];
  let active=false,elapsed=0,actors=[],watchers=[];
  function reduced(){try{return typeof api.reducedMotion==='function'?api.reducedMotion()===true:api.reducedMotion===true;}catch{return true;}}
  function walkable(x,y){try{return (!api.isWalkable||api.isWalkable(x,y)!==false)&&inside({x,y});}catch{return false;}}
  function clearMove(from,x,y){const pieces=Math.max(1,Math.ceil(Math.hypot(x-from.x,y-from.y)/2));for(let at=1;at<=pieces;at++)if(!walkable(from.x+(x-from.x)*at/pieces,from.y+(y-from.y)*at/pieces))return false;return true;}
  function roll(){let value;try{value=(api.random||Math.random)();}catch{value=0;}return Number.isFinite(value)?Math.max(0,Math.min(.999999999,value)):0;}
  function shuffled(values){const result=values.slice();for(let index=result.length-1;index>0;index--){const other=Math.floor(roll()*(index+1));[result[index],result[other]]=[result[other],result[index]];}return result;}
  function spot(wanted,reserved){
   const usable=point=>walkable(point.x,point.y)&&reserved.every(other=>Math.hypot(point.x-other.x,point.y-other.y)>=(other.space||SEPARATION));
   if(usable(wanted))return copyPoint(wanted);
   // Search nearby feet positions first, without leaving the dance-floor tiles.
   for(let radius=12;radius<=120;radius+=12)for(let angle=0;angle<12;angle++){
    const theta=angle*Math.PI/6,point={x:Math.round(wanted.x+Math.cos(theta)*radius),y:Math.round(wanted.y+Math.sin(theta)*radius)};
    if(usable(point))return point;
   }
   return null;
  }
  function entry(actor,id,base,isPlayer){
   return {actor,id,base:copyPoint(base),isPlayer,snapshot:{x:actor.x,y:actor.y,facing:actor.facing,activity:actor.activity},direction:'down',stepAt:-Infinity,fallAt:-Infinity,fallSign:1,offsetX:0,offsetY:0,phase:0,steps:0};
  }
  function start(){
   if(active)return true;if(!finitePoint(player))return false;
   const visible=npcs.filter(person=>person&&person!==player&&finitePoint(person)&&!person.hidden),fixed=person=>person.pinned||person.conversation||person.userPlaced||person.authoredPosition||person.id==='dj'||person.role==='dj'||person.isDJ;
   const usedIds=new Set(['player']),selected=shuffled(visible.filter(person=>!fixed(person))).filter(person=>{const id=person.id||'npc-'+npcs.indexOf(person);if(usedIds.has(id))return false;usedIds.add(id);return true;}).slice(0,3);
   const others=visible.filter(person=>!selected.includes(person)),desired=[PLAYER_SPOT,...NPC_SPOTS],relocated=[];
   const location=person=>relocated.find(value=>value.actor===person)?.base||person;
   // Visitors already on the floor watch from its edges. Authored or pinned
   // people stay exactly where they were; the dance formation works around them.
   for(const person of others){
    if(fixed(person)||!desired.some(point=>Math.hypot(point.x-person.x,point.y-person.y)<56))continue;
    const occupied=[...desired,...others.filter(other=>other!==person).map(location)].map(point=>({...copyPoint(point),space:56}));
    let target=null;for(const candidate of WATCHER_SPOTS){target=spot(candidate,occupied);if(target)break;}
    if(target)relocated.push({actor:person,id:person.id||'npc-'+npcs.indexOf(person),base:target,snapshot:copyPoint(person)});
   }
   const reserved=others.map(person=>({...copyPoint(location(person)),space:56})),playerSpot=spot(PLAYER_SPOT,reserved);if(!playerSpot)return false;reserved.push(playerSpot);
   const prepared=[entry(player,'player',playerSpot,true)],used=new Set(['player']);
   for(const person of selected){
    if(prepared.length===4)break;const id=typeof person.id==='string'&&person.id?person.id:'npc-'+npcs.indexOf(person);if(used.has(id))continue;
    const point=spot(NPC_SPOTS[prepared.length-1],reserved);if(!point)return false;
    prepared.push(entry(person,id,point,false));reserved.push(point);used.add(id);
   }
   actors=prepared;watchers=relocated;elapsed=0;active=true;
   for(const actor of actors){actor.actor.x=actor.base.x;actor.actor.y=actor.base.y;}
   for(const watcher of watchers){watcher.actor.x=watcher.base.x;watcher.actor.y=watcher.base.y;}
   return true;
  }
  function step(direction,options={}){
   if(!active||!Object.prototype.hasOwnProperty.call(VECTORS,direction))return false;
   const id=options.actorId||'all';let changed=false;
   for(const actor of actors){
    if(id!=='all'&&id!=='npcs'&&actor.id!==id||id==='npcs'&&actor.isPlayer)continue;
    actor.direction=direction;actor.stepAt=elapsed;actor.steps++;changed=true;
    if(options.miss&&actor.isPlayer){actor.fallAt=elapsed;actor.fallSign=direction==='left'?-1:1;}
   }
   return changed;
  }
  function miss(direction='right'){
   if(!active)return false;const actor=actors[0];actor.fallAt=elapsed;actor.fallSign=direction==='left'?-1:1;return true;
  }
  function pose(id='player'){
   if(!active)return null;const actor=actors.find(value=>value.id===(typeof id==='object'?id?.id:id));if(!actor)return null;
   const age=elapsed-actor.stepAt,fallAge=elapsed-actor.fallAt,falling=actor.isPlayer&&fallAge>=0&&fallAge<FALL_SECONDS,simple=reduced(),lift=age>=0&&age<STEP_SECONDS?Math.sin(age/STEP_SECONDS*Math.PI):0,fall=falling?Math.sin(fallAge/FALL_SECONDS*Math.PI):0;
   return {x:actor.actor.x,y:actor.actor.y,facing:'down',walking:!falling&&Math.hypot(actor.offsetX,actor.offsetY)>.35,phase:actor.phase,emote:'dance',jumpHeight:simple||falling?0:Math.max(0,lift)*6,rotation:simple||!fall?0:fall*1.3*actor.fallSign,scaleY:simple?1:1-fall*.17,falling,direction:actor.direction};
  }
  function update(dt){
   if(!active||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.25);elapsed+=dt;const simple=reduced(),distance=simple?3:18,follow=1-Math.exp(-dt*30);
   for(const actor of actors){
    const age=elapsed-actor.stepAt,envelope=age>=0&&age<STEP_SECONDS?Math.sin(age/STEP_SECONDS*Math.PI):0,vector=VECTORS[actor.direction],wantedX=vector.x*distance*envelope,wantedY=vector.y*distance*envelope;
    let offsetX=actor.offsetX+(wantedX-actor.offsetX)*follow,offsetY=actor.offsetY+(wantedY-actor.offsetY)*follow;
    if(Math.abs(offsetX)<.001)offsetX=0;if(Math.abs(offsetY)<.001)offsetY=0;
    const x=actor.base.x+offsetX,y=actor.base.y+offsetY;
    if(clearMove(actor.actor,x,y)){actor.offsetX=offsetX;actor.offsetY=offsetY;actor.actor.x=x;actor.actor.y=y;}
    else if(walkable(actor.base.x,actor.base.y)){actor.offsetX=0;actor.offsetY=0;actor.actor.x=actor.base.x;actor.actor.y=actor.base.y;}
    actor.phase+=dt*(envelope>.05?9:2.5);
   }
  }
  function close(){
   if(!active)return;for(const actor of actors){actor.actor.x=actor.snapshot.x;actor.actor.y=actor.snapshot.y;}
   for(const watcher of watchers){watcher.actor.x=watcher.snapshot.x;watcher.actor.y=watcher.snapshot.y;}
   active=false;actors=[];watchers=[];elapsed=0;
  }
  function getState(){return {active,elapsed,bounds:{...STAGE_BOUNDS},floorBounds:{...FLOOR_BOUNDS},dancers:actors.map(actor=>({id:actor.id,name:actor.actor.name||actor.id,isPlayer:actor.isPlayer,base:copyPoint(actor.base),steps:actor.steps})),watchers:watchers.map(person=>({id:person.id,name:person.actor.name||person.id,...copyPoint(person.actor),base:copyPoint(person.base)})),poses:Object.fromEntries(actors.map(actor=>[actor.id,pose(actor.id)]))};}
  return Object.freeze({start,update,step,hit:direction=>step(direction),cue:direction=>step(direction,{actorId:'npcs'}),miss,pose,close,destroy:close,getState});
 }
 return Object.freeze({FLOOR_BOUNDS,STAGE_BOUNDS,PLAYER_SPOT,NPC_SPOTS,WATCHER_SPOTS,STEP_SECONDS,FALL_SECONDS,create});
});
