'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {cleanupMask}=require('../scripts/build-walkway-cleanup.cjs');
const nw=require('../scripts/dance-northwest-south-wall-regions.json'),north=require('../scripts/arcade-north-straight-cap-regions.json');
const width=1672,nwMask=cleanupMask(nw),northMask=cleanupMask(north);

test('the south-facing northwest wall owns the old diagonal and inner cap while protecting lamps, tiles and other room fixes',()=>{
 for(const [x,y]of [[55,515],[130,565],[205,565],[110,620],[70,670],[160,655],[260,510]])assert.equal(nwMask[y*width+x],1,`Reviewed inner wall/glass ${x},${y}`);
 for(const [x,y]of [[45,580],[83,551],[207,499],[180,680],[250,690],[397,359],[650,590],[835,650],[1400,150]])assert.equal(nwMask[y*width+x],0,`Preserved fixture/floor/previous repair ${x},${y}`);
});

test('the north-cap strip reaches the reviewed roof while preserving all sign faces, lamp fixtures and the elevated Piano roof',()=>{
 for(const [x,y]of [[174,10],[300,20],[520,15],[800,15],[1130,15],[1215,15]])assert.equal(northMask[y*width+x],1,`Reviewed north cap ${x},${y}`);
 for(const [x,y]of [[250,42],[530,58],[605,40],[1144,40],[800,35],[1215,6],[1245,20],[1397,91],[200,315],[260,506]])assert.equal(northMask[y*width+x],0,`Preserved sign/lamp/roof ${x},${y}`);
});

test('the wide roof source excludes its letterbox and the reviewed join copy stays inside the cap ownership',()=>{
 const [width,height]=north.sourceSize,[x,y,w,h]=north.sourceRect;
 assert.deepEqual(north.sourceSize,[2172,724]);
 assert.deepEqual(north.sourceRect,[0,169,2172,386]);
 assert.ok(y>0&&y+h<height,'Both white letterbox margins must be excluded');
 assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=width&&y+h<=height);
 const [px,py,pw,ph]=north.sourcePlacement;
 for(const [sx,sy,sw,sh,dx,dy,dw,dh]of north.sourceCopies){
  assert.ok(sx>=px&&sy>=py&&sx+sw<=px+pw&&sy+sh<=py+ph,'Copied cap pixels come from the normalized artwork');
  for(let yy=dy;yy<dy+dh;yy++)for(let xx=dx;xx<dx+dw;xx++)assert.equal(northMask[yy*1672+xx],1,`Reviewed left cap connection ${xx},${yy}`);
 }
});

test('the new wall masks leave every reviewed background journal pixel authoritative',()=>{
 const reviewedArtwork=require('./fixtures/reviewed-wall-artwork.json');
 let reviewedPixels=0;
 for(const [tile,runs]of Object.entries(reviewedArtwork['background.world'].tiles)){
  const [tx,ty]=tile.split(',').map(Number);
  for(const [start,length]of runs)for(let i=start;i<start+length;i++){
   const x=tx*64+i%64,y=ty*64+Math.floor(i/64),at=y*width+x;
   reviewedPixels++;
   assert.equal(nwMask[at]||northMask[at],0,`Reviewed authored pixel ${x},${y}`);
  }
 }
 assert.equal(reviewedPixels,879,'Every background edit reviewed with the native wall masks is checked');
});
