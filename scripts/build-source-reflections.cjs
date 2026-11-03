/* Native floor-only cleanup. Known saved floor pigments are reconciled by
 * the exact-color manifest; no project journal is rebased or rewritten. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const meta=require('./reflection-floor-regions.json');
const {FLOOR,PROTECTED}=require('../wall-reflections.js');
const {clipToBounds}=require('./build-dance-floor-blend.cjs');
const {cleanupMask,build:compose}=require('./build-walkway-cleanup.cjs');

function compositorMeta(pass,value=meta){
 return {...value,...pass,preserveProject:true,allowAuthoredFloorCompatibility:true,
  polygons:FLOOR.map(polygon=>clipToBounds(polygon,pass.repairBounds)).filter(polygon=>polygon.length>=3),
  protectedPolygons:PROTECTED
 };
}
function repairMask(pass,value=meta){return cleanupMask(compositorMeta(pass,value));}
function combinedMask(value=meta){
 const mask=new Uint8Array(value.worldSize[0]*value.worldSize[1]);
 for(const pass of value.passes){const part=repairMask(pass,value);for(let i=0;i<mask.length;i++)if(part[i])mask[i]=1;}
 return mask;
}
function pngSize(bytes){
 if(bytes.length<24||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Reflection repair source must be a PNG.');
 return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
}
async function build(options={}){
 const root=path.resolve(__dirname,'..'),projectPath=path.join(root,'published-world-project.json'),before=await fs.readFile(projectPath),reports=[];
 for(const pass of meta.passes){
  const sourceSize=pngSize(await fs.readFile(path.join(root,pass.source)));
  reports.push(await compose({...options,meta:{...compositorMeta(pass),sourceSize,sourceRect:[0,0,...sourceSize]}}));
  if(!(await fs.readFile(projectPath)).equals(before))throw Error('Reflection cleanup changed the published world project.');
 }
 if(!options.previewOnly)require('./build-floor-palette-compat.cjs').generateFile({dryRun:!!options.dryRun,clearMask:combinedMask()});
 return reports;
}
if(require.main===module)build({dryRun:process.argv.includes('--dry-run'),previewOnly:process.argv.includes('--preview-mask')}).catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
module.exports={compositorMeta,repairMask,combinedMask,pngSize,build};
