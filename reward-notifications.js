/* Non-modal celebrations. Saved rewards are never replayed automatically. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root){root.CodaRewardNotifications=api;root.createCodaRewardNotifications=api.createCodaRewardNotifications;}})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const cleanText=(value,max=180)=>typeof value==='string'?value.trim().slice(0,max):'';
 const copy=value=>value===null?null:JSON.parse(JSON.stringify(value));
 function normalize(item){
  if(!item||item.announce===false)return null;
  const id=cleanText(item.id,240),title=cleanText(item.title,90);if(!id||!title)return null;
  const kind=['achievement','mission-complete','mission-reward','level'].includes(item.kind)?item.kind:'information';
  const action=item.action&&cleanText(item.action.id,100)&&cleanText(item.action.label,50)?{id:cleanText(item.action.id,100),label:cleanText(item.action.label,50)}:null;
  const value={id,kind,title,message:cleanText(item.message,320),action},missionId=cleanText(item.missionId,180);
  if(missionId)value.missionId=missionId;return value;
 }
 function createNotificationQueue(api={}){
  const limit=Math.max(1,Math.min(50,Math.floor(api.limit||20))),seen=new Set(),claimedMissions=new Set(),waiting=[];let current=null;
  const snapshot=()=>({current:copy(current),queued:waiting.map(copy),seen:Array.from(seen)});
  function changed(){api.onChange?.(snapshot());}
  const priority=item=>item.kind==='mission-complete'?0:item.kind==='mission-reward'?1:item.kind==='level'?2:3;
  function push(item){const next=normalize(item);if(!next||seen.has(next.id))return false;
   if(next.kind==='mission-complete'&&next.missionId&&claimedMissions.has(next.missionId))return false;seen.add(next.id);
   if(next.kind==='mission-reward'&&next.missionId){
    claimedMissions.add(next.missionId);
    for(let i=waiting.length-1;i>=0;i--)if(waiting[i].kind==='mission-complete'&&waiting[i].missionId===next.missionId)waiting.splice(i,1);
    if(current?.kind==='mission-complete'&&current.missionId===next.missionId){current=next;changed();return true;}
   }
   if(!current)current=next;
   else{
    if(waiting.length>=limit){
     // A burst of ordinary celebrations must not hide a return instruction,
     // collected reward, or level prize. Keep the newest of equal priority.
     const lowest=Math.max(...waiting.map(priority));
     if(lowest<priority(next))return false;
     waiting.splice(waiting.findIndex(value=>priority(value)===lowest),1);
    }
    const index=waiting.findIndex(value=>priority(value)>priority(next));
    waiting.splice(index<0?waiting.length:index,0,next);
   }changed();return true;
  }
  function dismiss(){if(!current)return false;current=waiting.shift()||null;changed();return true;}
  return {push,dismiss,snapshot,clear(){current=null;waiting.length=0;changed();}};
 }
 const prefixed=(prefix,id)=>String(id||'').startsWith(prefix+':')?String(id):prefix+':'+String(id||'');
 const missionKey=id=>cleanText(String(id||'').replace(/^mission-(complete|reward):/,''),180);
 function achievementItem(value={}){
  const title=cleanText(value.title,90)||'A new music skill',xp=Number.isFinite(value.xp)&&value.xp>0?Math.floor(value.xp):0;
  return {id:prefixed('achievement',value.id),kind:'achievement',title,message:(xp?'+'+xp+' XP · ':'')+'Achievement earned!',action:value.action,announce:value.announce};
 }
 function missionCompleteItem(value={}){
  const giver=cleanText(value.giver,70)||'your musician',reward=Number.isFinite(value.reward)?Math.max(0,Math.floor(value.reward)):0;
  return {id:prefixed('mission-complete',value.id),missionId:missionKey(value.id),kind:'mission-complete',title:cleanText(value.title,90)||'Mission complete!',message:'Go back to '+giver+' to collect '+reward+' Notes.',action:value.action,announce:value.announce};
 }
 function missionRewardItem(value={}){
  const notes=Number.isFinite(value.notes)?Math.max(0,Math.floor(value.notes)):0,xp=Number.isFinite(value.xp)&&value.xp>0?Math.floor(value.xp):0;
  return {id:prefixed('mission-reward',value.id),missionId:missionKey(value.id),kind:'mission-reward',title:cleanText(value.title,90)||'Reward collected!',message:'Collected '+notes+' Notes'+(xp?' and '+xp+' XP':'')+'. Nice work!',action:value.action,announce:value.announce};
 }
 function levelUpItem(value={}){
  const level=value.level;if(!Number.isInteger(level)||level<2||level>1000)return null;
  const from=Number.isInteger(value.fromLevel)&&value.fromLevel>0&&value.fromLevel<level?value.fromLevel:level-1;
  const prizes=[...new Set((Array.isArray(value.prizes)?value.prizes:[]).map(prize=>cleanText(typeof prize==='string'?prize:prize?.label,75)).filter(Boolean))];
  const visible=[];let size=0;for(const prize of prizes){if(visible.length>=4||size+prize.length>205)break;visible.push(prize);size+=prize.length+2;}
  const more=prizes.length-visible.length;
  const unlocked=visible.length?'Unlocked: '+visible.join(', ')+(more?' and '+more+' more reward'+(more===1?'':'s'):'')+'.':'Keep making music and earning experience!';
  return {id:'level:'+level,kind:'level',title:'Level '+level+'!',message:(level-from>1?'You gained '+(level-from)+' levels! ':'')+unlocked,action:value.action,announce:value.announce};
 }
 function createCodaRewardNotifications(api={}){
  const host=api.host||(api.document||document).body.appendChild((api.document||document).createElement('div')),doc=host.ownerDocument,win=doc.defaultView;
  host.classList.add('reward-notifications');host.setAttribute('aria-label','Game rewards');
  let rendered=null,card=null,timer=null,remaining=5000,started=0,priorFocus=null,disposed=false;
  const reasons=new Set(),listeners=[];
  const duration=Number.isFinite(api.duration)?Math.max(100,Math.min(15000,api.duration)):5000;
  const now=()=>win.performance?.now?.()??Date.now();
  const node=(tag,className,text)=>{const element=doc.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;};
  const listen=(target,event,fn)=>{target.addEventListener(event,fn);listeners.push(()=>target.removeEventListener(event,fn));};
  function clearTimer(){if(timer!==null){win.clearTimeout(timer);timer=null;remaining=Math.max(0,remaining-(now()-started));}}
  function schedule(){if(disposed||!card||reasons.size||timer!==null)return;started=now();timer=win.setTimeout(()=>{timer=null;remaining=0;dismiss(false);},remaining);}
  function pause(reason){if(!reasons.size)clearTimer();reasons.add(reason);}
  function resume(reason){reasons.delete(reason);if(!reasons.size)schedule();}
  function updatePosition(){
   if(disposed)return;let touch=false,offset=null;
   try{touch=api.getTouchState?.()?.visible===true;offset=api.getOffset?.();}catch{}
   host.classList.toggle('has-touch-controls',touch);
   if(Number.isFinite(offset)&&offset>=0)host.style.setProperty('--reward-notice-offset',offset+'px');
   else host.style.removeProperty('--reward-notice-offset');
  }
  function icon(kind){
   const box=node('span','reward-toast-icon');box.setAttribute('aria-hidden','true');
   const paths=kind==='mission-complete'?'<path d="M9 8h17v23H9zM13 14h9M13 19h9M13 24h5"/>':kind==='mission-reward'?'<path d="M9 14h20v17H9zM8 10h22v6H8zM19 10v21M19 10c-10 0-9-10-4-7l4 7c10 0 9-10 4-7z"/>':kind==='level'?'<path d="m19 4-10 11h7v16h6V15h7zM5 26h5M28 26h5"/>':'<path d="m19 3 4.4 9 9.9 1.4-7.2 7 1.7 9.9-8.8-4.7-8.8 4.7 1.7-9.9-7.2-7 9.9-1.4z"/>';
   box.innerHTML='<svg viewBox="0 0 38 36" width="38" height="36" focusable="false" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg>';return box;
  }
  function render(state){
   if(disposed||state.current?.id===rendered)return;clearTimer();reasons.clear();
   if(doc.activeElement&&!host.contains(doc.activeElement))priorFocus=doc.activeElement;
   host.replaceChildren();card=null;rendered=state.current?.id||null;host.hidden=!state.current;
   if(!state.current)return;const item=state.current;remaining=duration;
   card=node('section','reward-toast is-visible');card.dataset.notificationId=item.id;card.dataset.kind=item.kind;card.setAttribute('role','status');card.setAttribute('aria-live','polite');card.setAttribute('aria-atomic','true');
   const contents=node('div','reward-toast-content'),eyebrow=node('p','reward-toast-eyebrow',item.kind==='achievement'?'ACHIEVEMENT EARNED':item.kind==='mission-complete'?'MISSION COMPLETE':item.kind==='mission-reward'?'REWARD COLLECTED':item.kind==='level'?'LEVEL UP':'CODA ARCADE');
   contents.append(eyebrow,node('strong','reward-toast-title',item.title),node('p','reward-toast-message',item.message));
   if(item.action){const action=node('button','reward-toast-action',item.action.label);action.type='button';action.onclick=()=>{const actionCopy=copy(item.action),itemCopy=copy(item);dismiss(false);api.onAction?.(actionCopy,itemCopy);};contents.append(action);}
   const close=node('button','reward-toast-close','×');close.type='button';close.setAttribute('aria-label','Dismiss notification');close.onclick=()=>dismiss(true);
   card.append(icon(item.kind),contents,close);host.append(card);updatePosition();schedule();
  }
  const queue=createNotificationQueue({limit:api.limit,onChange:render});
  function dismiss(restore=true){const focused=host.contains(doc.activeElement),before=priorFocus;const result=queue.dismiss();if(restore&&focused&&before?.isConnected)before.focus?.({preventScroll:true});return result;}
  function notify(item){if(disposed)return false;return queue.push(item);}
  listen(host,'mouseenter',()=>pause('hover'));listen(host,'mouseleave',()=>resume('hover'));
  listen(host,'pointerdown',()=>pause('pointer'));listen(win,'pointerup',()=>resume('pointer'));listen(win,'pointercancel',()=>resume('pointer'));
  listen(host,'focusin',()=>pause('focus'));listen(host,'focusout',event=>{if(!host.contains(event.relatedTarget))resume('focus');});
  listen(win,'resize',updatePosition);listen(doc,'visibilitychange',()=>{if(doc.hidden)pause('hidden');else resume('hidden');});
  const poll=win.setInterval(updatePosition,150);host.hidden=true;updatePosition();
  return {notify,achievement:value=>notify(achievementItem(value)),missionComplete:value=>notify(missionCompleteItem(value)),missionReward:value=>notify(missionRewardItem(value)),levelUp:value=>notify(levelUpItem(value)),dismiss,
   getState:()=>({...queue.snapshot(),paused:reasons.size>0,remaining:timer===null?remaining:Math.max(0,remaining-(now()-started)),aboveTouchControls:host.classList.contains('has-touch-controls')}),
   dispose(){if(disposed)return;disposed=true;clearTimer();win.clearInterval(poll);listeners.forEach(stop=>stop());host.remove();}};
 }
 return {normalize,createNotificationQueue,achievementItem,missionCompleteItem,missionRewardItem,levelUpItem,createCodaRewardNotifications};
});
