/* The lounge gets the same navy glass as the main floor. Only reviewed native
 * floor pixels change; placed rugs, furniture and saved paint stay independent. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const meta=require('./lounge-floor-regions.json');
const {inside}=require('./build-cosmic-floor.cjs');
const {pngSize}=require('./build-source-reflections.cjs');
const {cleanupMask,build:compose}=require('./build-walkway-cleanup.cjs');

const loungeMask=()=>cleanupMask(meta);
const isLoungeFloor=(x,y)=>meta.polygons.some(polygon=>inside(polygon,x,y));
async function build(options={}){
 const root=path.resolve(__dirname,'..'),projectPath=path.join(root,'published-world-project.json'),palettePath=path.join(root,'assets/environment/floor-palette-compat.json');
 const projectBefore=await fs.readFile(projectPath),paletteBefore=await fs.readFile(palettePath),baseline=await fs.readFile(path.join(root,meta.before));
 if(crypto.createHash('sha256').update(baseline).digest('hex')!==meta.beforeSha256)throw Error('The immutable pre-glass lounge backdrop changed.');
 const sourceSize=pngSize(await fs.readFile(path.join(root,meta.source)));
 const report=await compose({...options,meta:{...meta,preserveProject:true,sourceSize,sourceRect:[0,0,...sourceSize]}});
 if(!(await fs.readFile(projectPath)).equals(projectBefore))throw Error('Lounge floor replacement changed the published world project.');
 if(!(await fs.readFile(palettePath)).equals(paletteBefore))throw Error('Lounge floor replacement changed existing palette compatibility.');
 return report;
}
if(require.main===module)build({dryRun:process.argv.includes('--dry-run'),previewOnly:process.argv.includes('--preview-mask')}).catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
module.exports={loungeMask,isLoungeFloor,build};
