const test=require('node:test'),assert=require('node:assert/strict');
const dialogue=require('../dialogue-text.js');
class Element{
 constructor(doc,tag='p'){this.ownerDocument=doc;this.tagName=tag.toUpperCase();this.children=[];this.style={};this.attributes=new Map();this.events=new Map();this.isConnected=true;this.parent=null;}
 get textContent(){return this.children.map(child=>typeof child==='string'?child:child.textContent).join('');}
 set textContent(value){this.children=[String(value)];}
 append(...nodes){for(const node of nodes){if(node.fragment)this.append(...node.children);else{if(typeof node!=='string')node.parent=this;this.children.push(node);}}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 setAttribute(key,value){this.attributes.set(key,String(value));}
 getAttribute(key){return this.attributes.get(key)??null;}
 removeAttribute(key){this.attributes.delete(key);}
 addEventListener(type,listener){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(listener);}
 removeEventListener(type,listener){this.events.get(type)?.delete(listener);}
 dispatch(type){for(const fn of Array.from(this.events.get(type)||[]))fn({target:this});}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.isConnected=false;}
}
function fixture({saved,blocked=false,reduced=false}={}){
 const document={createElement:tag=>new Element(document,tag),createDocumentFragment:()=>({fragment:true,children:[],append(node){this.children.push(node);}}),createTextNode:text=>String(text)};
 const frames=new Map(),values=new Map(saved===undefined?[]:[[dialogue.KEY,saved]]),media={matches:reduced,events:new Set(),addEventListener(type,fn){this.events.add(fn);},removeEventListener(type,fn){this.events.delete(fn);}};let serial=0,time=0;
 const storage={getItem(key){if(blocked)throw Error('privacy');return values.get(key)??null;},setItem(key,value){if(blocked)throw Error('quota');values.set(key,value);}};
 const api=dialogue.create({document,storage,window:{matchMedia:()=>media},now:()=>time,requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id)});
 return {api,document,frames,values,media,element:()=>document.createElement('p'),advance(next){time=next;const pending=Array.from(frames.values());frames.clear();for(const frame of pending)frame(next);}};
}
const visible=element=>element.children.filter(child=>typeof child!=='string'&&child.style.opacity!=='0').map(child=>child.textContent).join('');
test('dialogue paints at elapsed-time speed while preserving its exact accessible sentence and layout',()=>{
 const f=fixture(),element=f.element(),text='Hello there!';assert.equal(f.api.getSpeed(),'normal');assert.equal(f.api.show(element,text),true);
 assert.equal(element.textContent,text);assert.equal(element.children.length,text.length);assert.equal(visible(element),'H');
 f.advance(100);assert.equal(visible(element),'Hello');assert.equal(element.textContent,text);
 f.advance(1000);assert.equal(visible(element),text);assert.equal(f.api.isRevealing(element),false);assert.equal(f.frames.size,0);assert.equal(element.getAttribute('title'),null);
});
test('clicking finishes once, restores prior presentation, and does not leave a timer running',()=>{
 const f=fixture(),element=f.element();element.setAttribute('title','A musician');element.style.cursor='help';f.api.show(element,'The rest of this sentence.');
 element.dispatch('click');assert.equal(f.api.isRevealing(element),false);assert.equal(visible(element),element.textContent);assert.equal(f.api.finish(element),false);assert.equal(f.frames.size,0);
 assert.equal(element.getAttribute('title'),'A musician');assert.equal(element.style.cursor,'help');assert.equal(element.events.get('click').size,0);
});
test('a replacement message cancels the previous reveal and cannot append old letters',()=>{
 const f=fixture(),element=f.element();f.api.show(element,'An old line that will never finish.');f.advance(100);f.api.show(element,'New message');
 assert.equal(element.textContent,'New message');assert.equal(visible(element),'N');assert.equal(f.frames.size,1);f.advance(500);assert.equal(visible(element),'New message');
 f.api.show(element,'');assert.equal(element.textContent,'');assert.equal(f.frames.size,0);
});
test('changing speeds takes effect on active lines and Instant reveals every open conversation',()=>{
 const f=fixture(),a=f.element(),b=f.element();f.api.setSpeed('slow');f.api.show(a,'abcdefghijklmnopqrstuvwxyz');f.api.show(b,'ABCDEFGHIJKLMNOPQRSTUVWXYZ');f.advance(100);assert.equal(visible(a),'abc');
 f.api.setSpeed('fast');f.advance(200);assert.equal(visible(a),'abcdefghijk');assert.equal(f.api.setSpeed('instant'),true);assert.equal(visible(a),a.textContent);assert.equal(visible(b),b.textContent);assert.equal(f.frames.size,0);assert.equal(f.values.get(dialogue.KEY),'instant');
 assert.equal(f.api.setSpeed('__proto__'),false);assert.equal(f.api.getSpeed(),'instant');
});
test('explicit preferences persist across instances; reduced motion defaults to instant without overriding a choice',()=>{
 const f=fixture({reduced:true});assert.equal(f.api.getSpeed(),'instant');f.api.setSpeed('slow');assert.equal(f.api.getSpeed(),'slow');f.media.matches=false;for(const fn of f.media.events)fn();assert.equal(f.api.getSpeed(),'slow');
 assert.equal(fixture({saved:'fast',reduced:true}).api.getSpeed(),'fast');assert.equal(fixture({saved:'not-a-speed'}).api.getSpeed(),'normal');
 const follow=fixture({reduced:false});follow.media.matches=true;for(const fn of follow.media.events)fn();assert.equal(follow.api.getSpeed(),'instant');
});
test('blocked browser storage keeps usable in-memory settings and instant text has no animation markup',()=>{
 const f=fixture({blocked:true}),element=f.element();assert.equal(f.api.setSpeed('instant'),true);assert.equal(f.api.show(element,'<script>not markup</script>'),false);assert.equal(element.textContent,'<script>not markup</script>');assert.equal(element.children.length,1);assert.equal(f.frames.size,0);
 f.api.setSpeed('normal');assert.equal(f.api.show(element,'Still available'),true);
});
test('grapheme reveal keeps combining marks, family emoji, modifiers and flags intact',()=>{
 const text='A e\u0301 👩🏽‍🎨 🇺🇸 Z',expected=['A',' ','e\u0301',' ','👩🏽‍🎨',' ','🇺🇸',' ','Z'];
 assert.deepEqual(dialogue.graphemes(text),expected);assert.deepEqual(dialogue.graphemes(text,{}),expected);
 const f=fixture(),element=f.element();f.api.show(element,text);assert.deepEqual(element.children.map(span=>span.textContent),expected);f.advance(100);assert.equal(visible(element),'A e\u0301 👩🏽‍🎨');assert.equal(element.textContent,text);
});
test('closed or detached targets stop animation and destroy cancels all remaining work',()=>{
 const f=fixture(),a=f.element(),b=f.element();f.api.show(a,'A detached message');a.isConnected=false;f.advance(25);assert.equal(f.api.isRevealing(a),false);assert.equal(f.frames.size,0);
 f.api.show(b,'Another message');assert.equal(f.api.cancel(b),true);assert.equal(f.api.cancel(b),false);assert.equal(f.frames.size,0);assert.equal(visible(b),b.textContent);
 f.api.show(b,'One final message');f.api.destroy();assert.equal(f.api.isRevealing(b),false);assert.equal(f.frames.size,0);assert.equal(f.media.events.size,0);
});
test('settings controls synchronize across rooms, accept user changes, and can be removed cleanly',()=>{
 const f=fixture(),a=f.element(),b=f.element(),cleanA=f.api.mountSettings(a),cleanB=f.api.mountSettings(b);
 const selectA=a.children[0].children[1],selectB=b.children[0].children[1];assert.equal(selectA.getAttribute('aria-label'),'Dialogue text speed');assert.deepEqual(selectA.children.map(option=>option.value),['slow','normal','fast','instant']);
 selectA.value='slow';selectA.dispatch('change');assert.equal(f.api.getSpeed(),'slow');assert.equal(selectB.value,'slow');assert.equal(f.values.get(dialogue.KEY),'slow');
 cleanA();assert.equal(a.children.length,0);assert.equal(selectA.events.get('change').size,0);f.api.setSpeed('fast');assert.equal(selectB.value,'fast');f.api.destroy();assert.equal(b.children.length,0);assert.equal(selectB.events.get('change').size,0);cleanB();
});
