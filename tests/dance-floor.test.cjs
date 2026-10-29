const test = require('node:test');
const assert = require('node:assert/strict');
const {createCodaDanceFloor,tileAt,pointInPolygon,VERTEX_ROWS,TILES} = require('../dance-floor.js');

function fixture(){
  let time=0,player={x:0,y:0,jumpHeight:0},quality='full',quiet=false;
  const floor=createCodaDanceFloor({getTime:()=>time,getPlayer:()=>player,getQuality:()=>quality,reducedMotion:()=>quiet});
  return {floor,time:value=>time=value,player:value=>player=value,quality:value=>quality=value,quiet:value=>quiet=value};
}
function context(){
  return {calls:[],save(){},restore(){},beginPath(){this.path=[];},moveTo(x,y){this.path.push([x,y]);},lineTo(x,y){this.path.push([x,y]);},closePath(){},
    fill(){this.calls.push({type:'fill',polygon:this.path.slice(),alpha:this.globalAlpha});},stroke(){this.calls.push({type:'stroke',polygon:this.path.slice()});},
    fillRect(...bounds){this.calls.push({type:'rect',bounds});}};
}

test('all 78 painted floor quadrilaterals map to their real perspective cell',()=>{
  assert.equal(VERTEX_ROWS.length,7);assert.equal(TILES.length,78);
  for(const tile of TILES){
    assert.equal(tileAt(...tile.center).id,tile.id);
    assert.ok(tile.inset.every(point=>pointInPolygon(...point,tile.polygon)),'Glow must stay inside the painted tile');
  }
  const top=TILES[0],bottom=TILES[65];
  assert.ok(bottom.polygon[1][0]-bottom.polygon[0][0]>top.polygon[1][0]-top.polygon[0][0]);
  assert.notEqual(top.polygon[0][0],top.polygon[3][0],'Left edges follow the fan, not vertical square-grid lines');
  assert.equal(tileAt(125,675),null);assert.equal(tileAt(655,675),null);assert.equal(tileAt(400,850),null);
  assert.equal(tileAt(NaN,700),null);assert.equal(tileAt(400,Infinity),null);
});

test('crossing a skewed grout seam changes the activated tile at its actual position',()=>{
  // The left edge of column 1 shifts from x204 at the back to x197 at row 1.
  assert.equal(tileAt(200,668).column,0);
  assert.equal(tileAt(200,692).column,1);
  assert.equal(tileAt(200,692).row,0);
  assert.equal(tileAt(200,694).row,1);
});

test('grounded footsteps illuminate only their cell and recently left cells fade out',()=>{
  const f=fixture(),first=TILES[20],second=TILES[21];
  f.player({x:first.center[0],y:first.center[1],jumpHeight:0});
  let state=f.floor.snapshot();assert.equal(state.current,first.id);assert.deepEqual(state.active.map(t=>t.id),[first.id]);
  f.time(.1);f.player({x:second.center[0],y:second.center[1],jumpHeight:0});state=f.floor.snapshot();
  assert.equal(state.current,second.id);assert.equal(state.active.length,2);
  assert.ok(state.active.find(t=>t.id===first.id).intensity<1);
  f.time(1);state=f.floor.snapshot();assert.deepEqual(state.active.map(t=>t.id),[second.id]);assert.equal(state.active[0].intensity,1);
  f.player({x:0,y:0,jumpHeight:0});f.time(1.8);assert.equal(f.floor.snapshot().active.length,0);
});

test('airborne feet do not activate tiles and landing activates the correct tile',()=>{
  const f=fixture(),tile=TILES[45];f.player({x:tile.center[0],y:tile.center[1],jumpHeight:12});
  assert.equal(f.floor.snapshot().current,null);assert.equal(f.floor.snapshot().active.length,0);
  f.time(.5);f.player({x:tile.center[0],y:tile.center[1],jumpHeight:0});assert.equal(f.floor.snapshot().current,tile.id);
});

test('drawing uses inset quadrilaterals with no blur and remains responsive in reduced/off FX modes',()=>{
  const f=fixture(),tile=TILES[0];f.player({x:tile.center[0],y:tile.center[1],jumpHeight:0});
  for(const quality of ['full','lite','off']){
    f.quality(quality);f.quiet(true);const ctx=context();f.floor.draw(ctx);
    assert.equal(ctx.shadowBlur,0);assert.equal(ctx.calls.filter(c=>c.type==='fill').length,1);
    const fill=ctx.calls.find(c=>c.type==='fill');assert.deepEqual(fill.polygon,tile.inset);
    assert.ok(fill.polygon.every(point=>pointInPolygon(...point,tile.polygon)));
    assert.equal(ctx.calls.filter(c=>c.type==='rect').length,quality==='off'?0:2);
  }
});

test('state is bounded by the 78 tiles and rewinding time clears stale contact history',()=>{
  const f=fixture();
  for(const tile of TILES){f.player({x:tile.center[0],y:tile.center[1],jumpHeight:0});f.floor.snapshot();}
  assert.equal(f.floor.snapshot().active.length,78);
  f.player({x:0,y:0,jumpHeight:0});f.time(1);assert.equal(f.floor.snapshot().active.length,0);
  f.player({x:TILES[0].center[0],y:TILES[0].center[1],jumpHeight:0});f.floor.snapshot();
  f.player({x:0,y:0,jumpHeight:0});f.time(.5);assert.equal(f.floor.snapshot().active.length,0);
});
