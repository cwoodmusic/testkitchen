import {createDefaultProject,validateProject,normalizeProject,getPersonReplies} from './developer-project.mjs';
import {symbolMarkup} from './notation.mjs';
import {createCutsceneEditor} from './cutscene-editor.mjs';
import {createCutsceneDialogueEditor} from './cutscene-dialogue-editor.mjs';
import {createObjectDialogueEditor} from './object-dialogue-editor.mjs';

const clone=value=>structuredClone(value);
const TABS=[['dialogue','Dialogue'],['cutscene','Cutscene'],['puzzles','Puzzles'],['notes','Notes'],['rooms','Room'],['playtest','Test'],['json','Advanced']];
const text=value=>value==null?'':String(value);
const title=value=>text(value).replace(/[-_]/g,' ');
const noop=()=>{};

/** Local authoring UI. All execution and storage are owned by the calling app. */
export function createDeveloperConsole({mount=document.body,getProject=createDefaultProject,getState=()=>({}),onOpen=noop,onClose=noop,onDraftChange=noop,onSelectRoom=noop,onApply=noop,onPlaytest=noop,onReturnToGame=noop,onPreview=noop,onPreviewCutscene=noop,onCutsceneSelection=noop,onSetInventory=noop,onTeleport=noop,onResetSources=noop,onSaveProject=noop}={}){
  const document=mount.ownerDocument??globalThis.document;
  let draft=null,tab='dialogue',roomId='depot',personId=null,doorId=null,sourceId=null,noteId=null,actorId=null,objectId=null,loreId=null,dialogueTopic='story',replyId='story',query='',dirty=false,sourceJSON='',jsonBuffer=null,jsonDirty=false,busy=false,disposed=false,fieldEvent=false;
  const past=[],future=[],cutsceneStates=new Map(),objectDialogueStates=new Map();let cutsceneEditor=null,cutsceneEditorRoom=null,objectDialogueEditor=null,objectDialogueRoom=null,objectDialogueId=null,previewProject=null,previewSignature=null;
  const el=(tag,className='',value='')=>{const node=document.createElement(tag);if(className)node.className=className;if(value!=='')node.textContent=text(value);return node;};
  const dialog=el('dialog','dc-dialog');dialog.id='developer-console';dialog.setAttribute('aria-labelledby','developer-title');
  const shell=el('div','dc-shell'),header=el('header','dc-header'),heading=el('div');
  heading.append(el('p','dc-kicker','THE QUIET BELL · AUTHORING'));
  const h2=el('h2','','Developer console');h2.id='developer-title';heading.append(h2,el('p','dc-muted','The room is frozen. Click anyone or anything to edit it.'));
  function button(label,handler,{id,className='',disabled=false,...attributes}={}){
    const node=el('button','mg-button '+className,label);node.type='button';if(id)node.id=id;node.disabled=disabled;
    for(const [key,value]of Object.entries(attributes))node.setAttribute(key,text(value));
    node.addEventListener('click',handler);return node;
  }
  const closeButton=button('×',()=>close(),{id:'developer-close',className:'dc-close','aria-label':'Close developer console'});
  const expandButton=button('Expand',()=>{const expanded=dialog.classList.toggle('dc-expanded');expandButton.textContent=expanded?'Show map':'Expand';expandButton.setAttribute('aria-expanded',String(expanded));expandButton.setAttribute('aria-label',expanded?'Show map and compact editor':'Expand editor');},{id:'developer-expand',className:'dc-expand','aria-expanded':'false','aria-label':'Expand editor'});
  header.append(heading,expandButton,closeButton);
  const toolbar=el('div','dc-toolbar'),roomLabel=el('div','dc-room-picker'),roomSelect=el('div','dc-room-cards');roomSelect.id='developer-room-cards';roomSelect.setAttribute('aria-label','Choose a room to edit');roomLabel.append(roomSelect);
  const searchLabel=el('label','dc-field','Find text'),searchInput=el('input');searchInput.id='developer-search';searchInput.type='search';searchInput.placeholder='Find dialogue, clues, doors…';searchInput.setAttribute('aria-label','Find text in the project');searchLabel.append(searchInput);toolbar.append(roomLabel,searchLabel);
  const tabs=el('nav','dc-tabs');tabs.setAttribute('aria-label','Developer editors');tabs.setAttribute('role','tablist');
  for(const [id,label]of TABS){const item=button(label,()=>{if(!consumeJSON())return;tab=id;query='';searchInput.value='';render();body.scrollTop=0;},{'data-dev-tab':id,role:'tab','aria-controls':'developer-body'});item.id='developer-tab-'+id;tabs.append(item);}
  const body=el('div','dc-body');body.id='developer-body';body.setAttribute('role','tabpanel');let editor=body;
  const notices=el('div','dc-notices'),status=el('p','dc-status');status.id='developer-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const errors=el('ul','dc-errors');errors.id='developer-errors';errors.setAttribute('aria-live','polite');const warnings=el('ul','dc-warnings');warnings.id='developer-warnings';notices.append(status,errors,warnings);
  const footer=el('footer','dc-footer'),historyButtons=el('div','dc-buttons'),actions=el('div','dc-buttons');
  const undoButton=button('Undo',()=>undo(),{id:'developer-undo'}),redoButton=button('Redo',()=>redo(),{id:'developer-redo'});
  historyButtons.append(undoButton,redoButton,button('Restore shipped project',()=>replaceDraft(createDefaultProject(),'Shipped project restored to the draft. Undo brings your edits back.'),{id:'developer-reset'}));
  const saveButton=button('Save project',()=>saveProject(),{id:'developer-save'}),applyButton=button('Apply & playtest',()=>applyProject(),{id:'developer-apply',className:'mg-primary'});
  const file=el('input');file.type='file';file.accept='.json,application/json';file.id='developer-file';file.hidden=true;
  const tools=el('details','dc-tools');tools.append(el('summary','','Project tools'));historyButtons.append(button('Import project',()=>file.click(),{id:'developer-import'}),button('Export project',()=>exportProject(),{id:'developer-export'}));tools.append(historyButtons,file);header.insertBefore(tools,expandButton);actions.append(saveButton,applyButton);footer.append(actions);
  shell.append(header,toolbar,tabs,notices,body,footer);dialog.append(shell);mount.append(dialog);
  function say(message){status.textContent=message;}
  function showIssues(result){errors.replaceChildren();warnings.replaceChildren();for(const error of result.errors??[])errors.append(el('li','',typeof error==='string'?error:JSON.stringify(error)));for(const warning of result.warnings??[])warnings.append(el('li','',typeof warning==='string'?warning:JSON.stringify(warning)));errors.hidden=!errors.childElementCount;warnings.hidden=!warnings.childElementCount;}
  function clearIssues(){showIssues({errors:[],warnings:[]});}
  function record(){past.push(clone(draft));if(past.length>20)past.shift();future.length=0;}
  function publishDraft(){try{const result=validateProject(draft);if(!result.valid){showIssues(result);return false;}onDraftChange(clone(draft));return true;}catch(error){showIssues({errors:[error.message??String(error)]});return false;}}
  function changed(mutator,{repaint=true}={}){record();mutator(draft);dirty=true;jsonDirty=false;jsonBuffer=null;clearIssues();say('Draft changed. Save it or apply it to a playtest.');publishDraft();if(repaint&&!fieldEvent)render();else updateControls();}
  function replaceDraft(value,message){flushEditors();record();draft=clone(value);dirty=true;jsonDirty=false;jsonBuffer=null;query='';searchInput.value='';clearIssues();publishDraft();render();say(message);}
  function undo(){flushEditors();if(!past.length)return;future.push(clone(draft));draft=past.pop();dirty=true;jsonDirty=false;jsonBuffer=null;clearIssues();publishDraft();render();say('Draft change undone.');}
  function redo(){flushEditors();if(!future.length)return;past.push(clone(draft));draft=future.pop();dirty=true;jsonDirty=false;jsonBuffer=null;clearIssues();publishDraft();render();say('Draft change restored.');}
  function updateControls(){undoButton.disabled=(!past.length&&!hasPendingEdits())||busy;redoButton.disabled=!future.length||busy;saveButton.disabled=busy;applyButton.disabled=busy;dialog.dataset.dirty=String(dirty||jsonDirty||hasPendingEdits());}
  function candidate(){
    try{
      if(!flushEditors())return null;
      const value=jsonDirty?JSON.parse(jsonBuffer):draft,result=validateProject(value);showIssues(result);
      if(!result.valid){say('The draft needs the fixes listed above. Nothing was applied.');return null;}
      return normalizeProject(value);
    }catch(error){showIssues({errors:[error.message??String(error)]});say('The draft could not be read. Nothing was applied.');return null;}
  }
  async function invoke(callback,args,message,{leave=false,save=false}={}){
    if(busy)return false;busy=true;updateControls();
    try{const result=await callback(...args);if(result===false){say('That action is unavailable. Start a playtest before changing its live state.');return false;}if(save){draft=clone(args[0]);sourceJSON=JSON.stringify(draft);dirty=false;jsonDirty=false;jsonBuffer=null;publishDraft();if(!leave)render();}say(message);if(leave)close();return true;}
    catch(error){showIssues({errors:[error.message??String(error)]});say('The action was not completed. Your draft is still here.');return false;}
    finally{busy=false;updateControls();}
  }
  function consumeJSON(){if(!flushEditors())return false;if(!jsonDirty)return true;const project=candidate();if(!project)return false;record();draft=clone(project);dirty=true;jsonDirty=false;jsonBuffer=null;publishDraft();return true;}
  async function saveProject(){const project=candidate();if(project)await invoke(onSaveProject,[project],'Project saved on this device.',{save:true});}
  async function applyProject(options=null){const project=candidate();if(project)await invoke(options?onPlaytest:onApply,options?[project,options]:[project],'Project applied to your separate playtest.',{leave:true,save:true});}
  function exportProject(){const project=candidate();if(!project)return;const blob=new Blob([JSON.stringify(project,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download='coda-quiet-bell-project.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);say('Project exported. You can send this JSON file back for implementation.');}
  file.addEventListener('change',async()=>{const picked=file.files?.[0];file.value='';if(!picked)return;try{if(picked.size>12*1024*1024)throw Error('Choose a project JSON file smaller than 12 MB.');const parsed=JSON.parse(await picked.text()),result=validateProject(parsed);showIssues(result);if(!result.valid){say('Import was not applied. Fix the listed issues first.');return;}replaceDraft(normalizeProject(parsed),'Project imported into your draft. Save or apply it when ready.');}catch(error){showIssues({errors:[error.message??String(error)]});say('Import was not applied. Your previous draft is unchanged.');}});
  function pathAttribute(input,path){if(path)input.dataset.devPath=JSON.stringify(path);}
  function field(label,value,commit,{id,path,type='text',multiline=false,min,max,step,help}={}){
    const wrap=el('label','dc-field');wrap.append(el('span','',label));const input=el(multiline?'textarea':'input');if(!multiline)input.type=type;if(id)input.id=id;pathAttribute(input,path);input.value=text(value);if(multiline)input.rows=4;if(min!==undefined)input.min=text(min);if(max!==undefined)input.max=text(max);if(step!==undefined)input.step=text(step);input.addEventListener('change',()=>{fieldEvent=true;try{commit(type==='number'?Number(input.value):input.value);}finally{fieldEvent=false;}});wrap.append(input);if(help)wrap.append(el('small','dc-muted',help));return wrap;
  }
  function select(label,value,options,commit,{id,path}={}){const wrap=el('div','dc-field dc-choice-field');wrap.append(el('span','',label));const input=el('div','dc-choice-group');if(id)input.id=id;pathAttribute(input,path);input.setAttribute('role','group');input.setAttribute('aria-label',label);input.value=text(value);for(const option of options){const [key,name]=Array.isArray(option)?option:[option,option];const item=button(name,()=>{input.value=text(key);commit(text(key));for(const peer of input.children)peer.setAttribute('aria-pressed',String(peer===item));},{className:'dc-choice-card','data-dev-choice':key,'aria-pressed':String(text(key)===text(value))});input.append(item);}wrap.append(input);return wrap;}

  function checkbox(label,value,commit,{id,path}={}){const wrap=el('label','dc-checkbox'),input=el('input');input.type='checkbox';input.checked=!!value;if(id)input.id=id;pathAttribute(input,path);input.addEventListener('change',()=>commit(input.checked));wrap.append(input,el('span','',label));return wrap;}
  function card(name,description=''){const section=el('section','dc-card');section.append(el('h3','',name));if(description)section.append(el('p','dc-muted',description));return section;}
  function fields(...children){const box=el('div','dc-fields');box.append(...children);return box;}
  function locations(){return draft.settings?.terminalRooms?{...draft.rooms,...draft.terminals}:draft.rooms??{};}
  function location(id=roomId){return locations()[id];}
  function optionRooms(){return Object.entries(draft.rooms??{}).map(([id,room])=>[id,room.title??id]);}
  function optionLocations(){return Object.entries(locations()).map(([id,room])=>[id,room.title??id]);}
  function optionDestinations(){return [...optionRooms(),...Object.values(draft.previews).map(room=>[room.id,room.title+' · preview']),...Object.values(draft.terminals).map(room=>[room.id,room.title+' · outcome'])];}
  function noteById(id){return draft.noteKinds.find(kind=>kind.id===id);}
  function beats(recipe){return(recipe??[]).reduce((sum,id)=>sum+(Number(noteById(id)?.units)||0)/2,0);}
  function recipeEditor(label,recipe,commit,{id,max=128}={}){
    const section=el('div','dc-recipe-editor');if(id)section.id=id;const head=el('div','dc-section-heading');head.append(el('h4','',label),el('span','dc-tag',`${beats(recipe)} beats · ${recipe.length} tiles`));section.append(head);
    const placed=el('div','dc-recipe');placed.setAttribute('aria-label',label+' order');
    recipe.forEach((kind,index)=>{const meta=noteById(kind),token=button(`${index+1}. ${meta?.shortName??meta?.label??kind} ×`,()=>commit(recipe.filter((_,i)=>i!==index)),{'data-dev-remove-note':index,className:'dc-token','aria-label':`Remove ${meta?.label??kind} at position ${index+1}`});token.style.setProperty('--note-color',meta?.color??'#d6bb8a');placed.append(token);});if(!recipe.length)placed.append(el('p','dc-muted','Choose notes below to build the phrase in order.'));section.append(placed);
    const picker=el('div','dc-note-picker');for(const kind of draft.noteKinds){const add=button('',()=>commit([...recipe,kind.id]),{'data-dev-add-note':kind.id,disabled:recipe.length>=max,'aria-label':`Add ${kind.label}`});const icon=el('span');try{icon.innerHTML=symbolMarkup(kind.symbol??kind.id);}catch{icon.textContent='♪';}add.style.setProperty('--note-color',kind.color??'#d6bb8a');add.append(icon,el('span','',kind.shortName??kind.label));picker.append(add);}section.append(picker);
    const controls=el('div','dc-buttons');controls.append(button('Hear phrase',()=>{const project=candidate();if(project)void invoke(onPreview,[recipe,project],'Playing the draft phrase.');},{disabled:!recipe.length}),button('Clear phrase',()=>commit([]),{disabled:!recipe.length}));section.append(controls);return section;
  }
  function inventoryEditor(stock,commit,{id,path,live=false}={}){const box=el('div','dc-counts');if(id)box.id=id;for(const kind of draft.noteKinds){const item=field(kind.shortName??kind.label,stock?.[kind.id]??0,value=>commit(kind.id,value),{type:'number',min:0,max:999,step:1,path:path?[...path,kind.id]:null});item.classList.add('dc-count-field');if(live)item.querySelector('input').dataset.devInventory=kind.id;box.append(item);}return box;}
  function getCurrent(){const room=location();return{room,content:draft.content[roomId],scene:draft.scenes[roomId],doors:room?.doors??[],sources:room?.sources??[],terminal:!!draft.terminals?.[roomId]};}
  function chooseEntity(item){
    if(!consumeJSON())return;query='';searchInput.value='';loreId=null;
    if(item.type==='person'){personId=item.id;actorId=item.id;tab='dialogue';dialogueTopic='story';}
    else if(item.type==='door'){doorId=item.doorId??item.id;tab='puzzles';}
    else if(item.type==='chest'){sourceId=item.sourceId??item.id;tab='notes';}
    else if(item.type==='inspect'){loreId=item.id;tab='dialogue';}
    else{objectId=item.id;tab='rooms';}
    render();
  }
  function renderScenePanel(){
    const {room,scene,content}=getCurrent(),panel=el('aside','dc-scene-panel');panel.append(el('h3','',room.title),el('p','dc-muted','Click a person, door or object to edit it. Drag a character to move them.'));
    const stage=el('div','dc-scene-stage');stage.id='developer-scene';stage.setAttribute('aria-label','Editable room scene');const image=el('img');image.src=scene.image;image.alt=room.title+' editing preview';image.draggable=false;stage.append(image);
    for(const item of scene.objects){
      const actor=scene.actors.find(actor=>actor.id===item.id),person=content.people.find(person=>person.id===item.id),selected=item.type==='person'?personId===item.id&&tab==='dialogue'||actorId===item.id&&tab==='rooms':item.type==='door'?doorId===item.id&&tab==='puzzles':item.type==='inspect'?loreId===item.id:sourceId===item.sourceId&&tab==='notes';
      let suppress=false;const control=button('',event=>{event.stopPropagation();if(!suppress)chooseEntity(item);},{className:actor?'dc-scene-actor':'dc-scene-hotspot','data-dev-entity':item.id,'data-dev-type':item.type,'data-selected':String(selected),'aria-label':actor?`Edit ${person?.name??item.label}`:`Edit ${item.label??item.id}`});
      if(actor){
        const sprite=draft.cast[actor.character];control.style.left=`${actor.feet.x/scene.geometry.width*100}%`;control.style.top=`${actor.feet.y/scene.geometry.height*100}%`;control.style.width=`${actor.worldSize/scene.geometry.width*100}%`;control.style.transform=`translate(${-sprite.anchor[0]*100}%,${-sprite.anchor[1]*100}%)`;control.style.zIndex=String(Math.round(actor.feet.y));
        const art=el('span','dc-preview-sprite');Object.assign(art.style,{backgroundImage:`url("${draft.settings.castImage}")`,backgroundPosition:`${sprite.column*100}% ${sprite.row*100}%`});control.append(art,el('span','dc-scene-label',person?.name??item.label));
        let drag=null;control.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();control.setPointerCapture(event.pointerId);drag={x:event.clientX,y:event.clientY,feet:{...actor.feet},before:clone(draft),moved:false};});
        control.addEventListener('pointermove',event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<5)return;drag.moved=true;const rect=stage.getBoundingClientRect(),x=Math.round(drag.feet.x+dx/rect.width*scene.geometry.width),y=Math.round(drag.feet.y+dy/rect.height*scene.geometry.height);translateActor(scene,actor,x,y);control.style.left=`${x/scene.geometry.width*100}%`;control.style.top=`${y/scene.geometry.height*100}%`;});
        const finish=()=>{if(!drag)return;const previous=drag;drag=null;if(previous.moved){past.push(previous.before);if(past.length>20)past.shift();future.length=0;dirty=true;jsonDirty=false;jsonBuffer=null;actorId=actor.id;tab='rooms';suppress=true;render();say('Character moved. Its interaction area and collision moved with it.');setTimeout(()=>{suppress=false;},0);}};control.addEventListener('pointerup',finish);control.addEventListener('pointercancel',finish);
      }else{const r=item.rect;Object.assign(control.style,{left:`${r.x/scene.geometry.width*100}%`,top:`${r.y/scene.geometry.height*100}%`,width:`${r.width/scene.geometry.width*100}%`,height:`${r.height/scene.geometry.height*100}%`});control.append(el('span','dc-scene-label',item.type==='chest'?'Notes':item.label));}
      stage.append(control);
    }
    stage.addEventListener('click',event=>{if(event.target.closest('button'))return;if(!consumeJSON())return;tab='rooms';loreId=null;render();});panel.append(stage,el('p','dc-muted','Room art stays in 2/3 perspective. The inspector edits the thing you select.'));return panel;
  }
  function renderDialogue(){
    const {content,scene,doors}=getCurrent(),people=content.people??[];
    if(loreId){const index=(content.inspections??[]).findIndex(entry=>entry.id===loreId),entry=content.inspections[index];if(entry){const section=card(entry.title,'What the player discovers when they inspect this object.');section.append(field('Title',entry.title,value=>changed(()=>{entry.title=value;}),{id:'developer-lore-title',path:['content',roomId,'inspections',index,'title']}),field('Observation',entry.text,value=>changed(()=>{entry.text=value;}),{id:'developer-lore-text',path:['content',roomId,'inspections',index,'text'],multiline:true}));const details=el('details','dc-advanced');details.append(el('summary','','Interaction label'),field('Label',entry.label,value=>changed(()=>{entry.label=value;}),{id:'developer-lore-label',path:['content',roomId,'inspections',index,'label']}));section.append(details);editor.append(section);renderObjectDialogueEditor(entry,content,scene);return;}}
    if(!people.some(person=>person.id===personId))personId=people[0]?.id;
    const index=people.findIndex(person=>person.id===personId),person=people[index];if(!person){editor.append(card('Choose someone in the room','Click a character in the frozen game to edit their dialogue and replies.'));return;}
    const base=['content',roomId,'people',index],section=card(person.name+' · '+person.role,'Edit what they say, and the replies the player can choose.');
    section.append(field('Opening dialogue',person.intro??person.story??'',value=>changed(()=>{person.intro=value;}),{id:'developer-intro',path:[...base,'intro'],multiline:true}));
    const replies=getPersonReplies(person);if(!replies.some(reply=>reply.id===replyId))replyId=replies[0]?.id;
    const choices=el('div','dc-replies');choices.setAttribute('aria-label',person.name+' player replies');
    for(const reply of replies){const item=button('',()=>{replyId=reply.id;render();},{className:'dc-reply-card','data-dev-reply':reply.id,'aria-pressed':String(reply.id===replyId)});item.append(el('strong','',reply.label),el('span','dc-muted',reply.text.slice(0,110)));choices.append(item);}section.append(choices);
    const materialize=()=>{person.replies??=clone(getPersonReplies(person));return person.replies;};
    const selected=replies.find(reply=>reply.id===replyId),replyIndex=replies.findIndex(reply=>reply.id===replyId);
    if(selected){section.append(field('Player reply',selected.label,value=>changed(()=>{materialize().find(reply=>reply.id===replyId).label=value;}),{id:'developer-reply-label',path:[...base,'replies',replyIndex,'label']}),field('Their response',selected.text,value=>changed(()=>{materialize().find(reply=>reply.id===replyId).text=value;}),{id:'developer-reply-text',path:[...base,'replies',replyIndex,'text'],multiline:true}));
      const extra=el('details','dc-advanced');extra.append(el('summary','','Rhythm example for this reply'),recipeEditor('Example rhythm',selected.demo??[],value=>changed(()=>{materialize().find(reply=>reply.id===replyId).demo=value;}),{id:'developer-person-demo',max:32}));const ids=doors.filter(id=>draft.doors[id]);if(ids.length){let chosen=ids[0];extra.append(select('Copy a door answer',chosen,ids.map(id=>[id,(draft.content[roomId].doorCopy[id]??draft.content[roomId].doorCopy[draft.doors[id].canonicalId])?.name??draft.doors[id].label??id]),id=>{chosen=id;},{id:'developer-demo-door'}),button('Copy door answer',()=>{changed(()=>{materialize().find(reply=>reply.id===replyId).demo=[...draft.doors[chosen].recipe];});say('Example updated. Review the response text so it describes the same rhythm.');},{id:'developer-copy-answer'}));}section.append(extra,button('Remove this reply',()=>changed(()=>{person.replies=materialize().filter(reply=>reply.id!==replyId);replyId=person.replies[0]?.id;}),{id:'developer-remove-reply','data-dev-remove-reply':replyId}));
    }else section.append(el('p','dc-muted','No player replies. Add one below, or leave this as a short conversation.'));
    section.append(button('+ Add reply',()=>changed(()=>{const all=materialize();let number=1;while(all.some(reply=>reply.id==='reply-'+number))number++;replyId='reply-'+number;all.push({id:replyId,label:'New reply',text:''});}),{id:'developer-add-reply',className:'mg-primary',disabled:replies.length>=64}));
    if(person.sourceId)section.append(button('Edit the notes '+person.name+' gives you',()=>{sourceId=person.sourceId;tab='notes';render();},{id:'developer-edit-person-gift'}));else section.append(el('p','dc-muted','No note gift at this stop.'));
    const details=el('details','dc-advanced');details.append(el('summary','','Character name, role & gift'),fields(field('Name',person.name,value=>changed(()=>{person.name=value;const object=scene.objects.find(item=>item.id===person.id);if(object){object.label=value;object.actionLabel='Talk to '+value;}}),{id:'developer-person-name',path:[...base,'name']}),field('Role',person.role,value=>changed(()=>{person.role=value;}),{id:'developer-person-role',path:[...base,'role']})));
    const sources=Object.values(draft.sources).filter(source=>source.roomId===roomId&&source.type==='npc');details.append(select('Gift at this stop',person.sourceId??'',[['','No gift'],...sources.map(source=>[source.id,source.label])],value=>changed(()=>{delete person.sourceId;delete person.sourceLabel;const ownObject=scene.objects.find(object=>object.type==='person'&&object.id===person.id);if(ownObject)delete ownObject.sourceId;if(value){for(const other of people)if(other!==person&&other.sourceId===value){delete other.sourceId;delete other.sourceLabel;}for(const object of scene.objects)if(object.sourceId===value)delete object.sourceId;person.sourceId=value;person.sourceLabel=`Take ${person.name}’s notes`;draft.sources[value].character=person.id;if(ownObject)ownObject.sourceId=value;}}),{id:'developer-person-source',path:[...base,'sourceId']}));if(person.sourceId)details.append(field('Gift button',person.sourceLabel,value=>changed(()=>{person.sourceLabel=value;}),{id:'developer-source-label',path:[...base,'sourceLabel']}));section.append(details);editor.append(section);
  }

  function renderPuzzles(){
    const ids=Object.keys(draft.doors).filter(id=>draft.doors[id].from===roomId);if(!ids.length){doorId=null;editor.append(card('No rhythm locks here',getCurrent().terminal?'This route ends here. Open Room to edit its conclusion and recovery guidance.':'This room has no authored rhythm locks.'));return;}if(!ids.includes(doorId))doorId=ids[0];editor.append(select('Doors here',doorId,ids.map(id=>[id,(draft.content[roomId].doorCopy[id]??draft.content[roomId].doorCopy[draft.doors[id].canonicalId])?.name??draft.doors[id].label??id]),id=>{doorId=id;render();},{id:'developer-door'}));
    if(!doorId){editor.append(el('p','dc-muted','Click a door in the room to edit its puzzle.'));return;}
    const door=draft.doors[doorId],copy=draft.content[roomId].doorCopy[doorId]??draft.content[roomId].doorCopy[door.canonicalId]??{},section=card(copy.name??door.label??'Rhythm answer','Tap notes to build the exact answer in order. Tap a placed tile to remove it.');
    function updateCopy(key,value){const all=draft.content[roomId].doorCopy;all[doorId]??=clone(all[door.canonicalId]??{name:door.label??doorId,hint:''});all[doorId][key]=value;if(door.canonicalId!==doorId&&all[door.canonicalId])all[door.canonicalId][key]=value;}
    section.append(recipeEditor('Door answer',door.recipe,value=>changed(()=>{door.recipe=value;}),{id:'developer-door-recipe',max:32}),field('What the lock hints',copy.hint??'',value=>changed(()=>updateCopy('hint',value)),{id:'developer-door-hint',path:['content',roomId,'doorCopy',doorId,'hint'],multiline:true}));
    section.append(el('p','dc-muted','The required beat count follows your answer. Update spoken clues and examples in Dialogue to match.'));
    const details=el('details','dc-advanced');details.append(el('summary','','Door name, destination & outcome'),field('Door name',copy.name??door.label,value=>changed(()=>{door.label=value;updateCopy('name',value);const object=draft.scenes[roomId].objects.find(item=>item.id===doorId);if(object){object.label=value;object.actionLabel='Choose '+value;}}),{id:'developer-door-name',path:['content',roomId,'doorCopy',doorId,'name']}),select('Where it leads',door.to,optionDestinations(),value=>changed(()=>{door.to=value;}),{id:'developer-door-destination',path:['doors',doorId,'to']}));
    for(const [key,label,id]of [['warning','Warning','developer-door-warning'],['previewCopy','Continuation text','developer-door-preview'],['deadCopy','Outcome text','developer-door-outcome'],['repair','Recovery guidance','developer-door-repair']])details.append(field(label,copy[key]??'',value=>changed(()=>updateCopy(key,value)),{id,path:['content',roomId,'doorCopy',doorId,key],multiline:true}));section.append(details);editor.append(section);
  }

  function giftSteppers(recipe,commit){const grid=el('div','dc-counts');grid.id='developer-gift-recipe';for(const kind of draft.noteKinds){const item=el('div','dc-note-stepper'),icon=el('span','dc-note-glyph');try{icon.innerHTML=symbolMarkup(kind.symbol??kind.id);}catch{icon.textContent='♪';}const amount=recipe.filter(id=>id===kind.id).length;item.style.setProperty('--note-color',kind.color??'#d6bb8a');item.append(icon,el('strong','',kind.shortName??kind.label));const row=el('div','dc-buttons');row.append(button('−',()=>{const next=[...recipe],index=next.lastIndexOf(kind.id);if(index>=0){next.splice(index,1);commit(next);}},{'data-dev-subtract-note':kind.id,'aria-label':'Remove '+kind.label,disabled:!amount}),el('span','dc-tag','×'+amount),button('+',()=>commit([...recipe,kind.id]),{'data-dev-add-note':kind.id,'aria-label':'Give another '+kind.label,disabled:recipe.length>=128}));item.append(row);grid.append(item);}return grid;}
  function renderNotes(){
    const sourceIds=Object.keys(draft.sources).filter(id=>draft.sources[id].roomId===roomId);if(!sourceIds.includes(sourceId))sourceId=sourceIds[0];
    if(sourceId){const source=draft.sources[sourceId],gifts=card(source.label,'Choose exactly how many notes this gift or chest contains. Each source is collected once per run.');if(sourceIds.length>1)gifts.append(select('Notes in this room',sourceId,sourceIds.map(id=>[id,draft.sources[id].label]),id=>{sourceId=id;render();},{id:'developer-source'}));gifts.append(giftSteppers(source.recipe,value=>changed(()=>{source.recipe=value;})));const details=el('details','dc-advanced');details.append(el('summary','','Gift name & hint'),field('Name',source.label,value=>changed(()=>{source.label=value;}),{id:'developer-gift-name',path:['sources',sourceId,'label']}),field('Hint',source.hint,value=>changed(()=>{source.hint=value;}),{path:['sources',sourceId,'hint'],multiline:true}));gifts.append(details);editor.append(gifts);}else editor.append(card('No gift or chest here','Click a character to change their gift binding, or add an authored source with Advanced JSON.'));
    const opening=el('details','dc-advanced');opening.append(el('summary','','Notes at the start of a new run'),inventoryEditor(draft.settings.initialInventory,(id,value)=>changed(()=>{draft.settings.initialInventory[id]=value;}),{id:'developer-starting-inventory',path:['settings','initialInventory']}));editor.append(opening);
    if(!draft.noteKinds.some(kind=>kind.id===noteId))noteId=draft.noteKinds[0]?.id;const index=draft.noteKinds.findIndex(kind=>kind.id===noteId),kind=draft.noteKinds[index];if(!kind)return;
    const notes=el('details','dc-advanced');notes.append(el('summary','','Advanced note definitions'),select('Note to edit',noteId,draft.noteKinds.map(item=>[item.id,item.label]),id=>{noteId=id;render();},{id:'developer-note'}));const base=['noteKinds',index];notes.append(fields(field('Full name',kind.label,value=>changed(()=>{kind.label=value;}),{id:'developer-note-label',path:[...base,'label']}),field('Short name',kind.shortName??kind.label,value=>changed(()=>{kind.shortName=value;}),{path:[...base,'shortName']}),field('Half-beat units',kind.units,value=>changed(()=>{kind.units=value;kind.beats=value/2;}),{id:'developer-note-units',path:[...base,'units'],type:'number',min:1,max:32,step:1,help:'2 units = 1 beat.'}),field('Colour',kind.color??'#d6bb8a',value=>changed(()=>{kind.color=value;}),{path:[...base,'color'],type:'color'})),select('Sound attacks',kind.subdivisions??1,[[1,'One'],[2,'Two'],[4,'Four']],value=>changed(()=>{kind.subdivisions=Number(value);}),{path:[...base,'subdivisions']}),checkbox('Rest: silent for its full duration',kind.rest,value=>changed(()=>{kind.rest=value;}),{path:[...base,'rest']}));editor.append(notes);
  }

  function translateActor(scene,actor,x,y,size=actor.worldSize){
    const dx=x-actor.feet.x,dy=y-actor.feet.y,scale=size/actor.worldSize,old={...actor.feet};actor.feet={x,y};actor.worldSize=size;
    const object=scene.objects.find(item=>item.type==='person'&&item.id===actor.id);if(object){object.rect.x=x+(object.rect.x-old.x)*scale;object.rect.y=y+(object.rect.y-old.y)*scale;object.rect.width*=scale;object.rect.height*=scale;}
    const target=scene.geometry.targets.find(item=>item.id===actor.id);if(target){target.x+=dx;target.y+=dy;target.approach.x+=dx;target.approach.y+=dy;}
    const obstacle=scene.geometry.obstacles.find(item=>item.id===actor.id);if(obstacle){obstacle.x=x+(obstacle.x-old.x)*scale;obstacle.y=y+(obstacle.y-old.y)*scale;obstacle.width*=scale;obstacle.height*=scale;}
  }
  function jsonEditor(label,value,commit,{id}={}){const part=el('details','dc-advanced');part.append(el('summary','',label));const area=el('textarea','dc-json-area');if(id)area.id=id;area.rows=14;area.spellcheck=false;area.value=JSON.stringify(value,null,2);part.append(area,button('Apply '+label.toLowerCase(),()=>{try{const parsed=JSON.parse(area.value);commit(parsed);}catch(error){showIssues({errors:[error.message??String(error)]});say('That JSON was not applied.');}}));return part;}
  function hasPendingEdits(){return !!cutsceneEditor?.hasPending||!!objectDialogueEditor?.hasPending;}
  function flushEditors(){return cutsceneEditor?.flush?.()!==false&&objectDialogueEditor?.flush?.()!==false;}
  function destroyObjectDialogueEditor(){
    if(!objectDialogueEditor)return;
    objectDialogueEditor.flush();
    const previous=objectDialogueEditor,previousRoom=objectDialogueRoom,previousId=objectDialogueId;
    objectDialogueStates.set(`${previousRoom}:${previousId}`,previous.state);
    objectDialogueEditor=null;objectDialogueRoom=null;objectDialogueId=null;previous.destroy();
    try{void Promise.resolve(onPreviewCutscene(previousRoom,draft,{command:'stop',interactionId:previousId})).catch(noop);}catch{}
  }
  function renderObjectDialogueEditor(entry,content,scene){
    objectDialogueRoom=roomId;objectDialogueId=entry.id;
    objectDialogueEditor=createObjectDialogueEditor({document,roomId,entry,content,scene,state:objectDialogueStates.get(`${roomId}:${entry.id}`)??{},onPending:()=>updateControls(),onChange:(mutator,options)=>changed(()=>mutator(),options),onPreview:async options=>{
      const signature=jsonDirty?`json:${jsonBuffer}`:JSON.stringify(draft);
      if(signature!==previewSignature){previewProject=null;previewSignature=null;const project=candidate();if(!project)return false;previewProject=project;previewSignature=signature;}
      const project=previewProject;if(!project)return false;
      try{return await onPreviewCutscene(roomId,project,options);}catch(error){showIssues({errors:[error.message??String(error)]});say('The discussion preview could not start. Your draft is still here.');return false;}
    }});
    editor.append(objectDialogueEditor.element);
  }
  function destroyCutsceneEditor(){
    if(!cutsceneEditor)return;
    cutsceneEditor.flush?.();
    const previous=cutsceneEditor,previousRoom=cutsceneEditorRoom;
    previous.state.playing=false;cutsceneStates.set(previousRoom,previous.state);
    cutsceneEditor=null;cutsceneEditorRoom=null;previous.destroy();onCutsceneSelection(null);
    // Stopping is synchronous when possible; a late rejected cleanup must not
    // interrupt a tab change or the normal intro started by Apply & playtest.
    try{void Promise.resolve(onPreviewCutscene(previousRoom,draft,{command:'stop'})).catch(noop);}catch{}
  }
  function renderCutsceneEditor(content,scene){
    cutsceneEditorRoom=roomId;
    const previousState=cutsceneStates.get(roomId),playbackRate=getState()?.cutscenePlaybackRate;
    const state=playbackRate===1||playbackRate===2?{...previousState,playbackRate}:{...previousState};
    state.mode=state.mode==='timeline'?'timeline':'dialogue';
    const modes=el('nav','csd-modes');modes.setAttribute('aria-label','Cutscene editor mode');
    for(const [mode,label]of [['dialogue','Dialogue'],['timeline','Timeline']])modes.append(button(label,()=>{if(!flushEditors())return;state.mode=mode;render();},{id:'developer-cutscene-mode-'+mode,'aria-pressed':String(state.mode===mode)}));
    if(tab==='cutscene')editor.append(modes);
    const createEditor=tab==='rooms'||state.mode==='timeline'?createCutsceneEditor:createCutsceneDialogueEditor;
    cutsceneEditor=createEditor({document,roomId,content,scene,state,onPending:()=>updateControls(),onChange:(mutator,options)=>changed(()=>mutator(),options),onSelection:detail=>onCutsceneSelection(detail),onPreview:async options=>{
      // Scrubbing sends many commands against the same frozen definition. Only
      // a changed draft needs to replay the full project validation and clone.
      const signature=jsonDirty?`json:${jsonBuffer}`:JSON.stringify(draft);
      if(signature!==previewSignature){
        previewProject=null;previewSignature=null;
        const project=candidate();if(!project)return false;
        previewProject=project;previewSignature=signature;
      }
      const project=previewProject;if(!project)return false;
      try{return await onPreviewCutscene(roomId,project,options);}catch(error){showIssues({errors:[error.message??String(error)]});say('The preview could not start. Your draft is still here.');return false;}
    }});editor.append(cutsceneEditor.element);
  }
  function renderRooms(){
    const {room,content,scene,terminal}=getCurrent(),section=card('Room & character placement','Drag a character in the scene to move them. Their click region, approach point and collision move together.');section.append(field('Room title',room.title,value=>changed(()=>{room.title=value;content.title=value;scene.title=value;}),{id:'developer-room-title',path:[terminal?'terminals':'rooms',roomId,'title']}),field('Arrival text',content.arrival,value=>changed(()=>{content.arrival=value;}),{id:'developer-room-arrival',path:['content',roomId,'arrival'],multiline:true}));editor.append(section);
    renderCutsceneEditor(content,scene);
    if(terminal&&content.outcome){const outcome=content.outcome,ending=card('Outcome & recovery','The conclusion shown at this place. Its characters and objects remain editable in the frozen room.');ending.append(field('Heading',outcome.kicker??'',value=>changed(()=>{outcome.kicker=value;}),{id:'developer-outcome-heading',path:['content',roomId,'outcome','kicker']}),field('Conclusion',outcome.copy??room.text??'',value=>changed(()=>{outcome.copy=value;room.text=value;}),{id:'developer-outcome-copy',path:['content',roomId,'outcome','copy'],multiline:true}));if(room.kind==='dead-end')ending.append(field('How to find another route',outcome.repair??room.repair??'',value=>changed(()=>{outcome.repair=value;room.repair=value;}),{id:'developer-outcome-repair',path:['content',roomId,'outcome','repair'],multiline:true}));editor.append(ending);}
    const actors=scene.actors??[];if(!actors.some(actor=>actor.id===actorId))actorId=actors[0]?.id;const actor=actors.find(item=>item.id===actorId),people=content.people??[];
    if(actor){const placement=el('details','dc-advanced');placement.append(el('summary','','Exact character coordinates'),select('Character',actorId,actors.map(item=>[item.id,people.find(person=>person.id===item.id)?.name??item.id]),id=>{actorId=id;render();},{id:'developer-actor'}),fields(field('X',actor.feet.x,value=>changed(()=>translateActor(scene,actor,value,actor.feet.y)),{id:'developer-actor-x',type:'number',step:1}),field('Y',actor.feet.y,value=>changed(()=>translateActor(scene,actor,actor.feet.x,value)),{id:'developer-actor-y',type:'number',step:1}),field('Size',actor.worldSize,value=>changed(()=>translateActor(scene,actor,actor.feet.x,actor.feet.y,value)),{id:'developer-actor-size',type:'number',min:20,max:600,step:1})));editor.append(placement);}
    const art=el('details','dc-advanced');art.append(el('summary','','Background art & walking settings'),field('Background image',scene.image,value=>changed(()=>{scene.image=value;}),{id:'developer-room-image',path:['scenes',roomId,'image']}));const imageFile=el('input');imageFile.type='file';imageFile.accept='image/png,image/webp,image/jpeg';imageFile.setAttribute('aria-label','Import room background image');imageFile.addEventListener('change',()=>{const picked=imageFile.files?.[0];if(!picked)return;if(picked.size>6*1024*1024){showIssues({errors:['Use a background image smaller than 6 MB.']});return;}const reader=new FileReader();reader.onload=()=>changed(()=>{scene.image=text(reader.result);});reader.onerror=()=>showIssues({errors:['The background image could not be read.']});reader.readAsDataURL(picked);});art.append(imageFile,fields(field('Spawn X',scene.geometry.start.x,value=>changed(()=>{scene.geometry.start.x=value;}),{id:'developer-spawn-x',path:['scenes',roomId,'geometry','start','x'],type:'number',step:1}),field('Spawn Y',scene.geometry.start.y,value=>changed(()=>{scene.geometry.start.y=value;}),{id:'developer-spawn-y',path:['scenes',roomId,'geometry','start','y'],type:'number',step:1}),field('Walking speed',scene.geometry.speed,value=>changed(()=>{scene.geometry.speed=value;}),{id:'developer-walking-speed',path:['scenes',roomId,'geometry','speed'],type:'number',min:1,max:2000,step:1})));editor.append(art);
    const hit=el('details','dc-advanced');hit.append(el('summary','','Interaction areas'));if(!scene.objects.some(item=>item.id===objectId))objectId=scene.objects[0]?.id;const object=scene.objects.find(item=>item.id===objectId);hit.append(select('Object',objectId,scene.objects.map(item=>[item.id,item.label??item.id]),id=>{objectId=id;render();},{id:'developer-object'}));if(object)hit.append(field('Hover label',object.label,value=>changed(()=>{object.label=value;}),{id:'developer-object-label'}),fields(...['x','y','width','height'].map(key=>field(title(key),object.rect[key],value=>changed(()=>{object.rect[key]=value;}),{type:'number',step:1,id:'developer-object-'+key}))));editor.append(hit,jsonEditor('Room geometry JSON',scene.geometry,value=>changed(()=>{scene.geometry=value;}),{id:'developer-room-geometry'}),jsonEditor('Complete scene JSON',scene,value=>changed(()=>{draft.scenes[roomId]=value;}),{id:'developer-scene-json'}));
    const global=el('details','dc-advanced');global.append(el('summary','','Game title, music & player settings'),fields(field('Game title',draft.settings.title,value=>changed(()=>{draft.settings.title=value;}),{id:'developer-game-title',path:['settings','title']}),field('Tempo (BPM)',draft.settings.bpm,value=>changed(()=>{draft.settings.bpm=value;}),{id:'developer-tempo',path:['settings','bpm'],type:'number',min:20,max:400,step:1}),field('Player size',draft.player.worldSize,value=>changed(()=>{draft.player.worldSize=value;}),{id:'developer-player-size',path:['player','worldSize'],type:'number',min:20,max:600,step:1})),select('Starting room',draft.settings.startRoomId,optionRooms(),value=>changed(()=>{draft.settings.startRoomId=value;}),{id:'developer-start-room',path:['settings','startRoomId']}),field('Player sprite sheet',draft.player.image??'assets/mira-walk.webp',value=>changed(()=>{draft.player.image=value;}),{id:'developer-player-image',path:['player','image']}),field('Companion sprite sheet',draft.settings.castImage??'assets/party-cast.webp',value=>changed(()=>{draft.settings.castImage=value;}),{id:'developer-cast-image',path:['settings','castImage']}));editor.append(global);
  }

  function renderPlaytest(){
    const state=getState()??{},enabled=!!state.developerMode,section=card('Live playtest',enabled?'Changes below affect only your separate developer run.':'Start a separate playtest to change notes, jump between rooms, and repeat pickups.');
    const info=el('p','dc-live-state',enabled?`Testing ${location(state.roomId)?.title??state.roomId} · ${state.phase??'room'}`:'Your normal adventure is currently active.');section.append(info,button('Start playtest in this room',()=>applyProject({roomId}),{id:'developer-start-playtest',className:'mg-primary'}));
    if(enabled)section.append(button('Return to normal game',()=>void invoke(onReturnToGame,[],'Normal adventure restored.',{leave:true}),{id:'developer-return'}));editor.append(section);
    const travel=card('Jump to a room');let targetRoom=location(state.roomId)?state.roomId:roomId;const picker=select('Destination room',targetRoom,optionLocations(),value=>{targetRoom=value;},{id:'developer-live-room'});travel.append(picker,button('Teleport',async()=>{if(await invoke(onTeleport,[targetRoom],'Playtest moved to the selected room.'))render();},{id:'developer-teleport',disabled:!enabled}));editor.append(travel);
    const notes=card('Live note inventory','Set exact carried quantities. This does not edit the project’s starting notes.');const stock=clone(state.inventory??draft.settings.initialInventory);const quantities=inventoryEditor(stock,(id,value)=>{stock[id]=value;},{id:'developer-live-inventory',live:true});for(const input of quantities.querySelectorAll('input'))input.disabled=!enabled;notes.append(quantities,button('Set live inventory',async()=>{if(Object.values(stock).some(value=>!Number.isSafeInteger(value)||value<0||value>999)){showIssues({errors:['Live note quantities must be whole numbers from 0 to 999.']});return;}if(await invoke(onSetInventory,[stock],'Live inventory updated.'))render();},{id:'developer-set-inventory',disabled:!enabled}));editor.append(notes);
    const reset=card('Repeat a gift or chest','Resetting a test pickup makes it collectible again. It leaves the current test inventory as you set it.');let resetId='';reset.append(select('Pickup to reset','',[['','All pickups'],...Object.values(draft.sources).map(source=>[source.id,source.label])],value=>{resetId=value;},{id:'developer-reset-source'}),button('Reset pickup claims',async()=>{if(await invoke(onResetSources,[resetId||null],'Selected playtest pickups can be collected again.'))render();},{id:'developer-reset-sources',disabled:!enabled}));editor.append(reset);
  }
  function renderJSON(){const section=card('Complete project JSON','Every authored field is here: dialogue, answers, supplies, connections, room art, geometry, actors, note definitions, outcomes and settings. Changes are data, not executable code.');const area=el('textarea','dc-json-area');area.id='developer-project-json';area.spellcheck=false;area.rows=24;area.setAttribute('aria-label','Complete developer project JSON');area.value=jsonBuffer??JSON.stringify(draft,null,2);area.addEventListener('input',()=>{jsonBuffer=area.value;jsonDirty=true;dirty=true;updateControls();});section.append(area,button('Validate & use JSON draft',()=>{const project=candidate();if(project)replaceDraft(project,'JSON validated and loaded into the editors.');},{id:'developer-json-apply'}));editor.append(section);}
  function searchResults(){
    const results=[],needle=query.toLowerCase();
    const add=(value,label,selection)=>{value=text(value);if(value.toLowerCase().includes(needle))results.push({label,value,...selection});};
    for(const [id,room]of Object.entries(locations())){
      const content=draft.content[id];if(!content)continue;const label=room.title??id;
      for(const key of ['title','arrival'])add(content[key],`${label} · ${key}`,{room:id,tab:'rooms'});
      for(const [index,line]of (content.cutscene??[]).entries())add(line.text,`${label} · entrance line ${index+1}`,{room:id,cutscene:index,tab:'cutscene'});
      for(const person of content.people??[]){
        for(const key of ['name','role','intro'])add(person[key],`${person.name} · ${label} · ${key}`,{room:id,person:person.id,tab:'dialogue'});
        for(const reply of getPersonReplies(person))for(const key of ['label','text'])add(reply[key],`${person.name} · ${label} · ${reply.label}`,{room:id,person:person.id,reply:reply.id,tab:'dialogue'});
      }
      for(const entry of content.inspections??[])for(const key of ['title','label','text'])add(entry[key],`${entry.title} · ${label}`,{room:id,inspection:entry.id,tab:'dialogue'});
      for(const [door,copy]of Object.entries(content.doorCopy??{}))for(const key of ['name','hint','warning','previewCopy','deadCopy','repair'])add(copy[key],`${copy.name??door} · ${key}`,{room:id,door:Object.values(draft.doors).find(item=>item.id===door||item.canonicalId===door)?.id??door,tab:'puzzles'});
      for(const key of ['kicker','copy','repair'])add(content.outcome?.[key],`${label} · ${key}`,{room:id,tab:'rooms'});
    }
    for(const source of Object.values(draft.sources))if(location(source.roomId))for(const key of ['label','hint'])add(source[key],source.label,{room:source.roomId,source:source.id,tab:'notes'});
    const section=card('Search results',`${results.length} matching fields`);
    for(const result of results.slice(0,80)){
      const item=button('',()=>{if(!consumeJSON())return;roomId=result.room;tab=result.tab;personId=result.person??personId;replyId=result.reply??replyId;doorId=result.door??doorId;sourceId=result.source??sourceId;loreId=result.inspection??null;if(result.cutscene!==undefined)cutsceneStates.set(roomId,{...(cutsceneStates.get(roomId)??{}),mode:'dialogue',selectedIndex:result.cutscene});query='';searchInput.value='';onSelectRoom(roomId,clone(draft));render();},{className:'dc-search-result'});
      item.append(el('strong','',result.label),el('span','dc-muted',result.value.slice(0,180)));section.append(item);
    }
    if(!results.length)section.append(el('p','dc-muted','No matching dialogue, observations, clues or source text.'));editor.append(section);
  }
  function render(){
    if(!draft)return;destroyCutsceneEditor();destroyObjectDialogueEditor();const rooms=Object.keys(locations());if(!rooms.includes(roomId))roomId=rooms[0];
    roomSelect.replaceChildren();for(const [id,label]of optionLocations()){const item=button('',()=>{if(!consumeJSON())return;roomId=id;loreId=null;query='';searchInput.value='';onSelectRoom(roomId,clone(draft));render();},{className:'dc-room-card','data-dev-room':id,'aria-pressed':String(id===roomId)});const image=el('img');image.src=draft.scenes[id]?.image??'';image.alt='';item.append(image,el('span','',label));roomSelect.append(item);}
    for(const item of tabs.querySelectorAll('[data-dev-tab]')){const active=item.dataset.devTab===tab;item.setAttribute('aria-selected',String(active));item.tabIndex=active?0:-1;}body.setAttribute('aria-labelledby','developer-tab-'+tab);body.dataset.editor=tab;body.replaceChildren();editor=el('main','dc-inspector');body.append(editor);
    if(query)searchResults();else if(tab==='dialogue')renderDialogue();else if(tab==='cutscene'){const {content,scene}=getCurrent();renderCutsceneEditor(content,scene);}else if(tab==='puzzles')renderPuzzles();else if(tab==='notes')renderNotes();else if(tab==='rooms')renderRooms();else if(tab==='playtest')renderPlaytest();else renderJSON();updateControls();
  }
  searchInput.addEventListener('input',()=>{query=searchInput.value.trim();render();});
  tabs.addEventListener('keydown',event=>{const items=[...tabs.querySelectorAll('[data-dev-tab]')],index=items.indexOf(document.activeElement);if(index<0)return;let next;if(event.key==='ArrowRight')next=(index+1)%items.length;else if(event.key==='ArrowLeft')next=(index-1+items.length)%items.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=items.length-1;else return;event.preventDefault();if(!consumeJSON())return;tab=items[next].dataset.devTab;query='';searchInput.value='';render();body.scrollTop=0;items[next].focus();});
  dialog.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='F2'||event.key==='Escape'){event.preventDefault();close();}});dialog.addEventListener('keyup',event=>event.stopPropagation());
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',()=>onClose());
  function open(options={}){
    flushEditors();
    if(options.personId||options.doorId||options.sourceId||options.objectId){query='';searchInput.value='';}
    if(disposed)return;const latest=getProject(),latestJSON=JSON.stringify(latest);if(!draft||!dirty&&latestJSON!==sourceJSON){draft=clone(latest);sourceJSON=latestJSON;jsonBuffer=null;jsonDirty=false;past.length=0;future.length=0;}
    if(options.tab&&TABS.some(([id])=>id===options.tab))tab=options.tab;if(options.roomId)roomId=options.roomId;if(options.personId){personId=options.personId;loreId=null;tab='dialogue';}if(options.doorId){doorId=options.doorId;tab='puzzles';}if(options.sourceId){sourceId=options.sourceId;tab='notes';}if(options.objectId){objectId=options.objectId;const item=draft.scenes[options.roomId??roomId]?.objects.find(item=>item.id===options.objectId);if(item?.type==='inspect'){loreId=item.id;tab='dialogue';}else tab='rooms';}
    render();const wasOpen=dialog.open;if(!wasOpen){dialog.show();onOpen();}if(options.roomId)onSelectRoom(roomId,clone(draft));publishDraft();if(!wasOpen)closeButton.focus({preventScroll:true});if(!status.textContent)say('Your project draft is ready. Edits are local until you export them for publishing.');
  }
  function moveActor(id,x,y){
    flushEditors();
    if(!draft||!Number.isFinite(x)||!Number.isFinite(y))return false;
    const next=clone(draft),scene=next.scenes[roomId],actor=scene?.actors.find(actor=>actor.id===id);if(!actor)return false;
    translateActor(scene,actor,x,y);const result=validateProject(next);if(!result.valid){showIssues(result);say('That position would block an interaction. The character has not moved.');return false;}
    record();draft=next;dirty=true;jsonDirty=false;jsonBuffer=null;actorId=id;tab='rooms';clearIssues();publishDraft();render();say('Character moved. Its interaction area and collision moved with it.');return true;
  }
  function selectCutsceneActor(id){
    if(!dialog.open||!draft||!consumeJSON())return false;
    if(!['cutscene','rooms'].includes(tab)||!cutsceneEditor){tab='cutscene';query='';searchInput.value='';render();}
    return cutsceneEditor?.selectActor(id)??false;
  }
  function updateCutscenePath(index,patch){
    if(!dialog.open||!draft||!Number.isInteger(index)||!consumeJSON())return false;
    if(!cutsceneEditor||!['cutscene','rooms'].includes(tab))return false;
    return cutsceneEditor.updatePath(index,patch);
  }
  function close(){destroyCutsceneEditor();destroyObjectDialogueEditor();if(dialog.open)dialog.close();dialog.classList.remove('dc-expanded');expandButton.textContent='Expand';expandButton.setAttribute('aria-expanded','false');expandButton.setAttribute('aria-label','Expand editor');}
  return Object.freeze({open,close,moveActor,selectCutsceneActor,updateCutscenePath,refresh(){if(dialog.open)render();},get activeTab(){return tab;},get isOpen(){return dialog.open;},destroy(){if(disposed)return;close();disposed=true;dialog.remove();}});
}
