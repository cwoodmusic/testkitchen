/* Professor Haydn's local, accessible reference library and walkable room. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.CodaMusicClassroom=api;root.createCodaMusicClassroom=api.createCodaMusicClassroom;}
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const TOPICS=Object.freeze([
  {
    "id": "welcome",
    "title": "Start here with Professor Haydn",
    "shelf": "Start here",
    "keywords": "beginner basics first new start lessons help tutorial",
    "html": "<p>New to music? Start with <strong>1. Note names</strong>.</p><p>Each lesson shows you an example, then gives you one thing to try. You can listen again, use a hint, and try again.</p><p>After note names, try <strong>2. Rhythm</strong>, then <strong>3. Time signatures</strong>. Then try <strong>4. Bass clef</strong>, <strong>5. Grand staff &amp; Middle C</strong>, and <strong>6. Major &amp; minor keys</strong>. Explore sound with <strong>7. Dynamics</strong> and <strong>8. Tempo</strong>.</p><p>Need help with a game or a music word? Use <strong>Look something up</strong> to find a reference book.</p>",
    "quiz": {
      "question": "Which lesson is a good place to start?",
      "answers": [
        "Note names",
        "All the reference books at once",
        "The fastest game"
      ],
      "correct": 0,
      "explanation": "Start with Note names. The lesson helps you find notes on a piano."
    }
  },
  {
    "id": "note-naming",
    "title": "Note naming",
    "shelf": "Hands-on lessons",
    "keywords": "note naming pitch letters piano keyboard treble staff tutorial lesson",
    "tutorial": "note-naming",
    "html": "<p>Find C on a piano. Then learn to read a few note letters on the staff.</p>"
  },
  {
    "id": "rhythm-tree",
    "title": "The rhythm tree",
    "shelf": "Hands-on lessons",
    "keywords": "rhythm tree split join whole half quarter eighth sixteenth counting tutorial lesson",
    "tutorial": "rhythm-tree",
    "html": "<p>Learn how long notes last. Listen, split notes into smaller pieces, then build a short rhythm.</p>"
  },
  {
    "id": "time-signatures",
    "title": "Time signatures: 4/4, 6/8 & cut time",
    "shelf": "Hands-on lessons",
    "keywords": "time signatures meter bars beats pulse 4/4 6/8 2/2 cut time compound fishing",
    "tutorial": "time-signatures",
    "html": "<p>Learn to count music in groups. Start with 4/4, then try 6/8 and cut time.</p>"
  },
  {
    "id": "bass-clef",
    "title": "Bass clef",
    "shelf": "Hands-on lessons",
    "keywords": "bass clef lower notes lines spaces Great Big Dreams For America All Cows Eat Grass F landmark tutorial",
    "tutorial": "bass-clef",
    "html": "<p>Read lower notes one line or space at a time. Use Great Big Dreams For America for bass lines and All Cows Eat Grass for bass spaces, from bottom to top.</p>"
  },
  {
    "id": "grand-staff",
    "title": "Grand staff & Middle C",
    "shelf": "Hands-on lessons",
    "keywords": "grand staff treble bass middle c ledger line piano same note tutorial",
    "tutorial": "grand-staff",
    "html": "<p>Join treble and bass. Find the same Middle C on a little line below treble or above bass, then practise its neighbours.</p>"
  },
  {
    "id": "major-minor-keys",
    "title": "Major & minor keys",
    "shelf": "Hands-on lessons",
    "keywords": "major minor key scales home tonic bright mellow dramatic natural minor piano",
    "tutorial": "major-minor-keys",
    "html": "<p>Find music’s home note. Listen to major and minor, then try a little quiz.</p>"
  },
  {
    "id": "dynamics",
    "title": "Dynamics: loud & soft",
    "shelf": "Hands-on lessons",
    "keywords": "dynamics volume loud soft piano forte pianissimo fortissimo mezzo crescendo diminuendo decrescendo tutorial",
    "tutorial": "dynamics",
    "html": "<p>Hear the same tune soft and loud. Learn the signs for loudness, then try a little quiz.</p>"
  },
  {
    "id": "tempo",
    "title": "Tempo: fast & slow",
    "shelf": "Hands-on lessons",
    "keywords": "tempo speed beat pulse bpm beats per minute largo adagio andante moderato allegro presto accelerando ritardando tutorial",
    "tutorial": "tempo",
    "html": "<p>Hear the beat get faster and slower. Learn tempo words one step at a time, then try a little quiz.</p>"
  },
  {
    "id": "accidentals-key-signatures",
    "title": "Accidentals & key signatures",
    "shelf": "Hands-on lessons",
    "keywords": "accidentals key signatures sharp flat natural half step measure bar f sharp b flat g major f major d major",
    "supplemental": "accidentals-key-signatures",
    "html": "<p>Learn sharp, flat, and natural signs. Read the notes changed by a key signature.</p>"
  },
  {
    "id": "final-exam",
    "title": "Haydn’s Final Exam",
    "shelf": "Final exam",
    "keywords": "haydn final exam test quiz assessment all lessons note names rhythm meter bass grand staff major minor dynamics tempo",
    "exam": true,
    "html": "<p>Try a little from every lesson. Take your time, check your choices, and see which topics to practise next.</p>"
  },
  {
    "id": "pitch-race",
    "title": "Pitch Race: read, tap & hold",
    "shelf": "Rhythm & games",
    "keywords": "pitch race tap hold treble range streak classic endless level",
    "html": "<p>Notes move toward the clef. Name the <strong>first note coming toward it</strong>, then tap its letter before it reaches the clef.</p><h3>Read its place</h3><p>The notehead is the round part. Look at which line or space it sits on.</p><ul><li>Treble lines, bottom to top: <strong>E G B D F</strong>: Every Good Boy Does Fine.</li><li>Treble spaces, bottom to top: <strong>F A C E</strong>. The spaces spell FACE!</li></ul><p class=\"classroom-example\">The second space from the bottom is A. The middle line is B.</p><h3>Watch for a hold</h3><p>Tap short notes. When a hold note appears, keep the correct letter pressed until its progress finishes. A half note lasts two beats; a whole note lasts four beats.</p><h3>Build your streak</h3><p>A streak means getting several answers right in a row. Every ten correct answers increases your score boost. Take a careful look before you tap.</p><details><summary>Which game mode?</summary><ul><li><strong>Classic:</strong> a 60-second race.</li><li><strong>Endless:</strong> keep going until three mistakes.</li><li><strong>Level Challenge:</strong> reach the target before time runs out. A mistake costs one point.</li></ul><p>The cabinet shows which notes need a hold in the mode you choose.</p></details>",
    "quiz": {
      "question": "What is the treble staff’s middle line?",
      "answers": [
        "B",
        "A",
        "C"
      ],
      "correct": 0,
      "explanation": "The treble lines go E, G, B, D, F. B is the middle one."
    }
  },
  {
    "id": "music-triad",
    "title": "Music Triad: rhythm card battles",
    "shelf": "Rhythm & games",
    "keywords": "music triad card battle notes rests duration attack fermata conductor strategy",
    "html": "<p>Your cards have notes or rests on their sides. A <strong>rest</strong> means silence for a set amount of time.</p><h3>Your turn</h3><ol><li>Put a card in an empty square.</li><li>Look at the cards touching it: above, below, left, and right.</li><li>Compare the two sides that touch. Notes battle notes. Rests battle rests.</li><li>The side that lasts longer wins that battle and captures the other card. Equal lengths tie.</li></ol><p>Only the card you just placed attacks. In the 3 × 3 game, try to own more cards when all nine squares are full.</p><h3>Count the whole group</h3><p>Two eighth notes last as long as one quarter note. Four sixteenth notes do too!</p><p class=\"classroom-example\">Quarter note = two eighth notes = four sixteenth notes. They tie when their note sides meet.</p><p>A half note lasts longer than a quarter note, so it wins that matching battle.</p><h3>Watch the special cards</h3><p>A <strong>Fermata</strong> wins on its marked side. A <strong>Conductor</strong> flips nearby touching cards. Read the card’s message before you place it.</p><details><summary>Ready for the bigger board?</summary><p>Advanced mode uses 4 × 4 squares and more special cards. Follow the values printed for each card’s meter: half-note units in 2/2, quarter-note units in 4/4, and eighth-note units in 6/8.</p><p>Multi-Measure Rest captures touching rest sides. Quarter Note Fermata captures touching note sides. Subito removes one target. TURN flips its row and column but keeps your new card yours. Tacet removes a target and its neighbors above, below, left, and right.</p></details>",
    "quiz": {
      "question": "What happens when a quarter note faces two eighth notes on matching note sides?",
      "answers": [
        "They tie",
        "The quarter always wins",
        "The eighth notes always win"
      ],
      "correct": 0,
      "explanation": "Both sides last the same amount of time: one quarter-note beat."
    }
  },
  {
    "id": "rhythm-room",
    "title": "Rhythm Room: listen & repeat",
    "shelf": "Rhythm & games",
    "keywords": "rhythm room tap practice listen follow timing accuracy count in",
    "html": "<p>First, listen to a short pattern. Then tap it back. Each pattern fills two bars. Click the time signature on the staff to choose 4/4, cut time (2/2), or 6/8.</p><p>The <strong>beat</strong> is the steady pulse underneath the music. A <strong>bar</strong> is a group of beats. The examples below use 4/4: four quarter-note beats per bar.</p><h3>Try it in four steps</h3><ol><li>Listen through the count-in: <strong>1, 2, 3, 4</strong>.</li><li>Keep that steady beat in your head.</li><li>Tap once when each note begins.</li><li>Keep counting during rests, but stay silent.</li></ol><p>A long note still needs only one tap at its beginning. Extra taps count against your accuracy.</p><h3>Fit smaller notes between the beats</h3><p>For eighth notes, say <strong>1 &amp; 2 &amp; 3 &amp; 4 &amp;</strong>. For sixteenths, say <strong>1 e &amp; a</strong> in each beat.</p><p class=\"classroom-example\">Quarter note, quarter rest, two eighths, quarter note: tap on <strong>1</strong>, stay quiet on <strong>2</strong>, tap on <strong>3 &amp;</strong>, and tap on <strong>4</strong>.</p><p>In 6/8, feel two big beats. Three eighth notes count <strong>1 la li</strong>; quarter–eighth counts <strong>1 li</strong>. Counts under the staff follow the notes you see. Long notes keep the main beat numbers: a whole note in 4/4 counts <strong>1 2 3 4</strong>.</p><p>Use the top Tempo and Volume sliders. Settings holds the sound and count-in choices. Tap the big pad, or use Space or Enter when the pad is selected. Start slowly and speed up when the pattern feels comfortable.</p>",
    "quiz": {
      "question": "How should you perform a half note in Rhythm Room?",
      "answers": [
        "Tap once at its beginning",
        "Tap twice, once per beat",
        "Keep tapping until it ends"
      ],
      "correct": 0,
      "explanation": "Tap when the note starts. Count its two beats without adding another tap."
    }
  },
  {
    "id": "pitch",
    "title": "Pitch names & the piano",
    "shelf": "Pitch & intervals",
    "keywords": "letters sharp flat octave keyboard c d e f g a b",
    "html": "<p><strong>Pitch</strong> tells us how high or low a sound is. The musical alphabet has seven letters: <strong>A B C D E F G</strong>. After G, start again at A.</p><h3>Find C and F</h3><p>Black piano keys make groups of <strong>two</strong> and <strong>three</strong>.</p><ul><li><strong>C</strong> is the white key just left of two black keys.</li><li><strong>F</strong> is the white key just left of three black keys.</li></ul><p>Starting on C, the white keys go <strong>C D E F G A B C</strong>. The next C has the same letter name, but sounds higher.</p><h3>Choose a direction</h3><p>Move right for higher sounds. Move left for lower sounds.</p><p class=\"classroom-example\">Find two black keys. Touch the white key just to their left. You found C!</p><details><summary>What do sharps and flats mean?</summary><p>A <strong>sharp (♯)</strong> means the next piano key higher. A <strong>flat (♭)</strong> means the next key lower. Include black keys when you count these small steps.</p><p>E–F and B–C are neighboring white keys. There is no black key between them.</p></details>",
    "audio": [
      {
        "label": "Hear C major",
        "notes": [
          60,
          62,
          64,
          65,
          67,
          69,
          71,
          72
        ]
      }
    ],
    "quiz": {
      "question": "Which white key sits just left of two black keys?",
      "answers": [
        "C",
        "F",
        "A"
      ],
      "correct": 0,
      "explanation": "Find two black keys together. C is the white key just to their left."
    }
  },
  {
    "id": "staff",
    "title": "Read the musical staff",
    "shelf": "Pitch & intervals",
    "keywords": "treble bass clef staff lines spaces ledger middle c",
    "html": "<p>The <strong>staff</strong> is music’s ladder: five lines and four spaces. A note can sit on a line or in a space.</p><p>Count from the <strong>bottom</strong>. Every next line or space moves one letter up the musical alphabet.</p><h3>Treble clef</h3><ul><li>Lines, bottom to top: <strong>E G B D F</strong>: Every Good Boy Does Fine.</li><li>Spaces, bottom to top: <strong>F A C E</strong>. The spaces spell FACE.</li></ul><p class=\"classroom-example\">Start on the bottom line, E. The space just above it is F. The next line is G.</p><h3>Three helpful steps</h3><ol><li>Check which clef you are reading.</li><li>Find a note you already know.</li><li>Count each line and space until you reach the new note.</li></ol><p>A tiny extra line is called a <strong>ledger line</strong>. Middle C sits on the first little line below a treble staff.</p><details><summary>Try the bass clef next</summary><p>Bass clef helps us read lower sounds. Its lines go <strong>G B D F A</strong>, bottom to top: Great Big Dreams For America. Its spaces, bottom to top, go <strong>A C E G</strong>: “All Cows Eat Grass.”</p></details>",
    "quiz": {
      "question": "What are the treble-clef spaces, bottom to top?",
      "answers": [
        "F A C E",
        "A C E G",
        "E G B D F"
      ],
      "correct": 0,
      "explanation": "The treble spaces spell FACE from bottom to top. Start with F in the bottom space."
    }
  },
  {
    "id": "intervals",
    "title": "Intervals higher & lower",
    "shelf": "Pitch & intervals",
    "keywords": "interval second third fourth fifth sixth seventh octave semitone above below challenge",
    "html": "<p>An <strong>interval</strong> is the distance from one note to another.</p><h3>Count the letter names</h3><p>Count the first note as 1. From C to E, count <strong>C (1), D (2), E (3)</strong>. That is a third.</p><p>From C to G, count C, D, E, F, G. Five letter names make a fifth.</p><h3>Big and small steps</h3><p>A <strong>half step</strong> moves to the very next piano key, including black keys. A <strong>whole step</strong> is two half steps.</p><table><thead><tr><th>Chopin asks for…</th><th>Move this many half steps</th></tr></thead><tbody><tr><td>Minor second / major second</td><td>1 / 2</td></tr><tr><td>Minor third / major third</td><td>3 / 4</td></tr><tr><td>Perfect fourth</td><td>5</td></tr><tr><td>Perfect fifth</td><td>7</td></tr><tr><td>Octave: the next same-letter note</td><td>12</td></tr></tbody></table><h3>Try Chopin’s challenge</h3><ol><li>Find and play his starting key.</li><li>Move right for higher, or left for lower.</li><li>Count the key moves. Your starting key is zero moves.</li><li>Stand on your answer and press E, or use the touch Play note button.</li></ol><p class=\"classroom-example\">A perfect fifth above C is G. It is seven half-step moves to the right.</p>",
    "audio": [
      {
        "label": "Hear a major third up",
        "notes": [
          60,
          64
        ]
      },
      {
        "label": "Hear a perfect fifth down",
        "notes": [
          72,
          65
        ]
      }
    ],
    "quiz": {
      "question": "A perfect fifth above C is…",
      "answers": [
        "G",
        "F",
        "E"
      ],
      "correct": 0,
      "explanation": "Count seven half-step moves to the right from C. You land on G."
    }
  },
  {
    "id": "triads",
    "title": "Three-note chords",
    "shelf": "Chords & composing",
    "keywords": "triad chord major minor diminished augmented root third fifth inversion",
    "html": "<p>A <strong>chord</strong> is a group of notes played together. A <strong>triad</strong> is a chord with three notes.</p><h3>Build a C major chord</h3><ol><li>Start on C. This is the chord’s home note, called its <strong>root</strong>.</li><li>Skip D and add E.</li><li>Skip F and add G.</li></ol><p>Now play <strong>C E G</strong> together. Listen to how the notes work as a team.</p><h3>Try a new sound</h3><p>To change C major into C minor, move E one small key step lower, to E♭. Keep C and G.</p><p class=\"classroom-example\">C major: <strong>C E G</strong>.<br>C minor: <strong>C E♭ G</strong>.</p><details><summary>Two more chord colors</summary><p>C diminished uses C E♭ G♭. C augmented uses C E G♯. Change one note, listen, and compare.</p></details>",
    "audio": [
      {
        "label": "Hear C major chord",
        "notes": [
          60,
          64,
          67
        ],
        "chord": true
      },
      {
        "label": "Hear C minor chord",
        "notes": [
          60,
          63,
          67
        ],
        "chord": true
      }
    ],
    "quiz": {
      "question": "Which notes make C minor?",
      "answers": [
        "C E♭ G",
        "C E G",
        "C E♭ G♭"
      ],
      "correct": 0,
      "explanation": "Start with C major, C E G. Move only E down to E♭."
    }
  },
  {
    "id": "rhythm",
    "title": "Rhythm, rests & counting",
    "shelf": "Rhythm & games",
    "keywords": "rhythm beat note duration whole half quarter eighth sixteenth rest dotted tie subdivision tempo",
    "html": "<p>The <strong>beat</strong> is a steady pulse you can tap with your foot. <strong>Rhythm</strong> is the pattern you clap over that pulse.</p><p>For this lesson, each quarter note lasts one beat.</p><table><thead><tr><th>Note</th><th>How long?</th></tr></thead><tbody><tr><td>Whole</td><td>4 beats</td></tr><tr><td>Half</td><td>2 beats</td></tr><tr><td>Quarter</td><td>1 beat</td></tr><tr><td>Eighth</td><td>Half of a beat</td></tr><tr><td>Sixteenth</td><td>A quarter of a beat</td></tr></tbody></table><h3>Make a rhythm tree</h3><p>Split a whole note into two half notes. Split each half into two quarters. Keep splitting to find eighths and sixteenths. Every row fills the same amount of time.</p><h3>Count smaller notes</h3><ul><li>Quarters: <strong>1 2 3 4</strong>.</li><li>Eighths: <strong>1 &amp; 2 &amp; 3 &amp; 4 &amp;</strong>.</li><li>Four sixteenths in one beat: <strong>1 e &amp; a</strong>.</li></ul><p>A <strong>rest</strong> means stay quiet for that amount of time. Keep the beat going in your head.</p><p class=\"classroom-example\">Try clapping four quarters. Now clap eight eighths in the same four beats. The beat stays steady while your claps get closer together.</p>",
    "quiz": {
      "question": "How many eighth notes equal one quarter note?",
      "answers": [
        "2",
        "3",
        "4"
      ],
      "correct": 0,
      "explanation": "Two eighth notes fit in the time of one quarter-note beat."
    }
  },
  {
    "id": "meter",
    "title": "Beats, bars & time signatures",
    "shelf": "Rhythm & games",
    "keywords": "meter bar measure 4/4 3/4 6/8 2/2 cut time compound simple time signature",
    "html": "<p>We often count beats in small groups. One group is a <strong>bar</strong>, also called a measure.</p><h3>Start with 4/4</h3><p>In 4/4, count <strong>1 2 3 4</strong>, then start again at 1. Each bar holds four quarter-note beats.</p><ul><li><strong>2/4:</strong> count 1 2.</li><li><strong>3/4:</strong> count 1 2 3.</li><li><strong>4/4:</strong> count 1 2 3 4.</li></ul><p class=\"classroom-example\">In 4/4, two half notes fill a bar: 2 beats + 2 beats = 4 beats.</p><h3>What about 6/8?</h3><p>A 6/8 bar holds six eighth notes. Usually we group them in threes: <strong>ONE two three FOUR five six</strong>. That gives two big beats, each made of three little sounds.</p><p>Try swaying twice while counting all six little sounds. In 3/4, you usually feel three steady beats instead.</p><h3>Cut time: 2/2</h3><p>A C with a vertical line through it means <strong>2/2</strong>, or cut time. Count <strong>ONE-and, TWO-and</strong>. Each big beat is a half note, so two half-note beats fill a bar.</p><p><strong>Tempo</strong> means speed. Changing tempo makes the beat faster or slower. The time signature tells you how to group it.</p>",
    "quiz": {
      "question": "In the usual 6/8 feel, how many big beats are in a bar?",
      "answers": [
        "2",
        "3",
        "6"
      ],
      "correct": 0,
      "explanation": "Group the six eighth notes as three plus three. That makes two big beats."
    }
  },
  {
    "id": "piano",
    "title": "Prepare for Chopin",
    "shelf": "Pitch & intervals",
    "keywords": "piano chopin melody scale major minor key memory twinkle mary london bridge notes game free play e",
    "html": "<p>In <strong>free play</strong>, walk across Piano Lab’s big keys to make music. The back wall shows each note’s letter name. You can switch the key labels on or off.</p><h3>When a game begins</h3><p>Walking stays quiet so you can pass over keys. Stand on the key you want, then press <strong>E</strong> or tap <strong>Play note</strong>. Each press gives one answer.</p><h3>Try a familiar tune</h3><ul><li><strong>Twinkle, Twinkle:</strong> C C G G A A G.</li><li><strong>Mary Had a Little Lamb:</strong> E D C D E E E.</li><li><strong>London Bridge:</strong> G A G F E F G.</li></ul><p>Play the same key again when you see a repeated letter. You can take your time; Chopin checks the notes in order.</p><h3>Choose a challenge</h3><p><strong>Melody:</strong> play the tune from its beginning.<br><strong>Scale:</strong> choose a major or natural minor key. Go up to its next home note, then back down.<br><strong>Interval:</strong> play Chopin’s starting note, then find a note the right distance higher or lower.</p><h3>Try it from memory</h3><p>After learning a melody or scale with help, try its memory challenge for extra Notes. Listen first. Then play without the next key lighting up.</p><p>Finish a new challenge to earn Notes for Riff’s shop. You can replay it for practice after collecting its reward.</p>",
    "audio": [
      {
        "label": "Hear Twinkle’s opening",
        "notes": [
          60,
          60,
          67,
          67,
          69,
          69,
          67
        ]
      },
      {
        "label": "Hear Mary’s opening",
        "notes": [
          64,
          62,
          60,
          62,
          64,
          64,
          64
        ]
      }
    ],
    "quiz": {
      "question": "During a Chopin game, how do you submit a floor-piano key?",
      "answers": [
        "Stand on it and press E",
        "Walk past it",
        "Press Jump"
      ],
      "correct": 0,
      "explanation": "Stand on the key, then press E or tap Play note."
    }
  },
  {
    "id": "song-machine",
    "title": "Make a tune in Song Machine",
    "shelf": "Chords & composing",
    "keywords": "song machine grid notes drums duration bpm clef score save load undo instruments composition",
    "html": "<p>Song Machine is your music sketchbook. Make a short idea, listen, and change anything you like.</p><h3>Your first tune</h3><ol><li>Choose how long your note should last.</li><li>Tap or click a grid square to add a note. Higher rows make higher sounds.</li><li>Add a few more notes, then press <strong>Play</strong>.</li><li>Press <strong>Stop</strong> when you want to edit. <strong>Undo</strong> takes back your last change.</li></ol><p>On a phone, swipe to see more of the grid. Choose <strong>Draw notes</strong> to drag a note longer.</p><h3>Add another musical part</h3><p>Use <strong>Add instrument</strong> for another track. A track is one instrument’s part. Try a low bass part, or use the three drum rows below the pitched tracks.</p><p class=\"classroom-example\">Try C E G as your first three notes. Listen, move one note, and hear what changes.</p><h3>Helpful settings</h3><p><strong>Tempo</strong> changes speed. A <strong>scale</strong> chooses a set of note rows to show. Hidden notes stay in your song. In 4/4, sixteen little grid squares fill one bar.</p><p>Open Settings for bars, scale, import, and the save/account controls. You can load a saved composition into DJ Coda’s jukebox.</p><p>To clear a track, hold its Clear button for three seconds. Undo can bring the notes back.</p>",
    "quiz": {
      "question": "In Song Machine’s 4/4 grid, how many sixteenth-note squares fill a bar?",
      "answers": [
        "16",
        "4",
        "8"
      ],
      "correct": 0,
      "explanation": "One beat holds four sixteenths. Four beats hold sixteen squares."
    }
  }
]);
  const SHELVES=Object.freeze([
    {id:'pitch',label:'Pitch & intervals',x:58,y:80,w:216,h:190,topic:'pitch',approach:{x:175,y:315}},
    {id:'chords',label:'Chords & composing',x:724,y:80,w:215,h:190,topic:'triads',approach:{x:825,y:315}},
    {id:'rhythm',label:'Rhythm & games',x:734,y:320,w:230,h:175,topic:'rhythm',approach:{x:680,y:430}}
  ]);
  const EXIT=Object.freeze({id:'arcade-exit',x:500,y:560,radius:40});
  const HAYDN=Object.freeze({id:'haydn',name:'Professor Haydn',x:499,y:305,facing:'down',activity:'idle',appearance:{name:'Professor Haydn',skin:'#ebbea0',hair:'#e5ddd0',hairstyle:'powderwig',outfit:'coat',shirt:'#62806e',lowerColor:'#3e4654',shoes:'oxfords',accessory:'score',headwear:'none',eyewear:'round'}});
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  function topicFor(id){return TOPICS.find(topic=>topic.id===id)||TOPICS[0];}
  function createCodaMusicClassroom(api={}){
    const host=api.host;if(!host)throw new Error('Music classroom needs a host element.');
    const doc=host.ownerDocument,win=doc.defaultView||root,renderer=api.renderer;
    let tutorial=null,finalExam=null,extraLesson=null,learningPath=null;
    let educationReady=!api.educationContentReady,contentSelection=0;const educationContentReady=Promise.resolve(api.educationContentReady).then(()=>{educationReady=true;},()=>{educationReady=true;});
    let leftViaDoor=false;
    let opened=false,destroyed=false,priorFocus=null,selected='welcome',frame=0,last=0,clock=0,walking=false,near=null,destination=null,audio=null,voices=[],audioTimers=[];
    let mobileView='room',settingsOpen=false,roomCamera=null,fullscreen=null;const touchHeld=new Set(),mobileLayout=()=>win.matchMedia?.('(max-width:760px), (pointer:coarse)').matches===true;
    const joystick={x:0,y:0};
    const companion=win.CodaPetCompanion?.create({getProfile:api.getAvatar,reducedMotion:()=>win.matchMedia?.('(prefers-reduced-motion:reduce)').matches===true});
    const clearJoystick=()=>{joystick.x=joystick.y=0;};
    const joystickState=()=>({...joystick,strength:Math.hypot(joystick.x,joystick.y),active:!!(joystick.x||joystick.y)});
    const keys=new Set(),player={x:500,y:510,facing:'up',phase:0};
    host.classList.add('music-classroom');host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-labelledby','classroomTitle');
    host.innerHTML=`<div class="classroom-shell"><header class="classroom-heading"><div><h1 id="classroomTitle">Classroom</h1></div><div class="classroom-heading-actions"><button id="classroomBackRoom" type="button" hidden>← Room</button><button id="classroomAllLessons" type="button" hidden>Lessons</button><button id="classroomFullscreen" type="button" aria-pressed="false">Fullscreen</button><button id="classroomSettingsButton" type="button" aria-haspopup="dialog" aria-controls="classroomSettingsPanel" aria-expanded="false">Menu</button><button id="classroomClose" type="button" aria-label="Return to arcade">← Arcade</button></div></header><section class="classroom-room" aria-label="Walkable music classroom"><div class="classroom-canvas-viewport"><canvas id="classroomCanvas" width="1000" height="600" tabindex="0" aria-label="Music classroom. Walk with WASD or arrows. Press E to talk to Haydn, read a shelf, or leave through the bottom doorway. Use the joystick or drag on the floor to steer; lift to stop. Talk to Haydn to choose a lesson. Pinch two fingers or use Settings to zoom."></canvas></div></section><p class="classroom-professor-message" id="classroomStatus" role="status" aria-live="polite">Haydn: “Welcome! Choose lesson 1 below to get started.”</p><section id="classroomBooks" class="classroom-books" hidden><section id="classroomStart" class="classroom-learning-path" tabindex="-1" aria-labelledby="classroomStartTitle"><h2 id="classroomStartTitle">Choose a lesson</h2><p>Choose a category. Start with its first short lesson.</p><div class="classroom-lesson-shortcuts" role="group" aria-label="Hands-on music lessons"><button type="button" data-start-lesson="note-naming"><strong>1. Note names</strong></button><button type="button" data-start-lesson="rhythm-tree"><strong>2. Rhythm</strong></button><button type="button" data-start-lesson="time-signatures"><strong>3. Time signatures</strong></button><button type="button" data-start-lesson="bass-clef"><strong>4. Bass clef</strong></button><button type="button" data-start-lesson="grand-staff"><strong>5. Grand staff &amp; Middle C</strong></button><button type="button" data-start-lesson="major-minor-keys"><strong>6. Major &amp; minor keys</strong></button><button type="button" data-start-lesson="dynamics"><strong>7. Dynamics: loud &amp; soft</strong></button><button type="button" data-start-lesson="tempo"><strong>8. Tempo: fast &amp; slow</strong></button><button type="button" data-start-lesson="accidentals-key-signatures"><strong>9. Accidentals &amp; key signatures</strong></button></div><section class="classroom-final-exam-card" aria-label="Ready for a challenge?"><h3>Ready for a challenge?</h3><p>Try a little from every lesson. No timer.</p><button id="classroomFinalExam" type="button">Haydn’s Final Exam</button></section><button id="classroomBrowseBooks" type="button">Look up a music word</button></section><main class="classroom-library"><nav aria-label="Classroom books"><h2>Look something up</h2><p class="classroom-reference-help">Optional help with music words and games.</p><label class="classroom-search">Find a topic<input id="classroomSearch" type="search" placeholder="Try piano, notes, or rhythm"></label><div class="classroom-topic-list" id="classroomTopics"></div></nav><article id="classroomBook" class="classroom-book" tabindex="-1" aria-labelledby="classroomBookTitle"></article></main></section></div><div id="classroomSettingsBackdrop" class="classroom-settings-backdrop" hidden><section id="classroomSettingsPanel" class="classroom-settings-panel" role="dialog" aria-modal="true" aria-labelledby="classroomSettingsTitle"><div class="classroom-settings-heading"><h2 id="classroomSettingsTitle">Classroom settings</h2><button id="classroomSettingsClose" type="button">Done</button></div><p>Zoom in for a closer look at the room. On a phone, you can also pinch the room with two fingers.</p><div id="classroomZoomTools"></div></section></div>`;
    const el=id=>host.querySelector('#'+id),canvas=el('classroomCanvas');
    if(api.openHistory){const history=doc.createElement('button');history.type='button';history.id='haydnHistory';history.textContent='Haydn · Tell me some music history';history.onclick=()=>api.openHistory();el('classroomStart').prepend(history);}let g=canvas.getContext('2d');
    const fingerWalk=win.createCodaFingerWalk?.({canvas,enabled:()=>opened&&!settingsOpen&&mobileLayout()&&mobileView==='room',onStart:()=>{clearJoystick();keys.clear();destination=null;walking=false;},onStop:()=>{destination=null;walking=false;},onPinch:gesture=>roomCamera?.onPinch(gesture)})||null;
    const Camera=win.createCodaRoomCamera||win.createCodaCaveCamera;
    if(Camera){roomCamera=Camera({canvas,width:1000,height:600,viewportElement:host.querySelector('.classroom-canvas-viewport'),label:'Classroom',className:'classroom-camera-controls',initialMobileZoom:1,maxZoom:3,enabled:()=>opened&&mobileView==='room',getFocus:()=>player,getGestureState:()=>fingerWalk?.getState(),onGestureStart:()=>{clearJoystick();keys.clear();touchHeld.clear();destination=null;walking=false;}});const controls=host.querySelector('.classroom-camera-controls');if(controls)el('classroomZoomTools').append(controls);}
    function worldPoint(clientX,clientY){if(roomCamera)return roomCamera.toWorld(clientX,clientY);const box=canvas.getBoundingClientRect();return{x:(clientX-box.left)*1000/box.width,y:(clientY-box.top)*600/box.height};}
    function openSettings(){if(!opened||mobileView!=='room')return;clearKeys();settingsOpen=true;el('classroomSettingsBackdrop').hidden=false;el('classroomSettingsButton').setAttribute('aria-expanded','true');roomCamera?.update();el('classroomSettingsClose').focus({preventScroll:true});api.onViewChange?.(mobileView);}
    function closeSettings(focus=true){if(!settingsOpen)return;settingsOpen=false;el('classroomSettingsBackdrop').hidden=true;el('classroomSettingsButton').setAttribute('aria-expanded','false');clearKeys();if(focus&&opened)canvas.focus({preventScroll:true});api.onViewChange?.(mobileView);}
    const background=doc.createElement('canvas');background.width=1000;background.height=600;let backgroundReady=false,backgroundImage=null;
    if(api.backgroundSrc){backgroundImage=new win.Image();backgroundImage.onload=()=>{if(opened)draw();};backgroundImage.src=api.backgroundSrc;}
    function getArtworkSource(){if(backgroundImage?.complete&&backgroundImage.naturalWidth)return backgroundImage;if(backgroundImage?.decode)return backgroundImage.decode().then(()=>backgroundImage);return backgroundReady?background:null;}
    function artworkBackground(){const source=backgroundImage?.complete&&backgroundImage.naturalWidth?backgroundImage:backgroundReady?background:null;return api.getArtworkBackground?.(source)||source;}
    function status(text){el('classroomStatus').textContent=text;}
    function setMobileView(view,focus=false){
      if(!['room','books'].includes(view))return;closeSettings(false);if(view==='room'){stopAudio();finalExam?.close();}releaseControls();clearKeys();mobileView=view;host.dataset.mobileView=view;el('classroomSettingsButton').hidden=view!=='room';el('classroomBackRoom').hidden=view==='room';el('classroomAllLessons').hidden=view==='room'||selected==='welcome';host.querySelector('.classroom-room').hidden=view!=='room';host.querySelector('.classroom-room').inert=view!=='room';el('classroomBooks').hidden=view!=='books';el('classroomBooks').inert=view!=='books';
      for(const button of host.querySelectorAll('[data-classroom-view]'))button.setAttribute('aria-pressed',String(button.dataset.classroomView===view));
      if(focus){host.scrollTop=0;(view==='room'?canvas:el('classroomStart').hidden?el('classroomBook'):el('classroomStart')).focus({preventScroll:true});}
      api.onViewChange?.(view);
    }
    function lessonTitle(topic){return win.CodaEducationContent?.getLesson?.(topic.tutorial||topic.supplemental)?.title||topic.title;}
    function listTopics(){
      const query=el('classroomSearch').value.trim().toLocaleLowerCase(),list=el('classroomTopics');list.replaceChildren();
      const matches=TOPICS.filter(topic=>(lessonTitle(topic)+' '+topic.keywords+' '+topic.shelf).toLocaleLowerCase().includes(query));
      for(const topic of matches){const button=doc.createElement('button');button.type='button';button.dataset.topic=topic.id;button.setAttribute('aria-current',String(topic.id===selected));const label=doc.createElement('span');label.textContent=lessonTitle(topic);const shelf=doc.createElement('small');shelf.textContent=topic.shelf;button.append(label,shelf);button.onclick=()=>selectTopic(topic.id,true);list.append(button);}
      host.querySelectorAll('[data-start-lesson]').forEach((button,index)=>{const topic=topicFor(button.dataset.startLesson),label=button.querySelector('strong');if(label)label.textContent=(index+1)+'. '+lessonTitle(topic);});
      if(!matches.length){const p=doc.createElement('p');p.className='classroom-no-results';p.textContent='No matching books. Try another word.';list.append(p);}
    }
    function selectTopic(id,focus=false,options={}){
      const topic=topicFor(id),selection=++contentSelection;selected=topic.id;host.dataset.topic=topic.id;el('classroomAllLessons').hidden=mobileView==='room'||topic.id==='welcome';host.dataset.lessonActive=String(!!topic.tutorial||!!topic.exam||!!topic.supplemental);host.dataset.referenceOpen='false';stopAudio();tutorial?.destroy();tutorial=null;extraLesson?.destroy();extraLesson=null;learningPath?.destroy();learningPath=null;finalExam?.destroy();finalExam=null;el('classroomStart').hidden=topic.id!=='welcome';
      const article=el('classroomBook');article.hidden=topic.id==='welcome';article.innerHTML='<h2 id="classroomBookTitle"'+(topic.tutorial||topic.exam||topic.supplemental?' class="classroom-lesson-context"':'')+'></h2>'+(topic.tutorial||topic.exam||topic.supplemental?'':'<p class="classroom-book-kicker"></p>'+topic.html);
      const kicker=article.querySelector('.classroom-book-kicker');if(kicker)kicker.textContent=topic.shelf.toUpperCase();el('classroomBookTitle').textContent=topic.title;
      if(topic.id==='welcome'){listTopics();status('Haydn: “Start with Note names. We’ll take one small step at a time.”');if(focus){setMobileView('books');el('classroomStart').focus({preventScroll:true});el('classroomStart').scrollIntoView({behavior:'auto',block:'start'});}return;}
      if((topic.tutorial||topic.exam||topic.supplemental)&&!educationReady){const waiting=doc.createElement('p');waiting.setAttribute('role','status');waiting.textContent=topic.exam?'Loading exam…':'Loading lesson…';article.append(waiting);listTopics();if(focus)setMobileView('books');educationContentReady.then(()=>{if(!destroyed&&opened&&selected===topic.id&&contentSelection===selection)selectTopic(topic.id,focus,options);});return;}
      if(topic.tutorial||topic.supplemental)el('classroomBookTitle').textContent=win.CodaEducationContent?.getLesson?.(topic.tutorial||topic.supplemental)?.title||topic.title;
      if((topic.tutorial||topic.supplemental)&&win.CodaClassroomLearningPaths&&!options.practice){
        const mount=doc.createElement('div');article.append(mount);
        el('classroomBookTitle').textContent=lessonTitle(topic);
        learningPath=win.CodaClassroomLearningPaths.create({host:mount,lessonId:topic.tutorial||topic.supplemental,storage:api.storage,canRecord:api.canRecord,content:win.CodaEducationContent,onComplete:(id,details)=>api.onTutorialComplete?.(id,details),onExit:()=>selectTopic('welcome',true),onPractice:topic.tutorial?()=>selectTopic(topic.id,true,{practice:true}):undefined});
        learningPath.open(options);
        listTopics();status('Haydn: “One small lesson at a time. Start with the first one.”');
        if(focus){setMobileView('books');article.focus({preventScroll:true});article.scrollIntoView({behavior:'auto',block:'start'});}return;
      }
      if(topic.id==='staff'&&win.CodaMusicNotation){const figure=doc.createElement('figure');figure.className='classroom-staff-example';figure.innerHTML=win.CodaMusicNotation.staffSVG(0,{label:'An E on the bottom line of a treble staff'});const caption=doc.createElement('figcaption');caption.textContent='E sits on the bottom treble line. Move up one line or space at a time to F, G, A, B, C, D, E, F.';figure.append(caption);article.append(figure);win.CodaMusicNotation.load(doc);}
      if(topic.supplemental){
        const mount=doc.createElement('div');article.append(mount);
        if(win.CodaAccidentalsLesson){extraLesson=win.CodaAccidentalsLesson.create({host:mount,storage:api.storage,canRecord:api.canRecord,onComplete:(id,details)=>api.onTutorialComplete?.(id,details),onExit:()=>selectTopic('welcome',true)});extraLesson.open?.();}
        else{mount.textContent='This lesson could not load. Reload the game and reopen the classroom.';mount.setAttribute('role','status');}
        listTopics();status('Haydn: “Let’s read the signs one step at a time.”');
        if(focus){setMobileView('books');article.focus({preventScroll:true});article.scrollIntoView({behavior:'auto',block:'start'});}return;
      }
      if(topic.tutorial){
        const mount=doc.createElement('div');article.append(mount);
        if(options.practice&&win.CodaClassroomLearningPaths){const back=doc.createElement('button');back.type='button';back.textContent='← '+(win.CodaClassroomLearningPathsData?.CATEGORIES?.find(category=>category.id===topic.id)?.title||topic.title)+' lessons';back.dataset.practiceBack='';back.onclick=()=>selectTopic(topic.id,true);article.insertBefore(back,mount);}
        if(win.CodaClassroomTutorials){tutorial=win.CodaClassroomTutorials.create({host:mount,storage:api.storage,canRecord:api.canRecord,requireExamCurriculum:api.requireExamCurriculum,onComplete:(id,details)=>api.onTutorialComplete?.(id,details)});tutorial.open(topic.tutorial,options);}
        else mount.textContent='This lesson is still loading. Reopen the classroom in a moment.';
        listTopics();status('Haydn: “Let’s try '+topic.title.toLowerCase()+' together.”');
        if(focus){setMobileView('books');article.focus({preventScroll:true});article.scrollIntoView({behavior:'auto',block:'start'});}return;
      }
      if(topic.exam){
        const mount=doc.createElement('div');article.append(mount);
        if(win.CodaFinalExam){finalExam=win.CodaFinalExam.create({host:mount,storage:api.storage,canRecord:api.canRecord,onComplete:(id,details)=>api.onFinalExamComplete?.(id,details),onExit:()=>selectTopic('welcome',true),onStudy:lessonId=>selectTopic(lessonId,true,{study:true})});finalExam.open();}
        else mount.textContent='The exam is still loading. Reopen the classroom in a moment.';
        listTopics();status('Haydn: “Take your time. You can save and come back.”');
        if(focus){setMobileView('books');article.focus({preventScroll:true});article.scrollIntoView({behavior:'auto',block:'start'});}return;
      }
      if(topic.audio){const controls=doc.createElement('div');controls.className='classroom-listen';for(const example of topic.audio){const button=doc.createElement('button');button.type='button';button.textContent='♫ '+example.label;button.onclick=()=>playExample(example);controls.append(button);}const stop=doc.createElement('button');stop.type='button';stop.textContent='Stop example';stop.onclick=stopAudio;controls.append(stop);article.append(controls);}
      const quiz=topic.quiz,check=doc.createElement('section');check.className='classroom-check';check.setAttribute('aria-label','Check your understanding');const heading=doc.createElement('h3');heading.textContent='Quick check';const question=doc.createElement('p');question.textContent=quiz.question;const answers=doc.createElement('div');answers.className='classroom-answers';const feedback=doc.createElement('p');feedback.className='classroom-feedback';feedback.setAttribute('role','status');
      quiz.answers.forEach((answer,index)=>{const button=doc.createElement('button');button.type='button';button.textContent=answer;button.onclick=()=>{const correct=index===quiz.correct;feedback.dataset.correct=String(correct);feedback.textContent=(correct?'Haydn: “Exactly! ':'Haydn: “Try again. ')+quiz.explanation+'”';};answers.append(button);});
      check.append(heading,question,answers,feedback);article.append(check);listTopics();status('Haydn: “'+topic.title+'. A fine place to begin.”');if(focus){setMobileView('books');article.focus({preventScroll:true});article.scrollIntoView({behavior:'auto',block:'start'});}
    }
    function stopAudio(){tutorial?.stopAudio();learningPath?.stopAudio();extraLesson?.stopAudio?.();finalExam?.stopAudio();for(const timer of audioTimers)win.clearTimeout(timer);audioTimers=[];for(const voice of voices)try{voice.stop();}catch{}voices=[];if(audio){audio.close().catch(()=>{});audio=null;}}
    function playExample(example){
      stopAudio();const Constructor=api.AudioContext||win.AudioContext||win.webkitAudioContext;
      if(!Constructor){status('Audio is unavailable. The written note examples are ready to study.');return;}
      try{audio=new Constructor();const context=audio;context.resume().catch(()=>status('Tap the example button again to enable audio.'));const begin=context.currentTime+.04,step=.42;
        for(let i=0;i<example.notes.length;i++){const oscillator=context.createOscillator(),gain=context.createGain(),at=begin+(example.chord?0:i*step);oscillator.type='triangle';oscillator.frequency.value=440*2**((example.notes[i]-69)/12);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(example.chord?.07:.11,at+.015);gain.gain.exponentialRampToValueAtTime(.0001,at+(example.chord?1.2:.36));oscillator.connect(gain).connect(context.destination);oscillator.start(at);oscillator.stop(at+(example.chord?1.3:.4));voices.push(oscillator);}
        status(example.label+'. Follow the notes in the book.');audioTimers.push(win.setTimeout(stopAudio,((example.chord?1.4:example.notes.length*step+.2)*1000)));
      }catch{stopAudio();status('Audio could not start. You can still study every written example.');}
    }
    function passable(x,y){return x>=35&&x<=965&&y>=285&&y<=575&&(y<=520||x>=445&&x<=555)&&!(x>395&&x<598&&y<373)&&!SHELVES.some(shelf=>x>shelf.x-12&&x<shelf.x+shelf.w+12&&y>shelf.y-5&&y<shelf.y+shelf.h+20);}
    function nearest(){
      let closest={type:'professor',id:'haydn',x:HAYDN.x,y:HAYDN.y+40,distance:Math.hypot(player.x-HAYDN.x,player.y-HAYDN.y-40)};
      for(const shelf of SHELVES){const distance=Math.hypot(player.x-shelf.approach.x,player.y-shelf.approach.y);if(distance<closest.distance)closest={type:'shelf',id:shelf.id,x:shelf.approach.x,y:shelf.approach.y,distance};}
      const exitDistance=Math.hypot(player.x-EXIT.x,player.y-EXIT.y);if(exitDistance<=EXIT.radius&&exitDistance<closest.distance)closest={type:'exit',id:EXIT.id,x:EXIT.x,y:EXIT.y,distance:exitDistance};
      return closest.distance<110?closest:null;
    }
    function interact(){near=nearest();if(!near){status('Walk to Haydn or a bookshelf. Press E to talk or read.');return;}if(near.type==='exit'){leftViaDoor=true;close();return;}if(near.type==='professor')selectTopic('welcome',true);else{const shelf=SHELVES.find(item=>item.id===near.id);selectTopic(shelf.topic,true);}}
    function rect(x,y,w,h,color){g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),w,h);}
    function text(value,x,y,size,color){g.fillStyle=color;g.font='bold '+size+'px monospace';g.textAlign='center';g.fillText(value,x,y);}
    function drawShelf(shelf,index){
      const {x,y,w,h}=shelf;rect(x-5,y-5,w+10,h+10,'#121829');rect(x,y,w,h,'#744b58');rect(x+8,y+6,w-16,h-12,'#302e43');
      const rows=index===2?2:3,rowH=(h-18)/rows;
      for(let row=0;row<rows;row++){const by=y+12+row*rowH;for(let book=0;book<13;book++){const bx=x+13+book*15,bh=22+(book*7+row*11)%18,color=['#9d6687','#a59158','#688c91','#7762a1','#9e6c56'][(book+row*2+index)%5];rect(bx,by+rowH-bh-8,10,bh,color);rect(bx+2,by+rowH-bh-4,1,bh-7,'#ffffff38');rect(bx+2,by+rowH-15,6,2,'#e8d8a2');}rect(x+5,by+rowH-5,w-10,8,'#a87a75');rect(x+5,by+rowH-5,w-10,2,'#d8a6a0');}
      rect(x+13,y-25,w-26,21,'#243644');text(shelf.label.toUpperCase(),x+w/2,y-10,10,'#c6efe4');
    }
    function drawBackground(){
      g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.imageSmoothingEnabled=false;
      rect(0,0,1000,600,'#111728');rect(25,35,950,540,'#343248');rect(35,45,930,225,'#333850');
      for(let y=45;y<265;y+=34){rect(35,y,930,1,'#4d4b65');for(let x=35+(y%68?0:34);x<965;x+=68)rect(x,y,1,34,'#4d4b65');}
      rect(35,270,930,295,'#122956');for(let x=35;x<965;x+=24){rect(x,270,1,295,'#3e63a7');for(let y=270;y<565;y+=24)rect(x,y,24,1,'#3e63a7');}
      // Pixel trim, reflected neon strips, and hanging lanterns are cached once.
      rect(19,29,962,10,'#161b39');rect(20,28,960,3,'#cf62db');rect(25,38,950,6,'#466d9d');rect(25,260,950,13,'#1a335e');rect(25,260,950,3,'#a767d8');rect(20,565,960,13,'#192f51');rect(20,565,960,3,'#7264af');
      for(const x of [41,305,685,951]){rect(x,50,9,248,'#1c284a');rect(x,50,2,248,'#568ebc');for(let y=52;y<296;y+=40)rect(x,y,9,2,'#91a9cb');}
      for(const x of [40,310,690,950]){const halo=g.createRadialGradient(x,83,0,x,83,55);halo.addColorStop(0,'#ffca6560');halo.addColorStop(1,'#ffad4c00');g.fillStyle=halo;g.fillRect(x-55,28,110,110);rect(x-2,41,4,23,'#9b5e68');rect(x-10,63,20,32,'#a14a73');rect(x-7,67,14,24,'#ffce7d');rect(x-4,69,8,20,'#fff2b1');rect(x-11,94,22,4,'#e09572');}
      for(let x=74;x<950;x+=139){rect(x,317,3,235,'#ad62e81f');rect(x-3,340,9,160,'#3e8ff915');rect(x-1,350,5,90,'#66dbff22');}
      for(const [x,y] of [[85,535],[631,535],[674,380],[310,390],[930,541]]){rect(x-1,y-1,4,4,'#567de9');rect(x,y,2,2,'#9eedff');}
      rect(315,80,370,155,'#192145');rect(320,85,360,145,'#ad789d');rect(320,85,360,3,'#e2a9dc');rect(327,92,346,131,'#182f36');rect(335,98,330,2,'#8bc7b5');text('THE MUSIC CLASSROOM',500,125,18,'#dcf5db');text('Listen. Count. Try. Learn.',500,158,15,'#c8d8c4');text('PROFESSOR HAYDN',500,197,12,'#e9cf9a');
      drawShelf(SHELVES[0],0);drawShelf(SHELVES[1],1);drawShelf(SHELVES[2],2);
      rect(297,407,296,126,'#101e3a');rect(300,410,290,120,'#744b8d');rect(309,419,272,102,'#3f3a6b');rect(320,430,250,80,'#4b426f');for(let x=330;x<570;x+=24)rect(x,435,2,70,'#b78e8c45');
      // A desk, score, and lamp keep the professor's corner easy to recognize.
      rect(405,285,181,14,'#ad8175');rect(411,299,169,45,'#725463');rect(418,344,9,20,'#48394f');rect(562,344,9,20,'#48394f');rect(454,278,48,8,'#e9dfc7');rect(473,276,2,12,'#82748c');rect(550,264,5,22,'#d1ab6c');rect(540,260,25,8,'#e9c77d');
      rect(410,568,180,19,'#222c42');text('← ARCADE',500,582,12,'#aeece8');
    }
    function draw(){
      if(!backgroundReady){const target=g;g=background.getContext('2d');drawBackground();g=target;backgroundReady=true;}
      g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.imageSmoothingEnabled=false;g.clearRect(0,0,1000,600);roomCamera?.update();const cameraActive=!!roomCamera&&mobileView==='room';if(cameraActive)roomCamera.begin(g);
      const vibe=api.getVibe?.();
      if(backgroundImage?.complete&&backgroundImage.naturalWidth){g.drawImage(artworkBackground()||backgroundImage,0,0,1000,600);}else g.drawImage(artworkBackground()||background,0,0);
      vibe?.drawAtmosphere?.(g,{width:1000,height:600,time:clock,lights:[]});
      if(backgroundImage?.complete&&backgroundImage.naturalWidth){text('MUSIC CLASSROOM',500,148,18,'#b9f7f1');text('Professor Haydn’s study shelves',500,178,12,'#d9d3fa');text('ASK · LISTEN · LEARN',500,208,11,'#e5d7ac');}
      const haydnLook=vibe?.characterAppearance?.(HAYDN.appearance,{id:HAYDN.id,role:'npc'})||HAYDN.appearance;
      if(renderer){renderer.drawNPC(g,{...HAYDN,appearance:haydnLook},clock);vibe?.drawCharacterCostume?.(g,{id:HAYDN.id,role:'npc',x:HAYDN.x,y:HAYDN.y,scale:1,facing:HAYDN.facing||'down',time:clock});vibe?.drawCharacterGlow?.(g,{x:HAYDN.x,y:HAYDN.y,facing:HAYDN.facing||'down',time:clock,scale:1});
        // The professor stands behind the desk; its front masks his lower legs.
        const art=artworkBackground()||background,aw=art.naturalWidth||art.width,ah=art.naturalHeight||art.height;g.drawImage(art,405*aw/1000,295*ah/600,181*aw/1000,69*ah/600,405,295,181,69);
        if(vibe){g.save();g.beginPath();g.rect(405,295,181,69);g.clip();vibe.drawAtmosphere?.(g,{width:1000,height:600,time:clock,lights:[]});g.restore();}
        companion?.draw(g,clock);renderer.drawPlayer(g,api.getAvatar?.()||{},{x:player.x,y:player.y,facing:player.facing,walking,phase:player.phase},clock);vibe?.drawCharacterGlow?.(g,{x:player.x,y:player.y,facing:player.facing,time:clock,scale:1});}else{rect(player.x-10,player.y-30,20,28,'#a8c7bc');rect(HAYDN.x-10,HAYDN.y-30,20,28,'#85a89a');}
      text('PROFESSOR HAYDN',HAYDN.x,HAYDN.y-Math.max(69,renderer?.labelOffset?.(haydnLook,HAYDN.id)||0),11,'#e7efbb');
      if(near){const label=near.type==='exit'?'E · RETURN TO ARCADE':near.type==='professor'?'E · TALK TO HAYDN':'E · READ BOOKS';rect(near.x-85,near.y-17,170,24,'#182336');text(label,near.x,near.y,11,'#e8f5c5');}
      if(cameraActive)roomCamera.end(g);
    }
    function tick(time){
      if(!opened||destroyed)return;const dt=Math.min(.05,(time-last)/1000||0);last=time;clock+=dt;
      let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
      const finger=fingerWalk?.getState(),fingerTarget=finger?.following?finger.target:null;let speedScale=1;
      if(settingsOpen||mobileView!=='room'||finger?.pinching||finger?.suppressed){clearJoystick();dx=dy=0;destination=null;}else if(dx||dy)destination=null;else if(joystick.x||joystick.y){dx=joystick.x;dy=joystick.y;speedScale=Math.hypot(dx,dy);destination=null;}else if(fingerTarget){const point=worldPoint(fingerTarget.clientX,fingerTarget.clientY),x=clamp(point.x,35,965),y=clamp(point.y,285,575);dx=x-player.x;dy=y-player.y;if(Math.hypot(dx,dy)<3)dx=dy=0;}
      else if(destination){dx=destination.x-player.x;dy=destination.y-player.y;if(Math.hypot(dx,dy)<3){destination=null;dx=dy=0;}}
      const distance=Math.hypot(dx,dy);walking=distance>0;
      if(distance){player.facing=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';const amount=destination||fingerTarget?Math.min(distance,190*speedScale*dt):190*speedScale*dt,nx=player.x+dx/distance*amount,ny=player.y+dy/distance*amount,before={...player};if(passable(nx,player.y))player.x=nx;if(passable(player.x,ny))player.y=ny;const moved=Math.hypot(player.x-before.x,player.y-before.y);walking=moved>.01;player.phase+=moved/14;if(destination&&!walking)destination=null;}
      if(!settingsOpen&&mobileView==='room')companion?.update(player,dt,'classroom');near=nearest();draw();frame=win.requestAnimationFrame(tick);
    }
    function clearKeys(){clearJoystick();fingerWalk?.stop('clear');touchHeld.clear();keys.clear();walking=false;destination=null;}
    function controlMove(x,y){
      if(!Number.isFinite(x)||!Number.isFinite(y)||!opened||destroyed||settingsOpen||doc.hidden||mobileView!=='room'||fingerWalk?.getState().pinching||fingerWalk?.getState().suppressed){clearJoystick();return false;}
      const length=Math.hypot(x,y),scale=Math.max(1,length);joystick.x=x/scale;joystick.y=y/scale;
      if(length){fingerWalk?.stop('joystick');destination=null;keys.clear();}
      return true;
    }
    function control(raw,pressed){
      const key=String(raw).toLowerCase();if(!opened||destroyed||pressed&&settingsOpen||!['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright','e'].includes(key))return false;
      if(pressed){if(touchHeld.has(key))return true;if(key!=='e')fingerWalk?.stop('controls');canvas.focus({preventScroll:true});touchHeld.add(key);keydown({key,target:canvas,preventDefault(){},repeat:false});}
      else{touchHeld.delete(key);keyup({key});}return true;
    }
    function releaseControls(){clearJoystick();for(const key of Array.from(touchHeld))control(key,false);touchHeld.clear();}
    function keydown(event){
      if(!opened)return;
      if(event.key==='Escape'){if(fullscreen?.handleEscape(event))return;event.preventDefault();event.stopPropagation();if(settingsOpen)closeSettings();else if(mobileView!=='room')setMobileView('room',true);else close();return;}
      if(event.key==='Tab'){if(!settingsOpen&&event.target===canvas){event.preventDefault();openSettings();return;}const scope=settingsOpen?el('classroomSettingsPanel'):host,controls=Array.from(scope.querySelectorAll('button:not([disabled]),input,canvas[tabindex="0"]')).filter(element=>!element.hidden&&element.getClientRects().length),first=controls[0],last=controls.at(-1);if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}return;}
      if(settingsOpen||event.target!==canvas||event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;
      const key=event.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','e'].includes(key)){event.preventDefault();if(key==='e'){if(!event.repeat){clearKeys();interact();}}else{clearJoystick();keys.add(key);}}
    }
    function keyup(event){keys.delete(event.key.toLowerCase());}
    function visibility(){if(doc.hidden)clearKeys();}
    function open(){if(destroyed||opened)return;if(leftViaDoor){player.x=500;player.y=510;near=null;leftViaDoor=false;}priorFocus=doc.activeElement;opened=true;host.hidden=false;host.scrollTop=0;companion?.reset(player,'classroom');setMobileView('room');clearKeys();last=win.performance.now();selectTopic(selected);canvas.focus({preventScroll:true});frame=win.requestAnimationFrame(tick);}
    function close(){if(!opened)return;fullscreen?.exit();closeSettings(false);opened=false;host.hidden=true;win.cancelAnimationFrame(frame);clearKeys();stopAudio();finalExam?.close();if(priorFocus?.isConnected)priorFocus.focus({preventScroll:true});api.onClose?.();}
    function destroy(){if(destroyed)return;close();fullscreen?.destroy();tutorial?.destroy();tutorial=null;extraLesson?.destroy();extraLesson=null;learningPath?.destroy();learningPath=null;finalExam?.destroy();finalExam=null;fingerWalk?.dispose();roomCamera?.destroy();destroyed=true;host.removeEventListener('keydown',keydown);win.removeEventListener('keyup',keyup);win.removeEventListener('blur',clearKeys);doc.removeEventListener('visibilitychange',visibility);}
    el('classroomSettingsButton').onclick=openSettings;el('classroomSettingsClose').onclick=()=>closeSettings();el('classroomSettingsBackdrop').onclick=event=>{if(event.target===el('classroomSettingsBackdrop'))closeSettings();};
    el('classroomClose').onclick=close;el('classroomBackRoom').onclick=()=>setMobileView('room',true);el('classroomAllLessons').onclick=()=>{el('classroomSearch').value='';selectTopic('welcome',true);};el('classroomBrowseBooks').onclick=()=>{host.dataset.referenceOpen='true';el('classroomStart').hidden=true;host.querySelector('.classroom-library nav').querySelector('input').focus();};el('classroomSearch').oninput=listTopics;
    canvas.addEventListener('pointerdown',event=>{if(!opened||settingsOpen||mobileView!=='room'||event.button!==0)return;if(fingerWalk&&event.pointerType==='touch'&&mobileLayout())return;event.preventDefault();clearJoystick();canvas.focus({preventScroll:true});const {x,y}=worldPoint(event.clientX,event.clientY);if(passable(x,y))destination={x,y};});
    canvas.addEventListener('wheel',event=>{if(!opened||settingsOpen||mobileView!=='room'||!roomCamera)return;event.preventDefault();clearKeys();roomCamera.zoomBy(event.deltaY<0?.25:-.25);draw();},{passive:false});
    host.addEventListener('keydown',keydown);win.addEventListener('keyup',keyup);win.addEventListener('blur',clearKeys);canvas.addEventListener('blur',clearKeys);doc.addEventListener('visibilitychange',visibility);
    for(const button of host.querySelectorAll('[data-start-lesson]'))button.addEventListener('click',()=>{clearKeys();selectTopic(button.dataset.startLesson,true);});
    el('classroomFinalExam').onclick=()=>{clearKeys();selectTopic('final-exam',true);};
    for(const button of host.querySelectorAll('[data-classroom-view]'))button.addEventListener('click',()=>setMobileView(button.dataset.classroomView,true));
    fullscreen=win.createCodaRoomFullscreen?.({host,button:el('classroomFullscreen'),label:'Music Classroom',onBeforeChange:clearKeys,onChange:()=>{roomCamera?.update();if(opened)draw();api.onViewChange?.(mobileView);}})||null;if(!fullscreen)el('classroomFullscreen').disabled=true;
    selectTopic('welcome');setMobileView('room');draw();
    return {canTalkHistory:()=>opened&&nearest()?.id==='haydn',open,close,destroy,openSettings,closeSettings,selectTopic,control,controlMove,releaseControls,setMobileView,getArtworkSource,getState:()=>({open:opened,fullscreen:fullscreen?.getState()||{active:false,mode:'off',pending:false},mobileView,settingsOpen,blocked:settingsOpen,companion:companion?.getState()||null,camera:roomCamera?.getState()||{x:0,y:0,zoom:1,minZoom:1,maxZoom:3},joystick:joystickState(),fingerWalk:fingerWalk?.getState()||null,tutorials:tutorial?.getState()||win.CodaClassroomTutorials?.readProgress(api.storage)||{lessons:[],completed:[],completedCount:0,total:8},learningPath:learningPath?.getState()||null,finalExam:finalExam?.getState()||null,supplementalLesson:extraLesson?.getState()||null,exit:{...EXIT},topic:selected,player:{...player},near:near?{...near}:null,audioPlaying:!!audio||!!learningPath?.getState()?.audioPlaying||!!tutorial?.getState().active?.audioPlaying||!!extraLesson?.getState()?.audioPlaying,professor:{id:HAYDN.id,name:HAYDN.name,x:HAYDN.x,y:HAYDN.y},shelves:SHELVES.map(shelf=>({id:shelf.id,label:shelf.label,x:shelf.approach.x,y:shelf.approach.y}))})};
  }
  return {TOPICS,SHELVES,HAYDN,EXIT,topicFor,createCodaMusicClassroom};
});
