/* Exact old-pixel compatibility rules; never infer custom paint from its hue. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),output=path.join(root,'assets/environment/floor-palette-compat.json');
const opaque=color=>typeof color==='string'&&/^#[0-9a-f]{6}ff$/i.test(color);
function visit(texture,callback,width=1672,height=941){
 if(!texture)return;
 if(texture.width!==width||texture.height!==height)throw Error('Unexpected floor journal dimensions');
 for(const [key,runs]of Object.entries(texture.tiles))for(const [start,length,color]of runs)
  for(let index=start;index<start+length;index++)callback(key,index,color);
}
function generateManifest({previous,target,journals=[],reference,clearMask,width=1672,height=941}){
 const known=new Map(),targetPixels=new Map(),reviewedPixels=new Map();
 function remember(key,index,color,next){
  const id=key+'/'+index;let values=known.get(id);if(!values)known.set(id,values=new Map());values.set(color,next);
 }
 // Existing exact targets are authoritative. The raw export can contain old
 // colors already repaired by these rules, so it must never retarget them.
 for(const [key,rules]of Object.entries(previous?.tiles||{}))for(const [start,length,color,next]of rules)
  for(let index=start;index<start+length;index++)remember(key,index,color,next);
 visit(target,(key,index,color)=>targetPixels.set(key+'/'+index,color),width,height);
 visit(reference,(key,index,color)=>reviewedPixels.set(key+'/'+index,color),width,height);
 function eligible(id,color){
  if(!opaque(color)||reviewedPixels.get(id)!==color||!clearMask)return false;
  const split=id.lastIndexOf('/'),[tx,ty]=id.slice(0,split).split(',').map(Number),index=Number(id.slice(split+1));
  return clearMask[(ty*64+Math.floor(index/64))*width+tx*64+index%64]===1;
 }
 for(const journal of journals)visit(journal,(key,index,color)=>{
  const id=key+'/'+index,existing=known.get(id);if(existing?.has(color))return;
  const next=existing?.size?[...existing.values()].at(-1):targetPixels.get(id)??null;
  if(color!==next)remember(key,index,color,next);
 },width,height);
 // Redirect previous opaque source pigments and intermediate targets only at
 // the reviewed opaque footprint. Erasures and partial colors keep priority.
 for(const [id,colors]of known)if(eligible(id,targetPixels.get(id)))
  for(const [color,next]of [...colors])if(opaque(color)){
   colors.set(color,null);if(opaque(next))colors.set(next,null);
  }
 // Only the reviewed published pigments are seeded. A later export's new
 // custom color must not become a known old floor simply by rebuilding.
 for(const [id,color]of targetPixels)if(eligible(id,color)){
  const split=id.lastIndexOf('/');remember(id.slice(0,split),Number(id.slice(split+1)),color,null);
 }
 if(!known.size)throw Error('Seed at least one known legacy floor journal');
 const groups=new Map();
 for(const [id,colors]of known){
  const split=id.lastIndexOf('/'),tile=id.slice(0,split),index=Number(id.slice(split+1));
  for(const [color,next]of colors){
   const key=JSON.stringify([tile,color,next]);let indices=groups.get(key);if(!indices)groups.set(key,indices=[]);indices.push(index);
  }
 }
 const tiles={};
 for(const [key,indices]of [...groups].sort(([a],[b])=>a.localeCompare(b))){
  const [tile,color,next]=JSON.parse(key),rules=tiles[tile]||(tiles[tile]=[]);indices.sort((a,b)=>a-b);
  for(const index of indices){const last=rules.at(-1);
   if(last&&last[0]+last[1]===index&&last[2]===color&&last[3]===next)last[1]++;
   else rules.push([index,1,color,next]);
  }
 }
 return {version:1,width,height,tiles};
}
function generateFile(options={}){
 const target=JSON.parse(fs.readFileSync(path.join(root,'published-world-project.json'),'utf8')).artwork?.['background.world'];
 const previous=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):null;
 const meta=require('./reflection-floor-regions.json'),reference=JSON.parse(fs.readFileSync(path.join(root,meta.journalReference),'utf8'));
 const clearMask=options.clearMask||require('./build-source-reflections.cjs').combinedMask();
 const manifest=generateManifest({previous,target,journals:options.journals||[],reference,clearMask});
 const contents=JSON.stringify(manifest)+'\n';
 if(options.check){if(!fs.existsSync(output)||fs.readFileSync(output,'utf8')!==contents)throw Error('Floor palette compatibility rules are stale');}
 else if(!options.dryRun)fs.writeFileSync(output,contents);
 const report={mode:options.check?'check':options.dryRun?'preview':'write',tiles:Object.keys(manifest.tiles).length,rules:Object.values(manifest.tiles).reduce((sum,rules)=>sum+rules.length,0),bytes:Buffer.byteLength(contents)};
 process.stdout.write(JSON.stringify(report)+'\n');return {manifest,report};
}
function main(){
 const journals=[],args=process.argv.slice(2);let check=false;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--check'){check=true;continue;}
  const flag=args[i],value=args[++i];
  if(!value||!['--legacy','--legacy-ref'].includes(flag))throw Error('Use --legacy FILE, --legacy-ref COMMIT or --check');
  if(flag==='--legacy-ref'&&!/^[0-9a-f]{7,40}$/.test(value))throw Error('A legacy ref must be a commit SHA');
  let text;
  if(flag==='--legacy')text=fs.readFileSync(value,'utf8');
  else try{text=execFileSync('git',['show',value+':published-world-project.json'],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});}
  catch{throw Error('Could not read legacy commit '+value+'; Git subprocess access and the commit must be available');}
  const data=JSON.parse(text);journals.push(data.artwork?.['background.world']||data);
 }
 generateFile({journals,check});
}
if(require.main===module)try{main();}catch(error){process.stderr.write(error.stack+'\n');process.exitCode=1;}
module.exports={visit,generateManifest,generateFile};
