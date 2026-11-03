/* Quest-earned discoveries, the scholar's record, and mastery quizzes. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./music-history-progress.js'):root.CodaMusicHistoryProgress);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaMusicHistory=api;})(typeof window==='undefined'?null:window,function(Progress){
 'use strict';
 function create(api={}){
  const doc=api.document||document,win=doc.defaultView;let storage=api.storage;try{if(storage===undefined)storage=win.localStorage;}catch{}
  const engine=Progress.create({...api,storage}),node=(tag,text)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const dialog=node('dialog');dialog.className='music-history';dialog.setAttribute('aria-labelledby','history-title');doc.body.append(dialog);
  const header=node('div'),title=node('h2','The Scholar'),closeButton=node('button','Close');closeButton.type='button';title.id='history-title';title.tabIndex=-1;header.className='history-dialog-heading';header.append(title,closeButton);dialog.append(header);const content=node('div');dialog.append(content);
  let opened=false,owner=null,previous=null,timer=null,filter='',query='',view='',developerRefresh=null;
  const spoken=new Set();
  function speak(target){if(win.CodaDialogueText){win.CodaDialogueText.show(target,target.textContent);spoken.add(target);}return target;}
  function stopSpeech(){for(const target of spoken)win.CodaDialogueText?.cancel(target);spoken.clear();}
  const allowed=()=>{try{return api.canUse?.()!==false;}catch{return false;}};
  function nearby(){try{return allowed()&&api.canVisitScholar?.()===true;}catch{return false;}}
  function close(){if(!opened)return;stopSpeech();opened=false;win.clearInterval(timer);dialog.close();doc.body.classList.remove('music-history-open');doc.body.append(dialog);if(owner===api.getIdentity?.()){if(previous?.isConnected&&previous.getClientRects().length)previous.focus({preventScroll:true});else api.focusReturn?.();}api.onClose?.();content.replaceChildren();}
  function mount(){const fs=doc.fullscreenElement||doc.webkitFullscreenElement;if(fs&&!/^(CANVAS|IFRAME|VIDEO)$/.test(fs.tagName))fs.append(dialog);else doc.body.append(dialog);}
  function open(){if(!allowed())return false;if(!opened){previous=doc.activeElement;owner=api.getIdentity?.();api.onOpen?.();mount();dialog.showModal();opened=true;doc.body.classList.add('music-history-open');timer=win.setInterval(()=>{if(owner!==api.getIdentity?.()||!allowed()||['scholar','pouch','record','quizzes','quiz','help'].includes(view)&&!nearby())close();},200);}return true;}
  function notice(text,parent=content){const p=node('p',text);p.setAttribute('role','status');parent.append(p);return p;}
  function button(text,run,parent=content){const b=node('button',text);b.type='button';b.onclick=run;parent.append(b);return b;}
  function begin(name,mode){if(!open())return false;view=mode;dialog.dataset.historyView=mode;stopSpeech();title.textContent=name;content.className='';content.replaceChildren();dialog.scrollTop=0;return true;}
  function update(){try{api.onChange?.(engine.snapshot());}catch{}developerRefresh?.();}
  const collectionSize=person=>person?.facts?.length||Progress.PEOPLE?.[person?.id]?.facts?.length||0;
  const amount=value=>Number(value).toLocaleString('en-US');
  function rewardMessage(){
   const rewards=Object.values(Progress.PEOPLE||{}).flatMap(person=>person.facts.map(fact=>Progress.factReward(fact.id))).filter(Number.isFinite),low=Math.min(...rewards),high=Math.max(...rewards);
   const facts=rewards.length?'Each fact earns '+amount(low)+(high!==low?' to '+amount(high):'')+' Notes. ':'';
   const bonuses=Object.entries(Progress.COLLECTION_BONUSES||{}).map(([count,notes])=>count+' facts = '+amount(notes)+' Notes').join('; ');
   return facts+(bonuses?'Collection bonuses: '+bonuses+'. ':'')+'Your first quiz pass earns '+amount(Progress.QUIZ_PRIZE)+' Notes.';
  }
  function relationship(person,result){
   if(!begin(person.name+' · Music history','conversation'))return false;
   const state=engine.conversation(person.id);if(!state?.ok){notice(state?.error||'History is unavailable. Try reopening this conversation.');return false;}
   const line=node('p',state.relationship.name+' · '+state.relationship.count+' / '+collectionSize(state)+' friendship points');line.className='history-relationship';content.append(line);
   if(result?.fact){const fact=node('p',result.fact.text);fact.className='history-story';fact.dataset.discoveredFact=result.fact.id;content.append(fact);speak(fact);notice('New fact added to your pouch. Bring it to the scholar in the lounge to record it and collect your reward.');}
   else speak(notice(result?.error||state.message||'No new facts unlocked yet. Complete a friendship quest, then come back.'));
   if(state.hasNewFact&&!result?.fact){button('! Learn a new history fact',()=>learn(person.id));}
   const quest=state.quest;if(quest&&['available','active','blocked'].includes(quest.status)){
    const card=node('section');card.className='history-quest';card.dataset.historyQuest=quest.id;card.append(node('h3',quest.title),node('p',quest.goal));
    if(quest.status==='active'){notice('Quest in progress · '+quest.progress+' / '+quest.target,card);}
    else if(quest.status==='available')button('Accept friendship quest',()=>{const accepted=engine.acceptQuest(person.id);update();relationship(person,accepted);},card);
    else notice('Finish your current friendship quest before accepting another.',card);
    content.append(card);
   }
   if(state.readyCount===0&&state.learnedCount>=collectionSize(state))notice('You have learned all '+collectionSize(state)+' facts from '+person.name+'. The scholar can check your completed collection.');
   notice('Fact pouch: '+engine.snapshot().carriedIDs.length+' discoveries to deliver.');closeButton.focus({preventScroll:true});return true;
  }
  function learn(id){const state=engine.conversation(id);if(!state?.ok)return false;const result=engine.learnFact(id);update();relationship(state,result);return result.ok;}
  function discover(id){const state=engine.conversation(id);if(!state?.ok){if(begin('Music history','conversation'))notice(state?.error||'History is unavailable.');return false;}if(!open())return false;return state.hasNewFact?learn(id):relationship(state);}
  function scholarBack(){const back=button('‹ Scholar menu',()=>showScholar());back.className='kids-menu-back history-back';back.dataset.scholarBack='';}
  function focusPage(){title.focus({preventScroll:true});dialog.scrollTop=0;}
  const menuPictures={
   pouch:'<path d="M19 9h26l-5 12 9 14c11 20-5 22-17 22S4 55 15 35l9-14Z" fill="#ffd07b"/><path d="M21 22h22" stroke="#795435" stroke-width="4" stroke-linecap="round"/><path d="M26 38h12m-12 7h12" stroke="#795435" stroke-width="3"/>',
   book:'<path d="M8 15q12-5 24 1 12-6 24-1v34q-12-4-24 1-12-5-24-1Z" fill="#bbb8ff"/><path d="M32 17v32M15 24h10m-10 8h10m14-8h10m-10 8h10" fill="none" stroke="#313856" stroke-width="3" stroke-linecap="round"/>',
   quiz:'<rect x="13" y="9" width="38" height="48" rx="6" fill="#c8e8fa"/><path d="M24 8h16v8H24Z" fill="#748ca9"/><path d="m21 33 8 8 15-17" fill="none" stroke="#2b7568" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
   help:'<circle cx="32" cy="32" r="25" fill="#f8db89"/><path d="M24 23c0-12 22-12 22 0 0 8-14 7-14 16" fill="none" stroke="#725333" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="48" r="3" fill="#725333"/>'
  };
  function scholarChoice(label,description,picture,action,run){
   const card=button('',run);card.className='kids-menu-card';card.dataset.scholarAction=action;
   const icon=node('span');icon.className='kids-menu-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 64 64" focusable="false">'+menuPictures[picture]+'</svg>';
   const name=node('strong',label),detail=node('span',description);name.className='kids-menu-title';detail.className='kids-menu-desc';card.append(icon,name,detail);return card;
  }
  function showScholar(){
   if(!nearby()||!begin('The Scholar','scholar'))return false;
   const state=engine.snapshot();content.className='kids-menu history-home';
   const heading=node('div');heading.className='kids-menu-head';const eyebrow=node('p','Music history');eyebrow.className='kids-menu-eyebrow';
   const welcome=node('h3','What would you like to do?'),greeting=node('p','Bring your discoveries, read your facts, or try a quiz.');welcome.tabIndex=-1;greeting.setAttribute('role','status');heading.append(eyebrow,welcome,greeting);content.append(heading);speak(greeting);
   if(!state.ok){notice('Your facts could not load. Close this menu and try again.');focusPage();return false;}
   const count=state.carriedIDs.length,grid=node('div');grid.className='kids-menu-grid';content.append(grid);
   grid.append(
    scholarChoice('Turn in facts',count?count+' '+(count===1?'fact':'facts')+' in your pouch.':state.pendingAmount>0?'Your Notes are ready to collect.':'See what is in your fact pouch.','pouch','pouch',()=>showPouch()),
    scholarChoice('My fact book',state.recordedCount+' of '+state.total+' facts recorded.','book','record',()=>showJournal()),
    scholarChoice('Take a quiz','Show what you know about a musician.','quiz','quizzes',()=>showQuizzes()),
    scholarChoice('How to find facts','Find out how to grow your collection.','help','help',()=>showHelp())
   );welcome.focus({preventScroll:true});return true;
  }
  function showHelp(){
   if(!nearby()||!begin('How to find facts','help'))return false;scholarBack();
   const steps=node('ol');steps.className='history-help-steps';
   for(const [name,detail]of [['Help a musician','Talk to a musician and choose Music history & friendship. Accept a friendship quest and finish its goal.'],['Learn a fact','Return to that musician. Choose the new history fact to add it to your pouch.'],['Bring it to the Scholar','Choose Turn in facts, then give your carried facts to the Scholar. Your new facts go into My fact book.']]){const step=node('li');step.append(node('h3',name),node('p',detail));steps.append(step);}
   content.append(steps);notice('Record every fact from a musician to unlock that musician’s quiz.');focusPage();return true;
  }
  function showPouch(feedback){
   if(!nearby()||!begin('Turn in facts','pouch'))return false;scholarBack();const state=engine.snapshot();speak(notice(feedback||'Let’s see what you discovered. Give me your facts to add them to your book and collect your Notes.'));
   if(!state.ok){notice(state.error);return false;}
   content.append(node('h3','Your fact pouch · '+state.carriedIDs.length));
   if(!state.carriedIDs.length)notice('Your pouch is empty. Complete a musician’s friendship quest, then return to them to learn a new fact.');
   else{
    for(const person of state.people){const facts=person.facts.filter(fact=>fact.carried);if(!facts.length)continue;const section=node('section');section.className='history-quest';section.append(node('h3',person.name));for(const fact of facts){const p=node('p',fact.text);p.dataset.carriedFact=fact.id;section.append(p);}content.append(section);}
    button('Give carried facts to the scholar',()=>{const result=engine.deposit();update();showPouch(result.ok?'Facts recorded! '+(result.amount||0)+' Notes added.':result.error);}).className='kids-menu-primary';
   }
   if(state.pendingAmount>0)button('Retry scholar rewards',()=>{const result=engine.deposit();update();showPouch(result.ok?(result.amount||0)+' Notes added.':result.error);}).className='kids-menu-primary';
   const rewards=node('details');rewards.className='history-rewards';rewards.append(node('summary','How Notes rewards work'));notice(rewardMessage(),rewards);content.append(rewards);
   notice(state.recordedCount+' of '+state.total+' facts recorded in your fact book.');focusPage();return true;
  }
  function showJournal(){
   if(!nearby()||!begin('My fact book','record'))return false;scholarBack();const state=engine.snapshot();notice(state.ok?state.recordedCount+' / '+state.total+' facts recorded.':'Records unavailable: '+state.error);
   const controls=node('div');controls.className='history-filters';const label=node('label','Musician '),select=node('select');select.setAttribute('aria-label','Journal musician');select.append(new Option('All musicians',''));for(const p of state.people)select.append(new Option(p.name+' · '+p.recordedCount+'/'+collectionSize(p),p.id));select.value=filter;label.append(select);
   const searchLabel=node('label','Search recorded facts '),search=node('input');search.type='search';search.value=query;search.setAttribute('aria-label','Search recorded facts');searchLabel.append(search);controls.append(label,searchLabel);content.append(controls);const list=node('div');content.append(list);
   function render(){list.replaceChildren();const term=query.trim().toLocaleLowerCase();let shown=0;
    for(const person of state.people){if(filter&&person.id!==filter)continue;const matches=person.name.toLocaleLowerCase().includes(term),facts=person.facts.filter(fact=>!term||matches||fact.recorded&&fact.text?.toLocaleLowerCase().includes(term));if(!facts.length)continue;
     const section=node('details');section.open=!!filter||!!term;section.dataset.historyPerson=person.id;section.append(node('summary',person.name+' · '+person.recordedCount+' / '+collectionSize(person)+' recorded'));const grid=node('ol');grid.className='history-grid';
     for(const fact of facts){const card=node('li');card.dataset.historyFact=fact.id;card.className=fact.recorded?'history-fact':'history-fact locked';card.append(node('strong',(fact.recorded?'Fact ':'🔒 Locked fact ')+String(fact.number).padStart(2,'0')),node('p',fact.recorded?fact.text:fact.carried?'Bring this fact from your pouch to the scholar.':'Build your friendship with '+person.name+' to earn this fact.'));grid.append(card);}section.append(grid);list.append(section);shown++;
    }if(!shown)list.append(node('p','No recorded facts match your search. Locked facts remain hidden.'));
   }
   select.onchange=()=>{filter=select.value;render();};search.oninput=()=>{query=search.value;render();};render();focusPage();return true;
  }
  function showQuizzes(message){
   if(!nearby()||!begin('Music history quizzes','quizzes'))return false;scholarBack();notice(message||'Record every fact from a musician to unlock their '+Progress.QUESTION_COUNT+'-question quiz. Score at least '+Math.ceil(Progress.QUESTION_COUNT*Progress.PASS_SCORE/100)+' out of '+Progress.QUESTION_COUNT+' to pass. Your first pass earns '+amount(Progress.QUIZ_PRIZE)+' Notes.');
   const saved=engine.snapshot();if(!saved.ok){notice(saved.error);return false;}
   const ready=node('section'),locked=node('details'),lockedCount=saved.people.filter(person=>!person.quiz.eligible).length;ready.className='history-ready-quizzes';ready.append(node('h3','Ready to try'));locked.className='history-locked-quizzes';locked.append(node('summary','Quizzes to unlock · '+lockedCount));
   if(saved.people.every(person=>!person.quiz.eligible))notice('Your quizzes will appear here as you fill your fact book.',ready);content.append(ready);
   for(const p of saved.people){const row=node('section');row.className='history-quest';row.dataset.historyQuiz=p.id;row.append(node('h3',p.name),node('p',p.recordedCount+' / '+collectionSize(p)+' facts recorded'+(p.quiz.passed?' · Quiz passed':p.quiz.best?' · Best score '+Math.round(p.quiz.best*Progress.QUESTION_COUNT/100)+'/'+Progress.QUESTION_COUNT:'')));
    const start=button(p.quiz.eligible?(p.quiz.passed?'Retake for practice':'Take quiz'):'🔒 Record all '+collectionSize(p)+' facts first',()=>{const result=engine.startQuiz(p.id);result.ok?showQuiz():showQuizzes(result.error);},row);start.disabled=!p.quiz.eligible;(p.quiz.eligible?ready:locked).append(row);
   }if(lockedCount)content.append(locked);focusPage();return true;
  }
  function showQuiz(message){
   const state=engine.quizState();if(!state||!nearby()||!begin(state.name+' · History quiz','quiz'))return false;
   if(message)notice(message);if(state.finished){notice('You scored '+Math.round(state.score*state.total/100)+' / '+state.total+'. '+(state.passed?'Passed!':'Keep studying the record and try again.'));button('Back to history quizzes',()=>showQuizzes());}
   else notice('Answer all '+state.total+' questions. You can change your answers before finishing.');
   const counter=notice(state.answered+' / '+state.total+' answered');const finish=node('button');finish.type='button';finish.textContent='Finish quiz';finish.disabled=state.answered!==state.total;
   for(const [index,q]of state.questions.entries()){
    const field=node('fieldset');field.className='history-quiz-question';field.dataset.quizQuestion=q.id;field.append(node('legend',(index+1)+'. '+q.prompt));
    for(const [i,choice]of q.choices.entries()){const label=node('label'),radio=node('input');radio.type='radio';radio.name=q.id;radio.value=String(i);radio.checked=q.selected===i;radio.disabled=state.finished;radio.onchange=()=>{const result=engine.answerQuiz(q.id,i);if(!result.ok){notice(result.error);return;}const live=engine.quizState();counter.textContent=live.answered+' / '+live.total+' answered';finish.disabled=live.answered!==live.total;};label.append(radio,doc.createTextNode(choice));field.append(label);}
    if(state.finished&&Number.isInteger(q.answer))field.append(node('p',(q.correct?'✓ Correct. ':'Correct answer: ')+q.choices[q.answer]));content.append(field);
   }
   if(!state.finished){finish.onclick=()=>{const result=engine.finishQuiz();update();showQuiz(result.ok?'Quiz saved.'+(result.amount?' '+result.amount+' Notes awarded.':''):result.error);};content.append(finish);button('Leave quiz',()=>showQuizzes());}closeButton.focus({preventScroll:true});return true;
  }
  function renderDeveloper(host){
   let selected=host.dataset.historySelected||Object.keys(Progress.PEOPLE||{} )[0]||'bach',disposed=false;
   const canTest=()=>{try{return api.isDeveloperTest?.()===true;}catch{return false;}};
   function render(){if(disposed||!host.isConnected)return;host.dataset.historySelected=selected;host.replaceChildren();const state=engine.snapshot();host.append(node('h3','Music history progression'),node('p','Inspect friendship points, carried facts, records, and quizzes. Test controls use the temporary test player.'));
    if(!state.ok){notice(state.error,host);return;}
    const label=node('label','Character '),select=node('select');select.setAttribute('aria-label','History progression character');for(const p of state.people)select.append(new Option(p.name,p.id));select.value=selected;select.onchange=()=>{selected=select.value;render();};label.append(select);host.append(label);
    const p=state.people.find(p=>p.id===selected);if(!p)return;host.append(node('p',p.relationship.name+' · '+p.relationship.count+'/'+collectionSize(p)+' friendship points'),node('p',p.readyCount+' ready · '+p.facts.filter(f=>f.carried).length+' carried · '+p.recordedCount+'/'+collectionSize(p)+' recorded'),node('p',p.quiz.eligible?'Quiz unlocked'+(p.quiz.passed?' · Passed':''):'Quiz locked'));
    if(state.active)host.append(node('p','Active quest: '+state.active.person+' · '+(state.active.progress||0)+' / '+(state.active.target||'?')));
    if(!canTest()){button('Open temporary progression test',()=>win.CodaDeveloperTestMode?.enter(),host);notice('Your real player is read-only here. Enter temporary test mode to change progression.',host);}
    else{for(const [stage,label]of [['ready','Unlock next fact'],['carried','Add next fact to pouch'],['recorded','Set all '+collectionSize(p)+' facts recorded'],['reset','Reset this friendship']])button(label,()=>{const result=engine.developerSet(selected,stage);render();if(!result.ok)notice(result.error,host);try{api.onChange?.(engine.snapshot());}catch{}},host);}
   }
   developerRefresh=render;render();return {refresh:render,dispose(){disposed=true;if(developerRefresh===render)developerRefresh=null;}};
  }
  function back(){if(view==='quiz'&&nearby())showQuizzes();else if(['pouch','record','quizzes','help'].includes(view)&&nearby())showScholar();else close();}
  closeButton.onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();back();});win.addEventListener('keydown',event=>{if(!opened)return;if(event.key==='Escape'){event.preventDefault();back();}event.stopImmediatePropagation();},true);doc.addEventListener('fullscreenchange',()=>{if(opened){dialog.close();mount();dialog.showModal();}});
  return {discover,showScholar,showJournal,showQuizzes,close,isOpen:()=>opened,conversationState:engine.conversation,snapshot:engine.snapshot,beginRun:engine.beginRun,recordResult(...args){const result=engine.recordResult(...args);update();return result;},recordActivity(...args){const result=engine.recordActivity(...args);update();return result;},renderDeveloper};
 }
 return {KEY:Progress.KEY,PEOPLE:Progress.PEOPLE,create};
});
