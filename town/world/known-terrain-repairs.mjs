import {knownTerrainRepairs} from './known-terrain-repair-data.mjs?v=town-compact-island-1';

// These are the two stable object identities in the authored island. Merely
// sharing a terrain coordinate with another map never makes it a repair target.
const anchors=[['b17e11c9-9be5-4961-8139-5c3fcdec473e','coda-arcade'],['0e2162f7-e2c8-49a6-a630-f92e1bfe1321','coda-residences']];
const repairs=knownTerrainRepairs.map(([key,before,after])=>({key,before:JSON.stringify(before),after:JSON.stringify(after)}));
export const knownTerrainRepairCount=repairs.length;

/** Return an in-memory repaired island, leaving stored data and custom cells intact. */
export function normalizeKnownTerrainProject(project){
 if(!project?.cells||!Array.isArray(project.objects)||!anchors.every(([id,asset])=>project.objects.some(object=>object.id===id&&object.asset===asset)))return project;
 let cells=null;
 for(const repair of repairs){
  const current=project.cells[repair.key];
  if(!current||JSON.stringify(current)!==repair.before)continue;
  cells??={...project.cells};cells[repair.key]=JSON.parse(repair.after);
 }
 return cells?{...project,cells}:project;
}
