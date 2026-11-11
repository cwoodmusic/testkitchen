import test from 'node:test';
import assert from 'node:assert/strict';
import {CONCERT_AUDIO_PREFERENCE_KEY,createConcertShuffleBag,createConcertAudio} from './concert-audio.mjs';

const programme=Object.freeze([
 Object.freeze({id:'orchestra',title:'Symphonic programme',category:'orchestra',pianist:null,src:'/music/orchestra.mp3'}),
 Object.freeze({id:'jazz',title:'New Orleans programme',category:'jazz',pianist:null,src:'/music/jazz.mp3'}),
 Object.freeze({id:'chopin',title:'Chopin recital',category:'piano',pianist:'chopin',src:'/music/chopin.mp3'}),
 Object.freeze({id:'liszt',title:'Liszt recital',category:'piano',pianist:'liszt',src:'/music/liszt.mp3'})
]);
function seeded(seed=733){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
class Target{
 constructor(){this.listeners=new Map();}
 addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
 removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
 emit(name,extra={}){for(const fn of [...(this.listeners.get(name)||[])])fn({type:name,target:this,...extra});}
 get listenerCount(){return [...this.listeners.values()].reduce((n,set)=>n+set.size,0);}
}
class FakeAudio extends Target{
 constructor(){super();this._src='';this.currentSrc='';this.currentTime=0;this.duration=180;this.paused=true;this.volume=1;this.muted=false;this.playCalls=0;this.pauseCalls=0;this.loadCalls=0;this.sourceChanges=[];this.failPlay=null;this.failLoad=false;}
 set src(value){this._src=value;this.currentSrc=value;this.currentTime=0;this.sourceChanges.push(value);}
 get src(){return this._src;}
 load(){this.loadCalls++;if(this.failLoad)throw Error('missing source');}
 play(){this.playCalls++;if(this.failPlay){const error=this.failPlay;this.failPlay=null;return Promise.reject(error);}this.paused=false;this.emit('play');return Promise.resolve();}
 pause(){this.pauseCalls++;this.paused=true;this.emit('pause');}
 removeAttribute(name){if(name==='src'){this._src='';this.currentSrc='';}}
}
class FakeAudioParam{
 constructor(value=0){this.value=value;this.events=[];}
 cancelScheduledValues(time){this.events.push(['cancel',time]);}
 cancelAndHoldAtTime(time){this.events.push(['hold',time]);}
 setValueAtTime(value,time){this.value=value;this.events.push(['set',value,time]);}
 linearRampToValueAtTime(value,time){this.value=value;this.events.push(['ramp',value,time]);}
}
class FakeAudioNode{
 constructor(){this.connections=[];this.disconnects=0;}
 connect(node){this.connections.push(node);return node;}
 disconnect(){this.disconnects++;this.connections=[];}
}
class FakeAudioContext extends Target{
 constructor(){
  super();this.state='suspended';this.sampleRate=48000;this.currentTime=12;this.destination={destination:true};
  this.filter=null;this.source=null;this.sourceMedia=null;this.sourceCalls=0;this.resumeCalls=0;this.closeCalls=0;this.failResume=null;this.failFilter=false;
 }
 createBiquadFilter(){if(this.failFilter)throw Error('Unsupported filter');return this.filter=Object.assign(new FakeAudioNode(),{frequency:new FakeAudioParam(350),Q:new FakeAudioParam(1),type:'lowpass'});}
 createMediaElementSource(media){this.sourceCalls++;if(this.source)throw Error('Media already has a source');this.sourceMedia=media;return this.source=new FakeAudioNode();}
 resume(){this.resumeCalls++;if(this.failResume){const error=this.failResume;this.failResume=null;return Promise.reject(error);}this.state='running';this.emit('statechange');return Promise.resolve();}
 close(){this.closeCalls++;this.state='closed';this.emit('statechange');return Promise.resolve();}
}
function clock(){
 let time=0,index=0;const frames=new Map();
 return {now:()=>time,request:fn=>{const id=++index;frames.set(id,fn);return id;},cancel:id=>frames.delete(id),get pending(){return frames.size;},step(ms){time+=ms;const callbacks=[...frames.values()];frames.clear();for(const fn of callbacks)fn(time);}};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
function fixture(options={}){
 const media=new FakeAudio(),win=new Target(),doc=new Target(),timer=clock(),values=new Map(),writes=[];
 doc.hidden=false;let scene=null;
 const project={objects:[{id:'opera',asset:'sydney-opera-house'}],cells:{'1,1':{surface:'grass',level:0}},name:'Unchanged town'};
 const storage={getItem:key=>values.get(key)??null,setItem(key,value){writes.push(key);values.set(key,value);}};
 const player=createConcertAudio({programme,getProject:()=>project,getScene:()=>scene,AudioConstructor:function(){return media;},storage,targetWindow:win,targetDocument:doc,requestFrame:timer.request,cancelFrame:timer.cancel,now:timer.now,random:seeded(),...options});
 return {player,media,win,doc,timer,project,storage,values,writes,setScene(next){scene=next;player.updateContext();}};
}

test('shuffle bags play every recording before repeating and avoid consecutive programme repeats',()=>{
 const source=programme.slice(),before=JSON.stringify(source),bag=createConcertShuffleBag(source,{random:seeded(1)}),selected=[];
 for(let cycle=0;cycle<20;cycle++){
  const round=Array.from({length:source.length},()=>bag.next());
  assert.deepEqual(round.map(track=>track.id).sort(),source.map(track=>track.id).sort());selected.push(...round);
 }
 for(let i=1;i<selected.length;i++)assert.notEqual(selected[i].id,selected[i-1].id);
 assert.equal(JSON.stringify(source),before);
});

test('failed recordings are excluded without blocking the remaining programme',()=>{
 const bag=createConcertShuffleBag(programme,{random:()=>0}),failed=new Set(['orchestra','jazz','chopin']);
 for(let i=0;i<12;i++)assert.equal(bag.next(failed).id,'liszt');
 failed.add('liszt');assert.equal(bag.next(failed),null);
 assert.equal(createConcertShuffleBag([]).next(),null);
});

test('a programme is visible before playback but media is not loaded or started without a gesture',async()=>{
 const {player,media,project,win,timer,writes}=fixture(),before=JSON.stringify(project),track=player.currentTrack;
 assert(track);assert.equal(player.state.status,'locked');assert.equal(player.state.needsGesture,true);
 assert.equal(media.src,'');assert.equal(media.loadCalls,0);assert.equal(media.playCalls,0);assert.equal(writes.length,0);
 for(let i=0;i<30;i++)player.updateContext();
 assert.strictEqual(player.currentTrack,track);assert.equal(media.playCalls,0);
 win.emit('pointerdown');await flush();timer.step(300);
 assert.equal(media.playCalls,1);assert.equal(media.loadCalls,1);assert.equal(player.state.playing,true);
 assert.equal(player.state.category,track.category);assert.equal(player.state.pianist,track.pianist);
 assert.equal(JSON.stringify(project),before);player.destroy();
});

test('entering and leaving the concert hall preserves the exact recording and position',async()=>{
 const {player,media,timer,setScene}=fixture();await player.unlock();timer.step(300);
 const track=player.currentTrack,source=media.src,loads=media.loadCalls,plays=media.playCalls;
 media.currentTime=83.125;
 assert(Math.abs(media.volume-.75*.025)<1e-8);const outsideVolume=media.volume;
 setScene({kind:'concert'});timer.step(140);
 assert(media.volume>outsideVolume&&media.volume<.75,'The indoor gain should ramp rather than jump');
 timer.step(160);assert.equal(media.volume,.75);assert.equal(player.currentTime,83.125);
 setScene({kind:'shop',floor:1});timer.step(300);assert.equal(media.volume,.75*.003);
 setScene(null);timer.step(300);assert.equal(media.volume,.75*.025);
 assert.strictEqual(player.currentTrack,track);assert.equal(media.src,source);assert.equal(media.loadCalls,loads);assert.equal(media.playCalls,plays);assert.equal(player.currentTime,83.125);
 player.destroy();
});

test('explicit player controls keep the Play gesture from starting and immediately pausing the programme',async()=>{
 const {player,media,win}=fixture(),target={closest:selector=>selector==='[data-concert-controls]'?{}:null};
 win.emit('pointerdown',{target});win.emit('keydown',{target,key:'Enter',repeat:false});await flush();
 assert.equal(media.playCalls,0);assert.equal(player.state.status,'locked');
 await player.play();assert.equal(media.playCalls,1);assert.equal(player.state.playing,true);player.destroy();
});

test('repeated frame context updates do not restart a gain ramp or media source',async()=>{
 const {player,media,timer,setScene}=fixture();await player.unlock();timer.step(300);
 setScene({kind:'concert'});
 for(let i=0;i<60;i++){player.updateContext();timer.step(16);assert(timer.pending<=1);}
 assert.equal(media.volume,.75);assert.equal(media.loadCalls,1);assert.equal(media.playCalls,1);assert.equal(timer.pending,0);player.destroy();
});

test('outdoor music requires a placed opera house while the entered concert scene remains playable',async()=>{
 const {player,media,project,setScene}=fixture();project.objects=[];player.updateContext();await player.unlock();
 assert.equal(player.state.status,'inactive');assert.equal(player.state.hasVenue,false);assert.equal(media.playCalls,0);
 setScene({kind:'concert'});await flush();assert.equal(media.playCalls,1);assert.equal(player.state.context,'concert');
 media.currentTime=29;setScene(null);assert.equal(media.paused,true);assert.equal(player.currentTime,29);
 project.objects.push({asset:'sydney-opera-house'});player.updateContext();await flush();assert.equal(media.playCalls,2);assert.equal(player.currentTime,29);player.destroy();
});

test('manual pause survives later gestures and context changes until explicitly resumed',async()=>{
 const {player,media,win,setScene}=fixture();await player.unlock();media.currentTime=42;player.pause();
 win.emit('pointerdown');win.emit('keydown',{key:'e',repeat:false});setScene({kind:'concert'});await flush();
 assert.equal(media.paused,true);assert.equal(media.playCalls,1);assert.equal(player.state.status,'paused');
 await player.play();assert.equal(media.playCalls,2);assert.equal(player.currentTime,42);player.destroy();
});

test('native autoplay rejection is handled and a subsequent real gesture retries the same recording',async()=>{
 const {player,media,win}=fixture(),track=player.currentTrack,error=new Error('gesture required');error.name='NotAllowedError';media.failPlay=error;
 assert.equal(await player.unlock(),false);assert.equal(player.state.status,'locked');assert.equal(player.state.needsGesture,true);
 assert.strictEqual(player.currentTrack,track);assert.deepEqual(player.state.failedTrackIds,[]);
 win.emit('keydown',{key:'e',repeat:false});await flush();assert.equal(player.state.playing,true);assert.equal(media.loadCalls,1);assert.equal(media.playCalls,2);player.destroy();
});

test('ending a recording changes metadata and stage category to the recording actually selected',async()=>{
 const {player,media}=fixture(),changes=[];player.onChange((state,reason)=>{if(reason==='track')changes.push({id:state.trackId,category:state.category,pianist:state.pianist});});await player.play();
 const seen=new Set([player.currentTrack.id]);
 for(let i=0;i<12;i++){
  const previous=player.currentTrack;media.currentTime=media.duration;media.emit('ended');await flush();
  assert.notEqual(player.currentTrack.id,previous.id);assert.equal(media.src,player.currentTrack.src);assert.equal(player.currentTime,0);seen.add(player.currentTrack.id);
  const change=changes.at(-1);assert.equal(change.id,player.currentTrack.id);assert.equal(change.category,player.currentTrack.category);assert.equal(change.pianist,player.currentTrack.pianist);
 }
 assert.equal(seen.size,programme.length);assert.equal(changes.length,12);player.destroy();
});

test('media errors try each available recording once and stop instead of looping requests forever',async()=>{
 const {player,media}=fixture();await player.play();
 const attempted=[];
 for(let i=0;i<programme.length;i++){attempted.push(player.currentTrack.id);media.emit('error');await flush();}
 assert.equal(new Set(attempted).size,programme.length);assert.equal(media.playCalls,programme.length);assert.equal(player.state.status,'unavailable');assert.equal(media.paused,true);
 const loads=media.loadCalls;for(let i=0;i<50;i++){player.updateContext();media.emit('error');}
 assert.equal(media.loadCalls,loads);assert.equal(media.playCalls,programme.length);assert.match(player.state.error,/could not be played/);
 await player.retry();assert.equal(player.state.playing,true);assert.equal(player.state.failedTrackIds.length,0);assert.equal(media.playCalls,programme.length+1);player.destroy();
});

test('visibility and page lifecycle pause safely and resume without changing time or selection',async()=>{
 const {player,media,doc,win,timer}=fixture();await player.play();media.currentTime=51.5;
 doc.hidden=true;doc.emit('visibilitychange');assert.equal(media.paused,true);assert.equal(media.volume,0);assert.equal(timer.pending,0);assert.equal(player.state.status,'suspended');
 const track=player.currentTrack;doc.hidden=false;doc.emit('visibilitychange');await flush();assert.equal(media.paused,false);assert.equal(player.currentTime,51.5);
 win.emit('pagehide');assert.equal(media.paused,true);win.emit('pageshow');await flush();assert.equal(media.paused,false);assert.strictEqual(player.currentTrack,track);assert.equal(player.currentTime,51.5);assert.equal(media.loadCalls,1);player.destroy();
});

test('mute and master volume persist only their own preference without resetting the programme',async()=>{
 const {player,media,timer,writes,values,storage}=fixture();await player.play();media.currentTime=72;
 player.setVolume(.4);timer.step(300);assert.equal(media.volume,.4*.025);player.setMuted(true);assert.equal(media.muted,true);timer.step(300);assert.equal(media.volume,0);
 assert.equal(player.currentTime,72);assert.equal(media.paused,false);assert.equal(player.state.playing,true);
 player.toggleMute();timer.step(300);assert.equal(media.muted,false);assert.equal(media.volume,.4*.025);assert.equal(media.loadCalls,1);
 assert.deepEqual([...new Set(writes)],[CONCERT_AUDIO_PREFERENCE_KEY]);assert.deepEqual(JSON.parse(values.get(CONCERT_AUDIO_PREFERENCE_KEY)),{version:1,volume:.4,muted:false});
 const restored=fixture({storage});assert.equal(restored.player.state.volume,.4);assert.equal(restored.player.state.muted,false);assert.equal(restored.media.playCalls,0);
 restored.player.destroy();player.destroy();
});

test('storage failures and unavailable browser audio produce usable state without throwing',async()=>{
 const {player}=fixture({AudioConstructor:null,storage:{getItem(){throw Error('private');},setItem(){throw Error('quota');}}});
 assert.equal(player.state.status,'unavailable');assert(player.currentTrack);assert.equal(await player.play(),false);assert.doesNotThrow(()=>{player.setVolume(.2);player.setMuted(true);player.destroy();});
 const empty=fixture({programme:[]});assert.equal(empty.player.state.status,'empty');assert.equal(await empty.player.play(),false);empty.player.destroy();
});

test('destroy removes media and gesture listeners, cancels ramps, and prevents any later playback',async()=>{
 const {player,media,win,doc,timer}=fixture();await player.play();player.updateContext({kind:'concert'});assert(timer.pending>0);
 let changes=0;player.onChange(()=>changes++);player.destroy();const after=changes;
 assert.equal(player.state.status,'destroyed');assert.equal(media.paused,true);assert.equal(media.src,'');assert.equal(media.listenerCount,0);assert.equal(win.listenerCount,0);assert.equal(doc.listenerCount,0);assert.equal(timer.pending,0);
 win.emit('pointerdown');media.emit('ended');timer.step(1000);assert.equal(await player.play(),false);player.skip();player.destroy();assert.equal(changes,after);
});

test('Web Audio is created and resumed on a player gesture, with only one source for the session',async()=>{
 const context=new FakeAudioContext();let constructions=0;
 const {player,media,win}=fixture({AudioContextConstructor:function(){constructions++;return context;}});
 assert.equal(constructions,0);assert.equal(player.state.usingWebAudio,false);
 for(let i=0;i<120;i++)player.updateContext();
 assert.equal(constructions,0);assert.equal(context.resumeCalls,0);
 win.emit('pointerdown');await flush();
 assert.equal(constructions,1);assert.equal(context.resumeCalls,1);assert.equal(context.sourceCalls,1);
 assert.strictEqual(context.sourceMedia,media);assert.deepEqual(context.source.connections,[context.filter]);assert.deepEqual(context.filter.connections,[context.destination]);
 assert.equal(player.state.usingWebAudio,true);assert.equal(player.state.filterEnabled,true);assert.equal(player.state.filterCutoffHz,1500);assert.equal(player.state.contextGain,.025);
 await player.unlock();await player.play();player.skip();await flush();
 assert.equal(constructions,1);assert.equal(context.sourceCalls,1);assert.equal(context.resumeCalls,1);
 player.destroy();
});

test('placing an opera house after the initial unlock adds muffling on the next gesture without restarting music',async()=>{
 const project={objects:[]},context=new FakeAudioContext();let constructions=0;
 const {player,media,win}=fixture({getProject:()=>project,AudioContextConstructor:function(){constructions++;return context;}});
 win.emit('pointerdown');await flush();
 assert.equal(player.state.status,'inactive');assert.equal(constructions,0);assert.equal(media.playCalls,0);
 project.objects.push({asset:'sydney-opera-house'});player.updateContext();await flush();
 assert.equal(player.state.playing,true);assert.equal(constructions,0);media.currentTime=21.75;
 const source=media.src,track=player.currentTrack,loads=media.loadCalls,plays=media.playCalls;
 win.emit('keydown',{key:'w',repeat:false});await flush();
 assert.equal(constructions,1);assert.equal(context.sourceCalls,1);assert.equal(context.resumeCalls,1);
 assert.equal(player.state.filterEnabled,true);assert.equal(player.state.filterCutoffHz,1500);
 assert.equal(player.currentTime,21.75);assert.equal(media.src,source);assert.strictEqual(player.currentTrack,track);assert.equal(media.loadCalls,loads);assert.equal(media.playCalls,plays);
 player.destroy();
});

test('the venue placement gesture refreshes stale eligibility without waiting for a rendered frame',async()=>{
 const project={objects:[]},context=new FakeAudioContext();
 const {player,media,win}=fixture({getProject:()=>project,AudioContextConstructor:function(){return context;}});
 win.emit('pointerdown');await flush();assert.equal(context.sourceCalls,0);
 // The canvas target handler adds the venue before this event reaches the
 // window's bubble listener; there is deliberately no updateContext call.
 project.objects.push({asset:'sydney-opera-house'});win.emit('pointerdown');await flush();
 assert.equal(player.state.hasVenue,true);assert.equal(player.state.playing,true);assert.equal(context.sourceCalls,1);assert.equal(context.resumeCalls,1);
 assert.equal(player.state.filterEnabled,true);assert.equal(media.loadCalls,1);assert.equal(media.playCalls,1);player.destroy();
});

test('outdoor low-pass opens to the full range in the hall without changing source or position',async()=>{
 const context=new FakeAudioContext(),{player,media,timer,setScene}=fixture({AudioContextConstructor:function(){return context;}});
 await player.play();await flush();timer.step(300);media.currentTime=86.25;
 const track=player.currentTrack,source=media.src,loads=media.loadCalls,filter=context.filter;
 assert.equal(player.state.filterCutoffHz,1500);assert.equal(media.volume,.75*.025);
 assert.deepEqual(filter.frequency.events,[['cancel',12],['set',1500,12]]);
 setScene({kind:'concert'});timer.step(300);
 assert.equal(player.state.filterEnabled,false);assert.equal(player.state.filterCutoffHz,24000);assert.equal(media.volume,.75);
 assert.deepEqual(filter.frequency.events.slice(-2),[['hold',12],['ramp',24000,12.28]]);
 setScene({kind:'shop',floor:1});timer.step(300);
 assert.equal(player.state.filterEnabled,true);assert.equal(player.state.filterCutoffHz,600);assert.equal(media.volume,.75*.003);
 setScene(null);timer.step(300);
 assert.equal(player.state.filterCutoffHz,1500);assert.equal(media.volume,.75*.025);
 assert.strictEqual(player.currentTrack,track);assert.equal(player.currentTime,86.25);assert.equal(media.src,source);assert.equal(media.loadCalls,loads);assert.equal(context.sourceCalls,1);
 const scheduled=filter.frequency.events.length;
 for(let i=0;i<600;i++){player.updateContext();timer.step(16);}
 assert.equal(filter.frequency.events.length,scheduled);assert.equal(timer.pending,0);assert.equal(context.resumeCalls,1);
 player.destroy();
});

test('every non-opera building stays nearly silent and more muffled while player controls and the live programme continue',async()=>{
 const context=new FakeAudioContext(),{player,media,timer,setScene,values,writes}=fixture({AudioContextConstructor:function(){return context;}});
 await player.play();await flush();timer.step(300);player.setVolume(.42);timer.step(300);
 const track=player.currentTrack,source=media.src,loads=media.loadCalls,plays=media.playCalls;media.currentTime=47.125;
 setScene({kind:'lobby',floor:1});timer.step(300);
 player.setMuted(true);timer.step(300);assert.equal(media.volume,0);assert.equal(media.muted,true);
 player.setMuted(false);timer.step(300);const saved=values.get(CONCERT_AUDIO_PREFERENCE_KEY),writeCount=writes.length,scheduled=context.filter.frequency.events.length;
 for(const scene of [{kind:'lobby',floor:1},{kind:'hall',floor:8},{kind:'shop',floor:1},{kind:'shop',floor:2},{kind:'showroom',showroomId:'midcentury-studio'},{kind:'apartment',resident:'player',floor:15}]){
  setScene(scene);timer.step(300);
  assert.equal(player.state.context,'interior');assert.equal(player.state.contextGain,.003);
  assert.equal(player.state.filterEnabled,true);assert.equal(context.filter.frequency.value,600);
  assert.equal(media.volume,.42*.003);assert.equal(player.state.playing,true);
  for(let i=0;i<100;i++)player.updateContext();
 }
 assert.equal(context.filter.frequency.events.length,scheduled,'Moving between other buildings must not reschedule identical filter automation');
 assert.equal(timer.pending,0);
 setScene(null);timer.step(300);assert.equal(player.state.context,'town');assert.equal(media.volume,.42*.025);assert.equal(context.filter.frequency.value,1500);
 setScene({kind:'concert'});timer.step(300);assert.equal(player.state.context,'concert');assert.equal(media.volume,.42);assert.equal(player.state.filterEnabled,false);assert.equal(context.filter.frequency.value,24000);
 assert.strictEqual(player.currentTrack,track);assert.equal(player.currentTime,47.125);assert.equal(media.src,source);assert.equal(media.loadCalls,loads);assert.equal(media.playCalls,plays);
 assert.equal(player.state.volume,.42);assert.equal(player.state.muted,false);assert.equal(values.get(CONCERT_AUDIO_PREFERENCE_KEY),saved);assert.equal(writes.length,writeCount);assert.equal(context.sourceCalls,1);assert.equal(context.resumeCalls,1);
 player.destroy();
});

test('unsupported Web Audio keeps the softer ordinary media playback without repeated setup attempts',async()=>{
 for(const failure of ['constructor','filter']){
  const context=new FakeAudioContext();context.failFilter=true;let attempts=0;
  const {player,media,timer,setScene}=fixture({AudioContextConstructor:function(){attempts++;if(failure==='constructor')throw Error('Unsupported');return context;}});
  await player.play();await flush();timer.step(300);
  assert.equal(player.state.playing,true);assert.equal(player.state.usingWebAudio,false);assert.equal(player.state.filterEnabled,false);assert.equal(player.state.filterCutoffHz,null);assert.equal(media.volume,.75*.025);
  media.currentTime=19.5;const source=media.src;
  setScene({kind:'concert'});timer.step(300);assert.equal(media.volume,.75);
  setScene({kind:'apartment',resident:'player',floor:15});timer.step(300);assert.equal(media.volume,.75*.003);
  assert.equal(media.currentTime,19.5);assert.equal(media.src,source);assert.equal(media.loadCalls,1);
  await player.play();await player.unlock();for(let i=0;i<60;i++)player.updateContext();
  assert.equal(attempts,1);assert.equal(context.sourceCalls,0);assert.equal(context.closeCalls,failure==='filter'?1:0);
  player.destroy();
 }
});

test('a blocked context resume waits for a new gesture and retries the same source rather than the playlist',async()=>{
 const context=new FakeAudioContext();context.failResume=Object.assign(new Error('Gesture needed'),{name:'NotAllowedError'});
 const {player,media,win}=fixture({AudioContextConstructor:function(){return context;}}),track=player.currentTrack;
 await player.play();await flush();
 assert.equal(player.state.status,'locked');assert.equal(media.paused,true);assert.equal(player.state.needsGesture,true);assert.deepEqual(player.state.failedTrackIds,[]);
 for(let i=0;i<120;i++)player.updateContext();
 assert.equal(context.resumeCalls,1);assert.equal(context.sourceCalls,1);
 win.emit('pointerdown');await flush();assert.equal(context.resumeCalls,2);assert.equal(context.sourceCalls,1);
 assert.strictEqual(player.currentTrack,track);assert.equal(player.state.playing,true);assert.equal(media.loadCalls,1);player.destroy();
});

test('suspended Web Audio resumes only on a gesture and destroy disconnects and closes it exactly once',async()=>{
 const context=new FakeAudioContext(),{player,media,doc,win}=fixture({AudioContextConstructor:function(){return context;}});
 await player.play();await flush();media.currentTime=37;
 doc.hidden=true;doc.emit('visibilitychange');context.state='suspended';context.emit('statechange');
 doc.hidden=false;doc.emit('visibilitychange');await flush();
 assert.equal(context.resumeCalls,1);assert.equal(player.state.status,'locked');assert.equal(media.paused,true);
 win.emit('keydown',{key:'e',repeat:false});await flush();assert.equal(context.resumeCalls,2);assert.equal(player.state.playing,true);assert.equal(player.currentTime,37);
 const source=context.source,filter=context.filter;
 player.destroy();player.destroy();await flush();
 assert.equal(context.closeCalls,1);assert.equal(source.disconnects,1);assert.equal(filter.disconnects,1);assert.equal(context.listenerCount,0);
 assert.equal(player.state.usingWebAudio,false);assert.equal(player.state.filterEnabled,false);
 win.emit('pointerdown');await player.play();assert.equal(context.resumeCalls,2);assert.equal(context.sourceCalls,1);
});

test('a gesture resumes a suspended context even when native media was already unlocked',async()=>{
 const context=new FakeAudioContext(),{player,media,win}=fixture({AudioContextConstructor:function(){return context;}});
 await player.play();await flush();media.currentTime=66.5;
 // Some browsers report suspension before delivering a statechange event.
 context.state='suspended';win.emit('pointerdown');await flush();
 assert.equal(context.resumeCalls,2);assert.equal(context.sourceCalls,1);assert.equal(player.state.playing,true);assert.equal(player.currentTime,66.5);assert.equal(media.loadCalls,1);assert.equal(media.playCalls,1);player.destroy();
});
