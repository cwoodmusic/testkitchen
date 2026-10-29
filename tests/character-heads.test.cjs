const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../character-renderer.js'),'utf8'),sandbox);
const renderer=sandbox.window.createCodaCharacterRenderer({reducedMotion:()=>true});
const directions=['down','left','up','right'];
const hair='#ad3658',hairColors=new Set([hair,'#961f41','#c14a6c']);

// Paint the actual public renderer into a small software pixel surface. These
// assertions inspect visible pixels after layering, not just drawing calls.
function picture(profile={},facing='down'){
  const pixels=new Map(),stack=[];let matrix=[1,0,0,1,0,0],fillStyle='#000';
  const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
  const ctx={get fillStyle(){return fillStyle;},set fillStyle(value){fillStyle=value;},
    save(){stack.push([matrix.slice(),fillStyle]);},restore(){[matrix,fillStyle]=stack.pop();},
    translate(x,y){matrix=multiply(matrix,[1,0,0,1,x,y]);},scale(x,y){matrix=multiply(matrix,[x,0,0,y,0,0]);},
    rotate(angle){const c=Math.cos(angle),s=Math.sin(angle);matrix=multiply(matrix,[c,s,-s,c,0,0]);},
    fillRect(x,y,w,h){assert.ok([x,y,w,h].every(Number.isFinite));assert.ok(w>0&&h>0);
      for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){
        const px=Math.floor(matrix[0]*(xx+.5)+matrix[2]*(yy+.5)+matrix[4]),py=Math.floor(matrix[1]*(xx+.5)+matrix[3]*(yy+.5)+matrix[5]);pixels.set(px+','+py,fillStyle);
      }
    },beginPath(){},ellipse(){},fill(){}};
  assert.equal(renderer.drawPlayer(ctx,{hair,...profile},{facing},0),true);assert.equal(stack.length,0);
  return {pixels,at:(x,y)=>pixels.get(x+','+y),signature:()=>JSON.stringify([...pixels].sort(([a],[b])=>a.localeCompare(b)))};
}

test('mohawk is a narrow central crest with bare temples in front and back',()=>{
  for(const facing of ['down','up']){
    const look=picture({hairstyle:'mohawk'},facing),bare=picture({hairstyle:'bald'},facing);
    for(const [point,color]of look.pixels){const [x,y]=point.split(',').map(Number);if(hairColors.has(color)&&y<=-38)assert.ok(x>=-4&&x<=3,'Crest must stay on the center strip: '+point);}
    assert.ok(hairColors.has(look.at(0,-51)),'The tall crest must be visible');
    for(const x of [-7,7])assert.equal(look.at(x,-37),bare.at(x,-37),'Shaved sides must expose the head');
  }
  for(const facing of ['left','right']){
    const look=picture({hairstyle:'mohawk'},facing);
    const top=[...look.pixels].filter(([point,color])=>hairColors.has(color)&&Number(point.split(',')[1])<=-48).map(([point])=>Number(point.split(',')[0]));
    assert.ok(Math.max(...top)-Math.min(...top)>=18,'Profile crest must run along the head, not form a front-view spike');
  }
});

test('ponytail stays behind the face and cropped styles leave a visible nape',()=>{
  const bare=picture({hairstyle:'bald'}),ponytail=picture({hairstyle:'ponytail'});
  for(const [x,y]of [[-6,-35],[4,-35],[0,-31],[0,-28]])assert.equal(ponytail.at(x,y),bare.at(x,y),'The front tail must not cover facial pixels');
  const undercut=picture({hairstyle:'undercut'},'up'),bob=picture({hairstyle:'bob'},'up');
  assert.ok(!hairColors.has(undercut.at(-6,-33)),'Undercut must expose its shaved nape');
  assert.ok(hairColors.has(bob.at(-6,-33)),'A bob should keep its longer rear silhouette');
});

test('cap, bucket and visor brims leave the visible eyes clear',()=>{
  for(const facing of ['down','right']){
    const bare=picture({hairstyle:'bald'},facing);
    for(const headwear of ['cap','bucket','sunvisor']){
      const look=picture({hairstyle:'bald',headwear},facing);
      for(const x of facing==='down'?[-6,4]:[5])assert.equal(look.at(x,-35),bare.at(x,-35),headwear+' must not cover the eye');
    }
  }
});

test('every hat and every glasses style respects its chosen color in every direction',()=>{
  const hats=renderer.catalog.headwear.filter(({id})=>id!=='none');
  for(const facing of directions){
    for(const {id:headwear}of hats)assert.notEqual(picture({headwear,headwearColor:'#227744'},facing).signature(),picture({headwear,headwearColor:'#c13377'},facing).signature(),headwear+' chosen color / '+facing);
    for(const {id:eyewear}of renderer.catalog.eyewear.filter(({id})=>id!=='none'))assert.notEqual(picture({eyewear,eyewearColor:'#227744'},facing).signature(),picture({eyewear,eyewearColor:'#c13377'},facing).signature(),eyewear+' chosen color / '+facing);
  }
});

test('hat silhouettes and glasses remain distinct with the same colors',()=>{
  for(const facing of ['down','right']){
    const hats=['fedora','boater','bowler','tophat','cap','bucket','beanie','witch','wizard','straw'];
    assert.equal(new Set(hats.map(headwear=>picture({headwear,headwearColor:'#447788'},facing).signature())).size,hats.length,'Hat designs must differ in '+facing);
    const eyewear=renderer.catalog.eyewear.filter(({id})=>id!=='none');
    assert.equal(new Set(eyewear.map(({id})=>picture({eyewear:id,eyewearColor:'#447788'},facing).signature())).size,eyewear.length,'Glasses designs must differ in '+facing);
  }
});

test('profile visor lenses stay at the front with narrow temple arms',()=>{
  for(const eyewear of ['cybervisor','sport','3d']){
    const look=picture({eyewear,eyewearColor:'#447788'},'right'),bare=picture({},'right');
    assert.equal(look.at(-6,-32),bare.at(-6,-32),eyewear+' must not paint a full front-view lens over the back of the head');
    assert.notEqual(look.at(7,-34),bare.at(7,-34),eyewear+' must still have its visible front lens');
  }
});


test('expanded composers have distinct visible silhouettes even under the same palette',()=>{
 const ids=['bach','mozart','beethoven','clara','joplin','ellington','ella','nina','miles','schoenberg','handel','vivaldi'];
 const shared={skin:'#d8b495',hair:'#70615a',shirt:'#565565',lowerColor:'#3f4152'};
 for(const facing of directions){
  const pictures=ids.map(characterId=>picture({...renderer.appearanceFor(characterId),...shared,characterId},facing));
  assert.equal(new Set(pictures.map(look=>look.signature())).size,ids.length,'Visible identity should survive recoloring in '+facing);
 }
 const schoenberg=picture({...renderer.appearanceFor('schoenberg'),characterId:'schoenberg'});
 const handel=picture({...renderer.appearanceFor('handel'),characterId:'handel'});
 const vivaldi=picture({...renderer.appearanceFor('vivaldi'),characterId:'vivaldi'});
 const top=look=>Math.min(...[...look.pixels.keys()].map(point=>Number(point.split(',')[1])));
 assert.ok(top(handel)<top(schoenberg),'Handel’s full wig must rise above Schoenberg’s bald crown');
 assert.ok([...vivaldi.pixels.values()].includes('#ad5937'),'Vivaldi’s reddish hair must remain visibly painted');
});
