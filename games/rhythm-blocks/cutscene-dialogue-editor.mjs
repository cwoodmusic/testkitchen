/** Script editing for the same independently timed Text clips used by the director. */
import {separateCutsceneTracks} from './cutscene.mjs';
import {getSceneDialogue,pinCutsceneTiming,updateDialogue,insertDialogue,removeDialogue,moveDialogue} from './cutscene-dialogue.mjs';

export function createCutsceneDialogueEditor({document=globalThis.document,roomId,content,scene,state={},onChange=mutation=>mutation(),onPreview=()=>{},onSelection=()=>{},onPending=()=>{}}={}){
  const element=document.createElement('section');element.className='dc-card csd-editor';element.id='developer-cutscene-dialogue';
  let destroyed=false,buffer=null,textbox=null,counter=null,lines=[],previewRevision=0;
  const el=(tag,className='',text='')=>{const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node;};
  const button=(label,id,callback)=>{const node=el('button','mg-button',label);node.type='button';if(id)node.id=id;node.addEventListener('click',callback);return node;};
  const beats=()=>Array.isArray(content.cutscene)?content.cutscene:[];
  if(beats().some(beat=>!beat.kind)){
    const selectedId=beats()[state.selectedIndex]?.id;
    try{content.cutscene=separateCutsceneTracks({scene,beats:beats(),playerPosition:scene.geometry.start});if(selectedId)state.selectedIndex=beats().findIndex(beat=>beat.id===selectedId);}catch{/* Invalid drafts remain editable. */}
  }
  const actorIds=[...new Set(['mira',...(scene.actors??[]).map(actor=>actor.id)])];
  const speakerIds=[...new Set([...actorIds,...(content.people??[]).map(person=>person.id)])];
  const actorName=id=>id==='mira'?'Mira':content.people?.find(person=>person.id===id)?.name??id;
  const heading=el('div','csd-heading');heading.append(el('h3','','Scene dialogue'),el('p','dc-muted','Click a line or a character in the room to edit what they say.'));
  const layout=el('div','csd-layout'),script=el('section','csd-script'),list=el('div','csd-lines'),detail=el('section','csd-detail');
  list.id='developer-cutscene-dialogue-lines';list.setAttribute('role','group');list.setAttribute('aria-label','Dialogue in speaking order');
  const add=button('+ Add line','developer-cutscene-dialogue-add',()=>addLine());script.append(list,add);layout.append(script,detail);
  const error=el('p','cse-error');error.hidden=true;error.setAttribute('role','status');element.append(heading,layout,error);
  const current=()=>lines.find(line=>line.index===state.selectedIndex);
  const pinned=()=>pinCutsceneTiming({scene,beats:beats()});
  const refresh=()=>{
    try{lines=getSceneDialogue({scene,beats:beats()});}
    catch(reason){
      showError(reason);lines=beats().flatMap((beat,index)=>beat.kind==='dialogue'?[{...beat,index,speaker:beat.speaker??beat.actor,text:beat.text??'',startTile:beat.startTile??0,durationTiles:beat.durationTiles??1}]:[]).sort((a,b)=>a.startTile-b.startTile||a.index-b.index);
    }
    if(!current())state.selectedIndex=lines[0]?.index??-1;
  };
  function showError(reason){error.hidden=false;error.textContent=reason?.message??String(reason);}
  function notify(){const line=current();onSelection(line?{roomId,clipIndex:line.index,actorId:line.speaker,kind:'dialogue'}:null);}
  function commit(next){
    if(destroyed||next===beats())return false;
    error.hidden=true;previewRevision++;onChange(()=>{content.cutscene=next;},{repaint:false});refresh();return true;
  }
  function paintCount(){if(counter&&textbox)counter.textContent=`${textbox.value.length} / 600`;}
  function flush(){
    if(destroyed||!buffer)return true;
    const pending=buffer;buffer=null;element.dataset.pending='false';
    try{if(beats()[pending.index]?.text!==pending.text)commit(updateDialogue(pinned(),pending.index,{text:pending.text}));onPending();return true;}
    catch(reason){buffer=pending;element.dataset.pending='true';showError(reason);onPending();return false;}
  }
  function selectClip(index,{focus=false}={}){
    if(!flush()||destroyed)return false;refresh();if(!lines.some(line=>line.index===index))return false;
    state.selectedIndex=index;state.dialogueSpeaker=current().speaker;render();notify();
    if(focus)list.querySelector(`[data-cutscene-dialogue-index="${index}"]`)?.focus({preventScroll:true});return true;
  }
  function addLine(speaker){
    if(!flush()||destroyed)return false;
    try{
      const before=new Set(beats().map(beat=>beat.id)),chosen=speakerIds.includes(speaker)?speaker:current()?.speaker??state.dialogueSpeaker??'mira';
      const next=insertDialogue({scene,beats:pinned(),afterIndex:current()?.index,speaker:speakerIds.includes(chosen)?chosen:'mira'});
      const index=next.findIndex(beat=>beat.kind==='dialogue'&&!before.has(beat.id));
      commit(next);if(index>=0)state.selectedIndex=index;render();notify();textbox?.focus({preventScroll:true});return true;
    }catch(reason){showError(reason);return false;}
  }
  function selectActor(id){
    if(!actorIds.includes(id)||!flush())return false;refresh();state.dialogueSpeaker=id;
    const selected=current();if(selected?.speaker===id)return selectClip(selected.index);
    const matching=lines.find(line=>line.speaker===id);return matching?selectClip(matching.index):addLine(id);
  }
  function changeSpeaker(speaker){
    if(!flush()||!current())return;
    try{commit(updateDialogue(pinned(),current().index,{speaker}));state.dialogueSpeaker=speaker;render();notify();}catch(reason){showError(reason);}
  }
  function removeLine(){
    if(!flush()||!current())return;
    const position=lines.findIndex(line=>line.index===state.selectedIndex);
    try{commit(removeDialogue(pinned(),state.selectedIndex));state.selectedIndex=lines[Math.min(position,lines.length-1)]?.index??-1;render();notify();}catch(reason){showError(reason);}
  }
  function moveLine(direction){
    if(!flush()||!current())return;
    try{commit(moveDialogue({scene,beats:pinned(),index:state.selectedIndex,direction}));render();notify();}catch(reason){showError(reason);}
  }
  async function preview(){
    if(!flush()||!current())return;error.hidden=true;state.currentTile=current().startTile;const revision=++previewRevision;
    try{const result=await onPreview({command:'seek',tile:state.currentTile});if(destroyed||revision!==previewRevision)return;if(result===false)throw Error('The scene preview is unavailable.');await onPreview({command:'play',tile:state.currentTile});if(!destroyed&&revision===previewRevision)state.playing=true;}
    catch(reason){showError(reason);state.playing=false;}
  }
  async function stop(){previewRevision++;try{await onPreview({command:'stop'});state.playing=false;}catch(reason){showError(reason);}}
  function renderList(){
    const previousScroll=list.scrollTop;list.replaceChildren();add.disabled=beats().length>=384;
    if(!lines.length){list.append(el('p','csd-empty','No dialogue yet. Add a line to start the conversation.'));return;}
    lines.forEach((line,position)=>{
      const item=button('',null,()=>selectClip(line.index));item.className='csd-line';item.dataset.cutsceneDialogueIndex=String(line.index);item.setAttribute('aria-pressed',String(line.index===state.selectedIndex));
      const words=buffer?.index===line.index?buffer.text:line.text;
      item.append(el('span','csd-line-number',String(position+1).padStart(2,'0')),el('strong','csd-line-speaker',actorName(line.speaker)),el('span','csd-line-words',words.trim()?words:'Empty line — write dialogue'));
      list.append(item);
    });list.scrollTop=previousScroll;
  }
  function renderDetail(){
    detail.replaceChildren();textbox=null;counter=null;const line=current();
    if(!line){detail.append(el('p','csd-empty','Each line has its own speaker. Walking, emotes and actions can still be edited in Timeline.'));return;}
    const index=lines.findIndex(item=>item.index===line.index),title=el('h4','',`Line ${index+1} of ${lines.length}`);
    const label=el('div','dc-field'),speakers=el('div','cse-chips');label.append(el('span','','Who speaks'),speakers);speakers.id='developer-cutscene-dialogue-speaker';speakers.setAttribute('role','group');speakers.setAttribute('aria-label','Who speaks');
    for(const actor of speakerIds){const choice=button(actorName(actor),null,()=>changeSpeaker(actor));choice.dataset.dialogueSpeaker=actor;choice.setAttribute('aria-pressed',String(actor===line.speaker));speakers.append(choice);}
    const field=el('label','dc-field'),fieldHeading=el('span','csd-text-label','Dialogue');counter=el('output','csd-count');counter.id='developer-cutscene-dialogue-count';fieldHeading.append(counter);
    textbox=el('textarea');textbox.id='developer-cutscene-dialogue-text';textbox.rows=7;textbox.maxLength=600;textbox.value=line.text;textbox.placeholder='What do they say?';textbox.setAttribute('aria-describedby',counter.id);
    textbox.addEventListener('input',()=>{buffer={index:line.index,text:textbox.value};element.dataset.pending=String(textbox.value!==beats()[line.index]?.text);paintCount();renderList();onPending();});
    // External actions flush in their own handler. Publishing on their pointerdown
    // blur would rebuild the frozen map before an NPC's click can arrive.
    textbox.addEventListener('blur',event=>{if(element.contains(event.relatedTarget))flush();});field.append(fieldHeading,textbox);paintCount();
    const controls=el('div','csd-controls'),up=button('↑ Move up','developer-cutscene-dialogue-up',()=>moveLine('up')),down=button('↓ Move down','developer-cutscene-dialogue-down',()=>moveLine('down'));
    up.disabled=index===0;down.disabled=index===lines.length-1;
    controls.append(up,down,button('Remove line','developer-cutscene-dialogue-remove',()=>removeLine()));
    const playback=el('div','csd-controls');playback.append(button('▶ Play from line','developer-cutscene-dialogue-preview',()=>void preview()),button('■ Stop','developer-cutscene-dialogue-stop',()=>void stop()));
    detail.append(title,label,field,controls,playback,el('p','dc-muted','Reordering lines keeps the walking, emotes and actions in place. Use Timeline to adjust their timing.'));
  }
  function render(){refresh();renderList();renderDetail();}
  render();notify();
  return{element,state,selectActor,selectClip,flush,updatePath(){return false;},get hasPending(){return !!buffer&&buffer.text!==beats()[buffer.index]?.text;},destroy(){if(destroyed)return;flush();destroyed=true;previewRevision++;}};
}
