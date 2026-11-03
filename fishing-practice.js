/* Practice setup selects a rhythm, then a challenge. The room owns playback. */
(function(root){
 'use strict';
 const METERS=[['4/4','4/4','Four steady beats'],['6/8','6/8','Two swaying beats'],['2/2','Cut time','Two big beats']];
 const TIERS=[['common','Common','Steady starts'],['uncommon','Uncommon','More eighth notes'],['rare','Rare','Offbeat rhythms'],['epic','Epic','Trickier patterns'],['legendary','Legendary','Faster, changing rhythms']];
 function createCodaFishingPractice(api={}){
  const host=api.host;if(!host)throw Error('Fishing practice needs a host.');
  const doc=host.ownerDocument,win=doc.defaultView||root,backdrop=doc.createElement('div');
  let opened=false,destroyed=false,priorFocus=null,meter='4/4',rarity='common',step=1;
  backdrop.id='fishingPracticeBackdrop';backdrop.className='fishing-practice-backdrop';backdrop.hidden=true;
  function beats(value){
   if(value==='6/8')return '<span class="fishing-practice-beats" aria-hidden="true">'+[1,2].map(n=>'<span class="fishing-practice-beat-group"><b class="fishing-practice-beat">'+n+'</b><i></i><i></i></span>').join('')+'</span>';
   return '<span class="fishing-practice-beats" aria-hidden="true">'+(value==='4/4'?[1,2,3,4]:[1,2]).map(n=>'<b class="fishing-practice-beat">'+n+'</b>').join('')+'</span>';
  }
  const meterChoices=METERS.map(([value,title,description])=>`<label class="fishing-practice-choice"><input type="radio" name="fishingPracticeMeter" value="${value}"><span><strong>${title}</strong><small class="fishing-practice-meter-detail">${value==='4/4'?'Four quarter-note beats':value==='6/8'?'Two groups of three':'2/2'}</small>${beats(value)}<small>${description}</small><span class="fishing-practice-selected" aria-hidden="true">✓</span></span></label>`).join('');
  const tierChoices=TIERS.map(([value,title,description],index)=>`<label class="fishing-practice-choice"><input type="radio" name="fishingPracticeRarity" value="${value}"><span><span class="fishing-practice-tier-dots" aria-hidden="true">${Array.from({length:5},(_,i)=>`<i class="${i<=index?'is-active':''}"></i>`).join('')}</span><span class="fishing-practice-choice-copy"><strong>${title}${index===0?'<span class="fishing-practice-recommended">Start here</span>':''}</strong><small>${description}</small></span><span class="fishing-practice-selected" aria-hidden="true">✓</span></span></label>`).join('');
  backdrop.innerHTML=`<section id="fishingPracticePanel" class="fishing-practice-panel" role="dialog" aria-modal="true" aria-labelledby="fishingPracticeTitle" aria-describedby="fishingPracticeIntro">
   <header class="fishing-practice-heading"><div><p class="fishing-practice-eyebrow">Rhythm fishing</p><h2 id="fishingPracticeTitle">Practice fishing</h2></div><button type="button" id="fishingPracticeClose" aria-label="Close practice settings">Close</button></header>
   <p id="fishingPracticeIntro">Pick the rhythm you want to try.</p>
   <ol class="fishing-practice-steps" aria-label="Practice setup"><li><span class="fishing-step-number">1</span>Pick a rhythm</li><li><span class="fishing-step-number">2</span>Choose a challenge</li></ol>
   <div class="fishing-practice-body">
    <fieldset id="fishingPracticeRhythms"><legend class="fishing-practice-step-title">Rhythm</legend><div class="fishing-practice-meters">${meterChoices}</div></fieldset>
    <fieldset id="fishingPracticeChallenges" hidden><legend class="fishing-practice-step-title">Challenge</legend><div class="fishing-practice-challenge-layout"><div class="fishing-practice-tiers">${tierChoices}</div><aside class="fishing-practice-summary" aria-label="Your practice"><p class="fishing-practice-summary-label">Your practice</p><h3 id="fishingPracticeSummaryRhythm"></h3><p id="fishingPracticeSummaryChallenge"></p><div class="fishing-practice-summary-picks"><span id="fishingPracticeSummaryMeter"></span><span id="fishingPracticeSummaryRarity"></span></div><p>Keep going for as long as you like.</p></aside></div></fieldset>
    <p id="fishingPracticeNote"><strong>Missed a note? Keep going.</strong><br>Practice does not add fish or prizes.</p>
   </div>
   <footer class="fishing-practice-footer"><button type="button" id="fishingPracticeBack">← Back to fishing</button><button type="button" id="fishingPracticeNext">Next: choose a challenge →</button><button type="button" id="fishingPracticeStart" hidden>Start practice →</button></footer>
  </section>`;
  host.append(backdrop);
  const el=id=>backdrop.querySelector('#'+id),panel=el('fishingPracticePanel'),start=el('fishingPracticeStart'),next=el('fishingPracticeNext'),back=el('fishingPracticeBack'),closeButton=el('fishingPracticeClose');
  function sync(){
   for(const input of backdrop.querySelectorAll('input'))input.checked=input.value===(input.name==='fishingPracticeMeter'?meter:rarity);
   const rhythm=METERS.find(choice=>choice[0]===meter),challenge=TIERS.find(choice=>choice[0]===rarity);
   panel.dataset.step=String(step);el('fishingPracticeRhythms').hidden=step!==1;el('fishingPracticeChallenges').hidden=step!==2;
   next.hidden=step!==1;start.hidden=step!==2;el('fishingPracticeNote').hidden=step!==1;
   back.textContent=step===1?'← Back to fishing':'← Back to rhythms';
   el('fishingPracticeIntro').textContent=step===1?'Pick the rhythm you want to try.':'Choose a challenge. You can change it later.';
   for(const [index,item]of [...backdrop.querySelectorAll('.fishing-practice-steps li')].entries()){
    if(index+1===step)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');
    item.querySelector('.fishing-step-number').textContent=step===2&&index===0?'✓':String(index+1);
   }
   el('fishingPracticeSummaryRhythm').textContent=rhythm[2];el('fishingPracticeSummaryChallenge').textContent=challenge[2];
   el('fishingPracticeSummaryMeter').textContent=meter==='2/2'?'Cut time · 2/2':meter;el('fishingPracticeSummaryRarity').textContent=challenge[1];
  }
  function selectedInput(){return backdrop.querySelector('input[name="'+(step===1?'fishingPracticeMeter':'fishingPracticeRarity')+'"]:checked');}
  function focusChoice(){const input=selectedInput();input?.focus({preventScroll:true});input?.closest('.fishing-practice-choice')?.scrollIntoView({block:'nearest',inline:'nearest'});}
  function setStep(value){
   if(!opened||![1,2].includes(value))return;
   step=value;sync();backdrop.querySelector('.fishing-practice-body').scrollTop=0;focusChoice();
  }
  // Preserve the existing parent API; menu navigation never starts or unpauses fishing.
  function getState(){return{open:opened,meter,rarity};}
  function open(options={}){
   if(destroyed)return false;
   if(METERS.some(choice=>choice[0]===options.meter))meter=options.meter;
   if(TIERS.some(choice=>choice[0]===options.rarity))rarity=options.rarity;
   if(opened){sync();return true;}
   priorFocus=doc.activeElement;opened=true;step=1;sync();backdrop.hidden=false;
   backdrop.querySelector('.fishing-practice-body').scrollTop=0;
   api.onOpen?.(getState());focusChoice();return true;
  }
  function close(options={}){
   if(!opened)return false;
   opened=false;backdrop.hidden=true;
   if(options.notify!==false)api.onClose?.({...getState(),reason:options.reason||'close'});
   if(options.restoreFocus!==false&&priorFocus?.isConnected&&!backdrop.contains(priorFocus))priorFocus.focus({preventScroll:true});return true;
  }
  function change(event){
   if(event.target.name==='fishingPracticeMeter'&&METERS.some(choice=>choice[0]===event.target.value))meter=event.target.value;
   if(event.target.name==='fishingPracticeRarity'&&TIERS.some(choice=>choice[0]===event.target.value))rarity=event.target.value;
   sync();if(opened)event.target.closest?.('.fishing-practice-choice')?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function visibleControls(){return[closeButton,selectedInput(),back,step===1?next:start].filter(node=>node&&!node.disabled&&node.getClientRects().length);}
  function keydown(event){
   if(!opened)return;
   // Keys stay inside the setup while the previous lake/boat session is paused.
   event.stopPropagation();
   if(event.key==='Escape'){event.preventDefault();if(step===2)setStep(1);else close();return;}
   if(event.key!=='Tab')return;
   const controls=visibleControls(),first=controls[0],last=controls.at(-1);
   if(!controls.includes(doc.activeElement)){event.preventDefault();(event.shiftKey?last:first)?.focus();}
   else if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}
  }
  function begin(){if(!opened||step!==2)return;const selected={meter,rarity};close({reason:'start',restoreFocus:false});api.onStart?.(selected);}
  function outside(event){if(event.target===backdrop){event.preventDefault();event.stopPropagation();close();}}
  function backClick(){if(step===2)setStep(1);else close();}
  function nextClick(){setStep(2);}
  function closeClick(){close();}
  backdrop.addEventListener('change',change);backdrop.addEventListener('click',outside);
  start.addEventListener('click',begin);next.addEventListener('click',nextClick);back.addEventListener('click',backClick);closeButton.addEventListener('click',closeClick);win.addEventListener('keydown',keydown,{capture:true});
  function destroy(){if(destroyed)return;close({notify:false,restoreFocus:false});destroyed=true;backdrop.removeEventListener('change',change);backdrop.removeEventListener('click',outside);start.removeEventListener('click',begin);next.removeEventListener('click',nextClick);back.removeEventListener('click',backClick);closeButton.removeEventListener('click',closeClick);win.removeEventListener('keydown',keydown,{capture:true});backdrop.remove();}
  sync();return{open,close,getState,destroy};
 }
 if(root)root.createCodaFishingPractice=createCodaFishingPractice;
})(typeof window==='undefined'?null:window);
