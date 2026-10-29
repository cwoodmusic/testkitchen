'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const host=require('../arcade-host.js');
const customHosts=['www.coda-arcade.com','coda-arcade.com','www.coda-aracde.com','coda-aracde.com'];
test('the canonical address uses the arcade spelling',()=>{
 assert.equal(host.CUSTOM_HOST,'www.coda-arcade.com');
 assert.equal(host.CUSTOM_ORIGIN,'https://www.coda-arcade.com');
});
test('only the configured production hostnames enable profile services',()=>{
 for(const name of ['cwoodmusic.github.io',...customHosts])assert.equal(host.supports(name),true,name);
 for(const name of ['www.coda-arcade.com.evil.test','evilwww.coda-arcade.com','other.coda-arcade.com','www.coda-aracde.com.evil.test','evilwww.coda-aracde.com','coda-arcade-site.chad-a-wood.workers.dev','localhost',''])assert.equal(host.supports(name),false,name);
});
test('custom-domain cabinets retain the exact secure parent origin',()=>{
 for(const hostname of customHosts)
 for(const [game,path]of [['pitch','Pitch-Race'],['triad','musictriad'],['rhythm','rhythmroom']]){
  const url=new URL(host.gameURL(game,{hostname,origin:'https://untrusted.test'},'domains-73'));
  assert.equal(url.origin,'https://'+hostname);assert.equal(url.pathname,'/'+path+'/');
  assert.equal(url.searchParams.get('v'),'domains-73');
 }
});
test('existing GitHub and local previews retain their existing cabinet destinations',()=>{
 for(const hostname of ['cwoodmusic.github.io','127.0.0.1','localhost','www.coda-aracde.com.evil.test'])
  assert.equal(new URL(host.gameURL('pitch',{hostname})).origin,'https://cwoodmusic.github.io');
});
test('cabinet paths cannot be replaced with arbitrary URLs or prototype properties',()=>{
 for(const game of ['https://untrusted.test/','../musictriad','constructor','__proto__',''])assert.throws(()=>host.gameURL(game,{hostname:host.CUSTOM_HOST}),TypeError);
});
