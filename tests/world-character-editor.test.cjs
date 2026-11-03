'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const editor=require('../world-character-editor.js');
const W=1672,H=941;

test('explicit layer order is portable and bounded for independent NPCs',()=>{
 for(const layerOrder of [-1000000,-.5,0,12.25,1000000]){
  const data={scholar:{layer:'front',layerOrder}};
  assert.equal(editor.validate(data,W,H),true);
  assert.equal(editor.resolve('scholar',JSON.parse(JSON.stringify(data)),W,H).layerOrder,layerOrder);
 }
 for(const layerOrder of [-1000001,1000001,NaN,Infinity,'2',null])assert.equal(editor.validate({riff:{layerOrder}},W,H),false);
});

test('independent NPC placements keep original sprite and interaction identities',()=>{
 const definitions=editor.defaults();assert.deepEqual(Object.keys(definitions),['scholar','riff','pip']);
 assert.deepEqual([definitions.scholar.x,definitions.scholar.y],[298,213]);
 const scholar=editor.resolve('scholar',{},W,H);assert.equal(scholar.activity,'relaxing');assert.equal(scholar.sortY,240);assert.deepEqual(scholar.approach,{x:298,y:302});
 assert.deepEqual(editor.resolve('riff',{},W,H).approaches,[{x:1352,y:430},{x:1352,y:610}]);
 assert.deepEqual(editor.resolve('pip',{},W,H).approaches,[{x:525,y:485}]);
 definitions.scholar.x=100;definitions.riff.approaches[0][0]=1;
 assert.equal(editor.defaults().scholar.x,298);assert.equal(editor.defaults().riff.approaches[0][0],1352,'Callers cannot mutate the baseline');
});

test('moving one NPC shifts its interaction locations independently and clamps map edges',()=>{
 const source={riff:{x:1402,y:500},scholar:{x:0,y:941},pip:{x:1660,y:900}};
 const riff=editor.resolve('riff',source,W,H);assert.deepEqual(riff.approaches,[{x:1402,y:450},{x:1402,y:630}]);
 const scholar=editor.resolve('scholar',source,W,H);assert.deepEqual(scholar.approach,{x:0,y:941});assert.equal(scholar.approachX,0);assert.equal(scholar.approachY,H);
 assert.deepEqual(editor.resolve('pip',source,W,H).approaches,[{x:1672,y:941}]);
 assert.equal(editor.resolve('riff',source,W,H).opacity,1);assert.equal(source.riff.x,1402);
});

test('NPC visibility, facing and authored depth remain explicit without furniture dependencies',()=>{
 assert.equal(editor.resolve('scholar',{scholar:{visible:false}},W,H).visible,false);
 assert.equal(editor.resolve('pip',{pip:{facing:'right',depthOffset:250}},W,H).sortY,668);
 assert.equal(editor.resolve('riff',{riff:{layer:'back',depthOffset:700}},W,H).sortY,-5000);
 assert.equal(editor.resolve('riff',{riff:{layer:'front',depthOffset:-700}},W,H).sortY,H+10000);
 assert.equal(editor.resolve('unknown',{},W,H),null);
});

test('project validation accepts partial edits and rejects unknown or unsafe character data',()=>{
 for(const value of [{},{scholar:{}},{riff:{x:0,y:H,depthOffset:-H,visible:false,layer:'front',facing:'left'}},{pip:{x:W,y:0,depthOffset:H}}])assert.equal(editor.validate(value,W,H),true);
 for(const value of [null,[],{unknown:{}},{scholar:null},{scholar:[]},{scholar:{x:-1}},{scholar:{x:W+1}},{scholar:{y:H+1}},{scholar:{x:NaN}},{scholar:{y:Infinity}},{scholar:{x:'1'}},{scholar:{x:undefined}},{riff:{visible:1}},{riff:{facing:'side'}},{riff:{layer:'foreground'}},{pip:{depthOffset:H+1}},{pip:{scale:2}},JSON.parse('{"__proto__":{}}')])assert.equal(editor.validate(value,W,H),false,JSON.stringify(value));
 assert.equal(editor.validate({},0,H),false);assert.equal(editor.validate({},W,Infinity),false);
 assert.equal(editor.resolve('scholar',{scholar:{x:-5}},W,H),null);
});

class Element{
 constructor(tag,document){this.tagName=tag.toUpperCase();this.ownerDocument=document;this.children=[];this.dataset={};this.hidden=false;this.value='';}
 append(...nodes){this.children.push(...nodes);}
 setAttribute(key,value){this[key]=value;}
 focus(){}
}
function fixture(){
 const doc={createElement(tag){return new Element(tag,doc);},createTextNode(text){return {textContent:text};}};
 const host=new Element('div',doc),canvas=new Element('canvas',doc);canvas.width=W;canvas.height=H;canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
 let data={},control;const saves=[],choices=[],focus=[];
 control=editor.create({host,canvas,width:W,height:H,toWorld:(x,y)=>({x,y}),getData:()=>data,setData:next=>{saves.push(next);data=next;},
  getStates:()=>Object.keys(editor.defaults()).map(id=>editor.resolve(id,{...data,...(control?.getPreview(id)?{[id]:{...(data[id]||{}),...control.getPreview(id)}}:{})},W,H)),
  canEdit:()=>fixture.enabled,onSelect:id=>choices.push(id),focusWorld:(x,y)=>focus.push([x,y])});
 const find=key=>{let result;const walk=node=>{if(node.dataset?.worldCharacter===key)result=node;for(const child of node.children||[])walk(child);};walk(host);return result;};
 fixture.enabled=true;
 return {control,saves,choices,focus,find,data:()=>data};
}
const pointer=(x,y,id=1)=>({button:0,clientX:x,clientY:y,pointerId:id,preventDefault(){}});

test('selecting an NPC leaves project data intact and drag commits exactly one portable position',()=>{
 const value=fixture();value.find('select').value='scholar';value.find('select').onchange();
 assert.equal(value.control.getSelected(),'scholar');assert.deepEqual(value.choices,['scholar']);assert.deepEqual(value.focus,[[298,213]]);assert.equal(value.saves.length,0);
 assert.equal(value.control.pointerDown(pointer(298,190)),true);value.control.pointerMove(pointer(398,290));
 assert.deepEqual(value.control.getPreview('scholar'),{x:398,y:313});assert.deepEqual(value.data(),{});assert.equal(value.saves.length,0);
 assert.equal(value.control.pointerEnd(pointer(398,290,2)),false,'Other pointer cannot end the drag');
 value.control.pointerEnd(pointer(398,290));assert.equal(value.saves.length,1);assert.deepEqual(value.data(),{scholar:{x:398,y:313}});assert.equal(value.control.getPreview('scholar'),null);
});

test('cancel and click preserve history, movement clamps, and editor gates stop mutations',()=>{
 const value=fixture();assert.equal(value.control.pointerDown(pointer(0,0)),false);
 value.control.pointerDown(pointer(1352,450));value.control.pointerEnd(pointer(1352,450));assert.equal(value.saves.length,0);
 value.control.pointerDown(pointer(1352,450));value.control.pointerMove(pointer(100,700));value.control.cancelGesture();assert.equal(value.saves.length,0);assert.deepEqual(value.data(),{});
 value.control.pointerDown(pointer(1352,450));value.control.pointerMove(pointer(-300,2000));assert.deepEqual(value.control.getPreview('riff'),{x:0,y:H});value.control.pointerEnd(pointer(-300,2000));assert.deepEqual(value.data(),{riff:{x:0,y:H}});
 fixture.enabled=false;assert.equal(value.control.pointerDown(pointer(513,400)),false);value.find('x').value='500';value.find('x').onchange();assert.equal(value.saves.length,1);fixture.enabled=true;
});

test('numeric edits and position reset retain NPC layer and facing choices',()=>{
 const value=fixture();value.find('select').value='pip';value.find('select').onchange();
 value.find('x').value='700';value.find('x').onchange();value.find('layer').value='front';value.find('layer').onchange();value.find('facing').value='up';value.find('facing').onchange();
 assert.deepEqual(value.data(),{pip:{x:700,layer:'front',facing:'up'}});
 value.find('reset').onclick();assert.deepEqual(value.data(),{pip:{layer:'front',facing:'up'}});assert.equal(value.find('x').value,'513');
 value.control.clearSelection();assert.equal(value.control.getSelected(),null);
});
