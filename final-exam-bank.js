/* Classroom music facts only. Card-game powers are deliberately outside this bank. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaFinalExamBank=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const VERSION=1;
 const CATEGORIES=[
  {id:'note-naming',title:'Treble note names'},
  {id:'bass-clef',title:'Bass clef'},
  {id:'grand-staff',title:'Grand staff & Middle C'},
  {id:'rhythm-tree',title:'Note lengths & rests'},
  {id:'time-signatures',title:'Time signatures'},
  {id:'major-minor-keys',title:'Major & minor keys'},
  {id:'dynamics',title:'Dynamics'},
  {id:'tempo',title:'Tempo'}
 ];
 const banks=Object.fromEntries(CATEGORIES.map(value=>[value.id,[]]));
 const LETTERS=['A','B','C','D','E','F','G'];
 const STAFF={treble:['E','F','G','A','B','C','D','E','F'],bass:['G','A','B','C','D','E','F','G','A']};
 const ORDINAL=['first','second','third','fourth','fifth'];
 const beatLabel=value=>{const whole=Math.floor(value),part={'.25':'¼','.5':'½','.75':'¾'}[String(value-whole).replace(/^0/,'')],number=part?(whole||'')+part:String(value);return number+(value<=1?' beat':' beats');};
 const quarterLengths=value=>beatLabel(value).replace(/\bbeats?\b/,value<=1?'quarter-note length':'quarter-note lengths');
 const noteName=value=>({'0.25':'sixteenth','0.5':'eighth','0.75':'dotted eighth','1':'quarter','1.5':'dotted quarter','2':'half','3':'dotted half','4':'whole'}[String(value)]);
 const staff=(clef,position,grand=false)=>({kind:'staff',clef,position,...(grand?{grand:true}:{}),label:(grand?'Grand staff. ':'')+(clef==='bass'?'Bass':'Treble')+' staff with one highlighted note.'});
 const rhythm=(values,rests=[])=>({kind:'rhythm',meter:'4/4',notes:values.map((beats,index)=>({beats,rest:rests.includes(index)}))});
 function add(category,prompt,correct,wrong,explanation,stimulus,skill){
  const list=banks[category],number=list.length+1;
  const texts=[String(correct),...wrong.map(String)];
  if(texts.length!==3||new Set(texts).size!==3)throw Error('Three different answers are required: '+category+' '+prompt);
  // A stable rotation prevents the first answer from always being correct.
  const offset=(number-1)%3,rotated=texts.slice(offset).concat(texts.slice(0,offset));
  const choices=rotated.map((text,index)=>({id:['a','b','c'][index],text}));
  list.push({id:category+'-'+String(number).padStart(3,'0'),category,prompt,choices,answer:choices.find(value=>value.text===String(correct)).id,explanation,...(stimulus?{stimulus}:{}),skill:skill||'understand'});
 }
 function lettersFor(answer){const index=LETTERS.indexOf(answer);return[LETTERS[(index+1)%7],LETTERS[(index+3)%7]];}
 function naming(category,clef,grand=false){
  STAFF[clef].forEach((letter,position)=>add(category,'Name the highlighted '+(grand?(clef==='bass'?'lower':'upper')+'-staff ':'')+'note.',letter,lettersFor(letter),'Count from the bottom. '+(clef==='bass'?'Bass lines: G B D F A. Bass spaces: A C E G.':'Treble lines: E G B D F. Treble spaces: F A C E.'),staff(clef,position,grand),'read-note'));
 }
 function locations(category,clef,grand=false){
  STAFF[clef].forEach((letter,position)=>{
   const line=position%2===0,ordinal=Math.floor(position/2),answer=(line?'Line ':'Space ')+(ordinal+1)+' from the bottom';
   const wrong=[(line?'Space ':'Line ')+(Math.min(ordinal,3)+1)+' from the bottom',(line?'Line ':'Space ')+((ordinal+1)%(line?5:4)+1)+' from the bottom'];
   add(category,'Where is the highlighted note on the '+clef+' staff?',answer,wrong,'Count '+(line?'lines':'spaces')+' from the bottom. This is the '+ORDINAL[ordinal]+' '+(line?'line':'space')+'.',staff(clef,position,grand),'staff-place');
  });
 }
 function moves(category,clef,distance,grand=false){
  for(const direction of [1,-1])for(let position=0;position<9;position++){
   const target=position+distance*direction;if(target<0||target>8)continue;
   const answer=STAFF[clef][target],count=distance===1?'one step':distance===2?'two steps':'three steps';
   add(category,'Which letter is '+count+' '+(direction===1?'higher':'lower')+' than the highlighted '+clef+' note?',answer,lettersFor(answer),'Move through each next line or space '+(direction===1?'up':'down')+'. '+STAFF[clef][position]+' becomes '+answer+'.',staff(clef,position,grand),distance===1?'step':'skip');
  }
 }
 function curated(category,rows){for(const row of rows)add(category,...row);}

 // Treble: read a picture, find its place, move on the staff, and use letter patterns.
 naming('note-naming','treble');locations('note-naming','treble');moves('note-naming','treble',1);moves('note-naming','treble',2);
 for(const letter of LETTERS)for(const direction of [1,-1]){
  const answer=LETTERS[(LETTERS.indexOf(letter)+direction+7)%7];
  add('note-naming','Which music letter comes just '+(direction===1?'after':'before')+' '+letter+'?',answer,lettersFor(answer),'The music letters repeat: A B C D E F G, then A again.',null,'musical-alphabet');
 }
 LETTERS.forEach((letter,index)=>{const a=LETTERS[(index+6)%7],b=LETTERS[(index+1)%7];add('note-naming','Fill the gap as the notes go up: '+a+' — ? — '+b+'.',letter,lettersFor(letter),'The next three music letters here are '+a+', '+letter+', '+b+'.',null,'letter-sequence');});
 ['Every','Good','Boy','Does','Fine'].forEach((word,index)=>add('note-naming','Treble lines go bottom to top. Which letter does “'+word+'” remind us of?',word[0],lettersFor(word[0]),'Every Good Boy Does Fine gives E G B D F, starting on the bottom line.',null,'mnemonic'));
 ['F','A','C','E'].forEach((letter,index)=>add('note-naming','FACE names treble spaces from bottom to top. What is space '+(index+1)+'?',letter,lettersFor(letter),'Count spaces from the bottom: F, A, C, E.',null,'mnemonic'));
 curated('note-naming',[
  ['How many lines are in one music staff?','5',['4','6'],'A staff has five lines and four spaces.'],
  ['How many spaces are inside one music staff?','4',['5','3'],'Four spaces sit between the five lines.'],
  ['Which part of a note tells us its line or space?','The notehead',['The end of its stem','The bar line'],'Look at the round notehead to find its pitch.'],
  ['When you count staff lines, where do you start?','At the bottom',['At the top','At the middle'],'Staff lines and spaces are numbered from bottom to top.'],
  ['What does a clef help you work out?','The names of staff notes',['How loud every note is','How fast every note is'],'The clef gives a starting map for note names.'],
  ['A note moves higher on the same staff. What usually happens to its pitch?','It gets higher',['It must get louder','It must get faster'],'Higher places on a staff show higher pitches.'],
  ['A note moves lower on the same staff. What usually happens to its pitch?','It gets lower',['It must get softer','It must get slower'],'Lower places on a staff show lower pitches.'],
  ['What is a short extra line above or below a staff called?','A ledger line',['A beat line','A loudness line'],'A ledger line lets us write a note outside the five staff lines.'],
  ['Middle C is just below a treble staff. What does its notehead sit on?','A short ledger line',['The bottom staff line','The top staff line'],'Middle C sits on the first short line below treble.'],
  ['Black piano keys repeat in which groups?','Groups of 2 and 3',['Groups of 1 and 4','Groups of 4 and 5'],'Groups of two and three black keys help us find white-key names.'],
  ['Which white key is just to the left of a group of two black keys?','C',['F','B'],'C sits just to the left of the two-black-key group.'],
  ['Which white key is just to the left of a group of three black keys?','F',['C','E'],'F sits just to the left of the three-black-key group.'],
  ['Which white key is just to the right of a group of two black keys?','E',['D','G'],'The white keys around two black keys are C, D, E.'],
  ['Which white key is just to the right of a group of three black keys?','B',['F','A'],'The white keys around three black keys are F, G, A, B.'],
  ['Which letter is not in the musical alphabet?','H',['A','G'],'Music note letters use A through G.'],
  ['Which piano keys can make musical pitches?','Both white and black keys',['Only white keys','Only black keys'],'Both colours of key make pitches.'],
  ['What does a sharp do to a note?','Raises it by one half step',['Lowers it by one half step','Makes it twice as long'],'A sharp raises the pitch to the next half step.'],
  ['What does a flat do to a note?','Lowers it by one half step',['Raises it by one half step','Makes it louder'],'A flat lowers the pitch to the next half step.'],
  ['What does a natural sign do?','Cancels a sharp or flat for that note',['Always raises a note','Always makes a note soft'],'A natural returns a note to its natural letter pitch.'],
  ['Can the same letter name appear at more than one height?','Yes, letter names repeat',['No, each letter appears once','Only the letter C can repeat'],'The seven music letters repeat as pitches get higher or lower.'],
  ['What does the height of a notehead mainly show?','Pitch',['Volume','Speed'],'A notehead’s line or space shows which pitch to play.'],
  ['A stem points down instead of up. Does that alone change the note letter?','No',['Yes, by one letter','Yes, by two letters'],'Read the notehead’s position. Stem direction alone does not change its pitch.']
 ]);

 // Bass uses its own map; the same visual height has a different letter in treble.
 naming('bass-clef','bass');locations('bass-clef','bass');moves('bass-clef','bass',1);moves('bass-clef','bass',2);
 ['Great','Big','Dreams','For','America'].forEach(word=>add('bass-clef','Bass lines go bottom to top. Which letter does “'+word+'” remind us of?',word[0],lettersFor(word[0]),'Great Big Dreams For America gives G B D F A from the bottom line.',null,'mnemonic'));
 ['All','Cows','Eat','Grass'].forEach(word=>add('bass-clef','Bass spaces go bottom to top. Which letter does “'+word+'” remind us of?',word[0],lettersFor(word[0]),'All Cows Eat Grass gives A C E G from the bottom space.',null,'mnemonic'));
 STAFF.bass.forEach((answer,position)=>add('bass-clef','Name the '+ORDINAL[Math.floor(position/2)]+' '+(position%2===0?'line':'space')+' from the bottom of a bass staff.',answer,lettersFor(answer),'Bass lines go G B D F A; bass spaces go A C E G, always from the bottom.',null,'recall-place'));
 moves('bass-clef','bass',3);
 curated('bass-clef',[
  ['Which line sits between the two bass-clef dots?','F',['G','A'],'The two dots surround the F line.'],
  ['What is another name for the bass clef?','F clef',['G clef','C-sharp clef'],'Its dots point to the F line, so it is also called the F clef.'],
  ['Which kind of pitches does bass clef often show?','Lower pitches',['Only louder pitches','Only faster pitches'],'Bass clef is useful for lower notes.'],
  ['Does bass clef tell you to play loudly?','No, it maps pitches',['Yes, always loudly','Yes, always very softly'],'Loudness is shown by dynamics, not by the bass clef.'],
  ['How many staff lines does bass clef use?','5',['4','6'],'Bass and treble both use five staff lines.'],
  ['How many inside spaces does a bass staff have?','4',['3','5'],'Four spaces sit between its five lines.'],
  ['How should you count bass lines for the reminder words?','Bottom to top',['Top to bottom','From the middle outward'],'Great Big Dreams For America starts at the bottom line.'],
  ['How should you count bass spaces for All Cows Eat Grass?','Bottom to top',['Top to bottom','Left to right'],'All starts in the bottom space; Grass is in the top space.'],
  ['Does FACE name the bass spaces?','No, bass spaces are A C E G',['Yes, for every clef','Only when the music is quiet'],'FACE is the treble-space reminder. Bass spaces use All Cows Eat Grass.'],
  ['Can you use treble line names without checking a bass clef?','No, check the clef first',['Yes, clefs never matter','Yes, if the stem points up'],'A clef changes the map of note names.'],
  ['Which bass note is on the top line?','A',['F','G'],'Bass lines from the bottom are G B D F A.'],
  ['Which bass note is on the bottom line?','G',['E','F'],'The first bass line is G.'],
  ['Which bass note is in the top space?','G',['E','A'],'Bass spaces from the bottom are A C E G.'],
  ['Which bass note is in the bottom space?','A',['G','B'],'The first bass space is A.'],
  ['Which bass note is on the middle line?','D',['B','F'],'The five bass lines are G B D F A. D is the middle one.'],
  ['Does a notehead on a bass line have the line running through it?','Yes',['No, it must be between lines','Only for whole notes'],'A line note sits right on the line.'],
  ['A bass notehead sits between two lines. What is it called?','A space note',['A line note','A bar line'],'Space notes sit between staff lines.'],
  ['What is the next music letter up after a bass G?','A',['H','F'],'After G, the musical alphabet starts again at A.'],
  ['What is the next music letter down before a bass A?','G',['B','H'],'Going down reverses the alphabet: A comes after G.'],
  ['Where is Middle C compared with the bass staff?','On the first ledger line above it',['On its bottom line','On its middle line'],'Middle C sits on the first little line above bass.'],
  ['A bass note stem changes direction. What should you still read?','The notehead’s line or space',['Only the stem tip','Only the nearest bar line'],'Stem direction alone does not change the note name.'],
  ['Why learn a bass clef as well as a treble clef?','To read a wider range of pitches',['To make every note longer','To avoid counting beats'],'The two clefs help us read lower and higher notes.']
 ]);

 // Grand staff: always identify the clef, then read its line or space.
 for(const clef of ['treble','bass']){naming('grand-staff',clef,true);locations('grand-staff',clef,true);moves('grand-staff',clef,1,true);}
 curated('grand-staff',[
  ['Which clef is usually on the upper staff of a piano grand staff?','Treble',['Bass','Neither clef'],'A piano grand staff usually puts treble above bass.'],
  ['Which clef is usually on the lower staff of a piano grand staff?','Bass',['Treble','Neither clef'],'A piano grand staff usually puts bass below treble.'],
  ['How many five-line staffs make one grand staff?','2',['1','3'],'A grand staff joins two staffs.'],
  ['How many regular staff lines are there across both staffs?','10',['5','11'],'There are five lines above and five below. Ledger lines are extra.'],
  ['What joins the two staffs into one group?','A brace at the left',['An extra note stem','A sharp sign'],'A brace groups the two staffs of a piano part.'],
  ['Should you check the clef before naming a note on a grand staff?','Yes',['No, every place is C','Only for loud notes'],'The upper and lower staffs use different clef maps.'],
  ['Which note is shown on this little line below treble?','C',['B','D'],'This is Middle C on the first ledger line below treble.',staff('treble',-2,true)],
  ['Which note is shown on this little line above bass?','C',['B','D'],'This is Middle C on the first ledger line above bass.',staff('bass',10,true)],
  ['Middle C is written below treble or above bass. Does it change piano keys?','No, it is the same key',['Yes, always two keys apart','Yes, always seven keys apart'],'Both ways of writing Middle C mean the same pitch.'],
  ['Where is Middle C on a piano keyboard?','Just left of a group of two black keys, near the middle',['Just left of three black keys','Always the last white key'],'The C key near the middle is Middle C.'],
  ['Middle C is on a tiny extra line. What is that line called?','A ledger line',['A tempo line','A volume line'],'A ledger line extends a staff for a note outside it.'],
  ['Does Middle C need a different letter name in bass clef?','No, it is still C',['Yes, it becomes F','Yes, it becomes G'],'A pitch keeps its name even when it is written with another clef.'],
  ['Which regular treble line is nearest Middle C below the staff?','The bottom line, E',['The top line, F','The middle line, B'],'E is the first regular line above Middle C in treble.'],
  ['Which regular bass line is nearest Middle C above the staff?','The top line, A',['The bottom line, G','The middle line, D'],'A is the top bass line; Middle C sits above it.'],
  ['Which letter is one step above Middle C?','D',['B','E'],'The musical alphabet goes C, D, E as notes rise.'],
  ['Which letter is one step below Middle C?','B',['D','A'],'Going down from C gives B, then A.'],
  ['Which letter is two steps above Middle C?','E',['D','F'],'C to D is one step; D to E is the second step.'],
  ['Which letter is two steps below Middle C?','A',['B','G'],'C to B is one step; B to A is the second step.'],
  ['Which hand often reads the upper staff in beginner piano music?','The right hand',['Always both feet','Only the left hand'],'The upper staff is often for the right hand, though music can make exceptions.'],
  ['Which hand often reads the lower staff in beginner piano music?','The left hand',['Always both feet','Only the right hand'],'The lower staff is often for the left hand, though music can make exceptions.'],
  ['Does the upper staff always mean “play louder”?','No, it shows pitches',['Yes, always louder','Yes, always faster'],'Staff height shows pitch. Dynamics show loudness.'],
  ['Does the lower staff always mean “play slower”?','No, it shows pitches',['Yes, always slower','Yes, always softer'],'Tempo controls speed. The lower staff often shows lower notes.'],
  ['Can notes on both staffs happen at the same time?','Yes',['No, never','Only if both notes are C'],'Notes lined up in time can be played together.'],
  ['What should you read when a note’s stem crosses toward the other staff?','The notehead and its clef',['Only the stem tip','Only the nearest brace'],'Find the notehead first; the stem can point away from it.'],
  ['The bottom treble line and bottom bass line have which names?','E and G',['Both E','Both G'],'Treble starts on E; bass starts on G.'],
  ['The top treble line and top bass line have which names?','F and A',['Both F','Both A'],'Treble lines end on F; bass lines end on A.'],
  ['The middle treble line and middle bass line have which names?','B and D',['Both B','Both D'],'The middle treble line is B. The middle bass line is D.'],
  ['The lowest treble space and lowest bass space have which names?','F and A',['Both F','Both A'],'Treble spaces begin F; bass spaces begin A.'],
  ['The highest treble space and highest bass space have which names?','E and G',['Both E','Both G'],'Treble spaces end E; bass spaces end G.'],
  ['Which reminder belongs to treble spaces on the grand staff?','FACE',['All Cows Eat Grass','Great Big Dreams For America'],'FACE names the four treble spaces from the bottom.'],
  ['Which reminder belongs to bass spaces on the grand staff?','All Cows Eat Grass',['Every Good Boy Does Fine','FACE'],'All Cows Eat Grass names bass spaces from the bottom.'],
  ['Which reminder names bass lines on the grand staff?','Great Big Dreams For America',['FACE','All Cows Eat Grass'],'Great Big Dreams For America gives G B D F A, bottom to top.']
 ]);

 // All beat arithmetic here explicitly uses a quarter-note beat in 4/4.
 const lengths=[4,3,2,1.5,1,.5,.25];
 for(const rest of [false,true])for(const value of lengths){
  const dot=value===3||value===1.5;
  const context=dot?'A dot adds half the plain length. A plain '+noteName(value/1.5)+(rest?' rest':' note')+' lasts '+beatLabel(value/1.5)+' in 4/4. ':'';
  add('rhythm-tree',context+'In 4/4, how long does this '+noteName(value)+(rest?' rest':' note')+' last?',beatLabel(value),[beatLabel(value===4?2:4),beatLabel(value===1?2:1)],'In 4/4, a quarter note gets one beat. This '+(rest?'silence':'sound')+' lasts '+beatLabel(value)+'.',rhythm([value],rest?[0]:[]),'duration');
 }
 const basic=[4,2,1,.5,.25];
 for(let a=0;a<basic.length;a++)for(let b=a+1;b<basic.length;b++){
  const long=basic[a],short=basic[b],answer=long/short;
  add('rhythm-tree','How many '+noteName(short)+' notes last as long as one '+noteName(long)+' note?',String(answer),[String(answer+1),String(answer===2?4:answer-1)],'Divide the longer written length into equal shorter notes: '+answer+' '+noteName(short)+' notes.',rhythm([long,short]),'equivalent-length');
  const shortFirst=(a+b)%2===0;
  add('rhythm-tree','Which shown note lasts longer in 4/4?',shortFirst?'The second note':'The first note',[shortFirst?'The first note':'The second note','They last equally long'],'A '+noteName(long)+' note lasts longer than a '+noteName(short)+' note.',rhythm(shortFirst?[short,long]:[long,short]),'compare-length');
 }
 const totals=[[1,1],[2,1],[.5,.5],[1,.5],[.25,.25],[2,.5],[1,.25],[.5,.25],[.5,.5,.5],[1,.5,.5],[1,.25,.25],[.25,.25,.25,.25],[2,1,.5],[1,1,.5,.5],[2,2]];
 for(const values of totals){const sum=values.reduce((a,b)=>a+b,0);add('rhythm-tree','In 4/4, how long do these notes last altogether?',beatLabel(sum),[beatLabel(sum+1),beatLabel(sum+.5)],'Add their lengths: '+values.map(beatLabel).join(' + ')+' = '+beatLabel(sum)+'.',rhythm(values),'add-lengths');}
 const fills=[[.5,.5],[1],[.25,.25,.25,.25],[1,1],[2],[.5,.5,1],[1,.5,.5],[1,1,1],[2,1],[1,2],[.5,.5,2],[2,.5,.5],[1,1,.5,.5],[.5,.5,1,1],[1,.5,1,.5]];
 for(const values of fills){const sum=values.reduce((a,b)=>a+b,0),missing=4-sum;add('rhythm-tree','These notes start a 4/4 bar. How many beats are still empty?',beatLabel(missing),[beatLabel(missing===1?2:1),beatLabel(missing===3?4:3)],'A 4/4 bar has four quarter-note beats. '+sum+' are filled, so '+missing+' remain.',rhythm(values),'complete-bar');}
 for(const value of lengths)add('rhythm-tree','Matching note and rest shapes last equally long. Which rest matches a '+noteName(value)+' note?','A '+noteName(value)+' rest',['A '+noteName(value===4?2:4)+' rest','A '+noteName(value===1?2:1)+' rest'],'Matching note and rest shapes have the same written length. The rest means silence.',rhythm([value]),'match-rest');
 for(const value of [2,1,.5]){const dotted=value*1.5;add('rhythm-tree','A dot adds half the plain length. The plain '+noteName(value)+' lasts '+beatLabel(value)+' in 4/4. What does the dot add to this '+noteName(dotted)+' note?',beatLabel(value/2),[beatLabel(value),beatLabel(value*2)],'A dot adds half of the plain note’s length: '+beatLabel(value/2)+'.',rhythm([dotted]),'augmentation-dot');}
 for(const [large,small]of[[4,2],[2,1],[1,.5],[.5,.25],[4,1],[2,.5]])add('rhythm-tree','You split one '+noteName(large)+' note into equal '+noteName(small)+' notes. How many do you get?',String(large/small),[String(large/small+1),String(large/small===2?4:2)],'The parts must add back to the same total written length.',rhythm([large,small]),'rhythm-tree');
 curated('rhythm-tree',[
  ['What does a rest tell a musician to do?','Stay silent for its length',['Play louder','Skip the beat completely'],'A rest is a measured silence. The beat still continues.'],
  ['Does time stop during a rest?','No, keep counting',['Yes, all beats stop','Only in quiet music'],'Keep counting through silence so the next sound starts on time.'],
  ['In 4/4, which note usually gets one beat?','Quarter note',['Whole note','Half note'],'The bottom 4 names a quarter-note beat.'],
  ['In 4/4, which note fills a whole four-beat bar?','Whole note',['Half note','Quarter note'],'A whole note lasts four quarter-note beats.'],
  ['In 4/4, which rest gives one full bar of silence?','A whole-bar rest',['An eighth rest','A quarter rest'],'A whole-bar rest means silence for the entire bar.'],
  ['A tie means keep holding instead of playing again. How should two tied notes of the same pitch sound?','As one sound with their lengths joined',['With a gap between them','With the second pitch raised'],'A tie means hold the first sound for both written lengths.'],
  ['A tie adds two same-pitch note lengths into one sound. In 4/4, a half note tied to a quarter note lasts how long?','3 beats',['1 beat','4 beats'],'Two beats plus one beat makes three beats.'],
  ['A tie adds two same-pitch note lengths into one sound. In 4/4, two tied quarter notes last as long as what?','One half note',['One eighth note','One whole note'],'One beat plus one beat equals two beats.'],
  ['A beam joins short notes so they are easier to read; each keeps its length. Does beaming two eighth notes change their total length?','No',['Yes, it doubles the length','Yes, it removes a beat'],'A beam groups notes so they are easier to read.'],
  ['One beam groups eighth notes. Two beams group notes half as long as eighths. Which notes are those?','Sixteenth notes',['Half notes','Whole notes'],'Sixteenth notes have two flags or two beams.'],
  ['A single flagged note lasts half as long as a quarter note. Which note is it?','An eighth note',['A whole note','A half note'],'An eighth note has one flag when it is not beamed to another note.'],
  ['Which note has a hollow head and no stem?','Whole note',['Half note','Quarter note'],'A whole note has a hollow notehead and no stem.'],
  ['Which note has a hollow head and a stem?','Half note',['Quarter note','Eighth note'],'A half note has a hollow notehead and a stem.'],
  ['Which note has a filled head, a stem, and no flag?','Quarter note',['Half note','Whole note'],'That is the usual shape of a quarter note.'],
  ['Which lasts longer: a quarter note or a quarter rest?','They last equally long',['The note','The rest'],'A matching note and rest have equal length; one sounds and one is silent.'],
  ['What is rhythm?','A pattern of sounds and silences in time',['Only how loud music is','Only the highest pitch'],'Rhythm uses different lengths of notes and rests.'],
  ['What is the steady beat?','The even pulse you can tap',['Every different note length','The loudest instrument'],'The beat stays even while rhythms can change around it.'],
  ['A friend claps two eighth notes during one quarter-note beat. How many claps is that?','2',['1','4'],'Two equal eighth notes share the quarter-note beat.'],
  ['A dot adds half of a note’s original length. Which describes the dotted note’s whole length?','It becomes one and a half times as long',['It becomes half as long','It stays exactly the same'],'Keep the original length and add half of it.'],
  ['Does a quarter note always mean one big beat in every time signature?','No, the time signature matters',['Yes, always','No, it always means two big beats'],'It gets one beat in 4/4. In cut time, a half note gets the big beat.']
 ]);

 const meters=[{id:'2/4',top:2,bottom:4,q:2,pulses:2,unit:'Quarter note',count:'ONE, two'}, {id:'3/4',top:3,bottom:4,q:3,pulses:3,unit:'Quarter note',count:'ONE, two, three'}, {id:'4/4',top:4,bottom:4,q:4,pulses:4,unit:'Quarter note',count:'ONE, two, three, four'}, {id:'2/2',top:2,bottom:2,q:4,pulses:2,unit:'Half note',count:'ONE-and, TWO-and'}, {id:'6/8',top:6,bottom:8,q:3,pulses:2,unit:'Dotted quarter note',count:'ONE-la-li, TWO-la-li'}];
 for(const m of meters){
  const shown={kind:'meter',meter:m.id};
  add('time-signatures','What is the top number of '+m.id+'?',String(m.top),[String(m.top+1),String(m.top===2?4:2)],'Read the number above the other number.',shown,'read-meter');
  const bottomUnit=m.bottom===4?'Quarter note':m.bottom===2?'Half note':'Eighth note';
  add('time-signatures','Which written note value does the bottom '+m.bottom+' name in '+m.id+'?',bottomUnit,['Whole note',bottomUnit==='Quarter note'?'Half note':'Quarter note'],'The bottom number names the written note unit: 2 = half, 4 = quarter, 8 = eighth. In 6/8, three eighths group into each big beat.',shown,'denominator');
  for(const [value,label]of[[1,'quarter notes'],[.5,'eighth notes'],[.25,'sixteenth notes']]){
   const n=m.q/value;add('time-signatures','How many '+label+' fill one '+m.id+' bar?',String(n),[String(n+1),String(n===2?4:n-1)],'This bar holds the written length of '+m.q+' quarter notes, which equals '+n+' '+label+'.',shown,'bar-length');
  }
  add('time-signatures','Which group fills one '+m.id+' bar?',m.q+' quarter notes',[(m.q+1)+' quarter notes',(m.q===2?4:2)+' quarter notes'],'Compare written lengths. '+m.q+' quarter notes fill this bar even if you feel a different big beat.',shown,'equivalent-bar');
  const filled=m.q===2?[.5,1,1.25,1.5]:[m.q/2,m.q/2-.5,m.q-1,m.q-.5];
  filled.forEach((used,index)=>{const missing=m.q-used;add('time-signatures','A '+m.id+' bar already holds '+quarterLengths(used)+'. How much more written length fits?',quarterLengths(missing),[quarterLengths(missing+.5),quarterLengths(missing+1)],'The bar holds '+m.q+' quarter-note units. Subtract the amount already filled.',shown,'finish-meter-bar');});
  add('time-signatures','How many '+(m.id==='6/8'||m.id==='2/2'?'big ':'')+'beats do we usually feel in one '+m.id+' bar?',String(m.pulses),[String(m.pulses+1),String(m.pulses===2?6:2)],m.id==='6/8'?'Six eighth-note parts group into TWO big beats.':m.id==='2/2'?'Two half-note beats make a cut-time bar.':'Count '+m.pulses+' quarter-note beats in each bar.',shown,'pulse');
  add('time-signatures','Which note gets one '+(m.id==='6/8'||m.id==='2/2'?'big ':'')+'beat in '+m.id+'?',m.unit,[m.unit==='Quarter note'?'Half note':'Quarter note',m.unit==='Dotted quarter note'?'Eighth note':'Dotted quarter note'],'Match the felt pulse: '+m.unit.toLowerCase()+' = one '+(m.id==='6/8'||m.id==='2/2'?'big ':'')+'beat here.',shown,'pulse-unit');
  add('time-signatures','Which count fits '+m.id+'?',m.count,['ONE, two, three, four, five','ONE, two, three, four, five, six, seven'],'Use '+m.count+'; start again at ONE at the next bar.',shown,'count-meter');
  add('time-signatures','Two complete '+m.id+' bars last as long as how many quarter notes?',String(m.q*2),[String(m.q*2+1),String(m.q)],'Each bar holds '+m.q+' quarter-note lengths. Two bars hold '+m.q*2+'.',shown,'two-bars');
 }
 for(let a=0;a<meters.length;a++)for(let b=a+1;b<meters.length;b++){
  const x=meters[a],y=meters[b],answer=x.q>y.q?x.id:y.q>x.q?y.id:'They have equal written length';
  add('time-signatures','Which complete bar has more written note length: '+x.id+' or '+y.id+'?',answer,answer==='They have equal written length'?[x.id,y.id]:[answer===x.id?y.id:x.id,'They have equal written length'],'Compare quarter-note lengths: '+x.id+' holds '+x.q+'; '+y.id+' holds '+y.q+'. The felt beat can still differ.',null,'compare-bars');
 }
 curated('time-signatures',[
  ['What does a time signature help organize?','Beats into bars',['The colour of the instrument','Only note-letter names'],'A time signature tells us how written time groups into bars.'],
  ['Where do you usually see the time signature at the start of a piece?','Near the clef at the beginning',['Only after the last bar','Inside every notehead'],'Look near the clef at the start of the music.'],
  ['What does a bar line show?','The boundary between bars',['A place to stop forever','A new instrument'],'A bar line separates one bar from the next.'],
  ['After the last beat of a full bar, what count usually starts the next bar?','ONE',['ZERO','The same last number'],'Begin a new group of beats at ONE.'],
  ['In 3/4, which number tells you there are three quarter-note beats?','The top 3',['The bottom 4','Neither number'],'The top number counts the written units in the bar.'],
  ['In 4/4, what does the bottom 4 refer to?','Quarter-note units',['Four seconds','Four instruments'],'The bottom 4 names a quarter note.'],
  ['Which time signature is also called cut time?','2/2',['3/4','6/8'],'Cut time has two half-note big beats per bar.'],
  ['In cut time, how many quarter notes share one half-note big beat?','2',['1','4'],'Two quarters last as long as one half note.'],
  ['In 6/8, how are the six eighth notes usually grouped?','3 + 3',['2 + 2 + 2','4 + 2'],'Two groups of three give the familiar ONE-la-li, TWO-la-li feel.'],
  ['How many eighth notes make one big beat in 6/8?','3',['2','6'],'A dotted-quarter big beat holds three eighth notes.'],
  ['Which note lasts one big beat in 6/8?','Dotted quarter note',['Quarter note','Half note'],'A dotted quarter equals three eighth notes.'],
  ['Does 6/8 usually mean six big beats?','No, it usually has two big beats',['Yes, always six big beats','No, it has no beat'],'Feel two groups of three eighth-note parts.'],
  ['Do 3/4 and 6/8 have the same usual beat grouping?','No: 3 beats of 2 parts versus 2 beats of 3 parts',['Yes, they are always identical','No: 6/8 has no pulse'],'Both fit six eighth notes, but their grouping is different.'],
  ['Does 2/2 require the music to be played twice as fast as 4/4?','No, tempo decides the speed',['Yes, always twice as fast','No, it must be twice as slow'],'The time signature organizes beats; tempo sets how fast the chosen beat moves.'],
  ['Can a bar include both notes and rests?','Yes',['No, only notes','No, only rests'],'Add the lengths of sounds and silences to fill the bar.'],
  ['During a rest, do you still count the beats in the bar?','Yes',['No','Only in 4/4'],'Rests take time too, so keep the pulse going.'],
  ['A complete 4/4 bar holds two half notes. Is that full?','Yes',['No, it needs another half note','No, it is too long'],'Each half lasts two quarter-note beats: 2 + 2 = 4.'],
  ['A complete 3/4 bar holds a half note and a quarter note. Is that full?','Yes',['No, it needs a whole note','No, it is too long'],'Two quarter-note beats plus one make three.'],
  ['A complete 6/8 bar holds two dotted quarter notes. Is that full?','Yes',['No, it needs six more eighth notes','No, it is too long'],'Each dotted quarter holds three eighths: 3 + 3 = 6.'],
  ['Which part of music tells you how quickly to feel the beat?','Tempo',['The top time-signature number alone','The colour of a notehead'],'Tempo sets speed; the time signature sets grouping.']
 ]);

 const majorScales=[
  ['C',['C','D','E','F','G','A','B']],['G',['G','A','B','C','D','E','F-sharp']],['D',['D','E','F-sharp','G','A','B','C-sharp']],['A',['A','B','C-sharp','D','E','F-sharp','G-sharp']],
  ['E',['E','F-sharp','G-sharp','A','B','C-sharp','D-sharp']],['B',['B','C-sharp','D-sharp','E','F-sharp','G-sharp','A-sharp']],['F-sharp',['F-sharp','G-sharp','A-sharp','B','C-sharp','D-sharp','E-sharp']],
  ['F',['F','G','A','B-flat','C','D','E']],['B-flat',['B-flat','C','D','E-flat','F','G','A']],['E-flat',['E-flat','F','G','A-flat','B-flat','C','D']],['A-flat',['A-flat','B-flat','C','D-flat','E-flat','F','G']],['D-flat',['D-flat','E-flat','F','G-flat','A-flat','B-flat','C']]
 ];
 const pc=value=>{const [letter,alter]=value.split('-');return({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[letter]+(alter==='sharp'?1:alter==='flat'?-1:0)+12)%12;};
 const chromatic=['C','C-sharp','D','E-flat','E','F','F-sharp','G','A-flat','A','B-flat','B'];
 for(const [home,notes]of majorScales){
  const minor=notes.slice(5).concat(notes.slice(0,5)),minorHome=minor[0];
  for(const [tonic,mode,scale]of[[home,'major',notes],[minorHome,'minor',minor]]){
   add('major-minor-keys','What is the home note of '+tonic+' '+mode+'?',tonic,[scale[3],scale[4]],'The first part of the key name names its home note: '+tonic+'.',null,'tonic');
  }
  add('major-minor-keys','The relative natural minor starts on note 6 of a major scale. Count the first note as 1. '+home+' major has which relative minor key?',minorHome+' minor',[notes[1]+' minor',notes[2]+' minor'],'The relative minor starts on the sixth note of the major scale: '+minorHome+'.',{kind:'scale',notes},'relative-keys');
  add('major-minor-keys','Count the home as 1. What is the third note of the '+home+' major scale?',notes[2],[notes[1],notes[3]],'Count from the home note as 1: '+notes.slice(0,3).join(', ')+'.',{kind:'scale',notes},'major-third');
  add('major-minor-keys','Count the home as 1. What is the third note of the '+minorHome+' natural minor scale?',minor[2],[minor[1],minor[3]],'Count from the home note as 1: '+minor.slice(0,3).join(', ')+'.',{kind:'scale',notes:minor},'minor-third');
  const step=2+majorScales.findIndex(row=>row[0]===home)%5,missing=notes[step],shown=notes.map((note,index)=>index===step?'?':note);
  add('major-minor-keys','Follow the letter names A–G, then repeat. Fill the missing note in this '+home+' major scale.',missing,[notes[(step+1)%7],notes[(step+3)%7]],'The '+home+' major notes are '+notes.join(', ')+'.',{kind:'scale',notes:shown},'scale-pattern');
  const outside=chromatic.find(note=>!notes.some(inside=>pc(inside)===pc(note)));
  add('major-minor-keys','Use the shown notes. Which note is NOT in the '+home+' major scale?',outside,[notes[0],notes[4]],'The scale is '+notes.join(', ')+'. '+outside+' is outside this collection.',{kind:'scale',notes},'key-membership');
 }
 curated('major-minor-keys',[
  ['C major goes C D E F G A B C. Which note comes right after C as you go up?','D',['B','F'],'Follow the musical alphabet upward: C, D, E.',{kind:'scale',notes:['C','D','E','F','G','A','B','C']}],
  ['A natural minor goes A B C D E F G A. Which note comes right after B?','C',['A','D'],'After B comes C. The scale still follows the music letters.',{kind:'scale',notes:['A','B','C','D','E','F','G','A']}],
  ['You are exploring C major on white piano keys. Which white key is between C and E?','D',['F','A'],'The white-key letters go C, D, E.'],
  ['D major uses F-sharp. A sharp raises a note by a half step. Which note replaces F?','F-sharp',['F-flat','F natural'],'F-sharp is one half step higher than F.'],
  ['Compare C major, C E G, with C minor, C E-flat G. Which note changed?','The middle note E became E-flat',['C became D','G became A'],'Lowering the middle E to E-flat changes this C major sound into C minor.'],
  ['Count C as 1 in C D E F G A B. What number is A?','6',['3','4'],'Count the shown notes: C 1, D 2, E 3, F 4, G 5, A 6.',{kind:'scale',notes:['C','D','E','F','G','A','B']}],
  ['What does a key’s home note feel like?','A place where the music feels settled',['Always the loudest sound','Always the fastest sound'],'The home note is also called the tonic.'],
  ['Must every major piece sound happy?','No, major music can have many moods',['Yes, always','No, it must sound angry'],'Mode is one part of musical colour. Tempo, dynamics, and other choices affect mood too.'],
  ['Must every minor piece sound sad?','No, minor music can have many moods',['Yes, always','No, it must sound funny'],'Minor can sound many ways, including lively or dramatic.'],
  ['If a melody changes from C major to C minor, does its home letter have to change?','No, C can stay home',['Yes, it must become A','Yes, it must become F'],'Parallel major and minor keys share the same home note.'],
  ['Which notes make a C major triad?','C E G',['C E-flat G','C F A'],'C major uses C, its major third E, and G.'],
  ['Which notes make a C minor triad?','C E-flat G',['C E G','C F A'],'Lower the third of C major from E to E-flat to get C minor.'],
  ['Does a sharp or flat in a key mean the music must be loud?','No, it changes pitch',['Yes, it means forte','Yes, it means very soft'],'Accidentals change notes. Dynamics change loudness.'],
  ['What is different between C major and A natural minor, even though they share notes?','Their home notes',['Their piano has different keys','One has no rhythm'],'C is home in C major. A is home in A minor.'],
  ['A scale rises from its home and returns to that note higher up. Has its home letter changed?','No',['Yes, to H','Yes, to the next letter'],'The letter names repeat; the scale returns to its home note.'],
  ['C major and A minor share these white-key notes. If A feels like home, which of those keys are you exploring?','A minor',['C major','D major'],'The collection can be shared, but the home note tells these two keys apart.',{kind:'scale',notes:['A','B','C','D','E','F','G','A']}]
 ]);

 const dynamics=[['pp','very soft'],['p','soft'],['mp','medium soft'],['mf','medium loud'],['f','loud'],['ff','very loud']];
 for(const [mark,meaning]of dynamics){
  const i=dynamics.findIndex(row=>row[0]===mark),wrong=[dynamics[(i+2)%6][1],dynamics[(i+4)%6][1]];
  add('dynamics','What does '+mark+' ask you to play?',meaning,wrong,mark+' means '+meaning+'. It changes loudness, not the note letters.',{kind:'dynamic',mark},'dynamic-mark');
  add('dynamics','Which marking means “'+meaning+'”?',mark,[dynamics[(i+1)%6][0],dynamics[(i+3)%6][0]],'Use '+mark+' for '+meaning+'.',null,'choose-mark');
 }
 for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)for(const louder of [true,false]){
  const first=dynamics[a][0],second=dynamics[b][0],answer=louder?second:first;
  add('dynamics','Which is '+(louder?'louder':'softer')+': '+first+' or '+second+'?',answer,[louder?first:second,'They mean the same loudness'],'From softer to louder: pp, p, mp, mf, f, ff.',null,'compare-dynamics');
 }
 const triples=[[0,1,2],[1,2,3],[2,3,4],[3,4,5],[0,2,4],[1,3,5],[0,3,5],[0,1,5],[1,2,4],[2,4,5]];
 for(const indices of triples){const marks=indices.map(i=>dynamics[i][0]),answer=marks.join(' → ');add('dynamics','Put these markings in order from softer to louder: '+[marks[1],marks[2],marks[0]].join(', ')+'.',answer,[[...marks].reverse().join(' → '),[marks[1],marks[0],marks[2]].join(' → ')],'The order of increasing loudness is pp, p, mp, mf, f, ff.',null,'dynamic-order');}
 for(const [mark,meaning]of dynamics)for(const direction of ['crescendo','decrescendo']){
  const growing=direction==='crescendo';add('dynamics','Start '+mark+' ('+meaning+'), then '+direction+'. What should change?','Get gradually '+(growing?'louder':'softer'),['Get gradually '+(growing?'faster':'slower'),'Change every note’s letter'],'A '+direction+' changes loudness gradually.',{kind:'dynamic',mark:direction},'gradual-change');
 }
 curated('dynamics',[
  ['A flute begins quietly and grows louder over several notes. Which instruction fits?','Crescendo',['Ritardando','Piano'],'Crescendo means gradually louder.'],
  ['A drum roll fades gently toward silence. Which instruction fits?','Decrescendo',['Accelerando','Forte'],'Decrescendo means gradually softer.'],
  ['A singer is too loud to hear a quiet solo underneath. Which change could help?','Sing more softly',['Sing faster','Raise every pitch'],'Changing dynamics can help musicians balance their sounds.'],
  ['A composer wants a sudden strong entrance. Which marking fits better?','f',['p','pp'],'Forte asks for a loud sound.'],
  ['A composer wants a very gentle entrance. Which marking fits better?','pp',['f','ff'],'Pianissimo asks for a very soft sound.'],
  ['A band changes from f to p. What happens to its loudness?','It becomes softer',['It becomes louder','It must become faster'],'Forte is loud; piano is soft.'],
  ['A band changes from p to f. What happens to its loudness?','It becomes louder',['It becomes softer','It must become slower'],'Piano is soft; forte is loud.'],
  ['A melody stays on C but grows louder. Which element changes?','Dynamics',['The note letter','The number of staff lines'],'Dynamics can change while pitch stays the same.'],
  ['A melody keeps the same speed but becomes softer. Which element changes?','Dynamics',['Tempo','Time signature'],'Softer sound is a change in dynamics.'],
  ['An ensemble repeats a phrase more quietly. Must its notes become shorter?','No',['Yes, always half as long','Yes, always twice as long'],'Loudness and written note length are different things.'],
  ['What part of music is called dynamics?','How loudly or softly it is played',['How fast the beat moves','Which clef is used'],'Dynamics means musical loudness and softness.'],
  ['What does piano mean as a dynamic instruction?','Soft',['A keyboard instrument only','Fast'],'Piano can name an instrument, but as a dynamic it means soft.'],
  ['What does forte mean?','Loud',['Soft','Slow'],'Forte means loud. Its abbreviation is f.'],
  ['What does mezzo mean in mp and mf?','Medium',['Very','Suddenly'],'Mezzo means medium or moderately.'],
  ['What is the full name of pp?','Pianissimo',['Fortissimo','Mezzo forte'],'Pianissimo means very soft.'],
  ['What is the full name of ff?','Fortissimo',['Pianissimo','Mezzo piano'],'Fortissimo means very loud.'],
  ['What is the full name of mp?','Mezzo piano',['Mezzo forte','Fortissimo'],'Mezzo piano means medium soft.'],
  ['What is the full name of mf?','Mezzo forte',['Mezzo piano','Pianissimo'],'Mezzo forte means medium loud.'],
  ['Which word also means gradually softer?','Diminuendo',['Crescendo','Accelerando'],'Diminuendo and decrescendo both ask for gradually softer sound.'],
  ['A crescendo hairpin opens wider from left to right. What do you do?','Grow louder',['Grow softer','Always speed up'],'The widening hairpin means crescendo.'],
  ['A decrescendo hairpin narrows from left to right. What do you do?','Grow softer',['Grow louder','Always slow down'],'The narrowing hairpin means decrescendo.'],
  ['Does a crescendo always mean play faster?','No',['Yes, always','Only in 4/4'],'Crescendo changes loudness. Accelerando changes speed.'],
  ['Does a decrescendo always mean play slower?','No',['Yes, always','Only in bass clef'],'Decrescendo changes loudness. Ritardando changes speed.'],
  ['Is forte a request to make an ugly or painful sound?','No, aim for a clear controlled loud sound',['Yes, always bang as hard as possible','Yes, always shout'],'A loud dynamic still needs control and listening.'],
  ['Are dynamic levels compared with the music around them?','Yes',['No, every instrument must use identical force','No, p means silence'],'Dynamics are relative. Listen to the phrase and the ensemble.'],
  ['Does pp mean complete silence?','No, a very soft sound',['Yes, no sound at all','No, very loud'],'A rest means silence. Pianissimo means very soft.'],
  ['Can a phrase change loudness while keeping the same rhythm?','Yes',['No, never','Only with a new clef'],'Rhythm and dynamics are different musical elements.'],
  ['Which mark is just softer than mf in our dynamic ladder?','mp',['ff','f'],'The ladder is pp, p, mp, mf, f, ff.'],
  ['Which mark is just louder than mp in our dynamic ladder?','mf',['pp','p'],'Mezzo forte is louder than mezzo piano.'],
  ['A quiet part and a loud part use the same note letters. Can they still sound different?','Yes, because their dynamics differ',['No, note letters control everything','No, only tempo can change sound'],'Expression includes dynamics as well as pitches.'],
  ['If you change from pp to p, which direction is the change?','Louder',['Softer','No change'],'Piano is louder than pianissimo.'],
  ['If you change from ff to f, which direction is the change?','Softer',['Louder','No change'],'Forte is softer than fortissimo.'],
  ['A crescendo ends at f. Should you continue getting louder forever?','No, arrive at the marked loudness',['Yes, always get louder forever','No, stop playing all sound'],'Follow the destination dynamic and the next instruction.'],
  ['During a gradual fade, should the beat disappear or become uneven?','No, keep a steady beat unless tempo also changes',['Yes, stop counting','Yes, skip every other beat'],'A softer sound can keep the same steady pulse.'],
  ['Which instruction changes loudness rather than speed?','Mezzo piano',['Allegro','Presto'],'Mezzo piano is a dynamic. Allegro and presto are tempo words.'],
  ['Two players read mf. Must they press or blow with exactly the same force?','No, balance the sound together',['Yes, every instrument uses the same force','No, one must stop playing'],'Different instruments respond differently; musicians listen for a balanced result.']
 ]);

 const tempoWords=[['Largo','very slow and broad'],['Adagio','slow'],['Andante','at a walking pace'],['Moderato','at a moderate pace'],['Allegro','fast and lively'],['Presto','very fast']];
 for(let i=0;i<tempoWords.length;i++){
  const [word,meaning]=tempoWords[i];add('tempo','What does '+word+' suggest?',meaning,[tempoWords[(i+2)%6][1],tempoWords[(i+4)%6][1]],word+' is a tempo word meaning '+meaning+'.',{kind:'tempo',text:word},'tempo-word');
  add('tempo','Which tempo word means “'+meaning+'”?',word,[tempoWords[(i+1)%6][0],tempoWords[(i+3)%6][0]],word+' suggests '+meaning+'.',null,'choose-tempo');
 }
 const bpms=[60,72,80,96,120,144];
 for(let a=0;a<bpms.length;a++)for(let b=a+1;b<bpms.length;b++)for(const faster of [true,false]){
  const low=bpms[a],high=bpms[b],answer=(faster?high:low)+' BPM';add('tempo','For the same beat unit, which tempo is '+(faster?'faster':'slower')+': '+low+' or '+high+' BPM?',answer,[(faster?low:high)+' BPM','They are the same speed'],'For the same note unit, more beats per minute means a faster pulse.',null,'compare-bpm');
 }
 const pulseStories=[
  ['A steady drum pulse continues while the singer uses long and short notes. Which part stays even?','The beat',['Every sung note length','Every sung pitch'],'The beat is the even pulse underneath changing rhythms.'],
  ['A melody has a busy rhythm. Must its tempo be fast?','No',['Yes, always','Only with a bass clef'],'Many short notes can fit over a slow steady pulse.'],
  ['You tap once for each metronome click. What are you following?','The steady beat',['The note letters','The loudness marks'],'A metronome gives a regular pulse.'],
  ['A slow song uses sixteenth notes. Can its beat still be slow?','Yes',['No, sixteenths force presto','Only in 3/4'],'Note lengths fit inside the chosen beat speed.'],
  ['A fast song holds one long note. Does that note force the tempo to become slow?','No',['Yes, always','Only in 4/4'],'The beat can keep moving quickly under a long held note.'],
  ['Two players share a beat but play different rhythms. Can they stay together?','Yes',['No, never','Only if both play C'],'Different rhythms can share the same steady pulse.'],
  ['A marching beat stays evenly spaced. What should your beat taps do?','Stay evenly spaced',['Speed up each tap','Skip every third tap'],'A steady beat repeats at equal time gaps.'],
  ['A tune grows louder with no tempo instruction. Should its beat automatically speed up?','No',['Yes, always','Only with eighth notes'],'Loudness and tempo can change independently.'],
  ['A tune becomes softer with no tempo instruction. Should its beat automatically slow down?','No',['Yes, always','Only with quarter notes'],'Soft sound can keep the same tempo.'],
  ['What is the difference between beat and rhythm?','Beat is the even pulse; rhythm is a pattern of lengths',['They always mean exactly the same thing','Beat names pitches; rhythm names instruments'],'You can tap a steady beat while clapping a changing rhythm.']
 ];curated('tempo',pulseStories);
 for(const [start,word]of tempoWords)for(const change of ['accelerando','ritardando'])add('tempo','The music begins '+start+', then says '+change+'. What should happen?',change==='accelerando'?'Gradually speed up':'Gradually slow down',[change==='accelerando'?'Gradually get louder':'Gradually get softer','Change the clef'],'Accelerando changes speed upward; ritardando changes speed downward.',{kind:'tempo',text:change},'tempo-change');
 const tempoStories=[
  ['The beat becomes gradually quicker, like a train gathering speed. Which instruction fits?','Accelerando',['Crescendo','Ritardando'],'Accelerando means gradually faster.'],
  ['The beat gradually relaxes near the end of a tune. Which instruction fits?','Ritardando',['Decrescendo','Accelerando'],'Ritardando means gradually slower.'],
  ['The earlier speed was 100 BPM. After slowing down, “a tempo” means return to that earlier speed. Which BPM now?','100 BPM',['50 BPM','200 BPM'],'A tempo means return to the previous main speed: here, 100 BPM.'],
  ['A composer wants a very fast chase scene. Which tempo word fits best?','Presto',['Largo','Adagio'],'Presto means very fast.'],
  ['A composer wants a broad, very slow opening. Which tempo word fits best?','Largo',['Presto','Allegro'],'Largo suggests a slow, broad pace.'],
  ['A tune should move at an easy walking pace. Which word fits?','Andante',['Presto','Largo'],'Andante suggests a walking pace.'],
  ['A tune should be neither slow nor fast. Which word fits?','Moderato',['Presto','Largo'],'Moderato means a moderate pace.'],
  ['A lively fast dance begins. Which word fits?','Allegro',['Adagio','Largo'],'Allegro suggests fast, lively movement.'],
  ['A tune should be slow and unhurried. Which word fits?','Adagio',['Presto','Allegro'],'Adagio is a slow tempo.'],
  ['A player speeds up even though the metronome stays even and no change is marked. What should help?','Listen and return to the steady clicks',['Keep rushing faster','Ignore the beat'],'The metronome can help maintain a steady tempo.']
 ];curated('tempo',tempoStories);
 for(const bpm of [48,60,72,80,96,120,144,160])add('tempo','A metronome is set to '+bpm+' BPM. How many of its beats fit in one minute?',String(bpm),[String(bpm/2),String(bpm*2)],'BPM means beats per minute. '+bpm+' BPM gives '+bpm+' beats in a minute.',{kind:'tempo',text:'Metronome',bpm},'bpm-meaning');
 curated('tempo',[
  ['At 60 BPM, about how long is one beat?','1 second',['2 seconds','½ second'],'There are 60 seconds in a minute, so 60 beats fit at one per second.'],
  ['At 120 BPM, about how long is one beat?','½ second',['1 second','2 seconds'],'120 beats fit into 60 seconds: two beats each second.'],
  ['At 30 BPM, about how long is one beat?','2 seconds',['1 second','½ second'],'30 beats fit into 60 seconds: two seconds for each beat.'],
  ['At 60 BPM, about how long do four beats last?','4 seconds',['2 seconds','8 seconds'],'Each beat takes one second, so four beats take four seconds.'],
  ['At 120 BPM, about how long do four beats last?','2 seconds',['4 seconds','8 seconds'],'At two beats per second, four beats take two seconds.'],
  ['At 60 BPM, how many beats fit in two seconds?','2 beats',['1 beat','4 beats'],'At one beat per second, two seconds hold two beats.'],
  ['At 120 BPM, how many beats fit in two seconds?','4 beats',['2 beats','8 beats'],'At two beats per second, two seconds hold four beats.'],
  ['What does tempo mean?','The speed of the beat',['How loud the music is','The name of the lowest note'],'Tempo tells us how quickly the pulse moves.'],
  ['What does BPM stand for?','Beats per minute',['Bars per melody','Bass pitch mark'],'BPM counts how many chosen beats fit in a minute.'],
  ['Which tool gives steady clicks to help you practise a tempo?','A metronome',['A ledger line','A sharp sign'],'A metronome gives an even pulse at a chosen speed.'],
  ['Which instruction changes tempo rather than dynamics?','Ritardando',['Pianissimo','Crescendo'],'Ritardando slows the beat; the other words change loudness.'],
  ['Does allegro tell you the exact loudness to use?','No',['Yes, always forte','Yes, always piano'],'Allegro is about tempo and character. Dynamics set loudness.'],
  ['Does presto tell you to change every pitch?','No',['Yes, raise every pitch','Yes, lower every pitch'],'Presto changes the pace, not the written pitches.'],
  ['A metronome marking shows a half note = 60. Which note gets each click?','Half note',['Quarter note','Eighth note'],'Read the note shown next to the number: that note is the beat unit.'],
  ['Two markings both say 80, but one uses quarter-note clicks and one half-note clicks. Is the beat unit important?','Yes',['No, numbers tell the whole story','Only when playing loudly'],'The number and the chosen note unit both matter.'],
  ['A ritardando and a decrescendo happen together. What changes?','Both speed and loudness decrease',['Only the note letters change','Both speed and loudness increase'],'Ritardando slows down; decrescendo gets softer.'],
  ['An accelerando and a crescendo happen together. What changes?','Both speed and loudness increase',['Only the clef changes','Both speed and loudness decrease'],'Accelerando gets faster; crescendo gets louder.'],
  ['Should a tempo word be treated as a fixed speed identical for every piece?','No, use the musical context and any metronome marking',['Yes, every word has only one possible BPM','No, tempo words describe only pitch'],'Tempo words suggest a pace; a metronome marking can make the chosen beat speed more exact.']
 ]);

 function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
 for(const category of CATEGORIES)if(banks[category.id].length!==100)throw Error(category.id+' needs exactly 100 questions; found '+banks[category.id].length);
 const QUESTIONS=Object.values(banks).flat(),byId=Object.fromEntries(QUESTIONS.map(question=>[question.id,question]));
 freeze(CATEGORIES);freeze(banks);freeze(QUESTIONS);freeze(byId);
 return Object.freeze({VERSION,version:VERSION,CATEGORIES,QUESTIONS,pool(category){return banks[category]||Object.freeze([]);},getQuestion(id){return byId[id]||null;}});
});
