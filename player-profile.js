/* A read-only home for a student's avatar, next prize, and real saved progress. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root){root.CodaPlayerProfile=api;root.createCodaPlayerProfile=api.createCodaPlayerProfile;}})(typeof window==='undefined'?null:window,function(root){
 'use strict';
 const finite=(value,fallback=0)=>Number.isFinite(value)&&value>=0?value:fallback;
 const text=(value,fallback='')=>typeof value==='string'?value:fallback;
 const array=value=>Array.isArray(value)?value:[];
 const copy=value=>JSON.parse(JSON.stringify(value));
 const GAME_NAMES={pitch:'Pitch Race',triad:'Music Triad',rhythm:'Rhythm Room',fishing:'Rhythm Fishing',piano:'Piano Lab'};
 function profileModel(data={},catalog={}){
  const source=data.progression&&typeof data.progression==='object'?data.progression:{},xp=finite(source.xp),thresholds=array(catalog.THRESHOLDS).filter(Number.isFinite);
  const inferred=thresholds.length?thresholds.reduce((level,threshold,index)=>xp>=threshold?index+1:level,1):1;
  const level=thresholds.length?inferred:Math.max(1,Math.floor(finite(source.level,1))),base=thresholds[level-1]??Math.max(0,xp-finite(source.levelXP));
  const target=thresholds.length?(thresholds[level]??null):(Number.isFinite(source.nextLevelXP)?source.nextLevelXP:null),atMax=target===null;
  const nextPrizes=atMax?[]:typeof catalog.prizesForLevel==='function'?array(catalog.prizesForLevel(level+1)).filter(item=>item&&['cosmetic','sound','notes','vibe'].includes(item.kind)).map(item=>({id:item.id,label:text(item.label,'Level prize'),kind:item.kind,...(item.kind==='notes'?{amount:Math.floor(finite(item.amount))}:{})})):[...array(catalog.COSMETICS).filter(item=>item?.level===level+1).map(item=>({id:text(item.id),label:text(item.label,'New look'),kind:'cosmetic'})),...array(catalog.SOUNDS).filter(item=>item?.level===level+1).map(item=>({id:item.id,label:text(item.label,'New sound'),kind:'sound'}))];
  const rawMissions=Array.isArray(data.missions)?data.missions:array(data.missions?.missions);
  const missions=rawMissions.filter(item=>item&&['locked','available','active','complete','rewarded'].includes(item.status)).map(item=>{
   const minLevel=Math.max(1,Math.floor(finite(item.minLevel,1)));
   return {id:text(item.id),person:text(item.person),title:text(item.title,'Musician mission'),goal:text(item.goal),game:text(item.game),gameName:GAME_NAMES[item.game]||text(item.game,'Arcade game'),
    target:Math.max(1,finite(item.target,1)),progress:Math.min(Math.max(1,finite(item.target,1)),finite(item.progress)),reward:Math.floor(finite(item.reward)),minLevel,unlocked:item.unlocked!==false&&minLevel<=level,status:item.status==='available'&&minLevel>level?'locked':item.status};
  });
  const lockedMissions=missions.filter(item=>item.status==='locked'),futureLevels=lockedMissions.filter(item=>item.minLevel>level).map(item=>item.minLevel),nextUnlockLevel=futureLevels.length?Math.min(...futureLevels):null;
  const upcomingMissions=nextUnlockLevel===null?[]:lockedMissions.filter(item=>item.minLevel===nextUnlockLevel),nextLevelQuests=atMax?[]:lockedMissions.filter(item=>item.minLevel===level+1);
  if(nextLevelQuests.length)nextPrizes.push({id:'quests-level-'+(level+1),label:nextLevelQuests.length+' new quest'+(nextLevelQuests.length===1?'':'s')+' at Level '+(level+1),kind:'quest',count:nextLevelQuests.length});
  const tutorials=data.tutorials&&typeof data.tutorials==='object'?copy(data.tutorials):null;
  const recent=array(source.recent).filter(item=>item&&finite(item.xp)>0).slice(0,3).map(item=>({xp:finite(item.xp),reason:text(item.reason,'Music practice')}));
  return {name:text(data.avatar?.name,'Guest').trim().slice(0,18)||'Guest',avatar:data.avatar&&typeof data.avatar==='object'?copy(data.avatar):{},xp,level,baseXP:base,nextLevel:atMax?null:level+1,targetXP:target,
   xpToNext:atMax?0:Math.max(0,target-xp),levelXP:Math.max(0,xp-base),levelSize:atMax?0:Math.max(1,target-base),progress:atMax?1:Math.max(0,Math.min(1,(xp-base)/Math.max(1,target-base))),atMax,nextPrizes,
   notes:Math.floor(finite(data.notes?.balance)),activeMissions:missions.filter(item=>item.status==='active'||item.status==='complete'),completedMissions:missions.filter(item=>item.status==='rewarded'),availableMissions:missions.filter(item=>item.status==='available'),lockedMissions,nextUnlockLevel,upcomingMissions,tutorials,recent,
   error:[source.error,data.notes?.error,data.missions?.error].filter(value=>typeof value==='string'&&value).join(' ')};
 }
 function createCodaPlayerProfile(api={}){
  const body=api.panelBody;if(!body)throw Error('Your profile needs a panel.');
  const doc=body.ownerDocument,win=doc.defaultView||root,catalog=api.progressionCatalog||root?.CodaPlayerProgression||{},renderer=api.renderer;
  let section=null,model=null,signature='',facing='down',portrait=null,animation=0,disposed=false,startedAt=null;
  const safely=(getter,fallback)=>{try{return typeof getter==='function'?getter():fallback;}catch{return fallback;}};
  const node=(tag,className,value)=>{const element=doc.createElement(tag);if(className)element.className=className;if(value!==undefined)element.textContent=value;return element;};
  const button=(label,callback)=>{const element=node('button','profile-action',label);element.type='button';element.onclick=callback;return element;};
  function capture(){
   const value=safely(api.getClassroomAlias,null),alias=typeof value==='string'?value.trim().slice(0,80):'',avatar=safely(api.getAvatar,{});
   const model=profileModel({avatar:alias?{...avatar,name:alias}:avatar,progression:safely(api.getProgression,{}),missions:safely(api.getMissions,{}),notes:safely(api.getNotes,{}),tutorials:safely(api.getTutorials,null)},catalog);
   if(alias){model.name=alias;model.avatar.name=alias;model.classroomAlias=alias;}return model;
  }
  function visible(){return !!section?.isConnected&&!body.parentElement?.hidden;}
  function avatarCanvas(profile,width=200,height=220){
   const canvas=node('canvas','profile-avatar');canvas.width=width;canvas.height=height;canvas.setAttribute('aria-label',model.name+'’s character');
   const context=canvas.getContext('2d');if(context&&renderer?.drawPlayer){const scale=Math.min(2.4,(height-24)/(renderer.labelOffset?.(profile)||76));renderer.drawPlayer(context,profile,{x:width/2,y:height-14,scale,facing,walking:false,previewPet:true},0);}return canvas;
  }
  function drawPortrait(time=0){
   if(!portrait||!visible()||!renderer?.drawPlayer)return;
   const context=portrait.getContext('2d');if(!context)return;
   const elapsed=startedAt===null?0:Math.max(0,time-startedAt),scale=Math.min(2.4,(portrait.height-24)/(renderer.labelOffset?.(model.avatar)||76));
   context.clearRect(0,0,portrait.width,portrait.height);context.imageSmoothingEnabled=false;renderer.drawPlayer(context,model.avatar,{x:portrait.width/2,y:portrait.height-14,scale,facing,walking:false,previewPet:true},elapsed);
  }
  function animate(time){animation=0;if(!visible()||disposed)return;if(startedAt===null)startedAt=time/1000;drawPortrait(time/1000);if(!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches)animation=win.requestAnimationFrame(animate);}
  function startAnimation(){if(animation)win.cancelAnimationFrame(animation);animation=0;startedAt=null;drawPortrait();if(visible()&&!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches)animation=win.requestAnimationFrame(animate);}
  function meter(value,max,label){const progress=node('progress','profile-progress');progress.max=Math.max(1,max);progress.value=Math.max(0,Math.min(value,progress.max));progress.setAttribute('aria-label',label);return progress;}
  function prizeCard(prize){
   const card=node('article','profile-prize');card.dataset.prizeId=String(prize.id);card.dataset.prizeKind=prize.kind;
   if(prize.kind==='cosmetic'&&renderer?.catalog){
    const groups={headwear:'headwear',eyewear:'eyewear',accessory:'accessories',shoes:'shoes',emote:'emotes',outfit:'outfits',hairstyle:'hairstyles'};
    const slot=Object.keys(groups).find(key=>array(renderer.catalog[groups[key]]).some(item=>item.id===prize.id));
    if(slot){const look=renderer.itemPreviewProfile?.(model.avatar,slot,prize.id)||{...model.avatar,[slot]:prize.id},preview=avatarCanvas(look,100,110);preview.classList.add('profile-prize-avatar');preview.setAttribute('aria-hidden','true');card.append(preview);}
   }else{const symbol=node('span','profile-sound-icon',prize.kind==='quest'?'★':prize.kind==='notes'?'♪':prize.kind==='vibe'?'✦':'♫');symbol.setAttribute('aria-hidden','true');card.append(symbol);}
   const details=node('div','profile-prize-details');details.append(node('strong','',prize.label),node('small','',prize.kind==='sound'?'New Song Machine sound':prize.kind==='quest'?'New challenges from the musicians':prize.kind==='notes'?'Notes to spend in the shop':prize.kind==='vibe'?'A new arcade vibe':'New look for your character'));card.append(details);return card;
  }
  function personName(id){const people=safely(api.getMusicians,root?.CodaMusicianCast||[]);return array(people).find(person=>person.id===id)?.name||id.replace(/[-_]/g,' ').replace(/^./,letter=>letter.toUpperCase());}
  function missionCard(mission,completed=false){
   const blocked=!completed&&(mission.status==='locked'||!mission.unlocked),card=node('article','profile-mission'+(mission.status==='complete'&&!blocked?' is-complete':''));card.dataset.missionId=mission.id;if(blocked)card.dataset.missionLocked='true';
   const title=node('h4','',mission.title);card.append(title,node('p','profile-mission-person','From '+personName(mission.person)),node('p','profile-mission-goal',mission.goal));
   const status=completed?'Finished · '+mission.reward+' Notes earned':blocked?'Unlocks at Level '+mission.minLevel+' · Reward: '+mission.reward+' Notes':mission.status==='complete'?'Ready! Return to '+personName(mission.person)+' to collect '+mission.reward+' Notes.':mission.progress+' / '+mission.target+' · Reward: '+mission.reward+' Notes';
   if(!blocked)card.append(meter(mission.progress,mission.target,mission.title+' progress'));card.append(node('p','profile-mission-status',status));
   if(!completed&&mission.status!=='locked'&&(api.openMission||api.openGame)){
    const actions=node('div','profile-actions');
    if(api.openMission){const view=button(mission.status==='complete'&&!blocked?'Collect mission reward':'View mission',()=>api.openMission(mission.id));view.setAttribute('aria-label','Open '+mission.title+' mission');actions.append(view);}
    if(api.findQuestGiver&&mission.status==='complete'&&!blocked)actions.append(button('Find '+personName(mission.person),()=>api.findQuestGiver(mission.person)));
    if(api.openGame&&mission.status==='active'&&!blocked){const play=button(api.gameActionLabel?.(mission.gameName)||'Play '+mission.gameName,()=>api.openGame(mission.game));play.setAttribute('aria-label','Play '+mission.gameName+' for '+mission.title);actions.append(play);}
    card.append(actions);
   }
   return card;
  }
  function tutorialSection(){
   const progress=model.tutorials;if(!progress)return null;
   const entries=Array.isArray(progress.lessons)?progress.lessons:[];
   const completed=array(progress.completed),lessons=entries.map(item=>typeof item==='string'?{id:item,title:item,completed:completed.includes(item)}:item).filter(item=>item&&typeof item==='object');
   if(!lessons.length&&!completed.length)return null;
   const part=node('section','profile-lessons');part.append(node('h3','','Your classroom practice'));
   if(lessons.length)for(const lesson of lessons){const done=lesson.completed===true||lesson.complete===true||completed.includes(lesson.id),steps=Number.isFinite(lesson.step)&&Number.isFinite(lesson.total)&&lesson.total>0?(lesson.step>=lesson.total?' · Quiz ready':' · '+Math.min(lesson.step,lesson.total)+' / '+lesson.total+' steps'):' · Keep practicing';part.append(node('p',done?'profile-lesson-done':'profile-lesson-pending',(done?'✓ ':'○ ')+(lesson.title||lesson.name||lesson.id)+(done?' · Finished':steps)));}
   else part.append(node('p','',completed.length+' classroom lesson'+(completed.length===1?'':'s')+' finished'));
   if(api.openClassroom)part.append(button(api.classroomLabel||'Practice in the classroom',()=>api.openClassroom()));
   return part;
  }
  function render(){
   if(!visible())return;section.replaceChildren();
   const hero=node('section','profile-hero'),portraitBox=node('div','profile-portrait-frame');portrait=avatarCanvas(model.avatar);portraitBox.append(portrait);
   const views=node('div','profile-views');views.setAttribute('role','group');views.setAttribute('aria-label','Character views');
   for(const [direction,label,symbol]of [['down','Front','Front'],['left','Left','Left'],['up','Back','Back'],['right','Right','Right']]){const view=button(symbol,()=>{facing=direction;for(const item of views.querySelectorAll('button'))item.setAttribute('aria-pressed',String(item===view));drawPortrait();});view.setAttribute('aria-label','View character from '+label.toLowerCase());view.setAttribute('aria-pressed',String(facing===direction));views.append(view);}
   portraitBox.append(views);hero.append(portraitBox);
   const identity=node('div','profile-identity');identity.append(node('p','profile-eyebrow','YOUR MUSICIAN'),node('h2','',model.name),node('p','profile-level','Level '+model.level),node('p','profile-notes',model.notes+' Notes'));
   if(api.openWardrobe)identity.append(button(api.wardrobeLabel||'Change your look',()=>api.openWardrobe()));
   if(typeof api.openClassroomProfile==='function')identity.append(button('Classroom profile',()=>api.openClassroomProfile()));hero.append(identity);section.append(hero);
   const experience=node('section','profile-experience');experience.append(node('h3','',model.atMax?'Look how far you’ve come!':'Your next level'),node('p','profile-xp-to-go',model.atMax?'You have earned every current level prize.':model.xpToNext+' XP to go!'));
   experience.append(meter(model.atMax?1:model.levelXP,model.atMax?1:model.levelSize,'Experience toward '+(model.atMax?'all current level prizes':'level '+model.nextLevel)),node('p','profile-xp-detail',model.atMax?model.xp+' total XP':model.levelXP+' / '+model.levelSize+' XP toward level '+model.nextLevel+' · '+model.xp+' total XP'));
   experience.append(node('p','profile-help','XP means experience points. You earn them by playing games, finishing missions, and learning new music skills.'));section.append(experience);
   const rewards=node('section','profile-next-prizes');rewards.append(node('h3','',model.atMax?'Your level prizes':'Your next prize'+(model.nextPrizes.length===1?'':'s')+' · Level '+model.nextLevel));
   if(model.atMax)rewards.append(node('p','','All current level prizes are unlocked. You can keep playing and earning XP.'));
   else if(model.nextPrizes.length){const cards=node('div','profile-prize-grid');model.nextPrizes.forEach(prize=>cards.append(prizeCard(prize)));rewards.append(cards);}
   else rewards.append(node('p','','Your next musician milestone is on the way.'));
   if(api.openLevels)rewards.append(button('See all level prizes',()=>api.openLevels()));section.append(rewards);
   const missions=node('section','profile-missions');missions.append(node('h3','','Missions in progress'));
   if(model.activeMissions.length)model.activeMissions.forEach(mission=>missions.append(missionCard(mission)));
   else{const empty=node('div','profile-empty');empty.append(node('p','','No missions yet. A musician can give you your next adventure!'));
    if(api.openMusicians)empty.append(button('Meet the musicians',()=>api.openMusicians()));
    else if(api.openMission&&model.availableMissions.length)empty.append(button('Choose your first mission',()=>api.openMission(model.availableMissions[0].id)));
    missions.append(empty);
   }
   section.append(missions);
   if(model.upcomingMissions.length){
    const upcoming=node('section','profile-upcoming-missions'),count=model.upcomingMissions.length;
    upcoming.append(node('h3','','New quests · Level '+model.nextUnlockLevel),node('p','profile-help','Keep playing! '+count+' new quest'+(count===1?' opens':'s open')+' at Level '+model.nextUnlockLevel+'.'));
    const preview=node('details','profile-upcoming-preview');preview.append(node('summary','profile-action','Preview the next quests'));
    model.upcomingMissions.slice(0,4).forEach(mission=>preview.append(missionCard(mission)));
    if(count>4)preview.append(node('p','profile-help','Plus '+(count-4)+' more quest'+(count-4===1?'':'s')+' at this level.'));
    upcoming.append(preview);section.append(upcoming);
   }
   if(model.completedMissions.length){const completed=node('details','profile-completed');completed.append(node('summary','',model.completedMissions.length+' finished mission'+(model.completedMissions.length===1?'':'s')));model.completedMissions.forEach(mission=>completed.append(missionCard(mission,true)));section.append(completed);}
   const lessons=tutorialSection();if(lessons)section.append(lessons);
   if(model.recent.length){const activity=node('section','profile-recent');activity.append(node('h3','','Recently earned XP'));for(const item of model.recent)activity.append(node('p','','+'+item.xp+' XP · '+item.reason));section.append(activity);}
   if(model.error){const warning=node('p','profile-save-note',model.error);warning.setAttribute('role','status');section.append(warning);}startAnimation();
  }
  function refresh(){if(disposed)return null;model=capture();const next=JSON.stringify(model);if(next!==signature||!portrait){signature=next;render();}return copy(model);}
  function open(){if(disposed)return;api.openPanel('Your profile');section=node('section','player-profile');section.setAttribute('aria-label','Your musician profile');body.append(section);signature='';portrait=null;facing='down';refresh();}
  const onChange=()=>{if(visible())refresh();};win.addEventListener?.('coda-progression-change',onChange);win.addEventListener?.('coda-tutorial-progress',onChange);win.addEventListener?.('storage',onChange);
  return {open,refresh,getState:()=>({open:visible(),...capture()}),dispose(){if(disposed)return;disposed=true;if(animation)win.cancelAnimationFrame(animation);animation=0;win.removeEventListener?.('coda-progression-change',onChange);win.removeEventListener?.('coda-tutorial-progress',onChange);win.removeEventListener?.('storage',onChange);section?.remove();}};
 }
 return {profileModel,createCodaPlayerProfile};
});
