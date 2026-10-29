/* Short, worked lessons for every staff-reading concept in Haydn's exam. */
(function(root,factory){
 const lessons=factory();
 if(typeof module==='object'&&module.exports)module.exports=lessons;
 if(root)root.CodaClassroomCurriculumStaff=lessons;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const span=(first,last)=>Array.from({length:last-first+1},(_,index)=>first+index);
 const questions=(category,...groups)=>[...new Set(groups.flat())].map(number=>category+'-'+String(number).padStart(3,'0'));
 const treble=(...groups)=>questions('note-naming',...groups);
 const bass=(...groups)=>questions('bass-clef',...groups);
 const grand=(...groups)=>questions('grand-staff',...groups);
 const staff=(clef,position,isGrand=false)=>({kind:'staff',clef,position,...(isGrand?{grand:true}:{})});
 const letters=notes=>({kind:'scale',notes});
 const keyboard=(...notes)=>({kind:'keyboard',notes});
 const lessons={
  'note-naming':[
   {
    id:'treble-musical-alphabet',title:'Seven letters, then repeat',
    teach:'Music uses A B C D E F G, then repeats at higher or lower pitches.',
    example:'Up: F → G → A → B. Down: B → A → G → F. Fill gaps by moving one letter at a time. The next C keeps its letter but sounds higher.',
    prompt:'Which music letter comes just before A?',answers:['G','B','H'],correct:0,
    hint:'Go backward around A B C D E F G. Before A comes G.',
    visual:keyboard(),
    covers:treble(span(49,69),93,98)
   },
   {
    id:'treble-staff-parts',title:'Five lines, four spaces',
    teach:'A staff has five lines and four spaces. Count each from bottom to top.',
    example:'Line 1 is the bottom line; line 5 is the top. Space 1 is the bottom space; space 4 is the top. Count lines and spaces separately.',
    prompt:'How many spaces are inside a five-line staff?',answers:['4','5','6'],correct:0,
    hint:'Count the gaps between the lines, starting with the bottom gap.',
    visual:staff('treble',3),covers:treble(79,80,82)
   },
   {
    id:'treble-read-notehead',title:'Find the round notehead',
    teach:'The notehead shows pitch. Its place stays the same when the stem changes direction.',
    example:'A notehead on bottom-line E stays E whether its stem points up or down. Higher noteheads mean higher pitches; lower noteheads mean lower pitches. This does not change loudness or speed.',
    prompt:'A note keeps its place but its stem points down. Does its letter change?',
    answers:['No, read the notehead','Yes, it moves down one letter','Yes, it becomes a louder note'],correct:0,
    hint:'Look at the round head on the staff, not the end of the stem.',
    visual:staff('treble',0),covers:treble(81,84,85,99,100)
   },
   {
    id:'treble-check-clef',title:'Check the clef first',
    teach:'A clef tells you which note-name map to use.',
    example:'Treble has E on its bottom line. Bass has G there. Check the clef before naming a note. Its shape changes the note map, not loudness or speed.',
    prompt:'What helps you choose the correct staff note-name map?',answers:['The clef','How loud you play','Which way the stem points'],correct:0,
    hint:'Find the sign at the start of the staff.',
    visual:staff('treble',0),covers:treble(83)
   },
   {
    id:'treble-all-lines',title:'All five treble lines',
    teach:'Treble lines, bottom to top: E G B D F. Remember: Every Good Boy Does Fine.',
    example:'Lines 1–5, bottom to top: E, G, B, D, F. The fourth line is D. The fifth, or top, line is F.',
    prompt:'What is the fourth treble line from the bottom?',answers:['D','C','F'],correct:0,
    hint:'Every, Good, Boy, Does: E, G, B, D.',
    visual:staff('treble',6),
    covers:treble(1,3,5,7,9,10,12,14,16,18,span(70,74))
   },
   {
    id:'treble-all-spaces',title:'All four treble spaces',
    teach:'Treble spaces spell FACE. Read F A C E from the bottom space to the top.',
    example:'Space 1 is F. Space 2 is A. Space 3 is C. Space 4 is E. Read the space containing the notehead.',
    prompt:'What is the top treble space?',answers:['E','F','D'],correct:0,
    hint:'Read FACE upward. Its last letter is E.',
    visual:staff('treble',7),
    covers:treble(2,4,6,8,11,13,15,17,span(75,78))
   },
   {
    id:'treble-one-move',title:'One staff move up or down',
    teach:'One staff move goes to the next line or space and the next letter in that direction.',
    example:'Up: E → F → G. Down: G → F → E. One move above G is A; one move below G is F. Count moves, not the starting note.',
    prompt:'Which letter is one staff move below the shown G?',answers:['F','A','E'],correct:0,
    hint:'Go backward one letter: G → F.',
    visual:staff('treble',2),covers:treble(span(19,34))
   },
   {
    id:'treble-two-moves',title:'Make two staff moves',
    teach:'For two staff moves, name each line or space you pass.',
    example:'Up: E → F → G, so two moves above E is G. Down: G → F → E. Two moves can go line-to-line or space-to-space.',
    prompt:'Which letter is two staff moves above the shown A?',answers:['C','B','D'],correct:0,
    hint:'A → B is one move. B → C is the second move.',
    visual:staff('treble',3),covers:treble(span(35,48))
   },
   {
    id:'treble-keyboard-landmarks',title:'Find white-key landmarks',
    teach:'Black keys repeat in groups of two and three. Use those groups to find white-key names.',
    example:'Around two black keys, the white keys go C D E: C is left of the group, E is right. Around three, they go F G A B: F is left, B is right.',
    prompt:'Which white key is just right of a group of three black keys?',answers:['B','F','E'],correct:0,
    hint:'The four white keys around that group go F G A B.',
    visual:keyboard(),covers:treble(span(88,92))
   },
   {
    id:'treble-half-step',title:'The very next piano key',
    teach:'A half step goes to the very next piano key, including black keys.',
    example:'White and black keys both make pitches. C to C-sharp is one half step right. E to F is also one half step: there is no black key between them.',
    prompt:'When counting half steps, do black keys count?',answers:['Yes, count every next key','No, only white keys count','Only when the music is loud'],correct:0,
    hint:'Both colours make pitches. Move to the very next key.',
    visual:keyboard('C','C-sharp','E','F'),
    covers:treble(94,95,96)
   },
   {
    id:'treble-sharp-sign',title:'Sharp means one key higher',
    teach:'A sharp (♯) raises a note by one half step.',
    example:'F-sharp is the next piano key higher than F. Move right, including a black key if it is next. The note’s length does not change.',
    prompt:'What does a sharp do?',answers:['Raises pitch by one half step','Lowers pitch by one half step','Makes the note twice as long'],correct:0,
    hint:'Sharp goes to the next key higher.',visual:keyboard('F','F-sharp'),covers:treble(95)
   },
   {
    id:'treble-flat-sign',title:'Flat means one key lower',
    teach:'A flat (♭) lowers a note by one half step.',
    example:'E-flat is the next piano key lower than E. Move left, including a black key if it is next. A flat changes pitch, not loudness.',
    prompt:'What does a flat do?',answers:['Lowers pitch by one half step','Raises pitch by one half step','Always makes music softer'],correct:0,
    hint:'Flat goes to the next key lower.',visual:keyboard('E','E-flat'),covers:treble(96)
   },
   {
    id:'treble-natural-sign',title:'Natural cancels the change',
    teach:'A natural (♮) cancels a sharp or flat for that note.',
    example:'F-sharp changes back to F when F has a natural sign. F-flat changes back to F too. A natural does not always move up or always move down.',
    prompt:'An F-sharp is followed by F-natural. Which note do you play?',answers:['F','F-sharp again','G'],correct:0,
    hint:'The natural cancels the sharp and restores F.',visual:keyboard('F-sharp','F'),covers:treble(97)
   },
   {
    id:'treble-ledger-middle-c',title:'Little lines outside the staff',
    teach:'A ledger line is a tiny extra staff line for a note outside the five lines.',
    example:'Middle C sits on the first ledger line below treble. Move up to the space D, then the bottom line E.',
    prompt:'What is the little line through Middle C called?',answers:['A ledger line','A bar line','A note stem'],correct:0,
    hint:'Ledger lines extend the staff for notes outside its five lines.',
    visual:staff('treble',-2),covers:treble(86,87)
   }
  ],
  'bass-clef':[
   {
    id:'bass-f-clef',title:'Meet the F clef',
    teach:'Bass clef usually shows lower pitches. Its two dots point to F.',
    example:'Bass clef is also called the F clef. It maps note names, not loudness. Both clefs use five lines and four spaces. Together they help us read a wider range of pitches.',
    prompt:'Which note is on the line between the bass-clef dots?',answers:['F','G','A'],correct:0,
    hint:'The bass clef is the F clef: its dots mark F.',
    visual:staff('bass',6),covers:bass(span(79,84),100)
   },
   {
    id:'bass-all-lines',title:'All five bass lines',
    teach:'Bass lines, bottom to top: G B D F A. Remember: Great Big Dreams For America.',
    example:'Lines 1–5, bottom to top: G, B, D, F, A. D is the middle line. F is between the clef’s dots. A is the top line.',
    prompt:'What is the middle bass line?',answers:['D','B','F'],correct:0,
    hint:'Great, Big, Dreams: G, B, D. The third line is D.',
    visual:staff('bass',4),
    covers:bass(1,3,5,7,9,10,12,14,16,18,span(49,53),58,60,62,64,66,89,90,93)
   },
   {
    id:'bass-all-spaces',title:'All four bass spaces',
    teach:'Bass spaces, bottom to top: A C E G. Remember: All Cows Eat Grass.',
    example:'Space 1 is A. Space 2 is C. Space 3 is E. Space 4 is G. Start at the bottom space every time.',
    prompt:'What is the top bass space?',answers:['G','A','E'],correct:0,
    hint:'All, Cows, Eat, Grass: A, C, E, G.',
    visual:staff('bass',7),
    covers:bass(2,4,6,8,11,13,15,17,span(54,57),59,61,63,65,91,92)
   },
   {
    id:'bass-notehead-place',title:'Line or space? Read the head',
    teach:'Read the round notehead’s line or space, even when its stem changes direction.',
    example:'A line note has a line running through its head. A space note fits between two lines. The stem can point up or down without changing the note letter.',
    prompt:'A bass notehead is between two lines. What kind of note is it?',answers:['A space note','A line note','A bar line'],correct:0,
    hint:'A space note sits in the gap between lines.',
    visual:staff('bass',3),covers:bass(94,95,99)
   },
   {
    id:'bass-one-move',title:'One bass staff move',
    teach:'Move to the next line or space, then name the next letter in that direction.',
    example:'Up: G → A → B. Down: B → A → G. One move above B is C. One move below B is A. Do not count the starting note as a move.',
    prompt:'Which letter is one staff move below the shown B?',answers:['A','C','G'],correct:0,
    hint:'Go backward one letter from B: A.',
    visual:staff('bass',2),covers:bass(span(19,34))
   },
   {
    id:'bass-two-moves',title:'Two bass staff moves',
    teach:'For two moves, name the middle letter before naming your answer.',
    example:'Up: B → C → D. Down: D → C → B. Two moves above B is D. Two moves below D is B.',
    prompt:'Which letter is two staff moves above the shown B?',answers:['D','C','E'],correct:0,
    hint:'B → C is one move. C → D is the second.',
    visual:staff('bass',2),covers:bass(span(35,48))
   },
   {
    id:'bass-three-moves',title:'Three bass staff moves',
    teach:'Count three separate moves across the lines and spaces. The starting note is zero moves.',
    example:'Up: G → A → B → C. Down: C → B → A → G. Three moves above G is C; three moves below C is G.',
    prompt:'Which letter is three staff moves above the shown G?',answers:['C','B','D'],correct:0,
    hint:'Say G, then count the moves: A (1), B (2), C (3).',
    visual:staff('bass',0),covers:bass(span(67,78))
   },
   {
    id:'bass-check-reminder',title:'Choose the bass reminder',
    teach:'Use the reminder for the clef you see, and read from bottom to top.',
    example:'FACE names treble spaces. Bass spaces use All Cows Eat Grass. The bottom treble line is E; the bottom bass line is G. Clefs have different maps.',
    prompt:'Which reminder names bass spaces?',answers:['All Cows Eat Grass','FACE','Every Good Boy Does Fine'],correct:0,
    hint:'Bass spaces go A C E G, starting at the bottom.',
    visual:staff('bass',1),covers:bass(span(85,88))
   },
   {
    id:'bass-alphabet-wrap',title:'The letters wrap around',
    teach:'After G comes A. Going down, the letter before A is G.',
    example:'Up: F → G → A → B. Down: B → A → G → F. There is no H in the seven music letters.',
    prompt:'Which music letter is one move down from A?',answers:['G','B','H'],correct:0,
    hint:'Reverse the musical alphabet at A: the previous letter is G.',
    visual:letters(['F','G','A','B']),covers:bass(96,97)
   },
   {
    id:'bass-middle-c',title:'Middle C above bass',
    teach:'Middle C sits on the first little ledger line above the bass staff.',
    example:'Start on the top bass line, A. Move up to the space B, then the ledger line C. Treble and bass together help read lower and higher pitches.',
    prompt:'Where is Middle C in bass clef?',answers:['On the first ledger line above the staff','On the bottom staff line','On the middle staff line'],correct:0,
    hint:'Top line A → space B → little line C.',
    visual:staff('bass',10),covers:bass(98,100)
   }
  ],
  'grand-staff':[
   {
    id:'grand-two-staffs',title:'Two staffs work together',
    teach:'A grand staff joins an upper treble staff and a lower bass staff.',
    example:'Each staff has five lines, making ten regular lines. The upper staff usually shows higher pitches; the lower staff usually shows lower pitches, not slower or softer music.',
    prompt:'How many regular lines are in the two staffs altogether?',answers:['10','5','11'],correct:0,
    hint:'Five treble lines plus five bass lines makes ten. Ledger lines are extra.',
    visual:staff('treble',0,true),covers:grand(69,70,71,72,89,90)
   },
   {
    id:'grand-brace-hands',title:'The brace joins the pair',
    teach:'The curly brace at the left groups both staffs into one piano part.',
    example:'In beginner piano music, the right hand often reads the upper staff and the left hand often reads the lower staff. Music can make exceptions, so always check the part.',
    prompt:'What is the curly sign joining the two staffs called?',answers:['A brace','A sharp','A note stem'],correct:0,
    hint:'The brace groups the upper and lower staffs together.',
    visual:staff('bass',0,true),covers:grand(73,87,88)
   },
   {
    id:'grand-treble-lines',title:'Upper-staff lines',
    teach:'Upper treble lines, bottom to top: E G B D F. Remember: Every Good Boy Does Fine.',
    example:'Count upper-staff lines from its own bottom: line 1 E, line 2 G, line 3 B, line 4 D, line 5 F.',
    prompt:'What is the top line of the upper treble staff?',answers:['F','A','E'],correct:0,
    hint:'Every Good Boy Does Fine ends with Fine: F.',
    visual:staff('treble',8,true),covers:grand(1,3,5,7,9,10,12,14,16,18)
   },
   {
    id:'grand-treble-spaces',title:'Upper-staff spaces',
    teach:'The upper treble spaces spell FACE, from bottom to top.',
    example:'Count only the upper staff’s spaces: space 1 F, space 2 A, space 3 C, space 4 E.',
    prompt:'What is the third space of the upper treble staff?',answers:['C','A','E'],correct:0,
    hint:'Count F (1), A (2), C (3).',
    visual:staff('treble',5,true),covers:grand(2,4,6,8,11,13,15,17,98)
   },
   {
    id:'grand-bass-lines',title:'Lower-staff lines',
    teach:'Lower bass lines, bottom to top: G B D F A. Remember: Great Big Dreams For America.',
    example:'Count lower-staff lines from its own bottom: line 1 G, line 2 B, line 3 D, line 4 F, line 5 A.',
    prompt:'What is the top line of the lower bass staff?',answers:['A','F','G'],correct:0,
    hint:'Great Big Dreams For America ends with America: A.',
    visual:staff('bass',8,true),covers:grand(35,37,39,41,43,44,46,48,50,52,100)
   },
   {
    id:'grand-bass-spaces',title:'Lower-staff spaces',
    teach:'Lower bass spaces, bottom to top: A C E G. Remember: All Cows Eat Grass.',
    example:'Count only the lower staff’s spaces: space 1 A, space 2 C, space 3 E, space 4 G.',
    prompt:'What is the third space of the lower bass staff?',answers:['E','C','G'],correct:0,
    hint:'Count All (1), Cows (2), Eat (3): E.',
    visual:staff('bass',5,true),covers:grand(36,38,40,42,45,47,49,51,99)
   },
   {
    id:'grand-compare-landmarks',title:'Same place, different map',
    teach:'The same staff position can have different note names in treble and bass.',
    example:'Bottom lines: treble E, bass G. Middle lines: B and D. Top lines: F and A. Bottom spaces: F and A. Top spaces: E and G.',
    prompt:'What are the bottom treble and bass lines, in that order?',answers:['E and G','Both E','Both G'],correct:0,
    hint:'Check each clef. Treble starts on E; bass starts on G.',
    visual:staff('treble',0,true),covers:grand(74,span(93,97))
   },
   {
    id:'grand-one-move',title:'One move on either staff',
    teach:'Move one line or space at a time, using that staff’s clef map.',
    example:'Up: treble E → F; bass G → A. Down: treble F → E; bass A → G. Count one move, not the starting note.',
    prompt:'The shown lower-staff note is C. Which letter is one move lower?',answers:['B','D','A'],correct:0,
    hint:'Use the bass map. Going down from C gives B.',
    visual:staff('bass',3,true),covers:grand(span(19,34),span(53,68))
   },
   {
    id:'grand-middle-c-same-key',title:'Two pictures, the same Middle C',
    teach:'Middle C can be written below treble or above bass. Both mean the same piano key.',
    example:'Look near the keyboard’s middle: C is just left of two black keys. Its notehead sits on a short extra line called a ledger line.',
    prompt:'Does Middle C below treble sound different from Middle C above bass?',answers:['No, both mean the same key','Yes, they are different keys','Only the treble one is called C'],correct:0,
    hint:'The clef changes how we write Middle C, not its piano key or sound.',
    visual:staff('treble',-2,true),covers:grand(span(75,80))
   },
   {
    id:'grand-middle-c-neighbors',title:'Count around Middle C',
    teach:'Use Middle C to count nearby letters up or down.',
    example:'Up: Middle C → D → E on treble’s bottom line. Down: Middle C → B → A on bass’s top line. Each arrow is one move.',
    prompt:'Which letter is two staff moves below Middle C?',answers:['A','B','G'],correct:0,
    hint:'Middle C → B is one move. B → A is the second.',
    visual:staff('bass',10,true),covers:grand(span(81,86))
   },
   {
    id:'grand-play-together',title:'Lined up means together',
    teach:'Notes lined up vertically on the two staffs can sound at the same time.',
    example:'An upper E and a lower C at the same place from left to right are played together. The brace groups both staffs into one part.',
    prompt:'Two notes line up vertically on the grand staff. Can they be played together?',answers:['Yes','No, never','Only if they are both C'],correct:0,
    hint:'Read left to right for time. Notes at the same time can line up above each other.',
    covers:grand(91)
   },
   {
    id:'grand-notehead-not-stem',title:'Follow the head, not the stem',
    teach:'Find the notehead and check its clef, even when a stem points toward the other staff.',
    example:'A treble E stays E if its stem points down across the gap. Staff position shows pitch; dynamics control loudness and tempo controls speed.',
    prompt:'A stem points toward the other staff. What should you read?',answers:['The notehead and its clef','Only the stem tip','Only the nearest brace'],correct:0,
    hint:'The round head shows the note’s staff place. Then use that staff’s clef.',
    visual:staff('treble',0,true),covers:grand(74,89,90,92)
   }
  ]
 };
 function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
 return freeze(lessons);
});
