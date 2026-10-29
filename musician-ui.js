/* Local, authored conversations and a live four-direction wardrobe preview. */
window.createCodaMusicianUI=function(api){
  'use strict';
  const $=id=>document.getElementById(id),dialog=$('dialog');
  const details=document.createElement('p');details.className='musician-description';
  const choices=document.createElement('div');choices.className='musician-choices';
  const credit=document.createElement('small');credit.className='muted';credit.textContent='Imagined dialogue inspired by music history.';
  $('who').after(details);$('words').after(choices,credit);
  let selected=null,preview=null;
  function closeConversation(){api.getBrain()?.endConversation();selected=null;dialog.style.display='none';api.onConversationChange?.();api.clearInput();api.canvas.focus();}
  function talk(npc){
    const data=api.getBrain()?.beginConversation(npc);if(!data)return;
    const person=api.npcs.find(person=>person.id===data.id);if(person)api.faceTo?.(person);
    selected=data.id;api.clearInput();dialog.style.display='block';api.onConversationChange?.();credit.textContent=data.original?'Original Coda Arcade character and dialogue.':'Imagined dialogue inspired by music history.';$('who').textContent=data.name;details.textContent=data.description;$('words').textContent=data.line;
    choices.replaceChildren();
    for(const choice of data.choices){const button=document.createElement('button');button.type='button';button.textContent=choice.label;button.onclick=()=>{$('words').textContent=api.getBrain().say(selected,choice.id);};choices.append(button);}
    if(api.openMissions&&api.getMission?.(selected)){const mission=document.createElement('button');mission.type='button';const entry=api.getMission?.(selected);mission.textContent=entry?.status==='complete'?'I finished your mission · Collect reward':entry?.status==='active'?'My mission · Check progress':'Any missions for me? · Earn Notes';mission.onclick=()=>{const id=selected;closeConversation();api.openMissions(id);};choices.append(mission);}
    if(api.openTrivia&&(!api.hasTrivia||api.hasTrivia(selected))){const trivia=document.createElement('button');trivia.type='button';trivia.textContent='Ask me a music question · Earn Notes';trivia.onclick=()=>{const id=selected;closeConversation();api.openTrivia(id);};choices.append(trivia);}
    if(api.openHistory){const history=document.createElement('button');history.type='button';history.textContent='Tell me some music history';history.onclick=()=>api.openHistory(selected);choices.append(history);}
    $('close').textContent='See you around · E';$('close').focus();
  }
  $('close').onclick=closeConversation;
  function openRoster(){
    closeConversation();api.openPanel('Meet the musicians');
    const intro=document.createElement('p');intro.className='muted';intro.textContent='See who is visiting the arcade today. Find them on the map to chat and learn a music tip. Historical musicians can also offer game missions.';api.panelBody.append(intro);
    for(const person of api.npcs){
      if(person.hidden)continue;
      const data=api.getBrain().getConversation(person),card=document.createElement('article');card.className='musician-card';
      const portrait=document.createElement('canvas');portrait.width=100;portrait.height=128;portrait.setAttribute('aria-label',person.name+' portrait');
      const portraitContext=portrait.getContext('2d'),vibe=api.getVibe?.(),appearance=vibe?.getState?.().active==='spooky'?vibe.characterAppearance?.({...api.renderer.appearanceFor?.(person.id),...person.appearance},{id:person.id,role:'npc'})||person.appearance:person.appearance;
      portraitContext.save();portraitContext.translate(50,118);portraitContext.scale(1.35,1.35);api.renderer.drawNPC(portraitContext,{...person,appearance,x:0,y:0,facing:'down',walking:false,activity:'idle'},0);vibe?.drawCharacterCostume?.(portraitContext,{id:person.id,role:'npc',x:0,y:0,facing:'down',time:0});vibe?.drawCharacterGlow?.(portraitContext,{id:person.id,role:'npc',x:0,y:0,facing:'down',time:0});portraitContext.restore();
      const body=document.createElement('div'),name=document.createElement('strong'),bio=document.createElement('p'),activity=document.createElement('small');
      name.textContent=person.name;bio.textContent=data.description;activity.textContent='Now: '+data.activity;body.append(name,bio,activity);
      const button=document.createElement('button');button.type='button';const near=api.distance(person)<94;button.textContent=near?'Chat':'Find on map';button.setAttribute('aria-label',(near?'Chat with ':'Find ')+person.name);
      button.onclick=()=>{api.closePanel();if(api.distance(person)<94)talk(person);else api.walkTo(person);};
      card.append(portrait,body,button);api.panelBody.append(card);
      if(api.openMissions&&api.getMission?.(person.id)){const mission=document.createElement('button');mission.type='button';mission.textContent='Missions · Notes';mission.setAttribute('aria-label','Missions from '+person.name);mission.onclick=()=>api.openMissions(person.id);body.append(mission);}
    }
  }
  const roster=document.createElement('button');roster.type='button';roster.id='musiciansBtn';roster.textContent='♫ Meet musicians';roster.onclick=openRoster;
  const wardrobe=document.createElement('button');wardrobe.type='button';wardrobe.id='avatarBtn';wardrobe.textContent='Your avatar';wardrobe.onclick=()=>{closeConversation();api.openWardrobe();};
  $('accountBtn').before(wardrobe,roster);
  function addPreview(getProfile){
    const section=document.createElement('section');section.className='avatar-live-preview';section.setAttribute('aria-label','Live avatar preview');
    const row=document.createElement('div');row.className='avatar-preview-views';const views=[];
    for(const [facing,label]of [['down','Front'],['left','Left'],['up','Back'],['right','Right']]){
      const figure=document.createElement('figure'),canvas=document.createElement('canvas'),caption=document.createElement('figcaption');canvas.width=176;canvas.height=160;canvas.setAttribute('aria-label',label+' avatar preview');caption.textContent=label;figure.append(canvas,caption);row.append(figure);views.push({facing,canvas});
    }
    const label=document.createElement('label');label.className='formRow';label.textContent='Preview animation';const mode=document.createElement('select');mode.id='avatarPreviewMode';mode.setAttribute('aria-label','Preview animation');for(const [value,text]of [['walk','Walk'],['idle','Idle'],['emote','Selected emote']])mode.append(new Option(text,value));label.append(mode);section.append(row,label);api.panelBody.insertBefore(section,api.panelBody.children[1]||null);preview={section,views,getProfile,mode,startedAt:null};mode.onchange=()=>{preview.startedAt=null;drawPreview(0);};drawPreview(0);
  }
  function drawPreview(time){
    if(!preview?.section.isConnected||api.panelBody.parentElement.hidden)return;
    if(time>0&&preview.startedAt===null)preview.startedAt=time;
    const elapsed=preview.startedAt===null?0:Math.max(0,time-preview.startedAt),profile=preview.getProfile();
    for(const {facing,canvas}of preview.views){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();api.renderer.drawPlayer(ctx,profile,{x:88,y:140,scale:1.6,facing,walking:preview.mode.value==='walk',phase:elapsed*8,emote:preview.mode.value==='emote'?profile.emote:null,emoteTime:elapsed,previewPet:true},elapsed);ctx.restore();}
  }
  function update(time){
    if(selected&&!api.npcs.some(person=>person.id===selected&&!person.hidden&&person.conversation))closeConversation();
    drawPreview(time);
  }
  return {talk,closeConversation,openRoster,addPreview,drawPreview,update,selected:()=>selected};
};
