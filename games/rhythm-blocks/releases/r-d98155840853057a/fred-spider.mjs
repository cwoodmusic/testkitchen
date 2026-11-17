import {CAMPAIGN_SCENES} from './campaign-scenes.mjs';

export const FRED_SPIDER_ROOM='workshop-alcove';
export const FRED_SPIDER_ID='workshop-alcove-fred';
const clone=value=>JSON.parse(JSON.stringify(value));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const shape=scene=>({
 image:scene?.image,layoutRevision:scene?.layoutRevision,layoutKind:scene?.layoutKind,
 actors:scene?.actors,occluders:scene?.occluders,geometry:scene?.geometry,
 objects:scene?.objects?.map(({id,type,rect,sourceId,doorId,revealAfter})=>({id,type,rect,sourceId,doorId,revealAfter})),
});

/** Add an optional discovery to fresh defaults or untouched stock room layouts.
 * Existing Fred entries are left alone, including partial author edits. Setting
 * scene.fredSpider to false or null also opts out. Custom art/layouts are skipped.
 */
export function addFredSpider(project){
 if(!project||typeof project!=='object')return project;
 const result=clone(project),scene=result?.scenes?.[FRED_SPIDER_ROOM],content=result?.content?.[FRED_SPIDER_ROOM];
 if(!scene||!content||!Array.isArray(content.inspections)||scene.fredSpider===false||scene.fredSpider===null||scene.fredSpider==='fred-spider-1')return result;
 if([scene.objects,scene.geometry?.targets,content.inspections].some(list=>list?.some(entry=>entry?.id===FRED_SPIDER_ID)))return result;
 if(!same(shape(scene),shape(CAMPAIGN_SCENES[FRED_SPIDER_ROOM])))return result;
 if(!['nell','iris','pip'].every(id=>content.people?.some(person=>person.id===id)))return result;
 scene.fredSpider='fred-spider-1';
 scene.objects.push({id:FRED_SPIDER_ID,type:'inspect',label:'A tiny movement',actionLabel:'Look beside the cupboard',rect:{x:332,y:558,width:56,height:44}});
 scene.geometry.targets.push({id:FRED_SPIDER_ID,type:'inspect',label:'Look beside the cupboard',x:360,y:580,approach:{x:360,y:615},range:80});
 content.inspections.push({
  id:FRED_SPIDER_ID,title:'Fred the wolf spider',label:'Look beside the cupboard',
  text:'Fred rests beside the cupboard. This small wolf spider hunts insects on the floor instead of catching them in a web.',
  dialogue:[
   {id:'fred-pip',speaker:'pip',text:'Something moved by the cupboard. It has quite a lot of legs.'},
   {id:'fred-mira',speaker:'mira',text:'Hello, Fred! You look like a Fred. Please excuse our enormous feet.'},
   {id:'fred-iris',speaker:'iris',text:'A wolf spider. He hunts insects on the ground, without a catching web.'},
   {id:'fred-nell',speaker:'nell',text:'Then let us leave Fred to his work. Mind where you step.'},
  ],
 });
 return result;
}
