import test from 'node:test';
import assert from 'node:assert/strict';
import {createYellowNoteCatch} from './yellow-note-catch.mjs';
import {createNoteInventory,normalizeYellowNotes} from './note-inventory.mjs';
import * as motion from './rhythm-hunt-motion.mjs?v=town-notes-1';
import {blocked} from './model.mjs?v=town-flight-1';

class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.hidden=false;this.attrs={};this.dataset={};this.style={};this.count={textContent:''};}
 append(...items){this.children.push(...items);}
 setAttribute(key,value){this.attrs[key]=value;}
 querySelector(){return this.count;}
 all(){return this.children.flatMap(child=>[child,...child.all()]);}
}
function ink(){
 const strokes=[],ellipses=[];return new Proxy({globalAlpha:1,strokes,ellipses,stroke(){strokes.push(this.strokeStyle);},ellipse(...args){ellipses.push(args);}},{get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>{target[key]=value;return true;}});
}
function fixture(run){
 const old={document:globalThis.document,window:globalThis.window,matchMedia:globalThis.matchMedia,performance:globalThis.performance};let now=0;
 globalThis.document={createElement:tag=>new Element(tag),body:new Element('body')};globalThis.window={addEventListener(){}};globalThis.matchMedia=()=>({matches:true});globalThis.performance={now:()=>now*1000};
 try{
  const doc={version:1,cells:{},edges:{},objects:[],spawn:{x:1344,y:1344}};for(let i=0;i<43;i++)for(const [x,y]of [[i,0],[i,42],[0,i],[42,i]])doc.cells[`${x},${y}`]={surface:'water',level:0};
  let facing='down',enabled=true,equipped=true,limit=5;const player={...doc.spawn},data={stars:0,yellowNotes:normalizeYellowNotes(),npcRhythmWins:{}};let saves=0;const inventory=createNoteInventory({data,save(){saves++;return true;}}),canvas={focus(){},clientWidth:1000,clientHeight:1000,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:1000})};
  const yellow=createYellowNoteCatch({canvas,getProject:()=>doc,getPlayer:()=>player,getFacing:()=>facing,setFacing:value=>{facing=value;},catalog:new Map(),inventory,canUseNet:()=>enabled,isEquipped:()=>equipped,getLimit:()=>limit});yellow.tick(new Set(),0);
  function approach(token){
   const point={x:token.x,y:token.y-80},progress=motion.NET_STRIKE_FRACTION??.59;
   for(const direction of ['right','left','up','down']){
    const angle=motion.facingAngle(direction),offset=motion.netSweepPose({x:0,y:0},angle,progress),candidate={x:point.x-offset.x,y:point.y-offset.y};
    if(Array.from({length:32},(_,i)=>({x:candidate.x+(token.x-candidate.x)*i/31,y:candidate.y+(token.y-candidate.y)*i/31})).every(p=>!blocked(doc,p.x,p.y,new Map()))){Object.assign(player,candidate);return {angle,point};}
   }
   throw Error('The yellow fairy needs a physically clear approach');
  }
  return run({yellow,doc,player,inventory,data,approach,get saves(){return saves;},get facing(){return facing;},advance(seconds){now+=seconds;},disable(){enabled=false;},stow(){equipped=false;},equip(){equipped=true;},limit(value){limit=value;},hud:document.body.children[0]});
 }finally{Object.assign(globalThis,old);}
}
const event=key=>({key,repeat:false,preventDefault(){}});

test('five yellow fairies save catches, replenish within five slots, and preserve the map',()=>fixture(f=>{
 const initial=f.yellow.state.tokens;assert.equal(initial.length,5);assert(initial.every(token=>token.color==='yellow'&&['quarter','eighth-pair','sixteenth-group'].includes(token.value)));assert.equal(f.hud.all().filter(node=>node.className==='yellow-note-count').length,3);const before=JSON.stringify(f.doc),token=initial[0],{angle}=f.approach(token);
 assert(f.yellow.catchAlongSweep(f.player,angle,0,1));assert.equal(f.inventory.counts[token.value],1);assert.equal(f.saves,1);assert.equal(f.yellow.state.tokens.length,4);
 for(let i=0;i<242;i++)f.yellow.tick(new Set(),.05);assert.equal(f.yellow.state.tokens.length,5);assert(f.yellow.state.tokens.every(token=>token.value!=='quarter-rest'));assert.equal(f.inventory.total,1);assert.equal(JSON.stringify(f.doc),before);
}));

test('blue fairies reserve island slots immediately in drawing, state and catching',()=>fixture(f=>{
 const ids=f.yellow.state.tokens.map(token=>token.id);f.limit(1);assert.equal(f.yellow.state.tokens.length,1);assert.equal(f.yellow.state.tokens[0].id,ids[0]);
 const token=f.yellow.state.tokens[0],{angle}=f.approach(token);f.limit(0);assert.equal(f.yellow.state.tokens.length,0);assert.equal(f.yellow.catchAlongSweep(f.player,angle,0,1),false);assert.equal(f.inventory.total,0);
 f.limit(1);assert(f.yellow.catchAlongSweep(f.player,angle,0,1));assert.equal(f.yellow.state.tokens.length,0,'A caught limited slot waits to respawn instead of teleporting another fairy into it');
 f.limit(4);assert.equal(f.yellow.state.tokens.length,3);for(let i=0;i<242;i++)f.yellow.tick(new Set(),.05);assert.equal(f.yellow.state.tokens.length,4);f.limit(100);assert.equal(f.yellow.state.tokens.length,5);assert.equal(f.inventory.total,1);
}));

test('stowing gates F, pointer, catches and net drawing without losing the saved inventory',()=>fixture(f=>{
 const token=f.yellow.state.tokens[0],{angle}=f.approach(token);f.stow();assert.equal(f.yellow.state.equipped,false);assert.equal(f.yellow.keydown(event('f')),true);assert.equal(f.yellow.state.swing,null);assert.equal(f.yellow.catchAlongSweep(f.player,angle,0,1),false);
 assert.equal(f.yellow.pointer({button:0,clientX:10,clientY:10,preventDefault(){}}),true);assert.equal(f.yellow.state.swing,null);const c=ink();f.yellow.draw(c,{x:f.player.x,y:f.player.y,zoom:1},0);assert(!c.strokes.includes('#5d412b'));assert(c.ellipses.every(args=>args[2]<25&&args[3]<25),'Bare fairy glyphs must not regain large circular badges');
 f.equip();f.yellow.keydown(event('f'));assert(f.yellow.state.swing);f.stow();f.yellow.cancelSwing();assert.equal(f.yellow.state.swing,null);assert.equal(f.yellow.swingFacing,null);assert.equal(f.inventory.total,0);
 assert(!f.hud.all().some(node=>node.tagName==='button'),'The compact inventory must have no old Swing/Replay action buttons');
}));

test('WASD sets facing immediately and mouse clicks swing that facing rather than aiming at the pointer',()=>fixture(f=>{
 assert.equal(f.yellow.keydown(event('w')),false);assert.equal(f.facing,'up');assert.equal(f.yellow.keydown(event('f')),true);assert.equal(f.yellow.state.swing.angle,-Math.PI/2);assert.equal(f.yellow.swingFacing,'up');
 f.advance(motion.NET_SWEEP_SECONDS);f.yellow.tick(new Set(),0);f.yellow.keydown(event('d'));assert.equal(f.facing,'up','The avatar holds its facing through overhead follow-through');f.advance(motion.NET_RECOVERY_SECONDS+.01);f.yellow.tick(new Set(),0);
 f.yellow.keydown(event('d'));assert.equal(f.facing,'right');f.yellow.pointer({button:0,clientX:-10000,clientY:-10000,preventDefault(){}});assert.equal(f.yellow.state.swing.angle,0);assert.equal(f.yellow.swingFacing,'right');
 assert.equal(f.yellow.keydown({...event('f'),ctrlKey:true}),false);assert.equal(f.yellow.keydown(event('e')),false);f.disable();f.yellow.tick(new Set(),.016);assert.equal(f.yellow.state.swing,null);assert.equal(f.yellow.swingFacing,null);assert.equal(f.yellow.keydown(event('f')),false);f.yellow.hide();assert(f.hud.hidden);
}));

test('a solid wall stops a yellow catch even when the fairy lies inside the visible net mouth',()=>fixture(f=>{
 const token=f.yellow.state.tokens[0],{angle,point}=f.approach(token);assert(motion.netSweepHits(point,f.player,angle,0,1));
 const x=Math.round((token.x+f.player.x)/128);f.doc.edges={};for(let y=Math.floor((Math.min(token.y,f.player.y)-64)/64);y<=Math.ceil((Math.max(token.y,f.player.y)+64)/64);y++)f.doc.edges[`v:${x}:${y}`]={style:'iron',gate:false,open:false};
 assert.equal(f.yellow.catchAlongSweep(f.player,angle,0,1),false);assert.equal(f.inventory.total,0);
}));
