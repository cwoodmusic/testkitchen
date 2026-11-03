/* Remove only the old passage neon and its baked floor streak. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const meta=require('./passage-transition-cleanup-regions.json');
const {inside}=require('./build-cosmic-floor.cjs'),{pngSize}=require('./build-source-reflections.cjs');
const {cleanupMask,build:compose}=require('./build-walkway-cleanup.cjs');

const passageTransitionMask=()=>cleanupMask(meta);
const isPassageTransitionArea=(x,y)=>meta.polygons.some(polygon=>inside(polygon,x,y));
async function build(options={}){
 const root=path.resolve(__dirname,'..'),projectPath=path.join(root,'published-world-project.json'),palettePath=path.join(root,'assets/environment/floor-palette-compat.json');
 const projectBefore=await fs.readFile(projectPath),paletteBefore=await fs.readFile(palettePath),baseline=await fs.readFile(path.join(root,meta.before));
 if(crypto.createHash('sha256').update(baseline).digest('hex')!==meta.beforeSha256)throw Error('The immutable pre-transition-cleanup backdrop changed.');
 const sourceSize=pngSize(await fs.readFile(path.join(root,meta.source)));
 const report=await compose({...options,meta:{...meta,preserveProject:true,allowAuthoredFloorCompatibility:true,sourceSize,sourceRect:[0,0,...sourceSize]}});
 if(!(await fs.readFile(projectPath)).equals(projectBefore))throw Error('Passage transition cleanup changed the published world project.');
 if(!(await fs.readFile(palettePath)).equals(paletteBefore))throw Error('Passage transition cleanup changed existing palette compatibility.');
 return report;
}
if(require.main===module)build({dryRun:process.argv.includes('--dry-run'),previewOnly:process.argv.includes('--preview-mask')}).catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
module.exports={passageTransitionMask,isPassageTransitionArea,build};
