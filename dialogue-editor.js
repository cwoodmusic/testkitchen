/* Dialogue is project data. It is never interpreted as HTML or JavaScript. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaDialogueEditor=api;})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const LIMITS=Object.freeze({description:1000,greeting:500,greetings:8,label:80,reply:1200,choices:12});
  const copy=value=>JSON.parse(JSON.stringify(value));
  const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const text=(value,max,empty=false)=>typeof value==='string'&&value.length<=max&&(empty||value.trim().length>0);
  function validEntry(entry){
    if(!record(entry)||Object.keys(entry).some(key=>!['description','greetings','choices'].includes(key)))return false;
    if(!text(entry.description,LIMITS.description,true)||!Array.isArray(entry.greetings)||entry.greetings.length<1||entry.greetings.length>LIMITS.greetings||!entry.greetings.every(line=>text(line,LIMITS.greeting)))return false;
    if(!Array.isArray(entry.choices)||entry.choices.length>LIMITS.choices)return false;
    const ids=new Set();
    for(const choice of entry.choices){
      if(!record(choice)||Object.keys(choice).some(key=>!['id','label','reply'].includes(key))||typeof choice.id!=='string'||choice.id==='greeting'||!/^[a-z][a-z0-9-]{0,39}$/.test(choice.id)||ids.has(choice.id)||!text(choice.label,LIMITS.label)||!text(choice.reply,LIMITS.reply,choice.id==='activity'))return false;
      ids.add(choice.id);
    }
    return true;
  }
  function validate(data,defaults={}){
    return record(data)&&Object.keys(data).length<=Object.keys(defaults).length&&Object.keys(data).every(id=>Object.hasOwn(defaults,id)&&validEntry(data[id]));
  }
  function resolved(defaults,overrides,id){return Object.hasOwn(overrides||{},id)?copy(overrides[id]):Object.hasOwn(defaults||{},id)?copy(defaults[id]):null;}
  function mount(api={}){
    const host=api.host;if(!host)throw Error('The dialogue editor needs a panel.');
    const doc=host.ownerDocument,defaults=api.defaults||{},ids=Object.keys(defaults),people=api.people||[],drafts=new Map();
    let selected=ids[0]||null,signature='',lastApplied={},previewIndex=0,form=null,preview=null,notice=null,disposed=false;
    const node=(tag,className,value)=>{const element=doc.createElement(tag);if(className)element.className=className;if(value!==undefined)element.textContent=value;return element;};
    const button=(label,fn,className='')=>{const element=node('button',className,label);element.type='button';element.onclick=fn;return element;};
    const data=()=>api.getData?.()||{};
    const name=id=>people.find(person=>person.id===id)?.name||id.replace(/[-_]/g,' ').replace(/^./,letter=>letter.toUpperCase());
    const draft=()=>drafts.get(selected);
    const current=()=>resolved(defaults,data(),selected);
    function status(value,bad=false){if(notice){notice.textContent=value;notice.dataset.error=String(bad);}}
    function markDraft(){status('Draft changes are shown in the preview. Apply dialogue to use them in the game.');updatePreview();}
    function field(label,value,max,change,rows=3){
      const wrap=node('label','dialogue-field',label),input=node('textarea');input.rows=rows;input.maxLength=max;input.value=value;input.spellcheck=true;input.oninput=()=>{change(input.value);markDraft();};wrap.append(input);return wrap;
    }
    function updatePreview(){
      if(!preview||!selected)return;preview.replaceChildren();const value=draft();
      preview.append(node('strong','',name(selected)),node('p','dialogue-preview-description',value.description));
      const line=node('p','dialogue-preview-line',value.greetings[previewIndex%value.greetings.length]||'Add a greeting to preview it.');line.setAttribute('role','status');preview.append(line);
      const choices=node('div','dialogue-preview-choices');
      for(const choice of value.choices)choices.append(button(choice.label||'Untitled choice',()=>{line.textContent=choice.reply||(choice.id==='activity'?'The musician describes what they are doing in the arcade.':'Add a reply to preview it.');}));
      preview.append(choices);
    }
    function renderForm(){
      form.replaceChildren();if(!selected)return;const value=draft();
      form.append(field('About this musician',value.description,LIMITS.description,text=>value.description=text,3));
      const greetings=node('section','dialogue-list');greetings.append(node('h4','','Greetings'));
      value.greetings.forEach((line,index)=>{
        const row=node('div','dialogue-entry');row.append(field('Greeting '+(index+1),line,LIMITS.greeting,text=>value.greetings[index]=text,3));
        const actions=node('div','dev-toolbar');const remove=button('Remove greeting '+(index+1),()=>{value.greetings.splice(index,1);previewIndex=0;renderForm();markDraft();});remove.disabled=value.greetings.length===1;actions.append(remove);row.append(actions);greetings.append(row);
      });
      const addGreeting=button('Add greeting',()=>{value.greetings.push('Hello! What would you like to talk about?');renderForm();markDraft();});addGreeting.disabled=value.greetings.length>=LIMITS.greetings;greetings.append(addGreeting);form.append(greetings);
      const choices=node('section','dialogue-list');choices.append(node('h4','','Conversation choices'),node('p','dev-note','Each button offers a reply. Leave the activity reply empty to keep the musician’s live description of what they are doing.'));
      value.choices.forEach((choice,index)=>{
        const row=node('div','dialogue-entry');row.dataset.dialogueChoice=choice.id;
        const label=node('label','dialogue-field','Button label '+(index+1)),input=node('input');input.type='text';input.maxLength=LIMITS.label;input.value=choice.label;input.oninput=()=>{choice.label=input.value;markDraft();};label.append(input);row.append(label,field('Reply '+(index+1),choice.reply,LIMITS.reply,text=>choice.reply=text,4));
        const actions=node('div','dev-toolbar'),up=button('↑ Move up',()=>{[value.choices[index-1],value.choices[index]]=[value.choices[index],value.choices[index-1]];renderForm();markDraft();}),down=button('↓ Move down',()=>{[value.choices[index],value.choices[index+1]]=[value.choices[index+1],value.choices[index]];renderForm();markDraft();});
        up.disabled=index===0;down.disabled=index===value.choices.length-1;up.setAttribute('aria-label','Move choice '+(index+1)+' up');down.setAttribute('aria-label','Move choice '+(index+1)+' down');actions.append(up,down,button('Remove choice',()=>{value.choices.splice(index,1);renderForm();markDraft();}));row.append(actions);choices.append(row);
      });
      const add=button('Add conversation choice',()=>{const taken=new Set(value.choices.map(choice=>choice.id));let number=1;while(taken.has('custom-'+number))number++;value.choices.push({id:'custom-'+number,label:'Ask another question',reply:'Here is a new musical idea to explore.'});renderForm();markDraft();});add.disabled=value.choices.length>=LIMITS.choices;choices.append(add);form.append(choices);
      const actions=node('div','dev-toolbar'),apply=button('Apply dialogue',()=>{
        const entry=copy(value);entry.description=entry.description.trim();entry.greetings=entry.greetings.map(line=>line.trim());entry.choices=entry.choices.map(choice=>({...choice,label:choice.label.trim(),reply:choice.reply.trim()}));
        if(!validEntry(entry)){status('Use at least one greeting, and give every choice a button label and reply. Only the activity reply may be empty.',true);return;}
        if(api.onApply?.(selected,entry)===false){status('Dialogue could not be applied. Your draft is still here.',true);return;}
        drafts.set(selected,copy(entry));signature=JSON.stringify(data());status('Applied dialogue for '+name(selected)+'. Project Save and Export include these changes.');updatePreview();
      });apply.id='devDialogueApply';actions.append(apply,button('Revert draft',()=>{drafts.set(selected,current());previewIndex=0;renderForm();status('Draft restored to the current applied dialogue.');updatePreview();}));form.append(actions);
      const reset=button('Reset this musician to default',()=>{
        const hadOverride=Object.hasOwn(data(),selected);
        if(api.onReset?.(selected)===false){status('The default dialogue could not be restored.',true);return;}
        drafts.set(selected,copy(defaults[selected]));signature=JSON.stringify(data());previewIndex=0;renderForm();status('Restored '+name(selected)+'’s default dialogue.'+(hadOverride?' Undo is available.':''));updatePreview();
      });reset.id='devDialogueReset';form.append(reset);updatePreview();
    }
    function refresh(){
      if(disposed)return;const applied=data(),next=JSON.stringify(applied);if(next===signature&&form)return;signature=next;
      for(const id of ids)if(!drafts.has(id)||JSON.stringify(resolved(defaults,lastApplied,id))!==JSON.stringify(resolved(defaults,applied,id)))drafts.set(id,resolved(defaults,applied,id));
      lastApplied=copy(applied);previewIndex=0;if(form)renderForm();
    }
    host.classList.add('dialogue-editor');host.append(node('h3','dev-heading','Musician dialogue'),node('p','dev-note','Edit what each musician says. Preview your draft, then apply it. Applied dialogue saves and travels with the complete world project.'));
    const picker=node('label','dialogue-field','Choose a musician'),select=node('select');select.id='devDialoguePerson';select.setAttribute('aria-label','Dialogue musician');
    for(const id of ids){const option=node('option','',name(id));option.value=id;select.append(option);}select.onchange=()=>{selected=select.value;previewIndex=0;renderForm();status('Editing '+name(selected)+'. Changes stay in the draft until applied.');};picker.append(select);host.append(picker);
    const previewHeading=node('div','dev-toolbar');previewHeading.append(node('h4','','Conversation preview'),button('Preview next greeting',()=>{previewIndex++;updatePreview();}));preview=node('section','dialogue-preview');preview.setAttribute('aria-label','Dialogue draft preview');host.append(previewHeading,preview);
    notice=node('p','dialogue-status','Choose a musician and edit their dialogue.');notice.id='devDialogueStatus';notice.setAttribute('role','status');host.append(notice);form=node('div','dialogue-form');host.append(form);refresh();
    if(!ids.length){status('No musician dialogue defaults are available.',true);select.disabled=true;}
    return {refresh,getState:()=>({selected,draft:selected?copy(draft()):null,applied:copy(data())}),dispose(){disposed=true;host.replaceChildren();}};
  }
  return {LIMITS,validEntry,validate,resolved,mount};
});
