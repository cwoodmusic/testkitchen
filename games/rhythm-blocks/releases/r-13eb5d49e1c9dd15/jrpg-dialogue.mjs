/** Wrapped pixel text. The full glyph rows are laid out once; only clipping moves. */
export function wrapDialogue(text,columns){
 const chars=Array.from(String(text??'')),width=Math.max(1,Math.floor(columns)||1),rows=[];
 let start=0;
 while(start<chars.length){
  let end=Math.min(chars.length,start+width),newline=chars.indexOf('\n',start);
  if(newline>=start&&newline<end)end=newline+1;
  else if(end<chars.length&&chars[end]!=='\n'){
   for(let index=end-1;index>start;index--)if(/\s/.test(chars[index])){end=index+1;break;}
  }
  rows.push({text:chars.slice(start,end).join('').replace(/\n$/,''),start,end});start=end;
 }
 return rows.length?rows:[{text:'',start:0,end:0}];
}

/** A quiet speaking cadence: words flow, punctuation has room to breathe. */
export function dialogueRevealTimes(value){
 const chars=Array.from(String(value??'')),times=[];let elapsed=0;
 for(let index=0;index<chars.length;index++){
  if(index){
   const previous=chars[index-1],current=chars[index];
   elapsed+=/[.!?]/.test(previous)&&/[.!?]/.test(current)?48:/[.!?]/.test(previous)?240:previous==='…'?320:/[,;:]/.test(previous)?120:/[—–]/.test(previous)?140:/\s/.test(previous)?18:32;
  }
  times.push(elapsed);
 }
 return times;
}
export function dialogueDurationMs(value){return dialogueRevealTimes(value).at(-1)??0;}
function revealedAt(times,elapsed){let low=0,high=times.length;while(low<high){const middle=(low+high)>>1;if(times[middle]<=elapsed)low=middle+1;else high=middle;}return low;}

export function createJrpgDialogue({panel,line}){
 const document=line.ownerDocument,window=document.defaultView;
 const visual=document.createElement('span'),live=document.createElement('span');
 visual.className='jrpg-glyph-rows';visual.setAttribute('aria-hidden','true');
 live.className='jrpg-sr-line';live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');
 const previousLive=line.getAttribute('aria-live');line.setAttribute('aria-live','off');line.classList.add('jrpg-dialogue-line');line.replaceChildren(visual,live);
 const context=document.createElement('canvas').getContext('2d');
 let text='',prefix='',prefixLength=0,characters=[],revealTimes=[],rows=[],nodes=[],visible=0,elapsed=0,forced=false,disposed=false,width=0,lineHeight=30,lastScrollRow=-1;
 function paint(force=false){
  if(disposed)return;
  const amount=forced?characters.length:revealedAt(revealTimes,elapsed),displayed=prefixLength+amount;
  if(!force&&amount===visible)return;
  visible=amount;
  for(let index=0;index<rows.length;index++){
   const length=Array.from(rows[index].text).length,count=Math.max(0,Math.min(length,displayed-rows[index].start));
   const clip=count>=length?'none':`inset(0 calc(100% - ${count}ch) 0 0)`;
   if(nodes[index].style.clipPath!==clip)nodes[index].style.clipPath=clip;
  }
  let currentRow=0;
  for(let index=0;index<rows.length;index++)if(displayed>rows[index].start)currentRow=index;
  const scrollRow=Math.max(0,currentRow-2);
  if(scrollRow!==lastScrollRow){lastScrollRow=scrollRow;line.scrollTop=scrollRow*lineHeight;}
  for(const [name,value]of Object.entries({textComplete:String(amount>=characters.length),visibleCharacters:String(amount),totalCharacters:String(characters.length)}))if(line.dataset[name]!==value)line.dataset[name]=value;
 }
 function layout(nextWidth){
  if(disposed)return;
  const style=window.getComputedStyle(line),fontSize=parseFloat(style.fontSize)||20;
  width=Math.max(1,nextWidth??line.clientWidth);lineHeight=parseFloat(style.lineHeight)||fontSize*1.5;
  context.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const advance=context.measureText('0').width||fontSize*.5;
  rows=wrapDialogue(prefix+text,Math.max(1,Math.floor((width-3)/advance)));
  nodes=rows.map(row=>{const node=document.createElement('span');node.className='jrpg-glyph-row';node.textContent=row.text||'\u200b';return node;});
  visual.replaceChildren(...nodes);lastScrollRow=-1;paint(true);
 }
 function setLine(value){
  if(disposed)return;
  text=String(value??'');characters=Array.from(text);revealTimes=dialogueRevealTimes(text);elapsed=0;forced=false;visible=0;
  const name=panel.querySelector('#cutscene-speaker')?.textContent?.trim()??'';
  prefix=text&&name?`${name.toLocaleUpperCase()}: `:'';prefixLength=Array.from(prefix).length;
  live.textContent=text&&name?`${name}: ${text}`:text;layout();
 }
 function update(value){if(disposed)return;if(typeof value==='number'&&Number.isFinite(value))elapsed=Math.max(0,value);paint();}
 function revealAll(){if(disposed)return false;const changed=visible<characters.length;forced=true;paint();return changed;}
 let observer=null;
 if(window.ResizeObserver){observer=new window.ResizeObserver(entries=>{const next=entries[0]?.contentRect.width;if(Number.isFinite(next)&&next>0&&Math.abs(next-width)>.5)layout(next);});observer.observe(line);}
 const fontReady=()=>{if(!disposed)layout();};
 document.fonts?.ready.then(fontReady);
 document.fonts?.addEventListener('loadingdone',fontReady);
 document.fonts?.load('20px QuietBellBlock').then(fontReady).catch(()=>{});
 return Object.freeze({setLine,update,revealAll,get state(){return Object.freeze({complete:visible>=characters.length,visibleCharacters:visible,totalCharacters:characters.length,rows:rows.length});},destroy(){if(disposed)return;disposed=true;observer?.disconnect();document.fonts?.removeEventListener('loadingdone',fontReady);line.replaceChildren();line.classList.remove('jrpg-dialogue-line');if(previousLive===null)line.removeAttribute('aria-live');else line.setAttribute('aria-live',previousLive);}});
}
