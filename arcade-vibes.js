/* Level-earned arcade atmosphere. Preferences stay on this browser; unlocking
 * a vibe is always checked against the current player's level. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CodaArcadeVibes=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const KEY='codaArcadeVibeV1',TAU=Math.PI*2,SCENERY_MAX_PIXELS=8*1024*1024,SCENERY_MAX_ENTRIES=256;
 const GRADES=Object.freeze({glowstick:'rgba(0,3,31,.82)',spooky:'rgba(37,0,52,.76)',aurora:'rgba(0,36,54,.57)',festival:'rgba(45,2,62,.48)'});
 const DEFINITIONS=Object.freeze([
  {id:'classic',label:'Classic arcade',minLevel:1,description:'The familiar arcade lights.'},
  {id:'glowstick',label:'Glowstick Vibe',minLevel:20,description:'Blue lights and a glowstick for everybody.'},
  {id:'spooky',label:'Spooky Vibe',minLevel:30,description:'Halloween costumes, purple mist and ghostly green lights.'},
  {id:'aurora',label:'Aurora Vibe',minLevel:40,description:'Northern lights and little stars.'},
  {id:'festival',label:'Festival Vibe',minLevel:50,description:'Neon ribbons and celebration sparkles.'}
 ].map(item=>Object.freeze(item)));
 const byId=new Map(DEFINITIONS.map(item=>[item.id,item]));
 // Costumes are display-only overlays. Never write these into an NPC outfit
 // or the player's wardrobe: changing the vibe restores their original look.
 const COSTUMES=Object.freeze([
  {id:'wizard',outfit:'robe',shirt:'#253e9d',lowerColor:'#202754',headwear:'wizard',headwearColor:'#293991',accessory:'wand',shoes:'boots'},
  {id:'vampire',outfit:'tuxedo',shirt:'#781d45',lowerColor:'#26172e',headwear:'none',accessory:'cape',shoes:'chelsea'},
  {id:'skeleton',outfit:'pants',shirt:'#121b2a',lowerColor:'#121b2a',headwear:'none',accessory:'none',shoes:'boots'},
  {id:'witch',outfit:'gown',shirt:'#742e83',lowerColor:'#432151',headwear:'witch',headwearColor:'#41204e',accessory:'wand',shoes:'platforms'},
  {id:'pumpkin',outfit:'hoodie',shirt:'#f17b25',lowerColor:'#326137',headwear:'beret',headwearColor:'#426d35',accessory:'lantern',shoes:'boots'},
  {id:'phantom',outfit:'suit',shirt:'#25203b',lowerColor:'#20192e',headwear:'tophat',headwearColor:'#4b235a',accessory:'cape',shoes:'oxfords'},
  {id:'black-cat',outfit:'dress',shirt:'#222034',lowerColor:'#181b2b',headwear:'cat',headwearColor:'#211d31',accessory:'bow',shoes:'ballet'},
  {id:'forest-witch',outfit:'robe',shirt:'#235b4e',lowerColor:'#1e3739',headwear:'witch',headwearColor:'#163b34',accessory:'magicorb',shoes:'boots'},
  {id:'pirate',outfit:'coat',shirt:'#862b40',lowerColor:'#29243d',headwear:'pirate',headwearColor:'#292238',accessory:'sword',shoes:'combat'},
  {id:'alchemist',outfit:'coat',shirt:'#c1efd2',lowerColor:'#3e4162',headwear:'none',eyewear:'steampunk',accessory:'magicorb',shoes:'boots'},
  {id:'ghost',outfit:'robe',shirt:'#e2f4ed',lowerColor:'#c5dedb',headwear:'none',accessory:'lantern',shoes:'slippers'},
  {id:'knight',outfit:'suit',shirt:'#7793b1',lowerColor:'#526b8c',headwear:'viking',headwearColor:'#758ca8',accessory:'shield',shoes:'combat'}
 ].map(item=>Object.freeze(item)));
 const CAST_COSTUMES=Object.freeze({bach:0,mozart:1,beethoven:2,clara:3,joplin:4,ellington:5,ella:6,nina:7,miles:8,dj:9,chopin:10,haydn:11,captain:8,'captain-cadence':8});
 const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const hex=value=>typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value);
 const seed=(index,salt=0)=>((Math.imul(index+1,1103515245+salt*1201)>>>0)%65521)/65521;
 function create(api={}){
  const win=api.window||(typeof window==='undefined'?null:window),doc=api.document||win?.document,body=api.body||doc?.body;
  let storage=api.storage;if(storage===undefined)try{storage=win?.localStorage;}catch{}
  let selected='classic',active='classic',level=1,persistent=true,destroyed=false,signature='',lastApplied=null;
  const originalBodyVibe=body?.dataset?.arcadeVibe,controls=new Set(),textures=new Map();
  const scenery=new Map(),scenerySourceIDs=new WeakMap();
  let sceneryVibe='classic',sceneryPixels=0,sceneryNextID=1,sceneryBuilds=0,sceneryHits=0,sceneryAllocations=0,sceneryEvictions=0;
  function releaseScenery(entry){entry.canvas.width=0;entry.canvas.height=0;}
  function clearScenery(){for(const entry of scenery.values())releaseScenery(entry);scenery.clear();sceneryPixels=0;}
  try{const saved=storage?.getItem?.(KEY);if(saved){const parsed=JSON.parse(saved);if(parsed?.version===1&&byId.has(parsed.selected))selected=parsed.selected;}}
  catch{persistent=false;}
  function playerLevel(){try{const value=api.getLevel?.();return clamp(Math.floor(finite(typeof value==='object'?value?.level:value,1)),1,1000000);}catch{return 1;}}
  function quality(){try{const value=api.getQuality?.();return ['full','lite','off'].includes(value)?value:'full';}catch{return 'lite';}}
  function reduced(){try{return typeof api.reducedMotion==='function'?api.reducedMotion()===true:api.reducedMotion===true;}catch{return true;}}
  function state(){return {selected,active,level,persistent,quality:quality(),reducedMotion:reduced(),options:DEFINITIONS.map(item=>({...item,locked:level<item.minLevel}))};}
  function refresh(){
   if(destroyed)return state();
   level=playerLevel();active=level>=byId.get(selected).minLevel?selected:'classic';
   if(active!==sceneryVibe){clearScenery();sceneryVibe=active;}
   const next=selected+'|'+active+'|'+level+'|'+persistent;
   if(next!==signature){
    signature=next;
    if(body?.dataset&&body.dataset.arcadeVibe!==active)body.dataset.arcadeVibe=active;
    lastApplied=active;for(const view of controls)renderControls(view);
    try{api.onChange?.(state());}catch{/* A visual preference cannot interrupt play. */}
   }
   return state();
  }
  function announce(message){for(const view of controls)view.status.textContent=message;}
  function setVibe(id){
   if(destroyed||!byId.has(id))return false;
   level=playerLevel();const definition=byId.get(id);
   if(level<definition.minLevel){announce(definition.label+' unlocks at Level '+definition.minLevel+'.');return false;}
   selected=id;
   try{if(typeof storage?.setItem!=='function')throw Error('storage');storage.setItem(KEY,JSON.stringify({version:1,selected}));persistent=true;}catch{persistent=false;}
   refresh();announce(definition.label+' selected.'+(persistent?'':' This choice lasts for this visit.'));return true;
  }
  function renderControls(view){
   view.level.textContent='Your level: '+level;
   for(const definition of DEFINITIONS){
    const button=view.buttons.get(definition.id),locked=level<definition.minLevel;
    button.setAttribute('aria-pressed',String(active===definition.id));button.setAttribute('aria-disabled',String(locked));
    button.classList.toggle('is-locked',locked);button.querySelector('.arcade-vibe-requirement').textContent=locked?'🔒 Level '+definition.minLevel:definition.minLevel>1?'Level '+definition.minLevel+' reward':'Always available';
    button.title=definition.description+(locked?' Unlocks at Level '+definition.minLevel+'.':'');
   }
  }
  function mountControls(host){
   if(destroyed||!host?.ownerDocument)return null;
   const owner=host.ownerDocument,make=(tag,cls,text)=>{const node=owner.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
   const root=make('fieldset','arcade-vibe-controls'),legend=make('legend','','Arcade vibe'),levelLabel=make('p','arcade-vibe-level'),options=make('div','arcade-vibe-options'),status=make('p','arcade-vibe-status');
   status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   root.append(legend,make('p','arcade-vibe-help','Level up to change the mood of the whole arcade.'),levelLabel,options,status);
   const buttons=new Map();
   for(const definition of DEFINITIONS){
    const button=make('button','arcade-vibe-choice');button.type='button';button.dataset.arcadeVibe=definition.id;
    button.append(make('strong','',definition.label),make('span','arcade-vibe-description',definition.description),make('span','arcade-vibe-requirement'));
    button.onclick=()=>setVibe(definition.id);buttons.set(definition.id,button);options.append(button);
   }
   const view={root,buttons,status,level:levelLabel};controls.add(view);host.append(root);refresh();renderControls(view);
   return {refresh:()=>{refresh();renderControls(view);},destroy(){controls.delete(view);root.remove();}};
  }
  function makeCanvas(width,height){
   const canvas=api.makeCanvas?.(width,height)||doc?.createElement?.('canvas');if(!canvas?.getContext)return null;
   canvas.width=width;canvas.height=height;return canvas;
  }
  function getGradeFill(){
   if(destroyed)return null;
   // Hundreds of foreground brush fragments can share one source in a frame.
   // Recheck the ownership/level gate without rebuilding menu state each time.
   const nextLevel=playerLevel(),nextActive=nextLevel>=byId.get(selected).minLevel?selected:'classic';
   if(nextLevel!==level||nextActive!==active)refresh();
   return GRADES[active]||null;
  }
  function getSceneryCacheState(){return {entries:scenery.size,pixels:sceneryPixels,maxPixels:SCENERY_MAX_PIXELS,maxEntries:SCENERY_MAX_ENTRIES,builds:sceneryBuilds,hits:sceneryHits,allocations:sceneryAllocations,evictions:sceneryEvictions};}
  // Grade an isolated sprite before it is depth-sorted over the world. Keeping
  // its alpha makes the affine colour wash identical across silhouette edges:
  // t*(a*source+(1-a)*background)+wash, with t = 1 - wash alpha.
  function gradeImage(source,options={}){
   const fill=getGradeFill();if(!fill||!source||(typeof source!=='object'&&typeof source!=='function'))return null;
   if(!options||typeof options!=='object'||Array.isArray(options))return null;
   if(source.complete!==undefined&&(!source.complete||!source.naturalWidth))return null;
   const sourceWidth=source.naturalWidth||source.width,sourceHeight=source.naturalHeight||source.height;
   if(![sourceWidth,sourceHeight].every(value=>Number.isFinite(value)&&value>0&&value<=65536))return null;
   const crop=options.crop===undefined?[0,0,sourceWidth,sourceHeight]:options.crop;
   if(!Array.isArray(crop)||crop.length!==4||!crop.every(Number.isFinite))return null;
   const [sx,sy,sw,sh]=crop;
   if(sx<0||sy<0||sw<=0||sh<=0||sx+sw>sourceWidth+.000001||sy+sh>sourceHeight+.000001)return null;
   const revision=options.revision??null;
   if(!['string','number','boolean'].includes(typeof revision)&&revision!==null||typeof revision==='number'&&!Number.isFinite(revision))return null;
   let sourceID=scenerySourceIDs.get(source);if(!sourceID){sourceID=sceneryNextID++;scenerySourceIDs.set(source,sourceID);}
   const key=sourceID+':'+crop.join(','),scale=Math.min(1,Math.sqrt(SCENERY_MAX_PIXELS/(Math.ceil(sw)*Math.ceil(sh))),8192/Math.ceil(sw),8192/Math.ceil(sh));
   const width=Math.max(1,Math.floor(Math.ceil(sw)*scale)),height=Math.max(1,Math.floor(Math.ceil(sh)*scale)),pixels=width*height;
   let entry=scenery.get(key);
   if(entry&&entry.revision===revision&&entry.width===width&&entry.height===height){scenery.delete(key);scenery.set(key,entry);sceneryHits++;return entry.canvas;}
   if(entry){scenery.delete(key);sceneryPixels-=entry.pixels;}
   while(scenery.size&&(sceneryPixels+pixels>SCENERY_MAX_PIXELS||scenery.size>=SCENERY_MAX_ENTRIES)){
    const first=scenery.keys().next().value,discard=scenery.get(first);scenery.delete(first);sceneryPixels-=discard.pixels;releaseScenery(discard);sceneryEvictions++;
   }
   let canvas=entry?.canvas;try{if(!canvas)canvas=makeCanvas(width,height);}catch{return null;}if(!canvas)return null;
   if(!entry)sceneryAllocations++;
   try{
    if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
    const g=canvas.getContext('2d');if(!g)throw Error('Canvas is unavailable.');
    g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,width,height);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.filter='none';g.shadowBlur=0;g.imageSmoothingEnabled=false;
    g.drawImage(source,sx,sy,sw,sh,0,0,width,height);
    g.globalCompositeOperation='source-atop';g.fillStyle=fill;g.fillRect(0,0,width,height);g.globalCompositeOperation='source-over';
    entry={canvas,revision,width,height,pixels};scenery.set(key,entry);sceneryPixels+=pixels;sceneryBuilds++;return canvas;
   }catch{releaseScenery({canvas});return null;}
  }
  function glow(color){
   if(textures.has(color))return textures.get(color);
   if(textures.size>=48)textures.delete(textures.keys().next().value);
   const canvas=makeCanvas(96,96);if(!canvas){textures.set(color,null);return null;}
   const g=canvas.getContext('2d');if(!g){textures.set(color,null);return null;}
   const gradient=g.createRadialGradient(48,48,0,48,48,48);gradient.addColorStop(0,color+'c4');gradient.addColorStop(.16,color+'80');gradient.addColorStop(.48,color+'29');gradient.addColorStop(1,color+'00');g.fillStyle=gradient;g.fillRect(0,0,96,96);textures.set(color,canvas);return canvas;
  }
  function light(g,x,y,radius,color,opacity=1){
   const image=glow(color);if(!image)return;
   g.save();g.globalAlpha=opacity;g.globalCompositeOperation='screen';g.drawImage(image,x-radius,y-radius,radius*2,radius*2);g.restore();
  }
  function anchors(frame,width,height){
   let source=frame.lights;try{if(!Array.isArray(source))source=api.getLights?.();}catch{source=[];}
   return (Array.isArray(source)?source:[]).slice(0,32).filter(item=>item&&Number.isFinite(item.x)&&Number.isFinite(item.y)&&Math.abs(item.x)<=16384&&Math.abs(item.y)<=16384).map(item=>({x:item.x,y:item.y,radius:clamp(finite(item.radius,100),12,420),color:hex(item.color)?item.color:'#408dff',kind:item.kind}));
  }
  function drawSpecks(g,width,height,time,count,colors,drift,stars=false){
   for(let i=0;i<count;i++){
    const x=Math.round((seed(i,2)*width+time*(2+seed(i,4)*5)*drift)%width),y=Math.round((seed(i,7)*height+Math.sin(time*.32+i*1.7)*9*drift+height)%height),size=i%5===0?3:2;
    g.fillStyle=colors[i%colors.length];g.globalAlpha=.38+(i%4)*.14;g.fillRect(x,y,size,size);
    if(stars&&i%3===0){g.globalAlpha=.7;g.fillRect(x-2,y+1,7,1);g.fillRect(x+1,y-2,1,7);}
   }
   g.globalAlpha=1;
  }
  function ribbon(g,width,height,time,index,colors,opacity,aurora=false){
   const y=height*(.12+index*.115),amplitude=height*(aurora?.065:.035),thickness=height*.036;
   if(aurora){
    // Reuse one flowing path for layered translucent strokes. Wide, faint
    // outer strokes and a narrow luminous vein feather the curtain without
    // per-frame canvas blur or opaque polygon edges.
    g.beginPath();for(let point=0;point<=18;point++){
     const x=width*point/18,yy=y+Math.sin(point*.56+time*.13+index)*amplitude;
     if(point===0)g.moveTo(x,yy);else g.lineTo(x,yy);
    }
    g.lineCap='round';g.lineJoin='round';g.strokeStyle=colors[index%colors.length];
    for(const [size,alpha]of [[.20,.12],[.14,.20],[.09,.34],[.045,.5],[.012,.62]]){g.lineWidth=height*size;g.globalAlpha=opacity*alpha;g.stroke();}
    g.globalAlpha=1;return;
   }
   g.beginPath();
   for(let point=0;point<=18;point++){
    const x=width*point/18,yy=y+Math.sin(point*.56+time*.13+index)*amplitude;
    if(point===0)g.moveTo(x,yy);else g.lineTo(x,yy);
   }
   for(let point=18;point>=0;point--){const x=width*point/18,yy=y+Math.sin(point*.56+time*.13+index)*amplitude+thickness+Math.sin(point*.31+index)*height*.02;g.lineTo(x,yy);}
   g.closePath();g.fillStyle=colors[index%colors.length];g.globalAlpha=opacity;g.fill();g.globalAlpha=1;
  }
  function cobweb(g,x,y,scale){
   g.save();g.translate(x,y);g.scale(scale,Math.abs(scale));g.strokeStyle='#c8f0df';g.lineWidth=1.5;g.globalAlpha=.4;g.beginPath();
   for(let i=0;i<4;i++){const angle=i*Math.PI/6;g.moveTo(0,0);g.lineTo(Math.cos(angle)*72,Math.sin(angle)*72);}
   for(const radius of [22,44,68]){g.moveTo(radius,0);for(let i=1;i<=3;i++){const angle=i*Math.PI/6;g.lineTo(Math.cos(angle)*radius,Math.sin(angle)*radius);}}
   g.stroke();g.restore();
  }
  function drawPumpkin(g,x,y,scale){
   const r=(xx,yy,w,h,color)=>{g.fillStyle=color;g.fillRect(Math.round(x+xx*scale),Math.round(y+yy*scale),Math.ceil(w*scale),Math.ceil(h*scale));};
   r(-10,-6,20,12,'#f07c21');r(-8,-8,16,16,'#fba22c');r(-4,-8,2,16,'#d96820');r(3,-8,2,16,'#de7722');r(-2,-12,4,5,'#3d9854');
   r(-6,-3,4,3,'#3f2454');r(3,-3,4,3,'#3f2454');r(-4,3,9,2,'#3f2454');r(-5,-3,2,1,'#ffef7a');r(4,-3,2,1,'#ffef7a');
  }
  // A split pass lets a depth-sorted world grade its floor before actors, then
  // add luminous atmosphere after furniture. Rooms can use the default all pass.
  function drawAtmosphere(g,frame={}){
   if(destroyed||!g?.save)return false;refresh();if(active==='classic')return false;
   const width=clamp(finite(frame.width,1672),1,8192),height=clamp(finite(frame.height,941),1,8192),q=quality(),quiet=reduced()||q==='off';
   const time=quiet?0:Math.max(0,finite(frame.time,finite(api.getTime?.()))),count=q==='full'?48:q==='lite'?20:0,phase=['grade','effects'].includes(frame.phase)?frame.phase:'all';
   g.save();try{
    g.globalCompositeOperation='source-over';g.globalAlpha=1;g.shadowBlur=0;
    if(phase!=='effects'){
     g.fillStyle=GRADES[active];g.fillRect(0,0,width,height);
    }
    if(phase==='grade')return true;
    // A screen-blended colour wash also tints foreground fixtures without
    // covering the white glowstick cores with a dark overlay.
    g.globalCompositeOperation='screen';g.fillStyle=active==='glowstick'?'rgba(11,45,148,.24)':active==='spooky'?'rgba(100,10,147,.28)':active==='aurora'?'rgba(10,109,116,.23)':'rgba(153,29,116,.23)';g.fillRect(0,0,width,height);
    if(q==='off')return true;
    const lights=anchors(frame,width,height),limit=q==='full'?24:12;
    for(const anchor of lights.slice(0,limit)){
     const color=active==='glowstick'?(anchor.kind==='neon'?anchor.color:'#226dff'):active==='spooky'?'#66e7ab':anchor.color;
     light(g,anchor.x,anchor.y,anchor.radius*1.15,color,.94);
    }
    if(active==='glowstick'){
     light(g,width*.55,height*.44,Math.min(width,height)*.72,'#175cff',.65);
     drawSpecks(g,width,height,time,Math.ceil(count*.65),['#61f3ff','#c7ff5c','#c7fffa'],quiet?0:1,true);
    }else if(active==='spooky'){
     for(let i=0;i<(q==='full'?7:3);i++){const x=width*(.04+i*.16)+Math.sin(time*.09+i)*width*.055;light(g,x,height*(.34+(i%3)*.21),Math.min(340,width*.25),i%2?'#743fbe':'#36bf93',.43);}
     cobweb(g,30,30,1.25);cobweb(g,width-30,30,-1.25);
     const pumpkins=q==='full'?5:2;
     for(let i=0;i<pumpkins;i++){const x=width*(.13+i*.185),y=height*(.82+(i%2)*.06);light(g,x,y,34,'#ff9a31',.72);g.globalCompositeOperation='source-over';drawPumpkin(g,x,y,1.1);g.globalCompositeOperation='screen';}
     drawSpecks(g,width,height,time,Math.ceil(count*.6),['#b4ffdf','#c8a8ff','#ffc580'],quiet?0:.45);
    }else if(active==='aurora'){
     const colors=['#38efbb','#48c5ff','#7d84ff','#a172f1','#5ff0d4','#78cdfd'];
     light(g,width*.25,height*.32,width*.44,'#1fd6ad',.4);light(g,width*.75,height*.36,width*.4,'#8463f2',.4);
     for(let i=0;i<(q==='full'?6:3);i++)ribbon(g,width,height,time,i,colors,q==='full'?.27:.24,true);
     // Short vertical light streaks make the broad curtains read as northern
     // lights rather than simple stripes. A fixed count bounds draw work.
     for(let i=0;i<(q==='full'?18:8);i++){const x=width*(i+.5)/(q==='full'?18:8),y=height*(.13+seed(i,12)*.33)+Math.sin(time*.11+i)*height*.025;light(g,x,y,height*.13,colors[i%colors.length],.25);}
     drawSpecks(g,width,height,time,count,['#cafff4','#e5ebff','#a8fce0'],quiet?0:.28,true);
    }else if(active==='festival'){
     const colors=['#f777d7','#61d8ff','#f8d875','#90eac2'];
     for(let i=0;i<(q==='full'?6:3);i++)ribbon(g,width,height,time,i,colors,.25);
     light(g,width*.22,height*.42,width*.34,'#fd5bbf',.36);light(g,width*.78,height*.46,width*.34,'#4abaff',.36);
     drawSpecks(g,width,height,time,count,colors,quiet?0:1.3,true);
    }
   }finally{g.restore();}
   return true;
  }
  function drawCharacterGlow(g,actor={}){
   if(destroyed||active!=='glowstick'||!g?.save||!Number.isFinite(actor.x)||!Number.isFinite(actor.y))return false;
   if(playerLevel()<byId.get('glowstick').minLevel){refresh();return false;}
   const scale=clamp(finite(actor.scale,1),.2,4),q=quality(),time=reduced()||q==='off'?0:finite(actor.time,finite(api.getTime?.())),side=actor.facing==='left'?-1:1;
   const x=actor.x+side*12*scale,y=actor.y-23*scale,lean=Math.sin(time*.8+actor.x*.01)*1.5*scale;
   g.save();try{
    g.shadowBlur=0;g.globalCompositeOperation='source-over';
    if(q!=='off'){
     light(g,x,y,45*scale,'#1bdfff',.9);light(g,x,y,22*scale,'#45ffcf',1);
     if(q==='full')light(g,actor.x+side*8*scale,actor.y+2*scale,32*scale,'#21e8d0',.66);
    }
    g.lineCap='round';g.strokeStyle='#10b7d5';g.lineWidth=7*scale;g.beginPath();g.moveTo(x,y+5*scale);g.lineTo(x+lean,y-11*scale);g.stroke();
    g.strokeStyle='#5dffe0';g.lineWidth=4*scale;g.stroke();g.strokeStyle='#f1fff8';g.lineWidth=1.8*scale;g.stroke();
   }finally{g.restore();}
   return true;
  }
  function costumeFor(actor={}){
   const id=typeof actor.id==='string'?actor.id.toLowerCase():'';
   if(destroyed||active!=='spooky'||actor.role!=='npc'||!id)return null;
   if(playerLevel()<30){refresh();return null;}
   const known=CAST_COSTUMES[id];let index=known;
   if(index===undefined){let hash=0;for(let i=0;i<Math.min(id.length,160);i++)hash=(Math.imul(hash,31)+id.charCodeAt(i))>>>0;index=hash%COSTUMES.length;}
   return COSTUMES[index];
  }
  function characterAppearance(appearance={},actor={}){
   const costume=costumeFor(actor);if(!costume)return appearance;
   const {id,...look}=costume;return {...appearance,...look};
  }
  function drawCharacterCostume(g,actor={}){
   const costume=costumeFor(actor);if(!costume||!g?.save||!Number.isFinite(actor.x)||!Number.isFinite(actor.y))return false;
   const scale=clamp(finite(actor.scale,1),.2,4),side=actor.facing==='left'||actor.facing==='right',back=actor.facing==='up';
   const r=(x,y,w,h,color)=>{g.fillStyle=color;g.fillRect(Math.round(actor.x+x*scale),Math.round(actor.y+y*scale),Math.ceil(w*scale),Math.ceil(h*scale));};
   g.save();try{
    g.globalCompositeOperation='source-over';g.shadowBlur=0;
    if(costume.id==='skeleton'){
     r(side?2:-1,-23,2,17,'#dffbea');for(const yy of [-21,-17,-13]){r(side?-3:-7,yy,side?7:14,2,'#dffbea');}
     for(const xx of [-5,4])r(xx,-7,2,9,'#c7ecdf');
    }else if(costume.id==='pumpkin'){
     r(-7,-20,4,3,'#44304b');r(3,-20,4,3,'#44304b');r(-5,-13,11,2,'#44304b');r(-3,-12,7,2,'#fff08c');r(-1,-24,3,3,'#599941');
    }else if(costume.id==='ghost'){
     r(-11,-11,23,6,'#d9f8ed');for(const xx of [-9,-3,3,9])r(xx,-6,3,3,'#d9f8ed');if(!back){r(side?2:-5,-21,2,3,'#425b67');r(side?6:4,-21,2,3,'#425b67');r(side?4:0,-16,2,2,'#425b67');}
    }else if(costume.id==='vampire'||costume.id==='phantom'){
     if(!back){r(side?1:-4,-24,side?4:8,3,'#e8f7dc');r(side?4:-2,-20,3,4,'#c84268');}
    }else if(costume.id==='black-cat'){
     if(!back){r(side?5:-7,-27,5,1,'#dbcaf3');r(side?6:4,-25,4,1,'#dbcaf3');}
    }
   }finally{g.restore();}
   return true;
  }
  function destroy(){
   if(destroyed)return;destroyed=true;for(const view of controls)view.root.remove();controls.clear();textures.clear();clearScenery();
   if(body?.dataset?.arcadeVibe===lastApplied){if(originalBodyVibe===undefined)delete body.dataset.arcadeVibe;else body.dataset.arcadeVibe=originalBodyVibe;}
  }
  refresh();
  return {setVibe,getState:()=>refresh(),refresh,drawAtmosphere,drawCharacterGlow,characterAppearance,drawCharacterCostume,getGradeFill,gradeImage,getSceneryCacheState,mountControls,destroy};
 }
 return Object.freeze({KEY,DEFINITIONS,GRADES,SCENERY_MAX_PIXELS,create});
});
