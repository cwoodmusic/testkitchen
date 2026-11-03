/* Native-only finishing pass over reviewed glass. The reflection geometry
 * supplies the current architecture and painted-floor exclusions. */
'use strict';
const meta=require('./dance-floor-blend-regions.json');
const {FLOOR,PROTECTED}=require('../wall-reflections.js');
const {cleanupMask,build:compose}=require('./build-walkway-cleanup.cjs');

function clipToBounds(polygon,bounds){
 const [x,y,width,height]=bounds;
 let points=polygon.map(point=>point.slice());
 for(const [axis,edge,positive]of [[0,x,true],[0,x+width,false],[1,y,true],[1,y+height,false]]){
  const input=points;points=[];
  const inside=point=>positive?point[axis]>=edge:point[axis]<=edge;
  for(let i=0;i<input.length;i++){
   const a=input[i],b=input[(i+1)%input.length],aIn=inside(a),bIn=inside(b);
   if(aIn)points.push(a);
   if(aIn!==bIn){const amount=(edge-a[axis])/(b[axis]-a[axis]);points.push([a[0]+(b[0]-a[0])*amount,a[1]+(b[1]-a[1])*amount]);}
  }
 }
 return points;
}
function compositorMeta(value=meta){
 return {...value,
  polygons:FLOOR.map(polygon=>clipToBounds(polygon,value.repairBounds)).filter(polygon=>polygon.length>=3),
  protectedPolygons:[...PROTECTED,...value.protectedPolygons]
 };
}
function repairMask(value=meta){return cleanupMask(compositorMeta(value));}
async function build(options={}){return compose({...options,meta:compositorMeta()});}
if(require.main===module)build({dryRun:process.argv.includes('--dry-run'),previewOnly:process.argv.includes('--preview-mask')}).catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
module.exports={clipToBounds,compositorMeta,repairMask,build};
