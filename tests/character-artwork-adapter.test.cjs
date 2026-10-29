const test=require('node:test'),assert=require('node:assert/strict');
const pixel=require('../pixel-editor.js'),artwork=require('../artwork-editor.js'),adapter=require('../character-artwork-adapter.js');
const fs=require('node:fs'),vm=require('node:vm');

function fixture(options={}){
 let sprites=options.sprites||{},writes=0;
 const calls=[],renderer={appearanceFor:id=>({characterId:id}),renderPixelFrame(...args){calls.push(args);return {frame:args[0],facing:args[2].facing};}},
  instance=adapter.create({renderer,getSprites:()=>sprites,setSprites:next=>{writes++;if(options.reject)return false;sprites=next;return true;},getTargets:()=>options.targets||[{id:'player',name:'Your avatar'},{id:'chopin',name:'Chopin'}],getProfile:id=>({name:id,shirt:'#123456'}),canEdit:()=>!options.blocked});
 return {instance,calls,get sprites(){return sprites;},get writes(){return writes;}};
}

test('character artwork converts all facings and tile edges without changing the old pixel journal',()=>{
 const points=[[63,63,'#aabbcc'],[64,63,'#11223380'],[64,64,null],[79,95,'#ffeedd']],
  texture=adapter.pixelsToTexture(points);
 assert.equal(artwork.validateTexture(texture),true);
 assert.deepEqual(Object.keys(texture.tiles).sort(),['0,0','1,0','1,1']);
 assert.deepEqual(adapter.textureToPixels(texture),points);
 const normalized=adapter.textureToPixels(artwork.changePixels({},'test',80,96,[[0,0],[1,0]],'#ABCDEFff').test);
 assert.deepEqual(normalized,[[0,0,'#abcdef'],[1,0,'#abcdef']]);
 assert.deepEqual(points[1],[64,63,'#11223380']);
});

test('sources use the unedited character renderer with the correct facing and profile',()=>{
 const f=fixture({sprites:{player:{left:[[40,45,'#ff0000']]}}}),targets=f.instance.getTargets();
 assert.equal(targets.length,8);assert.equal(targets[0].name,'Your avatar · Front');
 assert.equal(targets[0].width,80);assert.equal(targets[0].height,96);
 assert.deepEqual(f.instance.getSource('character.player.left'),{frame:'player',facing:'left'});
 assert.deepEqual(f.calls[0],['player',{name:'player',shirt:'#123456'},{facing:'left'},0,{base:true}]);
 assert.equal(f.instance.getSource('character.stranger.down'),null);
 assert.equal(f.instance.getSource('background.world'),null);
 assert.equal(f.instance.getData()['character.player.left'].tiles['0,0'][0][2],'#ff0000ff');
});

test('one character edit preserves unrelated musicians and carries transparent and partial-alpha pixels',()=>{
 const f=fixture({sprites:{bach:{up:[[2,3,'#123456']]},player:{left:[[40,45,'#ff0000']]}}}),
  data=f.instance.getData();
 delete data['character.player.left'];
 data['character.player.down']=adapter.pixelsToTexture([[40,45,'#11223380'],[41,45,null]]);
 data['background.world']={not:'owned by the character adapter'};
 assert.equal(f.instance.setData(data),true);assert.equal(f.writes,1);
 assert.deepEqual(f.sprites,{player:{down:[[40,45,'#11223380'],[41,45,null]]},bach:{up:[[2,3,'#123456']]}});
 assert.equal(f.instance.setData(f.instance.getData()),true);assert.equal(f.writes,1,'A no-op does not add an undo entry');
 assert.equal(f.instance.setData({}),true);assert.deepEqual(f.sprites,{bach:{up:[[2,3,'#123456']]}});
});

test('invalid character artwork is rejected atomically and cannot replace a working journal',()=>{
 const initial={player:{down:[[40,45,'#aabbcc']]}},f=fixture({sprites:initial}),texture=adapter.pixelsToTexture([[40,45,'#112233']]);
 for(const data of [null,[],{'character.unknown.down':texture},{'character.player.north':texture},{'character.player.down':{...texture,height:95}},{'character.player.down':{width:80,height:96,tiles:{'0,0':[[0,5000,'#112233ff']]}}}]){
  assert.equal(f.instance.onChange(data),false);assert.deepEqual(f.sprites,initial);assert.equal(f.writes,0);
 }
 const blocked=fixture({blocked:true,sprites:initial}),rejected=fixture({reject:true,sprites:initial});
 assert.equal(blocked.instance.onChange({}),false);assert.equal(blocked.writes,0);
 assert.equal(rejected.instance.onChange({}),false);assert.deepEqual(rejected.sprites,initial);
});

test('teachers, shopkeepers and visiting characters use the same validated journal',()=>{
 const ids=['haydn','riff','pip','vee-jay','zizi','metronome'];
 const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../character-renderer.js'),'utf8'),sandbox);
 const renderer=sandbox.window.createCodaCharacterRenderer(),f=fixture({targets:ids.map(id=>({id,name:id}))}),data={};
 for(const id of ids)data['character.'+id+'.down']=adapter.pixelsToTexture([[40,45,'#10203080']]);
 assert.equal(f.instance.getTargets().length,24);assert.equal(f.instance.onChange(data),true);
 assert.equal(pixel.validate(f.sprites),true);assert.equal(renderer.setPixelEdits(f.sprites),true);
 assert.deepEqual(JSON.parse(JSON.stringify(renderer.getPixelEdits())),f.sprites);
 assert.deepEqual(pixel.normalize({haydn:{down:[[0,0,'#ffffff00'],[1,1,'#AABBCCff'],[2,2,'#aabbcc80']]}}),
  {haydn:{down:[[0,0,null],[1,1,'#aabbcc'],[2,2,'#aabbcc80']]}});
});
