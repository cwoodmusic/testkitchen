import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PLAYER_SCALE} from './player-settings.mjs';
import {arcadeFootprint,ARCADE_INTERIOR_SCALE,ARCADE_WALL,arcadeNativeSize,arcadeGeometry,arcadePointFromInterior,arcadePointToInterior,arcadeFrontAtX} from './arcade-geometry.mjs';

test('arcade floor keeps the interior shape at the same character-relative scale',()=>{
 assert.equal(ARCADE_INTERIOR_SCALE,2.5);assert.equal(ARCADE_INTERIOR_SCALE,PLAYER_SCALE);
 assert.deepEqual(arcadeNativeSize,{w:1672,h:1041});
 assert.equal(arcadeGeometry.w,4180);assert.equal(arcadeGeometry.h,2603);assert.equal(arcadeGeometry.polygons.length,9);
 assert.equal(arcadeGeometry.bounds.w/PLAYER_SCALE,arcadeFootprint.bounds.w);
 assert.equal(arcadeGeometry.bounds.h/PLAYER_SCALE,arcadeFootprint.bounds.h);
 for(let i=0;i<arcadeFootprint.floorPolys.length;i++)assert.deepEqual(arcadeGeometry.polygons[i].map(([x,y])=>arcadePointToInterior({x,y})),arcadeFootprint.floorPolys[i].map(([x,y])=>({x,y})));
});
test('actor depth follows the floor front at its column, including the west club wing',()=>{
 assert.equal(arcadeFrontAtX(1477*2.5),(800+100)*2.5);
 assert.equal(arcadeFrontAtX(400*2.5),(841+100)*2.5);
 assert.equal(arcadeFrontAtX(50*2.5),null);
});
test('entrance and arbitrary local points map reversibly between town and interior',()=>{
 assert.deepEqual(arcadeGeometry.door,arcadePointFromInterior(arcadeFootprint.entrance));
 for(const p of [{x:0,y:0},arcadeFootprint.entrance,arcadeFootprint.entrance.inside,{x:1558,y:799},{x:68,y:156}])assert.deepEqual(arcadePointToInterior(arcadePointFromInterior(p)),{x:p.x,y:p.y});
 assert.equal(arcadeGeometry.bounds.y,(arcadeFootprint.bounds.y+ARCADE_WALL)*PLAYER_SCALE);
});
