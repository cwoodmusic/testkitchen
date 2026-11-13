import test from 'node:test';
import assert from 'node:assert/strict';
import {mountConcertControls} from './concert-controls.mjs';

class Target{
 constructor(){this.listeners=new Map();}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
 emit(type,extra={}){
  if(type==='click'&&this.disabled)return null;
  const event={type,target:this,bubbles:true,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...extra};
  for(let current=this;current;current=event.bubbles&&!event.stopped?current.parentElement||current.eventParent:null){for(const fn of [...(current.listeners?.get(type)||[])])fn.call(current,event);}
  if(type==='cancel'&&!event.defaultPrevented&&this.open)this.close();return event;
 }
 get listenerCount(){return [...this.listeners.values()].reduce((count,set)=>count+set.size,0);}
}
class Element extends Target{
 constructor(tag,document){
  super();this.tagName=tag.toUpperCase();this.ownerDocument=document;this.children=[];this.parentElement=null;this.attributes=new Map();this._text='';this._value='';this._hidden=false;this._disabled=false;this._open=false;this._className='';
  this.dataset=new Proxy({},{set:(target,key,value)=>{document.writes++;target[key]=String(value);return true;}});
  this.style=new Proxy({},{set:(target,key,value)=>{document.writes++;target[key]=value;return true;}});
  this.classList={contains:name=>this.className.split(/\s+/).includes(name),add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},remove:(...names)=>{this.className=this.className.split(/\s+/).filter(name=>!names.includes(name)).join(' ');}};
 }
 get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
 set textContent(value){this.ownerDocument.writes++;for(const child of this.children)child.parentElement=null;this.children=[];this._text=String(value);}
 get value(){return this._value;}set value(value){this.ownerDocument.writes++;this._value=String(value);}
 get className(){return this._className;}set className(value){this.ownerDocument.writes++;this._className=String(value);}
 get hidden(){return this._hidden;}set hidden(value){this.ownerDocument.writes++;this._hidden=Boolean(value);}
 get disabled(){return this._disabled;}set disabled(value){this.ownerDocument.writes++;this._disabled=Boolean(value);}
 get open(){return this._open;}set open(value){this.ownerDocument.writes++;this._open=Boolean(value);}
 get isConnected(){let node=this;while(node.parentElement)node=node.parentElement;return node===this.ownerDocument.documentElement;}
 append(...children){for(const child of children){child.remove();child.parentElement=this;this.children.push(child);}this.ownerDocument.writes++;}
 appendChild(child){this.append(child);return child;}
 insertBefore(child,before){if(before===null){this.append(child);return child;}const index=this.children.indexOf(before);assert(index>=0);child.remove();child.parentElement=this;this.children.splice(index,0,child);this.ownerDocument.writes++;return child;}
 prepend(...children){for(const child of [...children].reverse()){child.remove();child.parentElement=this;this.children.unshift(child);}this.ownerDocument.writes++;}
 replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this._text='';this.append(...children);}
 remove(){if(!this.parentElement)return;const parent=this.parentElement;parent.children=parent.children.filter(child=>child!==this);this.parentElement=null;this.ownerDocument.writes++;}
 setAttribute(name,value){this.ownerDocument.writes++;this.attributes.set(name,String(value));if(name==='open')this._open=true;}
 getAttribute(name){if(this.attributes.has(name))return this.attributes.get(name);if(name==='id')return this.id??null;if(name==='class')return this.className??null;if(name==='type')return this.type??null;if(name.startsWith('data-'))return this.dataset[name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]??null;return null;}
 removeAttribute(name){this.ownerDocument.writes++;this.attributes.delete(name);if(name==='open')this._open=false;}
 matches(selector){
  const attribute=selector.match(/\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]/),plain=selector.replace(/\[[^\]]+\]/g,'');
  if(attribute){const value=this.getAttribute(attribute[1]);if(value===null||attribute[2]!==undefined&&value!==attribute[2])return false;}
  const id=plain.match(/#([\w-]+)/);if(id&&this.id!==id[1])return false;
  for(const match of plain.matchAll(/\.([\w-]+)/g))if(!(this.className||'').split(/\s+/).includes(match[1]))return false;
  const tag=plain.match(/^[a-z][\w-]*/i);return !tag||this.tagName===tag[0].toUpperCase();
 }
 closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
 contains(node){for(let current=node;current;current=current.parentElement)if(current===this)return true;return false;}
 all(){return this.children.flatMap(child=>[child,...child.all()]);}
 querySelectorAll(selector){
  const parts=selector.trim().split(/\s+/),last=parts.at(-1);
  return this.all().filter(node=>node.matches(last)&&parts.slice(0,-1).reverse().every(part=>{node=node.parentElement;while(node&&!node.matches(part))node=node.parentElement;return Boolean(node);}));
 }
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 focus(){this.ownerDocument.activeElement=this;}
 showModal(){this.open=true;}
 close(){if(!this.open)return;this.open=false;this.emit('close',{bubbles:false});}
 getBoundingClientRect(){this.ownerDocument.rectReads++;return {left:180,top:80,right:1180,bottom:830,width:1000,height:750};}
}
class Document extends Target{
 constructor(){
  super();this.writes=0;this.rectReads=0;this.defaultView=new Target();this.defaultView.innerWidth=1440;this.defaultView.innerHeight=950;this.observers=[];
  const owner=this;this.defaultView.ResizeObserver=class{constructor(fn){this.fn=fn;this.disconnected=false;owner.observers.push(this);}observe(target){this.target=target;}disconnect(){this.disconnected=true;}};
  this.documentElement=new Element('html',this);this.documentElement.eventParent=this;this.eventParent=this.defaultView;this.head=new Element('head',this);this.body=new Element('body',this);this.documentElement.append(this.head,this.body);this.activeElement=this.body;
 }
 createElement(tag){return new Element(tag,this);}
 querySelectorAll(selector){return this.documentElement.querySelectorAll(selector);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 getElementById(id){return this.documentElement.all().find(node=>node.id===id)||null;}
}
const initialState=()=>({status:'playing',playing:true,wanted:true,muted:false,volume:.75,enabled:true,hasVenue:true,context:'town',category:'piano',trackId:'clair-de-lune',track:{id:'clair-de-lune',title:'Clair de lune',composer:'Claude Debussy',performer:'Recorded pianist'},currentTime:42.5,duration:180,destroyed:false});
function fixture({state={},onProgramme}={}){
 const document=new Document(),header=document.createElement('header'),toolbar=document.createElement('nav'),unrelated=document.createElement('button'),canvas=document.createElement('canvas');header.append(toolbar);toolbar.append(unrelated);document.body.append(header,canvas);canvas.focus();
 let current={...initialState(),...state};const subscribers=new Set(),calls={muted:[],volume:[],play:0,pause:0,retry:0,settings:0,programme:0},keys=new Set(['w']);
 const emit=patch=>{current={...current,...patch};for(const fn of [...subscribers])fn({...current},'test');};
 const concert={get state(){return {...current};},onChange(fn){subscribers.add(fn);fn({...current},'subscribe');return()=>subscribers.delete(fn);},setMuted(value){calls.muted.push(value);emit({muted:value});},setVolume(value){calls.volume.push(value);emit({volume:value});},play(){calls.play++;emit({wanted:true,playing:true,status:'playing'});return Promise.resolve(true);},pause(){calls.pause++;emit({wanted:false,playing:false,status:'paused'});},retry(){calls.retry++;emit({wanted:true,playing:true,status:'playing'});return Promise.resolve(true);}};
 const controls=mountConcertControls(concert,{canvas,toolbar,onSettingsOpen(){calls.settings++;keys.clear();},...(onProgramme===false?{}:{onProgramme(value){calls.programme++;onProgramme?.(value,controls,document);}})});
 const music=controls.musicButton,settings=controls.settingsButton,dialog=controls.settingsDialog,volume=dialog?.querySelector('input[type="range"]'),output=dialog?.querySelector('output'),button=className=>document.querySelector('.'+className);
 return {document,header,toolbar,unrelated,canvas,keys,concert,controls,music,settings,dialog,volume,output,calls,subscribers,emit,button,get state(){return current;}};
}
const audioCalls=calls=>({muted:[...calls.muted],volume:[...calls.volume],play:calls.play,pause:calls.pause,retry:calls.retry});

test('the passive track HUD shows title and composer while music and settings live in the header',()=>{
 const f=fixture();
 assert.equal(f.controls.element.hidden,false);assert.equal(f.controls.element.querySelector('.concert-controls__track').textContent,'Clair de lune');assert.equal(f.controls.element.querySelector('.concert-controls__composer').textContent,'Claude Debussy');
 assert.equal(f.controls.element.querySelectorAll('button').length,0);assert.equal(f.controls.element.querySelectorAll('input').length,0);assert.equal(f.music.textContent,'Music on');assert.equal(f.settings.textContent,'Settings');assert(f.toolbar.contains(f.music)&&f.toolbar.contains(f.settings));
 assert(f.music.closest('[data-concert-controls]'));assert(f.settings.closest('[data-concert-controls]'));assert(f.dialog.matches('[data-concert-controls]'));assert(f.volume.closest('[data-concert-controls]'));assert.equal(f.dialog.tagName,'DIALOG');assert.equal(f.dialog.open,false);
 assert.equal(f.document.querySelectorAll('input[type="range"]').length,1);assert(f.dialog.contains(f.volume));assert.equal(f.document.querySelectorAll('link[data-concert-controls-styles]').length,1);
 assert.equal(f.document.querySelectorAll('button').some(button=>/^Pause$|^Mute$|^Unmute$/.test(button.textContent)),false);f.controls.destroy();
});

test('Music off only persists muting and does not pause, seek or restart the current recording',()=>{
 const f=fixture(),track=f.state.track,time=f.state.currentTime;f.music.emit('click');
 assert.deepEqual(audioCalls(f.calls),{muted:[true],volume:[],play:0,pause:0,retry:0});assert.equal(f.state.wanted,true);assert.equal(f.state.playing,true);assert.equal(f.state.track,track);assert.equal(f.state.currentTime,time);assert.equal(f.music.textContent,'Music off');assert.equal(f.music.getAttribute('aria-pressed'),'false');f.controls.destroy();
});

test('Music on resumes or unlocks through play and retries an unavailable programme',()=>{
 for(const state of [{muted:true},{status:'paused',playing:false,wanted:false},{status:'locked',playing:false}]){
  const f=fixture({state}),track=f.state.track,time=f.state.currentTime;assert.equal(f.music.textContent,'Music off');assert.equal(f.music.disabled,false);f.music.emit('click');
  assert.deepEqual(audioCalls(f.calls),{muted:[false],volume:[],play:1,pause:0,retry:0});assert.equal(f.music.textContent,'Music on');assert.equal(f.state.track,track);assert.equal(f.state.currentTime,time);f.controls.destroy();
 }
 const f=fixture({state:{status:'unavailable',playing:false}});f.music.emit('click');assert.deepEqual(audioCalls(f.calls),{muted:[false],volume:[],play:0,pause:0,retry:1});assert.equal(f.music.textContent,'Music on');f.controls.destroy();
});

test('Music on reflects the listening preference through loading, intermission and hidden-page suspension',()=>{
 const f=fixture();for(const status of ['loading','intermission','suspended','ready']){f.emit({status,playing:false,wanted:true});assert.equal(f.music.textContent,'Music on',status);assert.equal(f.music.getAttribute('aria-pressed'),'true',status);}
 for(const status of ['locked','empty','unavailable','inactive']){f.emit({status,playing:false,wanted:true});assert.equal(f.music.textContent,'Music off',status);assert.equal(f.music.getAttribute('aria-pressed'),'false',status);}
 assert.deepEqual(audioCalls(f.calls),{muted:[],volume:[],play:0,pause:0,retry:0});f.controls.destroy();
});

test('Settings opens a native volume dialog without changing audio and Escape returns focus to its button',()=>{
 const f=fixture(),before=audioCalls(f.calls),track=f.state.track,time=f.state.currentTime;f.settings.emit('click');
 assert.equal(f.dialog.open,true);assert.equal(f.calls.settings,1);assert.equal(f.keys.size,0);assert.equal(f.document.activeElement,f.volume);assert.equal(f.settings.getAttribute('aria-expanded'),'true');assert.equal(f.settings.getAttribute('aria-controls'),f.dialog.id);assert.deepEqual(audioCalls(f.calls),before);assert.equal(f.state.track,track);assert.equal(f.state.currentTime,time);
 f.dialog.emit('cancel',{bubbles:false});assert.equal(f.dialog.open,false);assert.equal(f.document.activeElement,f.settings);assert.equal(f.settings.getAttribute('aria-expanded'),'false');assert.deepEqual(audioCalls(f.calls),before);
 f.settings.emit('click');f.button('concert-settings__close').emit('click');assert.equal(f.dialog.open,false);assert.equal(f.document.activeElement,f.settings);assert.equal(f.calls.settings,2);assert.deepEqual(audioCalls(f.calls),before);f.controls.destroy();
});

test('Settings remains available to save volume before the map has an Opera House or a playable programme',()=>{
 for(const state of [{hasVenue:false},{enabled:false},{status:'empty',wanted:false}]){
  const f=fixture({state});assert.equal(f.music.disabled,true);assert.equal(f.settings.disabled,false);f.music.emit('click');f.settings.emit('click');
  assert.equal(f.dialog.open,true);assert.equal(f.document.activeElement,f.volume);assert.equal(f.calls.settings,1);assert.deepEqual(audioCalls(f.calls),{muted:[],volume:[],play:0,pause:0,retry:0});
  f.volume.value='26';f.volume.emit('input');assert.deepEqual(f.calls.volume,[.26]);f.button('concert-settings__close').emit('click');
  f.emit({status:'destroyed',destroyed:true});assert.equal(f.settings.disabled,true);assert.equal(f.music.disabled,true);assert.equal(f.music.textContent,'Music off');assert.equal(f.controls.element.hidden,true);f.settings.emit('click');assert.equal(f.dialog.open,false);f.controls.destroy();
 }
});

test('volume changes update the shared player and subscribed values update both the slider and percentage',()=>{
 const f=fixture();f.settings.emit('click');assert.equal(f.volume.value,'75');assert.equal(f.output.textContent||f.output.value,'75%');
 f.volume.value='43';f.volume.emit('input');assert.deepEqual(f.calls.volume,[.43]);assert.equal(f.output.textContent||f.output.value,'43%');assert.match(f.volume.getAttribute('aria-valuetext'),/43/);
 f.emit({volume:.19});assert.equal(f.volume.value,'19');assert.equal(f.output.textContent||f.output.value,'19%');assert.deepEqual(f.calls.volume,[.43],'A subscribed update must not echo another input action');assert.equal(f.calls.play,0);assert.equal(f.calls.pause,0);assert.equal(f.calls.retry,0);f.controls.destroy();
});

test('control keydown stays out of walking while keyup still releases the game movement key',()=>{
 const f=fixture();let down=0,up=0;f.document.defaultView.addEventListener('keydown',()=>down++);f.document.defaultView.addEventListener('keyup',()=>up++);
 for(const control of [f.music,f.settings,f.volume]){control.emit('keydown',{key:'ArrowRight'});control.emit('keyup',{key:'ArrowRight'});}
 assert.equal(down,0);assert.equal(up,3);f.controls.destroy();
});

test('opening credits closes Settings before handing control to the programme callback',()=>{
 const observed=[];const f=fixture({onProgramme(state,controls){observed.push({open:controls.settingsDialog.open,trackId:state.trackId});}});f.settings.emit('click');f.button('concert-controls__programme').emit('click');
 assert.equal(f.calls.programme,1);assert.deepEqual(observed,[{open:false,trackId:'clair-de-lune'}]);assert.deepEqual(audioCalls(f.calls),{muted:[],volume:[],play:0,pause:0,retry:0});f.controls.destroy();
 const optional=fixture({onProgramme:false}),programme=optional.button('concert-controls__programme');assert(!programme||programme.hidden);optional.controls.destroy();
});

test('time-only updates cause no DOM writes, rebuilds, layout reads or repeated live announcements',()=>{
 const f=fixture(),writes=f.document.writes,reads=f.document.rectReads,nodes=f.controls.element.all(),dialogNodes=f.dialog.all();
 for(let currentTime=43;currentTime<543;currentTime++)f.emit({currentTime,duration:180});
 assert.equal(f.document.writes,writes);assert.equal(f.document.rectReads,reads);assert.deepEqual(f.controls.element.all(),nodes);assert.deepEqual(f.dialog.all(),dialogNodes);assert.equal(f.controls.state.currentTime,542);
 f.emit({trackId:'new-track',track:{title:'New programme',composer:'New composer',performer:'New artist'}});assert.equal(f.controls.element.querySelector('.concert-controls__track').textContent,'New programme');assert.equal(f.controls.element.querySelector('.concert-controls__composer').textContent,'New composer');assert.equal(f.volume,dialogNodes.find(node=>node===f.volume));f.controls.destroy();
});

test('destroy removes owned UI and listeners while preserving the supplied header and shared stylesheet',()=>{
 const f=fixture();f.settings.emit('click');const buttons=[f.music,f.settings,f.button('concert-controls__programme'),f.button('concert-settings__close')],before=audioCalls(f.calls);assert.equal(f.subscribers.size,1);assert(f.document.defaultView.listenerCount>0);assert.equal(f.document.observers.length,1);
 f.controls.destroy();f.controls.destroy();assert.equal(f.subscribers.size,0);assert.equal(f.document.defaultView.listenerCount,0);assert(f.document.observers[0].disconnected);assert.equal(f.controls.element.isConnected,false);assert.equal(f.dialog.isConnected,false);assert.equal(f.music.isConnected,false);assert.equal(f.settings.isConnected,false);assert(f.toolbar.contains(f.unrelated));assert(f.toolbar.isConnected);assert.equal(f.document.querySelectorAll('link[data-concert-controls-styles]').length,1);
 for(const button of buttons)if(button)button.emit('click');f.volume.emit('input');f.emit({status:'playing',volume:.1});assert.deepEqual(audioCalls(f.calls),before);assert.equal(f.calls.programme,0);
 const second=mountConcertControls(f.concert,{canvas:f.canvas,toolbar:f.toolbar});assert.equal(f.document.querySelectorAll('link[data-concert-controls-styles]').length,1);second.destroy();
});
