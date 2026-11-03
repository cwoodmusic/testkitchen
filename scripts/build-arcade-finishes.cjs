/* Stage independent native repairs and publish one local backdrop only after
 * every pass succeeds. Authored project bytes and exact palette rules stay raw. */
'use strict';
const fs=require('node:fs/promises'),sync=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const registry=require('./arcade-finish-passes.json');
const {cleanupMask,build:compose}=require('./build-walkway-cleanup.cjs'),{pngSize}=require('./build-source-reflections.cjs');
const root=path.resolve(__dirname,'..');

function readPasses(value=registry){return value.metadata.map(file=>({file,meta:JSON.parse(sync.readFileSync(path.join(root,file),'utf8'))}));}
function combinedMask(value=registry){
 const mask=new Uint8Array(value.worldSize[0]*value.worldSize[1]);
 for(const{meta}of readPasses(value)){const part=cleanupMask(meta);for(let i=0;i<mask.length;i++)if(part[i])mask[i]=1;}
 return mask;
}
function validatePass(meta,value=registry){
 if(JSON.stringify(meta.worldSize)!==JSON.stringify(value.worldSize)||meta.output!==value.output||meta.before!==value.before||meta.beforeSha256!==value.beforeSha256)throw Error('Native finishing passes must share the reviewed world and immutable baseline.');
 const mask=cleanupMask(meta),[left,top,width,height]=meta.sourcePlacement;
 for(let i=0;i<mask.length;i++)if(mask[i]){
  const x=i%value.worldSize[0],y=Math.floor(i/value.worldSize[0]);
  if(x<left||x>=left+width||y<top||y>=top+height)throw Error('A native finishing mask extends outside its source placement.');
 }
 return mask;
}
async function build(options={}){
 const projectPath=path.join(root,'published-world-project.json'),palettePath=path.join(root,'assets/environment/floor-palette-compat.json'),outputPath=path.join(root,registry.output);
 const projectBefore=await fs.readFile(projectPath),paletteBefore=await fs.readFile(palettePath),baseline=await fs.readFile(path.join(root,registry.before));
 if(crypto.createHash('sha256').update(baseline).digest('hex')!==registry.beforeSha256)throw Error('The immutable pre-finish native backdrop changed.');
 const stageDir=await fs.mkdtemp(path.join(os.tmpdir(),'coda-arcade-finishes-')),stagePath=path.join(stageDir,'staged-arcade.png'),reports=[];
 try{
  await fs.copyFile(outputPath,stagePath);
  for(const{file,meta}of readPasses()){
   validatePass(meta);
   const sourceSize=pngSize(await fs.readFile(path.join(root,meta.source)));
   reports.push({file,...await compose({...options,meta:{...meta,output:path.relative(root,stagePath),preserveProject:true,allowAuthoredFloorCompatibility:meta.preserveAuthoredOverlap===true,sourceSize,sourceRect:[0,0,...sourceSize]}})});
   if(!(await fs.readFile(projectPath)).equals(projectBefore))throw Error('Native finishing changed the published world project.');
   if(!(await fs.readFile(palettePath)).equals(paletteBefore))throw Error('Native finishing changed exact palette compatibility.');
  }
  if(!options.dryRun&&!options.previewOnly)await fs.writeFile(outputPath,await fs.readFile(stagePath));
  return reports;
 }finally{await fs.rm(stageDir,{recursive:true,force:true});}
}
if(require.main===module)build({dryRun:process.argv.includes('--dry-run'),previewOnly:process.argv.includes('--preview-mask')}).catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
module.exports={registry,readPasses,combinedMask,validatePass,build};
