/* DJ choices are navigation; songs play only after an explicit Play action. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaDJMenu=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 function create(api={}){
  const host=api.host,doc=host?.ownerDocument;if(!doc)throw Error('The DJ menu needs a host.');
  const menu=doc.createElement('section');menu.className='kids-menu dj-menu';host.append(menu);
  let page='home',generation=0,status=null,destroyed=false;
  const temporarySongs=[];
  const owner=api.getIdentity?.();
  const current=()=>!destroyed&&menu.isConnected&&api.canUse?.()!==false&&owner===api.getIdentity?.();
  const node=(tag,css,text)=>{const el=doc.createElement(tag);if(css)el.className=css;if(text!==undefined)el.textContent=text;return el;};
  const button=(label,action,css)=>{const el=node('button',css,label);el.type='button';el.onclick=action;return el;};
  function message(text){if(status)status.textContent=text;}
  function playback(){const playing=api.getPlayback?.();message(playing?.playing?'Now playing: '+playing.title+' · Repeats until you stop':'Music is off. Choose a song when you’re ready.');}
  function heading(title,description){const head=node('div','kids-menu-head');head.append(node('p','kids-menu-eyebrow','DJ Coda'));const h=node('h3','',title);h.tabIndex=-1;h.dataset.djHeading='';head.append(h);if(description)head.append(node('p','',description));menu.append(head);}
  function card(title,description,action,id){
   const pictures={
    dance:'<path d="m8 36 16-16 16 16H30v20H18V36Z" fill="#b8b5ff"/><path d="m38 18 10-10 10 10h-6v16h-8V18Z" fill="#a7efce"/>',
    music:'<rect x="9" y="15" width="46" height="39" rx="6" fill="#b8dff1"/><circle cx="32" cy="34" r="13" fill="#354866"/><circle cx="32" cy="34" r="4" fill="#ffda81"/><path d="M43 16V8h11" fill="none" stroke="#ffda81" stroke-width="4"/>',
    songs:'<path d="M25 14v33m0-31 27-6v32" fill="none" stroke="#ffda81" stroke-width="5" stroke-linecap="round"/><ellipse cx="17" cy="47" rx="10" ry="7" fill="#ffda81"/><ellipse cx="44" cy="42" rx="10" ry="7" fill="#ffda81"/>',
    history:'<path d="M9 15q11-5 23 1 12-6 23-1v36q-11-4-23 1-12-5-23-1Z" fill="#c3baff"/><path d="M32 17v34M15 25h11m-11 9h11m12-9h11m-11 9h11" fill="none" stroke="#394364" stroke-width="3"/>'
   };
   const el=button('',action,'kids-menu-card');el.dataset.djAction=id;const symbol=node('span','kids-menu-icon');symbol.setAttribute('aria-hidden','true');symbol.innerHTML='<svg viewBox="0 0 64 64" focusable="false">'+pictures[id]+'</svg>';const label=node('strong','kids-menu-title',title),detail=node('span','kids-menu-desc',description);el.append(symbol,label,detail);return el;
  }
  function songRow(parent,record,source,editId){
   const row=node('div','panelRow'),info=node('div'),title=node('strong','',record.title||'Untitled'),detail=node('small','',record.composition.bpm+' BPM · '+record.composition.bars+' bars');info.append(title,detail);row.append(info);
   const play=button('▶ Play',()=>{if(!current())return;Promise.resolve(api.onPlay?.(record.composition,{title:record.title||'Untitled',source,trackId:record.id})).then(ok=>{if(ok&&current())playback();}).catch(()=>{if(current())message('The song could not start. Try Play again.');});});
   play.dataset.jukeboxTrack=record.id||source;play.setAttribute('aria-label','Play '+(record.title||'Untitled'));row.append(play);
   if(source==='house'){row.dataset.houseTrack=record.id;const requirement=node('p','muted');requirement.dataset.djRequirement='true';info.append(requirement);if(record.sections?.length)detail.textContent+=' · '+record.sections.map(section=>section.label).join(' → ');}
   if(editId)row.append(button('Edit song',()=>{if(current())api.onEdit?.(editId);}));parent.append(row);return row;
  }
  function renderHome(){
   heading('What would you like to do?','Dance, choose some music, or share your own song.');
   const grid=node('div','kids-menu-grid'),dance=card('Dance with friends','Follow the arrows in DJ Coda’s Line Dance.',()=>api.onDance?.(),'dance');dance.dataset.startDance='';grid.append(dance);
   grid.append(card('Play music','Pick a track from the DJ collection.',()=>show('house'),'music'),card('My songs','Play a song you made in Song Machine.',()=>show('songs'),'songs'));
   const history=card('Music history',api.getHistoryLabel?.()||'Learn about music and its makers.',()=>api.onHistory?.(),'history');history.dataset.historyOwnerPrompt='dj';history.querySelector('.kids-menu-desc').dataset.historyPromptLabel='';grid.append(history);menu.append(grid);
  }
  function renderHouse(){heading('Pick some music','Press Play to hear a song. Locked tracks tell you how to unlock them.');const songs=node('div');menu.append(songs);for(const record of api.getHouseSongs?.()||[])songRow(songs,record,'house');api.onRefreshLocks?.();}
  async function renderSongs(token){
   heading('Play your own songs','Choose a Song Machine song. Your music starts when you press Play.');
   const local=node('section');local.append(node('h4','','Songs on this device'));menu.append(local);const rows=node('div');local.append(rows);const records=[...temporarySongs,...(api.getLocalSongs?.()||[])];for(const record of records)songRow(rows,record,'import');
   const empty=node('p','kids-menu-empty','No songs here yet. Make a song in Song Machine, then add its saved song file.');if(!records.length)local.append(empty);
   const file=node('input');file.type='file';file.accept='application/json,.json';file.hidden=true;file.id='djSongImport';menu.append(file);
   const actions=node('div','kids-menu-actions'),load=button('Add a song file',()=>file.click(),'kids-menu-primary');load.id='djSongImportButton';actions.append(load);menu.append(actions,node('p','dj-file-help','Choose a song file exported from Song Machine.'));
   file.onchange=async()=>{
    const selected=file.files?.[0];file.value='';if(!selected)return;
    try{
     if(selected.size>2*1024*1024)throw Error('Choose a song file smaller than 2 MB.');
     const composition=JSON.parse(await selected.text());if(!current()||token!==generation)return;
     if(!api.validSong?.(composition))throw Error('Choose a song file exported from Song Machine.');
     const result=api.saveImported?.(composition,selected.name.replace(/\.json$/i,''));if(!result?.record)throw Error('The song could not be added. Try again.');
     if(!result.saved)temporarySongs.unshift(result.record);
     empty.remove();songRow(rows,result.record,'import');message(result.saved?'Added '+result.record.title+'. Press Play when you’re ready.':'Song added for this visit. There is not enough space to save it on this device.');
    }catch(error){if(current()&&token===generation)message('Could not add that song: '+error.message);}
   };
   const cloud=node('section'),cloudStatus=node('p','dj-file-help','Loading your saved songs…');cloud.append(node('h4','','Saved songs'),cloudStatus);menu.append(cloud);
   try{const result=await api.loadCloud?.();if(!current()||token!==generation||!cloud.isConnected)return;cloudStatus.textContent=result?.message||'No saved songs yet.';for(const record of result?.songs||[])songRow(cloud,record,'cloud',record.id);}
   catch{if(current()&&token===generation&&cloud.isConnected)cloudStatus.textContent='Saved songs could not load. You can still add a song file from this device.';}
  }
  function show(next='home',focus=true){
   if(destroyed)return;page=['home','house','songs'].includes(next)?next:'home';const token=++generation;menu.dataset.djPage=page;menu.replaceChildren();
   if(page!=='home'){const back=button('‹ DJ menu',()=>show('home'),'kids-menu-back');back.dataset.djAction='home';menu.append(back);}
   const controls=node('div','dj-playback');status=node('p','panelMsg');status.setAttribute('role','status');status.setAttribute('aria-live','polite');const stop=button('Stop music',()=>{if(current()){api.onStop?.();message('Music stopped.');}});stop.id='jukeboxStop';controls.append(status,stop);menu.append(controls);playback();
   if(page==='home')renderHome();else if(page==='house')renderHouse();else void renderSongs(token);
   const panel=host.closest('[role="dialog"]');if(panel)panel.scrollTop=0;if(focus)menu.querySelector('[data-dj-heading]')?.focus({preventScroll:true});
  }
  return {show,back(){if(page==='home')return false;show('home');return true;},getState:()=>({page}),destroy(){destroyed=true;generation++;menu.remove();}};
 }
 return {create};
});
