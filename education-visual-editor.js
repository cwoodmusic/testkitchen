/* Plain-data pictures for teaching cards, questions, and lesson instructions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaEducationVisualEditor=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const copy=value=>value===undefined?null:JSON.parse(JSON.stringify(value));
 const WHITE=['C','D','E','F','G','A','B','C'];
 const KEYS=[['C',0],['C-sharp',1],['D',2],['D-sharp',3],['E',4],['F',5],['F-sharp',6],['G',7],['G-sharp',8],['A',9],['A-sharp',10],['B',11]];
 const FLATS={'C-sharp':'D-flat','D-sharp':'E-flat','F-sharp':'G-flat','G-sharp':'A-flat','A-sharp':'B-flat'},PITCH={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
 const pitch=note=>(PITCH[note[0]]+(note.endsWith('-sharp')?1:note.endsWith('-flat')?-1:0)+12)%12;
 const printed=note=>note.replace('-sharp','♯').replace('-flat','♭');
 function mount(api={}){
  const host=api.host;if(!host?.ownerDocument)throw Error('A visual editor needs a host.');
  const doc=host.ownerDocument,win=doc.defaultView;let value=copy(api.value),destroyed=false,notationEditor=null,spelling=value?.notes?.some(note=>note.endsWith('-flat'))?'flat':'sharp';
  const root=doc.createElement('section');root.className='education-visual-editor';root.dataset.visualEditor=api.prefix||'visual';root.setAttribute('aria-label',api.label||'Lesson visual');host.append(root);
  const canEdit=()=>{try{return !destroyed&&api.canEdit?.()!==false;}catch{return false;}};
  const node=(tag,className,text)=>{const item=doc.createElement(tag);if(className)item.className=className;if(text!==undefined)item.textContent=text;return item;};
  function select(parent,label,name,choices,current,action){
   const wrap=node('label','education-visual-field'),title=node('span','',label),control=node('select');control.dataset.visualField=name;control.setAttribute('aria-label',label);control.disabled=!canEdit();
   for(const [key,text]of choices){const option=node('option','',text);option.value=key;control.append(option);}control.value=current;
   control.onchange=()=>{if(!canEdit()){render();return;}action(control.value);};wrap.append(title,control);parent.append(wrap);return control;
  }
  function button(parent,label,name,action){const item=node('button','',label);item.type='button';if(name)item.dataset.visualAction=name;item.disabled=!canEdit();item.onclick=()=>{if(canEdit())action();else render();};parent.append(item);return item;}
  function emit(next,rerender=true){
   if(!canEdit())return false;const before=copy(value);value=copy(next);
   if(api.onChange?.(copy(value))===false){value=before;if(rerender)render();return false;}
   if(rerender)render();return true;
  }
  function typeOf(){if(!value)return 'none';if(value.kind==='notation'||value.kind==='staff'||value.kind==='middle-c-pair')return 'notation';if(value.kind==='keyboard')return 'keyboard';if(value.kind==='clef-intro')return 'clef';if(value.kind==='piano')return 'legacy-piano';if(['note-parts','rhythm-tree'].includes(value.kind))return value.kind;return 'existing';}
  function changeType(type){
   if(type===typeOf())return;
   if(type==='none')emit(null);
   else if(type==='keyboard')emit({kind:'keyboard',notes:[]});
   else if(type==='clef')emit({kind:'clef-intro',clef:'treble',page:'clef'});
   else if(type==='notation'){
    const component=win.CodaEducationNotation;if(!component)return;
    emit({kind:'notation',score:component.fromVisual(value||{kind:'staff',clef:'treble',position:0})});
   }
  }
  function renderKeyboard(parent){
   const tools=node('div','education-visual-toolbar');
   select(tools,'Black-key names','keyboard-spelling',[['sharp','Sharps: C♯, D♯, F♯, G♯, A♯'],['flat','Flats: D♭, E♭, G♭, A♭, B♭']],spelling,next=>{
    spelling=next;emit({...value,notes:(value.notes||[]).map(note=>{const key=KEYS.find(([,at])=>at===pitch(note))?.[0];return next==='flat'&&FLATS[key]?FLATS[key]:key;})});
   });parent.append(tools);
   parent.append(node('p','education-visual-help','Choose keys to highlight. Leave every key unselected for a neutral keyboard reference.'));
   const keys=node('div','education-visual-keys');keys.setAttribute('role','group');keys.setAttribute('aria-label','Keys to highlight');const selected=new Set((value.notes||[]).map(pitch));
   for(const [key,at]of KEYS){const name=spelling==='flat'&&FLATS[key]?FLATS[key]:key,item=button(keys,printed(name),null,()=>{
    const notes=(value.notes||[]).filter(note=>pitch(note)!==at);if(!selected.has(at))notes.push(name);emit({...value,notes});
   });item.dataset.visualKey=key;item.setAttribute('aria-label','Highlight '+printed(name));item.setAttribute('aria-pressed',String(selected.has(at)));if(FLATS[key])item.classList.add('is-black-key');}parent.append(keys);
   button(parent,'Clear key highlights','clear-keys',()=>emit({...value,notes:[]}));
   const options=node('details','education-visual-caption-options'),summary=node('summary','','Keyboard text and labels');summary.dataset.visualAction='keyboard-text-options';options.append(summary);
   const fields=node('div','education-visual-caption-fields');options.append(fields);
   for(const [field,name,text]of [['showLabels','keyboard-show-labels','Show note names on keys'],['showGroups','keyboard-show-groups','Show black-key group captions'],['showDirections','keyboard-show-directions','Show direction captions']]){
    const wrap=node('label','education-visual-toggle'),toggle=node('input');toggle.type='checkbox';toggle.dataset.visualField=name;toggle.checked=value[field]!==false;toggle.disabled=!canEdit();toggle.onchange=()=>{if(!canEdit()){render();return;}const open=options.open;if(emit({...value,[field]:toggle.checked}))root.querySelector('.education-visual-caption-options').open=open;};wrap.append(toggle,doc.createTextNode(text));fields.append(wrap);
   }
   function caption(label,name,group,key,defaults){
    const wrap=node('label','education-visual-field'),title=node('span','',label),input=node('input');input.type='text';input.maxLength=80;input.value=value[group]?.[key]??defaults[key];input.dataset.visualField=name;input.setAttribute('aria-label',label);input.disabled=!canEdit();
    input.oninput=()=>{if(!canEdit()){input.value=value[group]?.[key]??defaults[key];return;}emit({...value,[group]:{...defaults,...value[group],[key]:input.value}},false);drawPreview();};wrap.append(title,input);fields.append(wrap);
   }
   caption('Two-black-key caption','keyboard-two-label','groupLabels','two',{two:'2 black keys',three:'3 black keys'});
   caption('Three-black-key caption','keyboard-three-label','groupLabels','three',{two:'2 black keys',three:'3 black keys'});
   caption('Left direction caption','keyboard-lower-label','directionLabels','lower',{lower:'Lower sounds',higher:'Higher sounds'});
   caption('Right direction caption','keyboard-higher-label','directionLabels','higher',{lower:'Lower sounds',higher:'Higher sounds'});
   parent.append(options);
   const label=node('label','education-visual-field'),title=node('span','','Picture description'),input=node('input');input.type='text';input.maxLength=300;input.value=value.label||'';input.placeholder='Optional description for this keyboard';input.dataset.visualField='keyboard-label';input.setAttribute('aria-label','Keyboard picture description');input.disabled=!canEdit();
   input.oninput=()=>{if(!canEdit()){input.value=value.label||'';return;}const next={...value};if(input.value.trim())next.label=input.value;else delete next.label;emit(next,false);drawPreview();};label.append(title,input);parent.append(label);
  }
  function renderLegacyPiano(parent){
   parent.append(node('p','education-visual-help','Choose the gold key shown by this existing piano question. The two C keys are separate.'));
   const keys=node('div','education-visual-keys');keys.setAttribute('role','group');keys.setAttribute('aria-label','Gold piano key');
   WHITE.forEach((letter,index)=>{const label=letter+(letter==='C'?(index===0?' · lower':' · higher'):'');const item=button(keys,label,null,()=>emit({kind:'piano',target:index}));item.dataset.visualPianoTarget=String(index);item.setAttribute('aria-pressed',String(value.target===index));});parent.append(keys);
  }
  function drawPreview(){
   const preview=root.querySelector('[data-visual-preview]');if(!preview)return;preview.replaceChildren();if(!value||typeOf()==='notation')return;
   if(value.kind==='keyboard'&&win.CodaClassroomKeyboard){preview.innerHTML=win.CodaClassroomKeyboard.toSVG(value);return;}
   if(value.kind==='piano'){
    let keys='';WHITE.forEach((letter,index)=>{keys+='<rect x="'+(index*50+1)+'" y="15" width="48" height="104" rx="3" fill="'+(index===value.target?'#f5d98d':'#faf6e8')+'" stroke="#59445d"/><text x="'+(index*50+25)+'" y="107" text-anchor="middle" fill="#263b42" font-size="19" font-family="system-ui,sans-serif">'+letter+'</text>';});for(const boundary of [1,2,4,5,6])keys+='<rect x="'+(boundary*50-14)+'" y="15" width="28" height="57" rx="2" fill="#29233b"/>';
    preview.innerHTML='<svg viewBox="0 0 400 125" role="img" aria-label="Piano keyboard. The chosen key is gold.">'+keys+'</svg>';return;
   }
   if(win.CodaClassroomLearningPaths?.renderVisual?.(preview,value)===true)return;
   if(value.kind==='clef-intro'&&win.CodaClassroomTutorials?.clefReminderSVG){preview.innerHTML=win.CodaClassroomTutorials.clefReminderSVG(value.clef,value.page);win.CodaMusicNotation?.load?.(doc);return;}
   if(value.kind==='note'&&win.CodaMusicNotation){preview.innerHTML=win.CodaMusicNotation.glyphSVG(value.beats,{rest:value.rest===true});return;}
   if(value.kind==='scale'){for(const note of value.notes||[])preview.append(node('span','',printed(note)));return;}
   if(value.kind==='notation'&&win.CodaEducationNotation){preview.innerHTML=win.CodaEducationNotation.toSVG(value.score);return;}
   preview.append(node('p','education-visual-help','The existing '+String(value.kind||'lesson')+' picture is preserved. Choose a visual above to replace it.'));
  }
  function render(){
   if(destroyed)return;notationEditor?.destroy();notationEditor=null;root.replaceChildren();const current=typeOf(),choices=[['none','None'],['notation','Notes & staff'],['clef','Clef'],['keyboard','Piano keyboard']];
   if(current==='legacy-piano')choices.push(['legacy-piano','Existing piano question']);else if(current==='note-parts')choices.push(['note-parts','Note parts']);else if(current==='rhythm-tree')choices.push(['rhythm-tree','Rhythm tree']);else if(current==='existing')choices.push(['existing','Existing illustration']);
   select(root,api.label||'Visual','type',choices,current,changeType);const controls=node('div','education-visual-controls');root.append(controls);
   if(current==='keyboard')renderKeyboard(controls);
   else if(current==='legacy-piano')renderLegacyPiano(controls);
   else if(current==='clef'){
    select(controls,'Clef','clef',[['treble','Treble'],['bass','Bass']],value.clef,next=>emit({...value,clef:next}));
    select(controls,'Clef picture','clef-page',[['clef','Clef sign'],['staff','Five-line staff'],['lines','Numbered lines'],['spaces','Numbered spaces']],value.page,next=>emit({...value,page:next}));
   }else if(current==='notation'){
    const component=win.CodaEducationNotation;if(component){const source=value.kind==='notation'?value.score:component.fromVisual(value);notationEditor=component.mount({host:controls,value:source,canEdit,onChange:score=>emit({kind:'notation',score},false)});}else controls.append(node('p','education-visual-help','The music staff tools could not load. Reload to try again.'));
   }else if(current==='note-parts'){
    select(controls,'Show note parts','note-part-focus',[['head','Notehead'],['stem','Stem'],['flag','Flag'],['all','All parts']],value.focus,next=>emit({...value,focus:next}));
    select(controls,'Note length','note-part-length',[['4','Whole'],['2','Half'],['1','Quarter'],['0.5','Eighth']],String(value.beats),next=>emit({...value,beats:Number(next)}));
   }else if(current==='rhythm-tree')select(controls,'Rhythm tree level','tree-level',[['0','Whole note'],['1','Half notes'],['2','Quarter notes'],['3','Eighth notes']],String(value.level),next=>emit({...value,level:Number(next)}));
   const preview=node('div','education-visual-preview');preview.dataset.visualPreview='';preview.setAttribute('aria-label','Visual preview');root.append(preview);drawPreview();
  }
  render();return {getValue:()=>copy(value),setValue(next){if(destroyed)return false;value=copy(next);render();return true;},refresh:render,destroy(){if(destroyed)return;destroyed=true;notationEditor?.destroy();root.remove();}};
 }
 return Object.freeze({mount});
});
