/* Follow-up checks for staff foundations and accidentals. Each pair stays
 * within the teaching and worked example on its original lesson card. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaUnderstandingStaff=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const q=(prompt,answers,correct,hint,visual)=>({prompt,answers,correct,hint,...(visual?{visual}:{})});
 const map=(clef,page)=>({kind:'clef-intro',clef,page});
 const staff=(clef,position)=>({kind:'staff',clef,position});
 const CHECKS={
  'path-treble-clef':[
   q('The treble clef curls around Line 2. Which note does that line name?',['E','G','B'],1,'The treble clef is the G clef. Its curl points out G on Line 2.',map('treble','clef')),
   q('Where would you look for the clef before reading the notes?',['At the start of the staff','Inside every notehead','After the last note'],0,'The clef begins the staff and gives you its note-name map.',map('treble','clef'))
  ],
  'treble-check-clef':[
   q('This is a treble staff. What is the note on Line 1?',['G','E','A'],1,'Line 1 is the lowest line. The treble map names it E.',staff('treble',0)),
   q('Now the clef is bass. What is the note on Line 1?',['E','F','G'],2,'The same line number uses a different map: bass Line 1 is G.',staff('bass',0))
  ],
  'path-treble-lines-reminder':[
   q('Which note belongs on treble Line 3?',['B','D','G'],0,'Count upward: Line 1 E, Line 2 G, Line 3 B, Line 4 D, Line 5 F.',map('treble','lines')),
   q('Which reminder word helps you name treble Line 5?',['Every','Boy','Fine'],2,'The five words match Lines 1–5. Fine names F on Line 5.',map('treble','lines'))
  ],
  'path-treble-spaces-reminder':[
   q('Which note belongs in treble Space 2?',['C','A','F'],1,'Count the spaces upward: Space 1 F, Space 2 A, Space 3 C, Space 4 E.',map('treble','spaces')),
   q('The note is in treble Space 4. Which letter in FACE names it?',['F','C','E'],2,'FACE reads upward through Spaces 1–4, ending with E in Space 4.',map('treble','spaces'))
  ],
  'treble-sharp-sign':[
   q('To play F-sharp from F on a piano, which way do you move to the next key?',['Right, to a higher key','Left, to a lower key','Stay on F'],0,'A sharp moves one half step higher. Higher piano keys are to the right.'),
   q('A quarter note receives a sharp sign. What happens to its written length?',['It doubles','It stays a quarter note','It becomes an eighth note'],1,'The sharp changes pitch. The quarter-note shape still gives the same length.')
  ],
  'treble-flat-sign':[
   q('To play E-flat from E on a piano, which neighboring key do you choose?',['The next key to the right','E again','The next key to the left'],2,'Flat lowers pitch by one half step. Move left to the very next key.'),
   q('A flat sign changes which part of the music?',['The note’s pitch','How loudly every note must play','The speed of the beat'],0,'A flat lowers a pitch. It is not a loudness or tempo instruction.')
  ],
  'treble-natural-sign':[
   q('An F-flat is changed by a natural sign. Which note returns?',['F-flat','F','F-sharp'],1,'The natural cancels the flat and restores the letter pitch F.'),
   q('Does a natural sign always tell you to move to a higher pitch?',['Yes, always higher','Yes, two keys higher','No; it cancels the earlier change'],2,'Cancelling a sharp can move down; cancelling a flat can move up. Natural means restore the natural pitch.')
  ],
  'path-bass-staff':[
   q('How many numbered spaces fit between the five staff lines?',['4','5','6'],0,'Five lines have four gaps between them: Spaces 1, 2, 3, and 4.',map('bass','staff')),
   q('Which line number is at the top of the staff?',['Line 1','Line 5','Line 3'],1,'Count lines upward from Line 1 to Line 5.',map('bass','staff'))
  ],
  'path-bass-clef':[
   q('Which note name is marked by the line between the bass clef’s two dots?',['G','C','F'],2,'The dots surround the F line. This is why bass is also called the F clef.',map('bass','clef')),
   q('What does the bass clef help you read?',['The lower-note map','How loudly every note sounds','The colour of a piano'],0,'The bass clef gives the staff a map for reading lower notes.',map('bass','clef'))
  ],
  'path-bass-lines-reminder':[
   q('Which note belongs on bass Line 2?',['D','B','F'],1,'Great Big Dreams For America gives G B D F A on Lines 1–5.',map('bass','lines')),
   q('Which reminder word belongs to bass Line 4?',['Dreams','America','For'],2,'Lines 1–5 match Great, Big, Dreams, For, America. For names F on Line 4.',map('bass','lines'))
  ],
  'path-bass-spaces-reminder':[
   q('Which note belongs in bass Space 2?',['C','A','E'],0,'All Cows Eat Grass gives A C E G in Spaces 1–4.',map('bass','spaces')),
   q('Which word helps you name bass Space 3?',['Cows','Eat','Grass'],1,'Spaces 1–4 match All, Cows, Eat, Grass. Eat names E in Space 3.',map('bass','spaces'))
  ],
  'grand-play-together':[
   q('Which direction do we read to follow when notes begin?',['Only up and down','Only by stem direction','From left to right'],2,'Read left to right for time. Notes at the same horizontal place can begin together.'),
   q('What groups the upper and lower staffs into one grand-staff part?',['The brace','A sharp sign','One notehead'],0,'The brace shows that both staffs belong together in the same part.')
  ],
  'accidentals-key-signatures-neighbors':[
   q('Starting on C-sharp, which key is one half step higher?',['C','D','E'],1,'C-sharp and D are neighboring piano keys.'),
   q('How many half-step moves take you from C through C-sharp to D?',['1','3','2'],2,'C to C-sharp is one move. C-sharp to D is a second move.')
  ],
  'accidentals-key-signatures-whole-step':[
   q('Start on C and move to the next key twice. Where do you finish?',['D','C-sharp','E'],0,'Move C → C-sharp → D. Two half steps make one whole step.'),
   q('A player forgets to count C-sharp between C and D. What should they do?',['Ignore black keys','Count every neighboring key','Count only the white keys'],1,'Each move goes to the very next key, including the black key.')
  ],
  'accidentals-key-signatures-white-neighbors':[
   q('How far apart are neighboring B and C?',['A whole step','Two whole steps','A half step'],2,'There is no black key between B and C; one move reaches the next key.'),
   q('Can a half-step move land on a white piano key?',['Yes; E to F is an example','No; it must land on black','Only if you skip a key'],0,'A half step means the next key, whatever its colour.')
  ],
  'accidentals-key-signatures-sharp':[
   q('C receives a sharp sign. What name do you use for its changed pitch?',['C-flat','C-sharp','D-flat only'],1,'Keep the note’s letter C and add sharp: C-sharp.'),
   q('A sharp sign appears before a note. Must you also play that note louder?',['Yes, twice as loud','Yes, as loud as possible','No; the sign changes pitch'],2,'Sharp raises the note by one half step. It does not set loudness.')
  ],
  'accidentals-key-signatures-flat':[
   q('Which letter stays in the name E-flat?',['E','F','D'],0,'Keep the letter E and add flat to show its lower pitch.'),
   q('Adding a flat to a note changes its pitch or its beat count?',['Its beat count','Its pitch','Both must double'],1,'Flat lowers the pitch by one half step. The written note length stays the same.')
  ],
  'accidentals-key-signatures-natural':[
   q('C-sharp is cancelled by a natural sign. What do you play?',['C-sharp again','D','C natural'],2,'The natural sign cancels the sharp and restores C.'),
   q('An E-flat receives a natural sign. Which pitch is restored?',['E natural','E-flat','E-sharp'],0,'A natural cancels a flat as well as a sharp; E-flat returns to E natural.')
  ],
  'accidentals-key-signatures-where-signs-go':[
   q('A sharp sits immediately before one note. What kind of sign is it?',['A time signature','A local accidental','A bar line'],1,'A local accidental belongs beside a note; a key signature follows the clef.'),
   q('Which sign comes first when reading clef, key signature, and time signature?',['The time signature','The key signature','The clef'],2,'Their order is clef → key signature → time signature.')
  ],
  'accidentals-key-signatures-one-sharp':[
   q('The signature changes F to F-sharp. Does it also make C sharp?',['No; this signature changes F','Yes; every note is sharp','Yes; only C is sharp'],0,'A one-sharp signature names F-sharp. Other letters stay unchanged unless another sign changes them.'),
   q('Which major key in the example uses this one-sharp signature?',['F major','G major','C major'],1,'G major uses the signature with one F-sharp.')
  ],
  'accidentals-key-signatures-one-flat':[
   q('The signature changes B to B-flat. Does it also change E to E-flat?',['Yes; all notes become flat','Yes; only E becomes flat','No; this signature names B-flat'],2,'Only B is named in this one-flat signature.'),
   q('Which major key in the example uses this one-flat signature?',['F major','G major','C major'],0,'F major uses the signature with one B-flat.')
  ],
  'accidentals-key-signatures-two-sharps':[
   q('D major’s signature changes F and C. Does that signature also sharpen D?',['Yes; D is always D-sharp','No; D stays natural unless changed locally','Yes; every note is sharp'],1,'The two signs name F-sharp and C-sharp, not D-sharp.'),
   q('Which note list follows the D-major key signature?',['D E F G A B C D','D-sharp E F G A B C D','D E F-sharp G A B C-sharp D'],2,'Use both named changes: F-sharp and C-sharp.')
  ],
  'accidentals-key-signatures-all-heights':[
   q('A new bar begins but the F-sharp key signature has not changed. What should happen to F?',['Keep using F-sharp','Always use F natural','Use F-flat'],0,'A bar line does not erase the key signature.'),
   q('The key signature changes to one with no sharps or flats. What should you do next?',['Keep using the old F-sharp signature','Follow the new key signature','Make every note sharp'],1,'A signature stays in force until a different key signature replaces it.')
  ],
  'accidentals-key-signatures-local-bar':[
   q('A local F-sharp appears at one height. Does it automatically sharpen F in another octave?',['Yes; all octaves change','Yes; the whole song changes','No; the local sign applies to that pitch and octave'],2,'A local accidental applies to the same pitch at the same octave for the rest of its bar.'),
   q('Without another sign, how long should you keep that local F-sharp at the same height?',['For the rest of that bar','For the whole piece','For only one notehead'],0,'Keep the local change through that bar, up to the bar line.')
  ],
  'accidentals-key-signatures-new-bar':[
   q('What marks the end of a local accidental’s usual effect?',['A change in loudness','The next bar line','The next stem'],1,'At the next bar, return to the key signature.'),
   q('With no key signature, an E-flat was local to the last bar. What does E use in the new bar?',['E-flat forever','E-sharp','E natural'],2,'The local flat ended at the bar line; no signature change is left on E.')
  ],
  'accidentals-key-signatures-natural-in-signature':[
   q('The signature says F-sharp, but a local natural appears before F. What do you play in this bar?',['F natural','F-sharp despite the natural','F-flat'],0,'The local natural temporarily cancels the signature’s sharp for that pitch.'),
   q('Does that local natural erase the F-sharp key signature for the whole piece?',['Yes; the signature is gone','No; its change is temporary','Yes; every F is flat now'],1,'The natural is local to the bar. The F-sharp signature returns in the next bar.')
  ],
  'accidentals-key-signatures-signature-and-meter':[
   q('Which instruction changes F’s pitch in a one-sharp, 4/4 example?',['The 4/4 meter','The bar line','The F-sharp key signature'],2,'The key signature handles pitch; the time signature handles beats.'),
   q('What does the nearby 4/4 organize in that example?',['Four quarter-note beats in each bar','Four sharp notes only','The note letter F'],0,'The time signature tells you how the beats fit in a bar.')
  ],
  'accidentals-key-signatures-no-signs':[
   q('A natural minor has no signs in its key signature. Which note is its musical home?',['C','A','G'],1,'A natural minor and C major share notes, but A natural minor comes home to A.'),
   q('C major uses the same white-key notes. Which home note makes it C major?',['A','F','C'],2,'The note collection can stay the same while the home changes. C major comes home to C.')
  ]
 };
 function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
 return freeze({CHECKS});
});
