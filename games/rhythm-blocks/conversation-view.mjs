import {createJrpgDialogue} from './jrpg-dialogue.mjs';

/** A player's current reply uses the same readable typewriter as room scenes. */
export function createConversationView({panel,line,nextButton,cinematicAudio=null,onClose=()=>{},onFrame=()=>{}}){
 const document=panel.ownerDocument,window=document.defaultView,removers=[];
 let model={id:'',speaker:'',name:'',text:''},active=false,playing=false,elapsed=0,last=null,frame=0,track=null,disposed=false,resumeAfterBackground=false;
 const dialogue=createJrpgDialogue({panel,line,getSpeaker:()=>model.name});
 const running=()=>active&&panel.open&&playing&&!document.hidden&&!dialogue.state.complete;
 const snapshot=()=>Object.freeze({...model,elapsed,active,open:active&&panel.open,playing:running(),complete:dialogue.state.complete,visibleCharacters:dialogue.state.visibleCharacters,totalCharacters:dialogue.state.totalCharacters});
 function listen(target,type,handler,options){target.addEventListener(type,handler,options);removers.push(()=>target.removeEventListener(type,handler,options));}
 function cancel(){if(frame)window.cancelAnimationFrame(frame);frame=0;last=null;}
 function layout(){if(!disposed)onFrame(snapshot());}
 function sample(audible=false){
  track?.sample({phase:'story',manualDialogue:true,playing:active&&panel.open&&playing&&!document.hidden,finished:false,currentTile:0,dialogueElapsed:elapsed,beat:{id:model.id,speaker:model.speaker,text:model.text},actors:[],activeClips:[]},{visibleCharacters:dialogue.state.visibleCharacters,audible});
 }
 function paint(audible=false){
  dialogue.update(elapsed);
  panel.dataset.dialogueState=dialogue.state.complete?'waiting':'revealing';
  const label=dialogue.state.complete?'Done ›':'Next ›',aria=dialogue.state.complete?'Finish this conversation':'Show the rest of this reply';
  if(nextButton.textContent!==label)nextButton.textContent=label;
  if(nextButton.getAttribute('aria-label')!==aria)nextButton.setAttribute('aria-label',aria);
  sample(audible);
 }
 function schedule(){if(!frame&&running())frame=window.requestAnimationFrame(tick);}
 function tick(now){
  frame=0;if(disposed||!active)return;
  if(!panel.open){close();return;}
  if(!running()){last=null;return;}
  const delta=last===null?16:Math.min(100,Math.max(0,now-last));last=now;
  elapsed+=delta;paint(true);schedule();
 }
 function restart(){
  cancel();elapsed=0;playing=true;resumeAfterBackground=false;
  track?.destroy();track=cinematicAudio?.createTrack()??null;
  dialogue.setLine(model.text);paint();panel.scrollTop=0;layout();schedule();
 }
 function setLine(value={}){
  if(disposed)return false;
  const next={id:String(value.id??''),speaker:String(value.speaker??''),name:String(value.name??''),text:String(value.text??'')};
  if(Object.keys(next).every(key=>next[key]===model[key]))return false;
  model=next;
  // talk() also refreshes hidden conversations. Never lay out a zero-width
  // paragraph or stop the scene's shared audio for a closed reply.
  if(active&&panel.open)restart();
  return true;
 }
 function open(){
  if(disposed||!panel.open||active)return snapshot();
  active=true;panel.dataset.dialogueMode='manual';restart();
  nextButton.focus({preventScroll:true});
  panel.scrollTop=0;
  return snapshot();
 }
 function close(){
  if(disposed||!active)return snapshot();
  active=false;playing=false;resumeAfterBackground=false;cancel();
  track?.destroy();track=null;
  delete panel.dataset.dialogueMode;delete panel.dataset.dialogueState;
  layout();return snapshot();
 }
 function pause(){
  resumeAfterBackground=false;if(!active)return snapshot();
  playing=false;cancel();track?.stop();paint();return snapshot();
 }
 function play(){
  if(disposed||!active||!panel.open)return snapshot();
  playing=true;last=null;resumeAfterBackground=false;void cinematicAudio?.unlock();paint();schedule();return snapshot();
 }
 function advance(){
  if(disposed||!active||!panel.open)return false;
  if(!dialogue.state.complete){dialogue.revealAll();paint();cancel();return true;}
  close();onClose();return true;
 }
 function background(){
  if(!active)return;
  const resume=resumeAfterBackground||playing&&!dialogue.state.complete;
  playing=false;cancel();track?.stop();paint();resumeAfterBackground=resume;
 }
 function foreground(){if(active&&resumeAfterBackground&&!document.hidden)play();}
 listen(panel,'close',close);
 listen(nextButton,'click',advance);
 listen(panel,'click',event=>{
  if(!active||event.target.closest('button,a,input,textarea,select,[contenteditable="true"]'))return;
  const bounds=panel.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)return;
  const selection=window.getSelection?.();if(selection?.toString()&&panel.contains(selection.anchorNode))return;
  advance();
 });
 listen(document,'keydown',event=>{
  if(!active||!panel.open||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey)return;
  const target=event.target;
  if(target.closest('input,textarea,select,[contenteditable="true"]'))return;
  const key=event.key.toLowerCase();if(!['e','enter',' '].includes(key))return;
  if(event.repeat){event.preventDefault();event.stopImmediatePropagation();return;}
  // Enter/Space already click a focused native button. Let that single native
  // action choose its reply, receive a gift, or advance the Next button.
  if(key!=='e'&&target.closest('button,a'))return;
  event.preventDefault();event.stopImmediatePropagation();advance();
 });
 listen(window,'blur',background);listen(window,'focus',foreground);
 listen(document,'visibilitychange',()=>document.hidden?background():foreground());
 listen(window,'resize',()=>{if(active)layout();});
 let observer=null,width=0,height=0;
 if(window.ResizeObserver){observer=new window.ResizeObserver(entries=>{
  const rect=entries[0]?.contentRect;if(!active||!rect)return;
  if(Math.abs(rect.width-width)>.5||Math.abs(rect.height-height)>.5){width=rect.width;height=rect.height;layout();}
 });observer.observe(panel);}
 function destroy(){
  if(disposed)return;close();disposed=true;cancel();observer?.disconnect();
  for(const remove of removers)remove();dialogue.destroy();
 }
 return Object.freeze({setLine,open,close,pause,play,advance,get state(){return snapshot();},destroy});
}
