/* Discovered history is local to the active player's scoped browser storage. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./music-history-data.js'):root.CodaMusicHistoryData);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaMusicHistory=api;})(typeof window==='undefined'?null:window,function(PEOPLE){
 'use strict';
 const KEY='codaMusicHistoryV1',ALL=Object.values(PEOPLE).flatMap(person=>person.facts),IDS=new Set(ALL.map(fact=>fact.id));
 function createStore(api={}){
  const allowed=()=>{try{return api.canUse?.()!==false;}catch{return false;}};
  function read(){
   if(!allowed())return {ok:false,ids:[],error:'Your player is unavailable. Reopen your profile to continue.'};
   try{const raw=api.storage.getItem(KEY);if(raw===null)return {ok:true,ids:[]};const value=JSON.parse(raw);
    if(value?.version!==1||!Array.isArray(value.discovered)||value.discovered.length>IDS.size||value.discovered.some(id=>!IDS.has(id)))throw Error('invalid');
    return {ok:true,ids:[...new Set(value.discovered)]};
   }catch{return {ok:false,ids:[],error:'Your journal could not be read. No discoveries were changed. Try again when browser storage is available.'};}
  }
  function discover(person){
   if(!Object.hasOwn(PEOPLE,person))return {ok:false,error:'This character has no music history collection.'};
   const owner=api.getIdentity?.();if(!allowed())return read();
   try{if(api.canTalk?.(person)!==true)return {ok:false,error:'Walk over to '+PEOPLE[person].name+' to discover a fact.'};}catch{return {ok:false,error:'This conversation is unavailable.'};}
   const current=read();if(!current.ok)return current;const seen=new Set(current.ids),fact=PEOPLE[person].facts.find(item=>!seen.has(item.id));
   if(!fact)return {ok:true,complete:true,count:30,error:''};
   try{if(!allowed()||owner!==api.getIdentity?.())throw Error('player changed');api.storage.setItem(KEY,JSON.stringify({version:1,discovered:[...current.ids,fact.id]}));}
   catch{return {ok:false,error:'This fact could not be saved. Try again; its journal slot is still locked.'};}
   return {ok:true,fact,count:PEOPLE[person].facts.filter(item=>seen.has(item.id)).length+1};
  }
  function snapshot(){const state=read(),seen=new Set(state.ids);return {...state,total:IDS.size,count:seen.size,people:Object.entries(PEOPLE).map(([id,person])=>({id,name:person.name,count:person.facts.filter(fact=>seen.has(fact.id)).length,facts:person.facts.map((fact,index)=>({id:fact.id,number:index+1,locked:!seen.has(fact.id),...(seen.has(fact.id)?{text:fact.text}:{})}))}))};}
  return {discover,snapshot};
 }
 function create(api={}){
  const doc=api.document||document,win=doc.defaultView;
  let storage=api.storage;try{if(storage===undefined)storage=win.localStorage;}catch{}
  const store=createStore({...api,storage});
  const node=(tag,text)=>{const item=doc.createElement(tag);if(text!==undefined)item.textContent=text;return item;};
  const dialog=node('dialog');dialog.className='music-history';dialog.setAttribute('aria-labelledby','history-title');doc.body.append(dialog);
  const heading=node('header'),title=node('h2','Music History Journal');title.id='history-title';const closeButton=node('button','Close');closeButton.type='button';heading.append(title,closeButton);dialog.append(heading);
  const content=node('div');dialog.append(content);let opened=false,owner=null,previous=null,timer=null,filter='',query='';
  function close(){if(!opened)return;opened=false;win.clearInterval(timer);dialog.close();doc.body.classList.remove('music-history-open');doc.body.append(dialog);if(owner===api.getIdentity?.()){if(previous?.isConnected&&previous.getClientRects().length)previous.focus({preventScroll:true});else api.focusReturn?.();}api.onClose?.();content.replaceChildren();}
  function mount(){const fullscreen=doc.fullscreenElement||doc.webkitFullscreenElement;if(fullscreen&&!/^(CANVAS|IFRAME|VIDEO)$/.test(fullscreen.tagName))fullscreen.append(dialog);else doc.body.append(dialog);}
  function open(){if(api.canUse?.()===false)return false;if(!opened){previous=doc.activeElement;owner=api.getIdentity?.();api.onOpen?.();mount();dialog.showModal();opened=true;doc.body.classList.add('music-history-open');timer=win.setInterval(()=>{if(owner!==api.getIdentity?.()||api.canUse?.()===false)close();},200);}return true;}
  function notice(text){const p=node('p',text);p.setAttribute('role','status');content.append(p);}
  function button(text,run){const b=node('button',text);b.type='button';b.onclick=run;return b;}
  function showJournal(){
   if(!open())return false;title.textContent='Music History Journal';content.replaceChildren();const state=store.snapshot();
   notice(state.ok?state.count+' / '+state.total+' facts discovered. Talk to musicians to unlock more.':state.error);
   content.append(node('p','Discoveries stay with this player on this device. Test-mode discoveries last only for that preview.'));
   const controls=node('div');controls.className='history-filters';const label=node('label','Musician '),select=node('select');select.setAttribute('aria-label','Journal musician');
   select.append(new Option('All musicians',''));for(const person of state.people)select.append(new Option(person.name+' · '+person.count+'/30',person.id));select.value=filter;label.append(select);
   const searchLabel=node('label','Search discovered facts '),search=node('input');search.type='search';search.value=query;search.setAttribute('aria-label','Search discovered facts');searchLabel.append(search);controls.append(label,searchLabel);content.append(controls);
   const list=node('div');list.className='history-collections';content.append(list);
   function render(){list.replaceChildren();const term=query.trim().toLocaleLowerCase();let shown=0;
    for(const person of state.people){if(filter&&person.id!==filter)continue;
     const matches=person.name.toLocaleLowerCase().includes(term);const facts=person.facts.filter(fact=>!term||matches||!fact.locked&&fact.text.toLocaleLowerCase().includes(term));if(!facts.length)continue;
     const section=node('details');section.open=!!filter||!!term;section.dataset.historyPerson=person.id;section.append(node('summary',person.name+' · '+person.count+' / 30 discovered'));
     const grid=node('ol');grid.className='history-grid';for(const fact of facts){const card=node('li');card.dataset.historyFact=fact.id;card.className=fact.locked?'history-fact locked':'history-fact';card.append(node('strong',(fact.locked?'🔒 Locked fact ':'Fact ')+String(fact.number).padStart(2,'0')),node('p',fact.locked?'Talk to '+person.name+' to discover this entry.':fact.text));grid.append(card);}section.append(grid);list.append(section);shown++;
    }if(!shown)list.append(node('p','No discovered facts match your search. Locked facts remain hidden.'));
   }
   select.onchange=()=>{filter=select.value;render();};search.oninput=()=>{query=search.value;render();};render();closeButton.focus({preventScroll:true});return true;
  }
  function discover(person){
   if(!Object.hasOwn(PEOPLE,person)||!open())return false;const result=store.discover(person);title.textContent=PEOPLE[person].name+' · Music history';content.replaceChildren();
   if(!result.ok)notice(result.error);else if(result.complete)notice('You discovered all 30 facts from '+PEOPLE[person].name+'! Revisit them in your journal.');else{const fact=node('p',result.fact.text);fact.className='history-story';fact.dataset.discoveredFact=result.fact.id;content.append(fact);notice('Added to your journal · '+result.count+' / 30 discovered.');}
   const actions=node('div');actions.className='history-actions';if(!result.complete)actions.append(button(result.ok?'Tell me another fact':'Try again',()=>discover(person)));actions.append(button('Open Music History Journal',()=>{filter=person;query='';showJournal();}));content.append(actions);closeButton.focus({preventScroll:true});return result.ok;
  }
  closeButton.onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  win.addEventListener('keydown',event=>{if(!opened)return;if(event.key==='Escape'){event.preventDefault();close();}event.stopImmediatePropagation();},true);
  doc.addEventListener('fullscreenchange',()=>{if(opened){dialog.close();mount();dialog.showModal();}});
  return {discover,showJournal,close,isOpen:()=>opened,snapshot:store.snapshot};
 }
 return {KEY,PEOPLE,createStore,create};
});
