/** The scene script editor adapted to a short discussion attached to an inspection. */
import {createCutsceneDialogueEditor} from './cutscene-dialogue-editor.mjs';
import {getSceneDialogue} from './cutscene-dialogue.mjs';
import {compileObjectDialogue,OBJECT_DIALOGUE_MAX_LINES} from './object-dialogue.mjs';

const clone=value=>structuredClone(value);
const MAX_LINES=OBJECT_DIALOGUE_MAX_LINES;

export function createObjectDialogueEditor({document=globalThis.document,roomId,entry,content,scene,state={},onChange=mutation=>mutation(),onPreview=()=>{},onPending=()=>{}}={}){
  const rows=Array.isArray(entry.dialogue)?entry.dialogue:[];
  const local=new Set(['mira',...(scene.actors??[]).map(actor=>actor.id)]);
  const adapter={people:(content.people??[]).filter(person=>local.has(person.id)),cutscene:compileObjectDialogue({entry,scene,includeBlank:true})};
  if(state.objectLineId){const selected=adapter.cutscene.findIndex(clip=>clip.id===state.objectLineId);if(selected>=0)state.selectedIndex=selected;}
  const originals=new Map(adapter.cutscene.map((clip,index)=>[clip.id,clone(rows[index]??{})]));
  let destroyed=false;
  const script=createCutsceneDialogueEditor({document,roomId,scene,content:adapter,state,onPending,
    onSelection:selection=>{state.objectLineId=selection?adapter.cutscene[selection.clipIndex]?.id:null;},
    onChange(mutation,options){
      const previous=adapter.cutscene;
      try{
        mutation();
        if(adapter.cutscene.length>MAX_LINES)throw new RangeError(`An object discussion can contain at most ${MAX_LINES} lines.`);
        const next=getSceneDialogue({scene,beats:adapter.cutscene}).map(({index})=>{
          const clip=adapter.cutscene[index],authored={...clone(originals.get(clip.id)??{}),...clone(clip)};
          // Array order owns object conversations. These fields belong to the adapter.
          for(const key of ['kind','actor','startTile']){
            if(Object.hasOwn(originals.get(clip.id)??{},key))authored[key]=clone(originals.get(clip.id)[key]);else delete authored[key];
          }
          return authored;
        });
        onChange(()=>{entry.dialogue=next;},options);
        for(const row of next)originals.set(row.id,clone(row));
      }catch(error){adapter.cutscene=previous;throw error;}
    },
    onPreview:options=>onPreview({...options,interactionId:entry.id}),
  });
  const element=script.element;element.id='developer-object-dialogue';element.dataset.interactionId=entry.id;element.dataset.dialogueLimit=String(MAX_LINES);
  element.querySelector('.csd-heading h3').textContent='Object discussion';
  element.querySelector('.csd-heading p').textContent='The party speaks when the player inspects this object.';
  const limit=document.createElement('p');limit.className='dc-muted';element.querySelector('.csd-heading').append(limit);
  function refreshControls(){
    if(destroyed)return;
    const add=element.querySelector('#developer-cutscene-dialogue-add');if(add)add.disabled=adapter.cutscene.length>=MAX_LINES;
    const count=`${adapter.cutscene.length} / ${MAX_LINES} lines. Leave the list empty to show the observation alone.`;if(limit.textContent!==count)limit.textContent=count;
    const help=element.querySelector('.csd-detail>.dc-muted');if(help&&help.textContent!=='Lines play in this order. Reactions and props are optional.')help.textContent='Lines play in this order. Reactions and props are optional.';
  }
  const Observer=document.defaultView?.MutationObserver,observer=Observer?new Observer(refreshControls):null;
  observer?.observe(element,{childList:true,subtree:true});refreshControls();
  return{element,state,flush:()=>script.flush(),selectActor:id=>script.selectActor(id),selectClip:(index,options)=>script.selectClip(index,options),get hasPending(){return script.hasPending;},destroy(){if(destroyed)return;script.flush();destroyed=true;observer?.disconnect();script.destroy();}};
}
