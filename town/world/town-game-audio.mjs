import {normalizeYellowNotes,normalizeNPCRhythmWins} from './note-inventory.mjs?v=town-store-halls-1';
export function noteSVG(value){
 if(value==='quarter-rest')return '<svg viewBox="0 0 80 64" aria-hidden="true"><path d="M37 6L47 19L36 30L46 40Q28 36 37 56Q18 46 30 34L39 29L29 18Z" fill="currentColor"/></svg>';
 const group=value==='eighth-pair'?2:value==='sixteenth-group'?4:0;
 if(group){const xs=group===2?[19,55]:[10,28,46,64];return `<svg viewBox="0 0 80 64" aria-hidden="true">${xs.map(x=>`<ellipse cx="${x}" cy="47" rx="7" ry="5" transform="rotate(-20 ${x} 47)" fill="currentColor"/><path d="M${x+6} 46V12" stroke="currentColor" stroke-width="3"/>`).join('')}<path d="M${xs[0]+6} 12H${xs.at(-1)+6}${group===4?` M${xs[0]+6} 20H${xs.at(-1)+6}`:''}" stroke="currentColor" stroke-width="5"/></svg>`;}
 return `<svg viewBox="0 0 52 64" aria-hidden="true"><ellipse cx="18" cy="46" rx="10" ry="7" transform="rotate(-20 18 46)" fill="${value===2?'none':'currentColor'}" stroke="currentColor" stroke-width="3"/><path d="M27 44V8${value===.5?' Q49 17 33 31':''}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`;
}
export const noteName=v=>({'quarter':'Quarter note','eighth-pair':'Two eighth notes','sixteenth-group':'Four sixteenth notes','quarter-rest':'Quarter rest'}[v]||(v===.5?'Eighth note':v===1?'Quarter note':'Half note'));
export function createGameAudio(){
 let context=null;const voices=new Set();
 return {async unlock(){try{context??=new (window.AudioContext||window.webkitAudioContext)();await context.resume();return context.state==='running';}catch{return false;}},get time(){return context?.currentTime||0;},tone(at,duration=.12,frequency=660,volume=.2){
  if(!context)return;const o=context.createOscillator(),g=context.createGain();o.type='sine';o.frequency.value=frequency;g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(volume,at+.008);g.gain.exponentialRampToValueAtTime(.0001,at+Math.max(.03,duration));o.connect(g);g.connect(context.destination);o.start(at);o.stop(at+Math.max(.04,duration)+.02);voices.add(o);o.onended=()=>{voices.delete(o);o.disconnect();g.disconnect();};
 },stop(){for(const o of voices)try{o.stop();}catch{}voices.clear();},suspend(){void context?.suspend();},async resume(){try{await context?.resume();}catch{}},destroy(){this.stop();void context?.close();context=null;}};
}
export function createTownJournal(getOwner=()=> 'guest'){
 let owner,record,warning='';
 function load(){const id=getOwner();if(id===owner&&record)return record;owner=id;record={version:1,stars:0,netWins:0,fish:{},yellowNotes:normalizeYellowNotes(),npcRhythmWins:{}};warning='';if(!id)return record;try{const raw=localStorage.getItem('codaTownAdventuresV1:'+id);if(raw){const d=JSON.parse(raw);if(d.version===1&&Number.isFinite(d.stars)&&d.stars>=0&&d.fish&&typeof d.fish==='object'&&!Array.isArray(d.fish)){const fish={};for(const [key,item]of Object.entries(d.fish).slice(0,200))if(/^[a-z0-9-]+$/.test(key)&&item&&Number.isFinite(item.count)&&item.count>0&&Number.isFinite(item.best)&&item.best>=0)fish[key]={count:Math.min(1e6,Math.floor(item.count)),best:Math.min(2000,item.best)};record={version:1,stars:Math.min(1e7,Math.floor(d.stars)),netWins:Number.isFinite(d.netWins)?Math.min(1e7,Math.max(0,Math.floor(d.netWins))):0,fish,yellowNotes:normalizeYellowNotes(d.yellowNotes),npcRhythmWins:normalizeNPCRhythmWins(d.npcRhythmWins)};}else warning='Progress could not be read.';}}catch{warning='Progress could not be read.';}return record;}
 return {get data(){return load();},get warning(){return warning;},save(){load();if(!owner){warning='Open town with an active player to save progress.';return false;}try{localStorage.setItem('codaTownAdventuresV1:'+owner,JSON.stringify(record));warning='';return true;}catch{warning='This device could not save progress.';return false;}}};
}
export function mountGameStyles(){if(document.getElementById('townGameStyles'))return;const link=document.createElement('link');link.id='townGameStyles';link.rel='stylesheet';link.href=new URL('./town-games.css?v=town-store-halls-1',import.meta.url).href;document.head.append(link);}
export function gameButton(label,fn,className=''){const b=document.createElement('button');b.type='button';b.className=className;b.textContent=label;b.onclick=fn;return b;}
export function drawNote(c,value,x,y,size=1){c.save();c.translate(x,y);c.scale(size,size);c.lineWidth=3;c.beginPath();c.ellipse(-3,8,10,7,-.3,0,Math.PI*2);if(value===2)c.stroke();else c.fill();if(value===1.5){c.beginPath();c.arc(17,8,3,0,Math.PI*2);c.fill();}c.beginPath();c.moveTo(6,7);c.lineTo(6,-28);if(value===.5)c.quadraticCurveTo(28,-16,13,-5);c.stroke();c.restore();}

export function drawCatchNote(c,value,x,y,size=1){
 c.save();c.translate(x,y);c.scale(size,size);
 if(value==='quarter-rest'){c.beginPath();c.moveTo(-3,-28);c.lineTo(8,-15);c.lineTo(-4,-4);c.lineTo(7,6);c.quadraticCurveTo(-13,0,-3,24);c.quadraticCurveTo(-23,12,-10,0);c.lineTo(0,-6);c.lineTo(-12,-18);c.closePath();c.fill();}
 else{const xs=value==='eighth-pair'?[-16,14]:value==='sixteenth-group'?[-27,-9,9,27]:[0];for(const xx of xs){c.beginPath();c.ellipse(xx-4,12,7,5,-.3,0,Math.PI*2);c.fill();c.lineWidth=3;c.beginPath();c.moveTo(xx+2,12);c.lineTo(xx+2,-22);c.stroke();}if(xs.length>1){c.lineWidth=5;for(const yy of value==='sixteenth-group'?[-22,-14]:[-22]){c.beginPath();c.moveTo(xs[0]+2,yy);c.lineTo(xs.at(-1)+2,yy);c.stroke();}}}
 c.restore();
}
