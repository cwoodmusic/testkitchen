const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const directions=['down','left','up','right'];
function renderer(options={}){
  const unexpected=[],sandbox={window:{},fetch(){unexpected.push('fetch');throw Error('Characters must not fetch artwork');},Image:class{constructor(){unexpected.push('Image');throw Error('Characters must not load images');}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../character-renderer.js'),'utf8'),sandbox);
  return {value:sandbox.window.createCodaCharacterRenderer(options),unexpected};
}
function context(){
  const calls=[];let matrix=[1,0,0,1,0,0],fillStyle='#000';const stack=[];
  const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
  return {calls,get depth(){return stack.length;},get fillStyle(){return fillStyle;},set fillStyle(value){fillStyle=value;},
    save(){stack.push({matrix:matrix.slice(),fillStyle});},restore(){const state=stack.pop();assert.ok(state,'Canvas save/restore must balance');matrix=state.matrix;fillStyle=state.fillStyle;},
    translate(x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y));matrix=multiply(matrix,[1,0,0,1,x,y]);calls.push(['translate',x,y]);},
    scale(x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y));matrix=multiply(matrix,[x,0,0,y,0,0]);calls.push(['scale',x,y]);},
    rotate(angle){assert.ok(Number.isFinite(angle));const c=Math.cos(angle),s=Math.sin(angle);matrix=multiply(matrix,[c,s,-s,c,0,0]);},
    fillRect(x,y,w,h){assert.ok([x,y,w,h].every(Number.isFinite));assert.ok(w>0&&h>0);calls.push(['rect',x,y,w,h,fillStyle,...matrix]);},
    drawImage(){throw Error('Restored JavaScript characters must draw their own pixels');},
    beginPath(){},ellipse(...args){assert.ok(args.every(Number.isFinite));calls.push(['shadow',...args,{matrix:matrix.slice()}]);},fill(){}};
}
const rectangles=ctx=>ctx.calls.filter(call=>call[0]==='rect');
const signature=ctx=>JSON.stringify(rectangles(ctx));
const colors=ctx=>new Set(rectangles(ctx).map(rect=>rect[5]));
function draw(r,profile={},motion={},time=0){const ctx=context();assert.equal(r.drawPlayer(ctx,profile,motion,time),true);assert.equal(ctx.depth,0);return ctx;}

test('characters are ready synchronously and draw without image loading or a manifest',async()=>{
  const {value:r,unexpected}=renderer();assert.equal(r.isReady(),true);assert.equal(r.error,null);
  assert.ok(rectangles(draw(r)).length>20,'The character must actually paint its body');
  await r.ready;assert.equal(r.getState().ready,true);assert.equal(r.getState().mode,'javascript-characters');assert.equal(r.getState().base,'bald-gray');assert.deepEqual(unexpected,[]);
});
test('a fresh avatar is bald in gray clothes and unlocks never equip gear automatically',()=>{
  const {value:r}=renderer(),p=r.normalizeProfile({});
  for(const [key,value]of Object.entries({hairstyle:'bald',headwear:'none',eyewear:'none',accessory:'none',shirt:'#999ca6',lowerColor:'#626875',outfit:'pants',shoes:'sneakers'}))assert.equal(p[key],value,key);
  assert.equal(signature(draw(r,{hat:true,walked:600})),signature(draw(r)), 'An earned hat must remain an optional choice');
});
test('normalization preserves modern slots and migrates deliberate legacy equipment safely',()=>{
  const {value:r}=renderer(),legacy=r.normalizeProfile({name:'  '+'A'.repeat(40),skin:'url(javascript:bad)',hair:'#ABCDEF',shirt:'#102030',hairstyle:'unknown',outfit:'dress',accessory:'cap',shoes:'gold',emote:'spin'});
  assert.equal(legacy.name,'A'.repeat(18));assert.equal(legacy.skin,'#e5ad75');assert.equal(legacy.hair,'#abcdef');assert.equal(legacy.headwear,'cap');assert.equal(legacy.accessory,'none');
  assert.equal(r.normalizeProfile({accessory:'sunglasses'}).eyewear,'sunglasses');assert.equal(r.normalizeProfile({accessory:'partyglasses'}).eyewear,'partyglasses');
  const explicit=r.normalizeProfile({headwear:'none',eyewear:'none',accessory:'cap'});assert.equal(explicit.headwear,'none');assert.equal(explicit.accessory,'none');
  const combined=r.normalizeProfile({headwear:'beanie',eyewear:'glasses',accessory:'headphones',lowerColor:'#314159'});
  assert.equal(combined.headwear,'beanie');assert.equal(combined.eyewear,'glasses');assert.equal(combined.accessory,'headphones');assert.equal(combined.lowerColor,'#314159');
  for(const items of Object.values(r.catalog))for(const item of items){assert.equal(typeof item.id,'string');assert.equal(typeof item.label,'string');assert.ok(Object.isFrozen(item));}
});
test('all four directions share the foot origin and retain distinct procedural drawings',()=>{
  const {value:r}=renderer({reducedMotion:()=>true}),seen=[];
  for(const facing of directions){const ctx=draw(r,{hairstyle:'short'},{x:105,y:250,scale:1.5,facing,walking:true,phase:2},3);
    assert.ok(ctx.calls.some(call=>call[0]==='translate'&&call[1]===105&&call[2]===250));assert.ok(ctx.calls.some(call=>call[0]==='scale'&&call[1]===1.5&&call[2]===1.5));seen.push(signature(ctx));}
  assert.equal(new Set(seen).size,4,'Front, back and both side views must differ');
});
test('skin, upper clothing and lower clothing colors change independently',()=>{
  const {value:r}=renderer({reducedMotion:()=>true}),base=draw(r),shirt=draw(r,{shirt:'#c04065'}),pants=draw(r,{lowerColor:'#438c75'}),skin=draw(r,{skin:'#704633'});
  for(const [ctx,expected]of [[shirt,['#c04065','#626875','#e5ad75']],[pants,['#999ca6','#438c75','#e5ad75']],[skin,['#999ca6','#626875','#704633']]])for(const color of expected)assert.ok(colors(ctx).has(color),color);
  assert.ok(colors(base).has('#999ca6'));assert.ok(colors(base).has('#626875'));
});
test('a hat, glasses and accessory can all paint their independent additions together',()=>{
  const {value:r}=renderer({reducedMotion:()=>true});
  const counter=rects=>{const map=new Map();for(const rect of rects){const key=JSON.stringify(rect);map.set(key,(map.get(key)||0)+1);}return map;};
  const plain=counter(rectangles(draw(r))),combined=counter(rectangles(draw(r,{headwear:'cap',eyewear:'glasses',accessory:'headphones'})));
  for(const look of [{headwear:'cap'},{eyewear:'glasses'},{accessory:'headphones'}]){const single=counter(rectangles(draw(r,look)));let additions=0;
    for(const [key,count]of single){const added=count-(plain.get(key)||0);if(added>0){additions+=added;assert.ok((combined.get(key)||0)>=count,'An item must remain drawn in a combined look');}}
    assert.ok(additions>0,'Equipping an item must visibly add pixels');}
});
test('movement follows traveled phase, while emotes and reduced motion remain predictable',()=>{
  const {value:r}=renderer(),a=r.sampleMotion({walking:true,phase:.7},0),b=r.sampleMotion({walking:true,phase:.7},100);assert.equal(a.stride,b.stride);assert.equal(a.bob,b.bob);
  assert.notEqual(signature(draw(r,{}, {walking:true,phase:.7})),signature(draw(r,{}, {walking:true,phase:3.8})));
  const idle=signature(draw(r,{}, {},.6));for(const emote of ['wave','dance','robot','disco','playing','sit'])assert.notEqual(signature(draw(r,{}, {emote,emoteTime:.6},.6)),idle,emote+' must have a visible pose');
  const {value:still}=renderer({reducedMotion:()=>true}),quiet=signature(draw(still,{}, {walking:false,phase:0,emote:'wave',emoteTime:0},0));
  assert.equal(signature(draw(still,{}, {walking:false,phase:5,emote:'wave',emoteTime:8},8)),quiet);
  const steps=[0,Math.PI/2,Math.PI,Math.PI*1.5].map(phase=>still.sampleMotion({walking:true,phase},8));
  assert.deepEqual(steps.map(pose=>pose.stride),[0,1,0,-1]);
  assert.ok(steps.every(pose=>pose.bob===0&&pose.blink===false));
  assert.notEqual(signature(draw(still,{}, {walking:true,phase:0},8)),signature(draw(still,{}, {walking:true,phase:Math.PI/2},8)));
});
test('jumping raises the character drawing while its shadow remains at the ground anchor',()=>{
  const {value:r}=renderer({reducedMotion:()=>true});
  const ground=draw(r,{}, {x:100,y:150,jumpHeight:0}),air=draw(r,{}, {x:100,y:150,jumpHeight:24});
  const bounds=ctx=>{
    let minY=Infinity,maxY=-Infinity;
    for(const rect of rectangles(ctx)){
      const [,x,y,w,h,,a,b,c,d,e,f]=rect;
      for(const [xx,yy]of [[x,y],[x+w,y],[x,y+h],[x+w,y+h]]){
        const worldY=b*xx+d*yy+f;minY=Math.min(minY,worldY);maxY=Math.max(maxY,worldY);
      }
    }
    return {minY,maxY};
  };
  const grounded=bounds(ground),jumping=bounds(air);
  assert.equal(jumping.minY,grounded.minY-24,'The head must visibly rise with jump height');
  assert.equal(jumping.maxY,grounded.maxY-24,'The feet must lift away from the walking plane');
  const shadow=ctx=>{const call=ctx.calls.find(call=>call[0]==='shadow'),m=call.at(-1).matrix;
    return {x:m[0]*call[1]+m[2]*call[2]+m[4],y:m[1]*call[1]+m[3]*call[2]+m[5],radius:call[3]};};
  assert.equal(shadow(air).x,shadow(ground).x);assert.equal(shadow(air).y,shadow(ground).y);
  assert.ok(shadow(air).radius<shadow(ground).radius,'The grounded shadow should shrink as the player rises');
  assert.doesNotThrow(()=>draw(r,{}, {jumpHeight:Infinity}));
});
test('all musicians keep their identity while appearance overrides affect the drawing',()=>{
  const {value:r}=renderer({reducedMotion:()=>true}),ids=['bach','mozart','beethoven','clara','joplin','ellington','ella','nina','miles'];assert.equal(new Set(ids.map(id=>JSON.stringify(r.appearanceFor(id)))).size,9);
  assert.equal(r.appearanceFor('Miles Davis').name,'Miles Davis');assert.equal(r.appearanceFor('miles').accessory,'trumpet');
  for(const id of ids){assert.ok(Object.isFrozen(r.appearanceFor(id)));const person={id,x:10,y:20,facing:'down',walking:false},before=JSON.stringify(person),ctx=context();assert.equal(r.drawNPC(ctx,person,0),true);assert.ok(rectangles(ctx).length>20);assert.equal(JSON.stringify(person),before);}
  const ctx=context();r.drawNPC(ctx,{id:'miles',x:10,y:20,facing:'down',appearance:{shirt:'#123abc',lowerColor:'#a14567',outfit:'pants',headwear:'beanie',eyewear:'glasses',accessory:'none'}},0);assert.ok(colors(ctx).has('#123abc'));assert.ok(colors(ctx).has('#a14567'));assert.equal(r.appearanceFor('miles').name,'Miles Davis');
});
test('palette storage stays bounded and invalid motion never sends nonfinite coordinates to Canvas',()=>{
  const {value:r}=renderer();for(let i=0;i<180;i++)draw(r,{skin:'#'+(0x704000+i*103).toString(16).padStart(6,'0')},{walking:true,phase:i/5},i);assert.ok(r.getState().paletteCount<=128);
  for(const raw of [null,undefined,{}, {x:NaN,y:Infinity,phase:NaN,scale:Infinity,facing:'bad'}])assert.doesNotThrow(()=>draw(r,null,raw,NaN));
});

test('the expanded collection has real drawings in every direction and preserves independent item ids',()=>{
  const {value:r}=renderer({reducedMotion:()=>true});
  const groups={hairstyles:'hairstyle',outfits:'outfit',headwear:'headwear',eyewear:'eyewear',accessories:'accessory',shoes:'shoes'};
  assert.ok(r.catalog.headwear.length>=24);assert.ok(r.catalog.eyewear.length>=14);assert.ok(r.catalog.accessories.length>=22);assert.ok(r.catalog.shoes.length>=16);
  for(const [group,slot]of Object.entries(groups))for(const item of r.catalog[group]){
    assert.equal(r.normalizeProfile({[slot]:item.id})[slot],item.id);
    for(const facing of directions)assert.doesNotThrow(()=>draw(r,{[slot]:item.id},{facing}),group+': '+item.id);
  }
  assert.notEqual(signature(draw(r,{headwear:'witch'})),signature(draw(r,{headwear:'wizard'})));
  assert.ok(r.labelOffset({headwear:'wizard'})>r.labelOffset({}), 'Name labels must clear taller hats');
  assert.notEqual(signature(draw(r,{headwear:'cap',headwearColor:'#154875'})),signature(draw(r,{headwear:'cap',headwearColor:'#e95486'})));
});

test('the new Notes-shop props add distinct visible pixel drawings in every facing',()=>{
  const {value:r}=renderer({reducedMotion:()=>true});
  const props=['umbrella','shield','sword','lantern','vinyl','camera','book','bouquet','balloon','skateboard','paintpalette','compass','telescope','trophy','handbag','magicorb','gamepad','keytar','flute','accordion'];
  assert.ok(r.catalog.accessories.length>=48);
  for(const facing of directions){
    const plain=draw(r,{}, {facing}),plainSignature=signature(plain),seen=[];
    for(const accessory of props){
      const item=r.catalog.accessories.find(item=>item.id===accessory);assert.ok(item?.label,accessory+' must be a labeled choice');
      assert.equal(r.normalizeProfile({accessory}).accessory,accessory);
      const equipped=draw(r,{accessory},{facing});
      assert.ok(rectangles(equipped).length>rectangles(plain).length,accessory+' must add painted pixels');
      const next=signature(equipped);assert.notEqual(next,plainSignature,accessory+' / '+facing);seen.push(next);
    }
    assert.equal(new Set(seen).size,props.length,'Every prop must have its own drawing in '+facing);
  }
  for(const accessory of ['umbrella','balloon'])assert.ok(r.labelOffset({accessory})>=74,'Labels must clear '+accessory);
  assert.equal(r.normalizeProfile({}).accessory,'none','New shop stock must never equip a guest automatically');
});

test('every selected emote changes the pose and remains stable with reduced motion',()=>{
  const {value:r}=renderer(),{value:quiet}=renderer({reducedMotion:()=>true});
  assert.ok(r.catalog.emotes.length>=16);
  for(const {id}of r.catalog.emotes){
    const actions=[.15,.45,.8,1.2].map(time=>signature(draw(r,{}, {emote:id,emoteTime:time},time)));
    assert.ok(actions.some((value,index)=>value!==signature(draw(r,{}, {},[.15,.45,.8,1.2][index]))),id+' must have an actual pose');
    assert.equal(signature(draw(quiet,{}, {emote:id,emoteTime:.2},.2)),signature(draw(quiet,{}, {emote:id,emoteTime:8},8)));
  }
});

test('musician identity survives a shared color palette and matches the boutique character preview',()=>{
  const {value:r}=renderer({reducedMotion:()=>true}),signatures=[];
  for(const id of ['bach','mozart','beethoven','clara','joplin','ellington','ella','nina','miles']){
    const appearance={skin:'#aaaaaa',hair:'#555555',shirt:'#888888',lowerColor:'#777777'};
    const ctx=context();r.drawNPC(ctx,{id,x:10,y:20,facing:'down',appearance},0);signatures.push(signature(ctx));
    const preview=draw(r,{...r.appearanceFor(id),...appearance,characterId:id},{x:10,y:20,facing:'down'},0);
    assert.equal(signature(preview),signature(ctx),id+' preview must retain body, face, hair and costume identity');
  }
  assert.equal(new Set(signatures).size,9,'Distinct people must remain distinct beyond a palette swap');
  assert.equal(r.appearanceFor('dj').name,'DJ Coda');
});


test('player emotes face forward from every movement direction without changing normal facing',()=>{
 const {value:r}=renderer();
 for(const emote of ['wave','dance','spin','robot','disco','bow','cheer','airguitar']){
  for(const time of [.1,.6,1.2]){
   const front=signature(draw(r,{}, {facing:'down',emote,emoteTime:time},time));
   for(const facing of directions)assert.equal(signature(draw(r,{}, {facing,emote,emoteTime:time},time)),front,emote+' must face front');
  }
 }
 assert.notEqual(signature(draw(r,{}, {facing:'up'})),signature(draw(r,{}, {facing:'down'})));
});


test('premium transformations and mastery hats add actual pixels and unequip cleanly',()=>{
 const {value:r}=renderer(),normal=signature(draw(r));
 for(const form of ['alien','starlight']){
  assert.equal(r.normalizeProfile({form}).form,form);assert.notEqual(signature(draw(r,{form})),normal);
 }
 for(const headwear of ['celestialcrown','triadchampion','pitchlaurel10','pitchlaurel20','pitchlaurel30','pitchcrown40','basslaurel','grandstaffcrown'])assert.notEqual(signature(draw(r,{headwear})),normal,headwear);
 assert.notEqual(signature(draw(r,{accessory:'nebulaaura'})),normal);
 assert.equal(signature(draw(r,{form:'human',pet:'none'})),normal);
 assert.equal(r.normalizeProfile({form:'bogus',pet:'bogus'}).form,'human');assert.equal(r.normalizeProfile({pet:'bogus'}).pet,'none');
 assert.ok(r.labelOffset({form:'alien'})>=66);
});

test('clef mastery pins and crowns have distinct art in every facing',()=>{
 const {value:r}=renderer();
 for(const facing of ['down','up','left','right']){
  const seen=new Set([signature(draw(r,{}, {facing}))]);
  for(const [slot,id]of [['accessory','bassclefpin'],['accessory','grandstaffbadge'],['headwear','basslaurel'],['headwear','grandstaffcrown']]){
   assert.equal(r.normalizeProfile({[slot]:id})[slot],id);
   const pixels=signature(draw(r,{[slot]:id},{facing}));assert.ok(!seen.has(pixels),id+' '+facing);seen.add(pixels);
  }
 }
 assert.ok(r.labelOffset({headwear:'grandstaffcrown'})>=70);
});


test('Schoenberg, Handel and Vivaldi retain stable identities, directional drawings and wardrobe previews',()=>{
 const {value:r}=renderer({reducedMotion:()=>true});
 const composers=[['schoenberg','Arnold Schoenberg'],['handel','George Frideric Handel'],['vivaldi','Antonio Vivaldi']];
 for(const [id,name]of composers){
  const base=r.appearanceFor(id);assert.equal(base.name,name);assert.ok(Object.isFrozen(base));assert.equal(r.appearanceFor(name),base);
  const views=[];
  for(const facing of directions){
   const person={id,x:10,y:20,facing,walking:false},ctx=context();r.drawNPC(ctx,person,0);assert.equal(ctx.depth,0);assert.ok(rectangles(ctx).length>20);views.push(signature(ctx));
   const preview=draw(r,{...base,characterId:id},{x:10,y:20,facing},0);assert.equal(signature(preview),signature(ctx),id+' wardrobe preview / '+facing);
  }
  assert.equal(new Set(views).size,4,id+' needs front, rear and both side views');
 }
 assert.equal(r.appearanceFor('Arnold Schönberg'),r.appearanceFor('schoenberg'));
 assert.equal(r.appearanceFor('Georg Friedrich Händel'),r.appearanceFor('handel'));
 assert.equal(r.appearanceFor('Johann Sebastian Bach'),r.appearanceFor('bach'),'The existing Bach identity remains shared by his name aliases');
 const ctx=context();r.drawNPC(ctx,{id:'handel',facing:'down',appearance:{hairstyle:'bald',outfit:'tracksuit',shirt:'#123abc'}},0);assert.ok(colors(ctx).has('#123abc'));assert.equal(r.appearanceFor('handel').hairstyle,'powderwig');
});
