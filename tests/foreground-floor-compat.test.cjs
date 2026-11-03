'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const compat=require('../foreground-floor-compat.js');
const project=JSON.parse(fs.readFileSync(path.join(__dirname,'../published-world-project.json'),'utf8'));
const copy=value=>JSON.parse(JSON.stringify(value));

test('only exact historical wall selections receive render-only floor clipping',()=>{
 const before=JSON.stringify(project),historical=project.strokes.slice(0,26),paint=historical.filter(s=>s.tool==='paint'),authored=project.strokes.slice(26);
 assert.equal(paint.length,12);assert.ok(paint.every(compat.isHistoricalWallStroke));
 assert.ok(historical.filter(s=>s.tool==='erase').every(s=>!compat.isHistoricalWallStroke(s)));
 assert.equal(authored.length,10);assert.ok(authored.every(s=>!compat.isHistoricalWallStroke(s)),'Newly authored wall selections must retain their complete saved coverage');
 const known=paint.find(s=>s.selection.x===569),reordered={depth:known.depth,foreground:known.foreground,selection:{points:known.selection.points,height:known.selection.height,width:known.selection.width,y:known.selection.y,x:known.selection.x},points:known.points,size:known.size,tool:known.tool};
 assert.equal(compat.isHistoricalWallStroke(reordered),true,'Property order is not part of the stored gesture');
 for(const edit of [s=>s.depth++,s=>s.size++,s=>s.foreground=false,s=>s.points[0][0]++,s=>s.selection.points[0][0]++,s=>s.selection.width++]){const custom=copy(known);edit(custom);assert.equal(compat.isHistoricalWallStroke(custom),false,'A modified/user-authored gesture remains authoritative');}
 assert.equal(JSON.stringify(project),before,'Compatibility must never rewrite saved gestures or project data');
});

test('stale stage-wall paint leaves glass behind actors while retaining the wall face',()=>{
 const diagonal=project.strokes.find(s=>s.tool==='paint'&&s.selection?.x===569);
 assert.equal(compat.skipHistoricalFloor(diagonal,750.5,570.5),true,'Old diagonal now crosses open glass');
 assert.equal(compat.skipHistoricalFloor(diagonal,700.5,570.5),false,'Retain the current stage wall and its neon signs');
 assert.equal(compat.isFloor(450.5,500.5),true,'The deleted boutique walkway border is now glass');
 assert.equal(compat.isFloor(500.5,340.5),false,'Boutique masonry is foreground');
 const custom={tool:'paint',size:8,points:[[750,570]],depth:600,foreground:true};
 assert.equal(compat.skipHistoricalFloor(custom,750.5,570.5),false,'New intentional floor foreground paint must still work');
});

test('southwest structural source loses full colored panels while preserving its neon rail',()=>{
 const part={name:'dance_lower_wall_left'};
 assert.equal(compat.structuralFloorPixel(part,200.5,820.5),true,'Remove floor from the old wall-source polygon before it can become a lifted sprite');
 assert.equal(compat.structuralFloorPixel(part,104.5,823.5),false,'Shared reflection geometry overreaches this red neon rail');
 assert.equal(compat.structuralFloorPixel(part,119.5,829.5),false,'Keep the diagonal cap and glow');
 assert.equal(compat.structuralFloorPixel(part,240.5,860.5),false,'Keep the front masonry');
 for(const name of ['dance_lower_wall_right','dance_east_lower_wall','boutique_counter'])assert.equal(compat.structuralFloorPixel({name},200.5,820.5),false,'Other source silhouettes remain unchanged');
});
