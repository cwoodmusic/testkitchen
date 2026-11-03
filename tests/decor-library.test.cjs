'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const library=require('../decor-library.js');

test('the library retains its original decor and adds separate lounge furniture, rugs and counter art',()=>{
 assert.equal(library.items.length,91);assert.equal(new Set(library.items.map(item=>item.id)).size,91);
 assert.deepEqual(library.items.reduce((counts,item)=>(counts[item.category]=(counts[item.category]||0)+1,counts),{}),{floor:16,tabletop:22,wall:19,rug:11,furniture:23});
 for(const item of library.items){
  assert.match(item.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);assert.ok(item.name.length>3);
  assert.ok(Number.isInteger(item.width)&&Number.isInteger(item.height)&&item.width>=16&&item.height>=18&&item.width<=400&&item.height<=200);
  if(!['rug','furniture'].includes(item.category))assert.ok(item.width<=100&&item.height<=105);
  if(item.category==='rug')assert.ok(item.width<=360);
  if(item.category==='floor')assert.ok(item.height>=80);if(item.category==='tabletop')assert.ok(item.width<=36&&item.height<=32);
  if(item.category==='rug')assert.match(item.id,/^rug-/);
  assert.ok(Object.isFrozen(item));
 }
 assert.equal(library.items.slice(0,40).some(item=>item.category==='rug'),false,'The original catalog remains in its existing order');
 const rugs=library.items.filter(item=>item.category==='rug');
 assert.ok(rugs.some(item=>item.width/item.height>2),'Include a wide shop rug');
 const runner=rugs.find(item=>item.id==='rug-lightning-runner');assert.ok(runner.width/runner.height>2,'Include a long runner that can be quarter-turned');
 assert.ok(Object.isFrozen(library.items));
});

test('south-facing furniture is appended without changing the original forty-eight catalog entries',()=>{
 assert.deepEqual(library.items.slice(0,48).reduce((counts,item)=>(counts[item.category]=(counts[item.category]||0)+1,counts),{}),{floor:16,tabletop:16,wall:8,rug:8});
 assert.deepEqual(library.items.slice(48,55).map(({id,category,width,height})=>[id,category,width,height]),[
  ['sofa-south','furniture',164,131],['sofa-compact-south','furniture',162,109],['sofa-lounge-south','furniture',288,105],
  ['counter-jade-south','furniture',361,142],['counter-boutique-south','furniture',127,81],['desk-dj-south','furniture',121,62],['table-candle-south','furniture',86,70]
 ]);
});

class Element{
 constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.dataset={};this.value='';this.disabled=false;this.hidden=false;}
 append(...nodes){this.children.push(...nodes);}
 setAttribute(key,value){this[key]=value;}
 remove(){this.removed=true;}
}
function fixture(){
 let editable=true,callback=async()=>true;
 const pending=[],calls=[],draws=[];
 const win={setTimeout,clearTimeout,Image:class{
  constructor(){this.naturalWidth=160;this.naturalHeight=240;}
  set src(value){this.url=value;pending.push(this);}
 }};
 const doc={defaultView:win,createTextNode:text=>({textContent:text}),createElement(tag){
  const node=new Element(tag,doc);
  if(tag==='canvas'){node.getContext=()=>({drawImage:image=>draws.push(image)});node.toDataURL=()=> 'data:image/png;base64,AQID';}
  return node;
 }};
 const host=new Element('div',doc),control=library.mount({host,canEdit:()=>editable,onAdd:async item=>{calls.push(item);return callback(item);}});
 const find=(key,value)=>{let result;const visit=node=>{if(Object.hasOwn(node.dataset||{},key)&&(value===undefined||node.dataset[key]===value))result=node;for(const child of node.children||[])visit(child);};visit(host);return result;};
 const resolve=()=>{const image=pending.shift();assert.ok(image,'Expected an explicit Add request');image.onload();};
 return {control,calls,pending,draws,find,resolve,setEditable(value){editable=value;control.refresh();},setCallback(value){callback=value;}};
}

test('browsing never places decor and Add creates one independent source image with proportionate size',async()=>{
 const value=fixture();assert.equal(value.control.getState().selected,null);assert.equal(value.calls.length,0);assert.equal(value.pending.length,0);
 assert.equal(value.control.select('neon-jukebox'),true);assert.equal(value.calls.length,0);assert.equal(value.pending.length,0);
 const adding=value.control.addSelected();assert.equal(value.control.getState().busy,true);assert.equal(await value.control.addSelected(),false);
 value.resolve();assert.equal(await adding,true);assert.equal(value.calls.length,1);assert.equal(value.draws.length,1);
 assert.deepEqual(value.calls[0],{id:'neon-jukebox',name:'Neon jukebox',category:'floor',width:64,height:96,data:'data:image/png;base64,AQID'});
 assert.equal(value.control.getState().busy,false);assert.equal(value.control.getState().selected,'neon-jukebox');value.control.destroy();
});

test('rug filtering and Add identify floor placement while preserving the source image proportions',async()=>{
 const value=fixture();value.find('decorCategory').value='rug';value.find('decorCategory').onchange();
 assert.equal(value.control.getState().visible,11);assert.equal(value.calls.length,0);
 assert.equal(value.control.select('rug-notes-rectangle'),true);
 const adding=value.control.addSelected();value.pending[0].naturalWidth=720;value.pending[0].naturalHeight=280;value.resolve();
 assert.equal(await adding,true);assert.deepEqual(value.calls[0],{id:'rug-notes-rectangle',name:'Notes shop arcade rug',category:'rug',width:360,height:140,data:'data:image/png;base64,AQID'});
 value.find('decorSearch').value='round';value.find('decorSearch').oninput();
 assert.equal(value.control.getState().visible,1);assert.equal(value.control.getState().selected,null);
 value.control.destroy();
});

test('hand-drawn cards, previews and added images use the same versioned source',async()=>{
 const value=fixture(),url=library.imageURL('counter-jade-south');
 assert.match(url,/handdrawn\/v1\/counter-jade-south\.png\?v=/);
 assert.equal(value.find('decorItem','counter-jade-south').children[0].src,url);
 assert.equal(value.find('decorItem','sofa-south').children[0].src,library.imageURL('sofa-south'));
 assert.equal(value.control.select('counter-jade-south'),true);
 assert.equal(value.find('decorPreview').children[0].src,url);
 const adding=value.control.addSelected();assert.equal(value.pending[0].url,url);
 value.pending[0].naturalWidth=361;value.pending[0].naturalHeight=142;value.resolve();
 assert.equal(await adding,true);assert.equal(value.calls[0].data,'data:image/png;base64,AQID');
 assert.deepEqual([value.calls[0].width,value.calls[0].height],[361,142]);value.control.destroy();
});

test('furniture filtering is a preview and each added sofa is an independent embedded copy',async()=>{
 const value=fixture();value.find('decorCategory').value='furniture';value.find('decorCategory').onchange();
 assert.equal(value.control.getState().visible,23);assert.equal(value.calls.length,0);
 value.find('decorSearch').value='sofa';value.find('decorSearch').oninput();
 assert.equal(value.control.getState().visible,3);assert.equal(value.control.select('sofa-south'),true);assert.equal(value.calls.length,0);
 for(let count=0;count<2;count++){
  const adding=value.control.addSelected();value.pending[0].naturalWidth=164;value.pending[0].naturalHeight=131;value.resolve();assert.equal(await adding,true);
 }
 assert.equal(value.calls.length,2);assert.notEqual(value.calls[0],value.calls[1]);
 assert.deepEqual(value.calls[0],{id:'sofa-south',name:'South-facing sofa',category:'furniture',width:164,height:131,data:'data:image/png;base64,AQID'});
 value.calls[0].width=100;value.calls[0].name='My sofa';
 assert.equal(value.calls[1].width,164);assert.equal(value.calls[1].name,'South-facing sofa');
 assert.equal(library.items.find(item=>item.id==='sofa-south').width,164);value.control.destroy();
});

test('filtering is a preview action and clears a hidden selection instead of placing a stale item',()=>{
 const value=fixture();value.control.select('rocket-statue');
 value.find('decorCategory').value='tabletop';value.find('decorCategory').onchange();
 assert.equal(value.control.getState().visible,22);assert.equal(value.control.getState().selected,null);assert.equal(value.calls.length,0);
 value.find('decorSearch').value='token';value.find('decorSearch').oninput();assert.equal(value.control.getState().visible,1);
 value.find('decorSearch').value='no matching decor';value.find('decorSearch').oninput();assert.equal(value.control.getState().visible,0);assert.equal(value.find('decorAdd').disabled,true);value.control.destroy();
});

test('revoked editing or disposal during image loading cannot add a scene asset',async()=>{
 for(const close of [value=>value.setEditable(false),value=>value.control.destroy()]){
  const value=fixture();value.control.select('mini-cabinet');const adding=value.control.addSelected();close(value);value.resolve();assert.equal(await adding,false);assert.equal(value.calls.length,0);value.control.destroy();
 }
});

test('image and placement failures keep the library usable without duplicate scene mutations',async()=>{
 const value=fixture();value.control.select('succulent');let adding=value.control.addSelected();value.pending.shift().onerror();assert.equal(await adding,false);assert.equal(value.calls.length,0);assert.equal(value.control.getState().busy,false);
 value.setCallback(async()=>false);adding=value.control.addSelected();value.resolve();assert.equal(await adding,false);assert.equal(value.calls.length,1);assert.equal(value.control.getState().busy,false);assert.equal(value.find('decorStatus').dataset.error,'true');
 value.setCallback(async()=>true);adding=value.control.addSelected();value.resolve();assert.equal(await adding,true);assert.equal(value.calls.length,2);value.control.destroy();
});
