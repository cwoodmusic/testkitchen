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
test('custom-domain cabinets use bundled files on the exact secure parent origin',()=>{
 for(const hostname of customHosts)
 for(const [game,path]of [['pitch','games/pitch-race'],['triad','games/music-triad'],['rhythm','games/rhythm-room']]){
  const url=new URL(host.gameURL(game,{hostname,origin:'https://untrusted.test'},'domains-73'));
  assert.equal(url.origin,'https://'+hostname);assert.equal(url.pathname,'/'+path+'/');
  assert.equal(url.searchParams.get('v'),'domains-73');
 }
});
test('each GitHub Pages package loads its own cabinet copies',()=>{
 for(const project of ['testkitchen','coda-arcade'])
 for(const [game,path]of [['pitch','pitch-race'],['triad','music-triad'],['rhythm','rhythm-room']]){
  const location=new URL('https://cwoodmusic.github.io/'+project+'/world-preview.html?guest=1#classroom-pass=private');
  const url=new URL(host.gameURL(game,location));
  assert.equal(url.origin,location.origin);assert.equal(url.pathname,'/'+project+'/games/'+path+'/');
  assert.equal(url.hash,'');assert.equal(url.searchParams.has('guest'),false);
 }
});
test('local package previews preserve the current server and prefix',()=>{
 const location=new URL('http://127.0.0.1:8321/testkitchen/world-preview.html');
 const url=new URL(host.gameURL('pitch',location));assert.equal(url.origin,location.origin);assert.equal(url.pathname,'/testkitchen/games/pitch-race/');
});
test('untrusted and conflicting host input cannot redirect cabinet traffic',()=>{
 assert.equal(new URL(host.gameURL('pitch',{hostname:'untrusted.example',href:'https://untrusted.example/'})).href,'https://cwoodmusic.github.io/coda-arcade/games/pitch-race/?v=bundled-profile-names-1');
 const url=new URL(host.gameURL('pitch',{hostname:host.CUSTOM_HOST,href:'https://untrusted.example/steal/'}));
 assert.equal(url.origin,host.CUSTOM_ORIGIN);assert.equal(url.pathname,'/games/pitch-race/');
});
test('cabinet paths cannot be replaced with arbitrary URLs or prototype properties',()=>{
 for(const game of ['https://untrusted.test/','../musictriad','constructor','__proto__',''])assert.throws(()=>host.gameURL(game,{hostname:host.CUSTOM_HOST}),TypeError);
});
