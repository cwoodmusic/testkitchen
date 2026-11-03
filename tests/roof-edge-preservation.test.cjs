'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {cleanupMask}=require('../scripts/build-walkway-cleanup.cjs');
const hall=require('../scripts/hall-roof-cap-regions.json'),left=require('../scripts/lounge-club-roof-regions.json');
const previousCap=require('../scripts/boutique-corner-cap-regions.json');
const width=1672,hallMask=cleanupMask(hall),leftMask=cleanupMask(left),previousMask=cleanupMask(previousCap);

test('The final Hall guide removes the upper portrait wall and left lamp while preserving the Piano outline, right lamp and gold panel',()=>{
 for(const [x,y]of [[1388,8],[1388,38],[1397,91],[1397,50],[1403,125],[1445,105],[1500,134],[1598,138],[1396,185]])assert.equal(hallMask[y*width+x],1,`Final Hall roof/exterior ${x},${y}`);
 for(const [x,y]of [[1365,100],[1568,140],[1475,150],[1300,100],[1500,200],[1410,185]])assert.equal(hallMask[y*width+x],0,`Preserved Hall artwork ${x},${y}`);
});

test('Straight blue caps own the approved former lip and roof junction while preserving the north carpet, fixtures and remaining post',()=>{
 for(const [x,y]of [[80,315],[200,340],[110,375],[205,395],[240,415],[110,425],[240,433],[75,465],[150,465],[230,455],[55,520],[260,460]])assert.equal(leftMask[y*width+x],1,`Final left wall edge ${x},${y}`);
 for(const [x,y]of [[100,200],[100,300],[190,304],[120,445],[83,540],[207,499],[207,465],[120,600],[397,359],[800,500],[260,400],[260,490],[290,515]])assert.equal(leftMask[y*width+x],0,`Preserved left artwork ${x},${y}`);
 for(let i=0;i<previousMask.length;i++)if(previousMask[i]){
  const x=i%width,y=Math.floor(i/width),newUpperTurn=y<390,newClubJoin=x>=247&&x<272&&y>=450&&y<470;
  if(!newUpperTurn&&!newClubJoin)assert.equal(leftMask[i],0,`Preserved prior post/corner at ${x},${y}`);
 }
});

test('The roof masks own no reviewed artwork background edits',()=>{
 const reviewedArtwork=require('./fixtures/reviewed-wall-artwork.json');
 let reviewedPixels=0;
 for(const [tile,runs]of Object.entries(reviewedArtwork['background.world'].tiles)){
  const [tx,ty]=tile.split(',').map(Number);
  for(const [start,length]of runs)for(let i=start;i<start+length;i++){
   const x=tx*64+i%64,y=ty*64+Math.floor(i/64),index=y*width+x;
   reviewedPixels++;
   assert.equal(hallMask[index]||leftMask[index],0,`Reviewed authored pixel ${x},${y} must remain untouched`);
  }
 }
 assert.equal(reviewedPixels,879,'Every background edit reviewed with the native roof masks is checked');
});
