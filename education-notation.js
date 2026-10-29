/* Safe, editable score pictures for classroom questions. Bravura is bundled. */
(function(root,factory){
 const notation=typeof module==='object'&&module.exports?require('./music-notation.js'):root?.CodaMusicNotation;
 const api=factory(notation);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaEducationNotation=api;
})(typeof window==='undefined'?null:window,function(notation){
 'use strict';
 const VERSION=1,MAX_ITEMS=64,CLEFS=Object.freeze(['treble','bass','grand']),METERS=Object.freeze(['4/4','3/4','2/4','2/2','6/8']),DURATIONS=Object.freeze([4,2,1,.5,.25]);
 const TYPES=Object.freeze(['note','rest','bar','repeat-start','repeat-end','clef']),ACCIDENTALS=Object.freeze(['none','sharp','flat','natural']);
 const copy=value=>JSON.parse(JSON.stringify(value));
 const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
 const exact=(value,fields)=>Object.keys(value).every(key=>fields.includes(key));
 const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const empty=()=>({version:VERSION,clef:'treble',meter:null,items:[]});
 function validate(value){
  const fail=error=>({ok:false,error});
  if(!plain(value)||!exact(value,['version','clef','meter','items'])||value.version!==VERSION||!CLEFS.includes(value.clef)||!(value.meter===null||METERS.includes(value.meter))||!Array.isArray(value.items)||value.items.length>MAX_ITEMS)return fail('Choose a treble, bass, or grand staff with at most 64 symbols.');
  const items=[];
  for(const raw of value.items){
   if(!plain(raw)||!TYPES.includes(raw.type))return fail('A score contains an unknown symbol.');
   if(raw.type==='note'||raw.type==='rest'){
    if(!exact(raw,raw.type==='note'?['type','position','duration','dots','accidental','staff']:['type','duration','dots','staff'])||!DURATIONS.includes(raw.duration)||![0,1].includes(raw.dots)||!['treble','bass'].includes(raw.staff))return fail('Notes and rests need a supported duration, staff, and zero or one dot.');
    if(raw.type==='note'&&(!Number.isInteger(raw.position)||raw.position< -12||raw.position>20||!ACCIDENTALS.includes(raw.accidental)))return fail('Place notes between staff positions −12 and 20 and use a listed accidental.');
    items.push(raw.type==='note'?{type:'note',position:raw.position,duration:raw.duration,dots:raw.dots,accidental:raw.accidental,staff:raw.staff}:{type:'rest',duration:raw.duration,dots:raw.dots,staff:raw.staff});
   }else if(raw.type==='clef'){
    if(!exact(raw,['type','clef','staff'])||!['treble','bass'].includes(raw.clef)||!['treble','bass'].includes(raw.staff))return fail('A clef change needs a treble or bass sign and a staff.');
    items.push({type:'clef',clef:raw.clef,staff:raw.staff});
   }else{
    if(!exact(raw,['type']))return fail('Bar lines and repeats contain only their symbol type.');items.push({type:raw.type});
   }
  }
  return {ok:true,data:{version:VERSION,clef:value.clef,meter:value.meter,items}};
 }
 function normalize(value){const result=validate(value);return result.ok?result.data:empty();}
 function fromVisual(visual){
  if(visual?.kind==='notation')return normalize(visual.score);
  const result=empty();
  if(visual?.kind==='staff'){
   result.clef=visual.grand?'grand':visual.clef==='bass'?'bass':'treble';
   result.items.push({type:'note',position:Math.max(-12,Math.min(20,Math.round(Number(visual.position)||0))),duration:1,dots:0,accidental:'none',staff:visual.clef==='bass'?'bass':'treble'});
  }else if(visual?.kind==='middle-c-pair'){
   result.clef='grand';result.items.push({type:'note',position:-2,duration:1,dots:0,accidental:'none',staff:'treble'},{type:'note',position:10,duration:1,dots:0,accidental:'none',staff:'bass'});
  }else if(visual?.kind==='note'){
   const symbol=notation.symbol(visual.beats??1,{rest:visual.rest===true});result.items.push({type:symbol.rest?'rest':'note',...(symbol.rest?{}:{position:4,accidental:'none'}),duration:symbol.baseBeats,dots:symbol.dots,staff:'treble'});
  }else if(visual?.kind==='rhythm'&&Array.isArray(visual.notes)){
   result.meter=METERS.includes(visual.meter)?visual.meter:'4/4';
   for(const note of visual.notes.slice(0,MAX_ITEMS)){const symbol=notation.symbol(note.beats??1,{rest:note.rest===true});result.items.push({type:symbol.rest?'rest':'note',...(symbol.rest?{}:{position:4,accidental:'none'}),duration:symbol.baseBeats,dots:symbol.dots,staff:'treble'});}
  }else if(visual?.kind==='meter'&&METERS.includes(visual.meter))result.meter=visual.meter;
  return result;
 }
 function measureGeometry(score){
  const names=score.clef==='grand'?['treble','bass']:[score.clef],staffs={};let top=0;
  for(const name of names){const notes=score.items.filter(item=>item.type==='note'&&(score.clef!=='grand'||item.staff===name));const max=Math.max(14,...notes.map(item=>item.position)),min=Math.min(-4,...notes.map(item=>item.position));const above=(max-14)*8,below=(-4-min)*8,bottom=top+145+above;staffs[name]={name,top,bottom,height:200+above+below};top+=200+above+below;}
  const start=score.meter?152:112,width=Math.max(480,start+score.items.length*70+48);
  return {width,height:top,start,staffs,names,slots:score.items.map((_,index)=>start+index*70)};
 }
 function beamGroups(score){
  const pulse=score.meter==='6/8'?1.5:score.meter==='2/2'?2:1,groups=[];let group=[],time=0,groupKey='';
  const flush=()=>{if(group.length>1)groups.push(group);group=[];};
  score.items.forEach((item,index)=>{
   if(['bar','repeat-start','repeat-end'].includes(item.type)){flush();time=0;return;}
   if(item.type==='clef'){flush();return;}
   const duration=item.duration*(item.dots?1.5:1),key=(score.clef==='grand'?item.staff:score.clef)+':'+Math.floor((time+.00001)/pulse);
   if(item.type!=='note'||item.duration>=1){flush();time+=duration;return;}
   if(group.length&&groupKey!==key)flush();groupKey=key;group.push(index);time+=duration;
  });flush();return groups;
 }
 function textGlyph(code,x,y,size=64,extra=''){return '<text class="coda-music-glyph" x="'+x+'" y="'+y+'" font-size="'+size+'"'+extra+'>'+String.fromCodePoint(code)+'</text>';}
 function toSVG(value,options={}){
  const checked=validate(value);if(!checked.ok)return '';
  const score=checked.data,geometry=measureGeometry(score),{width,height,start,staffs,names,slots}=geometry,selected=Number.isInteger(options.selected)?options.selected:-1;
  const itemStaff=item=>staffs[score.clef==='grand'?item.staff:score.clef]||staffs[names[0]];
  const label=typeof options.label==='string'?options.label:'Music notation: '+(score.clef==='grand'?'grand staff':score.clef+' staff')+(score.meter?', '+score.meter+' time':'')+'. '+score.items.length+' symbols.';
  let svg='<svg class="education-score coda-notated-staff" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'" style="--education-score-width:'+width+'px" role="img" aria-label="'+xml(label)+'" data-score-clef="'+score.clef+'"'+(options.interactive?' data-notation-canvas=""':'')+'><rect x="1" y="1" width="'+(width-2)+'" height="'+(height-2)+'" rx="8" fill="#fff9e9" stroke="#d4c8dc"/>';
  for(const name of names){const staff=staffs[name];svg+='<g data-score-staff="'+name+'" fill="#493458" stroke="#5f526d" stroke-width="1.4">';for(let line=0;line<5;line++)svg+='<path class="education-staff-line" fill="none" d="M20 '+(staff.bottom-line*16)+'H'+(width-20)+'"/>';svg+=textGlyph(name==='bass'?0xe062:0xe050,34,staff.bottom-(name==='bass'?48:16),64,' stroke="none" data-score-clef-sign="'+name+'"');if(score.meter){if(score.meter==='2/2')svg+=textGlyph(0xe08b,96,staff.bottom-32,64,' stroke="none"');else{const [numerator,denominator]=score.meter.split('/').map(Number);svg+=textGlyph(0xe080+numerator,96,staff.bottom-48,64,' stroke="none"')+textGlyph(0xe080+denominator,96,staff.bottom-16,64,' stroke="none"');}}svg+='</g>';}
  if(score.clef==='grand'){const first=staffs.treble,last=staffs.bass;svg+='<path d="M17 '+(first.bottom-64)+'V'+last.bottom+'M13 '+(first.bottom-64)+'C0 '+(first.bottom-64)+' 13 '+(first.bottom-10)+' 5 '+((first.bottom+last.bottom-64)/2)+'C13 '+(last.bottom-54)+' 0 '+last.bottom+' 13 '+last.bottom+'" fill="none" stroke="#5f526d" stroke-width="2"/>';}
  const groups=beamGroups(score),groupFor=new Map();for(const group of groups){const average=group.reduce((sum,index)=>sum+score.items[index].position,0)/group.length,down=average>=4,ys=group.map(index=>itemStaff(score.items[index]).bottom-score.items[index].position*8),beamY=down?Math.max(...ys)+44:Math.min(...ys)-44;for(const index of group)groupFor.set(index,{group,down,beamY});}
  score.items.forEach((item,index)=>{
   const x=slots[index],staff=itemStaff(item),bottom=staff.bottom,y=item.type==='note'?bottom-item.position*8:bottom-32,color=index===selected?'#ce3784':'#603576';
   svg+='<g data-notation-item="'+index+'" data-symbol-type="'+item.type+'"'+(item.type==='note'?' data-staff-position="'+item.position+'"':'')+' fill="'+color+'" stroke="'+color+'">';
   if(options.interactive)svg+='<rect x="'+(x-31)+'" y="8" width="62" height="'+(height-16)+'" rx="5" fill="'+(index===selected?'#edc5e633':'transparent')+'" stroke="'+(index===selected?'#d65caa':'none')+'" stroke-dasharray="3 3"/>';
   if(item.type==='note'){
    if(item.position<0)for(let position=-2;position>=item.position;position-=2)svg+='<path class="education-ledger" d="M'+(x-17)+' '+(bottom-position*8)+'H'+(x+17)+'" fill="none" stroke-width="1.5"/>';
    if(item.position>8)for(let position=10;position<=item.position;position+=2)svg+='<path class="education-ledger" d="M'+(x-17)+' '+(bottom-position*8)+'H'+(x+17)+'" fill="none" stroke-width="1.5"/>';
    if(item.accidental!=='none')svg+=textGlyph({sharp:0xe262,flat:0xe260,natural:0xe261}[item.accidental],x-31,y,56,' stroke="none" data-score-accidental="'+item.accidental+'"');
    const beam=groupFor.get(index);
    if(beam){svg+=textGlyph(0xe0a4,x-64*.166,y,64,' stroke="none"');const stemX=x+(beam.down?-10.1:10.1);svg+='<path d="M'+stemX+' '+(y+(beam.down?1:-1))+'V'+beam.beamY+'" fill="none" stroke-width="1.6"/>';}
    else{const symbol=notation.symbol(item.duration,{stem:item.position>=4?'down':'up'}),offset=item.duration===4?.2295:item.duration===2?.1705:.166;svg+=textGlyph(symbol.codepoint,x-offset*64,y,64,' stroke="none"');}
    if(item.dots)svg+=textGlyph(0xe1e7,x+18,y-(item.position%2===0?8:0),64,' stroke="none"');
   }else if(item.type==='rest'){
    const symbol=notation.symbol(item.duration,{rest:true}),offset={4:.1415,2:.1415,1:.1355,.5:.125,.25:.16}[item.duration],restY=bottom-(item.duration===4?48:32);svg+=textGlyph(symbol.codepoint,x-offset*64,restY,64,' stroke="none"');if(item.dots)svg+=textGlyph(0xe1e7,x+18,restY-8,64,' stroke="none"');
   }else if(item.type==='clef')svg+=textGlyph(item.clef==='bass'?0xe062:0xe050,x-14,bottom-(item.clef==='bass'?48:16),64,' stroke="none"');
   else for(const name of names){const target=staffs[name],top=target.bottom-64;if(item.type==='bar')svg+='<path d="M'+x+' '+top+'V'+target.bottom+'" fill="none" stroke-width="1.7"/>';else{const isStart=item.type==='repeat-start',thin=x+(isStart?7:-7),dots=x+(isStart?17:-17);svg+='<path d="M'+x+' '+top+'V'+target.bottom+'" fill="none" stroke-width="4"/><path d="M'+thin+' '+top+'V'+target.bottom+'" fill="none" stroke-width="1.5"/><circle cx="'+dots+'" cy="'+(target.bottom-40)+'" r="2.7" stroke="none"/><circle cx="'+dots+'" cy="'+(target.bottom-24)+'" r="2.7" stroke="none"/>';}}
   svg+='</g>';
  });
  for(const group of groups){const beam=groupFor.get(group[0]),stemX=index=>slots[index]+(beam.down?-10.1:10.1);svg+='<g class="education-beam" fill="none" stroke="#603576" stroke-width="5"><path d="M'+stemX(group[0])+' '+beam.beamY+'H'+stemX(group.at(-1))+'"/>';group.forEach((index,at)=>{if(score.items[index].duration!==.25)return;const previous=group[at-1],next=group[at+1];let end;if(next!==undefined&&score.items[next].duration===.25)end=stemX(next);else if(previous!==undefined&&score.items[previous].duration===.25)return;else end=stemX(index)+(at===group.length-1?-15:15);svg+='<path d="M'+stemX(index)+' '+(beam.beamY+(beam.down?-10:10))+'H'+end+'"/>';});svg+='</g>';}
  return svg+'</svg>';
 }
 function mount(api={}){
  const host=api.host;if(!host?.ownerDocument)throw Error('The notation editor needs a host.');
  const doc=host.ownerDocument,win=doc.defaultView;let score=normalize(api.value),selected=-1,tool='select',duration=1,dots=0,accidental='none',targetStaff='treble',clef='treble',destroyed=false,drag=null,undo=[],redo=[];
  const canEdit=()=>{try{return !destroyed&&api.canEdit?.()!==false;}catch{return false;}};
  const element=(tag,className,text)=>{const node=doc.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
  const root=element('section','education-notation-editor');root.setAttribute('aria-label','Music notation editor');host.append(root);
  const toolbar=element('div','education-notation-toolbar'),settings=element('div','education-notation-toolbar'),actions=element('div','education-notation-actions'),canvas=element('div','education-notation-canvas'),status=element('p','education-notation-status');canvas.tabIndex=0;canvas.setAttribute('role','group');canvas.setAttribute('aria-label','Editable music staff. Select a symbol. Up and down change pitch. Left and right select symbols. Delete removes the selection.');status.setAttribute('role','status');
  const controls={};
  function selectControl(parent,name,label,choices,action){const group=element('label','education-notation-field'),title=element('span','',label),select=element('select');select.dataset.notationControl=name;select.setAttribute('aria-label',label);for(const [value,text]of choices){const option=element('option','',text);option.value=value;select.append(option);}select.onchange=()=>{if(canEdit())action(select.value);else render();};group.append(title,select);parent.append(group);controls[name]=select;return select;}
  function button(text,action,name){const node=element('button','',text);node.type='button';if(name)node.dataset.notationAction=name;node.onclick=()=>{if(canEdit())action();};actions.append(node);return node;}
  selectControl(toolbar,'staff','Staff',[['treble','Treble'],['bass','Bass'],['grand','Grand staff']],value=>change({...score,clef:value}));
  selectControl(toolbar,'meter','Time signature',[['','No time signature'],['4/4','4/4'],['3/4','3/4'],['2/4','2/4'],['2/2','2/2 · cut time'],['6/8','6/8']],value=>change({...score,meter:value||null}));
  selectControl(toolbar,'tool','Place symbol',[['select','Select / drag'],['note','Note'],['rest','Rest'],['bar','Bar line'],['repeat-start','Start repeat'],['repeat-end','End repeat'],['clef','Clef change']],value=>{tool=value;renderStatus();});
  selectControl(settings,'duration','Note length',[['4','Whole'],['2','Half'],['1','Quarter'],['0.5','Eighth'],['0.25','Sixteenth']],value=>{duration=Number(value);updateSelected({duration},['note','rest']);});
  selectControl(settings,'dots','Dot',[['0','No dot'],['1','Dotted']],value=>{dots=Number(value);updateSelected({dots},['note','rest']);});
  selectControl(settings,'accidental','Accidental',[['none','None'],['sharp','Sharp ♯'],['flat','Flat ♭'],['natural','Natural ♮']],value=>{accidental=value;updateSelected({accidental},['note']);});
  selectControl(settings,'target','Place on',[['treble','Upper / treble staff'],['bass','Lower / bass staff']],value=>{targetStaff=value;updateSelected({staff:value},['note','rest','clef']);});
  selectControl(settings,'clef','New clef sign',[['treble','Treble clef'],['bass','Bass clef']],value=>{clef=value;updateSelected({clef},['clef']);});
  button('Add symbol',()=>add(tool==='select'?'note':tool,score.items.length,4,targetStaff),'add');
  const left=button('Move left',()=>move(-1),'left'),right=button('Move right',()=>move(1),'right'),up=button('Pitch up',()=>pitch(1),'up'),down=button('Pitch down',()=>pitch(-1),'down'),remove=button('Delete symbol',removeSelected,'delete'),undoButton=button('Undo',()=>history(true),'undo'),redoButton=button('Redo',()=>history(false),'redo');
  root.append(toolbar,settings,actions,canvas,status);
  const hint=element('p','education-notation-hint','Choose a symbol, then click the staff to place it. Select a note to drag its pitch or use ↑ / ↓. ← / → selects a symbol. Alt + ← / → moves it. Delete removes it.');root.append(hint);
  function apply(next,{record=true,notify=true}={}){
   if(!canEdit())return false;const result=validate(next);if(!result.ok){status.textContent=result.error;return false;}
   const before=copy(score);if(JSON.stringify(before)===JSON.stringify(result.data))return true;
   if(notify&&api.onChange?.(copy(result.data))===false){render();return false;}
   if(record){undo.push(before);if(undo.length>100)undo.shift();redo=[];}score=result.data;selected=Math.min(selected,score.items.length-1);render();return true;
  }
  function change(next){return apply(next);}
  function updateSelected(fields,types){const item=score.items[selected];if(item&&types.includes(item.type)){const next=copy(score);next.items[selected]={...item,...fields};change(next);}else renderStatus();}
  function add(type,index,position=4,staff=targetStaff){
   if(score.items.length>=MAX_ITEMS){status.textContent='This score already has 64 symbols. Delete one before adding another.';return false;}
   const item=type==='note'?{type,position:Math.max(-12,Math.min(20,Math.round(position))),duration,dots,accidental,staff}:type==='rest'?{type,duration,dots,staff}:type==='clef'?{type,clef,staff}:{type};
   const next=copy(score);index=Math.max(0,Math.min(next.items.length,index));next.items.splice(index,0,item);const oldSelected=selected;selected=index;if(!change(next)){selected=oldSelected;return false;}return true;
  }
  function removeSelected(){if(selected<0)return;const next=copy(score);next.items.splice(selected,1);change(next);}
  function pitch(amount){const item=score.items[selected];if(item?.type==='note')updateSelected({position:Math.max(-12,Math.min(20,item.position+amount))},['note']);}
  function move(amount){const index=selected+amount;if(selected<0||index<0||index>=score.items.length)return;const next=copy(score);[next.items[selected],next.items[index]]=[next.items[index],next.items[selected]];selected=index;change(next);}
  function history(back){const from=back?undo:redo,to=back?redo:undo;if(!from.length)return;const next=from.at(-1),before=copy(score);if(apply(next,{record:false})){from.pop();to.push(before);render();}}
  function syncSelection(){const item=score.items[selected];if(item){if(item.duration){duration=item.duration;dots=item.dots;}if(item.type==='note')accidental=item.accidental;if(item.staff)targetStaff=item.staff;if(item.type==='clef')clef=item.clef;}controls.duration.value=String(duration);controls.dots.value=String(dots);controls.accidental.value=accidental;controls.target.value=targetStaff;controls.clef.value=clef;}
  function renderStatus(){const item=score.items[selected],readOnly=!canEdit();status.textContent=readOnly?'Notation is read only.':item?'Selected '+(selected+1)+' of '+score.items.length+': '+item.type.replace(/-/g,' ')+(item.type==='note'?', staff position '+item.position:'')+'.':score.items.length+' symbols. '+(tool==='select'?'Select a symbol to change it.':'Click the staff to place '+tool.replace(/-/g,' ')+'.');for(const node of root.querySelectorAll('button,select'))node.disabled=readOnly;for(const node of [left,right,up,down,remove])node.disabled=readOnly||selected<0;left.disabled||=selected===0;right.disabled||=selected>=score.items.length-1;up.disabled||=item?.type!=='note'||item?.position>=20;down.disabled||=item?.type!=='note'||item?.position<=-12;undoButton.disabled=readOnly||!undo.length;redoButton.disabled=readOnly||!redo.length;controls.target.closest('label').hidden=score.clef!=='grand';controls.clef.closest('label').hidden=tool!=='clef'&&item?.type!=='clef';}
  function render(){
   if(destroyed)return;controls.staff.value=score.clef;controls.meter.value=score.meter||'';controls.tool.value=tool;syncSelection();canvas.innerHTML=toSVG(score,{interactive:true,selected});renderStatus();notation.load?.(doc);
   if(selected>=0){const geometry=measureGeometry(score),svg=canvas.querySelector('svg'),scale=(svg?.getBoundingClientRect().width||geometry.width)/geometry.width,x=geometry.slots[selected]*scale;
    if(x-34*scale<canvas.scrollLeft||x+34*scale>canvas.scrollLeft+canvas.clientWidth)canvas.scrollLeft=Math.max(0,x-canvas.clientWidth/2);
   }
  }
  function point(event){const svg=canvas.querySelector('svg'),matrix=svg?.getScreenCTM?.();if(!svg||!matrix)return null;const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;return p.matrixTransform(matrix.inverse());}
  function staffAt(y,geometry){return geometry.names.reduce((name,next)=>Math.abs(y-(geometry.staffs[next].bottom-32))<Math.abs(y-(geometry.staffs[name].bottom-32))?next:name,geometry.names[0]);}
  canvas.addEventListener('pointerdown',event=>{
   if(!canEdit()||event.button!==0||event.isPrimary===false)return;const p=point(event);if(!p)return;event.preventDefault();canvas.focus({preventScroll:true});const hit=event.target.closest?.('[data-notation-item]');
   if(tool==='select'){
    selected=hit?Number(hit.dataset.notationItem):-1;syncSelection();const item=score.items[selected];if(item?.type==='note'){drag={index:selected,x:event.clientX,y:event.clientY,before:copy(score),moved:false};canvas.setPointerCapture?.(event.pointerId);}render();return;
   }
   const geometry=measureGeometry(score),staff=staffAt(p.y,geometry),position=Math.round((geometry.staffs[staff].bottom-p.y)/8),index=Math.max(0,Math.min(score.items.length,Math.round((p.x-geometry.start)/70)));add(tool,index,position,staff);
  });
  canvas.addEventListener('pointermove',event=>{
   if(!drag||!canEdit()||Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<3&&!drag.moved)return;const p=point(event);if(!p)return;const geometry=measureGeometry(score),staff=staffAt(p.y,geometry),position=Math.max(-12,Math.min(20,Math.round((geometry.staffs[staff].bottom-p.y)/8))),next=copy(score);next.items[drag.index]={...next.items[drag.index],position,staff};if(apply(next,{record:false}))drag.moved=true;
  });
  function finishDrag(){if(drag?.moved){undo.push(drag.before);if(undo.length>100)undo.shift();redo=[];}drag=null;renderStatus();}
  canvas.addEventListener('pointerup',finishDrag);canvas.addEventListener('pointercancel',finishDrag);canvas.addEventListener('lostpointercapture',finishDrag);
  canvas.addEventListener('keydown',event=>{
   if(!canEdit())return;let handled=true;if(event.key==='ArrowUp')pitch(event.shiftKey?2:1);else if(event.key==='ArrowDown')pitch(event.shiftKey?-2:-1);else if(event.key==='ArrowLeft'||event.key==='ArrowRight'){const amount=event.key==='ArrowLeft'?-1:1;if(event.altKey)move(amount);else{selected=Math.max(0,Math.min(score.items.length-1,selected+amount));render();}}else if(event.key==='Delete'||event.key==='Backspace')removeSelected();else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z')history(!event.shiftKey);else handled=false;if(handled){event.preventDefault();event.stopPropagation();}
  });
  render();return {getValue:()=>copy(score),setValue(value){if(destroyed)return false;const result=validate(value);if(!result.ok)return false;score=result.data;selected=-1;undo=[];redo=[];canvas.scrollLeft=0;render();return true;},destroy(){destroyed=true;drag=null;root.remove();}};
 }
 return Object.freeze({VERSION,MAX_ITEMS,CLEFS,METERS,DURATIONS,ACCIDENTALS,validate,normalize,fromVisual,toSVG,mount});
});
