/* Extra classroom foundations; its practice never changes the eight exam categories. */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./classroom-exam-study.js'):root?.CodaClassroomExamStudy,node?require('./classroom-quiz.js'):root?.CodaClassroomQuiz,node?require('./music-notation.js'):root?.CodaMusicNotation);
 if(node)module.exports=api;if(root)root.CodaAccidentalsLesson=api;
})(typeof window==='undefined'?null:window,function(studyModule,quizModule,notation){
 'use strict';
 const ID='accidentals-key-signatures',TITLE='Accidentals & key signatures';
 const copy=value=>JSON.parse(JSON.stringify(value));
 const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const only=(value,keys)=>Object.keys(value).every(key=>keys.includes(key));
 const accidentalCodes={sharp:0xe262,flat:0xe260,natural:0xe261};
 const signatureNotes={none:[],G:[['F','sharp',8]],F:[['B','flat',4]],D:[['F','sharp',8],['C','sharp',5]]};
 function validateVisual(value){
  const fail=error=>({ok:false,error});
  if(!object(value)||!only(value,['kind','signature','meter','items'])||value.kind!=='key-signature'||!Object.hasOwn(signatureNotes,value.signature)||![null,'4/4'].includes(value.meter)||!Array.isArray(value.items)||value.items.length>16)return fail('Choose a supported key signature and at most 16 notes or bar lines.');
  const items=[];for(const item of value.items){
   if(!object(item))return fail('A staff symbol must be a note or a bar line.');
   if(item.type==='bar'&&only(item,['type']))items.push({type:'bar'});
   else if(item.type==='note'&&only(item,['type','position','accidental'])&&Number.isInteger(item.position)&&item.position>=-4&&item.position<=12&&['none','sharp','flat','natural'].includes(item.accidental))items.push({type:'note',position:item.position,accidental:item.accidental});
   else return fail('Staff notes need a supported position and accidental.');
  }
  return {ok:true,data:{kind:'key-signature',signature:value.signature,meter:value.meter,items}};
 }
 const glyph=(code,x,y,size=64,extra='')=>'<text class="coda-music-glyph" x="'+x+'" y="'+y+'" font-size="'+size+'" stroke="none"'+extra+'>'+String.fromCodePoint(code)+'</text>';
 function signatureSVG(input){
  const checked=validateVisual(input);if(!checked.ok)return '';const value=checked.data,bottom=132,start=230,width=Math.max(480,start+value.items.length*68+32),height=232;
  const description=value.signature==='none'?'No sharps or flats in the key signature.':value.signature==='G'?'One F-sharp in the key signature.':value.signature==='F'?'One B-flat in the key signature.':'F-sharp and C-sharp in the key signature.';
  let s='<svg class="education-score coda-notated-staff accidentals-signature-score" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'" style="--education-score-width:'+width+'px" role="img" aria-label="Treble staff. '+description+(value.meter?' Four-four time.':'')+' Staff excerpt." data-signature="'+value.signature+'"><rect x="1" y="1" width="'+(width-2)+'" height="'+(height-2)+'" rx="9" fill="#fff9e9" stroke="#cbb4cc"/><g stroke="#66516f" fill="#543766" stroke-width="1.5">';
  for(let line=0;line<5;line++)s+='<path d="M16 '+(bottom-line*16)+'H'+(width-16)+'" fill="none"/>';
  s+='<g data-signature-clef="">'+glyph(0xe050,31,bottom-16)+'</g>';
  if(value.signature!=='none')s+='<rect x="85" y="43" width="65" height="106" rx="6" fill="#e7d8f15c" stroke="none"/>';
  s+='<g data-key-signature="'+value.signature+'">';signatureNotes[value.signature].forEach(([letter,sign,position],index)=>{s+=glyph(accidentalCodes[sign],94+index*27,bottom-position*8,64,' data-signature-letter="'+letter+'" data-signature-accidental="'+sign+'"');});s+='</g>';
  if(value.meter)s+='<g data-signature-meter="4/4">'+glyph(0xe084,170,bottom-48,64)+glyph(0xe084,170,bottom-16,64)+'</g>';
  value.items.forEach((item,index)=>{const x=start+index*68;if(item.type==='bar'){s+='<path data-signature-bar="" d="M'+x+' '+(bottom-64)+'V'+bottom+'" fill="none" stroke-width="2"/>';return;}
   const y=bottom-item.position*8;s+='<g data-signature-note="'+index+'" data-staff-position="'+item.position+'" data-written-accidental="'+item.accidental+'">';
   if(item.position<0)for(let position=-2;position>=item.position;position-=2)s+='<path d="M'+(x-16)+' '+(bottom-position*8)+'H'+(x+16)+'" fill="none"/>';
   if(item.position>8)for(let position=10;position<=item.position;position+=2)s+='<path d="M'+(x-16)+' '+(bottom-position*8)+'H'+(x+16)+'" fill="none"/>';
   if(item.accidental!=='none')s+=glyph(accidentalCodes[item.accidental],x-31,y,56,' data-local-accidental="'+item.accidental+'"');
   s+=glyph(0xe0a4,x-9.4,y,64);const down=item.position>=4;s+='<path d="M'+(x+(down?-8.8:8.8))+' '+y+'V'+(y+(down?45:-45))+'" fill="none" stroke-width="2"/>';
   const letter=['E','F','G','A','B','C','D'][((item.position%7)+7)%7];s+='<text x="'+x+'" y="207" text-anchor="middle" font-family="system-ui,sans-serif" font-size="17" stroke="none" fill="#5e496c">'+letter+'</text></g>';
  });
  return s+'</g></svg>';
 }
 function renderVisual(figure,value){if(value?.kind!=='key-signature')return false;const svg=signatureSVG(value);if(!svg)return false;figure.innerHTML=svg;const caption=figure.ownerDocument.createElement('figcaption');caption.textContent='Staff excerpt. Read the signs; the letters name the note positions.';figure.append(caption);notation?.load?.(figure.ownerDocument);return true;}
 const note=(position,accidental='none')=>({type:'note',position,accidental});
 const diagram=(signature,items,meter='4/4')=>({kind:'key-signature',signature,meter,items});
 const accidentalScore=(position,accidental)=>({kind:'notation',score:{version:1,clef:'treble',meter:null,items:[{type:'note',position,duration:1,dots:0,accidental,staff:'treble'}]}});
 const CARDS=[
  {id:ID+'-neighbors',title:'Find the very next key',teach:'A half step moves to the very next piano key. Count black keys as well as white keys.',example:'C → C-sharp is one half step. C-sharp → D is another. Do not jump over a black key.',prompt:'Which key is one half step above C?',answers:['D','C-sharp','E'],correct:1,hint:'The black key between C and D is C-sharp.',visual:{kind:'keyboard',notes:['C','C-sharp','D']},covers:[]},
  {id:ID+'-whole-step',title:'Join two small steps',teach:'A whole step is two half steps. Move to the next key twice.',example:'C → C-sharp → D is one whole step. The black key counts as the first small step.',prompt:'How many half steps make a whole step?',answers:['2','1','3'],correct:0,hint:'One small step plus another small step makes a whole step.',visual:{kind:'keyboard',notes:['C','C-sharp','D']},covers:[]},
  {id:ID+'-sharp',title:'A sharp goes higher',teach:'A sharp sign, ♯, raises a note by one half step. It changes pitch, not loudness.',example:'Put ♯ before C to play C-sharp: the very next piano key higher than C.',prompt:'What does a sharp do?',answers:['Makes a note louder','Lowers a half step','Raises a half step'],correct:2,hint:'Sharp means one half step higher.',visual:accidentalScore(-2,'sharp'),covers:[]},
  {id:ID+'-flat',title:'A flat goes lower',teach:'A flat sign, ♭, lowers a note by one half step.',example:'E-flat is the very next piano key below E. Keep its letter name E and add flat.',prompt:'Where is E-flat compared with E?',answers:['One half step lower','One half step higher','The same pitch'],correct:0,hint:'Flat means one half step lower.',visual:accidentalScore(0,'flat'),covers:[]},
  {id:ID+'-natural',title:'A natural cancels a change',teach:'A natural sign, ♮, cancels a sharp or flat for that note. Return to its natural letter pitch.',example:'C-sharp changed C higher. A natural before C cancels that change, so play C natural.',prompt:'Which sign cancels a sharp or flat?',answers:['♯','♮','♭'],correct:1,hint:'The natural sign is ♮. It cancels an earlier sharp or flat.',visual:diagram('none',[note(-2,'sharp'),note(-2,'natural')],null),covers:[]},
  {id:ID+'-white-neighbors',title:'Some white keys are neighbors',teach:'E and F are a half step apart. B and C are also a half step apart.',example:'There is no black key between E–F or B–C. The very next key can be white; half steps do not always end on black keys.',prompt:'Is E → F a half step or a whole step?',answers:['A whole step','Three half steps','A half step'],correct:2,hint:'E and F are neighboring piano keys, with no key between them.',visual:{kind:'keyboard',notes:['E','F','B','C']},covers:[]},
  {id:ID+'-where-signs-go',title:'Notice where the signs sit',teach:'A local accidental sits before a note. A key signature sits after the clef and before the time signature.',example:'The shaded sign after this treble clef is the key signature. The sharp beside the later C belongs to that note.',prompt:'Where does the key signature go?',answers:['After the clef, before the time signature','Only at the very end','Inside each notehead'],correct:0,hint:'Read clef, then key signature, then time signature.',visual:diagram('G',[note(5,'sharp')]),covers:[]},
  {id:ID+'-one-sharp',title:'One sharp: change every F',teach:'A key signature with one F-sharp tells you to play F-sharp whenever an F appears.',example:'G major uses this one-sharp signature. Its notes are G A B C D E F-sharp G.',prompt:'With this signature, an F normally sounds as…',answers:['F-flat','F-sharp','F natural'],correct:1,hint:'The F-sharp in the signature changes the F notes.',visual:diagram('G',[note(1),note(8)]),covers:[]},
  {id:ID+'-one-flat',title:'One flat: change every B',teach:'A key signature with one B-flat tells you to play B-flat whenever a B appears.',example:'F major uses this one-flat signature: F G A B-flat C D E F.',prompt:'Which note does this signature change?',answers:['Every F to F-sharp','Every E to E-flat','Every B to B-flat'],correct:2,hint:'The signature shows B-flat.',visual:diagram('F',[note(4)]),covers:[]},
  {id:ID+'-two-sharps',title:'A signature can change two letters',teach:'A key signature can contain more than one sign. Two sharps here change F and C.',example:'D major uses F-sharp and C-sharp. Its notes are D E F-sharp G A B C-sharp D.',prompt:'Which notes change with this two-sharp signature?',answers:['F and C become sharp','Every note becomes sharp','Only D becomes sharp'],correct:0,hint:'Read both signs: F-sharp and C-sharp.',visual:diagram('D',[note(1),note(5)]),covers:[]},
  {id:ID+'-all-heights',title:'Keep the signature at every height',teach:'A key signature applies to its named letters at every octave. Keep using it until the key signature changes.',example:'An F-sharp signature changes both a lower F and a higher F. A new bar does not erase the key signature.',prompt:'Does an F-sharp key signature apply to a higher F too?',answers:['No, only one F','Yes, every F unless changed locally','Only in the first bar'],correct:1,hint:'The key signature follows the letter name at every height.',visual:diagram('G',[note(1),{type:'bar'},note(8)]),covers:[]},
  {id:ID+'-local-bar',title:'A local sign lasts for the bar',teach:'A local accidental changes that pitch at the same octave for the rest of its bar.',example:'The first F has a sharp. The later Fs at that same height stay sharp in this bar, even without another sign.',prompt:'After a local F-sharp, what happens to another F at the same height in that bar?',answers:['It must become flat','It must stop','It stays sharp'],correct:2,hint:'Keep the local change for the same pitch and octave until the bar line.',visual:diagram('none',[note(1,'sharp'),note(1),note(1),note(1)]),covers:[]},
  {id:ID+'-new-bar',title:'The next bar follows the signature',teach:'At the next bar, a local accidental ends. Follow the key signature again.',example:'Here there is no key signature. A local F-sharp lasts in its bar. After the bar line, F returns to F natural.',prompt:'With no key signature, what does F become in the next bar?',answers:['F natural','F-sharp forever','F-flat'],correct:0,hint:'The local sharp ends at the bar line. The empty signature means natural F.',visual:diagram('none',[note(1,'sharp'),note(1),note(1),note(1),{type:'bar'},note(1)]),covers:[]},
  {id:ID+'-natural-in-signature',title:'A natural can override the signature',teach:'A local natural can cancel a signature’s sharp for the bar. The signature returns in the next bar.',example:'The signature says F-sharp. A natural before F makes it F natural in this bar. In the next bar, F-sharp returns.',prompt:'After this bar ends, what does the next F normally become?',answers:['F-flat','F-sharp','F natural forever'],correct:1,hint:'The temporary natural ends. The F-sharp key signature still applies.',visual:diagram('G',[note(8,'natural'),note(8),note(8),note(8),{type:'bar'},note(8)]),covers:[]},
  {id:ID+'-signature-and-meter',title:'Two signatures, two jobs',teach:'The key signature changes note pitches. The time signature organizes beats into bars.',example:'One sharp changes F to F-sharp. The nearby 4/4 does a different job: four quarter-note beats in each bar.',prompt:'Which signature tells you how beats fit in a bar?',answers:['The key signature','The treble clef','The time signature'],correct:2,hint:'Time signatures organize musical time; key signatures change pitch names.',visual:diagram('G',[note(1)]),covers:[]},
  {id:ID+'-no-signs',title:'The same notes can have different homes',teach:'C major and A natural minor both use no sharps or flats in their key signatures. Their home notes differ.',example:'Both use these white-key notes: A B C D E F G. C major comes home to C. A natural minor comes home to A.',prompt:'Does an empty key signature always mean the home note must be C?',answers:['No: A natural minor shares it','Yes, always C','It means there are no notes'],correct:0,hint:'Shared notes do not force the same home note.',visual:diagram('none',[note(-2),note(3)]),covers:[]}
 ];
 const QUIZ={version:1,title:TITLE,custom:true,revision:'accidentals-key-signatures-v1',passScore:4,questions:[
  {id:ID+'-quiz-sharp',prompt:'Which sign raises a note one half step?',answers:['♯','♭','♮'],correct:0,explanation:'A sharp raises the pitch one half step.',visual:accidentalScore(-2,'sharp')},
  {id:ID+'-quiz-natural',prompt:'What does a natural sign do?',answers:['Always makes music louder','Cancels a sharp or flat for that note','Always raises a whole step'],correct:1,explanation:'A natural cancels an earlier sharp or flat.',visual:accidentalScore(0,'natural')},
  {id:ID+'-quiz-signature',prompt:'This one-sharp signature normally changes F to…',answers:['F-flat','F natural','F-sharp'],correct:2,explanation:'The F-sharp key signature applies to F notes at every height.',visual:diagram('G',[note(1),note(8)])},
  {id:ID+'-quiz-meter',prompt:'Which job belongs to the time signature?',answers:['Organize beats into bars','Make every F sharp','Choose the home note'],correct:0,explanation:'The time signature organizes beats. The key signature changes pitches.',visual:diagram('G',[note(1)])},
  {id:ID+'-quiz-next-bar',prompt:'The natural cancels F-sharp for one bar. After the bar line, what does F normally become?',answers:['F natural forever','F-sharp','F-flat'],correct:1,explanation:'The local natural ends at the bar line. Follow the F-sharp key signature again.',visual:diagram('G',[note(8,'natural'),note(8),note(8),note(8),{type:'bar'},note(8)])}
 ]};
 function create(api={}){
  const host=api.host;if(!host?.ownerDocument)throw Error('The accidentals lesson needs a host.');
  const doc=host.ownerDocument,win=doc.defaultView,content=api.content||win.CodaEducationContent;
  let storage=api.storage;if(storage===undefined)try{storage=win.localStorage;}catch{}
  const currentCards=()=>{const cards=content?.getStudyCards?.(ID);return Array.isArray(cards)?cards:CARDS;};
  const currentQuiz=()=>content?.getQuiz?.(ID)||QUIZ;
  const currentRevision=()=>content?.getLessonRevision?.(ID)||studyModule.revisionOf([currentCards(),currentQuiz()]);
  const cards=copy(currentCards()),model={...copy(currentQuiz()),custom:true},revision=currentRevision();
  let phase='study',destroyed=false,stale=false,claiming=false,error='',completedAt=0,award=null,study,quiz;
  const canRecord=()=>{try{if(stale||destroyed||api.canRecord?.()===false)return false;if(currentRevision()!==revision){stale=true;return false;}return true;}catch{return false;}};
  const node=(tag,className,text)=>{const item=doc.createElement(tag);if(className)item.className=className;if(text!==undefined)item.textContent=text;return item;};
  const button=(text,action,name)=>{const item=node('button','',text);item.type='button';if(name)item.setAttribute('data-accidentals-'+name,'');item.onclick=action;return item;};
  function getState(){return {id:ID,title:TITLE,phase,revision,completedAt,claiming,error,study:study?.getState()||null,quiz:quiz?.getState()||null};}
  const changed=()=>{try{api.onChange?.(getState());}catch{}};
  const studyReady=()=>{const state=study.getState();return state.saved&&(state.completed||state.total===0);};
  function journal(){const raw=storage?.getItem?.(quizModule.CUSTOM_KEY);if(raw===null||raw===undefined)return {version:1,quizzes:{}};const value=JSON.parse(raw);if(!object(value)||value.version!==1||!object(value.quizzes))throw Error('The quiz save could not be read.');return value;}
  function rewarded(){try{const entry=journal().quizzes[ID];return entry?.revision===revision&&Number.isSafeInteger(entry.rewardedAt)&&entry.rewardedAt>0?entry.rewardedAt:0;}catch{return 0;}}
  function stopAudio(){study?.stopAudio();}
  function renderResult(){
   if(destroyed)return;stopAudio();host.replaceChildren();const panel=node('section','classroom-exam-study');panel.dataset.accidentalsPhase=phase;host.append(panel);
   const title=node('h3','exam-study-title',phase==='complete'?'You did it!':'Let’s save your lesson');title.tabIndex=-1;title.dataset.accidentalsHeading='';panel.append(title);
   const state=quiz.getState();panel.append(node('p','',state.score+' of '+state.total+' quiz answers correct.'));
   if(error){const status=node('p','exam-study-feedback',error);status.setAttribute('role','status');panel.append(status);}
   else panel.append(node('p','',claiming?'Saving your completion…':award?.alreadyAwarded?'You already earned this lesson reward.':'Your lesson is complete. Keep practising whenever you like.'));
   if(phase!=='complete'){const retry=button(claiming?'Saving…':'Try saving reward again',claimCompletion,'save');retry.disabled=claiming||!canRecord();panel.append(retry);}
   if(phase==='complete')panel.append(button('Practice again',restart,'restart'));
   if(api.onExit)panel.append(button('Back to lessons',()=>api.onExit(),'exit'));changed();
  }
  async function claimCompletion(){
   const state=quiz.getState();if(claiming||completedAt||!canRecord()||!studyReady()||!state.passed||!state.saved||state.phase!=='result')return false;
   claiming=true;phase='reward';error='';renderResult();let expected;
   try{
    expected=JSON.stringify(journal().quizzes[ID]??null);const previous=rewarded();if(previous){completedAt=previous;phase='complete';return true;}
    if(typeof api.onComplete!=='function')throw Error('Reopen this lesson from the classroom to save its reward.');
    const result=await api.onComplete(ID,{title:TITLE,score:state.score,total:state.total,passed:true});if(result?.ok===false)throw Error(result.error||'Your reward could not save. Try again.');
    if(!canRecord())throw Error('Your profile or lesson changed. Reopen the lesson before continuing.');
    const latest=journal();if(JSON.stringify(latest.quizzes[ID]??null)!==expected)throw Error('Your player or quiz changed. Reopen the lesson before saving.');
    if(!storage?.setItem)throw Error('This device could not save your completion.');completedAt=Math.max(1,Date.now());latest.quizzes[ID]={...latest.quizzes[ID],rewardedAt:completedAt};storage.setItem(quizModule.CUSTOM_KEY,JSON.stringify(latest));award=result||null;phase='complete';error='';return true;
   }catch(failure){completedAt=0;error=failure.message||'Your completion could not save. Keep this lesson open and try again.';return false;}
   finally{claiming=false;renderResult();}
  }
  function beginQuiz(){if(!canRecord()||!studyReady())return;stopAudio();phase='quiz';quiz.render(host);changed();}
  study=studyModule.create({host,lessonId:ID,title:TITLE,cards,revision,getRevision:currentRevision,storage,canRecord,renderVisual,onComplete:beginQuiz,onExit:()=>api.onExit?.(),onChange:changed});
  quiz=quizModule.create({host,lessonId:ID,model,custom:true,contentRevision:revision,storage,canRecord,content,renderVisual,onPassed:()=>{void claimCompletion();}});
  function restart(){if(!canRecord())return false;completedAt=0;award=null;error='';quiz.restart();phase='study';study.open({restart:true});changed();return true;}
  return {open(){if(destroyed)return false;const done=rewarded(),quizState=quiz.getState();if(done&&quizState.bestScore>=quizState.passScore){completedAt=done;phase='complete';renderResult();}else if(studyReady()){phase='quiz';quiz.render(host);changed();}else{phase='study';study.open();}return true;},getState,stopAudio,destroy(){if(destroyed)return;destroyed=true;stopAudio();study.destroy();quiz.destroy();host.replaceChildren();}};
 }
 function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
 freeze(CARDS);freeze(QUIZ);return Object.freeze({ID,TITLE,CARDS,QUIZ,validateVisual,signatureSVG,renderVisual,create});
});
