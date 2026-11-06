import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, createStore, packColor, validateProject } from '../model.js';
import { createInteriorProject, applySceneResize } from '../workspace-ops.js';

const RED = packColor('#ff0000ff'), BLUE = packColor('#0000ff80');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
function fixture(width = 4, height = 4) {
  const store = createStore(createProject({ kind: 'asset', width, height, name: 'Editable image' }));
  const { activeSceneId: scene, activeLayerId: layer } = store.getState();
  return { store, scene, layer };
}

test('new interiors are unfurnished native rooms with separate editable floor and walls', () => {
  const project = createInteriorProject();
  assert.deepEqual(validateProject(project), project);
  assert.equal(project.assets.length, 0);
  const scene = project.scenes[0];
  assert.deepEqual([scene.kind, scene.width, scene.height, scene.pixelScale], ['interior',960,720,1]);
  assert.deepEqual(scene.layers.map(layer => [layer.name, layer.role, layer.type]), [['Floor','background','raster'],['Walls','world','raster']]);
  assert.ok(scene.layers.every(layer => layer.objects.length === 0 && !layer.locked));
  const store = createStore(project), [floor, walls] = scene.layers;
  assert.notEqual(store.readPixel(scene.id, floor.id, 500, 600), 0);
  assert.notEqual(store.readPixel(scene.id, walls.id, 500, 20), 0);
  assert.equal(store.readPixel(scene.id, walls.id, 500, 600), 0);
  assert.notEqual(store.readPixel(scene.id, walls.id, 500, 157), store.readPixel(scene.id, walls.id, 500, 20));
  assert.deepEqual(createInteriorProject({ name: 'Tiny room', width: 1, height: 1 }).scenes[0].layers.map(layer => layer.name), ['Floor','Walls']);
});

test('canvas enlargement is transparent, top-left aligned, and undone as one edit', () => {
  const { store, scene, layer } = fixture();
  store.fillLayer(scene, layer, RED);
  store.writePixels(scene, layer, [[1,1,BLUE],[3,3,0]]);
  const before = store.serialize();
  const result = applySceneResize(store, scene, { width: 6, height: 5, mode: 'canvas' });
  assert.equal(result.changed, true);
  assert.equal(store.readPixel(scene, layer, 0, 0), RED);
  assert.equal(store.readPixel(scene, layer, 1, 1), BLUE);
  assert.equal(store.readPixel(scene, layer, 3, 3), 0);
  assert.equal(store.readPixel(scene, layer, 4, 0), 0);
  assert.equal(store.readPixel(scene, layer, 0, 4), 0);
  const after = store.serialize();
  store.undo(); assert.deepEqual(store.serialize(), before);
  store.redo(); assert.deepEqual(store.serialize(), after);
  store.undo(); store.undo();
  assert.equal(store.readPixel(scene, layer, 1, 1), RED, 'the earlier paint edit remains in history');
});

test('canvas cropping removes outside raster tiles and collision, preserves objects and clamps anchor', () => {
  const { store, scene, layer } = fixture(130,130);
  store.writePixels(scene, layer, [[0,0,RED],[100,100,BLUE],[64,64,RED]]);
  store.setCollision(scene, [[0,0,0],[12,12,0],[5,5,1]]);
  const asset = store.addAsset({ name: 'Placed', width:1, height:1, dataURL:PNG, tags:['tile','floor'] });
  const objects = store.addLayer(scene, { type:'objects', name:'Props' });
  store.addObject(scene, objects, { assetId:asset, x:100, y:110, anchor:{x:.4,y:.7} });
  const before = store.serialize();
  applySceneResize(store, scene, { width:60, height:60 });
  const resized = store.serialize();
  assert.equal(store.readPixel(scene, layer, 0,0), RED);
  assert.deepEqual(Object.keys(resized.scenes[0].layers[0].tiles), ['0,0']);
  assert.deepEqual(resized.scenes[0].collision.cells, {'0,0':0,'5,5':1});
  assert.deepEqual(resized.scenes[0].anchor, {x:60,y:60});
  assert.deepEqual(resized.scenes[0].layers[1].objects, before.scenes[0].layers[1].objects);
  assert.deepEqual(resized.assets, before.assets);
  assert.deepEqual(validateProject(resized), resized);
  store.undo(); assert.deepEqual(store.serialize(), before);
});

test('nearest scale retains RGBA, layer settings, object transforms, and other scenes', () => {
  const { store, scene, layer } = fixture(2,2);
  store.writePixels(scene, layer, [[0,0,RED],[1,0,BLUE],[0,1,0],[1,1,0x10203040]]);
  store.updateLayer(scene, layer, { name:'Paint', role:'foreground', opacity:.5, blend:'multiply', visible:false, locked:true });
  const asset = store.addAsset({ name:'Sample',width:1,height:1,dataURL:PNG,tags:['tile','wallpaper'] });
  const objects = store.addLayer(scene,{type:'objects',name:'Furniture'});
  store.addObject(scene, objects, {assetId:asset,x:1,y:1,w:1,h:2,depthOffset:2,anchor:{x:.3,y:.8},rotation:90,flipX:true});
  store.updateLayer(scene, objects, {locked:true});
  store.addScene({name:'Leave alone',kind:'map',width:10,height:10});
  const before = store.serialize();
  applySceneResize(store, scene, { width:4,height:4,mode:'scale' });
  const after = store.serialize();
  for(let y=0;y<4;y++)for(let x=0;x<4;x++) {
    const expected=[[RED,BLUE],[0,0x10203040]][Math.floor((y+.5)*2/4)][Math.floor((x+.5)*2/4)];
    assert.equal(store.readPixel(scene, layer, x,y), expected);
  }
  const image=after.scenes[0], object=image.layers[1].objects[0];
  assert.deepEqual([object.x,object.y,object.w,object.h,object.depthOffset],[2,2,2,4,4]);
  const originalObject=before.scenes[0].layers[1].objects[0];
  assert.deepEqual([object.x+object.w/2,object.y+object.h/2],
    [(originalObject.x+originalObject.w/2)*2,(originalObject.y+originalObject.h/2)*2], 'uniform resize scales the rotated visual center');
  assert.deepEqual(object.anchor,{x:.3,y:.8}); assert.equal(object.rotation,90); assert.equal(object.flipX,true);
  assert.ok(image.layers.every(layer=>layer.locked));
  assert.deepEqual([image.layers[0].name,image.layers[0].role,image.layers[0].opacity,image.layers[0].blend,image.layers[0].visible],['Paint','foreground',.5,'multiply',false]);
  assert.deepEqual(after.scenes[1],before.scenes[1]); assert.deepEqual(after.assets,before.assets);
  assert.equal(after.activeSceneId,before.activeSceneId);
  store.undo(); assert.deepEqual(store.serialize(),before);
  store.redo(); assert.deepEqual(store.serialize(),after);
});

test('nonuniform scaling rejects rotated assets before changing artwork or undo history', () => {
  for (const rotation of [90,45,-30,270,360.25]) {
    const {store,scene,layer}=fixture(2,2);
    store.writePixels(scene,layer,[[1,1,BLUE]]);
    const asset=store.addAsset({name:'Rotated artwork',width:1,height:1,dataURL:PNG});
    const objects=store.addLayer(scene,{type:'objects',name:'Props'});
    store.addObject(scene,objects,{assetId:asset,x:.25,y:.5,w:1,h:1.5,rotation});
    const before=store.serialize(), state=store.getState();
    assert.throws(()=>applySceneResize(store,scene,{width:4,height:6,mode:'scale'}),/same proportions.*reset their rotation/i);
    assert.deepEqual(store.serialize(),before);
    assert.equal(store.getState().revision,state.revision);
    assert.equal(store.getState().historyBytes,state.historyBytes);
    assert.equal(store.getState().inTransaction,false);
    store.undo();
    assert.equal(store.serialize().scenes[0].layers[1].objects.length,0,'the preceding placement remains undoable');
  }
  const {store,scene}=fixture(2,2);
  const asset=store.addAsset({name:'Half turn',width:1,height:1,dataURL:PNG});
  const objects=store.addLayer(scene,{type:'objects',name:'Props'});
  store.addObject(scene,objects,{assetId:asset,x:1,y:1,w:1,h:1,rotation:180});
  applySceneResize(store,scene,{width:4,height:6,mode:'scale'});
  const object=store.serialize().scenes[0].layers[1].objects[0];
  assert.deepEqual([object.x,object.y,object.w,object.h,object.rotation],[2,3,2,3,180]);
});

test('scaled collision covers source geometry and blocked cells win open overlaps', () => {
  const {store,scene}=fixture(20,10);
  store.setCollision(scene,[[0,0,0],[1,0,1]]);
  const before=store.serialize();
  applySceneResize(store,scene,{width:5,height:5,mode:'scale'});
  assert.deepEqual(store.serialize().scenes[0].collision.cells,{'0,0':0});
  store.undo(); assert.deepEqual(store.serialize(),before);
  applySceneResize(store,scene,{width:40,height:20,mode:'scale'});
  assert.deepEqual(store.serialize().scenes[0].collision.cells,{'0,0':0,'1,0':0,'0,1':0,'1,1':0,'2,0':1,'3,0':1,'2,1':1,'3,1':1});
});

test('validation and resize limits preserve document and history; current strokes stay owned', () => {
  const {store,scene,layer}=fixture();
  store.writePixels(scene,layer,[[1,1,RED]]);
  const before=store.serialize(), revision=store.getState().revision;
  for(const spec of [{width:0,height:2},{width:3.5,height:2},{width:8193,height:1},{width:3,height:3,mode:'wrong'},{width:4096,height:4096}]) {
    assert.throws(()=>applySceneResize(store,scene,spec));
    assert.deepEqual(store.serialize(),before); assert.equal(store.getState().revision,revision);
  }
  assert.deepEqual(applySceneResize(store,scene,{width:4,height:4}),{width:4,height:4,mode:'canvas',changed:false});
  assert.equal(store.getState().revision,revision);
  store.begin('Still painting'); store.writePixels(scene,layer,[[2,2,BLUE]]);
  assert.throws(()=>applySceneResize(store,scene,{width:5,height:5}),/current stroke/);
  assert.equal(store.getState().inTransaction,true); assert.equal(store.readPixel(scene,layer,2,2),BLUE);
  store.cancel(); assert.deepEqual(store.serialize(),before);
  store.undo(); assert.equal(store.readPixel(scene,layer,1,1),0);
});

test('unexpected write failures roll back the complete resize and retain prior undo', () => {
  const {store,scene,layer}=fixture(); store.writePixels(scene,layer,[[1,1,RED]]);
  const before=store.serialize();
  const failing={...store,writePixels(){throw new Error('Synthetic write failure');}};
  assert.throws(()=>applySceneResize(failing,scene,{width:5,height:5}),/Synthetic/);
  assert.equal(store.getState().inTransaction,false); assert.deepEqual(store.serialize(),before);
  store.undo(); assert.equal(store.readPixel(scene,layer,1,1),0);
});
