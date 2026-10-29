/* Hands-on music lessons. Numeric pitches stay inside the audio engine. */
(function(root,factory){const node=typeof module==='object'&&module.exports,notation=node?require('./music-notation.js'):root?.CodaMusicNotation,timeLesson=node?require('./time-signature-lesson.js'):root?.CodaTimeSignatureLesson;const quizModule=node?require('./classroom-quiz.js'):root?.CodaClassroomQuiz;const api=factory(notation,timeLesson,quizModule);if(node)module.exports=api;if(root)root.CodaClassroomTutorials=api;})(typeof window!=='undefined'?window:null,function(notation,timeLesson,quizModule){
 'use strict';
 const KEY='codaClassroomLessonsV1',CUSTOM_KEY='codaAuthoredLessonsV1';
 const VALUES=Object.freeze([
  {units:16,name:'whole',label:'Whole note',beats:'4 beats',count:1},
  {units:8,name:'half',label:'Half note',beats:'2 beats',count:2},
  {units:4,name:'quarter',label:'Quarter note',beats:'1 beat',count:4},
  {units:2,name:'eighth',label:'Eighth note',beats:'half a beat',count:8},
  {units:1,name:'sixteenth',label:'Sixteenth note',beats:'a quarter of a beat',count:16}
 ].map(Object.freeze));
 const NOTE_STEPS=Object.freeze([
  {
    "kind": "keys",
    "answer": "C",
    "pitch": 60,
    "prompt": "Tap C on the white keys below.",
    "teach": "Piano notes use seven letters: A B C D E F G. Then the letters repeat.",
    "example": "Find TWO black keys together. The white key just to their left is C.",
    "hint": "Find the two black keys. Tap the white key immediately to their left."
  },
  {
    "kind": "keys",
    "answer": "F",
    "pitch": 65,
    "prompt": "Tap F on the white keys below.",
    "teach": "Black keys also make groups of THREE. You can use that group to find F.",
    "example": "The white key just to the left of THREE black keys is F.",
    "hint": "Find the three black keys. Tap the white key immediately to their left."
  },
  {
    "kind": "keys",
    "answer": "D",
    "pitch": 62,
    "prompt": "Tap D on the white keys below.",
    "teach": "Move right to follow the note letters: C, D, E, F, G, A, B.",
    "example": "C → D: move ONE white key to the right from C.",
    "hint": "Find C beside the two black keys. D is the next white key to its right."
  },
  {
    "kind": "keys",
    "answer": "A",
    "pitch": 69,
    "prompt": "Tap A on the white keys below.",
    "teach": "After G, the next letter is A. The musical alphabet starts again.",
    "example": "F → G → A: start on F and move TWO white keys to the right.",
    "hint": "Find F beside the three black keys. Move right to G, then right once more to A."
  },
  {
    "kind": "staff",
    "answer": "E",
    "pitch": 64,
    "position": 0,
    "prompt": "Tap the letter for the purple note.",
    "teach": "The same note letters can be shown on five lines called a staff. Read the round notehead, not its tall stem.",
    "example": "Start at the BOTTOM line. A note on that line is E.",
    "hint": "The purple circle sits ON the bottom line. That line is E. Tap E below."
  },
  {
    "kind": "staff",
    "answer": "F",
    "pitch": 65,
    "position": 1,
    "prompt": "Tap the letter for the purple note.",
    "teach": "Notes can sit on a line or in a space between two lines. Count upward from the bottom.",
    "example": "Bottom line E → first SPACE F.",
    "hint": "The circle is in the first space above the bottom line. E → F. Tap F."
  },
  {
    "kind": "staff",
    "answer": "G",
    "pitch": 67,
    "position": 2,
    "prompt": "Tap the letter for the purple note.",
    "teach": "Each next line or space moves one letter forward.",
    "example": "Bottom line E → space F → next LINE G.",
    "hint": "Start on bottom-line E. Count E, F, G. This note is G."
  },
  {
    "kind": "staff",
    "answer": "A",
    "pitch": 69,
    "position": 3,
    "prompt": "Tap the letter for the purple note.",
    "teach": "The spaces spell FACE (F A C E), starting at the bottom space.",
    "example": "First space F → second SPACE A.",
    "hint": "Count only the spaces from the bottom: F, A. Tap A."
  },
  {
    "kind": "staff",
    "answer": "B",
    "pitch": 71,
    "position": 4,
    "prompt": "Tap the letter for the purple note.",
    "teach": "The line letters are E G B D F, starting at the bottom line. Remember: Every Good Boy Does Fine.",
    "example": "First line E → second line G → middle LINE B.",
    "hint": "Count only the lines from the bottom: E, G, B. Tap B."
  },
  {
    "kind": "staff",
    "answer": "C",
    "pitch": 72,
    "position": 5,
    "prompt": "Tap the letter for the purple note.",
    "teach": "Use the space letters F A C E again. Count from the bottom space.",
    "example": "First space F → second space A → third SPACE C.",
    "hint": "Count the spaces: F, A, C. The note is in the third space. Tap C."
  }
].map(Object.freeze));
 const staffStep=(clef,position,answer,pitch,teach,example,hint,grand=false)=>Object.freeze({kind:'staff',clef,grand,position,answer,pitch,prompt:'Check the clef. Tap the letter for the purple note.',teach,example,hint});
 const BASS_STEPS=Object.freeze([
  staffStep('bass',0,'G',43,'Bass clef helps us read lower sounds. It has a curved shape and two dots. Keep counting lines from the bottom.','Bass lines, bottom to top: G B D F A. Remember: Great Big Dreams For America.','The note sits on the bottom bass line. Great begins with G. Tap G.'),
  staffStep('bass',2,'B',47,'Each word helps you remember one LINE: Great Big Dreams For America. Start at the bottom every time.','First line G → second line B. Big begins with B.','Count only the lines: G, B. This note is B.'),
  staffStep('bass',4,'D',50,'The middle line is the third of the five lines. Find a line you know, then count upward.','Great Big Dreams: G, B, D. The middle line is D.','The purple head sits on the middle line. Dreams begins with D.'),
  staffStep('bass',6,'F',53,'The bass clef’s two dots sit on either side of the F line. Use that line as a landmark.','G B D F A: F is the fourth line from the bottom.','Find the line between the two dots. That line is F.'),
  staffStep('bass',8,'A',57,'Finish the five line names: Great Big Dreams For America. Read upward from the bottom.','G B D F A: America gives A on the top line.','The top line is the fifth line. America begins with A.'),
  staffStep('bass',1,'A',45,'Spaces have their own reminder. Bass spaces, bottom to top: A C E G. Remember: All Cows Eat Grass.','The first bass SPACE is A. All begins with A.','The round head is between the bottom two lines. The bottom space is A.'),
  staffStep('bass',3,'C',48,'For a space note, use All Cows Eat Grass. Count spaces from the bottom.','First space A → second space C.','Count only spaces: All, Cows. Cows begins with C.'),
  staffStep('bass',5,'E',52,'Keep the lines and spaces separate when using a reminder. This note sits in a space.','All Cows Eat: A, C, E. The third space is E.','Count three spaces upward: A, C, E. Tap E.'),
  staffStep('bass',7,'G',55,'You can now use both bass reminders: Great Big Dreams For America for lines; All Cows Eat Grass for spaces.','A C E G: Grass gives G in the top space.','The note sits in the fourth space. Grass begins with G.')
 ]);
 const GRAND_STEPS=Object.freeze([
  staffStep('treble',0,'E',64,'A grand staff joins two staffs: treble above bass. Check which clef belongs to the purple note before naming it.','Treble lines, bottom to top: Every Good Boy Does Fine = E G B D F.','This note belongs to the upper, treble staff. Its bottom line is E.',true),
  staffStep('bass',0,'G',43,'The lower staff uses bass clef. A note in the same place on a different clef can have a different letter.','Bass lines, bottom to top: Great Big Dreams For America = G B D F A.','This note belongs to the lower, bass staff. Its bottom line is G.',true),
  staffStep('treble',3,'A',69,'Treble spaces spell FACE. Count F A C E from the bottom space of the upper staff.','First treble space F → second treble space A.','Check the treble clef, then count two spaces: F, A.',true),
  staffStep('bass',3,'C',48,'Bass spaces use All Cows Eat Grass. Count A C E G from the bottom space of the lower staff.','First bass space A → second bass space C.','Check the bass clef, then count two spaces: A, C.',true),
  staffStep('treble',-2,'C',60,'A short extra line is a ledger line. Middle C sits on one ledger line BELOW the treble staff, between the two staffs.','Middle C → D in the space → E on the bottom treble line.','Find the little line below treble. The note on it is Middle C. Tap C.',true),
  staffStep('bass',10,'C',60,'Middle C can also sit on one ledger line ABOVE the bass staff. It is the SAME piano key and sound as Middle C below treble.','Top bass line A → space B → ledger line Middle C.','Find the little line above bass. It is another way to write Middle C. Tap C.',true),
  staffStep('treble',-1,'D',62,'Use Middle C as a stepping stone. Each next line or space moves one letter forward.','Middle C on its little line → D in the space just above it → E on the treble staff.','The note is one place above Middle C and just below the bottom treble line. C → D.',true),
  staffStep('bass',9,'B',59,'Middle C connects the two staffs. You can count down from it as well as up from it.','Top bass line A → space B → Middle C on its little line.','The note is one place below Middle C and just above the top bass line. C → B.',true)
 ]);
 const NOTE_LESSONS=Object.freeze({'note-naming':NOTE_STEPS,'bass-clef':BASS_STEPS,'grand-staff':GRAND_STEPS});
 // Teaching-only cards come before the first staff question. Keeping them outside
 // NOTE_STEPS preserves saved lesson checkpoints and the classroom profile DTO.
 const CLEF_REMINDERS=Object.freeze(Object.fromEntries(['treble','bass'].map(clef=>{
  const bass=clef==='bass',lines=bass?['G','B','D','F','A']:['E','G','B','D','F'],spaces=bass?['A','C','E','G']:['F','A','C','E'];
  return [clef,Object.freeze([
   {id:'staff',kind:'staff',clef,title:'Meet the staff.',teach:'A staff has five lines and four spaces. Notes sit on a line or in a space.',example:'Start at the bottom. Count up.'},
   {id:'clef',kind:'clef',clef,title:bass?'Meet the bass clef.':'Meet the treble clef.',teach:'A clef tells us which note letters belong on the staff. '+(bass?'Bass clef helps us read lower notes.':'Treble clef helps us read higher notes.'),example:bass?'Its two dots point to the F line.':'Treble clef curls around the G line.'},
   {id:'lines',kind:'lines',clef,title:bass?'The lines: Great Big Dreams For America.':'The lines: Every Good Boy Does Fine.',teach:'Read the lines from the BOTTOM to the TOP.',example:lines.join(' → '),letters:lines,words:bass?['Great','Big','Dreams','For','America']:['Every','Good','Boy','Does','Fine']},
   {id:'spaces',kind:'spaces',clef,title:bass?'The spaces: All Cows Eat Grass.':'The spaces spell FACE.',teach:'Read the spaces from the BOTTOM to the TOP.',example:spaces.join(' → '),letters:spaces,words:bass?['All','Cows','Eat','Grass']:[]}
  ].map(card=>Object.freeze({...card,letters:card.letters?Object.freeze(card.letters):undefined,words:card.words?Object.freeze(card.words):undefined})))];
 })));
 function clefReminderSVG(clef,kind){
  clef=clef==='bass'?'bass':'treble';const card=CLEF_REMINDERS[clef].find(item=>item.kind===kind)||CLEF_REMINDERS[clef][0],bass=clef==='bass',landmark=bass?104:168,mapping=kind==='lines'||kind==='spaces';
  let svg='<svg viewBox="0 0 430 260" role="img" data-clef="'+clef+'" aria-label="'+(mapping?(clef+' '+kind+', bottom to top: '+card.letters.join(' ')+'. '+card.words.join(' ')+'.'):(card.title+' '+card.teach+' '+card.example))+'"><rect x="1" y="1" width="428" height="258" rx="12" fill="#fff9e9"/>';
  for(let line=0;line<5;line++){const y=200-line*32;svg+='<path d="M24 '+y+'H'+(mapping?188:330)+'" fill="none" stroke="'+(kind==='clef'&&y===landmark?'#287d74':'#725c83')+'" stroke-width="'+(kind==='clef'&&y===landmark?4:1.8)+'"/>';if(kind==='staff')svg+='<text x="354" y="'+(y+8)+'" font-family="system-ui,sans-serif" font-size="25" fill="#49345c">'+(line+1)+'</text>';}
  if(kind!=='staff')svg+='<text class="coda-music-glyph" x="36" y="'+(bass?104:168)+'" font-size="128" fill="#49345c">'+notation.glyph(bass?'fClef':'gClef')+'</text>';
  if(mapping)card.letters.forEach((letter,index)=>{const y=(kind==='lines'?200:184)-index*32;svg+='<ellipse cx="156" cy="'+y+'" rx="12" ry="8" transform="rotate(-16 156 '+y+')" fill="#8051aa"/><text data-staff-'+(kind==='lines'?'line':'space')+'="'+(index+1)+'" x="203" y="'+(y+7)+'" font-family="system-ui,sans-serif" font-size="19" font-weight="700" fill="#21695f">'+(index+1)+'</text><text x="232" y="'+(y+8)+'" font-family="system-ui,sans-serif" font-size="26" font-weight="700" fill="#49345c">'+letter+(card.words.length?' · '+card.words[index]:'')+'</text>';});
  else if(kind==='clef')svg+='<text x="214" y="'+(landmark-12)+'" font-family="system-ui,sans-serif" font-size="23" font-weight="700" fill="#21695f">Line '+(bass?4:2)+' · '+(bass?'F':'G')+'</text><circle cx="170" cy="'+landmark+'" r="7" fill="#287d74"/>';
  if(kind!=='clef')svg+='<path d="M404 204V66M396 78L404 64L412 78" stroke="#41675f" stroke-width="3" fill="none"/><text x="392" y="239" text-anchor="end" font-family="system-ui,sans-serif" font-size="17" fill="#41675f">bottom → top</text>';
  return svg+'</svg>';
 }
 const KEY_STEPS=Object.freeze([
  {guide:'A key gives music a home note.',caption:'This little tune comes home to C.',notes:['C','E','G','D','C'],home:'C',sounds:[{label:'Hear the C tune',notes:[60,64,67,62,60]}],prompt:'What is its home note?',answers:['C','G','A'],answer:0,hint:'The tune starts and ends on C.'},
  {guide:'A scale is a ladder of notes in a key.',caption:'C major: up to C, then back down.',notes:['C','D','E','F','G','A','B','C'],home:'C',sounds:[{label:'Hear C major go up and down',notes:[60,62,64,65,67,69,71,72,71,69,67,65,64,62,60]}],prompt:'What did the scale do?',answers:['Went up and down','Stayed on one note','Made only silence'],answer:0,hint:'The notes climbed, then came back home.'},
  {guide:'Major and minor can have the same home.',caption:'C major and C minor both come home to C.',notes:['C','E','G','C'],minorNotes:['C','E♭','G','C'],home:'C',sounds:[{label:'Hear C major',notes:[60,64,67,72,67,64,60]},{label:'Hear C minor',notes:[60,63,67,72,67,63,60]}],prompt:'What home do both share?',answers:['C','D','E'],answer:0,hint:'Both names begin with C.'},
  {guide:'Change E to E-flat. Hear a different colour.',caption:'E-flat (E♭) is the piano key just left of E.',notes:['C','E','G'],minorNotes:['C','E♭','G'],home:'C',sounds:[{label:'Hear C major: C E G',notes:[60,64,67]},{label:'Hear C minor: C E-flat G',notes:[60,63,67]}],prompt:'Which note replaces E?',answers:['E♭','E','F'],answer:0,hint:'The minor example uses E-flat: E♭.'},
  {guide:'Major often sounds bright. Minor can sound mellow or dramatic.',caption:'Either kind can make happy or sad music.',notes:['Major','Minor'],sounds:[{label:'Hear the major example',notes:[60,64,67,72,67,64,60]},{label:'Hear the minor example',notes:[60,63,67,72,67,63,60]}],prompt:'Can minor music sound happy too?',answers:['Yes','Never','Only if it is loud'],answer:0,hint:'Music has many moods. Major and minor are not mood rules.'},
  {guide:'The same kind of scale can start somewhere else.',caption:'D major uses D as its home.',notes:['D','E','F♯','G','A','B','C♯','D'],home:'D',sounds:[{label:'Hear D major',notes:[62,64,66,67,69,71,73,74]}],prompt:'What is D major’s home?',answers:['C','D','A'],answer:1,hint:'The first part of a key’s name tells its home note.'},
  {guide:'Minor scales can start on different home notes too.',caption:'This is A natural minor.',notes:['A','B','C','D','E','F','G','A'],home:'A',sounds:[{label:'Hear A natural minor',notes:[57,59,60,62,64,65,67,69]}],prompt:'What is A minor’s home?',answers:['C','G','A'],answer:2,hint:'A minor comes home to A.'},
  {guide:'The same notes can have different homes.',caption:'C major and A minor share notes. Their homes are different.',notes:['C','D','E','F','G','A','B'],home:'C',minorNotes:['A','B','C','D','E','F','G'],minorHome:'A',sounds:[{label:'Hear C as home',notes:[60,64,67,72,67,64,60]},{label:'Hear A as home',notes:[57,60,64,69,64,60,57]}],prompt:'Do these keys have the same home?',answers:['No: C and A','Yes: both C','Yes: both A'],answer:0,hint:'Look at the glowing home notes: C and A.'}
 ].map(step=>Object.freeze({...step,notes:Object.freeze(step.notes),minorNotes:step.minorNotes?Object.freeze(step.minorNotes):null,answers:Object.freeze(step.answers),sounds:Object.freeze(step.sounds.map(sound=>Object.freeze({...sound,notes:Object.freeze(sound.notes)})))})));
 // One melody makes loudness and speed comparisons about just one changing thing.
 const EXPRESSION_NOTES=Object.freeze([60,64,67,64,60,60]);
 const DYNAMIC_LEVELS=Object.freeze([
  {mark:'pp',name:'pianissimo',meaning:'very soft',gain:.018,code:0xe52b},
  {mark:'p',name:'piano',meaning:'soft',gain:.032,code:0xe520},
  {mark:'mp',name:'mezzo piano',meaning:'moderately soft',gain:.050,code:0xe52c},
  {mark:'mf',name:'mezzo forte',meaning:'moderately loud',gain:.075,code:0xe52d},
  {mark:'f',name:'forte',meaning:'loud',gain:.105,code:0xe522},
  {mark:'ff',name:'fortissimo',meaning:'very loud',gain:.140,code:0xe52f}
 ].map(Object.freeze));
 const expressionSound=(label,bpm=100,gain=.075)=>({label,bpms:Array.isArray(bpm)?bpm:Array(6).fill(bpm),gains:Array.isArray(gain)?gain:Array(6).fill(gain)});
 const softLoud=()=>[expressionSound('Hear soft',100,.032),expressionSound('Hear loud',100,.105)];
 const slowerFaster=()=>[expressionSound('Hear slower',72),expressionSound('Hear faster',132)];
 const freezeExpression=steps=>Object.freeze(steps.map(item=>Object.freeze({...item,marks:item.marks?Object.freeze(item.marks):null,words:item.words?Object.freeze(item.words):null,answers:Object.freeze(item.answers),sounds:Object.freeze(item.sounds.map(sound=>Object.freeze({...sound,bpms:Object.freeze(sound.bpms),gains:Object.freeze(sound.gains)})))})));
 const DYNAMICS_STEPS=freezeExpression([
  {guide:'Dynamics means how loud or soft music is.',caption:'Same tune. Same speed. Different loudness.',marks:['p','f'],sounds:softLoud(),prompt:'What do dynamics change?',answers:['Loudness','Speed','Note letters'],answer:0,hint:'Dynamics tells us how loud or soft to play.'},
  {guide:'Piano means soft. Its music sign is p.',caption:'p = piano = soft',marks:['p'],sounds:[expressionSound('Hear piano: soft',100,.032)],prompt:'What does p mean?',answers:['Fast','Soft','Loud'],answer:1,hint:'Piano starts with p. It means soft.'},
  {guide:'Forte means loud. Its music sign is f.',caption:'f = forte = loud',marks:['f'],sounds:[expressionSound('Hear forte: loud',100,.105)],prompt:'What does f mean?',answers:['Slow','Soft','Loud'],answer:2,hint:'Forte starts with f. It means loud.'},
  {guide:'Double the letter for very soft or very loud.',caption:'pp = pianissimo: very soft. ff = fortissimo: very loud.',marks:['pp','ff'],sounds:[expressionSound('Hear pp: very soft',100,.018),expressionSound('Hear ff: very loud',100,.140)],prompt:'Which means very soft?',answers:['pp','ff','f'],answer:0,hint:'Two p signs make pianissimo: very soft.'},
  {guide:'Mezzo means moderately. These levels sit in the middle.',caption:'mp = mezzo piano: moderately soft. mf = mezzo forte: moderately loud.',marks:['mp','mf'],sounds:[expressionSound('Hear mp',100,.050),expressionSound('Hear mf',100,.075)],prompt:'Which means moderately loud?',answers:['mp','mf','pp'],answer:1,hint:'Mezzo forte: moderately loud. Look for mf.'},
  {guide:'Crescendo means grow louder little by little.',caption:'The opening sign shows the sound growing.',hairpin:'crescendo',sounds:[expressionSound('Hear crescendo',100,DYNAMIC_LEVELS.map(value=>value.gain))],prompt:'What happens during a crescendo?',answers:['It gets faster','It stops','It gets louder'],answer:2,hint:'Keep the same beat. Let the sound grow louder.'},
  {guide:'Diminuendo means grow softer little by little.',caption:'Also called decrescendo. The sign closes.',hairpin:'diminuendo',sounds:[expressionSound('Hear diminuendo',100,DYNAMIC_LEVELS.map(value=>value.gain).reverse())],prompt:'What happens during a diminuendo?',answers:['It gets softer','It gets faster','It gets louder'],answer:0,hint:'The sound shrinks. The beat stays the same.'},
  {guide:'Follow the loudness signs. Keep your steady beat.',caption:'Soft → loud. Speed does not change.',marks:['pp','p','mp','mf','f','ff'],sounds:softLoud(),prompt:'Can soft music still be fast?',answers:['No','Yes','Only with no beat'],answer:1,hint:'Loudness and speed are separate choices.'}
 ]);
 const TEMPO_STEPS=freezeExpression([
  {guide:'Tempo means how fast or slow the beat goes.',caption:'Same tune. Same loudness. Different speed.',words:['Slower','Faster'],sounds:slowerFaster(),prompt:'What does tempo change?',answers:['Loudness','Beat speed','Note letters'],answer:1,hint:'Tempo changes how quickly the beats arrive.'},
  {guide:'BPM means beats per minute.',caption:'60 BPM: one beat each second. 120 BPM: twice as many.',words:['60 BPM','120 BPM'],sounds:[expressionSound('Hear 60 BPM',60),expressionSound('Hear 120 BPM',120)],prompt:'Which has more beats in one minute?',answers:['120 BPM','60 BPM','They are the same'],answer:0,hint:'120 beats is twice as many as 60 beats.'},
  {guide:'Largo and Adagio are words for slow tempos.',caption:'Largo: broad and slow. Adagio: slowly.',words:['Largo','Adagio'],sounds:[expressionSound('Hear a slow example',60)],prompt:'Which word suggests a slow tempo?',answers:['Presto','Allegro','Adagio'],answer:2,hint:'Adagio means slowly. Presto is very fast.'},
  {guide:'Andante feels like walking. Moderato means a moderate pace.',caption:'These words guide the feel, not one exact BPM.',words:['Andante','Moderato'],sounds:[expressionSound('Hear a walking example',88),expressionSound('Hear a moderate example',108)],prompt:'Which word suggests a walking pace?',answers:['Presto','Andante','Largo'],answer:1,hint:'Walk along with Andante.'},
  {guide:'Allegro is lively and fast. Presto is very fast.',caption:'Exact speeds can vary with the music.',words:['Allegro','Presto'],sounds:[expressionSound('Hear a fast example',132),expressionSound('Hear a very fast example',168)],prompt:'Which word means very fast?',answers:['Presto','Adagio','Largo'],answer:0,hint:'Presto is the very fast word.'},
  {guide:'Accelerando means get faster little by little.',caption:'The beats move closer together. Loudness stays the same.',words:['accelerando','Slow → fast'],sounds:[expressionSound('Hear accelerando',[72,84,96,108,120,132])],prompt:'What happens during accelerando?',answers:['It gets softer','It gets louder','It gets faster'],answer:2,hint:'Accelerando speeds up the beat.'},
  {guide:'Ritardando means get slower little by little.',caption:'The beats spread apart. Loudness stays the same.',words:['ritardando','Fast → slow'],sounds:[expressionSound('Hear ritardando',[132,120,108,96,84,72])],prompt:'What happens during ritardando?',answers:['It gets louder','It gets slower','It gets softer'],answer:1,hint:'Ritardando slows down the beat.'},
  {guide:'Choose speed and loudness separately.',caption:'Tempo = speed. Dynamics = loud or soft.',words:['Tempo: speed','Dynamics: loudness'],sounds:slowerFaster(),prompt:'Which instruction changes only tempo?',answers:['Keep loudness. Play faster.','Keep speed. Play louder.','Change the note letters.'],answer:0,hint:'To change tempo, change speed while keeping loudness.'}
 ]);
 const EXPRESSION_LESSONS=Object.freeze({dynamics:DYNAMICS_STEPS,tempo:TEMPO_STEPS});
 const LESSONS=Object.freeze([{id:'note-naming',title:'Note naming',total:NOTE_STEPS.length},{id:'rhythm-tree',title:'The rhythm tree',total:4},timeLesson?.LESSON||{id:'time-signatures',title:'Time signatures',total:8},{id:'bass-clef',title:'Bass clef',total:BASS_STEPS.length},{id:'grand-staff',title:'Grand staff & Middle C',total:GRAND_STEPS.length},{id:'major-minor-keys',title:'Major & minor keys',total:KEY_STEPS.length},{id:'dynamics',title:'Dynamics: loud & soft',total:DYNAMICS_STEPS.length},{id:'tempo',title:'Tempo: fast & slow',total:TEMPO_STEPS.length}].map(Object.freeze));
 const SIMPLE_NOTE_COPY=Object.freeze({
  'note-naming':Object.freeze([
   ['Two black keys help us find C.','C','Tap C.','C is beside two black keys.'],
   ['Three black keys help us find F.','F','Tap F.','F is beside three black keys.'],
   ['D is one white key after C.','C → D','Tap D.','Find C. Move one white key right.'],
   ['After G, the letters start again at A.','G → A','Tap A.','Find F. Move two white keys right.'],
   ['These five lines are a staff.','Bottom line: E','Name the purple note.','The bottom line is E.'],
   ['Notes also fit in the spaces.','First space: F','Name the purple note.','The first space is F.'],
   ['Move up one line or space at a time.','E → F → G','Name the purple note.','Count upward: E, F, G.'],
   ['Treble spaces, bottom to top: FACE.','Bottom to top: F · A · C · E','Name the purple note.','Start at the bottom space: F, A.'],
   ['Treble lines, bottom to top: Every Good Boy Does Fine.','Bottom to top: E · G · B · D · F','Name the purple note.','Start at the bottom line: Every, Good, Boy. B!'],
   ['Read FACE from the bottom space to the top.','Bottom to top: F · A · C · E','Name the purple note.','Start at the bottom space: F, A, C.']
  ].map(Object.freeze)),
  'bass-clef':Object.freeze([
   ['Bass clef helps us read low notes.','Bottom line: G','Name the purple note.','The bottom bass line is G.'],
   ['Bass lines, bottom to top: Great Big Dreams For America.','Bottom to top: G · B · D · F · A','Name the purple note.','Start at the bottom line: Great, Big. B!'],
   ['Count the lines from the bottom.','Middle line: D','Name the purple note.','Great, Big, Dreams. This line is D.'],
   ['The two dots point to F.','Between the dots: F','Name the purple note.','The line between the dots is F.'],
   ['Read the five lines from bottom to top.','Top line: A','Name the purple note.','America reminds us of A.'],
   ['Bass spaces, bottom to top: All Cows Eat Grass.','Bottom to top: A · C · E · G','Name the purple note.','Start at the bottom space. All reminds us of A.'],
   ['Count only the spaces, from bottom to top.','Second space: C','Name the purple note.','Start at the bottom space: All, Cows. C!'],
   ['Move up one more space.','Third space: E','Name the purple note.','Start at the bottom space: All, Cows, Eat. E!'],
   ['Bottom to top: All Cows Eat Grass names the spaces.','Top space: G','Name the purple note.','Start at the bottom space. Grass is last: G.']
  ].map(Object.freeze)),
  'grand-staff':Object.freeze([
   ['Two staffs work together.','Top staff: treble','Name the purple note.','Treble lines, bottom to top: Every Good Boy Does Fine.'],
   ['The bottom staff uses bass clef.','Bottom line: G','Name the purple note.','Bass lines, bottom to top: Great Big Dreams For America.'],
   ['Treble spaces, bottom to top: FACE.','Second space: A','Name the purple note.','Start at the bottom treble space: F, A.'],
   ['Bass spaces, bottom to top: All Cows Eat Grass.','Second space: C','Name the purple note.','Start at the bottom bass space: A, C.'],
   ['Middle C has its own tiny line.','Below treble: Middle C','Name the purple note.','The tiny line belongs to Middle C.'],
   ['This is the same Middle C.','Above bass: Middle C','Name the purple note.','It is the same piano key: C.'],
   ['D is one step above Middle C.','C → D','Name the purple note.','Start at Middle C. Move up to D.'],
   ['B is one step below Middle C.','C → B','Name the purple note.','Start at Middle C. Move down to B.']
  ].map(Object.freeze))
 });
 function splitExample(level){
  level=Number.isInteger(level)?Math.max(0,Math.min(4,level)):0;const units=VALUES[level].units,notes=Array(level===0?1:2).fill(units);
  return {level,parentUnits:level?VALUES[level-1].units:null,notes,counts:notes.reduce((sum,n)=>sum+n,0)/4};
 }
 function validBar(notes){return Array.isArray(notes)&&notes.length>0&&notes.every(note=>VALUES.some(value=>value.units===note))&&notes.reduce((sum,note)=>sum+note,0)===16;}
 function beatCount(units){const whole=Math.floor(units/4),fraction=['','¼','½','¾'][units%4];return (whole?String(whole):'')+fraction||'0';}
 function defaultProgress(){return {version:1,lessons:Object.fromEntries(LESSONS.map(lesson=>[lesson.id,{step:0,completed:false,completedAt:0}]))};}
 function normalize(raw){const state=defaultProgress();if(!raw||raw.version!==1||!raw.lessons||typeof raw.lessons!=='object')return state;for(const lesson of LESSONS){const saved=raw.lessons[lesson.id];if(saved&&Number.isInteger(saved.step)&&saved.step>=0&&saved.step<=lesson.total){state.lessons[lesson.id]={step:saved.step,completed:saved.completed===true&&saved.step===lesson.total,completedAt:Number.isFinite(saved.completedAt)&&saved.completedAt>=0?saved.completedAt:0};}}return state;}
 function storageFor(storage){if(storage!==undefined)return storage;try{return window.localStorage;}catch{return null;}}
 function readProgress(storage){storage=storageFor(storage);let data=defaultProgress(),persistent=false,error='';try{data=normalize(JSON.parse(storage?.getItem(KEY)||'null'));persistent=!!storage;}catch{error='Lesson progress could not be read.';}const lessons=LESSONS.map(lesson=>({...lesson,...data.lessons[lesson.id]})),completed=lessons.filter(lesson=>lesson.completed).map(lesson=>lesson.id);return {version:1,lessons,completed,completedCount:completed.length,total:LESSONS.length,persistent,error};}
 function glyph(units,colour='currentColor'){return notation.glyphSVG(units/4,{colour});}
 function staffSVG(position,options={}){return (quizModule?.staffSVG||notation.staffSVG)(position,options);}
 function treeSVG(level){let lines='',nodes='';for(let row=0;row<=level;row++){const count=2**row,y=28+row*58;for(let at=0;at<count;at++){const x=(at+.5)*800/count;if(row){const px=(Math.floor(at/2)+.5)*800/(count/2);lines+='<path d="M'+px+' '+(y-45)+'L'+x+' '+(y-13)+'" stroke="#8c76b6" stroke-width="2"/>';}nodes+='<g data-tree-level="'+row+'" data-tree-index="'+at+'" transform="translate('+(x-14)+' '+(y-18)+')" color="'+(row===level?'#b8ffdd':'#d4bdeb')+'">'+glyph(VALUES[row].units).replace('<svg ','<svg x="0" y="0" ').replace('width="30" height="36"','width="28" height="34"')+'</g>';}}return '<svg viewBox="0 0 800 '+(55+level*58)+'" class="lesson-tree-picture" style="--lesson-tree-min-width:'+(2**level*40)+'px" aria-hidden="true" focusable="false">'+lines+nodes+'</svg>';}
 function create(api={}){
  const host=api.host;if(!host)throw Error('A tutorial needs a host element.');const doc=host.ownerDocument,win=doc.defaultView,storage=storageFor(api.storage);
  let id=null,step=0,learningStage='look',answered=false,complete=false,message='',correct=null,level=0,explored=new Set([0]),bar=[],names=false,hintShown=false,quizzing=false,quiz=null,freshQuiz=false,award=null,error='',destroyed=false,audio=null,voices=[],timers=[];
  let authored=false,contentRevision='',lessonSteps=null,expectedLesson='null',contentChanged=false;
  let studying=false,study=null,studyError='',studyThenQuiz=false,noteReminder=null,noteReminderReturn=null,noteReminderAfter=null,clefIntroSeen=false;
  const content=api.content||win?.CodaEducationContent;
  function canRecord(){try{if(contentChanged)return false;if(contentRevision&&content?.getLessonRevision?.(id)!==contentRevision){contentChanged=true;return false;}return !destroyed&&api.canRecord?.()!==false;}catch{return false;}}
  function authoredJournal(){let value=null;try{value=JSON.parse(storage?.getItem(CUSTOM_KEY)||'null');}catch{}return value?.version===1&&value.lessons&&typeof value.lessons==='object'&&!Array.isArray(value.lessons)?value:{version:1,lessons:{}};}
  function progress(){
   if(!authored)return readProgress(storage);const result=readProgress(storage),entry=authoredJournal().lessons[id],total=LESSONS.find(lesson=>lesson.id===id)?.total||0;
   const saved=entry?.revision===contentRevision&&Number.isInteger(entry.step)&&entry.step>=0&&entry.step<=total?{step:entry.step,completed:entry.completed===true&&entry.step===total,completedAt:Number.isSafeInteger(entry.completedAt)&&entry.completedAt>0?entry.completedAt:0}:{step:0,completed:false,completedAt:0};
   result.lessons=result.lessons.map(lesson=>lesson.id===id?{...lesson,...saved,title:content?.getLesson?.(id)?.title||lesson.title,custom:true}:lesson);result.completed=result.lessons.filter(lesson=>lesson.completed).map(lesson=>lesson.id);result.completedCount=result.completed.length;return result;
  }
  const signatureLesson=timeLesson?.create({host,notation,getSteps:()=>authored&&id==='time-signatures'?lessonSteps:null,canRecord,onCorrect:()=>{if(complete||answered)return;answered=true;persist(step+1);const progress=host.querySelector('progress');if(progress)progress.value=step+1;},onNext:next});
  const element=(tag,className,text)=>{const node=doc.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
  function button(text,action,attributes={}){const node=element('button','',text);node.type='button';for(const [key,value]of Object.entries(attributes))node.setAttribute(key,value);node.onclick=event=>{if(!canRecord()){feedback('Your profile or lesson changed. Reopen the lesson before continuing.',false);return;}action(event);};return node;}
  function stopAudio(){study?.stopAudio?.();signatureLesson?.stopAudio();for(const timer of timers)win.clearTimeout(timer);timers=[];for(const voice of voices)try{voice.stop();}catch{}voices=[];if(audio){audio.close().catch(()=>{});audio=null;}for(const node of host.querySelectorAll('.is-playing'))node.classList.remove('is-playing');}
  function play(notes,{rhythm=false,treeLevel=null}={}){
   stopAudio();const Constructor=api.AudioContext||win.AudioContext||win.webkitAudioContext;if(!Constructor){feedback('You can still try every question without sound.',null);return;}
   try{audio=new Constructor();audio.resume().catch(()=>{});const context=audio,beat=.55;let at=context.currentTime+.05;
    notes.forEach((note,index)=>{const length=rhythm?note/4*beat:.38,pitch=rhythm?67:note,osc=context.createOscillator(),gain=context.createGain();osc.type='triangle';osc.frequency.value=440*2**((pitch-69)/12);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.11,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+Math.max(.04,length*.92));osc.connect(gain).connect(context.destination);osc.start(at);osc.stop(at+length);voices.push(osc);
     if(rhythm){const start=(at-context.currentTime)*1000;timers.push(win.setTimeout(()=>host.querySelector(treeLevel===null?'[data-pattern-index="'+index+'"]':'[data-tree-level="'+treeLevel+'"][data-tree-index="'+(index%2)+'"]')?.classList.add('is-playing'),start));timers.push(win.setTimeout(()=>host.querySelector(treeLevel===null?'[data-pattern-index="'+index+'"]':'[data-tree-level="'+treeLevel+'"][data-tree-index="'+(index%2)+'"]')?.classList.remove('is-playing'),start+length*1000));}at+=rhythm?length:.44;
    });timers.push(win.setTimeout(stopAudio,(at-context.currentTime+.2)*1000));
   }catch{stopAudio();feedback('Sound could not start. You can still try the lesson.',null);}
  }
  function playExpression(sound){
   stopAudio();const Constructor=api.AudioContext||win.AudioContext||win.webkitAudioContext;if(!Constructor){feedback('You can still try every question without sound.',null);return;}
   try{audio=new Constructor();audio.resume().catch(()=>{});const context=audio;let at=context.currentTime+.05;
    EXPRESSION_NOTES.forEach((pitch,index)=>{const beat=60/sound.bpms[index],length=.24,osc=context.createOscillator(),gain=context.createGain();osc.type='triangle';osc.frequency.value=440*2**((pitch-69)/12);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(sound.gains[index],at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+length);osc.connect(gain).connect(context.destination);osc.start(at);osc.stop(at+length+.01);voices.push(osc);
     const start=(at-context.currentTime)*1000;timers.push(win.setTimeout(()=>{const pulse=host.querySelector('[data-expression-pulse]');if(pulse){pulse.classList.add('is-playing');pulse.textContent=String(index+1);}},start));timers.push(win.setTimeout(()=>host.querySelector('[data-expression-pulse]')?.classList.remove('is-playing'),start+Math.min(beat*.6,.24)*1000));at+=beat;
    });timers.push(win.setTimeout(stopAudio,(at-context.currentTime+.1)*1000));
   }catch{stopAudio();feedback('Sound could not start. You can still try the lesson.',null);}
  }
  function feedback(text,isCorrect){message=text;correct=isCorrect;const status=host.querySelector('.tutorial-feedback');if(status){status.textContent=text;status.dataset.correct=String(isCorrect);}}
  function persist(nextStep,finished=false){let data;try{
   if(authored){if(!canRecord())throw Error('changed');data=authoredJournal();if(JSON.stringify(data.lessons[id]??null)!==expectedLesson)throw Error('changed');const total=LESSONS.find(lesson=>lesson.id===id).total,old=data.lessons[id]?.revision===contentRevision?data.lessons[id]:{step:0,completed:false,completedAt:0};data.lessons[id]={revision:contentRevision,step:Math.max(old.step,Math.min(total,nextStep)),completed:old.completed||finished,completedAt:old.completedAt||(finished?Date.now():0)};if(!storage?.setItem)throw Error('storage');storage.setItem(CUSTOM_KEY,JSON.stringify(data));expectedLesson=JSON.stringify(data.lessons[id]);}
   else{data=normalize(JSON.parse(storage?.getItem(KEY)||'null'));const old=data.lessons[id];data.lessons[id]={step:Math.max(old.step,nextStep),completed:old.completed||finished,completedAt:old.completedAt||(finished?Date.now():0)};if(!storage||typeof storage.setItem!=='function')throw Error('storage');storage.setItem(KEY,JSON.stringify(data));}
   error='';return true;}catch(failure){error=failure.message==='changed'?'Your player or lesson changed. Reopen the lesson before continuing.':'Your progress could not be saved. You can keep practicing and try saving again.';return false;}}
  function ensureQuiz(){
   if(!quiz&&win.CodaClassroomQuiz)quiz=win.CodaClassroomQuiz.create({host,lessonId:id,storage,custom:authored,contentRevision,canRecord,onPassed:()=>finish()});
   return quiz;
  }
  function studyCards(){return content?.getStudyCards?.(id)||win.CodaExamCurriculum?.forLesson?.(id)||[];}
  function studyRevision(){return content?.getStudyRevision?.(id)||win.CodaClassroomExamStudy?.revisionOf(studyCards())||'';}
  function studyOptions(){return {host,lessonId:id,cards:studyCards(),storage,revision:studyRevision(),getRevision:studyRevision,canRecord,renderVisual:(figure,value)=>win.CodaClassroomLearningPaths?.renderVisual?.(figure,value)===true};}
  function hasStudy(){return !!win.CodaClassroomExamStudy&&studyCards().length>0;}
  function finishStudy(){if(!canRecord())return;const continueQuiz=studyThenQuiz;study?.destroy();study=null;studying=false;studyError='';if(continueQuiz)beginQuiz();else{render();host.querySelector('h3')?.focus({preventScroll:true});}}
  function leaveStudy(){study?.destroy();study=null;studying=false;studyError='';if(studyThenQuiz){step=Math.min(step,LESSONS.find(lesson=>lesson.id===id).total-1);quizzing=false;complete=false;answered=false;learningStage='look';}render();host.querySelector('h3')?.focus({preventScroll:true});}
  function startStudy(thenQuiz=false){
   if(!canRecord())return false;
   if(needsClefIntro()){openNoteReminders(()=>startStudy(thenQuiz));return true;}
   if(!canRecord())return false;stopAudio();study?.destroy();study=null;studying=true;studyThenQuiz=thenQuiz;if(thenQuiz){quizzing=false;complete=false;}studyError=hasStudy()?'':'These study cards could not load. Reload the game, then reopen this lesson.';render();host.querySelector('[data-study-heading],h3')?.focus({preventScroll:true});return true;
  }
  function beginAssessment(){
   if(hasStudy()){
    const check=win.CodaClassroomExamStudy.createSession(studyOptions()),state=check.getState();check.destroy();
    if(!state.completed||!state.saved){startStudy(true);return;}
   }else if(api.requireExamCurriculum){startStudy(true);return;}
   beginQuiz();
  }
  function beginQuiz(restart=false){
   if(needsClefIntro()){openNoteReminders(()=>beginQuiz(restart));return;}
   stopAudio();step=LESSONS.find(lesson=>lesson.id===id).total;complete=false;answered=false;quizzing=true;message='';correct=null;persist(step);
   const current=ensureQuiz();if((restart||freshQuiz)&&current)current.restart();freshQuiz=false;render();const question=host.querySelector('.classroom-quiz-question,.classroom-quiz-result-title');question?.focus({preventScroll:true});host.querySelector('.classroom-quiz')?.scrollIntoView({block:'start',behavior:'auto'});
  }
  function finish(){
   const checked=quiz?.getState();if(!checked?.passed||!checked.saved){beginQuiz();return;}
   stopAudio();quizzing=false;complete=true;answered=true;if(!persist(LESSONS.find(lesson=>lesson.id===id).total,true)){award={ok:false,error};render();return;}
   notifyCompletion();render();
  }
  function notifyCompletion(){if(!canRecord()){award={ok:false,error:'Your profile or lesson changed. Reopen the lesson to save its reward.'};return;}const lesson=LESSONS.find(lesson=>lesson.id===id);try{const result=api.onComplete?.(id,{title:lesson.title,correct:lesson.total,total:lesson.total});if(result&&typeof result.then==='function')result.then(value=>{award=value;render();}).catch(()=>{award={ok:false};render();});else award=result||null;}catch{award={ok:false};}}
  const namingSteps=()=>authored&&NOTE_LESSONS[id]?lessonSteps:NOTE_LESSONS[id]||NOTE_STEPS;
  const noteCopy=()=>authored&&NOTE_LESSONS[id]?[lessonSteps[step].teach,lessonSteps[step].example,lessonSteps[step].prompt,lessonSteps[step].hint]:SIMPLE_NOTE_COPY[id]?.[step]||['Look at this note.','','Name the purple note.','Look at the line or space.'];
  function startTry(){learningStage='try';hintShown=false;message='';correct=null;render();host.querySelector('h3')?.focus({preventScroll:true});}
  function tryButton(section){section.append(button('Try it',startTry,{'data-lesson-try':''}));}
  function answerNote(letter,pitch){
   if(complete||answered||learningStage!=='try')return;play([pitch??60]);const expected=namingSteps()[step];
   if(letter!==expected.answer){feedback('Not yet. Try again.',false);return;}
   answered=true;persist(step+1);message='Yes!';correct=true;render();host.querySelector('[data-tutorial-next]')?.focus({preventScroll:true});
  }
  function revealNoteHint(){
   if(answered||learningStage!=='try')return;hintShown=true;const question=namingSteps()[step];feedback(noteCopy()[3],null);
   for(const key of host.querySelectorAll('.lesson-white-key'))key.classList.toggle('is-hint',key.dataset.noteAnswer===question.answer);
   const staff=host.querySelector('.lesson-staff-wrap');if(staff)staff.classList.add('is-hint');
   const hint=host.querySelector('[data-note-hint]');if(hint)hint.setAttribute('aria-expanded','true');
  }
  function next(){if(!answered||complete)return;stopAudio();step++;if(id==='note-naming'&&step===4){noteReminder='staff';noteReminderReturn=null;noteReminderAfter=null;}learningStage='look';answered=false;hintShown=false;message='';correct=null;if(step>=LESSONS.find(lesson=>lesson.id===id).total)beginAssessment();else{persist(step);render();}}
  function answerRhythm(value){
   if(complete||answered||learningStage!=='try')return;
   const question=authored?lessonSteps[step]:null,expected=question?.answers?question.answer:2;if(value!==expected){feedback('Not yet. Try again.',false);return;}
   answered=true;persist(step+1);message='Yes! Two notes.';correct=true;render();host.querySelector('[data-tutorial-next]')?.focus({preventScroll:true});
  }
  function redrawBar(){const viewport=host.closest('.classroom-books'),scroll=viewport?.scrollTop;render();if(viewport&&Number.isFinite(scroll))viewport.scrollTop=scroll;}
  function addValue(units){if(complete||answered||learningStage!=='try'||!VALUES.some(value=>value.units===units))return;const total=bar.reduce((sum,value)=>sum+value,0);if(total+units>16){feedback('That note won’t fit. Choose a shorter note.',false);return;}stopAudio();bar.push(units);message='';correct=null;redrawBar();}
  function checkBar(){if(complete||answered||learningStage!=='try')return;if(!validBar(bar)){feedback('Add notes until you have four beats.',false);return;}stopAudio();answered=true;persist(step+1);message='You made four beats!';correct=true;render();host.querySelector('[data-tutorial-next]')?.focus({preventScroll:true});}
  function learningCard(section,teach,example){
   const card=element('div','lesson-learning-card');card.append(element('span','lesson-card-label','Learn'),element('p','',teach));
   if(example){const worked=element('p','lesson-worked-example');worked.append(element('strong','','Example: '),doc.createTextNode(example));card.append(worked);}section.append(card);return card;
  }
  function actionCue(section,text){const cue=element('div','lesson-action-cue'),heading=element('h3','lesson-instruction',text);heading.tabIndex=-1;cue.append(heading);section.append(cue);return heading;}
  function buildKeyboard(section){
   const wrapper=element('div','lesson-keyboard-scroll'),keyboard=element('div','lesson-keyboard');keyboard.setAttribute('role','group');keyboard.setAttribute('aria-label','Piano white keys');
   const high=['F','A'].includes(namingSteps()[step].answer),whites=authored?[['C',60],['D',62],['E',64],['F',65],['G',67],['A',69],['B',71]]:(high?[['F',65],['G',67],['A',69],['B',71],['C',72]]:[['C',60],['D',62],['E',64],['F',65]]),keyWidth=100/whites.length;
   whites.forEach(([letter,pitch],index)=>{const key=button('',()=>answerNote(letter,pitch),{'aria-label':letter+' key','data-note-answer':letter,'data-pitch':pitch});key.className='lesson-white-key';if((hintShown||answered)&&letter===namingSteps()[step].answer)key.classList.add('is-hint');key.style.left=index*keyWidth+'%';key.style.width=keyWidth+'%';const label=element('span','lesson-key-name',letter);label.hidden=!names&&!(answered&&letter===namingSteps()[step].answer);key.append(label);key.disabled=answered;keyboard.append(key);});
   for(const boundary of authored?[1,2,4,5,6]:high?[1,2,3]:[1,2]){const black=element('span','lesson-black-key');black.style.left=(boundary*keyWidth-keyWidth*.31)+'%';black.style.width=keyWidth*.62+'%';black.setAttribute('aria-hidden','true');keyboard.append(black);}wrapper.append(keyboard);section.append(wrapper);
   const label=element('label','lesson-name-toggle'),toggle=element('input');toggle.type='checkbox';toggle.checked=names;toggle.onchange=()=>{names=toggle.checked;for(const name of host.querySelectorAll('.lesson-key-name'))name.hidden=!names;};label.append(toggle,doc.createTextNode('Show letters'));if(!answered)section.append(label);
  }
  function namingExample(question){
   const example=element('figure','lesson-naming-example');example.dataset.noteExample=question.kind;
   if(question.kind==='staff')example.innerHTML=staffSVG(question.position,question);
   else{
    const letters=['C','D','E','F','G','A','B','C'],target=letters.indexOf(question.answer),anchor=question.answer==='A'?3:0,group=question.answer==='F'||question.answer==='A'?[4,5,6]:[1,2];
    let keys='';for(let index=0;index<8;index++){const fill=index===target?'#a9f2da':index===anchor?'#f5dda7':'#f9f4e6';keys+='<rect x="'+(index*50+1)+'" y="12" width="48" height="89" rx="3" fill="'+fill+'" stroke="#514861"/>';}
    for(const boundary of [1,2,4,5,6])keys+='<rect x="'+(boundary*50-14)+'" y="12" width="28" height="48" rx="2" fill="'+(group.includes(boundary)?'#8056ad':'#25213b')+'"/>';
    for(const index of new Set([target,anchor]))keys+='<text x="'+(index*50+25)+'" y="91" text-anchor="middle" fill="#263849" font-size="24" font-family="system-ui" font-weight="700">'+letters[index]+'</text>';
    example.innerHTML='<svg class="lesson-example-keyboard" viewBox="0 0 400 106" role="img">'+keys+'</svg>';example.querySelector('svg').setAttribute('aria-label','Example: '+noteCopy()[0]);
   }
   example.append(element('figcaption','lesson-model-label',noteCopy()[1]));return example;
  }
  function nextButton(section,label='Next'){const advance=button(label,next,{'data-tutorial-next':''});advance.disabled=!answered;section.append(advance);}
  function needsClefIntro(){return (id==='note-naming'||id==='bass-clef')&&!clefIntroSeen;}
  function openNoteReminders(after=null){
   if(!canRecord())return;stopAudio();noteReminderReturn={learningStage,answered,message,correct};noteReminderAfter=typeof after==='function'?after:null;noteReminder='staff';render();host.querySelector('h3')?.focus({preventScroll:true});
  }
  function finishNoteReminders(){
   noteReminder=null;clefIntroSeen=true;if(noteReminderReturn){({learningStage,answered,message,correct}=noteReminderReturn);noteReminderReturn=null;}else{learningStage='look';answered=false;message='';correct=null;}
   const after=noteReminderAfter;noteReminderAfter=null;if(after){after();return;}render();host.querySelector('h3')?.focus({preventScroll:true});
  }
  function renderNoteReminders(section){
   const clef=id==='bass-clef'?'bass':'treble',cards=CLEF_REMINDERS[clef],index=cards.findIndex(card=>card.id===noteReminder),card=cards[index]||cards[0];section.dataset.noteReminder=card.id;section.dataset.reminderClef=clef;
   actionCue(section,card.title);section.append(element('p','lesson-read-direction',card.teach));
   const picture=element('figure','lesson-note-reminder-picture');picture.innerHTML=clefReminderSVG(clef,card.kind);picture.append(element('figcaption','lesson-model-label',card.example));section.append(picture);notation.load?.(doc);
   const labels=['Next: clef','Next: lines','Next: spaces',noteReminderAfter?'Continue':'Now look at a note'];
   section.append(button(labels[index],()=>{if(index<cards.length-1){noteReminder=cards[index+1].id;render();host.querySelector('h3')?.focus({preventScroll:true});}else finishNoteReminders();},{'data-note-reminder-next':''}));
  }
  function renderNaming(section){
   section.dataset.kind='note';const question=namingSteps()[step],copy=noteCopy();if((id==='note-naming'||id==='bass-clef')&&question.kind==='staff')section.append(button('Show note reminders',()=>openNoteReminders(),{'data-note-reminders':''}));
   if(learningStage==='look'){actionCue(section,copy[0]);section.append(namingExample(question));tryButton(section);return;}
   actionCue(section,answered?'That’s '+question.answer+'.':copy[2]);
   if(question.kind==='keys')buildKeyboard(section);else{
    const drawing=element('div','lesson-staff-wrap'+(hintShown?' is-hint':''));drawing.innerHTML=staffSVG(question.position,question);section.append(drawing);
    if(question.position>=0)drawing.append(element('p','lesson-read-direction','Read from bottom to top.'));
    if(answered)section.append(element('div','lesson-answer-letter',question.answer));
    else{const choices=element('div','lesson-letter-answers');choices.setAttribute('role','group');choices.setAttribute('aria-label','Choose the note letter');for(const letter of ['A','B','C','D','E','F','G'])choices.append(button(letter,()=>answerNote(letter,question.pitch),{'data-note-answer':letter}));section.append(choices);}
   }
   if(!answered){const actions=element('div','lesson-actions lesson-help-actions');actions.append(button('Hint',revealNoteHint,{'data-note-hint':'','aria-expanded':String(hintShown)}),button('Hear it',()=>play([question.pitch])));section.append(actions);}
   appendFeedback(section);nextButton(section,step===namingSteps().length-1?'Start quiz':'Next');
  }
  function splitPicture(){
   const picture=element('div','lesson-split-picture');picture.setAttribute('role','img');picture.setAttribute('aria-label',level===0?'One whole note':VALUES[level-1].label+' splits into two '+VALUES[level].name+' notes');
   if(level>0){const parent=element('div','lesson-split-parent');parent.innerHTML=glyph(VALUES[level-1].units);picture.append(parent,element('span','lesson-split-arrow','→'));}
   const children=element('div','lesson-split-children');for(let at=0;at<splitExample(level).notes.length;at++){const note=element('span','');note.dataset.treeLevel=level;note.dataset.treeIndex=at;note.innerHTML=glyph(VALUES[level].units);children.append(note);}picture.append(children);return picture;
  }
  function renderTree(section){
   learningStage='explore';host.dataset.learningStage=learningStage;section.dataset.kind='tree';
   const guides=['One whole note lasts four counts.','Split the whole note into two halves.','Split each half into two quarters.','Split each quarter into two eighths.','Split each eighth into two sixteenths.'];
   actionCue(section,authored&&level===0?lessonSteps[0].guide:guides[level]);section.append(splitPicture());
   const value=VALUES[level],example=splitExample(level),shownCount=example.notes.length,totalCounts=example.counts,countWords=totalCounts===.5?'half a count':totalCounts+' '+(totalCounts===1?'count':'counts'),caption=element('p','lesson-tree-caption',shownCount+' '+value.name+(shownCount===1?' note':' notes')+' = '+countWords);caption.setAttribute('aria-live','polite');section.append(caption);
   const actions=element('div','lesson-actions');actions.append(button('Listen',()=>play(example.notes,{rhythm:true,treeLevel:level})));
   if(level<4){const split=button('Split it',()=>{level++;explored.add(level);stopAudio();message='';render();},{'data-tree-split':''});split.className='lesson-primary';actions.append(split);}else actions.append(button('Try a puzzle',()=>{answered=true;next();},{'data-tutorial-next':''}));section.append(actions);
   if(level>0){const more=element('details','lesson-extra-notes');more.append(element('summary','','Go back'));more.append(button('Join two notes',()=>{level--;stopAudio();render();},{'data-tree-join':''}));section.append(more);}appendFeedback(section);
  }
  function rhythmHint(text){hintShown=true;feedback(text,null);}
  function renderRhythm(section){
   section.dataset.kind='rhythm';if(step===0){renderTree(section);return;}
   if(step===1||step===2){
    const half=step===1,example=element('div','lesson-rhythm-example');
    const question=authored?lessonSteps[step]:null;
    if(learningStage==='look'){actionCue(section,question?.guide||(half?'One half note lasts two counts.':'Two eighth notes share one count.'));example.innerHTML=glyph(half?8:4)+'<span>=</span>'+glyph(half?4:2)+glyph(half?4:2);section.append(example);tryButton(section);return;}
    actionCue(section,answered?'Yes!':question?.prompt||(half?'How many quarter notes match this?':'How many eighth notes match this?'));example.innerHTML=glyph(half?8:4);section.append(example);
    if(!answered){const answers=element('div','lesson-number-answers');(question?.answers||[2,3,4]).forEach((value,index)=>answers.append(button(String(value),()=>answerRhythm(authored?index:Number(value)),{'data-rhythm-answer':authored?index:value})));section.append(answers,button('Hint',()=>rhythmHint(question?.hint||(half?'Each quarter lasts one count.':'Split the quarter in two.'))));}
    appendFeedback(section);nextButton(section);return;
   }
   if(learningStage==='look'){actionCue(section,authored?lessonSteps[step].guide:'Make four beats.');const example=element('div','lesson-rhythm-example lesson-recipe-example');example.setAttribute('aria-label','Four quarter notes, one beat each');example.innerHTML=[4,4,4,4].map(units=>glyph(units)).join('');section.append(example,element('p','lesson-model-label',authored?lessonSteps[step].caption:'1 + 1 + 1 + 1 = 4 beats'));tryButton(section);return;}
   section.classList.add('lesson-bar-builder');const total=bar.reduce((sum,value)=>sum+value,0);
   actionCue(section,answered?'Four beats. You did it!':authored?lessonSteps[step].prompt:'Make four beats.');
   const drawing=element('div','lesson-bar-drawing'),pattern=element('div','lesson-pattern');pattern.setAttribute('aria-label','Your four-beat bar');
   bar.forEach((units,index)=>{const cell=element('div','lesson-pattern-note');cell.dataset.patternIndex=index;cell.setAttribute('aria-label',VALUES.find(value=>value.units===units).label);cell.innerHTML=glyph(units);pattern.append(cell);});
   if(!bar.length)pattern.append(element('div','lesson-pattern-space','Your notes go here'));
   const count=element('p','lesson-bar-count',beatCount(total)+' / 4 beats');count.setAttribute('aria-live','polite');count.dataset.rhythmCount=total;drawing.append(pattern);
   if(!answered){
    const picker=element('div','lesson-bar-picker'),values=element('div','lesson-value-buttons lesson-all-values');values.setAttribute('role','group');values.setAttribute('aria-label','Choose any notes to make four beats');
    for(const value of VALUES){const choose=button('',()=>addValue(value.units),{'aria-label':'Add '+value.name+' note, '+value.beats,'data-add-value':value.units});choose.innerHTML=glyph(value.units);const label=element('span','lesson-value-label');label.append(element('span','',value.name[0].toUpperCase()+value.name.slice(1)),element('span','lesson-value-beats',beatCount(value.units)+' '+(value.units<=4?'beat':'beats')));choose.append(label);choose.disabled=total+value.units>16;values.append(choose);}picker.append(count,values);section.append(picker,drawing);
    const actions=element('div','lesson-actions');if(bar.length){actions.append(button('Undo',()=>{stopAudio();bar.pop();message='';correct=null;redrawBar();},{'data-rhythm-undo':''}),button('Listen',()=>play(bar,{rhythm:true})),button('Start again',()=>{stopAudio();bar=[];message='';correct=null;redrawBar();},{'data-rhythm-clear':''}));}if(actions.children.length)section.append(actions);
    const check=button('Check',checkBar,{'data-check-rhythm':''});check.disabled=total!==16;section.append(check);
   }else section.append(count,drawing);
   appendFeedback(section);if(answered)nextButton(section,'Start quiz');
  }
  function renderKeys(section){
   section.dataset.kind='keys';const question=authored?lessonSteps[step]:KEY_STEPS[step];
   actionCue(section,learningStage==='look'?question.guide:answered?'Yes!':question.prompt);
   const picture=element('figure','lesson-keys-picture');
   function noteRow(notes,home,label){
    const group=element('div','lesson-key-example');if(label)group.append(element('strong','lesson-key-example-label',label));
    const row=element('div','lesson-key-note-row');row.setAttribute('role','img');row.setAttribute('aria-label',(label?label+': ':'')+notes.join(', ')+(home?'. Home note '+home+'.':''));
    notes.forEach(note=>{const chip=element('span','lesson-key-note'+(note===home?' is-home':''),note);if(note===home)chip.setAttribute('data-key-home',note);row.append(chip);});group.append(row);picture.append(group);
   }
   noteRow(question.notes,question.home,question.minorNotes?'Major':'');if(question.minorNotes)noteRow(question.minorNotes,question.minorHome||question.home,'Minor');
   picture.append(element('figcaption','lesson-key-caption',question.caption));section.append(picture);
   const sounds=element('div','lesson-actions lesson-key-sounds');for(const [index,sound]of question.sounds.entries())sounds.append(button(sound.label,()=>play(sound.notes),{'data-key-listen':index}));section.append(sounds);
   if(learningStage==='look'){tryButton(section);return;}
   if(!answered){const answers=element('div','lesson-key-answers');answers.setAttribute('role','group');answers.setAttribute('aria-label','Choose an answer');
    question.answers.forEach((label,index)=>answers.append(button(label,()=>{
     if(answered||complete)return;if(index!==question.answer){feedback('Not yet. '+question.hint,false);return;}
     answered=true;persist(step+1);message='Yes!';correct=true;render();host.querySelector('[data-tutorial-next]')?.focus({preventScroll:true});
    },{'data-key-answer':index})));section.append(answers);
   }
   appendFeedback(section);nextButton(section,step===KEY_STEPS.length-1?'Start quiz':'Next');
  }
  function renderExpression(section){
   section.dataset.kind='expression';const steps=authored?lessonSteps:EXPRESSION_LESSONS[id],question=steps[step];
   actionCue(section,learningStage==='look'?question.guide:answered?'Yes!':question.prompt);
   const picture=element('figure','lesson-expression-picture'),symbols=element('div','lesson-expression-symbols');
   if(question.marks)for(const mark of question.marks){const value=DYNAMIC_LEVELS.find(item=>item.mark===mark),symbol=element('span','lesson-dynamic-symbol',String.fromCodePoint(value.code));symbol.setAttribute('role','img');symbol.setAttribute('aria-label',mark+': '+value.name+', '+value.meaning);symbol.dataset.dynamic=mark;symbols.append(symbol);}
   if(question.words)for(const word of question.words)symbols.append(element('span','lesson-tempo-word',word));
   if(question.hairpin){const growing=question.hairpin==='crescendo',hairpin=element('div','lesson-hairpin');hairpin.setAttribute('role','img');hairpin.setAttribute('aria-label',question.hairpin+': gradually '+(growing?'louder':'softer'));hairpin.innerHTML='<svg viewBox="0 0 240 52" aria-hidden="true" focusable="false"><path d="'+(growing?'M12 26L228 7M12 26L228 45':'M12 7L228 26M12 45L228 26')+'" fill="none" stroke="currentColor" stroke-width="3"/></svg>';symbols.append(hairpin);}
   picture.append(symbols,element('figcaption','lesson-expression-caption',question.caption));section.append(picture);
   const sounds=element('div','lesson-actions lesson-expression-sounds');question.sounds.forEach((sound,index)=>sounds.append(button(sound.label,()=>playExpression(sound),{'data-expression-listen':index})));section.append(sounds);
   const pulse=element('span','lesson-expression-pulse','•');pulse.dataset.expressionPulse='';pulse.setAttribute('aria-hidden','true');section.append(pulse);
   if(learningStage==='look'){appendFeedback(section);tryButton(section);return;}
   if(!answered){const answers=element('div','lesson-expression-answers');answers.setAttribute('role','group');answers.setAttribute('aria-label','Choose an answer');question.answers.forEach((label,index)=>answers.append(button(label,()=>{
    if(answered||complete)return;if(index!==question.answer){feedback('Not yet. '+question.hint,false);return;}
    stopAudio();answered=true;persist(step+1);message='Yes!';correct=true;render();host.querySelector('[data-tutorial-next]')?.focus({preventScroll:true});
   },{'data-expression-answer':index})));section.append(answers);}
   appendFeedback(section);nextButton(section,step===steps.length-1?'Start quiz':'Next');
  }
  function appendFeedback(section){const feedbackNode=element('p','tutorial-feedback',message);feedbackNode.setAttribute('role','status');feedbackNode.setAttribute('aria-live','polite');feedbackNode.dataset.correct=String(correct);section.append(feedbackNode);}
  function renderAuthoredPicture(section){
   if(!authored||complete||quizzing||studying||noteReminder)return;
   const model=lessonSteps?.[step];if(!model)return;const values=[model.visual,...(model.visuals||[])].filter(Boolean);
   if(!values.length&&!model.hideVisual)return;
   const pictures=element('div','lesson-authored-visuals');pictures.style.width='100%';
   for(const value of values){
    const picture=element('figure','lesson-authored-notation lesson-note-reminder-picture'),module=win.CodaEducationNotation;
    let rendered=win.CodaClassroomLearningPaths?.renderVisual?.(picture,value)===true;
    if(!rendered&&value.kind==='notation'&&module){const checked=module.validate(value.score);if(checked.ok){picture.innerHTML=module.toSVG(checked.data);rendered=true;}}
    else if(!rendered&&value.kind==='keyboard'&&win.CodaClassroomKeyboard){const checked=win.CodaClassroomKeyboard.validateVisual(value);if(checked.ok){picture.innerHTML=win.CodaClassroomKeyboard.toSVG(checked.data);rendered=true;}}
    else if(!rendered&&value.kind==='clef-intro'&&['treble','bass'].includes(value.clef)&&['clef','staff','lines','spaces'].includes(value.page)){picture.innerHTML=clefReminderSVG(value.clef,value.page);rendered=true;}
    else if(!rendered&&value.kind==='staff'){picture.innerHTML=staffSVG(value.position,value);rendered=true;}
    if(rendered)pictures.append(picture);
   }
   const original=section.querySelector('.lesson-naming-example,.lesson-staff-wrap,.lesson-rhythm-example,.lesson-split-picture,.lesson-keys-picture,.lesson-expression-picture,.signature-visual'),caption=original?.querySelector('figcaption')?.cloneNode(true);
   if(model.visual||model.hideVisual){if(original){if(caption)pictures.append(caption);if(pictures.childElementCount)original.replaceWith(pictures);else if(model.hideVisual)original.remove();}else if(pictures.childElementCount)section.querySelector('.lesson-action-cue,.signature-main-prompt')?.after(pictures);}
   else if(pictures.childElementCount){if(original)original.after(pictures);else section.querySelector('.lesson-action-cue,.signature-main-prompt')?.after(pictures);}
   notation.load?.(doc);
  }
  function renderComplete(section){
   actionCue(section,'You did it!');
   let reward='Keep practising whenever you like.';if(award?.ok===false)reward=award.error||'Let’s save your reward again.';else if(award?.alreadyAwarded)reward='You already earned this reward.';else if(award?.amount>0)reward='+'+award.amount+' XP';
   const status=element('p','tutorial-feedback',reward);status.setAttribute('role','status');section.append(status);if(award?.ok===false)section.append(button('Save again',()=>{if(progress().completed.includes(id)){notifyCompletion();render();}else finish();}));
   section.append(button('Quiz again',()=>beginQuiz(true),{'data-tutorial-quiz':''}),button('Practice again',()=>reset(false),{'data-tutorial-replay':''}));
  }
  function render(){
   if(destroyed||!id)return;const oldFocus=host.contains(doc.activeElement)?doc.activeElement:null;let restore=null;if(oldFocus){for(const attr of ['data-pitch','data-note-answer','data-tree-split','data-tree-join','data-tutorial-next','data-add-value','data-check-rhythm','data-tutorial-replay'])if(oldFocus.hasAttribute(attr)){restore='['+attr+'=\"'+oldFocus.getAttribute(attr)+'\"]';break;}}host.replaceChildren();host.classList.add('classroom-tutorial');host.dataset.tutorial=id;host.dataset.phase=noteReminder?'lesson':studying?'study':complete?'complete':quizzing?'quiz':'lesson';host.dataset.learningStage=studying?study?.getState().stage||'look':learningStage;const lesson=LESSONS.find(item=>item.id===id),heading=element('div','lesson-topline');heading.append(element('span','lesson-step-label',noteReminder?'Learn the clef':studying?'Exam lesson':complete?'Finished':quizzing?'Quiz':'Step '+(step+1)+' of '+lesson.total));host.append(heading);
   if(!studying&&!quizzing){const progress=element('progress');progress.max=lesson.total;progress.value=complete?lesson.total:step+(answered?1:0);progress.setAttribute('aria-label',lesson.title+' progress');host.append(progress);}
   if(!studying&&!noteReminder&&!quizzing&&(complete||learningStage==='look')&&(hasStudy()||api.requireExamCurriculum)){const entry=element('div','lesson-exam-study-entry');entry.append(button('Study for the exam',()=>startStudy(false),{'data-tutorial-study':''}));host.append(entry);}
   const section=element('section','lesson-content');section.setAttribute('aria-label',lesson.title+(quizzing?' quiz':' activity'));host.append(section);
   if(noteReminder&&(id==='note-naming'||id==='bass-clef'))renderNoteReminders(section);else if(studying){if(studyError){const message=element('p','tutorial-feedback',studyError);message.setAttribute('role','status');section.append(message,button('Try loading again',()=>startStudy(studyThenQuiz),{'data-study-retry-load':''}),button('Back to lesson',leaveStudy,{'data-study-exit':''}));}else{if(!study)study=win.CodaClassroomExamStudy.create({...studyOptions(),host:section,onComplete:finishStudy,onExit:leaveStudy});study.render(section);}}else if(complete)renderComplete(section);else if(quizzing){if(ensureQuiz())quiz.render(section);else section.append(element('p','lesson-teach','The quiz could not load. Reload the page to try again.'));}else if(NOTE_LESSONS[id])renderNaming(section);else if(id==='major-minor-keys')renderKeys(section);else if(EXPRESSION_LESSONS[id])renderExpression(section);else if(id==='time-signatures'){if(signatureLesson)signatureLesson.render(section,{step,answered});else section.append(element('p','','The time-signature lesson could not load. Reload the page to try again.'));}else renderRhythm(section);const bookViewport=host.closest('.classroom-books');if(bookViewport)bookViewport.scrollTop=0;if(oldFocus&&!quizzing){let target=restore?host.querySelector(restore):null;if(!target||target.disabled)target=host.querySelector('h3');if(target){if(target.tagName==='H3')target.tabIndex=-1;target.focus({preventScroll:true});}}
   renderAuthoredPicture(section);
  }
  function reset(resume=true){
   stopAudio();study?.destroy();study=null;studying=false;studyError='';quiz?.destroy();quiz=null;signatureLesson?.reset();const saved=progress().lessons.find(lesson=>lesson.id===id),total=LESSONS.find(lesson=>lesson.id===id).total;step=resume?saved.step:0;complete=resume&&saved.completed;quizzing=resume&&!complete&&step>=total;freshQuiz=!resume;clefIntroSeen=false;noteReminder=!complete&&!quizzing&&(id==='bass-clef'||id==='note-naming'&&step>=4)?'staff':null;noteReminderReturn=null;noteReminderAfter=null;learningStage='look';answered=false;message='';correct=null;hintShown=false;level=0;explored=new Set([0]);bar=[];award=null;
   if(complete){ensureQuiz();notifyCompletion();}else if(quizzing){const prior=ensureQuiz()?.getState();const resumeQuiz=()=>{if(!prior?.answers.length)beginAssessment();else render();};if(needsClefIntro()){openNoteReminders(resumeQuiz);return;}if(!prior?.answers.length){beginAssessment();return;}}render();
  }
  function open(lessonId,options={}){if(!LESSONS.some(lesson=>lesson.id===lessonId))return false;id=lessonId;contentChanged=false;authored=content?.isLessonEdited?.(id)===true;contentRevision=content?.getLessonRevision?.(id)||'';lessonSteps=authored?content.getLessonSteps(id):null;expectedLesson=JSON.stringify(authoredJournal().lessons[id]??null);reset();if(options.study)startStudy(false);return true;}
  return {open,openStudy:()=>startStudy(false),stopAudio,destroy(){stopAudio();study?.destroy();quiz?.destroy();signatureLesson?.destroy();destroyed=true;host.replaceChildren();},getState:()=>({...progress(),active:id?{id,step,custom:authored,contentRevision,noteReminder,learningStage:studying?study?.getState().stage||'look':id==='time-signatures'?signatureLesson?.getState().stage||'look':learningStage,answered,complete,phase:noteReminder?'lesson':studying?'study':complete?'complete':quizzing?'quiz':'lesson',study:studying?study?.getState()||{error:studyError}:null,quiz:quiz?.getState()||null,treeLevel:level,explored:[...explored],bar:[...bar],timeSignatures:id==='time-signatures'?signatureLesson?.getState():null,audioPlaying:!!audio||signatureLesson?.getState().audioPlaying===true,error}:null})};
 }
 return {KEY,CUSTOM_KEY,LESSONS,VALUES,NOTE_STEPS,BASS_STEPS,GRAND_STEPS,KEY_STEPS,NOTE_LESSONS,DYNAMIC_LEVELS,DYNAMICS_STEPS,TEMPO_STEPS,EXPRESSION_LESSONS,EXPRESSION_NOTES,SIMPLE_NOTE_COPY,CLEF_REMINDERS,clefReminderSVG,splitExample,validBar,normalize,readProgress,glyph,staffSVG,treeSVG,create};
});
