/* Extract the reviewed generated atlas without baking any wall pixels into props. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const fixtures=require('../wall-fixtures.js'),{run}=require('./chromium-art-task.cjs');
async function extract(sprites){
 const image=new Image();image.src='/atlas';await image.decode();
 const result={};
 for(const[name,spec]of Object.entries(sprites)){
  const {crop}=spec,canvas=document.createElement('canvas');canvas.width=crop?crop[2]:spec.width;canvas.height=crop?crop[3]:spec.height;
  const g=canvas.getContext('2d');
  if(crop)g.drawImage(image,...crop,0,0,canvas.width,canvas.height);
  else{g.translate(canvas.width/2,canvas.height/2);g.rotate(-Math.PI/2);g.font='bold 10px monospace';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#c7f7ff';g.shadowColor='#58c6dc';g.shadowBlur=3;g.fillText(spec.text,0,0);}
  result[name]=canvas.toDataURL('image/png');
 }
 return result;
}
async function build(check=false){
 const root=path.resolve(__dirname,'..'),atlas=path.join(root,fixtures.SOURCE),output=path.join(root,'assets/environment/v1/wall-fixtures');
 const images=await run({'/atlas':atlas},extract,fixtures.SPRITES),records={};await fs.mkdir(output,{recursive:true});
 for(const[name,url]of Object.entries(images)){
  const bytes=Buffer.from(url.split(',')[1],'base64'),file=path.join(output,name+'.png');
  if(check){if(!(await fs.readFile(file)).equals(bytes))throw Error('Stale wall sprite '+name);}else await fs.writeFile(file,bytes);
  records[name]=crypto.createHash('sha256').update(bytes).digest('hex');
 }
 const background=await fs.readFile(path.join(root,'assets/environment/source/empty-colored-walls.png')),target=path.join(root,'assets/environment/v1/empty-walls.png');
 if(check){if(!(await fs.readFile(target)).equals(background))throw Error('Stale empty wall background');}else await fs.writeFile(target,background);
 console.log(JSON.stringify({mode:check?'check':'write',sprites:Object.keys(records).length,sha256:records}));
}
if(require.main===module)build(process.argv.includes('--check')).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={build};
