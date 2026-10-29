const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sprite-animation.js'),'utf8'),sandbox);
const animation=sandbox.window.CodaSpriteAnimation;

test('all animation clips stay within their direction block and the112 authored frames',()=>{
  const visited=new Set();
  for(const [d,direction]of ['down','left','up','right'].entries()){
    for(const [clip,definition]of Object.entries(animation.clips))for(let i=0;i<definition.frames;i++){
      const emote={interact:'playing',walk:'',idle:''}[clip]??clip;
      const pose=animation.sample({facing:direction,walking:clip==='walk',phase:(i+.1)/6*Math.PI*2,emote},(i+.1)/definition.fps,false);
      assert.equal(pose.clip,clip);assert.equal(pose.direction,direction);assert.equal(pose.index,d*28+definition.offset+i);
      assert.ok(pose.index>=0&&pose.index<112);visited.add(pose.index);
    }
  }
  assert.equal(visited.size,112);
});

test('walking animation follows actual distance phase rather than wall-clock time',()=>{
  const a=animation.sample({walking:true,phase:1.5},0),b=animation.sample({walking:true,phase:1.5},100);
  assert.equal(a.index,b.index);
  assert.notEqual(animation.sample({walking:true,phase:0},10).index,animation.sample({walking:true,phase:Math.PI},10).index);
  assert.equal(animation.sample({walking:false,phase:Math.PI},0).clip,'idle');
});

test('authored emotes and interaction poses select distinct clips; spin changes direction',()=>{
  for(const [emote,clip]of [['wave','wave'],['dance','dance'],['talk','talk'],['playing','interact'],['sit','sit'],['robot','dance'],['disco','wave']])assert.equal(animation.sample({emote,emoteTime:.3},5).clip,clip);
  const turns=new Set([0,.18,.36,.54].map(emoteTime=>animation.sample({facing:'down',emote:'spin',emoteTime},0).direction));assert.equal(turns.size,4);
});

test('reduced motion freezes all clips at idle0 without changing position or ordinary facing',()=>{
  for(const emote of ['wave','dance','talk','playing','sit','spin']){
    const pose=animation.sample({facing:'right',walking:true,phase:2,emote,emoteTime:3},100,true);
    assert.equal(pose.clip,'idle');assert.equal(pose.frame,0);assert.equal(pose.direction,'right');assert.equal(pose.index,84);
  }
});

test('invalid saved motion and negative times never select out-of-range frames',()=>{
  for(const raw of [null,{}, {facing:'invalid',phase:Infinity}, {walking:true,phase:-200}, {emote:'dance',emoteTime:-3}]){
    const pose=animation.sample(raw,-100);assert.ok(Number.isInteger(pose.index)&&pose.index>=0&&pose.index<112);
  }
});

const joints=pose=>[pose.rootY,pose.bodyAngle,...pose.arms.flatMap(part=>[part.angle,part.x,part.y,part.scaleY]),...pose.legs.flatMap(part=>[part.angle,part.x,part.y,part.scaleY])];

test('continuous walking interpolates joints between the old six frame boundaries',()=>{
  for(const facing of animation.directions){
    const poses=Array.from({length:120},(_,slot)=>animation.rigPose({facing,walking:true,phase:slot/120*Math.PI*2},0));
    assert.ok(new Set(poses.map(pose=>JSON.stringify(joints(pose)))).size>60,'A stride needs continuous intermediate poses');
    for(let i=0;i<poses.length;i++){
      const a=joints(poses[i]),b=joints(poses[(i+1)%poses.length]);
      assert.ok(a.every(Number.isFinite),'Every transform must stay finite');
      assert.ok(a.every((value,j)=>Math.abs(value-b[j])<.2),'The stride must wrap without a snapping joint');
    }
    const a=animation.rigPose({facing,walking:true,phase:.123},0),b=animation.rigPose({facing,walking:true,phase:.123},1000);
    assert.deepEqual(joints(a),joints(b),'Walking follows traveled distance rather than wall-clock time');
  }
});

test('continuous rig uses an exact neutral pose for idle and reduced motion',()=>{
  for(const facing of animation.directions){
    const idle=animation.rigPose({facing},123),quiet=animation.rigPose({facing,walking:true,phase:2,emote:'dance',emoteTime:3},123,true);
    assert.equal(idle.active,false);assert.equal(quiet.active,false);
    for(const pose of [idle,quiet]){
      assert.equal(pose.rootY,0);assert.equal(pose.bodyAngle,0);
      for(const part of [...pose.arms,...pose.legs]){
        assert.equal(part.angle,0);assert.equal(part.x,0);assert.equal(part.y,0);assert.equal(part.scaleY,1);
      }
    }
  }
});

test('continuous emotes retain finite joints and interpolate without pose swaps',()=>{
  for(const emote of ['wave','dance','talk','playing','sit','robot','disco']){
    let previous;
    for(let slot=0;slot<120;slot++){
      const pose=animation.rigPose({facing:'down',emote,emoteTime:slot/60},slot/60),values=joints(pose);
      assert.ok(values.every(Number.isFinite));
      if(previous)assert.ok(values.every((value,i)=>Math.abs(value-previous[i])<.3),emote+' must not jump between unrelated raster poses');
      previous=values;
    }
  }
  for(const raw of [null,{}, {facing:'invalid',phase:Infinity}, {walking:true,phase:-200}, {emote:'dance',emoteTime:-3}]){
    assert.ok(joints(animation.rigPose(raw,-100)).every(Number.isFinite));
  }
});
