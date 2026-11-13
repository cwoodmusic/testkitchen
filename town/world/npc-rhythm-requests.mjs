import {residents} from './resident-profiles.mjs?v=opera-parallax-1';
import {CATCH_PATTERNS,NOTE_VALUES,catchAttacks,sameRhythm} from './town-game-rules.mjs?v=town-notes-1';
import {createGameAudio,noteSVG,noteName,gameButton} from './town-game-audio.mjs?v=town-fairies-1';

const profiles=new Map(residents.map(resident=>[resident.id,resident]));
const BEAT=.625;

// An NPC keeps the same unheard request while the player gathers yellow cards.
// Only a correct, saved submission consumes inventory and advances that request.
export function createNPCRhythmRequests({canvas,journal,inventory,audio=createGameAudio()}){
 const dialog=document.createElement('dialog');
 dialog.className='town-game-dialog npc-rhythm-dialog';
 dialog.setAttribute('aria-label','NPC rhythm request');
 document.body.append(dialog);
 const requests=new Map();
 let phase='idle',current=null,paused=false,busy=false,serial=0,listenStart=0,listenUntil=0,message='';
 const focus=()=>canvas.focus({preventScroll:true});
 const show=()=>{if(!dialog.open)dialog.showModal();};
 function close(){serial++;busy=false;audio.stop();phase='idle';paused=false;if(dialog.open)dialog.close();focus();}
 function end(){close();requests.clear();current=null;}
 function title(heading,description){
  dialog.replaceChildren();
  const eyebrow=document.createElement('div');eyebrow.className='town-game-eyebrow';eyebrow.textContent='YELLOW NOTES · NEIGHBOUR RHYTHM';
  const h=document.createElement('h1');h.textContent=heading;
  dialog.append(eyebrow,h);
  if(description){const p=document.createElement('p');p.textContent=description;dialog.append(p);}
 }
 function actions(...buttons){const row=document.createElement('div');row.className='town-game-actions';row.append(...buttons);dialog.append(row);}
 function requestFor(actor){
  const resident=profiles.get(actor?.id);if(!resident||actor.role==='vendor')return null;
  const wins=journal.data.npcRhythmWins?.[resident.id]||0;
  let request=requests.get(resident.id);
  if(!request||request.cycle!==wins){
   request={id:resident.id,name:actor.name||resident.name,cycle:wins,target:[...CATCH_PATTERNS[(resident.index+wins)%CATCH_PATTERNS.length]],order:[],mistakes:0};
   requests.set(resident.id,request);
  }
  return request;
 }
 function offer(actor,parent,closeConversation){
  if(!profiles.has(actor?.id)||actor.role==='vendor')return false;
  const p=document.createElement('p');
  p.textContent='I have a rhythm for you! Can you write it by ear using the yellow note cards you catch around town?';
  const button=gameButton('Hear rhythm request',()=>{closeConversation();start(actor);},'npc-rhythm-request-button');
  parent.append(p,button);return true;
 }
 function start(actor){
  const request=requestFor(actor);if(!request)return false;
  close();current=request;phase='ready';message='';
  title(`${current.name}’s rhythm`,'Listen, then write four beats using your saved yellow cards. Your cards are spent only when the rhythm is right.');
  show();void demo();return true;
 }
 async function demo(){
  if(!current||phase==='idle'||phase==='won'||busy||paused)return;
  const ticket=serial;busy=true;
  const ok=await audio.unlock();
  if(ticket!==serial)return;
  busy=false;
  if(!ok){
   phase='sound';title('Let’s hear the rhythm','Sound is needed to hear this request. Enable sound, then listen closely.');
   actions(gameButton('Enable sound',()=>void demo(),'primary'),gameButton('Catch yellow notes',close));show();return;
  }
  audio.stop();paused=false;phase='listen';listenStart=audio.time+.15;listenUntil=listenStart+12*BEAT;
  title(`${current.name}’s rhythm`,'Listen twice. Then write the four beats from memory with your yellow cards.');
  const count=document.createElement('div');count.className='town-game-count';count.id='npcRhythmCount';count.setAttribute('aria-live','polite');count.textContent='Get ready';dialog.append(count);
  actions(gameButton('Catch yellow notes',close));show();
  for(let i=0;i<4;i++)audio.tone(listenStart+i*BEAT,.1,i===3?960:460,.22);
  for(let loop=0;loop<2;loop++)for(const [beat,value]of current.target.entries()){
   const attacks=catchAttacks(value);
   for(const offset of attacks)audio.tone(listenStart+(4+loop*4+beat+offset)*BEAT,BEAT/Math.max(1,attacks.length)*.65,660,.27);
  }
 }
 function available(){
  const counts={...inventory.counts};
  for(const value of current?.order||[])counts[value]--;
  return counts;
 }
 function affordableOrder(){
  const counts={...inventory.counts};
  current.order=current.order.filter(value=>counts[value]>0?(counts[value]--,true):false);
 }
 function assemble(){
  if(!current)return;
  phase='arrange';audio.stop();affordableOrder();
  title(`${current.name}’s rhythm`,'Use yellow cards from your inventory to write what you heard. You can listen again, undo, or collect more cards.');
  const slots=document.createElement('div');slots.className='rhythm-slots';slots.setAttribute('aria-label','Your NPC rhythm');
  for(let i=0;i<current.target.length;i++){
   const slot=document.createElement('span');slot.className='rhythm-slot';slot.innerHTML=current.order[i]===undefined?'<span>?</span>':noteSVG(current.order[i]);slots.append(slot);
  }
  dialog.append(slots);
  const tray=document.createElement('div');tray.className='rhythm-note-tray';const counts=available();
  for(const value of NOTE_VALUES){
   const count=counts[value]||0;
   const button=gameButton('',()=>{if(!paused&&phase==='arrange'&&current.order.length<4&&available()[value]>0){current.order.push(value);message='';assemble();}});
   button.innerHTML=noteSVG(value)+`<span>${noteName(value)} · ${count} saved</span>`;
   button.setAttribute('aria-label',`Add ${noteName(value)}`);button.disabled=!count||current.order.length>=4;tray.append(button);
  }
  dialog.append(tray);
  const status=document.createElement('p');status.setAttribute('role','status');
  status.textContent=message||(inventory.total?'Four cards fill one bar. Nothing is spent until your answer is correct.':'Your yellow-card inventory is empty. Catch some around town, then return to this neighbour.');dialog.append(status);
  actions(gameButton('Check my rhythm',check,'primary'),gameButton('Undo',()=>{current.order.pop();message='';assemble();}),gameButton('Hear it again',()=>void demo()),gameButton('Catch yellow notes',close));show();
 }
 function check(){
  if(phase!=='arrange'||!current||paused)return;
  if(current.order.length!==4){message='Choose four yellow cards to fill all four beats.';assemble();return;}
  if(!sameRhythm(current.order,current.target)){current.mistakes++;message='Not quite. Listen again, then try a different order. Your cards are still safe.';assemble();return;}
  if(!inventory.canSpend(current.order)){message='Some of those cards are no longer in your inventory. Catch more yellow notes, then try again.';assemble();return;}
  let saved=false;try{saved=inventory.spend(current.order,{npcId:current.id,stars:1});}catch{}
  if(!saved){message=inventory.error||journal.warning||'Your answer is right, but it could not be saved. Your cards have not been spent. Try again.';assemble();return;}
  phase='won';requests.delete(current.id);audio.stop();audio.tone(audio.time,.2,660);audio.tone(audio.time+.15,.3,990);
  title('That’s the rhythm!',`${current.name} thanks you! +1 town star · ${journal.data.stars} total. Four yellow cards were used.`);
  const notes=document.createElement('div');notes.className='rhythm-slots';
  for(const value of current.target){const slot=document.createElement('span');slot.className='rhythm-slot';slot.innerHTML=noteSVG(value);notes.append(slot);}dialog.append(notes);
  actions(gameButton('Back to town',close));show();
 }
 function tick(){
  if(phase!=='listen'||paused)return;
  const elapsed=audio.time-listenStart,count=Math.floor(elapsed/BEAT),node=dialog.querySelector('#npcRhythmCount');
  if(node){const text=count<0?'Get ready':count<4?['1','2','READY','GO!'][count]:'LISTEN';if(node.textContent!==text)node.textContent=text;}
  if(audio.time>=listenUntil)assemble();
 }
 function pause(){
  if(!['ready','sound','listen','arrange'].includes(phase))return;
  serial++;busy=false;audio.stop();audio.suspend();if(paused)return;
  paused=true;title('Rhythm request paused','Your yellow cards are safe. Continue when you’re ready.');
  actions(gameButton('Continue',async()=>{const ticket=serial;await audio.resume();if(ticket!==serial)return;paused=false;if(phase==='arrange')assemble();else void demo();},'primary'),gameButton('Catch yellow notes',close));show();
 }
 function keydown(event){
  if(phase==='idle')return false;
  const key=event.key.toLowerCase();
  if(key==='escape'){event.preventDefault();close();return true;}
  if(key==='r'&&!event.repeat&&!paused){event.preventDefault();void demo();return true;}
  return true;
 }
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 return {offer,start,tick,keydown,pause,end,get active(){return phase!=='idle';},get fullscreen(){return dialog.open;},get blocked(){return phase!=='idle';},get state(){return {phase,paused,actorId:current?.id||null,name:current?.name||null,target:current?[...current.target]:[],order:current?[...current.order]:[],mistakes:current?.mistakes||0,inventory:{...inventory.counts}};}};
}
