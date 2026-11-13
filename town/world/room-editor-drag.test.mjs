import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {getInteriorVisualBounds} from './wide-room-shell.mjs';

class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.value='';this.listeners=new Map();this.classList={add(){},remove(){}};this.captured=new Set();}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=[...children];}
 setAttribute(){}
 get options(){return this.children.filter(e=>e.tagName==='OPTION');}
 addEventListener(type,fn){this.listeners.set(type,fn);}
 focus(){}
 getBoundingClientRect(){return {left:0,top:0,width:600,height:500};}
 setPointerCapture(id){this.captured.add(id);}
 hasPointerCapture(id){return this.captured.has(id);}
 releasePointerCapture(id){this.captured.delete(id);this.listeners.get('lostpointercapture')?.({pointerId:id});}
}
async function fixture(){
 const canvas=new Element('canvas'),events=new Map(),counts={saves:0,commits:0},scene={width:600,height:500,items:[{id:'chair-1',asset:'chair',x:250,y:300,w:40,h:60,rotation:0,solid:true}],actors:[]};let held=null,revision=0;
 const model={get scene(){return scene;},get held(){return held;},get revision(){return revision;},get canUndo(){return revision>0;},get canRedo(){return false;},record:()=>({placements:scene.items.map(i=>({...i}))}),pick(p){const item={...scene.items[0]};held={item,originalId:item.id,companions:[],boxes:[],valid:true,offset:{x:p.x-item.x,y:p.y-item.y}};return {ok:true};},move(p){held.item.x=p.x-held.offset.x;held.item.y=p.y-held.offset.y;held.valid=held.item.x>=40;held.reason=held.valid?'':'Blocked';return {ok:held.valid};},place(p){if(p)this.move(p);if(!held.valid)return {ok:false,error:'Blocked'};scene.items[0]={...held.item};held=null;revision++;counts.commits++;return {ok:true,changed:true};},cancel(){held=null;return {ok:true,changed:false};}};
 const source=readFileSync(new URL('../builder/room-editor.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export function ','function ')+'\n({createRoomEditor})',catalog=new Map([['chair',{id:'chair',name:'Chair',w:40,h:60}]]),document={body:new Element('body'),createElement:tag=>new Element(tag)};
 const context={document,performance:{now:()=>0},setTimeout,clearTimeout,SHOWROOMS:[],residents:[],getInteriorVisualBounds,createRoomLayoutModel:()=>model,createRoomLayoutStorage(){throw Error('Use the supplied store');},cardinalFacing:rotation=>rotation===90?'west':'south',furnitureFacingBounds:(_a,i)=>({x:i.x-i.w/2,y:i.y-i.h,w:i.w,h:i.h}),assetFilter:()=> 'none',addEventListener:(type,fn)=>events.set(type,fn)};
 const {createRoomEditor}=runInNewContext(source,context),editor=createRoomEditor({canvas,catalog,renderRoom(){},getBaseModel:()=>scene,getThemes:()=>[{id:'test',owner:'test',label:'Test',group:'Rooms',scene:{kind:'showroom'}}],storage:{load:()=>({ok:true,record:null}),save(){counts.saves++;return {ok:true};}}});assert.equal(await editor.open('test'),true,'The editor must finish opening and fitting the room');
 const pointer=(type,x,y,id=1,button=0)=>{const e={type,clientX:x,clientY:y,pointerId:id,button,preventDefault(){}};editor.handlePointer(e);return e;},start={x:255.6,y:267.76};
 return {editor,model,canvas,events,counts,pointer,start};
}
test('an ordinary click still holds furniture for a later click to place',async()=>{
 const f=await fixture();f.pointer('pointerdown',f.start.x,f.start.y);f.pointer('pointerup',f.start.x,f.start.y);assert(f.model.held);assert.equal(f.counts.saves,0);f.pointer('pointermove',f.start.x+60,f.start.y+40);assert(f.model.held);f.pointer('pointerdown',f.start.x+60,f.start.y+40);f.pointer('pointerup',f.start.x+60,f.start.y+40);assert.equal(f.model.held,null);assert.deepEqual(f.counts,{saves:1,commits:1});
});
test('a fresh pickup dragged more than four CSS pixels commits once on release',async()=>{
 const f=await fixture(),zoom=f.editor.view.zoom;f.pointer('pointerdown',f.start.x,f.start.y);f.pointer('pointermove',f.start.x+60,f.start.y+40);assert.equal(f.counts.saves,0);f.pointer('pointerup',f.start.x+60,f.start.y+40);assert.equal(f.model.held,null);assert.deepEqual(f.counts,{saves:1,commits:1});assert(Math.abs(f.model.scene.items[0].x-(250+60/zoom))<1e-8);assert(Math.abs(f.model.scene.items[0].y-(300+40/zoom))<1e-8);f.pointer('pointerup',f.start.x+60,f.start.y+40);assert.equal(f.counts.saves,1);
});
test('small click motion and rejected drops stay held without saving',async()=>{
 for(const [dx,dy]of [[3,0],[-240,0]]){const f=await fixture();f.pointer('pointerdown',f.start.x,f.start.y);f.pointer('pointermove',f.start.x+dx,f.start.y+dy);f.pointer('pointerup',f.start.x+dx,f.start.y+dy);assert(f.model.held);assert.equal(f.counts.saves,0);assert.equal(f.counts.commits,0);}
});
test('canceled or interrupted drags never turn a later pointer release into a save',async()=>{
 for(const ending of ['cancel','capture','escape','space','pan','blur','close','second-pointer']){
  const f=await fixture();f.pointer('pointerdown',f.start.x,f.start.y);f.pointer('pointermove',f.start.x+60,f.start.y+40);
  if(ending==='cancel')f.pointer('pointercancel',f.start.x+60,f.start.y+40);
  if(ending==='capture')f.canvas.listeners.get('lostpointercapture')({pointerId:1});
  if(ending==='escape'||ending==='space')f.editor.keydown({key:ending==='escape'?'Escape':' ',preventDefault(){}});
  if(ending==='pan')f.pointer('pointerdown',f.start.x+60,f.start.y+40,1,2);
  if(ending==='second-pointer')f.pointer('pointerdown',f.start.x+80,f.start.y+40,2);
  if(ending==='blur')f.events.get('blur')();if(ending==='close')f.editor.close();
  f.pointer('pointerup',f.start.x+60,f.start.y+40);assert.equal(f.counts.saves,0,ending);assert.equal(f.counts.commits,0,ending);
 }
});
