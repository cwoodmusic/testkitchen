'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const exit=require('../arcade-exit.js');

test('title navigation keeps the exact origin and directory while dropping launch actions',()=>{
 for(const base of [
  'https://cwoodmusic.github.io/coda-arcade/world-preview.html?guest=1&profile=student#classroom-pass=private',
  'https://coda-arcade.com/world-preview.html?next=https://other.test#not-a-pass',
  'https://www.coda-arcade.com/world-preview.html?v=old',
  'http://127.0.0.1:8000/coda-arcade/world-preview.html'
 ]){
  const target=new URL(exit.titleURL({href:base})),source=new URL(base);
  assert.equal(target.origin,source.origin);
  assert.equal(target.pathname,source.pathname.replace('world-preview.html','index.html'));
  assert.equal(target.search,'');assert.equal(target.hash,'');
 }
 assert.throws(()=>exit.titleURL('javascript:alert(1)'),/web address/);
});

test('only a finite position at the physical front exit is close enough',()=>{
 assert.equal(exit.near(exit.TARGET),true);assert.equal(exit.near({x:1477,y:750}),true);
 for(const point of [{x:1180,y:388},{x:1560,y:778},{x:NaN,y:778},{x:1477,y:Infinity},null])assert.equal(exit.near(point),false);
 assert.ok(Object.isFrozen(exit.TARGET));
});

test('interaction rechecks proximity and UI guards without navigating on approach',()=>{
 let point={x:1477,y:750},allowed=false,cleared=0;const visits=[];
 const door=exit.create({location:'https://coda-arcade.com/world-preview.html',getPlayer:()=>point,enabled:()=>allowed,beforeLeave:()=>cleared++,navigate:url=>visits.push(url)});
 assert.equal(door.state().near,true);assert.equal(door.target(),null);assert.equal(door.interact(),false);
 allowed=true;assert.equal(door.target().type,'exit');assert.deepEqual(visits,[],'Walking near the exit never navigates');
 point={x:1180,y:388};assert.equal(door.interact(),false,'A stale nearby interaction cannot exit from elsewhere');
 point={x:1477,y:750};assert.equal(door.interact(),true);assert.equal(cleared,1);
 assert.deepEqual(visits,['https://coda-arcade.com/index.html']);
 assert.equal(door.interact(),false,'A held interact key cannot navigate twice');assert.equal(door.state().exiting,true);
});

test('a cancelled or failed departure can be retried without retaining a navigation latch',()=>{
 let blocked=true,fail=true;const visits=[];
 const door=exit.create({location:'https://coda-arcade.com/world-preview.html',getPlayer:()=>exit.TARGET,beforeLeave:()=>!blocked,navigate:url=>{if(fail)throw Error('navigation unavailable');visits.push(url);}});
 assert.equal(door.interact(),false);assert.equal(door.state().exiting,false);
 blocked=false;assert.throws(()=>door.interact(),/navigation unavailable/);assert.equal(door.state().exiting,false);
 fail=false;assert.equal(door.interact(),true);assert.equal(visits.length,1);
});

test('an unrelated visible modal also prevents title navigation without changing saved state',()=>{
 let visible=true;const visits=[];
 const doc={querySelectorAll:()=>[{getClientRects:()=>visible?[{}]:[]}]};
 const door=exit.create({document:doc,location:'https://coda-arcade.com/world-preview.html',getPlayer:()=>exit.TARGET,navigate:url=>visits.push(url)});
 assert.equal(door.target(),null);assert.equal(door.state().enabled,false);assert.equal(door.interact(),false);assert.deepEqual(visits,[]);
 visible=false;assert.equal(door.target().type,'exit');assert.equal(door.interact(),true);assert.equal(visits.length,1);
});

test('returning through browser history restores the exit after a cached page resumes',()=>{
 const events={},visits=[];
 const door=exit.create({window:{addEventListener:(name,listener)=>events[name]=listener},location:'https://coda-arcade.com/world-preview.html',getPlayer:()=>exit.TARGET,navigate:url=>visits.push(url)});
 assert.equal(door.interact(),true);assert.equal(door.interact(),false);
 events.pageshow({persisted:false});assert.equal(door.interact(),false,'An unrelated show event must not repeat a pending navigation');
 events.pageshow({persisted:true});assert.equal(door.interact(),true);assert.equal(visits.length,2);
});
