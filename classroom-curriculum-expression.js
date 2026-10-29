/* Small teaching steps for every keys, dynamics, and tempo exam objective. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CodaClassroomCurriculumExpression=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const span=(first,last)=>Array.from({length:last-first+1},(_,index)=>first+index);
 const cycle=first=>Array.from({length:12},(_,index)=>first+index*7);
 const alternate=first=>Array.from({length:6},(_,index)=>first+index*2);
 const ids=(category,...numbers)=>[...new Set(numbers.flat())].sort((a,b)=>a-b).map(number=>category+'-'+String(number).padStart(3,'0'));
 const keys=(...numbers)=>ids('major-minor-keys',...numbers),dynamics=(...numbers)=>ids('dynamics',...numbers),tempo=(...numbers)=>ids('tempo',...numbers);
 const LESSONS={
  'major-minor-keys':[
   {
    id:'major-minor-keys-home',title:'Find the home note',
    teach:'The home note is called the tonic. Read the first part of a key’s name to find it.',
    example:'D major comes home to D. B-flat minor comes home to B-flat. The home letter repeats higher or lower.',
    prompt:'What is the tonic of F-sharp minor?',answers:['F','F-sharp','A'],correct:1,
    hint:'Keep the whole first note name, including its sharp or flat.',
    visual:{kind:'scale',notes:['F-sharp','G-sharp','A','B','C-sharp','D','E','F-sharp']},
    covers:keys(cycle(1),cycle(2),91,94,99,100)
   },
   {
    id:'major-minor-keys-letter-ladder',title:'Follow the letter ladder',
    teach:'Scale letters move A, B, C, D, E, F, G, then start again. Keep each note’s printed sharp or flat.',
    example:'A major shows A B C-sharp D E ? G-sharp. The missing letter is F. Of the offered choices, choose the F-sharp answer.',
    prompt:'Which letter comes next in E, F, G, …?',answers:['A','H','E'],correct:0,
    hint:'After G, the music letters start again at A.',
    visual:{kind:'scale',notes:['E','F','G','?']},
    covers:keys(cycle(6),85,86,87,99)
   },
   {
    id:'major-minor-keys-accidentals',title:'Read the whole note name',
    teach:'A sharp raises a note one half step. A flat lowers it one half step. Both change pitch.',
    example:'C-sharp is the next piano key above C. E-flat is the next key below E. Include black keys when finding the next key.',
    prompt:'What does D-sharp mean?',answers:['A louder D','The next key below D','The next key above D'],correct:2,
    hint:'Sharp means the next piano key higher, not a change in loudness.',
    visual:{kind:'keyboard',notes:['C','C-sharp','E','E-flat']},
    covers:keys(cycle(6),88,97)
   },
   {
    id:'major-minor-keys-key-steps',title:'Small steps and bigger steps',
    teach:'A half step reaches the very next piano key, including black keys. A whole step takes two half steps.',
    example:'C → C-sharp is a half step. C → C-sharp → D is a whole step. E → F is a half step: no black key sits between them.',
    prompt:'How many half steps make one whole step?',answers:['1','2','3'],correct:1,
    hint:'Take two next-key moves to make a whole step.',
    visual:{kind:'keyboard',notes:['C','C-sharp','D','E','F']},
    covers:keys(cycle(6),88)
   },
   {
    id:'major-minor-keys-major-pattern',title:'Build a major scale',
    teach:'A major scale follows whole, whole, half, whole, whole, whole, half. These are distances between neighboring scale notes.',
    example:'C major starts C → D: whole; D → E: whole; E → F: half. Its full ladder is C D E F G A B C.',
    prompt:'In C major, is E → F a whole step or a half step?',answers:['Whole step','Three steps','Half step'],correct:2,
    hint:'E and F are neighboring piano keys. That is one half step.',
    visual:{kind:'scale',notes:['C','D','E','F','G','A','B','C']},
    covers:keys(cycle(6),85,88)
   },
   {
    id:'major-minor-keys-scale-numbers',title:'Count the home as one',
    teach:'Number a shown scale from its home. The first note is 1, the next is 2, and so on.',
    example:'C D E F G A B becomes C=1, D=2, E=3, F=4, G=5, A=6, B=7. Keep sharp and flat names when counting.',
    prompt:'With C counted as 1, what number is A?',answers:['6','3','4'],correct:0,
    hint:'Touch each note once: C 1, D 2, E 3, F 4, G 5, A 6.',
    visual:{kind:'scale',notes:['C','D','E','F','G','A','B']},
    covers:keys(cycle(3),cycle(4),cycle(5),90)
   },
   {
    id:'major-minor-keys-third-note',title:'Find the third note',
    teach:'To find a scale’s third note, count its home as 1. This works for both major and natural minor.',
    example:'G major begins G A B, so B is third. A natural minor begins A B C, so C is third. Read the supplied scale.',
    prompt:'D major begins D, E, F-sharp. Which is its third note?',answers:['E','F-sharp','G'],correct:1,
    hint:'Count D as 1, E as 2, and F-sharp as 3.',
    visual:{kind:'scale',notes:['D','E','F-sharp','G','A','B','C-sharp']},
    covers:keys(cycle(4),cycle(5),95,96)
   },
   {
    id:'major-minor-keys-relative-home',title:'Same notes, a new home',
    teach:'A major key and its relative natural minor share notes. The minor’s home is note 6 of the major scale.',
    example:'C D E F G A B: count C as 1. A is note 6, so C major and A minor share notes. Their homes differ.',
    prompt:'G major is G A B C D E F-sharp. Which relative minor starts on note 6?',answers:['A minor','B minor','E minor'],correct:2,
    hint:'Count G 1, A 2, B 3, C 4, D 5, E 6.',
    visual:{kind:'scale',notes:['G','A','B','C','D','E','F-sharp']},
    covers:keys(cycle(3),98,100)
   },
   {
    id:'major-minor-keys-parallel-colour',title:'Keep the home, change the colour',
    teach:'Major and minor can keep the same home. Changing a note can change the musical colour.',
    example:'C major uses C E G. C minor uses C E-flat G. E moves down a half step, while C stays home.',
    prompt:'What changes C E G into C E-flat G?',answers:['E changes to E-flat','C changes to D','G changes to A'],correct:0,
    hint:'Compare the middle note. E becomes E-flat.',
    visual:{kind:'scale',notes:['C','E-flat','G']},
    covers:keys(89,94,95,96)
   },
   {
    id:'major-minor-keys-triads',title:'Make a three-note chord',
    teach:'A triad is a three-note chord. Use notes 1, 3, and 5 of a scale.',
    example:'C major: C D E F G. Notes 1, 3, 5 are C E G. In C minor, the third is E-flat: C E-flat G.',
    prompt:'Which notes make the C major triad?',answers:['C F A','C E G','C E-flat G'],correct:1,
    hint:'Count the major scale: C 1, D 2, E 3, F 4, G 5.',
    visual:{kind:'scale',notes:['C','D','E','F','G']},
    covers:keys(89,95,96)
   },
   {
    id:'major-minor-keys-check-the-list',title:'Check the shown notes',
    teach:'To check whether a note belongs, look through the supplied scale. Compare its full name, including sharp or flat.',
    example:'D major shows D E F-sharp G A B C-sharp. F-sharp is in the list. F natural is not: F and F-sharp are different notes.',
    prompt:'D major shows D E F-sharp G A B C-sharp. Which note is outside this scale?',answers:['D','A','F natural'],correct:2,
    hint:'Look for the complete note name. The list has F-sharp, not F natural.',
    visual:{kind:'scale',notes:['D','E','F-sharp','G','A','B','C-sharp']},
    covers:keys(cycle(7),97)
   },
   {
    id:'major-minor-keys-many-moods',title:'Music has many moods',
    teach:'Major often sounds bright; minor can sound mellow or dramatic. Neither one has to match a single mood.',
    example:'A minor tune can be lively. A major tune can be gentle or sad. Speed, loudness, and many other choices help make the mood.',
    prompt:'Must every minor piece sound sad?',answers:['No','Yes','Only when it is fast'],correct:0,
    hint:'Major and minor are musical colours, not rules for one emotion.',
    covers:keys(92,93)
   }
  ],
  dynamics:[
   {
    id:'dynamics-loudness',title:'Change the loudness',
    teach:'Dynamics tells how loud or soft to play. It does not change the written pitches, rhythms, or tempo.',
    example:'Play the same C quietly, then loudly. Its pitch stays C. You can repeat the same rhythm at the same speed.',
    prompt:'A tune keeps its notes and speed but gets softer. What changed?',answers:['Its clef','Its dynamics','Its tempo'],correct:1,
    hint:'Louder or softer means a change in dynamics.',
    covers:dynamics(72,73,74,75,86,87,91,94,98,99)
   },
   {
    id:'dynamics-piano-forte',title:'Soft and loud',
    teach:'Piano means soft and uses p. Forte means loud and uses f.',
    example:'As an instruction, piano means soft, even when another instrument plays it. Changing f to p makes the music softer.',
    prompt:'Which instruction asks for a loud sound?',answers:['f: forte','p: piano','pp: pianissimo'],correct:0,
    hint:'Forte means loud. Its sign is f.',
    visual:{kind:'dynamic',mark:'f'},
    covers:dynamics(3,4,9,10,68,70,71,76,77)
   },
   {
    id:'dynamics-very-soft-loud',title:'Very soft still makes a sound',
    teach:'Pianissimo, pp, means very soft. Fortissimo, ff, means very loud. Very soft is different from silence.',
    example:'Play gently for pp. A rest tells you to make no sound. For ff, play very loudly while keeping a clear, controlled sound.',
    prompt:'Does pp mean complete silence?',answers:['Yes','It means very loud','No: play very softly'],correct:2,
    hint:'Pianissimo is a very soft sound. A rest means silence.',
    visual:{kind:'dynamic',mark:'pp'},
    covers:dynamics(1,2,11,12,69,79,80,90)
   },
   {
    id:'dynamics-middle-levels',title:'Meet the middle levels',
    teach:'Mezzo means medium or moderately. Mezzo piano, mp, is moderately soft; mezzo forte, mf, is moderately loud.',
    example:'mp and mf sit between the soft and loud ends. mf is louder than mp, but neither means an exact amount of force.',
    prompt:'Which full name belongs to mf?',answers:['Mezzo piano','Mezzo forte','Fortissimo'],correct:1,
    hint:'m means mezzo. f means forte: moderately loud.',
    visual:{kind:'dynamic',mark:'mf'},
    covers:dynamics(5,6,7,8,78,81,82,99)
   },
   {
    id:'dynamics-loudness-ladder',title:'Climb the loudness ladder',
    teach:'From softer to louder, the ladder is pp, p, mp, mf, f, ff. Move right to get louder.',
    example:'mp is softer than mf. f is softer than ff. For pp, mf, p, put them in this order: pp → p → mf.',
    prompt:'Which order goes from softer to louder?',answers:['p → mp → f','f → mp → p','mp → p → f'],correct:0,
    hint:'Find each mark on pp, p, mp, mf, f, ff, then move from left to right.',
    covers:dynamics(span(13,52),92,93,95,96)
   },
   {
    id:'dynamics-crescendo',title:'Grow the sound',
    teach:'Crescendo means gradually louder. Its hairpin opens wider from left to right. The speed can stay the same.',
    example:'Start p, then let the sound grow toward f over several notes. Do not speed up unless another instruction changes the tempo.',
    prompt:'What does this widening hairpin ask you to do?',answers:['Play faster','Play slower','Grow louder'],correct:2,
    hint:'A crescendo opens wider as the sound grows.',
    visual:{kind:'dynamic',mark:'crescendo'},
    covers:dynamics(alternate(53),65,84,86,97)
   },
   {
    id:'dynamics-decrescendo',title:'Let the sound fade',
    teach:'Decrescendo and diminuendo both mean gradually softer. The hairpin closes from left to right. Keep counting the beat.',
    example:'Start f, then gradually fade toward p. The notes keep their written lengths, and the beat stays even unless the tempo changes.',
    prompt:'Which word also means gradually softer?',answers:['Accelerando','Diminuendo','Crescendo'],correct:1,
    hint:'Diminuendo and decrescendo both describe a sound getting softer.',
    visual:{kind:'dynamic',mark:'decrescendo'},
    covers:dynamics(alternate(54),66,83,85,87,98)
   },
   {
    id:'dynamics-one-change',title:'Keep the other parts steady',
    teach:'Changing loudness does not automatically change speed, pitch, or note lengths. You can change one thing at a time.',
    example:'A singer repeats the same phrase more quietly. The notes need not become shorter, and the steady beat need not become slower.',
    prompt:'Does a decrescendo automatically mean slow down?',answers:['No','Yes','Only in bass clef'],correct:0,
    hint:'Decrescendo changes loudness. Ritardando is the instruction for gradually slowing down.',
    covers:dynamics(72,73,74,86,87,91,94,98,99)
   },
   {
    id:'dynamics-listen-together',title:'Listen to the whole group',
    teach:'Dynamics depends on the music around you. Listen so everyone can be heard, and keep loud playing clear and controlled.',
    example:'Two instruments both read mf. They may use different effort to balance their sounds. If you cover a quiet solo, play more softly.',
    prompt:'You cannot hear the solo because your part is too loud. What can help?',answers:['Play faster','Use more force','Play more softly'],correct:2,
    hint:'Balance means listening to the other musicians as well as yourself.',
    covers:dynamics(67,88,89,100)
   },
   {
    id:'dynamics-arrive-at-mark',title:'Arrive at the next sign',
    teach:'A new dynamic tells you the next loudness. Finish a crescendo at its marked destination instead of growing louder forever.',
    example:'The music goes p, then crescendo, then f. Begin softly, grow gradually, and arrive at forte. Follow any new sign after that.',
    prompt:'A crescendo reaches f. Should you keep getting louder forever?',answers:['Yes','No: arrive at f','Stop all sound'],correct:1,
    hint:'The written f is the loudness you were growing toward.',
    visual:{kind:'dynamic',mark:'f'},
    covers:dynamics(68,69,70,71,97)
   }
  ],
  tempo:[
   {
    id:'tempo-beat-and-rhythm',title:'Feel the beat underneath',
    teach:'A metronome gives steady beat clicks. Tempo is their speed. Rhythm is the changing pattern of note lengths.',
    example:'Keep tapping the steady beat while a tune uses long and short notes. Short notes can fit over slow beats; fast beats can continue under a held note.',
    prompt:'Must a busy rhythm always have a fast tempo?',answers:['Yes','No','Only in bass clef'],correct:1,
    hint:'The note pattern can be busy while the steady beat stays slow.',
    covers:tempo(43,44,45,46,47,48,49,52,74,90,92)
   },
   {
    id:'tempo-slow-words',title:'Words for a slow pace',
    teach:'Largo means very slow and broad. Adagio means slow. Both guide the pace of the beat.',
    example:'A wide, very slow opening suits Largo. A slow, unhurried tune suits Adagio. These words describe speed, not loudness.',
    prompt:'Which word suggests a very slow, broad opening?',answers:['Largo','Presto','Allegro'],correct:0,
    hint:'Largo is the very slow, broad word.',
    visual:{kind:'tempo',text:'Largo'},
    covers:tempo(1,2,3,4,69,73)
   },
   {
    id:'tempo-middle-words',title:'Walking and moderate pace',
    teach:'Andante means at a walking pace. Moderato means at a moderate pace: neither especially slow nor especially fast.',
    example:'Imagine walking comfortably for Andante. Moderato suggests a middle pace. The music and its metronome marking help choose the exact speed.',
    prompt:'Which word suggests a walking pace?',answers:['Presto','Largo','Andante'],correct:2,
    hint:'Walk with Andante. Moderato is a moderate pace.',
    visual:{kind:'tempo',text:'Andante'},
    covers:tempo(5,6,7,8,70,71)
   },
   {
    id:'tempo-fast-words',title:'Lively and very fast',
    teach:'Allegro means fast and lively. Presto means very fast. Tempo words suggest a pace, not one fixed BPM for every piece.',
    example:'Allegro can suit a lively dance; Presto can suit a very fast chase. Neither word changes note letters or tells you an exact loudness.',
    prompt:'Which word suggests very fast music?',answers:['Presto','Adagio','Largo'],correct:0,
    hint:'Presto is very fast. Allegro is fast and lively.',
    visual:{kind:'tempo',text:'Presto'},
    covers:tempo(9,10,11,12,68,72,94,95,100)
   },
   {
    id:'tempo-bpm-number',title:'Read beats per minute',
    teach:'BPM means beats per minute. With the same beat note, a bigger number means a faster beat.',
    example:'A metronome at 80 BPM makes 80 beats in one minute. With the same beat note, 120 BPM is faster than 80 BPM.',
    prompt:'For the same beat note, which is slower: 72 BPM or 144 BPM?',answers:['144 BPM','72 BPM','They are equal'],correct:1,
    hint:'The smaller number gives fewer beats each minute, so they arrive more slowly.',
    visual:{kind:'tempo',text:'Metronome',bpm:80},
    covers:tempo(span(13,42),span(75,82),91)
   },
   {
    id:'tempo-accelerando',title:'Speed up little by little',
    teach:'Accelerando means gradually faster. The beats move closer together. Loudness stays the same unless another sign changes it.',
    example:'Like a train gathering speed, the pulse moves from slow to faster over several beats. You can do this softly or loudly.',
    prompt:'The music says accelerando. What should happen?',answers:['It gets louder','It gets softer','It gradually gets faster'],correct:2,
    hint:'Accelerando changes the speed of the beat, not its loudness.',
    visual:{kind:'tempo',text:'accelerando'},
    covers:tempo(alternate(53),65)
   },
   {
    id:'tempo-ritardando',title:'Slow down little by little',
    teach:'Ritardando means gradually slower. Let the beats spread farther apart smoothly, rather than stopping or skipping them.',
    example:'At the end of a tune, the pulse gently relaxes. Ritardando describes that slowing, not a quieter sound.',
    prompt:'Which instruction asks for gradually slower beats?',answers:['Ritardando','Crescendo','Pianissimo'],correct:0,
    hint:'Ritardando slows the beat. Crescendo and pianissimo describe loudness.',
    visual:{kind:'tempo',text:'ritardando'},
    covers:tempo(alternate(54),66,93)
   },
   {
    id:'tempo-return',title:'Go back to the earlier speed',
    teach:'A tempo means return to the earlier main speed after a tempo change.',
    example:'Start at 100 BPM, then slow down. When you see a tempo, return to 100 BPM: the speed before the slowing.',
    prompt:'Your earlier speed was 80 BPM. After slowing, a tempo means return to…',answers:['40 BPM','80 BPM','160 BPM'],correct:1,
    hint:'Return to the earlier speed, not a doubled or halved speed.',
    visual:{kind:'tempo',text:'a tempo'},
    covers:tempo(67)
   },
   {
    id:'tempo-beat-seconds',title:'Fit beats into seconds',
    teach:'At 60 BPM, one beat takes one second. At 120 BPM, each beat takes half a second.',
    example:'At 30 BPM, beats are farther apart: one beat takes two seconds. At 60 BPM, tap once each second. At 120 BPM, tap twice each second.',
    prompt:'At 30 BPM, about how long is one beat?',answers:['Half a second','One second','Two seconds'],correct:2,
    hint:'There are 60 seconds in a minute. Thirty beats fit when each takes two seconds.',
    visual:{kind:'tempo',text:'Metronome',bpm:30},
    covers:tempo(83,84,85)
   },
   {
    id:'tempo-groups-of-beats',title:'Count a group of beats',
    teach:'Find a group’s time by adding the time each beat takes. You can count beats instead of rushing.',
    example:'60 BPM: four beats last four seconds. 120 BPM: four beats last two seconds. At 120 BPM, two beats fit in each second.',
    prompt:'At 120 BPM, how many beats fit in two seconds?',answers:['2 beats','4 beats','8 beats'],correct:1,
    hint:'Two beats fit in one second. Another two fit in the next second: four altogether.',
    visual:{kind:'tempo',text:'Metronome',bpm:120},
    covers:tempo(86,87,88,89)
   },
   {
    id:'tempo-beat-note',title:'Read the note beside the number',
    teach:'A metronome marking needs a note and a number. The note shows what gets each click; the number gives BPM.',
    example:'Half note = 60 means each click is one half-note beat. Quarter note = 60 uses quarter-note beats. The number alone does not tell the whole story.',
    prompt:'A marking says half note = 60. Which note gets each click?',answers:['Half note','Quarter note','Eighth note'],correct:0,
    hint:'Read the pictured note first, then read how many of those beats fit in a minute.',
    visual:{kind:'note',beats:2},
    covers:tempo(96,97)
   },
   {
    id:'tempo-two-changes',title:'Change speed and loudness separately',
    teach:'Tempo changes speed; dynamics changes loudness. They can change separately or together when both instructions appear.',
    example:'Ritardando plus decrescendo means slower and softer. Accelerando plus crescendo means faster and louder. A crescendo alone does not tell you to speed up.',
    prompt:'Ritardando and decrescendo happen together. What changes?',answers:['Only pitch','Faster and louder','Slower and softer'],correct:2,
    hint:'Ritardando slows down. Decrescendo gets softer.',
    covers:tempo(50,51,93,94,95,98,99)
   }
  ]
 };
 function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
 return freeze(LESSONS);
});
