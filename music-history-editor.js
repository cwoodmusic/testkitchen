/* Music-history authoring is world-project content, never player progression. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CodaMusicHistoryEditor=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 function mount(api={}){
  const host=api.host;if(!host?.ownerDocument)throw Error('The music-facts editor needs a panel.');
  const doc=host.ownerDocument,win=doc.defaultView,model=api.content||win.CodaMusicHistoryContent;
  if(!model)throw Error('Music-history content tools are unavailable.');
  const people=model.PEOPLE,personIds=Object.keys(people),questions=model.QUESTIONS;
  const entries=personIds.flatMap(person=>people[person].facts.map((fact,index)=>({person,number:index+1,...fact})));
  const byId=new Map(entries.map(fact=>[fact.id,fact])),byQuiz=new Map(questions.map(question=>[question.id,question]));
  let selected=entries[0]?.id||null,person=entries[0]?.person||'',query='',signature='',disposed=false,applying=false;
  const factDrafts=new Map(),quizDrafts=new Map(),quizFields=new Map();
  const node=(tag,className,text)=>{const el=doc.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
  const button=(text,run,id,write=false)=>{const el=node('button','',text);el.type='button';if(id)el.id=id;if(write)el.dataset.musicFactsWrite='';el.onclick=run;return el;};
  const editable=()=>{try{return !disposed&&api.canEdit?.()!==false;}catch{return false;}};
  const data=()=>{const value=api.getData?.();return value===undefined?copy(model.EMPTY):value;};
  const safeData=()=>model.normalize(data())||copy(model.EMPTY);
  const factValue=(applied,id)=>Object.hasOwn(applied.facts,id)?applied.facts[id]:byId.get(id)?.text||'';
  const quizValue=(applied,id)=>{const value=applied.quizzes[id]||byQuiz.get(id);return value?{prompt:value.prompt,choices:value.choices.slice(),answer:value.answer}:null;};
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function factDraft(id){if(!factDrafts.has(id)){const text=factValue(safeData(),id);factDrafts.set(id,{text,base:text});}return factDrafts.get(id);}
  function quizDraft(id){if(!quizDrafts.has(id)){const value=quizValue(safeData(),id);quizDrafts.set(id,{value:copy(value),base:copy(value)});}return quizDrafts.get(id);}
  function status(text,bad=false){notice.textContent=text;notice.dataset.error=String(bad);}
  function field(label,input){const wrap=node('label','music-facts-field',label);wrap.append(input);return wrap;}
  function textInput(label,value,max,change,rows){const input=node(rows?'textarea':'input');if(rows)input.rows=rows;else input.type='text';input.setAttribute('aria-label',label);input.maxLength=max;input.value=value;input.spellcheck=true;input.dataset.musicFactsWrite='';input.oninput=()=>change(input.value);return input;}
  function updatePermissions(){
   const allowed=editable();
   for(const control of host.querySelectorAll('[data-music-facts-write]')){
    if(control.tagName==='TEXTAREA'||control.tagName==='INPUT')control.readOnly=!allowed;
    else control.disabled=!allowed;
   }
   readonly.hidden=allowed;
  }
  function draftStatus(){const draft=factDraft(selected);factCount.textContent=draft.text.length+' / '+model.LIMITS.fact+' characters'+(draft.text!==draft.base?' · Unapplied draft':'');}
  function syncQuizChoices(ref,draft){for(let index=0;index<ref.answer.options.length;index++)ref.answer.options[index].textContent='Choice '+(index+1)+': '+(draft.choices[index]||'Add answer text').slice(0,90);}
  function apply(next,success){
   if(!editable()){status('This editor is read-only for the current player.',true);return false;}
   if(typeof api.onApply!=='function'){status('Project saving is unavailable. Your draft is still here.',true);return false;}
   const normalized=model.normalize(next);
   if(!normalized){status('Use nonempty fact and question text within the character limits, distinct quiz choices, and a valid correct answer.',true);return false;}
   applying=true;let accepted=false;
   try{accepted=api.onApply?.(normalized)!==false;}catch{accepted=false;}finally{applying=false;}
   if(!accepted){status('These edits could not be applied. Your draft is still here.',true);return false;}
   const applied=safeData();signature=JSON.stringify(applied);success?.(applied);renderResults(false);syncCurrent();updatePermissions();return true;
  }
  function applyFact(){
   const draft=factDraft(selected),next=safeData();next.facts[selected]=draft.text;
   apply(next,applied=>{const text=factValue(applied,selected);factDrafts.set(selected,{text,base:text});status('Applied this fact. Save project or Export project JSON to keep a backup and publish your changes.');});
  }
  function resetFact(){
   const next=safeData();delete next.facts[selected];
   apply(next,applied=>{const text=factValue(applied,selected);factDrafts.set(selected,{text,base:text});status('Restored this fact to its original text. Undo is available in the console.');});
  }
  function applyQuiz(id){
   const next=safeData();next.quizzes[id]=copy(quizDraft(id).value);
   apply(next,applied=>{const value=quizValue(applied,id);quizDrafts.set(id,{value:copy(value),base:copy(value)});status('Applied the linked quiz question. Its musician and source fact stay the same. Save or export the project to keep a backup.');});
  }
  function resetQuiz(id){
   const next=safeData();delete next.quizzes[id];
   apply(next,applied=>{const value=quizValue(applied,id);quizDrafts.set(id,{value:copy(value),base:copy(value)});status('Restored this quiz question to its original text and answer. Undo is available in the console.');});
  }
  function syncCurrent(){
   if(!selected)return;factText.value=factDraft(selected).text;draftStatus();
   for(const [id,ref]of quizFields){const value=quizDraft(id).value;ref.prompt.value=value.prompt;ref.choices.forEach((input,index)=>input.value=value.choices[index]);ref.answer.value=String(value.answer);syncQuizChoices(ref,value);}
  }
  function refresh(){
   if(disposed||applying)return;const applied=safeData(),next=JSON.stringify(applied);
   if(next!==signature){
    for(const [id,draft]of factDrafts){const updated=factValue(applied,id);if(draft.text===draft.base){draft.text=updated;draft.base=updated;}}
    for(const [id,draft]of quizDrafts){const updated=quizValue(applied,id);if(equal(draft.value,draft.base)){draft.value=copy(updated);draft.base=copy(updated);}}
    signature=next;renderResults(false);syncCurrent();
   }
   updatePermissions();
  }
  function selectFact(id,scroll=false){
   const entry=byId.get(id);if(!entry)return;selected=id;person=entry.person;personSelect.value=person;renderFactOptions();renderCurrent();renderResults(false);
   if(scroll){browse.open=false;form.scrollIntoView?.({block:'nearest'});factText.focus({preventScroll:true});}
  }
  function renderFactOptions(){
   factSelect.replaceChildren();for(const entry of entries){if(person&&entry.person!==person)continue;const option=node('option','',(person?'':people[entry.person].name+' · ')+'Fact '+entry.number);option.value=entry.id;factSelect.append(option);}factSelect.value=selected;
  }
  function renderResults(resetScroll=true){
   const oldScroll=results.scrollTop,applied=safeData(),term=query.trim().toLocaleLowerCase();results.replaceChildren();
   const matches=entries.filter(entry=>term?(people[entry.person].name+' '+factValue(applied,entry.id)).toLocaleLowerCase().includes(term):!person||entry.person===person);
   summary.textContent=(term?'Search results':'Browse facts')+' · '+matches.length+' / '+entries.length;
   for(const entry of matches){
    const item=node('li'),open=button('',()=>selectFact(entry.id,true));open.className='music-facts-result';open.dataset.musicFact=entry.id;open.setAttribute('aria-label','Edit '+people[entry.person].name+' fact '+entry.number);open.setAttribute('aria-current',String(entry.id===selected));
    open.append(node('strong','',people[entry.person].name+' · Fact '+entry.number),node('span','',factValue(applied,entry.id)));item.append(open);results.append(item);
   }
   if(!matches.length)results.append(node('li','music-facts-empty','No facts match this search.'));
   if(!resetScroll)results.scrollTop=oldScroll;
  }
  function renderCurrent(){
   form.replaceChildren();quizFields.clear();if(!selected)return;const entry=byId.get(selected);
   form.append(node('h4','',people[entry.person].name+' · Fact '+entry.number+' of '+people[entry.person].facts.length));
   factText=textInput('Music fact text',factDraft(selected).text,model.LIMITS.fact,value=>{factDraft(selected).text=value;draftStatus();status('Draft only. Apply fact to use this text in the game.');},5);factText.id='devMusicFactText';form.append(field('Fact text',factText));
   factCount=node('p','music-facts-counter');form.append(factCount);
   const actions=node('div','music-facts-actions');actions.append(button('Apply fact',applyFact,'devMusicFactApply',true),button('Revert draft',()=>{const text=factValue(safeData(),selected);factDrafts.set(selected,{text,base:text});syncCurrent();status('Fact draft restored to the currently applied text.');},'devMusicFactRevert',true),button('Restore default fact',resetFact,'devMusicFactReset',true));form.append(actions);
   const linked=questions.filter(question=>question.factId===selected),section=node('section','music-facts-quizzes');section.append(node('h4','','Linked quiz questions'));
   if(!linked.length)section.append(node('p','dev-note','No quiz question is linked to this fact.'));
   else{
    section.append(node('p','dev-note','If you change the information in this fact, review its question and correct answer too.'));
    for(const [questionIndex,question]of linked.entries()){
     const draft=quizDraft(question.id).value,card=node('details','music-facts-quiz');card.open=true;card.dataset.musicFactQuiz=question.id;card.append(node('summary','','Quiz question '+(questionIndex+1)));
     const prompt=textInput('Quiz question '+(questionIndex+1),draft.prompt,model.LIMITS.prompt,value=>{quizDraft(question.id).value.prompt=value;status('Quiz draft only. Apply quiz question to use these changes.');},3);card.append(field('Question',prompt));
     const choices=[];for(const [index,text]of draft.choices.entries()){
      const input=textInput('Quiz choice '+(index+1),text,model.LIMITS.choice,value=>{const current=quizDraft(question.id).value;current.choices[index]=value;syncQuizChoices(quizFields.get(question.id),current);status('Quiz draft only. Apply quiz question to use these changes.');});choices.push(input);card.append(field('Choice '+(index+1),input));
     }
     const answer=node('select');answer.dataset.musicFactsWrite='';answer.setAttribute('aria-label','Correct quiz answer');draft.choices.forEach((choice,index)=>{const option=node('option','');option.value=String(index);answer.append(option);});answer.value=String(draft.answer);answer.onchange=()=>{quizDraft(question.id).value.answer=Number(answer.value);status('Quiz draft only. Apply quiz question to use this answer.');};card.append(field('Correct answer',answer));
     const ref={prompt,choices,answer};quizFields.set(question.id,ref);syncQuizChoices(ref,draft);
     const quizActions=node('div','music-facts-actions');quizActions.append(button('Apply quiz question',()=>applyQuiz(question.id),null,true),button('Revert quiz draft',()=>{const value=quizValue(safeData(),question.id);quizDrafts.set(question.id,{value:copy(value),base:copy(value)});syncCurrent();status('Quiz draft restored to the currently applied question.');},null,true),button('Restore default question',()=>resetQuiz(question.id),null,true));card.append(quizActions);section.append(card);
    }
   }
   form.append(section);draftStatus();updatePermissions();
  }
  host.classList.add('music-facts-editor');host.replaceChildren();host.append(node('h3','dev-heading','Music facts'),node('p','dev-note','Browse and edit all '+entries.length+' music-history facts, including discoveries that players have not unlocked. Applied edits travel with Save project and Export project JSON.'));
  const readonly=node('p','music-facts-readonly','This editor is read-only for the current player.');readonly.hidden=editable();host.append(readonly);
  const filters=node('div','music-facts-filters'),personSelect=node('select'),factSelect=node('select'),search=node('input');personSelect.id='devMusicFactPerson';personSelect.setAttribute('aria-label','Fact musician');factSelect.id='devMusicFactNumber';factSelect.setAttribute('aria-label','Music fact');search.id='devMusicFactSearch';search.type='search';search.placeholder='Search every musician and fact';search.setAttribute('aria-label','Search all music facts');
  const all=node('option','','All musicians');all.value='';personSelect.append(all);for(const id of personIds){const option=node('option','',people[id].name);option.value=id;personSelect.append(option);}personSelect.value=person;
  personSelect.onchange=()=>{person=personSelect.value;query='';search.value='';if(person)selected=people[person].facts[0].id;renderFactOptions();renderCurrent();renderResults();status('Browsing '+(person?people[person].name:'all musicians')+'. Applied facts are shown in the list.');};factSelect.onchange=()=>selectFact(factSelect.value);search.oninput=()=>{query=search.value;browse.open=true;renderResults();};
  filters.append(field('Musician',personSelect),field('Fact',factSelect),field('Search all facts',search));host.append(filters);
  const browse=node('details','music-facts-browse');browse.open=true;const summary=node('summary'),results=node('ol','music-facts-results');results.setAttribute('aria-label','Music fact browser');browse.append(summary,results);host.append(browse);
  const notice=node('p','music-facts-status','Choose a musician and fact. Edit a draft, then apply it. Browsing does not unlock player discoveries.');notice.id='devMusicFactStatus';notice.setAttribute('role','status');host.append(notice);
  const form=node('div','music-facts-form');host.append(form);let factText=null,factCount=null;
  renderFactOptions();renderCurrent();refresh();
  return {refresh,getState:()=>({selectedPerson:byId.get(selected)?.person||null,selectedFact:selected,query,draft:selected?factDraft(selected).text:null,applied:copy(safeData())}),dispose(){if(disposed)return;disposed=true;host.classList.remove('music-facts-editor');host.replaceChildren();}};
 }
 return {mount};
});
