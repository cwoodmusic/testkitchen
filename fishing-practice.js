/* Endless fishing practice settings; the room owns the actual rhythm session. */
(function(root){
 'use strict';
 const METERS=[['4/4','4/4','Four steady beats'],['6/8','6/8','Two swaying beats'],['2/2','Cut time','Two big beats']];
 const TIERS=[['common','Common','Steady starts'],['uncommon','Uncommon','More eighth notes'],['rare','Rare','Offbeat rhythms'],['epic','Epic','Tricky patterns'],['legendary','Legendary','The fastest rhythms']];
 function createCodaFishingPractice(api={}){
  const host=api.host;if(!host)throw Error('Fishing practice needs a host.');
  const doc=host.ownerDocument,win=doc.defaultView||root,backdrop=doc.createElement('div');
  let opened=false,destroyed=false,priorFocus=null,meter='4/4',rarity='common';
  backdrop.id='fishingPracticeBackdrop';backdrop.className='fishing-practice-backdrop';backdrop.hidden=true;
  const choices=(name,values)=>values.map(([value,title,description])=>`<label class="fishing-practice-choice"><input type="radio" name="${name}" value="${value}"><span><strong>${title}</strong><small>${description}</small></span></label>`).join('');
  backdrop.innerHTML=`<section id="fishingPracticePanel" class="fishing-practice-panel" role="dialog" aria-modal="true" aria-labelledby="fishingPracticeTitle" aria-describedby="fishingPracticeIntro">
   <div class="fishing-practice-heading"><h2 id="fishingPracticeTitle">Practice fishing</h2><button type="button" id="fishingPracticeClose" aria-label="Close practice settings">Back</button></div>
   <p id="fishingPracticeIntro">Pick a rhythm and keep going for as long as you like. The fish stays with you, even when you miss.</p>
   <div class="fishing-practice-options"><fieldset><legend>Meter</legend><div class="fishing-practice-meters">${choices('fishingPracticeMeter',METERS)}</div></fieldset>
   <fieldset><legend>Difficulty</legend><div class="fishing-practice-tiers">${choices('fishingPracticeRarity',TIERS)}</div></fieldset></div>
   <div class="fishing-practice-footer"><p>No catches, Notes, or XP. <br>Just you and the rhythm.</p><button type="button" id="fishingPracticeStart">Start practice</button></div>
  </section>`;
  host.append(backdrop);
  const panel=backdrop.querySelector('#fishingPracticePanel'),start=backdrop.querySelector('#fishingPracticeStart'),back=backdrop.querySelector('#fishingPracticeClose');
  function sync(){for(const input of backdrop.querySelectorAll('input'))input.checked=input.value===(input.name==='fishingPracticeMeter'?meter:rarity);}
  function getState(){return{open:opened,meter,rarity};}
  function open(options={}){
   if(destroyed)return false;
   if(METERS.some(choice=>choice[0]===options.meter))meter=options.meter;
   if(TIERS.some(choice=>choice[0]===options.rarity))rarity=options.rarity;
   sync();if(opened)return true;
   priorFocus=doc.activeElement;opened=true;backdrop.hidden=false;
   api.onOpen?.(getState());
   backdrop.querySelector('input[name="fishingPracticeMeter"]:checked').focus({preventScroll:true});
   return true;
  }
  function close(options={}){
   if(!opened)return false;
   opened=false;backdrop.hidden=true;
   if(options.notify!==false)api.onClose?.({...getState(),reason:options.reason||'close'});
   if(options.restoreFocus!==false&&priorFocus?.isConnected&&!backdrop.contains(priorFocus))priorFocus.focus({preventScroll:true});
   return true;
  }
  function change(event){
   if(event.target.name==='fishingPracticeMeter'&&METERS.some(choice=>choice[0]===event.target.value))meter=event.target.value;
   if(event.target.name==='fishingPracticeRarity'&&TIERS.some(choice=>choice[0]===event.target.value))rarity=event.target.value;
  }
  function keydown(event){
   if(!opened)return;
   // Arrow keys and Space belong to these choices while the settings are open.
   event.stopPropagation();
   if(event.key==='Escape'){event.preventDefault();close();return;}
   if(event.key!=='Tab')return;
   const controls=[back,...backdrop.querySelectorAll('input:checked'),start],first=controls[0],last=controls.at(-1);
   if(!panel.contains(doc.activeElement)){event.preventDefault();(event.shiftKey?last:first).focus();}
   else if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}
  }
  function begin(){const selected={meter,rarity};close({reason:'start',restoreFocus:false});api.onStart?.(selected);}
  function outside(event){if(event.target===backdrop){event.preventDefault();event.stopPropagation();close();}}
  function backClick(){close();}
  backdrop.addEventListener('change',change);backdrop.addEventListener('click',outside);
  start.addEventListener('click',begin);back.addEventListener('click',backClick);win.addEventListener('keydown',keydown,{capture:true});
  function destroy(){if(destroyed)return;close({notify:false,restoreFocus:false});destroyed=true;backdrop.removeEventListener('change',change);backdrop.removeEventListener('click',outside);start.removeEventListener('click',begin);back.removeEventListener('click',backClick);win.removeEventListener('keydown',keydown,{capture:true});backdrop.remove();}
  sync();return{open,close,getState,destroy};
 }
 if(root)root.createCodaFishingPractice=createCodaFishingPractice;
})(typeof window==='undefined'?null:window);
