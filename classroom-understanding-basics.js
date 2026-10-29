/* Follow-up checks for the short foundational rhythm, key, and tempo cards. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaUnderstandingBasics=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const q=(prompt,answers,correct,hint)=>({prompt,answers,correct,hint});
 const CHECKS={
  'path-note-head':[
   q('One notehead is filled in and another is hollow. Which one is still a notehead?',
    ['Both of them','Only the filled one','Only the hollow one'],0,
    'A notehead is the round part. It can be filled in or hollow.'),
   q('You are asked to point to the notehead. Which shape should you look for?',
    ['A tall straight line','A round shape','A curved part at the top'],1,
    'Find the round part, rather than the tall stem or curved flag.')
  ],
  'path-note-stem':[
   q('A note stays in the same place, but its stem changes from pointing up to pointing down. Does its note name change?',
    ['Yes, it becomes a lower note','No, the name stays the same','Yes, it becomes a higher note'],1,
    'The direction of the stem does not change the note’s name.'),
   q('Where does the tall stem connect to the rest of the note?',
    ['To the round notehead','To a bar line','To the next note'],0,
    'A stem is the straight line joined to the notehead.')
  ],
  'path-note-flag':[
   q('Must every musical note have a flag?',
    ['Yes, every note has one','No, some notes have no flag','Only notes with hollow heads have flags'],1,
    'Some notes have a flag and others do not. Look for the curved part.'),
   q('Which description would help a friend find a flag?',
    ['The round part that can be hollow','The curved part at the end of the stem','The straight line beside the notehead'],1,
    'The flag curves away from the end of the stem.')
  ],
  'path-half-note':[
   q('Which picture would show a half note?',
    ['A hollow head with a stem','A filled head with a flag','A hollow head without a stem'],0,
    'The half note has both a hollow head and a stem.'),
   q('You start a half note on beat 1 in 4/4. What should you do on beat 2?',
    ['Play a new note','Keep holding the same note','Stop counting'],1,
    'Play the half note once, then hold it while you count both beats.')
  ],
  'path-eighth-note':[
   q('An eighth note is written by itself. What parts do you expect to see?',
    ['A hollow head and no stem','A filled head, a stem, and one flag','A filled head without a stem'],1,
    'A single eighth note has a filled notehead, a stem, and one flag.'),
   q('You play two eighth notes while counting “1 &”. When does the second note begin?',
    ['On the &','On beat 2','At the same time as the first note'],0,
    'The first eighth starts on 1. The second starts on &, within the same beat.')
  ],
  'path-tree-whole-halves':[
   q('A whole note takes 4 beats in 4/4. After splitting it into two half notes, what is their total time?',
    ['2 beats','4 beats','8 beats'],1,
    'Splitting changes the number of notes, not their total time: 2 + 2 = 4.'),
   q('The two halves of a whole note are equal. How long does each half last in 4/4?',
    ['1 beat','2 beats','4 beats'],1,
    'Share the whole note’s 4 beats equally: each half gets 2 beats.')
  ],
  'path-tree-half-quarters':[
   q('Replace a half note with two quarter notes in 4/4. What happens to the total time?',
    ['It stays at 2 beats','It becomes 1 beat','It becomes 4 beats'],0,
    'Each quarter lasts 1 beat. Together they still fill 1 + 1 = 2 beats.'),
   q('Which is shorter in 4/4: one of the quarter-note pieces or the original half note?',
    ['The quarter-note piece','The original half note','They have the same length'],0,
    'One quarter lasts 1 beat, while the original half lasts 2.')
  ],
  'path-tree-quarter-eighths':[
   q('When one quarter note splits into two equal eighth notes, each new note is…',
    ['Longer than the quarter','Shorter than the quarter','The same length as the quarter'],1,
    'Two equal shorter notes share the time that one quarter note used.'),
   q('Follow the rhythm tree: whole → half → quarter → ___. Which comes next?',
    ['Whole','Eighth','Half'],1,
    'Each branch splits a note into two equal shorter notes. Quarters split into eighths.')
  ],
  'path-count-quarters':[
   q('You finish counting 1, 2, 3, 4 in a 4/4 bar. Which number starts the next bar?',
    ['1','4','5'],0,
    'Each new 4/4 bar starts its count at 1 again.'),
   q('You clap four quarter notes on 1, 2, 3, 4. How many claps go on each number?',
    ['One clap','Two claps','No claps'],0,
    'A quarter note takes one beat here, so clap once on each number.')
  ],
  'path-count-held-notes':[
   q('You begin a whole note on beat 1 in 4/4. Should you play it again on beats 2, 3, and 4?',
    ['Yes, play again on every number','No, keep the same sound held','Play again only on 4'],1,
    'The beats keep passing, but the long note is played only once.'),
   q('Which beats start the two sounds when two half notes fill a 4/4 bar?',
    ['1 and 2','1 and 3','2 and 4'],1,
    'Hold the first sound through 1, 2. Start the second on 3 and hold through 4.')
  ],
  'path-count-eighths':[
   q('Where does each & belong when counting eighth notes in 4/4?',
    ['Halfway between two beat numbers','At the same time as a beat number','Only after the bar ends'],0,
    'Keep the numbers steady. Each & falls halfway to the next number.'),
   q('Two eighth notes share beat 2. Which two syllables match them?',
    ['2 &','2 3','1 2'],0,
    'Use that beat’s number and then &: 2 &.')
  ],
  'path-count-rests':[
   q('A bar says: play on 1, rest on 2, then play on 3 and 4. Which number follows the silent 2?',
    ['1','3','4'],1,
    'The silent beat still counts as 2, so the next sound starts on 3.'),
   q('During a one-beat rest, what should your instrument do for that beat?',
    ['Make a longer sound','Stay silent for the beat','Play an extra sound'],1,
    'A rest fills time with silence. Keep the count moving while the instrument is silent.')
  ],
  'path-sixteenth-note':[
   q('A sixteenth note is written by itself. How many flags does it have?',
    ['One','Two','No flags'],1,
    'A single sixteenth note has two flags.'),
   q('Grouped sixteenth notes can replace their flags with how many beams?',
    ['One beam','Two beams','Four beams'],1,
    'The two flags become two connecting beams when the notes are grouped.')
  ],
  'rhythm-tree-beat-depends-on-meter':[
   q('Which note gets one big beat in 2/2?',
    ['A half note','A quarter note','An eighth note'],0,
    'Cut time counts half-note big beats.'),
   q('In 2/2, two quarter notes together share how many big beats?',
    ['One big beat','Two big beats','Four big beats'],0,
    'Two quarters equal one half note, and the half note gets one big beat in 2/2.')
  ],
  'time-signatures-quarter-lengths':[
   q('How many sixteenth-note pieces make one quarter-note length?',
    ['2','4','8'],1,
    'Each tiny piece is ¼ of a quarter-note length. Four pieces make one whole quarter-note length.'),
   q('A 2/4 bar has used 1½ quarter-note lengths. How much written time is left?',
    ['½ quarter-note length','1 quarter-note length','1½ quarter-note lengths'],0,
    'Count from 1½ to 2: another ½ quarter-note length finishes the bar.')
  ],
  'time-signatures-same-length-different-beats':[
   q('How many main beats do you feel in a 2/2 bar?',
    ['Two half-note big beats','Four quarter-note big beats','Six eighth-note big beats'],0,
    'In 2/2, the two main beats are each a half note long.'),
   q('Four quarter notes fill a 4/4 bar. Can those same four written quarters also fill a 2/2 bar?',
    ['Yes, grouped into two half-note big beats','No, 2/2 needs twice as many quarters','No, 2/2 needs half as many quarters'],0,
    'Both bars hold four quarter-note lengths. Their main-beat grouping is different.')
  ],
  'path-key-home':[
   q('What is the home note of A minor?',
    ['C','A','E'],1,
    'The first part of A minor’s name is its home note: A.'),
   q('A tune returns to one note and feels settled or finished. What might you have found?',
    ['Its home note','Its loudest sound','Its fastest beat'],0,
    'A key gives music a home, and returning there often feels settled.')
  ],
  'path-tempo-meaning':[
   q('You tap a slower steady beat. Compared with a faster beat, the taps are…',
    ['Farther apart in time','Closer together in time','Always louder'],0,
    'A slower tempo leaves more time between the steady beats.'),
   q('The beats stay at the same speed, but you play more loudly. Did the tempo change?',
    ['Yes, louder always means faster','No, the speed of the beat stayed the same','Yes, the note names changed'],1,
    'Tempo is speed, not loudness. A louder sound can keep the same tempo.')
  ],
  'tempo-return':[
   q('Which instruction best describes “a tempo” after a change in speed?',
    ['Return to the earlier main speed','Keep getting faster','Use half the earlier speed'],0,
    'A tempo restores the earlier main tempo.'),
   q('You follow “a tempo” and return to the earlier speed. What should you do next if there is no new speed instruction?',
    ['Keep that earlier main speed steady','Continue speeding up','Continue slowing down'],0,
    'Return to the main speed and keep it steady until another instruction changes it.')
  ]
 };
 function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
 return freeze({CHECKS});
});
