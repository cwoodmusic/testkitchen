/* Local play notes. Free text never enters a classroom profile or a network API. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaPlayNotebook=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const KEY='codaPlayNotebookV1',MAX_LENGTH=100000;let nextDialogId=0;
 const blank=()=>({version:1,text:'',updatedAt:0});
 const valid=value=>!!value&&value.version===1&&typeof value.text==='string'&&value.text.length<=MAX_LENGTH&&Number.isSafeInteger(value.updatedAt)&&value.updatedAt>=0&&value.updatedAt<=253402300799999;
 const formatNotes=text=>'Coda Arcade — play notes\n\n'+String(text||'')+'\n';
 function createStore(api={}){
  const storage=api.storage,identity=()=>api.getIdentity?.()??'local';
  const allowed=()=>{try{return api.canRecord?.()!==false;}catch{return false;}};
  let record=blank(),owner=null,proof=null,loaded=false,readable=false,dirty=false,error='';
  function getState(){return {...record,loaded,dirty,saved:loaded&&readable&&!dirty,error};}
  function sameOwner(){try{return owner===identity();}catch{return false;}}
  function load(){
   record=blank();loaded=true;readable=false;dirty=false;error='';
   try{
    owner=identity();if(!allowed())throw Error('paused');proof=storage?.getItem(KEY)??null;
    if(proof!==null){const value=JSON.parse(proof);if(!valid(value))throw Error('damaged');record={version:1,text:value.text,updatedAt:value.updatedAt};}
    if(!storage?.getItem||!storage?.setItem||owner!==identity())throw Error('unavailable');readable=true;
   }catch{record=blank();error='Saved notes could not be opened. You can still type and download a copy.';}
   return getState();
  }
  function setText(text){if(!loaded||typeof text!=='string'||text.length>MAX_LENGTH)return false;record.text=text;dirty=true;error='';return true;}
  function save(){
   if(!dirty)return {ok:readable,...getState()};
   if(!loaded||!sameOwner()||!allowed()){error='Your player changed. These notes were not saved to the new player.';return {ok:false,...getState()};}
   if(!readable){error='Notes are not saved. Download a copy to keep your changes.';return {ok:false,...getState()};}
   try{
    if(storage.getItem(KEY)!==proof){error='Saved notes changed in another tab. Download your draft before reopening the pad.';return {ok:false,...getState()};}
    const now=typeof api.now==='function'?api.now():Date.now(),next={version:1,text:record.text,updatedAt:Number.isSafeInteger(now)&&now>=0&&now<=253402300799999?now:Date.now()};
    const encoded=JSON.stringify(next);storage.setItem(KEY,encoded);proof=encoded;record=next;dirty=false;error='';return {ok:true,...getState()};
   }catch{error='Notes are not saved. Keep this pad open or download a copy, then try Save again.';return {ok:false,...getState()};}
  }
  function reset(){record=blank();owner=null;proof=null;loaded=false;readable=false;dirty=false;error='';}
  return Object.freeze({load,setText,save,getState,sameOwner,reset});
 }
 function typing(target){return !!target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');}
 function create(api={}){
  const doc=api.document||api.host?.ownerDocument||document,win=doc.defaultView;
  let storage=api.storage;try{if(storage===undefined)storage=win.localStorage;}catch{}
  const store=createStore({storage,getIdentity:api.getIdentity,canRecord:api.canOpen,now:api.now});
  const node=(tag,className,text)=>{const item=doc.createElement(tag);if(className)item.className=className;if(text!==undefined)item.textContent=text;return item;};
  const host=api.host||node('div','play-notebook-backdrop');if(!api.host)doc.body.append(host);const home=host.parentNode||doc.body;host.classList.add('play-notebook-backdrop');host.hidden=true;
  const dialog=node('dialog','play-notebook');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Play notes and changelog');host.append(dialog);
  const nativeModal=typeof dialog.showModal==='function';if(nativeModal)host.classList.add('has-native-dialog');
  let opened=false,destroyed=false,priorFocus=null,timer=0,tab='notes';
  const allowed=()=>{try{return api.canOpen?.()!==false;}catch{return false;}};
  const temporary=()=>{try{return typeof api.temporary==='function'?api.temporary()===true:api.temporary===true;}catch{return false;}};
  const heading=node('header','play-notebook-heading'),title=node('h2','','Play notes'),closeButton=node('button','','×');closeButton.type='button';closeButton.setAttribute('aria-label','Close play notes');heading.append(title,closeButton);dialog.append(heading);
  const tabs=node('div','play-notebook-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Notebook pages');dialog.append(tabs);
  const notesButton=node('button','','My notes'),changesButton=node('button','','Changelog'),dialogId='coda-notebook-'+(++nextDialogId);
  for(const [button,id]of [[notesButton,'notes'],[changesButton,'changelog']]){button.id=dialogId+'-'+id+'-tab';button.type='button';button.setAttribute('role','tab');button.setAttribute('aria-controls',dialogId+'-'+id);button.dataset.notebookTab=id;button.onclick=()=>selectTab(id);tabs.append(button);}
  const notes=node('section','play-notebook-notes'),changes=node('section','play-notebook-changelog');
  for(const [panel,id]of [[notes,'notes'],[changes,'changelog']]){panel.id=dialogId+'-'+id;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',dialogId+'-'+id+'-tab');}dialog.append(notes,changes);
  const help=node('p','play-notebook-help');notes.append(help);
  const label=node('label','play-notebook-label','Bugs and future changes'),textarea=node('textarea','play-notebook-text');textarea.maxLength=MAX_LENGTH;textarea.rows=12;textarea.setAttribute('aria-label','Bugs and future changes');textarea.placeholder='Bug: where were you, and what happened?\n\nFuture change: what would you like to try?';textarea.spellcheck=true;label.append(textarea);notes.append(label);
  const status=node('p','play-notebook-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');notes.append(status);
  const actions=node('div','play-notebook-actions');notes.append(actions);
  const saveButton=node('button','','Save now'),copyButton=node('button','','Copy notes'),downloadButton=node('button','','Download notes');
  for(const [button,name]of [[saveButton,'save'],[copyButton,'copy'],[downloadButton,'download']]){button.type='button';button.dataset.notebookAction=name;actions.append(button);}
  function renderStatus(){const state=store.getState();status.textContent=state.error||(state.dirty?'Saving…':temporary()?'Saved for this test session.':'Saved on this device.');status.dataset.saved=String(state.saved);}
  function flush(){win.clearTimeout(timer);timer=0;const result=store.save();renderStatus();return result;}
  function edit(){if(!opened)return;store.setText(textarea.value);renderStatus();win.clearTimeout(timer);timer=win.setTimeout(flush,300);}
  textarea.addEventListener('input',edit);saveButton.onclick=flush;
  function showChanges(){
   changes.replaceChildren();const entries=api.changelog?.entries||win.CodaChangelog?.entries||[];
   if(!entries.length){changes.append(node('p','','No release notes are available in this build.'));return;}
   for(const entry of entries){const article=node('article','play-notebook-release');article.append(node('h3','',entry.title),node('p','play-notebook-date',entry.date));const list=node('ul');for(const change of entry.changes||[])list.append(node('li','',change));article.append(list);changes.append(article);}
  }
  function selectTab(value){
   tab=value==='changelog'?'changelog':'notes';notes.hidden=tab!=='notes';changes.hidden=tab!=='changelog';
   for(const button of [notesButton,changesButton]){const active=button.dataset.notebookTab===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
   if(tab==='changelog')showChanges();title.textContent=tab==='notes'?'Play notes':'Changelog';
  }
  tabs.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const value=event.key==='Home'?'notes':event.key==='End'?'changelog':tab==='notes'?'changelog':'notes';selectTab(value);(value==='notes'?notesButton:changesButton).focus();}});
  function mount(){
   const fullscreen=doc.fullscreenElement||doc.webkitFullscreenElement,target=opened&&fullscreen&&!/^(CANVAS|IFRAME|VIDEO)$/.test(fullscreen.tagName)?fullscreen:home;
   if(target===home?host.parentNode!==home:!target.contains(host)){const modal=opened&&nativeModal&&dialog.open;if(modal)dialog.close();target.append(host);if(modal)dialog.showModal();}
  }
  function open(value='notes'){
   if(destroyed||!allowed())return false;if(opened){selectTab(value);return true;}
   priorFocus=doc.activeElement;
   try{if(api.onOpen?.()===false)return false;}catch{return false;}
   const draft=store.getState();if(!draft.loaded||!draft.dirty||!store.sameOwner())store.load();
   textarea.value=store.getState().text;help.textContent=temporary()?'Test mode notes last only for this preview. Download a copy before leaving.':'Jot down bugs and ideas while you play. Notes stay in this browser; download a copy to keep them elsewhere.';
   renderStatus();opened=true;mount();host.hidden=false;doc.body.classList.add('play-notebook-open');selectTab(value);
   if(nativeModal){try{dialog.showModal();}catch{dialog.setAttribute('open','');}}else dialog.setAttribute('open','');
   (tab==='notes'?textarea:changesButton).focus({preventScroll:true});return true;
  }
  function close(reason='close'){
   if(!opened)return false;win.clearTimeout(timer);timer=0;
   const changed=!store.sameOwner()||!allowed();if(!changed)flush();
   opened=false;if(nativeModal&&dialog.open)dialog.close();else dialog.removeAttribute('open');host.hidden=true;mount();doc.body.classList.remove('play-notebook-open');
   if(changed||['profile','profile-changed','destroyed'].includes(reason)){store.reset();textarea.value='';}
   try{api.onClose?.({reason});}catch{}
   if(!changed&&priorFocus?.isConnected)priorFocus.focus({preventScroll:true});return true;
  }
  closeButton.onclick=()=>close();
  dialog.addEventListener('cancel',event=>{event.preventDefault();close('escape');});
  copyButton.onclick=async()=>{try{await win.navigator.clipboard.writeText(formatNotes(textarea.value));status.textContent='Notes copied.';}catch{status.textContent='Copy is unavailable. Select your text or download a copy.';}};
  downloadButton.onclick=()=>{
   const blob=new win.Blob([formatNotes(textarea.value)],{type:'text/plain;charset=utf-8'}),url=win.URL.createObjectURL(blob),link=node('a');link.href=url;link.download='coda-arcade-play-notes.txt';doc.body.append(link);link.click();link.remove();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);status.textContent='Notes downloaded.';
  };
  function keydown(event){
   if(destroyed||event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return;
   if(opened){
    if(!store.sameOwner()||!allowed()){close('profile-changed');return;}
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close('escape');return;}
    if(event.key==='Tab'){
     const controls=Array.from(dialog.querySelectorAll('button:not([disabled]),textarea,[tabindex="0"]')).filter(item=>item.getClientRects().length),first=controls[0],last=controls.at(-1);
     if(event.shiftKey&&(doc.activeElement===first||!dialog.contains(doc.activeElement))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}return;
    }
   }
   if(event.defaultPrevented||event.repeat||String(event.key).toLowerCase()!=='p'||typing(event.target))return;
   if(opened){event.preventDefault();event.stopImmediatePropagation();close('shortcut');}
   else if(allowed()&&open()){event.preventDefault();event.stopImmediatePropagation();}
  }
  function pagehide(){if(opened)flush();}
  function storageChanged(event){if(opened&&event.key===KEY){if(!store.sameOwner()){close('profile-changed');return;}const state=store.getState();if(state.dirty){flush();return;}store.load();textarea.value=store.getState().text;renderStatus();}}
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  if(api.installShortcut!==false)doc.addEventListener('keydown',keydown,true);
  win.addEventListener('pagehide',pagehide);win.addEventListener('storage',storageChanged);doc.addEventListener('fullscreenchange',mount);doc.addEventListener('webkitfullscreenchange',mount);
  return Object.freeze({open,close,flush,isOpen:()=>opened,getState:()=>({open:opened,tab,...store.getState()}),destroy(){if(destroyed)return;close('destroyed');destroyed=true;win.clearTimeout(timer);doc.removeEventListener('keydown',keydown,true);win.removeEventListener('pagehide',pagehide);win.removeEventListener('storage',storageChanged);doc.removeEventListener('fullscreenchange',mount);doc.removeEventListener('webkitfullscreenchange',mount);if(!api.host)host.remove();}});
 }
 return Object.freeze({KEY,MAX_LENGTH,valid,formatNotes,createStore,create});
});
