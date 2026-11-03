/* Settings pages keep the existing controls, listeners, and saved preferences. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaWorldSettings=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const PAGES={
  reading:{title:'Sound & reading',description:'Choose music and a comfortable text speed.',picture:'sound'},
  screen:{title:'Screen & effects',description:'Change the view and how the arcade looks.',picture:'screen'},
  player:{title:'My player',description:'Choose your player or go to the title screen.',picture:'player'},
  help:{title:'Help & updates',description:'Find reminders and see what’s new.',picture:'help'}
 };
 const PICTURES={
  sound:'<path d="M8 25h12l15-13v40L20 39H8Z" fill="#b4bafa"/><path d="M43 22q10 10 0 20m8-28q18 18 0 36" fill="none" stroke="#a7edce" stroke-width="4" stroke-linecap="round"/>',
  screen:'<rect x="6" y="10" width="52" height="35" rx="5" fill="#b5def2"/><rect x="12" y="16" width="40" height="23" rx="2" fill="#344b69"/><path d="M25 46v9m14-9v9M18 55h28" stroke="#b5def2" stroke-width="4" stroke-linecap="round"/><path d="m35 18 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z" fill="#ffda81"/>',
  player:'<circle cx="32" cy="22" r="13" fill="#ffda81"/><path d="M9 57c0-24 46-24 46 0Z" fill="#b8b8ff"/><path d="M25 39q7 8 14 0" fill="none" stroke="#354b6c" stroke-width="3"/>',
  help:'<path d="M9 15q11-5 23 1 12-6 23-1v36q-11-4-23 1-12-5-23-1Z" fill="#b8b8ff"/><path d="M32 17v34M15 25h11m-11 9h11" fill="none" stroke="#354b6c" stroke-width="3"/><path d="M39 25c0-6 11-6 11 0 0 4-6 4-6 9" fill="none" stroke="#354b6c" stroke-width="3" stroke-linecap="round"/><circle cx="44" cy="41" r="2" fill="#354b6c"/>'
 };
 function create(api={}){
  const host=api.host,doc=host?.ownerDocument;if(!doc)throw Error('World settings need a host.');
  const initialNodes=Array.from(host.childNodes),claimed=new Set(),groups={};
  let page='home',destroyed=false,musicPending=false;
  const node=(tag,css,text)=>{const el=doc.createElement(tag);if(css)el.className=css;if(text!==undefined)el.textContent=text;return el;};
  const button=(label,action,css,name)=>{const el=node('button',css,label);el.type='button';el.dataset.settingsAction=name;el.onclick=action;return el;};
  const shell=node('div','world-settings-shell'),bar=node('div','world-settings-bar'),backButton=button('‹ Settings',()=>show('home'),'kids-menu-back','home'),closeButton=button('Done',()=>api.onClose?.(),'world-settings-done','close');
  bar.append(backButton,closeButton);shell.append(bar);
  const head=node('div','kids-menu-head'),eyebrow=node('p','kids-menu-eyebrow','Arcade settings'),heading=node('h2','','Make it work for you'),intro=node('p','','What would you like to change?');
  heading.id='worldSettingsTitle';heading.tabIndex=-1;heading.dataset.settingsHeading='';head.append(eyebrow,heading,intro);shell.append(head);
  const grid=node('div','kids-menu-grid');
  for(const [id,entry]of Object.entries(PAGES)){
   const card=button('',()=>show(id),'kids-menu-card',id),picture=node('span','kids-menu-icon'),name=node('strong','kids-menu-title',entry.title),description=node('span','kids-menu-desc',entry.description);
   picture.setAttribute('aria-hidden','true');picture.innerHTML='<svg viewBox="0 0 64 64" focusable="false">'+PICTURES[entry.picture]+'</svg>';
   description.id='worldSettingsDescription-'+id;card.setAttribute('aria-label',entry.title);card.setAttribute('aria-describedby',description.id);card.append(picture,name,description);grid.append(card);
   const section=node('section','world-settings-page');section.dataset.settingsGroup=id;section.setAttribute('aria-label',entry.title);groups[id]=section;
  }
  shell.append(grid);
  const musicRow=node('div','world-settings-music'),musicButton=button('',toggleMusic,'kids-menu-primary','music'),musicStatus=node('p','world-settings-music-status');musicButton.id='worldSettingsMusic';musicStatus.setAttribute('role','status');musicStatus.setAttribute('aria-live','polite');musicRow.append(musicButton,musicStatus);groups.reading.append(musicRow);
  for(const [id,section]of Object.entries(groups)){
   const entries=api.controls?.[id],controls=entries?.nodeType?[entries]:entries?Array.from(entries):[];
   for(const control of controls){if(!control?.nodeType||claimed.has(control))continue;claimed.add(control);section.append(control);}
   shell.append(section);
  }
  // Keep any ungrouped existing action reachable rather than dropping a control.
  for(const original of initialNodes){if(original.nodeType!==1||claimed.has(original)||Array.from(claimed).some(control=>control.contains?.(original)))continue;groups.help.append(original);}
  host.replaceChildren(shell);host.classList.add('world-settings','kids-menu');
  function musicState(){const value=api.getMusicState?.();return value&&typeof value==='object'?value:{playing:value===true,disabled:false};}
  function refreshMusic(){
   if(destroyed)return;const state=musicState(),playing=state.playing===true;musicButton.disabled=musicPending||state.disabled===true||typeof api.onToggleMusic!=='function';musicButton.setAttribute('aria-pressed',String(playing));musicButton.textContent=playing?'Turn music off':'Turn music on';
   musicStatus.textContent=state.disabled?'Music is unavailable right now.':state.title&&playing?'Now playing: '+state.title:state.label||'Music is '+(playing?'on.':'off.');
  }
  function toggleMusic(){
   if(musicPending||musicState().disabled||typeof api.onToggleMusic!=='function')return;
   try{const result=api.onToggleMusic();refreshMusic();if(result?.then){musicPending=true;refreshMusic();let failed=false;Promise.resolve(result).catch(()=>{failed=true;}).finally(()=>{musicPending=false;refreshMusic();if(failed&&!destroyed)musicStatus.textContent='Music could not change. Try again.';});}}
   catch{musicStatus.textContent='Music could not change. Try again.';}
  }
  function show(next='home',focus=true){
   if(destroyed)return;page=Object.hasOwn(PAGES,next)?next:'home';host.dataset.settingsPage=page;const home=page==='home';backButton.hidden=home;grid.hidden=!home;
   heading.textContent=home?'Make it work for you':PAGES[page].title;intro.textContent=home?'What would you like to change?':PAGES[page].description;
   for(const [id,section]of Object.entries(groups))section.hidden=id!==page;
   refreshMusic();host.scrollTop=0;if(focus)heading.focus({preventScroll:true});
  }
  show('home',false);
  return {show,refreshMusic,back(){if(page==='home')return false;show('home');return true;},getState:()=>({page,music:musicState()}),destroy(){if(destroyed)return;destroyed=true;host.replaceChildren(...initialNodes);host.classList.remove('world-settings','kids-menu');delete host.dataset.settingsPage;}};
 }
 return {create};
});
