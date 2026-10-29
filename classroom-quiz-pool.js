/* Three real questions for each of five lesson assessment goals. The correct
 * canonical choice index stays consistent within a goal, so existing private
 * five-goal grade records remain readable. Presentation order is randomized
 * separately by classroom-quiz.js; these are actual question/answer variants. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaClassroomQuizPool=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 const staff=(clef,position,grand=false)=>({kind:'staff',clef,position,...(grand?{grand:true}:{})});
 const meter=value=>({kind:'meter',meter:value});
 const note=beats=>({kind:'note',beats});
 const q=(prompt,answers,correct,explanation,visual)=>({prompt,answers,correct,explanation,...(visual?{visual}:{})});
 const EXTRA={
  'note-naming':[
   [q('Name this gold key.', ['C','D','G'],0,'C begins again after B.',{kind:'piano',target:7}),q('Which key is left of two black keys?',['A','C','F'],1,'C is just left of two black keys.')],
   [q('Which black-key group helps us find F?',['Two black keys','Three black keys','Four black keys'],1,'F is just left of three black keys.'),q('Which letter names this gold key?',['A','F','E'],1,'F is left of three black keys.',{kind:'piano',target:3})],
   [q('Which letter comes after B?',['D','A','C'],2,'The music alphabet goes A B C D E F G.'),q('Which letter comes before C?',['A','D','B'],2,'B comes just before C.')],
   [q('Name the note on treble Line 3.',['B','D','A'],0,'Treble lines are E G B D F.',staff('treble',4)),q('Name the note on treble Line 4.',['F','D','C'],1,'Line 4 is D: Every Good Boy Does Fine.',staff('treble',6))],
   [q('Name the note in treble Space 1.',['E','F','G'],1,'Treble spaces are F A C E.',staff('treble',1)),q('Name the note in treble Space 3.',['A','B','C'],2,'Space 3 is C in FACE.',staff('treble',5))]
  ],
  'rhythm-tree':[
   [q('How many quarters match one half note?',['1','2','4'],1,'Two quarter notes last as long as one half.'),q('How do you play this half note in 4/4?',['Play twice','Hold for two beats','Hold for four beats'],1,'Play once, then hold through both beats.',note(2))],
   [q('Two eighth notes equal which note?',['A half note','A quarter note','A whole note'],1,'Two eighths share one quarter-note beat.',note(.5)),q('How do we count two eighth notes in 4/4?',['1 &','1 2 3 4','1 only'],0,'Say 1 and &: two even parts of one beat.')],
   [q('How many half notes equal one whole note?',['1','2','4'],1,'Two halves fill the whole note.'),q('Which note fills a whole 4/4 bar?',['Quarter note','Half note','Whole note'],2,'A whole note holds through four quarter-note beats.',note(4))],
   [q('Two sixteenths equal which note?',['One eighth note','One half note','One whole note'],0,'Two sixteenths last as long as one eighth.'),q('How many sixteenths equal two eighth notes?',['2','4','8'],1,'Two eighths and four sixteenths both fill one quarter-note beat.')],
   [q('Which group fills a 4/4 bar?',['2 half notes','1 half note','3 quarter notes'],0,'Two half notes last 2 + 2 = 4 beats.'),q('Which group lasts four quarter-note beats?',['2 quarters','A half and 2 quarters','A half and an eighth'],1,'Two beats plus one plus one makes four.')]
  ],
  'time-signatures':[
   [q('What does the top 4 in 4/4 tell us?',['Four beats per bar','Four instruments','Four pitches'],0,'The top number counts beats in each bar.',meter('4/4')),q('Which notes fill one 4/4 bar?',['3 quarters','4 quarters','5 quarters'],1,'Four quarter-note beats fill a 4/4 bar.',meter('4/4'))],
   [q('How are six eighths grouped in 6/8?',['Two groups of three','Three groups of two','Six groups of three'],0,'Feel two big beats, each split into three.',meter('6/8')),q('How many eighth notes fit one BIG 6/8 beat?',['2','3','6'],1,'A big dotted-quarter beat holds three eighths.',meter('6/8'))],
   [q('How many BIG beats fill a cut-time bar?',['2','4','6'],0,'Cut time has two half-note beats.',meter('2/2')),q('Which note gets one beat in 4/4?',['Quarter note','Half note','Eighth note'],0,'The bottom 4 makes the quarter note one beat.',meter('4/4'))],
   [q('Which syllables split one BIG 6/8 beat?',['1 e & a','1 la li','1 &'],1,'The big beat has three parts: 1 la li.',meter('6/8')),q('Which count fills one 6/8 bar?',['1 la li 2 la li','1 2 3 4','1 & 2 & 3 &'],0,'Count two big beats with three parts each.',meter('6/8'))],
   [q('Does one whole note fill a cut-time bar?',['Yes','No: it fills half','No: it fills two bars'],0,'A whole note equals two half-note beats.',meter('2/2')),q('Which group fills a cut-time bar?',['2 eighths','4 quarters','3 quarters'],1,'Four quarters equal two half-note beats.',meter('2/2'))]
  ],
  'bass-clef':[
   [q('Name bass Line 2.',['B','D','A'],0,'Bass lines read G B D F A.',staff('bass',2)),q('Name bass Line 5.',['F','A','G'],1,'Bass Line 5 is A.',staff('bass',8))],
   [q('Which bass line is D?',['Line 1','Line 3','Line 5'],1,'G B D F A puts D on Line 3.'),q('Name the note on bass Line 3.',['C','D','E'],1,'Line 3 is D in Great Big Dreams For America.',staff('bass',4))],
   [q('What is the bass clef also called?',['The G clef','The F clef','The C clef'],1,'The dots mark the F line.'),q('Which bass line sits between the clef’s dots?',['Line 4: F','Line 2: B','Line 1: G'],0,'The two dots sit around Line 4, F.',staff('bass',6))],
   [q('Name bass Space 1.',['A','C','E'],0,'Bass spaces read A C E G.',staff('bass',1)),q('Name bass Space 3.',['C','D','E'],2,'Space 3 is E in All Cows Eat Grass.',staff('bass',5))],
   [q('Which bass space is G?',['Space 2','Space 4','Space 1'],1,'The four bass spaces are A C E G.'),q('Name the note in bass Space 4.',['F','G','A'],1,'Space 4 is G.',staff('bass',7))]
  ],
  'grand-staff':[
   [q('Name this upper-staff note.',['B','D','A'],0,'The upper staff is treble. Line 3 is B.',staff('treble',4,true)),q('Which clef normally belongs to the upper staff?',['Bass clef','Treble clef','A bar line'],1,'The upper grand staff normally uses treble clef.')],
   [q('Name this lower-staff note.',['C','F','E'],1,'The lower staff is bass. Line 4 is F.',staff('bass',6,true)),q('Which clef normally belongs to the lower staff?',['Treble clef','Bass clef','A time signature'],1,'The lower grand staff normally uses bass clef.')],
   [q('Where is Middle C beside treble clef?',['Below the staff','On the top line','Above the staff'],0,'Middle C uses a short line below treble.'),q('What is this short-line note called?',['C','G','B'],0,'This C is Middle C below treble.',staff('treble',-2,true))],
   [q('Where is Middle C beside bass clef?',['Below the staff','Above the staff','On Line 1'],1,'Middle C uses a short line above bass.'),q('What is this short-line bass note?',['D','C','F'],1,'This is Middle C above bass.',staff('bass',10,true))],
   [q('Why can Middle C appear by either staff?',['It has two different pitches','Both clefs can show the same pitch','It is always a rest'],1,'The two written Middle Cs name one piano key.',{kind:'middle-c-pair'}),q('How many piano keys do these two written Middle Cs name?',['One key','Two different keys','No keys'],0,'Both clefs show the same Middle C key.',{kind:'middle-c-pair'})]
  ],
  'major-minor-keys':[
   [q('What is another name for a key’s home note?',['The tonic','The tempo','The bar line'],0,'Tonic is the home note.'),q('Which note feels settled in C major?',['G','C','F'],1,'C major comes home to C.')],
   [q('What is G major’s home note?',['C','G','D'],1,'The key’s first name gives its home: G.'),q('What is A minor’s home note?',['E','C','A'],2,'A minor comes home to A.')],
   [q('Which notes make the C minor chord?',['C E G','C E-flat G','D F A'],1,'C minor lowers E to E-flat.'),q('C E-flat G changes to C E G. Which sound returns?',['C major','C minor','A minor'],0,'The natural E gives the C major sound.')],
   [q('Must minor music always sound sad?',['Yes','No','Only on piano'],1,'Minor music can have many moods.'),q('Can major music sound gentle or serious?',['Yes','No','Only if it is silent'],0,'Major describes musical relationships, not just one mood.')],
   [q('C major and A minor share which keyboard notes?',['The white keys','Only black keys','No notes'],0,'Both use the white-key notes, with different homes.'),q('Which key comes home to A?',['C major','A minor','G major'],1,'A minor settles on A, even with C major’s notes.')]
  ],
  'dynamics':[
   [q('Which instruction changes loudness?',['Play softly','Play faster','Play higher'],0,'Soft is a dynamic instruction.'),q('Are dynamics the same as tempo?',['Yes','No','Only in 4/4'],1,'Dynamics is loudness; tempo is beat speed.')],
   [q('Which sign means loud?',['p','f','pp'],1,'Forte, f, means loud.'),q('Which sign means very soft?',['ff','mf','pp'],2,'Pianissimo, pp, means very soft.')],
   [q('What does mp mean?',['Moderately soft','Very loud','Gradually faster'],0,'Mezzo piano means moderately soft.'),q('What does mezzo mean in mf?',['Very','Moderately','Suddenly'],1,'Mezzo means moderately.')],
   [q('Which instruction means gradually louder?',['Crescendo','Diminuendo','Ritardando'],0,'A crescendo gradually grows louder.'),q('During a crescendo, must the beat speed up?',['Yes','No','Only on drums'],1,'Louder does not mean faster.')],
   [q('Which instruction means gradually softer?',['Accelerando','Diminuendo','Forte'],1,'Diminuendo gradually reduces loudness.'),q('Decrescendo is another name for…',['Diminuendo','Accelerando','Mezzo forte'],0,'Both words mean gradually softer.')]
  ],
  'tempo':[
   [q('Which instruction changes tempo?',['Play faster','Play louder','Play higher'],0,'Tempo is the speed of the beat.'),q('Are speed and loudness the same?',['Yes','No','Only for piano'],1,'Tempo changes speed; dynamics changes loudness.')],
   [q('Which beat is faster?',['60 BPM','120 BPM','Both are equal'],1,'120 beats per minute is faster than 60.'),q('What does a BPM number count?',['Beats in one minute','Notes on a staff','Bars in a song'],0,'BPM measures beats per minute.')],
   [q('Which word suggests slow music?',['Presto','Largo','Allegro'],1,'Largo suggests a broad, slow tempo.'),q('Which word suggests brisk, lively music?',['Allegro','Adagio','Largo'],0,'Allegro suggests a brisk, lively tempo.')],
   [q('Which instruction means gradually faster?',['Ritardando','Accelerando','Diminuendo'],1,'Accelerando gradually speeds up the beat.'),q('During accelerando, what changes?',['Beat speed','The note letters','The clef sign'],0,'The beats gradually come closer together.')],
   [q('Which instruction means gradually slower?',['Ritardando','Crescendo','Accelerando'],0,'Ritardando gradually slows the beat.'),q('During ritardando, must the music become softer?',['Yes','No','Only on piano'],1,'Slower does not automatically mean softer.')]
  ],
  'accidentals-key-signatures':[
   [q('Which sign lowers a note one half step?',['♭','♯','♮'],0,'A flat lowers pitch one half step.'),q('A sharp moves a pitch which way?',['Up a half step','Down a half step','Up a whole octave'],0,'A sharp raises pitch one half step.')],
   [q('Which sign cancels a flat for a note?',['♯','♮','A bar line'],1,'A natural cancels a sharp or flat.'),q('After F-flat, what does F-natural mean?',['Ordinary F','F-flat again','A louder F'],0,'The natural restores F’s unaltered pitch.')],
   [q('One flat in the key signature changes which letter?',['F','C','B'],2,'One flat in the signature is B-flat.'),q('Does an F-sharp signature affect F in every octave?',['Yes','No: only one height','No: only the first bar'],0,'A key signature applies to that letter at every height.')],
   [q('Which signature changes note pitches?',['Key signature','Time signature','A note stem'],0,'The key signature sets the usual sharps or flats.'),q('What does 4/4 organize?',['Beats in each bar','Which F is sharp','The note’s loudness'],0,'The time signature organizes musical time.')],
   [q('When does a local accidental normally end?',['At the bar line','At the song’s end','After three bars'],0,'A local accidental normally lasts to the bar line.'),q('After a bar line, which pitch rule returns?',['The key signature','The previous local natural forever','Always no sharps or flats'],0,'Follow the key signature again in the new bar.')]
  ]
 };
 function poolsFor(id,model){
  if(!model||!Array.isArray(model.questions))return [];
  const extra=EXTRA[id],builtIn=model.custom!==true||id==='accidentals-key-signatures'&&model.revision==='accidentals-key-signatures-v1';
  return model.questions.map((base,slot)=>{
   const pool=[copy(base)];
   const authored=Array.isArray(model.questionPools)?model.questionPools[slot]:null;
   if(Array.isArray(authored)&&authored.length){
    const ids=new Set([base.id]);
    for(const raw of authored){
     if(!raw||typeof raw.id!=='string'||ids.has(raw.id)||typeof raw.prompt!=='string'||typeof raw.explanation!=='string'||!Array.isArray(raw.answers)||raw.answers.length!==base.answers.length||raw.answers.some(answer=>typeof answer!=='string'||!answer.trim())||new Set(raw.answers).size!==raw.answers.length||!Number.isInteger(raw.correct)||raw.correct<0||raw.correct>=raw.answers.length)continue;
     const item=copy(raw),from=item.correct,to=base.correct;
     [item.answers[from],item.answers[to]]=[item.answers[to],item.answers[from]];
     if(Array.isArray(item.answerNotes))[item.answerNotes[from],item.answerNotes[to]]=[item.answerNotes[to],item.answerNotes[from]];
     item.correct=to;pool.push(item);ids.add(item.id);
    }
    return pool;
   }
   if(!extra||!builtIn||!extra[slot])return pool;
   for(const [index,raw]of extra[slot].entries()){
    const item={...copy(raw),id:base.id+'-pool-'+(index+1)},from=item.correct,to=base.correct;
    [item.answers[from],item.answers[to]]=[item.answers[to],item.answers[from]];item.correct=to;
    pool.push(item);
   }
   return pool;
  });
 }
 return Object.freeze({VERSION:1,poolsFor});
});
