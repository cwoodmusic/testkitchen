/* A real piano-key map for the classroom's pitch and key-step examples. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaClassroomKeyboard=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const LETTERS=Object.freeze(['C','D','E','F','G','A','B','C']);
 const BLACK=Object.freeze([{note:'C-sharp',boundary:1,pitch:1},{note:'D-sharp',boundary:2,pitch:3},{note:'F-sharp',boundary:4,pitch:6},{note:'G-sharp',boundary:5,pitch:8},{note:'A-sharp',boundary:6,pitch:10}].map(Object.freeze));
 const PITCH=Object.freeze({C:0,D:2,E:4,F:5,G:7,A:9,B:11});
 const DESCRIPTION='Piano keyboard: white keys C D E F G A B C. Black keys repeat in groups of two and three. Lower sounds are to the left; higher sounds are to the right.';
 const GROUP_LABELS=Object.freeze({two:'2 black keys',three:'3 black keys'}),DIRECTION_LABELS=Object.freeze({lower:'Lower sounds',higher:'Higher sounds'});
 const xml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
 const printed=note=>note.replace('-sharp','♯').replace('-flat','♭');
 const pitch=note=>(PITCH[note[0]]+(note.endsWith('-sharp')?1:note.endsWith('-flat')?-1:0)+12)%12;
 function validateVisual(value){
  const fail=error=>({ok:false,error});
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['kind','notes','label','showLabels','showGroups','showDirections','groupLabels','directionLabels'].includes(key))||value.kind!=='keyboard')return fail('Choose a piano keyboard picture.');
  const notes=value.notes===undefined?[]:value.notes;
  if(!Array.isArray(notes)||notes.length>16||notes.some(note=>typeof note!=='string'||!/^[A-G](?:-sharp|-flat)?$/.test(note)))return fail('Keyboard notes use letters A–G with an optional -sharp or -flat.');
  if(value.label!==undefined&&(typeof value.label!=='string'||!value.label.trim()||value.label.length>300))return fail('Give the keyboard a short picture description.');
  const data={kind:'keyboard',notes:[...new Set(notes)],...(value.label!==undefined?{label:value.label}:{})};
  for(const field of ['showLabels','showGroups','showDirections'])if(value[field]!==undefined){if(typeof value[field]!=='boolean')return fail('Keyboard label visibility must be true or false.');data[field]=value[field];}
  for(const [field,keys]of [['groupLabels',['two','three']],['directionLabels',['lower','higher']]])if(value[field]!==undefined){
   const labels=value[field];if(!labels||typeof labels!=='object'||Array.isArray(labels)||Object.keys(labels).some(key=>!keys.includes(key))||keys.some(key=>typeof labels[key]!=='string'||labels[key].length>80))return fail('Keyboard captions need supported text fields of at most 80 characters.');
   data[field]=Object.fromEntries(keys.map(key=>[key,labels[key]]));
  }
  return {ok:true,data};
 }
 function toSVG(input){
  const checked=validateVisual(input);if(!checked.ok)return '';
  const value=checked.data,showLabels=value.showLabels!==false,showGroups=value.showGroups!==false,showDirections=value.showDirections!==false,groupLabels=value.groupLabels||GROUP_LABELS,directionLabels=value.directionLabels||DIRECTION_LABELS,highlight=new Set(value.notes.map(pitch));
  const description=showLabels&&showDirections?DESCRIPTION:(showLabels?'Piano keyboard: white keys C D E F G A B C.':'Piano keyboard with eight unlabeled white keys and five black keys.')+' Black keys repeat in groups of two and three.'+(showDirections?' Lower sounds are to the left; higher sounds are to the right.':'');
  const label=(value.label?value.label+' ':'')+description+(value.notes.length?(showLabels?' Highlighted keys: '+value.notes.map(printed).join(', ')+'.':' Highlighted keys are marked with color.'):'')+(showGroups&&value.groupLabels?' Group captions: '+groupLabels.two+'; '+groupLabels.three+'.':'')+(showDirections&&value.directionLabels?' Direction captions: '+directionLabels.lower+'; '+directionLabels.higher+'.':''),left=32,keyWidth=80,keyTop=82,keyHeight=196;
  const fit=(text,width)=>text.length>18?' textLength="'+width+'" lengthAdjust="spacingAndGlyphs"':'';
  let svg='<svg xmlns="http://www.w3.org/2000/svg" class="lesson-piano-keyboard" viewBox="0 0 704 344" width="704" height="344" role="img" aria-label="'+xml(label)+'" style="display:block;width:100%;height:auto"><title>'+xml(label)+'</title><g font-family="system-ui,sans-serif" text-anchor="middle">';
  svg+='<rect x="1" y="1" width="702" height="342" rx="16" fill="#eaf0ed"/>';
  if(showGroups)for(const [count,start,end]of [[2,87,217],[3,327,537]]){
   const middle=(start+end)/2,text=groupLabels[count===2?'two':'three'];
   svg+='<text data-piano-group="'+count+'" data-keyboard-group="'+count+'" x="'+middle+'" y="32" font-size="25" font-weight="700" fill="#244e48"'+fit(text,count===2?200:250)+'>'+xml(text)+'</text><path d="M'+start+' 64V49H'+end+'V64" fill="none" stroke="#39756c" stroke-width="3"/>';
  }
  LETTERS.forEach((letter,index)=>{
   const x=left+index*keyWidth,selected=highlight.has(PITCH[letter]);
   svg+='<rect data-piano-white="'+letter+'"'+(selected?' data-piano-highlight="true"':'')+' x="'+x+'" y="'+keyTop+'" width="'+keyWidth+'" height="'+keyHeight+'" rx="3" fill="'+(selected?'#b4ebd2':'#fffdf6')+'" stroke="#273a45" stroke-width="2"/>';
   if(showLabels)svg+='<text data-keyboard-white-label="'+letter+'" x="'+(x+keyWidth/2)+'" y="257" font-size="36" font-weight="750" fill="#183f39">'+letter+'</text>';
  });
  for(const key of BLACK){
   const x=left+key.boundary*keyWidth-25,selected=highlight.has(key.pitch),name=value.notes.find(note=>pitch(note)===key.pitch);
   svg+='<rect data-piano-black="'+key.note+'" data-keyboard-black-key="'+key.note+'"'+(selected?' data-piano-highlight="true"':'')+' x="'+x+'" y="'+keyTop+'" width="50" height="119" rx="4" fill="'+(selected?'#70458d':'#233442')+'" stroke="#182735" stroke-width="2"/>';
   if(selected&&showLabels)svg+='<text x="'+(x+25)+'" y="177" font-size="22" font-weight="700" fill="#fff4d6">'+xml(printed(name))+'</text>';
  }
  if(showDirections)svg+='<g fill="#244e48" font-size="25" font-weight="700"><path d="M31 314L43 307V321Z"/><text data-keyboard-direction="lower" x="153" y="323"'+fit(directionLabels.lower,224)+'>'+xml(directionLabels.lower)+'</text><path d="M673 314L661 307V321Z"/><text data-keyboard-direction="higher" x="551" y="323"'+fit(directionLabels.higher,224)+'>'+xml(directionLabels.higher)+'</text></g>';
  return svg+'</g></svg>';
 }
 return Object.freeze({validateVisual,toSVG});
});
