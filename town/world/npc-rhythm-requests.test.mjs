import test from 'node:test';
import assert from 'node:assert/strict';
import {createNPCRhythmRequests} from './npc-rhythm-requests.mjs';
import {createNoteInventory} from './note-inventory.mjs';
import {noteName} from './town-game-audio.mjs';

class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.events={};this.open=false;this.disabled=false;this.textContent='';this.innerHTML='';}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=[...children];}
 setAttribute(key,value){this.attributes[key]=value;}
 addEventListener(key,callback){this.events[key]=callback;}
 showModal(){this.open=true;}
 close(){this.open=false;}
 focus(){}
 querySelector(selector){return this.all().find(node=>selector.startsWith('#')?node.id===selector.slice(1):false)||null;}
 all(){return this.children.flatMap(child=>[child,...child.all()]);}
 click(){if(!this.disabled)return this.onclick?.();}
}
function fixture(t,{empty=false}={}){
 const previous=globalThis.document,body=new Element('body');globalThis.document={body,createElement:tag=>new Element(tag)};t.after(()=>{globalThis.document=previous;});
 let writes=0,saveOK=true;
 const journal={data:{stars:0,netWins:0,fish:{},yellowNotes:Object.fromEntries(['quarter','eighth-pair','sixteenth-group'].map(value=>[value,empty?0:4])),npcRhythmWins:{}},warning:'',save(){writes++;return saveOK;}};
 const inventory=createNoteInventory(journal),audio={now:0,tones:[],async unlock(){return true;},get time(){return this.now;},tone(...args){this.tones.push(args);},stop(){},suspend(){},async resume(){}};
 const q=createNPCRhythmRequests({canvas:new Element('canvas'),journal,inventory,audio}),dialog=body.children[0];
 const button=label=>{const node=dialog.all().find(node=>node.tagName==='button'&&(node.textContent===label||node.attributes['aria-label']===label));assert(node,'Missing button: '+label);return node;};
 const listen=async(actor={id:'bach',name:'Bach'})=>{q.start(actor);await Promise.resolve();audio.now+=8;q.tick();assert.equal(q.state.phase,'arrange');};
 return {q,dialog,journal,inventory,audio,button,listen,get writes(){return writes;},saveFails(){saveOK=false;},saveWorks(){saveOK=true;}};
}

test('real named neighbours offer ear-only requests while vendors keep their own game',async t=>{
 const f=fixture(t),parent=new Element('div');let closed=0;
 assert.equal(f.q.offer({id:'bach',name:'Bach'},parent,()=>closed++),true);
 assert.equal(f.q.offer({id:'bach',role:'vendor'},parent,()=>{}),false);
 assert.equal(f.q.offer({id:'unknown',name:'Someone'},parent,()=>{}),false);
 parent.children.find(node=>node.tagName==='button').click();await Promise.resolve();
 assert.equal(closed,1);assert.equal(f.q.state.phase,'listen');assert(f.q.fullscreen);assert.equal(f.dialog.all().some(node=>node.innerHTML.includes('<svg')),false,'The played answer must not appear as notation');
 f.audio.now=.8;f.q.tick();assert.equal(f.dialog.querySelector('#npcRhythmCount').textContent,'2');
 assert.deepEqual(f.audio.tones.slice(0,4).map(tone=>tone[2]),[460,460,460,960]);assert(f.audio.tones.length>4,'The request must actually schedule rhythm sounds');
 assert(f.q.state.target.every(value=>['quarter','eighth-pair','sixteenth-group'].includes(value)),'An NPC never asks for an uncatchable rest');
 assert.equal(f.writes,0);
});

test('wrong answers and undo preserve cards; one correct answer spends exactly four and awards once',async t=>{
 const f=fixture(t);await f.listen();const target=f.q.state.target,initial={...f.inventory.counts};assert.equal(f.dialog.all().filter(node=>node.attributes['aria-label']?.startsWith('Add ')).length,3);assert.equal(f.dialog.all().some(node=>node.attributes['aria-label']==='Add Quarter rest'),false);
 for(const value of [...target].reverse())f.button('Add '+noteName(value)).click();
 const submit=f.button('Check my rhythm');submit.click();assert.equal(f.q.state.phase,'arrange');assert.equal(f.q.state.mistakes,1);assert.deepEqual(f.inventory.counts,initial);assert.equal(f.writes,0);
 for(const _ of target)f.button('Undo').click();
 for(const value of target)f.button('Add '+noteName(value)).click();
 f.button('Check my rhythm').click();assert.equal(f.q.state.phase,'won');assert.equal(f.journal.data.stars,1);assert.equal(f.journal.data.npcRhythmWins.bach,1);assert.equal(f.inventory.total,8);assert.equal(f.writes,1);
 for(const value of target)initial[value]--;
 assert.deepEqual(f.inventory.counts,initial);submit.click();assert.equal(f.writes,1,'A repeated submit must not pay or spend twice');
 f.button('Back to town').click();assert.equal(f.q.active,false);
 await f.listen();assert.notDeepEqual(f.q.state.target,target,'The next saved request advances after success');
});

test('an unfinished request survives leaving to catch cards and preserves its partial answer',async t=>{
 const f=fixture(t,{empty:true});await f.listen();const target=f.q.state.target;
 assert(f.dialog.all().filter(node=>node.attributes['aria-label']?.startsWith('Add ')).every(node=>node.disabled));
 f.button('Check my rhythm').click();assert.equal(f.writes,0);
 f.button('Catch yellow notes').click();assert.equal(f.q.active,false);assert.equal(f.q.fullscreen,false);
 for(const value of target)assert(f.inventory.add(value));
 await f.listen();assert.deepEqual(f.q.state.target,target);f.button('Add '+noteName(target[0])).click();
 f.button('Catch yellow notes').click();await f.listen();assert.deepEqual(f.q.state.order,[target[0]]);assert.deepEqual(f.q.state.target,target);
 f.q.end();await f.listen();assert.deepEqual(f.q.state.order,[],'Owner/map reset clears another player’s pending answer');
});

test('failed saving rolls back inventory and stars and allows an honest retry',async t=>{
 const f=fixture(t);await f.listen();for(const value of f.q.state.target)f.button('Add '+noteName(value)).click();const before=structuredClone(f.journal.data);
 f.saveFails();f.button('Check my rhythm').click();assert.equal(f.q.state.phase,'arrange');assert.deepEqual(f.journal.data,before);
 f.saveWorks();f.button('Check my rhythm').click();assert.equal(f.q.state.phase,'won');assert.equal(f.journal.data.stars,1);assert.equal(f.journal.data.npcRhythmWins.bach,1);
});

test('pausing protects a request and closing cancels delayed audio unlock callbacks',async t=>{
 const f=fixture(t);f.q.start({id:'bach'});await Promise.resolve();f.q.pause();assert(f.q.state.paused);f.audio.now=100;f.q.tick();assert.equal(f.q.state.phase,'listen');
 await f.button('Continue').click();await Promise.resolve();assert.equal(f.q.state.paused,false);assert.equal(f.q.state.phase,'listen');f.audio.now=109;f.q.tick();assert.equal(f.q.state.phase,'arrange');
 f.q.end();let resolve;f.audio.unlock=()=>new Promise(done=>{resolve=done;});f.q.start({id:'mozart'});f.q.end();resolve(true);await Promise.resolve();assert.equal(f.q.active,false);assert.equal(f.dialog.open,false);
});


test('blur while unlocking audio and a second blur during Continue both retain the pause',async t=>{
 const f=fixture(t);let unlock;f.audio.unlock=()=>new Promise(resolve=>{unlock=resolve;});
 f.q.start({id:'bach'});f.q.pause();assert.equal(f.q.state.phase,'ready');assert.equal(f.q.state.paused,true);
 unlock(true);await Promise.resolve();assert.equal(f.q.state.phase,'ready');assert.equal(f.q.state.paused,true);
 let resume;f.audio.resume=()=>new Promise(resolve=>{resume=resolve;});const continuing=f.button('Continue').click();
 f.q.pause();resume();await continuing;await Promise.resolve();assert.equal(f.q.state.paused,true);assert.equal(f.q.state.phase,'ready');
 f.audio.resume=async()=>{};f.audio.unlock=async()=>true;await f.button('Continue').click();await Promise.resolve();assert.equal(f.q.state.phase,'listen');assert.equal(f.q.state.paused,false);
});
