/* Native-only cleanup of the old east wall-cap outline on bare glass.
 * Exact historical palette targets and authored project data stay unchanged. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const meta=require('./east-floor-cleanup-regions.json');
const shared=require('./build-source-reflections.cjs');
const {build:compose}=require('./build-walkway-cleanup.cjs');

const repairMask=pass=>shared.repairMask(pass,meta);
const combinedMask=()=>shared.combinedMask(meta);
async function build(options={}){
 const root=path.resolve(__dirname,'..'),projectPath=path.join(root,'published-world-project.json'),palettePath=path.join(root,'assets/environment/floor-palette-compat.json');
 const projectBefore=await fs.readFile(projectPath),paletteBefore=await fs.readFile(palettePath),sourceSize=shared.pngSize(await fs.readFile(path.join(root,meta.source))),reports=[];
 for(const pass of meta.passes){
  reports.push(await compose({...options,meta:{...shared.compositorMeta(pass,meta),sourceSize,sourceRect:[0,0,...sourceSize]}}));
  if(!(await fs.readFile(projectPath)).equals(projectBefore))throw Error('East floor cleanup changed the published world project.');
  if(!(await fs.readFile(palettePath)).equals(paletteBefore))throw Error('East floor cleanup changed the existing exact palette targets.');
 }
 return reports;
}
if(require.main===module)build({dryRun:process.argv.includes('--dry-run'),previewOnly:process.argv.includes('--preview-mask')}).catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
module.exports={repairMask,combinedMask,build};
