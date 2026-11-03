'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const style=require('../pixel-style.js'),library=require('../decor-library.js');
const root=path.resolve(__dirname,'..'),manifest=require('../assets/decor/handdrawn-assets.json');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('the full library uses hand-drawn replacements while keeping the preferred Notes accessories',()=>{
 const preserved=['notes-receipt-printer','notes-pen-cup','notes-ledger','notes-price-display','notes-display-tray'];
 assert.equal(library.items.length,91);assert.equal(manifest.items.length,86);
 assert.equal(new Set(style.SHEETS.flatMap(sheet=>sheet.ids)).size,86);
 for(const item of library.items){
  assert.equal(style.has(item.id),!preserved.includes(item.id));
  assert.match(library.imageURL(item.id),style.has(item.id)?/assets\/decor\/handdrawn\/v1\//:/assets\/decor\/v1\//);
 }
 for(const source of manifest.sources)assert.equal(digest(fs.readFileSync(path.join(root,source.path))),source.sha256);
 for(const record of manifest.items){
  const item=library.items.find(item=>item.id===record.id),bytes=fs.readFileSync(path.join(root,record.output));
  assert.equal(digest(bytes),record.sha256);assert.equal(bytes[25],6);
  assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[item.width,item.height]);
  assert.deepEqual(record.corners,[0,0,0,0]);assert.ok(record.visibleBounds[2]>3&&record.visibleBounds[3]>3);
 }
 const runner=manifest.items.find(item=>item.id==='rug-lightning-runner');assert.ok(runner.visibleBounds[2]>runner.visibleBounds[3]*2,'The runner remains a wide horizontal textile');
});
test('cash register faces north, floor textiles stay top-down and equipment faces south',()=>{
 assert.equal(style.facing('notes-register','tabletop'),'north');
 assert.match(style.facingLabel('notes-register','tabletop'),/rear view/);
 for(const item of library.items){
  const facing=style.facing(item.id,item.category);
  if(item.id==='notes-register')continue;
  assert.equal(facing,item.id.endsWith('-east')?'east':item.id.endsWith('-west')?'west':item.category==='rug'?'top':'south');
 }
 for(const id of ['boombox','boombox-tower','notes-register'])assert.ok(manifest.items.some(item=>item.id===id));
});
test('shared furniture uses the hand-drawn designs without replacing legacy PNG sources',()=>{
 const expected={'lounge-couch-south.png':'sofa-lounge-south','dance-couch-left-south.png':'sofa-south','dance-couch-right-south.png':'sofa-compact-south','main-counter.png':'counter-jade-south','boutique-counter.png':'counter-boutique-south','dj-console.png':'desk-dj-south','table.png':'table-candle-south'};
 assert.deepEqual(style.ENVIRONMENT,expected);
 for(const[file,id]of Object.entries(expected)){assert.ok(style.has(id));assert.ok(fs.existsSync(path.join(root,'assets/environment/v1',file)));}
 for(const[name,id,target]of [['lounge_sofa','sofa-lounge-south',[13,38,262,67]],['dance_left_couch','sofa-south',[12,66,139,65]],['dance_right_couch','sofa-compact-south',[20,52,121,57]]]){
  assert.deepEqual(style.ENVIRONMENT_FIT[name].target,target,'Retain the existing world sofa footprint and foot baseline');
  assert.deepEqual(style.ENVIRONMENT_FIT[name].source,manifest.items.find(item=>item.id===id).visibleBounds,'Use the full reviewed hand-drawn silhouette');
 }
});

test('twelve new pieces provide east and west chairs, two-seaters, tables and counters as vertical assets',()=>{
 const items=library.items.slice(79);
 assert.equal(items.length,12);assert.equal(items.filter(item=>item.id.endsWith('-east')).length,6);assert.equal(items.filter(item=>item.id.endsWith('-west')).length,6);
 assert.equal(items.filter(item=>item.id.startsWith('couch-')).length,4);
 assert.equal(items.filter(item=>item.id.startsWith('armchair-')||item.id.startsWith('chair-')).length,4);
 assert.ok(items.every(item=>item.category==='furniture'&&item.height>item.width));
 assert.ok(items.every(item=>!item.id.includes('dj')));
 for(const item of items){
  const record=manifest.items.find(record=>record.id===item.id);
  assert.equal(record.facing,item.id.endsWith('-east')?'east':'west');
  assert.ok(record.visibleBounds[3]>record.visibleBounds[2],'The actual artwork must run vertically');
 }
});
