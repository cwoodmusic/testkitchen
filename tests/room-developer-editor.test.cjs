const test=require('node:test'),assert=require('node:assert/strict');
const {validateProject,emptyProject}=require('../room-developer-editor.js');
const valid=doc=>validateProject(doc,{width:1000,height:620});
test('room projects keep artwork, collision, layer strokes and fish overrides together',()=>{
 const project=emptyProject();project.assets.push({id:'art-1',name:'Lantern',x:100,y:200,w:40,h:60,layer:'foreground',visible:true,origin:{bounds:[80,170,40,60],sample:[20,30]}});project.collision=[[123,0],[124,1]];project.strokes=[{tool:'paint',size:4,points:[[50,60],[52,63]]}];project.entities={'fish-slot-0':{x:600,y:400,speciesId:'bluegill',size:2,color:'#5a7fa9',accent:'#cae8ff',visible:true}};
 assert.equal(valid(project),true);assert.equal(validateProject(project,1000,620),true);
});
test('room imports reject executable artwork, unbounded images and unsafe source rectangles',()=>{
 for(const data of ['javascript:alert(1)','https://example.com/a.png','data:image/svg+xml;base64,AAAA']){const project=emptyProject();project.assets=[{id:'art-1',name:'Bad',x:30,y:40,w:20,h:20,layer:'world',visible:true,data}];assert.equal(valid(project),false);}
 for(const bounds of [[-1,0,10,10],[999,0,10,10],[0,0,1001,10]]){const project=emptyProject();project.assets=[{id:'art-1',name:'Bad',x:30,y:40,w:20,h:20,layer:'world',visible:true,origin:{bounds,sample:[0,0]}}];assert.equal(valid(project),false);}
});
test('room imports validate sparse collision cells and bounded brush points before applying',()=>{
 for(const collision of [[[6200,0]],[[1,2]],[[1,0],[1,1]],[[-1,0]]]){const project=emptyProject();project.collision=collision;assert.equal(valid(project),false);}
 for(const stroke of [{tool:'run',size:4,points:[[0,0]]},{tool:'paint',size:99,points:[[0,0]]},{tool:'paint',size:4,points:[[1001,0]]}]){const project=emptyProject();project.strokes=[stroke];assert.equal(valid(project),false);}
});
test('room imports accept only bounded data fields for fish and character changes',()=>{
 for(const patch of [{x:Infinity},{x:1001},{y:621},{size:100},{color:'url(remote)'},{speciesId:'<script>'},{code:'alert(1)'},{visible:'true'}]){const project=emptyProject();project.entities={'fish-slot-0':patch};assert.equal(valid(project),false);}
 for(const id of ['__proto__','constructor','prototype']){const project=emptyProject();project.entities=JSON.parse('{"'+id+'":{"x":500}}');assert.equal(valid(project),false);}
 assert.equal(validateProject(emptyProject(),{}),false);
});


test('room background and per-asset pixel artwork remain optional and validate before import',()=>{
 const untouched=emptyProject();assert.deepEqual(Object.keys(untouched),['version','assets','collision','strokes','entities']);
 const texture={width:1593,height:987,tiles:{'0,0':[[0,3,'#123456ff']]}};
 const project=emptyProject();project.artwork=texture;
 project.assets=[{id:'pixel-art',name:'Edited lamp',x:100,y:200,w:40,h:60,layer:'foreground',visible:true,origin:{bounds:[80,170,40,60],sample:[20,30]},artwork:{width:64,height:96,tiles:{'0,0':[[0,1,'#00000000']]}}}];
 assert.equal(valid(project),true);
 for(const bad of ['remote.png',{...texture,width:9000},{...texture,tiles:{'0,0':[[0,3,'red']]}},{...texture,tiles:{'0,0':[[0,3,'#123456ff'],[1,1,'#abcdefff']]}}]){
  const background={...project,artwork:bad};assert.equal(valid(background),false);
  const asset={...project,assets:[{...project.assets[0],artwork:bad}]};assert.equal(valid(asset),false);
 }
});
