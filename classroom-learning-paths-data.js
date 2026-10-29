/* Short classroom chapters: learn the basics first, then choose the next challenge. */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./classroom-exam-curriculum.js'):root?.CodaExamCurriculum,node?require('./classroom-accidentals-lesson.js'):root?.CodaAccidentalsLesson,node?require('./final-exam-bank.js'):root?.CodaFinalExamBank,node?require('./classroom-understanding-basics.js'):root?.CodaUnderstandingBasics,node?require('./classroom-understanding-staff.js'):root?.CodaUnderstandingStaff);
 if(node)module.exports=api;if(root)root.CodaClassroomLearningPathsData=api;
})(typeof window==='undefined'?null:window,function(curriculum,accidentals,examBank,basicsChecks,staffChecks){
 'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 const newCard=(id,title,teach,example,prompt,answers,correct,hint,visual)=>({id,title,teach,example,prompt,answers,correct,hint,covers:[],...(visual?{visual}:{})});
 const parts=(focus,beats=.5)=>({kind:'note-parts',focus,beats});
 const clef=(value,page)=>({kind:'clef-intro',clef:value,page});
 const rhythm=values=>({kind:'rhythm',meter:'4/4',notes:values.map(beats=>({beats:Math.abs(beats),rest:beats<0}))});
 const tree=level=>({kind:'rhythm-tree',level});
 const EXTRA=freeze({
  'note-naming':[
   newCard('path-treble-clef','Meet the treble clef','A clef is the sign at the start of a staff. It helps us find the note names.','The treble clef curls around the second line from the bottom. That line is G. It is also called the G clef.','What does a clef help us find?',['The note names','The instrument’s colour','How loud to play'],0,'The clef is a guide to the note names.',clef('treble','clef')),
   newCard('path-treble-lines-reminder','Learn the line reminder','For treble lines, remember Every Good Boy Does Fine. Number the lines 1–5 from bottom to top: E G B D F.','Line 1: E (Every). Line 2: G (Good). Line 3: B (Boy). Line 4: D (Does). Line 5: F (Fine).','Which way do we read the line reminder?',['Bottom to top','Top to bottom','Right to left'],0,'Start at the lowest line, then move upward.',clef('treble','lines')),
   newCard('path-treble-spaces-reminder','Learn the space reminder','For treble spaces, remember FACE. Number the spaces 1–4 from bottom to top: F A C E.','Space 1: F. Space 2: A. Space 3: C. Space 4: E.','Does FACE help us name the lines or the spaces?',['The spaces','The lines','The bar lines'],0,'The gaps between the lines spell FACE from bottom to top.',clef('treble','spaces'))
  ],
  'bass-clef':[
   newCard('path-bass-staff','Meet the staff','A staff has five lines and four spaces. We count them from the bottom to the top.','Point to the bottom line. Move upward through all five lines. The four gaps between the lines are called spaces.','How many lines does a staff have?',['5','4','7'],0,'Count the lines from the bottom: 1, 2, 3, 4, 5.',clef('bass','staff')),
   newCard('path-bass-clef','Meet the bass clef','The bass clef helps us read lower notes. Its two dots sit above and below the F line.','Find the sign at the start of this staff. The line between its dots is F. That is why we also call it the F clef.','What is the bass clef also called?',['The F clef','The G clef','The loud clef'],0,'Its two dots help you find F.',clef('bass','clef')),
   newCard('path-bass-lines-reminder','Learn the bass line reminder','For bass lines, remember Great Big Dreams For America. Number the lines 1–5 from bottom to top: G B D F A.','Line 1: G (Great). Line 2: B (Big). Line 3: D (Dreams). Line 4: F (For). Line 5: A (America).','Which way do we read this bass line reminder?',['Bottom to top','Top to bottom','Right to left'],0,'Start at the lowest line and move upward.',clef('bass','lines')),
   newCard('path-bass-spaces-reminder','Learn the bass space reminder','For bass spaces, remember All Cows Eat Grass. Number the spaces 1–4 from bottom to top: A C E G.','Space 1: A (All). Space 2: C (Cows). Space 3: E (Eat). Space 4: G (Grass).','Does All Cows Eat Grass name bass lines or bass spaces?',['The spaces','The lines','The bar lines'],0,'This reminder names the spaces between the lines.',clef('bass','spaces'))
  ],
  'rhythm-tree':[
   newCard('path-note-head','Find the notehead','The notehead is the round part of a note. It can be filled in or hollow.','Point to the round part at the bottom of this note. That is its notehead. It is different from the tall line.','Which part is the notehead?',['The round part','The tall line','The curved flag'],0,'Head means the round part.',parts('head')),
   newCard('path-note-stem','Find the stem','The stem is the tall straight line joined to a notehead. It can point up or down.','Follow this straight line away from the round notehead. That is the stem. Changing its direction does not change the note’s name.','Which part is the stem?',['The round part','The straight line','The curvy flag'],1,'A stem is straight, like a flower’s stem.',parts('stem')),
   newCard('path-note-flag','Find the flag','A flag is the curved part at the end of a stem. Not every note has a flag.','This note has one flag. The flag joins the stem, not the notehead. Soon we will see what it tells us about length.','Where does the flag join the note?',['At the end of its stem','In the middle of its head','On a bar line'],0,'Look at the curved part at the end of the tall line.',parts('flag')),
   newCard('path-half-note','Meet the half note','A half note has a hollow head and a stem. In 4/4, we hold it for two beats.','Play once on 1. Keep holding on 2. Do not play a new sound on 2.','How many beats does a half note last in 4/4?',['2 beats','1 beat','4 beats'],0,'Keep holding as you count 1, 2.',parts('all',2)),
   newCard('path-eighth-note','Meet the eighth note','An eighth note has a filled head, a stem, and one flag. Two eighth notes share one quarter-note beat.','In 4/4, count “1 &”. Play the first eighth on 1 and the second on &. Together they take one beat.','How many eighth notes fit one quarter-note beat?',['2','1','4'],0,'Say both parts: 1, &.',parts('all',.5)),
   newCard('path-tree-whole-halves','Split a whole into halves','One whole note can split into two equal half notes. Their total time stays the same.','In 4/4, the whole lasts 4 beats. Each half lasts 2. Two halves: 2 + 2 = 4 beats.','How many half notes match one whole note?',['2','4','8'],0,'Split the long note into two equal pieces.',tree(1)),
   newCard('path-tree-half-quarters','Split a half into quarters','One half note can split into two equal quarter notes. The pieces still fill the same time.','In 4/4, a half lasts 2 beats. Two quarters last 1 + 1 = 2 beats.','How many quarter notes match one half note?',['2','4','1'],0,'One beat plus one beat fills the half note.',tree(2)),
   newCard('path-tree-quarter-eighths','Split a quarter into eighths','One quarter note can split into two equal eighth notes. Two eighths still fill just one quarter-note beat.','The tree goes whole → half → quarter → eighth. Each branch splits one note into two equal shorter notes.','How many eighth notes match one quarter note?',['2','4','8'],0,'Each branch makes two equal pieces.',tree(3)),
   newCard('path-count-quarters','Count one note on each beat','In 4/4, count 1, 2, 3, 4. Play a quarter note on each number.','Say 1, 2, 3, 4 evenly. Clap once on every number. Start the next bar at 1 again.','Which count matches four quarter notes in 4/4?',['1 2 3 4','1 &','1 3'],0,'There is one sound on each of the four numbers.',rhythm([1,1,1,1])),
   newCard('path-count-held-notes','Keep counting while you hold','A long note keeps sounding while the beats continue. Count each beat, but play the note only once.','A whole note in 4/4: play on 1 and hold through 2, 3, 4. Two half notes: play on 1 and 3.','What do you count while holding a whole note in 4/4?',['1 2 3 4','Only 1','1 & a'],0,'The sound stays on while all four beats pass.',rhythm([4])),
   newCard('path-count-eighths','Count the space between beats','To count eighth notes in 4/4, add “&” halfway between the beat numbers.','Say 1 & 2 & 3 & 4 &. Keep the numbers even. Each & is halfway to the next number.','Which count matches two eighth notes on beat 1?',['1 &','1 2','1 2 3'],0,'One beat splits into the number and its &.',rhythm([.5,.5,1,1,1])),
   newCard('path-count-rests','Keep the beat during silence','A rest means stay silent for its length. Keep counting so the next sound starts at the right time.','In 4/4: play on 1, stay silent on 2, then play on 3 and 4. Your counting never stops.','What should you do during a rest?',['Keep counting silently','Stop the beat','Skip the next number'],0,'The sound pauses; the beat keeps going.',rhythm([1,-1,1,1])),
   newCard('path-sixteenth-note','Two flags make sixteenths','A sixteenth note has two flags. Four sixteenth notes fit into one quarter-note beat.','Say “1 e & a” evenly across one beat. Each syllable gets one sixteenth note. Two beams can join the flags of grouped notes.','Which count splits beat 1 into four equal parts?',['1 e & a','1 &','1 2 3 4'],0,'Keep all four parts inside just one beat.',{kind:'note',beats:.25})
  ],
  'major-minor-keys':[
   newCard('path-key-home','A tune has a home','A key gives music a home note. The tune often feels settled when it comes back to that note.','C major comes home to C. A minor comes home to A. Start by listening for where a tune feels finished.','What is the home note of C major?',['C','G','A'],0,'The first part of the key name tells its home.',{kind:'scale',notes:['C','E','G','C']})
  ],
  tempo:[
   newCard('path-tempo-meaning','Meet tempo','Tempo means how fast or slow the steady beat goes. It does not mean loud or soft.','Tap a slow, even beat. Now tap an even beat a little faster. You changed the tempo.','What does tempo tell us?',['How fast the beat goes','How loud to play','Which note name to use'],0,'Tempo is the speed of the beat.',{kind:'tempo',text:'A steady beat',bpm:80})
  ]
 });
 const section=(id,title,tier,ids)=>({id,title,tier,ids});
 const basic=(id,title,...ids)=>section(id,title,'basic',ids);
 const advanced=(id,title,...ids)=>section(id,title,'advanced',ids);
 const DEFINITIONS=freeze([
  {id:'note-naming',title:'Pitch: treble & note names',intro:'Learn the note-name map, one small step at a time.',sections:[
   basic('alphabet-and-keys','The musical alphabet & piano keys','treble-musical-alphabet','treble-keyboard-landmarks'),
   basic('staff-and-clef','The staff & treble clef','treble-staff-parts','path-treble-clef','treble-check-clef'),
   basic('treble-reminders','Learn both line & space reminders','path-treble-lines-reminder','path-treble-spaces-reminder'),
   basic('treble-lines','Treble lines: Every Good Boy Does Fine','treble-all-lines'),
   basic('treble-spaces','Treble spaces: FACE','treble-all-spaces'),
   basic('read-noteheads','Read the notehead','treble-read-notehead','treble-one-move'),
   advanced('staff-moves','More staff moves & little lines','treble-two-moves','treble-ledger-middle-c'),
   advanced('changed-pitches','Half steps, sharps, flats & naturals','treble-half-step','treble-sharp-sign','treble-flat-sign','treble-natural-sign')
  ]},
  {id:'bass-clef',title:'Bass clef',intro:'Meet the lower-note map before naming its notes.',sections:[
   basic('staff-and-clef','The staff & bass clef','path-bass-staff','path-bass-clef'),
   basic('bass-reminders','Learn both bass reminders','path-bass-lines-reminder','path-bass-spaces-reminder'),
   basic('bass-lines','Bass lines: Great Big Dreams For America','bass-all-lines'),
   basic('bass-spaces','Bass spaces: All Cows Eat Grass','bass-all-spaces'),
   basic('read-bass-notes','Read the head & choose a reminder','bass-f-clef','bass-notehead-place','bass-check-reminder','bass-one-move'),
   advanced('bass-moves','Two moves, three moves & the alphabet loop','bass-two-moves','bass-three-moves','bass-alphabet-wrap'),
   advanced('bass-middle-c','Middle C above bass','bass-middle-c')
  ]},
  {id:'grand-staff',title:'Grand staff & Middle C',intro:'Put the two note-name maps together.',sections:[
   basic('two-staffs','Two staffs & the brace','grand-two-staffs','grand-brace-hands'),
   basic('upper-staff','The upper treble staff','grand-treble-lines','grand-treble-spaces'),
   basic('lower-staff','The lower bass staff','grand-bass-lines','grand-bass-spaces'),
   basic('middle-c','Meet Middle C','grand-middle-c-same-key','grand-notehead-not-stem'),
   advanced('grand-staff-moves','Find notes on either staff','grand-compare-landmarks','grand-one-move','grand-middle-c-neighbors'),
   advanced('playing-together','Notes that line up play together','grand-play-together')
  ]},
  {id:'rhythm-tree',title:'Rhythm',intro:'Start with the parts of a note. Build up to reading and counting rhythms.',sections:[
   basic('note-parts','Note parts: head, stem & flag','path-note-head','path-note-stem','path-note-flag'),
   basic('note-symbols','Note symbols: quarter, half, whole & eighth','rhythm-tree-quarter-note','path-half-note','rhythm-tree-whole-and-half','path-eighth-note'),
   basic('rhythm-tree','The rhythm tree','path-tree-whole-halves','path-tree-half-quarters','path-tree-quarter-eighths'),
   basic('counting','Counting notes & keeping the beat','rhythm-tree-beat-and-rhythm','path-count-quarters','path-count-held-notes','path-count-eighths','path-count-rests'),
   advanced('sixteenth-notes','Sixteenth notes & counting 1 e & a','path-sixteenth-note','rhythm-tree-short-notes','rhythm-tree-split-note-lengths','rhythm-tree-compare-lengths','rhythm-tree-beams-and-flags'),
   advanced('dotted-notes','Dotted notes & dotted rests','rhythm-tree-dots','rhythm-tree-dotted-rests'),
   advanced('rests','Long & short rests','rhythm-tree-long-rests','rhythm-tree-short-rests'),
   advanced('building-rhythms','Build bars, add lengths & hold ties','rhythm-tree-fraction-pieces','rhythm-tree-add-note-lengths','rhythm-tree-fill-four-beats','rhythm-tree-ties','rhythm-tree-beat-depends-on-meter')
  ]},
  {id:'time-signatures',title:'Time signatures',intro:'Learn how beats make bars, then explore different beat groups.',sections:[
   basic('bars','Beats, bars & bar lines','time-signatures-bars'),
   basic('the-numbers','What the two numbers mean','time-signatures-read-top','time-signatures-read-bottom'),
   basic('simple-meters','Count 2/4, 3/4 & 4/4','time-signatures-two-four','time-signatures-three-four','time-signatures-four-four'),
   basic('silent-beats','Keep counting through rests','time-signatures-rests-fill-time'),
   advanced('other-beat-groups','Cut time & 6/8','time-signatures-cut-time','time-signatures-six-eight'),
   advanced('smaller-pieces','The same time in smaller pieces','time-signatures-convert-eighths','time-signatures-convert-sixteenths','time-signatures-written-unit'),
   advanced('finish-bars','Fill bars & count more than one bar','time-signatures-finish-bar','time-signatures-half-lengths','time-signatures-quarter-lengths','time-signatures-two-bars'),
   advanced('compare-meters','Compare meter, pulse & tempo','time-signatures-compare-bars','time-signatures-same-length-different-beats','time-signatures-three-four-versus-six-eight','time-signatures-meter-versus-tempo')
  ]},
  {id:'major-minor-keys',title:'Major & minor keys',intro:'Find a home note, follow a scale, then build more patterns.',sections:[
   basic('home-note','Find the home note','path-key-home','major-minor-keys-home'),
   basic('scale-ladder','Follow the note-letter ladder','major-minor-keys-letter-ladder'),
   basic('small-steps','Small steps & changed notes','major-minor-keys-key-steps','major-minor-keys-accidentals'),
   basic('major-and-minor','Major, minor & musical colour','major-minor-keys-parallel-colour','major-minor-keys-many-moods'),
   advanced('building-scales','Build a major scale & number its notes','major-minor-keys-major-pattern','major-minor-keys-scale-numbers','major-minor-keys-third-note'),
   advanced('shared-notes','Related homes & three-note chords','major-minor-keys-relative-home','major-minor-keys-triads','major-minor-keys-check-the-list')
  ]},
  {id:'dynamics',title:'Dynamics: loud & soft',intro:'Learn a few loudness signs, then practise changing the sound.',sections:[
   basic('loud-and-soft','Loud, soft & dynamics','dynamics-loudness','dynamics-piano-forte'),
   basic('more-levels','Very soft, very loud & the middle','dynamics-very-soft-loud','dynamics-middle-levels'),
   basic('loudness-order','Put loudness signs in order','dynamics-loudness-ladder'),
   advanced('gradual-loudness','Grow louder & fade softer','dynamics-crescendo','dynamics-decrescendo'),
   advanced('play-as-a-group','Follow the signs & listen to the group','dynamics-one-change','dynamics-listen-together','dynamics-arrive-at-mark')
  ]},
  {id:'tempo',title:'Tempo: fast & slow',intro:'Find the beat’s speed, then learn how that speed can change.',sections:[
   basic('tempo-and-beat','Tempo, beat & rhythm','path-tempo-meaning','tempo-beat-and-rhythm'),
   basic('tempo-words','Slow, walking, moderate & fast words','tempo-slow-words','tempo-middle-words','tempo-fast-words'),
   basic('bpm','Beats per minute','tempo-bpm-number'),
   advanced('tempo-changes','Speed up, slow down & return','tempo-accelerando','tempo-ritardando','tempo-return'),
   advanced('beats-and-seconds','Beats, seconds & the beat note','tempo-beat-seconds','tempo-groups-of-beats','tempo-beat-note'),
   advanced('two-instructions','Speed & loudness can change together','tempo-two-changes')
  ]},
  {id:'accidentals-key-signatures',title:'Accidentals & key signatures',intro:'Learn one pitch-changing sign at a time, then read key signatures.',sections:[
   basic('keyboard-steps','Half steps & whole steps','accidentals-key-signatures-neighbors','accidentals-key-signatures-whole-step','accidentals-key-signatures-white-neighbors'),
   basic('pitch-signs','Sharp, flat & natural signs','accidentals-key-signatures-sharp','accidentals-key-signatures-flat','accidentals-key-signatures-natural'),
   basic('key-signatures','Meet the key signature','accidentals-key-signatures-where-signs-go','accidentals-key-signatures-one-sharp','accidentals-key-signatures-one-flat'),
   advanced('more-signature-signs','Two sharps & every height','accidentals-key-signatures-two-sharps','accidentals-key-signatures-all-heights'),
   advanced('local-accidentals','A local sign lasts for its bar','accidentals-key-signatures-local-bar','accidentals-key-signatures-new-bar','accidentals-key-signatures-natural-in-signature'),
   advanced('two-signatures','Key signatures, time signatures & shared notes','accidentals-key-signatures-signature-and-meter','accidentals-key-signatures-no-signs')
  ]}
 ]);
 const CATEGORIES=freeze(DEFINITIONS.map(({id,title,intro})=>({id,title,intro})));
 const definition=id=>DEFINITIONS.find(value=>value.id===id)||null;
 const MAP_VISUALS=freeze({'treble-all-lines':clef('treble','lines'),'treble-all-spaces':clef('treble','spaces'),'bass-all-lines':clef('bass','lines'),'bass-all-spaces':clef('bass','spaces')});
 const ORDINALS={first:1,second:2,third:3,fourth:4,fifth:5};
 function numberedStaffText(value){
  return String(value).replace(/\b(first|second|third|fourth|fifth)\s+((?:treble|bass|upper|lower)\s+)?(line|space)(?:\s+from\s+the\s+bottom)?/gi,(_,ordinal,clef,kind)=>(clef||'')+(kind.toLowerCase()==='line'?'Line ':'Space ')+ORDINALS[ordinal.toLowerCase()])
   .replace(/\b(first|second|third|fourth|fifth),?\s+or\s+(?:the\s+)?(?:top|bottom|middle),?\s+(line|space)/gi,(_,ordinal,kind)=>(kind.toLowerCase()==='line'?'Line ':'Space ')+ORDINALS[ordinal.toLowerCase()])
   .replace(/\b(bottom|middle|top)[ -](treble[ -]|bass[ -])?(line|space)\b/gi,(_,where,clef,kind)=>(clef||'').replace('-',' ')+(kind.toLowerCase()==='line'?'Line ':'Space ')+(where.toLowerCase()==='bottom'?1:where.toLowerCase()==='middle'?3:kind.toLowerCase()==='line'?5:4))
   .replace(/\b(line|space)\s+([1-5])\s+from\s+the\s+bottom\b/gi,(_,kind,n)=>(kind.toLowerCase()==='line'?'Line ':'Space ')+n);
 }
 function numberStaffCard(card,lessonId){
  if(!['note-naming','bass-clef','grand-staff'].includes(lessonId))return card;
  for(const key of ['teach','example','prompt','hint'])if(typeof card[key]==='string')card[key]=numberedStaffText(card[key]);
  card.answers=card.answers.map(numberedStaffText);return card;
 }
 function defaultPool(id){
  return [...(id===accidentals?.ID?accidentals.CARDS:curriculum?.forLesson?.(id)||[]),...(EXTRA[id]||[])].map(source=>{
   const card=copy(source);if(MAP_VISUALS[card.id])card.visual=copy(MAP_VISUALS[card.id]);
   // These introductory meter examples use only values taught in basic rhythm.
   if(card.id==='time-signatures-two-four')card.example='Count ONE, two | ONE, two. Two quarter notes fill one bar. Four eighth notes fill the same time.';
   if(card.id==='time-signatures-four-four')card.example='Count ONE, two, three, four. Two halves fill one bar: 2 + 2 = 4. Eight eighth notes fill the same time.';
   return numberStaffCard(card,id);
  });
 }
 function getCards(id){
  const model=definition(id);if(!model)return [];
  const byId=new Map(defaultPool(id).map(card=>[card.id,card]));
  return model.sections.flatMap(section=>section.ids.flatMap(id=>byId.has(id)?[copy(byId.get(id))]:[]));
 }
 const questionById=new Map((examBank?.QUESTIONS||[]).map(question=>[question.id,question]));
 const supplemental={...(basicsChecks?.CHECKS||{}),...(staffChecks?.CHECKS||{})};
 function getChecks(lessonId,card){
  const base=copy(card);
  if(Array.isArray(base.checks))return [base,...copy(base.checks)];
  const original=getCards(lessonId).find(value=>value.id===card?.id);
  // Teacher-written or edited steps keep their own check. Never append material
  // merely because an authored card reused a built-in identifier.
  if(!original||['teach','example','prompt','answers','correct','hint','visual'].some(key=>JSON.stringify(base[key]??null)!==JSON.stringify(original[key]??null)))return [base];
  const candidates=supplemental[base.id]||((base.covers||[]).map(id=>questionById.get(id)).filter(Boolean).map(question=>({prompt:question.prompt,answers:question.choices.map(choice=>choice.text),correct:question.choices.findIndex(choice=>choice.id===question.answer),hint:question.explanation,visual:question.stimulus?copy(question.stimulus):undefined})));
  const result=[base],seen=new Set();
  const signature=question=>JSON.stringify([question.prompt.trim().toLowerCase(),question.answers[question.correct].trim().toLowerCase(),/highlighted|shown|this|these/i.test(question.prompt)?question.visual||null:null]);
  seen.add(signature(base));
  const basicRhythm=lessonId==='rhythm-tree'&&definition(lessonId).sections.some(section=>section.tier==='basic'&&section.ids.includes(base.id));
  for(const source of candidates){
   const check=copy(source);numberStaffCard(check,lessonId);
   // Keep a neutral keyboard reference beside key-location questions. Preserve
   // a check's own diagram when it asks about a particular score or scale.
   if(!check.visual&&base.visual?.kind==='keyboard')check.visual={kind:'keyboard',notes:[]};
   if(basicRhythm&&/sixteenth|16th|dotted|1 e & a/i.test(JSON.stringify(check)))continue;
   const key=signature(check);if(seen.has(key))continue;seen.add(key);result.push(check);if(result.length===3)break;
  }
  return result;
 }
 function quizFor(category){
  const basicCards=category.sections.filter(section=>section.tier==='basic').flatMap(section=>section.cards);
  // Pick from across the whole basic path, rather than quizzing only its first lesson.
  const count=Math.min(5,basicCards.length),picked=[];
  for(let index=0;index<count;index++){const at=count===1?0:Math.round(index*(basicCards.length-1)/(count-1));picked.push(basicCards[at]);}
  const questions=picked.map(card=>({id:'basics-'+card.id,prompt:card.prompt,answers:copy(card.answers),correct:card.correct,explanation:card.hint,visual:card.visual?copy(card.visual):null,...(card.visuals?{visuals:copy(card.visuals)}:{})}));
  const questionPools=picked.map((card,index)=>getChecks(category.id,card).filter(check=>check.answers.length===questions[index].answers.length).map((check,at)=>({id:at===0?questions[index].id:questions[index].id+'-check-'+(at+1),prompt:check.prompt,answers:copy(check.answers),correct:check.correct,explanation:check.hint,visual:check.visual?copy(check.visual):null,...(check.visuals?{visuals:copy(check.visuals)}:{})})));
  return {version:1,title:category.title+' — Basics quiz',custom:true,passScore:Math.ceil(count*.8),questions,questionPools};
 }
 function getCategory(id,options={}){
  const model=definition(id);if(!model)return null;
  const authored=options.content?.getStudyCards?.(id),metadata=options.content?.getLesson?.(id),cards=Array.isArray(authored)?copy(authored):getCards(id),definitions=Array.isArray(metadata?.sections)?metadata.sections:null,known=new Set((definitions||model.sections).flatMap(section=>section.cardIds||section.ids));
  const sections=(definitions||model.sections).map(section=>({id:section.id,title:section.title,tier:section.tier,cards:definitions?(section.cardIds||[]).flatMap(cardId=>{const card=cards.find(card=>card.id===cardId);return card?[card]:[];}):cards.filter(card=>section.ids.includes(card.id))})).filter(section=>section.cards.length);
  const extras=cards.filter(card=>!known.has(card.id));if(extras.length){let extraId='additional-practice';while(sections.some(section=>section.id===extraId))extraId+='-extra';sections.push({id:extraId,title:'Additional practice',tier:'advanced',cards:extras});}
  const result={id:model.id,title:typeof metadata?.title==='string'?metadata.title:model.title,intro:typeof metadata?.intro==='string'?metadata.intro:model.intro,sections};result.basicsQuiz=quizFor(result);return result;
 }
 function basicsQuiz(value,options={}){const category=typeof value==='string'?getCategory(value,options):value;return category?quizFor(category):null;}
 function validate(){
  const errors=[];
  for(const model of DEFINITIONS){
   const expected=defaultPool(model.id),seen=new Set();
   for(const section of model.sections){if(!['basic','advanced'].includes(section.tier))errors.push(model.id+': invalid tier');for(const id of section.ids){if(seen.has(id))errors.push(model.id+': duplicate card '+id);seen.add(id);if(!expected.some(card=>card.id===id))errors.push(model.id+': unknown card '+id);}}
   for(const card of expected)if(!seen.has(card.id))errors.push(model.id+': missing card '+card.id);
   if(!model.sections.some(section=>section.tier==='basic')||!model.sections.some(section=>section.tier==='advanced'))errors.push(model.id+': needs basics and advanced sections');
   if(getCategory(model.id).basicsQuiz.questions.length!==5)errors.push(model.id+': needs five basic checks');
  }
  return {ok:errors.length===0,errors};
 }
 return Object.freeze({CATEGORIES,DEFINITIONS,EXTRA,getCards,getCategory,getChecks,numberedStaffText,basicsQuiz,validate});
});
