const test=require('node:test'),assert=require('node:assert/strict');
const pets=require('../pet-companion.js');
const ctx=()=>({calls:[],depth:0,save(){this.depth++;},restore(){this.depth--;},translate(x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y));},scale(x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y));},fillRect(x,y,w,h){assert.ok([x,y,w,h].every(Number.isFinite));assert.ok(w>0&&h>0);this.calls.push([x,y,w,h,this.fillStyle]);}});

test('the five companions have different visible pixel drawings, bounded to their foot anchors',()=>{
 const signatures=new Set();
 for(const id of pets.IDS.filter(id=>id!=='none')){
  const canvas=ctx();assert.equal(pets.drawPet(canvas,id,{x:100,y:200,facing:'down'},.5),true);
  assert.equal(canvas.depth,0);assert.ok(canvas.calls.length>=20);
  assert.ok(canvas.calls.every(([x,y,w,h])=>x>=-22&&x+w<=23&&y>=-34&&y+h<=8));
  signatures.add(JSON.stringify(canvas.calls));
 }
 assert.equal(signatures.size,5);assert.equal(pets.drawPet(ctx(),'none'),false);assert.equal(pets.drawPet(ctx(),'unknown'),false);
});

test('a companion follows movement smoothly and stays behind a continuously walking avatar',()=>{
 const avatar={pet:'cosmiccat'},pet=pets.create({getProfile:()=>avatar}),player={x:100,y:100,facing:'right'};
 const start=pet.update(player,0,'arcade');assert.equal(start.active,true);assert.equal(start.x,66);
 for(let at=0;at<120;at++){player.x+=230/60;pet.update(player,1/60,'arcade');}
 const following=pet.getState();assert.ok(following.x>start.x+350);assert.ok(following.x<player.x-25);assert.ok(player.x-following.x<75);
 assert.equal(following.moving,true);assert.ok(following.phase>0);
 for(let at=0;at<180;at++)pet.update(player,1/60,'arcade');
 assert.ok(Math.abs(pet.getState().x-(player.x-34))<.01);assert.equal(pet.getState().moving,false);
});

test('following is stable across frame rates and resets cleanly after doors or teleports',()=>{
 function run(fps){const pet=pets.create({getProfile:()=>({pet:'neondragon'})}),player={x:100,y:100,facing:'right'};pet.reset(player,'world');player.x=180;for(let at=0;at<fps;at++)pet.update(player,1/fps,'world');return pet.getState();}
 assert.ok(Math.abs(run(30).x-run(120).x)<.2);
 const pet=pets.create({getProfile:()=>({pet:'lakeotter'})});pet.reset({x:100,y:100,facing:'right'},'world');
 let moved=pet.update({x:500,y:310,facing:'down'},.016,'piano');assert.equal(moved.roomId,'piano');assert.equal(moved.x,490);assert.equal(moved.y,276);assert.equal(moved.phase,0);
 moved=pet.update({x:1300,y:700,facing:'left'},.016,'piano');assert.equal(moved.x,1334);assert.equal(moved.y,690);
});

test('unequipping clears the pet, invalid coordinates stay finite, and state copies cannot mutate motion',()=>{
 const avatar={pet:'rhythmfox'},pet=pets.create({getProfile:()=>avatar});pet.update({x:30,y:80,facing:'up'},.016,'world');
 const copy=pet.getState();copy.x=NaN;assert.ok(Number.isFinite(pet.getState().x));
 pet.update({x:NaN,y:100},Infinity,'world');assert.equal(pet.getState().active,false);assert.ok(Number.isFinite(pet.getState().x));
 pet.update({x:30,y:80},-1,'world');assert.equal(pet.getState().active,true);
 avatar.pet='none';pet.update({x:30,y:80},.016,'world');assert.equal(pet.getState().id,'none');assert.equal(pet.draw(ctx(),1),false);
});

test('reduced motion removes idle bobbing and sparkles while keeping the follower functional',()=>{
 const a=ctx(),b=ctx();pets.drawPet(a,'pianophoenix',{moving:false},.1,{reducedMotion:true});pets.drawPet(b,'pianophoenix',{moving:false},3,{reducedMotion:true});assert.deepEqual(a.calls,b.calls);
 const pet=pets.create({getProfile:()=>({pet:'cosmiccat'}),reducedMotion:()=>true});pet.update({x:100,y:100},.016,'world');assert.equal(pet.draw(ctx(),1),true);
});
