import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeKnownTerrainProject,knownTerrainRepairCount} from './known-terrain-repairs.mjs';
import {knownTerrainRepairs} from './known-terrain-repair-data.mjs';
import {knownSouthwestCoastRepairs} from './southwest-coast-repair-data.mjs';
import {parseProject} from './model.mjs';
import {readPaint} from './ground-paint.mjs';
import {height} from './model.mjs';
import {decodeMask} from './organic-mask.mjs';

const current=()=>JSON.parse(readFileSync(new URL('../maps/coda-town-plaza-boardwalk.json',import.meta.url)));
const old=()=>{const project=current();for(const[key,before]of knownSouthwestCoastRepairs)project.cells[key]=structuredClone(before);for(const[key,before]of knownTerrainRepairs)project.cells[key]=structuredClone(before);return project;};

test('the complete authored island repair changes only the exact known defective cells in memory',()=>{
 const project=old(),raw=JSON.stringify(project),fixed=normalizeKnownTerrainProject(project);assert.equal(knownTerrainRepairCount,987);assert.notEqual(fixed,project);assert.equal(JSON.stringify(project),raw,'Loading a repair must never mutate the saved/recovery project');
 assert.deepEqual(fixed,current());for(const key of ['objects','spawn','edges'])assert.equal(fixed[key],project[key]);
 const affected=new Set([...knownTerrainRepairs,...knownSouthwestCoastRepairs].map(([key])=>key));for(const[key,cell]of Object.entries(project.cells))if(!affected.has(key))assert.equal(fixed.cells[key],cell);
 for(const[key,cell]of Object.entries(project.cells))if(cell.stairs||cell.bridge||cell.pier)assert.deepEqual(fixed.cells[key],cell,'Every authored stair flight, bridge and landing retains its physical geometry');
 assert.equal(normalizeKnownTerrainProject(fixed),fixed,'The repaired map is idempotent');
});

test('later custom painting, contours and unrelated maps remain untouched',()=>{
 const project=old(),[paint]=knownTerrainRepairs.filter(([,before])=>before.paint&&!before.curves),[contour]=knownTerrainRepairs.filter(([,before])=>before.curves);assert(paint&&contour);
 project.cells[paint[0]]={...project.cells[paint[0]],surface:'wood'};project.cells[contour[0]]=structuredClone(project.cells[contour[0]]);project.cells[contour[0]].curves[0].style='rocky';
 const raw=JSON.stringify(project),fixed=normalizeKnownTerrainProject(project);assert.equal(fixed.cells[paint[0]],project.cells[paint[0]]);assert.equal(fixed.cells[contour[0]],project.cells[contour[0]]);assert.equal(JSON.stringify(project),raw);
 const unrelated=old();unrelated.objects=unrelated.objects.filter(object=>object.asset!=='coda-residences');assert.equal(normalizeKnownTerrainProject(unrelated),unrelated);assert.equal(normalizeKnownTerrainProject(null),null);
});

test('the repaired portable map retains every asset and valid terrain weights and contours',()=>{
 const project=normalizeKnownTerrainProject(old()),ids=new Set(project.objects.map(object=>object.asset));assert.deepEqual(parseProject(JSON.stringify(project),ids),project);
 for(const key of ['118,168','125,168','132,169']){const field=readPaint(project.cells[key]),grass=field.materials.findIndex(material=>material.surface==='grass');if(grass>=0)for(let i=0;i<256;i++)assert.equal(field.weights[i*field.materials.length+grass],0,key+' leaves no detached grass band across the beach');}
});

test('the reported east-coast rock rectangle becomes a continuous shoreline and nearby square corners move at most16px',()=>{
 const project=normalizeKnownTerrainProject(old()),notch=project.cells['242,114'],shore=project.cells['242,115'],bits=decodeMask(shore.curves[0].mask);assert.equal(notch.surface,'grass');assert.equal(notch.level,8);assert.equal(notch.curves,undefined);
 for(let x=0;x<16;x++){
  assert.equal(bits[x],1);assert.equal(bits[240+x],x<13?1:0);
  const X=242*64+x*4+2;assert.equal(height(project,X,114*64-.05),height(project,X,114*64+.05),'The north coast no longer drops384px through a square water gap');
  assert.equal(height(project,X,115*64-.05),height(project,X,115*64+.05),'The former water notch stays fully raised through its southern edge');
  assert.equal(height(project,X,116*64-.05),height(project,X,116*64+.05),'The tapered south shore joins its existing13-column organic edge');
 }
 let fillets=0;
 for(const[key,before,after]of knownTerrainRepairs){
  if(key==='242,114'||before.curves||!after.curves||after.curves[0].under.surface!=='water')continue;
  const kept=Array.from(decodeMask(after.curves[0].mask)).reduce((sum,value)=>sum+value,0),changed=before.surface==='water'?kept:256-kept;
  assert(changed>0&&changed<=12,key+': existing plain coast corners only receive small16px fillets');fillets++;
 }
 assert(fillets>0);
});
