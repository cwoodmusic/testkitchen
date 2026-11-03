/* New artwork lives beside the original cutouts, never replacing their sources. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const style=require('../pixel-style.js'),library=require('../decor-library.js');
const {run}=require('./chromium-art-task.cjs');
const {extract,alphaBounds,gridCells,fitRect}=require('./build-lounge-assets.cjs');
async function build(check=false){
 const root=path.resolve(__dirname,'..'),files={},sources=[];
 for(const [i,sheet]of style.SHEETS.entries()){
  files['/source/'+i]=path.join(root,sheet.source);
  const data=await fs.readFile(files['/source/'+i]);sources.push({path:sheet.source,sha256:crypto.createHash('sha256').update(data).digest('hex')});
 }
 const meta={sheets:style.SHEETS,alphaThreshold:8,items:library.items.filter(item=>style.has(item.id)),bottomAligned:library.items.filter(item=>['floor','furniture'].includes(item.category)).map(item=>item.id)};
 const images=await run(files,extract,meta,[alphaBounds,gridCells,fitRect]);
 const records=[];
 for(const image of images){
  const {data,...record}=image,bytes=Buffer.from(data.split(',')[1],'base64'),output='assets/decor/handdrawn/v1/'+image.id+'.png',target=path.join(root,output);
  if(check){if(!(await fs.readFile(target)).equals(bytes))throw Error('Stale hand-drawn sprite: '+image.id);}
  else{await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);}
  records.push({...record,output,facing:style.facing(image.id,image.category),sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
 }
 const manifest=JSON.stringify({version:1,style:'hand-drawn pixel art',sources,items:records},null,2)+'\n',target=path.join(root,'assets/decor/handdrawn-assets.json');
 if(check){if(await fs.readFile(target,'utf8')!==manifest)throw Error('Stale hand-drawn provenance manifest');}else await fs.writeFile(target,manifest);
 console.log(JSON.stringify({mode:check?'check':'write',items:records.length,sources:sources.length}));
}
if(require.main===module)build(process.argv.includes('--check')).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={build};
