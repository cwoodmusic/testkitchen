import {createGame,NOTE_KINDS,NOTE_KIND_BY_ID,ROWS,COLUMNS} from './engine.mjs?v=rhythm-blocks-1';
import {symbolMarkup} from './notation.mjs?v=rhythm-blocks-1';
import {createRhythmAudio} from './audio.mjs?v=rhythm-blocks-1';

const $=id=>document.getElementById(id);
const colors={quarter:'#7dd9be','eighth-pair':'#8bcfe7','sixteenth-group':'#b9abf1',half:'#efc573',whole:'#eaa894',eighth:'#a99beb','quarter-rest':'#e4d6ae','half-rest':'#d5af81','whole-rest':'#d5a1af','dotted-half':'#e0a9d4'};
const BEST_KEY='codaRhythmBlocksBestV1',SOUND_KEY='codaRhythmBlocksSoundV1';
function read(key,fallback){try{return localStorage.getItem(key)??fallback;}catch{return fallback;}}
function save(key,value){try{localStorage.setItem(key,String(value));}catch{}}
let best=Math.max(0,Number(read(BEST_KEY,'0'))||0),soundEnabled=read(SOUND_KEY,'on')!=='off';
const audio=createRhythmAudio({enabled:soundEnabled}),game=createGame();
let seenRevision=-1,lastEvent=0,boardSignature='',state=game.state,lastFrame=performance.now(),feedbackTimer;
const held=new Map(),format=new Intl.NumberFormat('en-US');
const beatsText=value=>`${value===.5?'½':value} beat${value===1?'':'s'}`;
const paint=(element,kind)=>{element.style.setProperty('--tile-color',colors[kind]);element.innerHTML=symbolMarkup(kind);};
function tile(kind,row,col,classes=''){
 const element=document.createElement('div');element.className=`tile ${classes}`;element.dataset.kind=kind;element.style.setProperty('--row',row);element.style.setProperty('--col',col);paint(element,kind);return element;
}
function legend(){
 return NOTE_KINDS.map(kind=>`<div class="legend-row"><span class="legend-symbol" aria-hidden="true" style="--tile-color:${colors[kind.id]}">${symbolMarkup(kind.id)}</span><span class="legend-name">${kind.label}</span><span class="legend-beats">${beatsText(kind.beats)}</span></div>`).join('');
}
$('legend').innerHTML=legend();$('help-legend').innerHTML=legend();
function updateSound(){const button=$('sound');button.textContent=soundEnabled?'Sound on':'Sound off';button.setAttribute('aria-pressed',String(soundEnabled));}
updateSound();
function announce(message){$('announcement').textContent=message;}
function feedback(message){clearTimeout(feedbackTimer);$('feedback').textContent=message;feedbackTimer=setTimeout(()=>{$('feedback').textContent='Four beats to clear. Eight beats for a bonus.';},5000);}
function stopHeld(){for(const timer of held.values())clearTimeout(timer);held.clear();}
function update(){
 if(game.revision===seenRevision)return;
 seenRevision=game.revision;state=game.state;
 const clearing=new Set(state.clearingMatches.flatMap(pattern=>pattern.cells.map(cell=>`${cell.row}:${cell.col}`)));
 const signature=JSON.stringify(state.board)+[...clearing].join('|');
 if(signature!==boardSignature){
  boardSignature=signature;const fragment=document.createDocumentFragment();
  state.board.forEach((row,r)=>row.forEach((kind,c)=>{if(kind)fragment.append(tile(kind,r,c,`settled${clearing.has(`${r}:${c}`)?' clearing':''}`));}));
  $('settled').replaceChildren(fragment);
 }
 $('active').replaceChildren();$('ghost').replaceChildren();
 if(state.active){
  const {kind,row,col}=state.active;let landing=row;
  while(landing+1<ROWS&&!state.board[landing+1][col])landing++;
  if(landing>row)$('ghost').append(tile(kind,landing,col,'ghost'));
  $('active').append(tile(kind,row,col,'active'));
 }
 $('score').textContent=format.format(state.score);$('level').textContent=state.level;
 if(state.score>best){best=state.score;save(BEST_KEY,best);}
 $('best').textContent=format.format(best);$('progress').value=state.score%1000;
 $('level-hint').textContent=`${format.format(1000-state.score%1000)} points to level ${state.level+1}`;
 if(state.next){
  const kind=NOTE_KIND_BY_ID[state.next];paint($('next-symbol'),kind.id);$('next-symbol').style.background=colors[kind.id];$('next-label').textContent=kind.label;$('next-beats').textContent=beatsText(kind.beats);
 }else{paint($('next-symbol'),'quarter');$('next-label').textContent='Quarter note';$('next-beats').textContent='1 beat';}
 const running=!['idle','over'].includes(state.phase);
 $('pause').disabled=!running;$('pause').textContent=state.paused?'Resume':'Pause';$('restart').disabled=state.phase==='idle';
 $('overlay').hidden=running&&!state.paused;
 $('overlay-restart').hidden=!state.paused;
 if(state.paused){$('overlay-kicker').textContent='Take a breath';$('overlay-title').textContent='Paused';$('overlay-copy').textContent='Your rhythm will be right here when you’re ready.';$('primary-action').textContent='Resume';$('overlay-hint').textContent='P or Escape also resumes.';}
 else if(state.phase==='over'){$('overlay-kicker').textContent=`Level ${state.level} · ${format.format(state.score)} points`;$('overlay-title').textContent='That’s a wrap.';$('overlay-copy').textContent='The stack reached the top. Start a fresh board and find your next rhythm.';$('primary-action').textContent='Play again';$('overlay-hint').textContent=`Best score: ${format.format(best)}`;}
 for(const event of state.events){
  if(event.id<=lastEvent)continue;lastEvent=event.id;
  if(event.type==='clear'){
   const maxBeats=Math.max(...event.patterns.map(pattern=>pattern.units/2));
   const message=`${maxBeats} beats! +${format.format(event.points)}${event.chain>1?` · Chain ×${event.chain}`:''}${event.patterns.length>1?' · Combo!':''}`;
   feedback(message);announce(`${message}. Score ${state.score}.`);
   audio.playPattern([...event.patterns].sort((a,b)=>b.units-a.units)[0].kinds);
  }else if(event.type==='level'){feedback(`Level ${event.level} · Pick up the tempo`);announce(`Level ${event.level}. The blocks fall faster.`);}
  else if(event.type==='over'){audio.stop();stopHeld();announce(`Game over. ${state.score} points.`);$('primary-action').focus({preventScroll:true});}
 }
}
function begin(){stopHeld();audio.stop();void audio.unlock();game.start();lastFrame=performance.now();update();$('board').focus({preventScroll:true});feedback('Find four beats in a row or column.');}
function resume(){if($('help-dialog').open)return;void audio.unlock();game.resume();lastFrame=performance.now();update();$('board').focus({preventScroll:true});}
function pause(){stopHeld();audio.stop();game.pause();update();}
function togglePause(){if(state.paused)resume();else pause();}
function action(name){if($('help-dialog').open)return;if(name==='left')game.move(-1);if(name==='right')game.move(1);if(name==='down')game.softDrop();if(name==='drop')game.hardDrop();update();}
$('primary-action').addEventListener('click',()=>state.paused?resume():begin());
$('restart').addEventListener('click',begin);$('overlay-restart').addEventListener('click',begin);$('pause').addEventListener('click',togglePause);
$('sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;audio.setEnabled(soundEnabled);save(SOUND_KEY,soundEnabled?'on':'off');updateSound();if(soundEnabled)void audio.unlock();});
$('help').addEventListener('click',()=>{pause();$('help-dialog').showModal();});
function closeHelp(){$('help-dialog').close();if(state.paused)$('primary-action').focus({preventScroll:true});}
$('help-close').addEventListener('click',closeHelp);$('help-done').addEventListener('click',closeHelp);
$('help-dialog').addEventListener('cancel',()=>{stopHeld();});
$('exit').addEventListener('click',event=>{pause();void audio.suspend();if(window.parent!==window){event.preventDefault();window.parent.postMessage({coda:1,game:'rhythm-blocks',type:'close'},location.origin);}});
for(const button of document.querySelectorAll('[data-action]')){
 const name=button.dataset.action;
 button.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;event.preventDefault();button.setPointerCapture(event.pointerId);stopHeld();action(name);
  if(name!=='drop'&&!state.paused&&!['idle','over'].includes(state.phase)){
   const repeat=()=>{action(name);if(!held.has(button))return;held.set(button,setTimeout(repeat,name==='down'?65:100));};
   held.set(button,setTimeout(repeat,180));
  }
 });
 button.addEventListener('pointerup',stopHeld);button.addEventListener('pointercancel',stopHeld);button.addEventListener('lostpointercapture',stopHeld);
 // Keyboard/assistive-technology activation has no preceding pointerdown.
 button.addEventListener('click',event=>{if(event.detail===0)action(name);});
}
document.addEventListener('keydown',event=>{
 if(event.altKey||event.ctrlKey||event.metaKey||$('help-dialog').open)return;
 if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
 const key=event.key.toLowerCase();
 if((key===' '||key==='enter')&&event.target.closest('button,a'))return;
 const movement={arrowleft:'left',a:'left',arrowright:'right',d:'right',arrowdown:'down',s:'down',' ':'drop'};
 if(movement[key]){event.preventDefault();if(key===' '&&event.repeat)return;action(movement[key]);}
 else if(key==='p'||key==='escape'){event.preventDefault();if(!event.repeat)togglePause();}
 else if(key==='r'){event.preventDefault();if(!event.repeat)begin();}
 else if(key==='enter'){event.preventDefault();if(!event.repeat){if(state.phase==='idle'||state.phase==='over')begin();else if(state.paused)resume();}}
});
function backgroundPause(){pause();void audio.suspend();}
window.addEventListener('blur',backgroundPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)backgroundPause();});
window.addEventListener('pagehide',()=>{stopHeld();clearTimeout(feedbackTimer);void audio.destroy();});
Object.defineProperty(window,'rhythmBlocks',{value:Object.freeze({get state(){return game.state;},get columns(){return COLUMNS;},get rows(){return ROWS;}})});
function frame(now){const elapsed=Math.min(100,Math.max(0,now-lastFrame));lastFrame=now;if(game.tick(elapsed))update();requestAnimationFrame(frame);}
update();$('primary-action').focus({preventScroll:true});requestAnimationFrame(frame);
