const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const context = {window:{}};
  for (const file of ['world-object-catalog.js','world-object-runtime.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});
  }
  const catalog = context.window.CodaWorldObjectCatalog;
  const assets = [];
  let animation = {dx:0,dy:0,rot:0,scale:1,alpha:1};
  const runtime = context.window.createCodaWorldObjects({catalog,getAssets:()=>assets,getAnimation:()=>animation});
  const games = [
    {name:'Pitch Race',x:718,y:313,url:'https://cwoodmusic.github.io/Pitch-Race/'},
    {name:'Music Triad',x:831,y:314,url:'https://cwoodmusic.github.io/musictriad/'},
    {name:'Rhythm Room',x:951,y:315,url:'https://cwoodmusic.github.io/rhythmroom/'},
    {name:'Song Machine',x:1064,y:315,url:'song-machine/index.html'}
  ];
  function lift(name, overrides={}) {
    const part = catalog.find(p=>p.name===name);
    const [x,y,w,h] = part.bounds;
    const asset = {id:'edited-'+name,origin:{name,bounds:[...part.bounds]},x:x+w/2,y:y+h/2,w,h,rotation:0,opacity:100,visible:true,...overrides};
    assets.push(asset);
    return asset;
  }
  return {catalog,assets,runtime,games,lift,animate:value=>{animation={...animation,...value};}};
}
function near(actual, expected, message) {
  assert.ok(Math.abs(actual-expected)<1e-8,`${message}: expected ${expected}, got ${actual}`);
}

test('catalog exposes the game originals and full passage plant while retaining game links and approach positions',()=>{
  const {catalog,runtime,games} = fixture();
  assert.equal(catalog.length,8);
  assert.equal(new Set(catalog.map(p=>p.name)).size,8);
  assert.equal(catalog.find(p=>p.name==='rhythm_fishing_trapdoor').procedural,'fishing-trapdoor');
  assert.equal(catalog.filter(p=>p.ballIndex!==undefined).length,2);
  assert.ok(catalog.some(p=>p.name==='dance_passage_plant_leaves'&&p.source==='world'));
  assert.deepEqual(Array.from(catalog.filter(p=>p.gameIndex!==undefined),p=>p.gameIndex),[0,1,2,3]);
  const liveGames=runtime.games(games);
  assert.equal(liveGames.length,4);
  for(let i=0;i<4;i++) {
    const game=liveGames[i];
    assert.equal(game.index,i);assert.equal(game.name,games[i].name);assert.equal(game.url,games[i].url);
    near(game.x,games[i].x,'original gameplay X');near(game.y,games[i].y,'original gameplay Y');
    near(game.npcX,games[i].x,'original NPC X');near(game.npcY,323,'original NPC Y');
  }
  for(const part of catalog.filter(p=>p.ballIndex!==undefined)) {
    const state=runtime.state(part.name),anchor=runtime.point(state,...part.anchor);
    near(anchor.x,part.anchor[0],'original disco anchor X');near(anchor.y,part.anchor[1],'original disco anchor Y');
    assert.equal(state.visible,true);assert.equal(state.opacity,1);
  }
  assert.equal(runtime.state('unknown-object'),null);
});

test('merely lifting original objects leaves their gameplay and lighting anchors fixed',()=>{
  const {catalog,runtime,games,lift}=fixture();
  for(const part of catalog)lift(part.name);
  for(const part of catalog) {
    const state=runtime.state(part.name),source=part.anchor||[part.bounds[0],part.bounds[1]],point=runtime.point(state,...source);
    near(point.x,source[0],'lifted original X');near(point.y,source[1],'lifted original Y');
  }
  for(const game of runtime.games(games)) {
    near(game.x,games[game.index].x,'lifted gameplay X');near(game.y,games[game.index].y,'lifted gameplay Y');
    near(game.npcY,323,'lifted NPC Y');
  }
});

test('translated, independently resized and rotated cabinets move game and NPC anchors together',()=>{
  const {catalog,runtime,games,lift}=fixture();
  const part=catalog.find(p=>p.gameIndex===2),[x,y,w,h]=part.bounds;
  const asset=lift(part.name,{x:1200,y:600,w:w*2,h:h*.5,rotation:90});
  const live=runtime.games(games).find(g=>g.index===2);
  // The source vector (dx,dy) becomes (2*dx,.5*dy), then a quarter turn (-.5*dy,2*dx).
  const expected = (px,py)=>({x:asset.x-.5*(py-y-h/2),y:asset.y+2*(px-x-w/2)});
  const gamePoint=expected(games[2].x,games[2].y),npcPoint=expected(games[2].x,323);
  near(live.x,gamePoint.x,'transformed gameplay X');near(live.y,gamePoint.y,'transformed gameplay Y');
  near(live.npcX,npcPoint.x,'transformed NPC X');near(live.npcY,npcPoint.y,'transformed NPC Y');
  assert.equal(live.url,games[2].url,'moving a cabinet must retain its game destination');
  assert.equal(live.index,2,'filtering or movement must retain original game identity');
  near(live.npcX-live.x,-.5*(323-games[2].y),'approach offset rotates and scales with cabinet');
  near(live.npcY-live.y,0,'rotated approach has no remaining vertical offset');
});

test('asset flips reflect cabinet gameplay and approach points around the animated centre',()=>{
  const {catalog,runtime,games,lift,animate}=fixture();
  const part=catalog.find(p=>p.gameIndex===2),[x,y,w,h]=part.bounds;
  const asset=lift(part.name,{x:1200,y:600,w:w*2,h:h*.5,rotation:30});
  animate({dx:7,dy:-9,rot:Math.PI/3,scale:1.5});
  // The animated quarter turn maps the horizontal source basis downward and
  // the vertical basis leftward. Mirroring reverses the corresponding basis.
  const centre={x:1207,y:591};
  for(const [flipX,flipY]of [[false,false],[true,false],[false,true],[true,true]]){
    asset.flipX=flipX;asset.flipY=flipY;
    const state=runtime.state(part.name),pivot=runtime.point(state,x+w/2,y+h/2);
    near(pivot.x,centre.x,'mirroring preserves the animated centre X');
    near(pivot.y,centre.y,'mirroring preserves the animated centre Y');
    const expected=(px,py)=>({
      x:centre.x+(flipY?1:-1)*.75*(py-y-h/2),
      y:centre.y+(flipX?-1:1)*3*(px-x-w/2)
    });
    const live=runtime.games(games).find(game=>game.index===2);
    const game=expected(games[2].x,games[2].y),approach=expected(games[2].x,323);
    near(live.x,game.x,'mirrored gameplay X');near(live.y,game.y,'mirrored gameplay Y');
    near(live.npcX,approach.x,'mirrored approach X');near(live.npcY,approach.y,'mirrored approach Y');
    assert.equal(live.name,games[2].name);assert.equal(live.url,games[2].url);
  }
});

test('turning each flip off restores the original linked artwork anchors',()=>{
  const {runtime,games,lift}=fixture();
  const asset=lift('cabinet_music_triad',{x:1020,y:520,rotation:27});
  const original=JSON.parse(JSON.stringify(runtime.games(games)));
  asset.flipX=true;asset.flipY=true;
  assert.notDeepEqual(JSON.parse(JSON.stringify(runtime.games(games))),original);
  asset.flipX=false;asset.flipY=false;
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.games(games))),original);
  delete asset.flipX;delete asset.flipY;
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.games(games))),original,'Old projects with no flip fields retain their anchors');
});

test('hidden cabinets stop offering their game and restoring originals restores original anchors',()=>{
  const {assets,runtime,games,lift}=fixture();
  const asset=lift('cabinet_music_triad',{x:1150,y:650,visible:false});
  assert.equal(runtime.state('cabinet_music_triad').visible,false);
  assert.deepEqual(Array.from(runtime.games(games),g=>g.index),[0,2,3]);
  asset.visible=true;
  const moved=runtime.games(games).find(g=>g.index===1);
  assert.notEqual(moved.x,games[1].x);
  assets.splice(0,1); // Restore original removes its origin override.
  const restored=runtime.games(games).find(g=>g.index===1);
  near(restored.x,games[1].x,'restored gameplay X');near(restored.y,games[1].y,'restored gameplay Y');
  near(restored.npcX,games[1].x,'restored NPC X');near(restored.npcY,323,'restored NPC Y');
});

test('disco emitter state follows animation, nonuniform size, rotation, and combined opacity',()=>{
  const {catalog,runtime,lift,animate}=fixture();
  const part=catalog.find(p=>p.name==='disco_ball_arcade'),[x,y,w,h]=part.bounds;
  const asset=lift(part.name,{x:1100,y:500,w:w*2,h:h*3,rotation:30,opacity:40});
  animate({dx:7,dy:-9,rot:Math.PI/3,scale:1.5,alpha:.25});
  const state=runtime.state(part.name),anchor=runtime.point(state,...part.anchor);
  // 30 degrees static plus 60 degrees animated rotation gives a quarter turn.
  const dx=part.anchor[0]-x-w/2,dy=part.anchor[1]-y-h/2;
  near(anchor.x,asset.x+7-dy*3*1.5,'animated emitter X');
  near(anchor.y,asset.y-9+dx*2*1.5,'animated emitter Y');
  near(state.opacity,.1,'asset and animation opacity multiply');
  near(state.matrix[1],3,'animated horizontal basis length');
  near(state.matrix[2],-4.5,'animated vertical basis length');
  asset.visible=false;assert.equal(runtime.state(part.name).visible,false);
});

test('duplicate artwork without origin metadata cannot hijack a game or disco emitter',()=>{
  const {catalog,assets,runtime,games,lift}=fixture();
  const original=lift('cabinet_song_machine',{x:1250,y:650});
  const copy={...original,id:'independent-copy',name:'Song Machine copy',origin:undefined,x:100,y:100};
  assets.unshift(copy);
  const live=runtime.games(games).find(g=>g.index===3);
  assert.equal(runtime.state('cabinet_song_machine').asset,original);
  assert.ok(live.x>1000,'the original linked cabinet owns its gameplay anchor');
  assets.splice(assets.indexOf(original),1);
  const restored=runtime.games(games).find(g=>g.index===3);
  near(restored.x,games[3].x,'unlinked copy does not take over restored original');
  const ball=catalog.find(p=>p.ballIndex===0);
  assets.push({id:'unlinked-ball-copy',name:ball.label,x:20,y:20,w:60,h:60,visible:true,opacity:0});
  assert.equal(runtime.state(ball.name).asset,null);
  near(runtime.point(runtime.state(ball.name),...ball.anchor).x,ball.anchor[0],'unlinked ball copy does not move original emitter');
});
