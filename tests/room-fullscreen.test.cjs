const test=require('node:test'),assert=require('node:assert/strict');
const {createCodaRoomFullscreen}=require('../room-fullscreen.js');

function fixture(native='none'){
 const target=()=>({listeners:new Map(),addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);},removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);},emit(type,event={}){for(const fn of this.listeners.get(type)||[])fn(event);}});
 function node(){const value=target(),classes=new Set();return Object.assign(value,{parentNode:null,nextSibling:null,children:[],dataset:{},attrs:{},classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)},setAttribute(name,value){this.attrs[name]=value;},appendChild(child){if(child.parentNode)child.parentNode.children.splice(child.parentNode.children.indexOf(child),1);this.children.push(child);child.parentNode=this;this.children.forEach((n,i)=>n.nextSibling=this.children[i+1]||null);},insertBefore(child,next){if(child.parentNode)child.parentNode.children.splice(child.parentNode.children.indexOf(child),1);this.children.splice(this.children.indexOf(next),0,child);child.parentNode=this;this.children.forEach((n,i)=>n.nextSibling=this.children[i+1]||null);}});}
 let now=1000,requested=0,exited=0,changes=0,clears=0,resizes=0,resolveRequest;
 const body=node(),host=node(),button=node(),controls=node(),after=node();body.appendChild(controls);body.appendChild(after);
 const win={performance:{now:()=>now},Event:class{constructor(type){this.type=type;}},dispatchEvent(event){if(event.type==='resize')resizes++;}};
 const doc=Object.assign(target(),{defaultView:win,fullscreenElement:null,querySelector:selector=>selector==='.coda-touch-controls'?controls:null});host.ownerDocument=doc;
 doc.exitFullscreen=()=>{exited++;doc.fullscreenElement=null;doc.emit('fullscreenchange');return Promise.resolve();};
 if(native!=='none')host.requestFullscreen=()=>{
  requested++;if(native==='reject')return Promise.reject(Error('Browser denied native mode'));
  if(native==='pending')return new Promise(resolve=>resolveRequest=()=>{doc.fullscreenElement=host;doc.emit('fullscreenchange');resolve();});
  doc.fullscreenElement=host;doc.emit('fullscreenchange');return Promise.resolve();
 };
 const fullscreen=createCodaRoomFullscreen({host,button,label:'Piano Lab',onChange:()=>changes++,onBeforeChange:()=>clears++});
 return {fullscreen,host,button,body,controls,after,doc,node,advance:ms=>now+=ms,resolveRequest:()=>resolveRequest(),counts:()=>({requested,exited,changes,clears,resizes})};
}

test('native fullscreen follows document state and carries the mobile controls into the room',async()=>{
 const f=fixture('native');await f.fullscreen.toggle();
 assert.deepEqual(f.fullscreen.getState(),{active:true,mode:'native',pending:false});assert.equal(f.doc.fullscreenElement,f.host);
 assert.equal(f.controls.parentNode,f.host);assert.equal(f.host.classList.contains('coda-room-native-fullscreen'),true);
 assert.equal(f.button.textContent,'Exit fullscreen');assert.equal(f.button.attrs['aria-pressed'],'true');assert.equal(f.counts().requested,1);
 await f.fullscreen.exit();assert.equal(f.doc.fullscreenElement,null);assert.equal(f.fullscreen.getState().active,false);
 assert.equal(f.controls.parentNode,f.body);assert.deepEqual(f.body.children,[f.controls,f.after]);assert.equal(f.button.textContent,'Fullscreen');
 assert.ok(f.counts().resizes>=2);assert.ok(f.counts().clears>=2);
});

test('unsupported and rejected requests use the explicit viewport fallback with working exit controls',async()=>{
 for(const native of ['none','reject']){
  const f=fixture(native);await f.fullscreen.toggle();
  assert.equal(f.fullscreen.getState().mode,'viewport');assert.equal(f.doc.fullscreenElement,null);
  assert.equal(f.host.dataset.roomFullscreen,'viewport');assert.ok(f.host.classList.contains('coda-room-viewport-fullscreen'));assert.equal(f.controls.parentNode,f.host);
  assert.equal(f.button.disabled,false);assert.match(f.button.title,/full-window/);
  let prevented=0,stopped=0;assert.equal(f.fullscreen.handleEscape({key:'Escape',preventDefault:()=>prevented++,stopPropagation:()=>stopped++}),true);
  assert.equal(prevented,1);assert.equal(stopped,1);assert.equal(f.fullscreen.getState().mode,'off');assert.equal(f.controls.parentNode,f.body);
  f.advance(500);assert.equal(f.fullscreen.handleEscape({key:'Escape'}),false);
 }
});

test('browser Escape exits native fullscreen without the same key closing the room',async()=>{
 const f=fixture('native');await f.fullscreen.toggle();
 await f.doc.exitFullscreen();assert.equal(f.fullscreen.getState().mode,'off');assert.equal(f.controls.parentNode,f.body);
 let prevented=false;assert.equal(f.fullscreen.handleEscape({key:'Escape',preventDefault:()=>prevented=true}),true);assert.equal(prevented,true);
 assert.equal(f.fullscreen.handleEscape({key:'Enter'}),false);f.advance(500);assert.equal(f.fullscreen.handleEscape({key:'Escape'}),false);
});

test('the helper captures fullscreen Escape before the surrounding room exit handler',async()=>{
 const f=fixture();await f.fullscreen.toggle();let prevented=0,stopped=0;
 f.doc.emit('keydown',{key:'Escape',preventDefault:()=>prevented++,stopPropagation:()=>stopped++});
 assert.equal(prevented,1);assert.equal(stopped,1);assert.equal(f.fullscreen.getState().mode,'off');
});

test('closing or destroying during a pending request cannot reopen fullscreen or strand controls',async()=>{
 for(const action of ['exit','destroy']){
  const f=fixture('pending'),entered=f.fullscreen.toggle();assert.equal(f.fullscreen.getState().pending,true);assert.equal(f.controls.parentNode,f.host);
  await f.fullscreen[action]();assert.equal(f.controls.parentNode,f.body);f.resolveRequest();await entered;
  assert.equal(f.doc.fullscreenElement,null);assert.deepEqual(f.fullscreen.getState(),{active:false,mode:'off',pending:false});assert.equal(f.controls.parentNode,f.body);
 }
});

test('exit only leaves this room and destroy removes listeners without stealing a different portal',async()=>{
 const f=fixture();await f.fullscreen.toggle();const different=f.node();different.appendChild(f.controls);f.doc.fullscreenElement=different;
 f.fullscreen.destroy();assert.equal(f.counts().exited,0);assert.equal(f.controls.parentNode,different);assert.equal(f.doc.listeners.get('fullscreenchange').size,0);assert.equal(f.doc.listeners.get('keydown').size,0);assert.equal(f.button.listeners.get('click').size,0);
 assert.equal(await f.fullscreen.toggle(),false);assert.equal(f.fullscreen.getState().active,false);
});

test('a closed room never consumes Escape meant for the next room',async()=>{
 const f=fixture('native');await f.fullscreen.toggle();await f.fullscreen.exit();f.host.hidden=true;
 assert.equal(f.fullscreen.handleEscape({key:'Escape'}),false);
 f.host.hidden=false;assert.equal(f.fullscreen.handleEscape({key:'Escape'}),true,'The same native-exit key is still guarded while its room remains visible');
});
