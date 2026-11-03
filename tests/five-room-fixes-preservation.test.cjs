'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {cleanupMask,tileEdgeWeight,build}=require('../scripts/build-walkway-cleanup.cjs');
const northwest=require('../scripts/five-northwest-cleanup-regions.json');
const front=require('../scripts/front-wall-depth-regions.json');
const green=require('../scripts/sign-green-completion-regions.json');
const hall=require('../scripts/hall-floor-repair-regions.json');
const finish=require('../scripts/dance-northwest-finish-regions.json');
const boutique=require('../scripts/boutique-wall-uniform-regions.json');
const danceMain=require('../scripts/dance-main-wall-uniform-regions.json');
const project=require('../published-world-project.json');
// Native finishing masks were reviewed against this authored artwork before
// later exports restored historical overlays handled by render compatibility.
const reviewedArtwork=require('./fixtures/reviewed-wall-artwork.json');
const width=1672,metas=[northwest,front,green,hall,finish,boutique,danceMain],masks=metas.map(cleanupMask);
const owns=(mask,x,y)=>mask[y*width+x];
function* journalPixels(texture){
 for(const [tile,runs]of Object.entries(texture?.tiles||{})){
  const [tx,ty]=tile.split(',').map(Number);
  for(const [start,length,color]of runs)for(let i=start;i<start+length;i++)yield [tx*64+i%64,ty*64+Math.floor(i/64),color];
 }
}

test('northwest repair removes the obsolete upper wall and lamp while retaining the new inner wall, plaques and left lamp',()=>{
 const mask=masks[0];
 for(const [x,y]of [[50,457],[180,480],[207,499],[207,512],[230,550],[230,620],[80,680],[180,648]])
  assert.equal(owns(mask,x,y),1,`Reviewed negative space, spill or neon ${x},${y}`);
 for(const [x,y]of [[120,512],[235,512],[83,551],[110,565],[190,565],[150,620],[60,680],[180,680],[397,359]])
  assert.equal(owns(mask,x,y),0,`Preserved cap, fixture, plaque, wall, post or tiles ${x},${y}`);
});

test('front depth owns only exterior bodies and the extension below them while retaining caps, rails, stairs and entrance',()=>{
 const mask=masks[1];
 for(const [x,y]of [[55,870],[100,920],[200,935],[470,935],[600,920],[840,900],[900,850],[1500,935]])
  assert.equal(owns(mask,x,y),1,`Reviewed exterior body ${x},${y}`);
 for(const [x,y]of [[55,825],[110,842],[200,877],[290,880],[320,910],[430,935],[480,875],[600,860],[780,850],[900,820],[1450,800],[400,800]])
  assert.equal(owns(mask,x,y),0,`Preserved cap, stair, entrance or interior ${x},${y}`);
});

test('the approved front artwork owns complete brick faces across former interior source seams, below every preserved cap and rail',()=>{
 const mask=masks[1];
 for(const [x,y]of [[125,860],[135,875],[180,887],[230,890],[270,903],[470,903],[520,890],[540,892],[600,875],[900,832],[1039,833],[1530,832]])
  assert.equal(owns(mask,x,y),1,`Complete exterior brick face ${x},${y}`);
 for(const [x,y]of [[90,842],[125,852],[180,880],[270,892],[460,892],[510,882],[550,881],[600,868],[780,868],[820,859],[830,853],[840,846],[850,836],[858,832],[900,828]])
  assert.equal(owns(mask,x,y),0,`Preserved blue cap, neon or outer corner ${x},${y}`);
});

test('the expanded front pass retains every previously approved front pixel for identical standalone and full-pipeline builds',()=>{
 const previous=cleanupMask({...front,polygons:[
  [[49,842],[68,858],[110,858],[153,895],[244,895],[244,909],[305,909],[305,941],[49,941]],
  [[445,909],[493,909],[562,883],[782,883],[816,863],[858,837],[858,941],[445,941]],
  [[858,834],[1616,834],[1616,941],[858,941]]
 ]});
 for(let i=0;i<previous.length;i++)if(previous[i])assert.equal(masks[1][i],1,`Previously approved front pixel ${i%width},${Math.floor(i/width)}`);
 for(const [x,y]of [[800,872],[820,862],[830,854]])assert.equal(owns(masks[1],x,y),1,`Retained published bevel artwork ${x},${y}`);
});

test('emerald completion reuses approved masonry and cannot change the sign frame, roof or torches',()=>{
 const mask=masks[2];
 for(const [x,y]of [[1058,43],[1065,75],[1080,110]])assert.equal(owns(mask,x,y),1);
 for(const [x,y]of [[1057,75],[1090,75],[1080,30],[1080,120],[1144,60],[1000,60]])assert.equal(owns(mask,x,y),0);
 assert.equal(green.source,'assets/environment/source/green-back-wall.png');
});

test('Hall glass repair owns the entire stale rectangle and lamp ghost but cannot reach the Hall frame',()=>{
 const mask=masks[3];
 for(const [x,y]of [[1345,200],[1365,180],[1374,155],[1393,220],[1374,308],[1374,320]])assert.equal(owns(mask,x,y),1);
 for(const [x,y]of [[1339,200],[1374,154],[1394,220],[1410,200],[1374,325],[1365,100]])assert.equal(owns(mask,x,y),0);
 assert.deepEqual(hall.floorFeather,{right:[1393,1394],bottom:[309,325],leftBelow:[1340,1350,155]});
});

test('the final northwest pass owns one complete wall face and glass lane while preserving fixtures, posts, tiles and southwest turn',()=>{
 const mask=masks[4];
 for(const [x,y]of [[110,565],[190,565],[214,620],[215,620],[230,620],[120,650],[80,680],[110,710],[150,720],[110,825],[174,666],[160,710],[125,825]])
  assert.equal(owns(mask,x,y),1,`Reviewed continuous wall, neon or floor ${x},${y}`);
 for(const [x,y]of [[120,504],[68,600],[247,600],[83,515],[83,551],[79,815],[91,826],[100,826],[110,835],[132,825],[180,680],[320,910],[1450,800],[600,920]])
  assert.equal(owns(mask,x,y),0,`Preserved negative space, post, fixture, turn, tiles or previous fix ${x},${y}`);
});

test('the eight-pixel tile fringe fades from generated glass to immutable native artwork along the interpolated diagonal',()=>{
 assert.equal(finish.before,'assets/environment/source/dance-northwest-finish-before.png');
 assert.equal(finish.tileEdgeFeather.width,8);
 for(const [x,y]of finish.tileEdgeFeather.points){
  assert.equal(tileEdgeWeight(finish.tileEdgeFeather,x-1,y),1);
  assert.equal(tileEdgeWeight(finish.tileEdgeFeather,x,y),1);
  assert.equal(tileEdgeWeight(finish.tileEdgeFeather,x+4,y),.5);
  assert.equal(tileEdgeWeight(finish.tileEdgeFeather,x+8,y),0);
 }
 // Halfway between y693 and y723, the diagonal edge is x156.5.
 assert.equal(tileEdgeWeight(finish.tileEdgeFeather,156.5,708),1);
 assert.equal(tileEdgeWeight(finish.tileEdgeFeather,158.5,708),.75);
 assert.equal(tileEdgeWeight(finish.tileEdgeFeather,160.5,708),.5);
 assert.equal(tileEdgeWeight(finish.tileEdgeFeather,164.5,708),0);
 assert.equal(tileEdgeWeight(finish.tileEdgeFeather,170,664),1);
 assert.equal(tileEdgeWeight(finish.tileEdgeFeather,170,846),1);
});

test('the final rail copies use normalized world coordinates in an order that leaves every later source untouched',()=>{
 assert.deepEqual(finish.sourceSize,[995,1580]);
 assert.deepEqual(finish.sourcePlacement,[35,495,227,360]);
 const [px,py,pw,ph]=finish.sourcePlacement,mask=masks[4],previousDestinations=[];
 for(const [sx,sy,sw,sh,dx,dy,dw,dh]of finish.sourceCopies){
  assert.ok(sx>=px&&sy>=py&&sx+sw<=px+pw&&sy+sh<=py+ph,'Copy source is inside the normalized image');
  for(const [left,top,w,h]of previousDestinations)
   assert.ok(sx+sw<=left||left+w<=sx||sy+sh<=top||top+h<=sy,'Earlier copies cannot alter a later source');
  for(let y=dy;y<dy+dh;y++)for(let x=dx;x<dx+dw;x++)assert.equal(owns(mask,x,y),1,`Owned rail copy ${x},${y}`);
  previousDestinations.push([dx,dy,dw,dh]);
 }
});

test('the uniform boutique grid preserves its original brand, authored shirt artwork and lamp without changing its caps or floor',()=>{
 const mask=masks[5];
 for(const [x,y]of [[380,300],[450,300],[620,350],[530,390],[410,358],[600,358]])
  assert.equal(owns(mask,x,y),1,`Continuous boutique masonry ${x},${y}`);
 for(const [x,y]of [[531,315],[530,350],[397,359],[397,300],[368,280],[500,280],[675,350],[400,430],[500,450]])
  assert.equal(owns(mask,x,y),0,`Preserved boutique artwork, fixture, cap or floor ${x},${y}`);
 const currentPixels=new Map([...journalPixels(project.artwork?.['background.world'])].map(([x,y,color])=>[`${x},${y}`,color]));
 let shirtPixels=0;
 for(const [x,y,color]of journalPixels(reviewedArtwork['background.world'])){
  if(x>=521&&x<541&&y>=305&&y<325){
   shirtPixels++;assert.equal(owns(mask,x,y),0);
   assert.equal(currentPixels.get(`${x},${y}`),color,`Original authored shirt pixel ${x},${y} is preserved in the current export`);
  }
 }
 assert.equal(shirtPixels,309,'Every existing authored shirt-emblem pixel stays authoritative');
});

test('the uniform DJ grid preserves opaque plaques and light fixtures while owning adjacent glow and leaving caps, rails and floors intact',()=>{
 const mask=masks[6];
 for(const [x,y]of [[280,550],[450,580],[600,550],[625,550],[506,558],[650,620],[700,620]])
  assert.equal(owns(mask,x,y),1,`Continuous DJ masonry or lighting glow ${x},${y}`);
 for(const [x,y]of [[613,549],[613,530],[507,539],[632,572],[665,613],[683,572],[715,613],[650,590],[700,590],[500,515],[650,643],[650,655],[250,580],[725,580]])
  assert.equal(owns(mask,x,y),0,`Preserved DJ artwork, fixture, cap, rail or floor ${x},${y}`);
});

test('all finishing passes preserve world size, furniture and existing authored background pixels',()=>{
 for(const meta of metas){
  assert.deepEqual(meta.worldSize,[1672,941]);
  assert.equal(meta.output,'assets/environment/v1/empty-arcade.png');
  assert.equal(meta.preserveProject,true);
  const [x,y,w,h]=meta.sourcePlacement||[0,0,...meta.worldSize];
  assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=1672&&y+h<=941);
  if(meta.sourceRect){
   const [sx,sy,sw,sh]=meta.sourceRect,[sourceWidth,sourceHeight]=meta.sourceSize;
   assert.ok(sx>=0&&sy>=0&&sw>0&&sh>0&&sx+sw<=sourceWidth&&sy+sh<=sourceHeight);
  }
 }
 let authoredPixels=0;
 for(const [x,y]of journalPixels(reviewedArtwork['background.world'])){
  authoredPixels++;
  for(let pass=0;pass<masks.length;pass++)assert.equal(owns(masks[pass],x,y),0,`Reviewed authored pixel ${x},${y} in pass ${pass}`);
 }
 assert.equal(authoredPixels,879,'The native masks retain every background edit in the reviewed artwork fixture');
});

test('a native-only repair rejects authored-pixel overlap before loading artwork or writing files',async()=>{
 const [x,y,color]=[...journalPixels(reviewedArtwork['background.world'])].find(([x,y])=>x>=521&&x<541&&y>=305&&y<325);
 assert.equal([...journalPixels(project.artwork['background.world'])].find(([xx,yy])=>xx===x&&yy===y)?.[2],color,'The rejection witness remains authoritative in the current export');
 const meta={...northwest,source:'must-not-load.png',polygons:[[[x,y],[x+1,y],[x+1,y+1],[x,y+1]]],protectedPolygons:[]};
 await assert.rejects(build({meta,dryRun:true}),/Native-only repair overlaps 1 authored background pixels/);
});
