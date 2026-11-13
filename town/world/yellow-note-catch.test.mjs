import test from 'node:test';
import assert from 'node:assert/strict';
import {createYellowNoteCatch} from './yellow-note-catch.mjs';
import {createNoteInventory,normalizeYellowNotes} from './note-inventory.mjs';

class Element{
 constructor(){this.children=[];this.hidden=false;this.attrs={};this.count={textContent:''};}
 append(...items){this.children.push(...items);}
 setAttribute(key,value){this.attrs[key]=value;}
 querySelector(){return this.count;}
}
function fixture(run){
 const old={document:globalThis.document,window:globalThis.window,matchMedia:globalThis.matchMedia,performance:globalThis.performance};let now=0;
 globalThis.document={createElement:()=>new Element(),body:new Element()};globalThis.window={addEventListener(){}};globalThis.matchMedia=()=>({matches:true});globalThis.performance={now:()=>now*1000};
 try{
  const doc={version:1,cells:{},edges:{},objects:[],spawn:{x:1344,y:1344}};for(let i=0;i<43;i++)for(const [x,y]of [[i,0],[i,42],[0,i],[42,i]])doc.cells[`${x},${y}`]={surface:'water',level:0};
  let facing='down',enabled=true;const player={...doc.spawn},data={stars:0,yellowNotes:normalizeYellowNotes(),npcRhythmWins:{}};let saves=0;const inventory=createNoteInventory({data,save(){saves++;return true;}}),canvas={focus(){},clientWidth:1000,clientHeight:1000,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:1000})};
  const yellow=createYellowNoteCatch({canvas,getProject:()=>doc,getPlayer:()=>player,getFacing:()=>facing,setFacing:value=>{facing=value;},catalog:new Map(),inventory,canUseNet:()=>enabled});yellow.tick(new Set(),0);
  return run({yellow,doc,player,inventory,data,get saves(){return saves;},get facing(){return facing;},advance(seconds){now+=seconds;},disable(){enabled=false;},hud:document.body.children[0]});
 }finally{Object.assign(globalThis,old);}
}
test('yellow notes exist without a vendor quest, save catches, replenish, and never change the map',()=>fixture(f=>{
 const initial=f.yellow.state.tokens;assert.equal(initial.length,96);assert(initial.every(token=>token.color==='yellow'));const before=JSON.stringify(f.doc),token=initial[0];Object.assign(f.player,{x:token.x-132,y:token.y-50});
 assert(f.yellow.catchAlongSweep(f.player,0,0,1));assert.equal(f.inventory.counts[token.value],1);assert.equal(f.saves,1);assert.equal(f.yellow.state.tokens.length,95);
 for(let i=0;i<242;i++)f.yellow.tick(new Set(),.05);assert.equal(f.yellow.state.tokens.length,96);assert.equal(f.inventory.total,1);assert.equal(JSON.stringify(f.doc),before);
}));
test('a direction key immediately before F chooses the same facing as the character',()=>fixture(f=>{
 const event=key=>({key,repeat:false,preventDefault(){}});assert.equal(f.yellow.keydown(event('w')),false);assert.equal(f.facing,'up');assert.equal(f.yellow.keydown(event('f')),true);assert.equal(f.yellow.state.swing.angle,-Math.PI/2);assert.equal(f.yellow.swingFacing,'up');
 f.advance(.6);f.yellow.tick(new Set(),0);f.yellow.keydown(event('d'));f.yellow.keydown(event('f'));assert.equal(f.yellow.state.swing.angle,0);assert.equal(f.yellow.swingFacing,'right');
 f.disable();f.yellow.tick(new Set(),.016);assert.equal(f.yellow.state.swing,null);assert.equal(f.yellow.swingFacing,null);assert.equal(f.yellow.keydown(event('f')),false);f.yellow.hide();assert(f.hud.hidden);
}));
test('a solid wall stops a yellow catch even if its card falls inside the rendered net arc',()=>fixture(f=>{
 const token=f.yellow.state.tokens[0];Object.assign(f.player,{x:token.x-132,y:token.y-50});
 // A vertical ordinary edge crosses the player-to-card segment.
 const x=Math.floor((token.x-60)/64);f.doc.edges={};for(let y=Math.floor((token.y-100)/64);y<=Math.ceil((token.y+100)/64);y++)f.doc.edges[`v:${x}:${y}`]={style:'iron',gate:false,open:false};
 assert.equal(f.yellow.catchAlongSweep(f.player,0,0,1),false);assert.equal(f.inventory.total,0);
}));
