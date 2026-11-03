'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),manifest=require('../bundled-games.json');
test('cabinet runtime files match their pinned source or documented package edits',()=>{
 assert.equal(manifest.schemaVersion,1);assert.deepEqual(Object.keys(manifest.games),['pitch','triad','rhythm']);
 for(const [id,game]of Object.entries(manifest.games)){
  assert.match(game.sourceRevision,/^[a-f0-9]{40}$/);assert.ok(game.sourceRepository.startsWith('cwoodmusic/'));
  assert.equal(game.directory,{pitch:'games/pitch-race',triad:'games/music-triad',rhythm:'games/rhythm-room'}[id]);
  const edits=game.packageEdits||{};
  for(const [name,edit]of Object.entries(edits)){
   assert.ok(game.sourceFiles[name],id+': package edit must retain a source baseline');
   assert.match(edit.sha256,/^[a-f0-9]{64}$/);assert.ok(edit.reason?.trim());
  }
  for(const [name,sourceHash]of Object.entries(game.sourceFiles)){
   // Browser fixtures use the new nested URL. Runtime changes retain their
   // original hashes alongside an explicit, documented package revision.
   if(name.startsWith('tests/'))continue;
   const expected=edits[name]?.sha256||sourceHash;
   const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,game.directory,name))).digest('hex');
   assert.equal(actual,expected,id+': '+name);
  }
 }
});
test('bundled entry pages resolve their own local scripts, styles, fonts and audio',()=>{
 for(const game of Object.values(manifest.games)){
  const directory=path.join(root,game.directory),html=fs.readFileSync(path.join(directory,'index.html'),'utf8');
  const refs=[...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)].map(match=>match[1]);
  for(const ref of refs){
   if(/^(?:https?:|data:|#|\/\/)/.test(ref))continue;
   assert.ok(fs.existsSync(path.resolve(directory,ref.split(/[?#]/)[0])),game.title+': '+ref);
  }
 }
 const rhythm=path.join(root,manifest.games.rhythm.directory);
 for(const asset of ['Bravura.woff','snare.wav','piano-C4.mp3','organ-C4.mp3'])assert.ok(fs.statSync(path.join(rhythm,asset)).size>0);
 assert.ok(fs.existsSync(path.join(root,'song-machine/index.html')),'Song Machine remains part of this same package');
});
