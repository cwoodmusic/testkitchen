/* Authored quiz questions are grounded in the facts in music-history-data.js. */
(function(root,factory){
 const questions=factory();
 if(typeof module==='object'&&module.exports)module.exports=questions;
 if(root)root.CodaMusicHistoryQuizData=questions;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const QUESTIONS=[
  {
    "id": "bach-quiz-01",
    "person": "bach",
    "factId": "bach-01",
    "prompt": "What was Bach’s large family known for?",
    "choices": [
      "Making music",
      "Building ships",
      "Training racehorses"
    ],
    "answer": 0
  },
  {
    "id": "bach-quiz-02",
    "person": "bach",
    "factId": "bach-02",
    "prompt": "Which instrument did Bach play before leading church music in Leipzig?",
    "choices": [
      "The trumpet",
      "The organ",
      "The drums"
    ],
    "answer": 1
  },
  {
    "id": "bach-quiz-03",
    "person": "bach",
    "factId": "bach-04",
    "prompt": "What does a church cantata bring together?",
    "choices": [
      "Dancers with no music",
      "Only one piano player",
      "Singers and instruments"
    ],
    "answer": 2
  },
  {
    "id": "bach-quiz-04",
    "person": "bach",
    "factId": "bach-05",
    "prompt": "What happens to a musical idea in a fugue?",
    "choices": [
      "Different parts play the same idea.",
      "The idea can only be played once.",
      "Only drums are allowed to play it."
    ],
    "answer": 0
  },
  {
    "id": "bach-quiz-05",
    "person": "bach",
    "factId": "bach-10",
    "prompt": "Which instrument did Bach write six sets of pieces for?",
    "choices": [
      "The flute",
      "The cello",
      "The trumpet"
    ],
    "answer": 1
  },
  {
    "id": "bach-quiz-06",
    "person": "bach",
    "factId": "bach-15",
    "prompt": "What work did Anna Magdalena Bach do?",
    "choices": [
      "She built organs for churches.",
      "She made violins for an orchestra.",
      "She earned her living as a singer."
    ],
    "answer": 2
  },
  {
    "id": "bach-quiz-07",
    "person": "bach",
    "factId": "bach-17",
    "prompt": "What did Bach’s son Carl Philipp Emanuel also become?",
    "choices": [
      "A composer who wrote music",
      "A person who made clocks",
      "A teacher of ballroom dance"
    ],
    "answer": 0
  },
  {
    "id": "bach-quiz-08",
    "person": "bach",
    "factId": "bach-19",
    "prompt": "Which musician was born in the same year as Bach?",
    "choices": [
      "Scott Joplin",
      "Handel",
      "Duke Ellington"
    ],
    "answer": 1
  },
  {
    "id": "bach-quiz-09",
    "person": "bach",
    "factId": "bach-22",
    "prompt": "Whose concertos gave Bach ideas for writing his own?",
    "choices": [
      "Brahms’s",
      "Chopin’s",
      "Vivaldi’s"
    ],
    "answer": 2
  },
  {
    "id": "bach-quiz-10",
    "person": "bach",
    "factId": "bach-28",
    "prompt": "What can you hear in Baroque music?",
    "choices": [
      "Extra notes and a low part that repeats",
      "A rule that every tune uses just one note",
      "Music that never uses a low part"
    ],
    "answer": 0
  },
  {
    "id": "mozart-quiz-01",
    "person": "mozart",
    "factId": "mozart-01",
    "prompt": "In which city was Mozart born?",
    "choices": [
      "Salzburg",
      "Paris",
      "London"
    ],
    "answer": 0
  },
  {
    "id": "mozart-quiz-02",
    "person": "mozart",
    "factId": "mozart-03",
    "prompt": "What did Mozart’s sister Nannerl play with skill?",
    "choices": [
      "Trumpet",
      "Keyboard instruments",
      "Drums"
    ],
    "answer": 1
  },
  {
    "id": "mozart-quiz-03",
    "person": "mozart",
    "factId": "mozart-04",
    "prompt": "What did Mozart and Nannerl do as children?",
    "choices": [
      "Build pianos in a factory",
      "Teach at a music school in London",
      "Travel around Europe to play music"
    ],
    "answer": 2
  },
  {
    "id": "mozart-quiz-04",
    "person": "mozart",
    "factId": "mozart-06",
    "prompt": "What is an opera?",
    "choices": [
      "A story told with singing",
      "A book with no music",
      "A piece played only on drums"
    ],
    "answer": 0
  },
  {
    "id": "mozart-quiz-05",
    "person": "mozart",
    "factId": "mozart-07",
    "prompt": "Where did Mozart move in 1781?",
    "choices": [
      "Bonn",
      "Vienna",
      "Warsaw"
    ],
    "answer": 1
  },
  {
    "id": "mozart-quiz-06",
    "person": "mozart",
    "factId": "mozart-08",
    "prompt": "Which part did Mozart often play in his own concertos?",
    "choices": [
      "The main trumpet part",
      "The main drum part",
      "The main piano part"
    ],
    "answer": 2
  },
  {
    "id": "mozart-quiz-07",
    "person": "mozart",
    "factId": "mozart-12",
    "prompt": "What do performers do in The Magic Flute?",
    "choices": [
      "Speak some lines and sing others",
      "Speak every line without singing",
      "Play instruments without any voices"
    ],
    "answer": 0
  },
  {
    "id": "mozart-quiz-08",
    "person": "mozart",
    "factId": "mozart-21",
    "prompt": "How did Mozart and Haydn feel about each other’s music?",
    "choices": [
      "They never heard it.",
      "They liked and respected it.",
      "They both refused to listen to it."
    ],
    "answer": 1
  },
  {
    "id": "mozart-quiz-09",
    "person": "mozart",
    "factId": "mozart-23",
    "prompt": "How many players usually make up a string quartet?",
    "choices": [
      "Three",
      "Five",
      "Four"
    ],
    "answer": 2
  },
  {
    "id": "mozart-quiz-10",
    "person": "mozart",
    "factId": "mozart-30",
    "prompt": "Who helped save and share Mozart’s music after he died?",
    "choices": [
      "His wife Constanze",
      "His father Leopold",
      "J. S. Bach"
    ],
    "answer": 0
  },
  {
    "id": "beethoven-quiz-01",
    "person": "beethoven",
    "factId": "beethoven-01",
    "prompt": "In which city was Beethoven born?",
    "choices": [
      "Bonn",
      "Vienna",
      "Salzburg"
    ],
    "answer": 0
  },
  {
    "id": "beethoven-quiz-02",
    "person": "beethoven",
    "factId": "beethoven-02",
    "prompt": "Who taught Beethoven after he moved to Vienna?",
    "choices": [
      "Frédéric Chopin",
      "Joseph Haydn",
      "Scott Joplin"
    ],
    "answer": 1
  },
  {
    "id": "beethoven-quiz-03",
    "person": "beethoven",
    "factId": "beethoven-03",
    "prompt": "What could Beethoven do while playing piano?",
    "choices": [
      "Make music without using any notes",
      "Play only music written by others",
      "Make up music as he played"
    ],
    "answer": 2
  },
  {
    "id": "beethoven-quiz-04",
    "person": "beethoven",
    "factId": "beethoven-04",
    "prompt": "How many symphonies did Beethoven finish?",
    "choices": [
      "Nine",
      "Three",
      "Twenty"
    ],
    "answer": 0
  },
  {
    "id": "beethoven-quiz-05",
    "person": "beethoven",
    "factId": "beethoven-05",
    "prompt": "What small idea helps build Beethoven’s Fifth Symphony?",
    "choices": [
      "A long spoken story",
      "A short rhythm",
      "A poem sung without instruments"
    ],
    "answer": 1
  },
  {
    "id": "beethoven-quiz-06",
    "person": "beethoven",
    "factId": "beethoven-06",
    "prompt": "What does Beethoven’s Sixth Symphony bring to mind?",
    "choices": [
      "A busy factory",
      "A trip into outer space",
      "Scenes from nature"
    ],
    "answer": 2
  },
  {
    "id": "beethoven-quiz-07",
    "person": "beethoven",
    "factId": "beethoven-07",
    "prompt": "Who joins the orchestra in Beethoven’s Ninth Symphony?",
    "choices": [
      "Solo singers and a choir",
      "Only a solo piano player",
      "Only a solo violin player"
    ],
    "answer": 0
  },
  {
    "id": "beethoven-quiz-08",
    "person": "beethoven",
    "factId": "beethoven-12",
    "prompt": "What is the name of Beethoven’s only opera?",
    "choices": [
      "The Magic Flute",
      "Fidelio",
      "Don Giovanni"
    ],
    "answer": 1
  },
  {
    "id": "beethoven-quiz-09",
    "person": "beethoven",
    "factId": "beethoven-17",
    "prompt": "What did Beethoven keep doing as his hearing became very poor?",
    "choices": [
      "Only repairing pianos",
      "Working only as a painter",
      "Writing music"
    ],
    "answer": 2
  },
  {
    "id": "beethoven-quiz-10",
    "person": "beethoven",
    "factId": "beethoven-22",
    "prompt": "Which two music periods does Beethoven’s music help link?",
    "choices": [
      "Classical and Romantic",
      "Renaissance and Baroque",
      "Swing and bebop"
    ],
    "answer": 0
  },
  {
    "id": "clara-quiz-01",
    "person": "clara",
    "factId": "clara-01",
    "prompt": "What was Clara Schumann’s last name at birth?",
    "choices": [
      "Wieck",
      "Hensel",
      "Martines"
    ],
    "answer": 0
  },
  {
    "id": "clara-quiz-02",
    "person": "clara",
    "factId": "clara-04",
    "prompt": "What was Clara especially known for in the 1800s?",
    "choices": [
      "Dancing in ballets",
      "Playing piano in concerts",
      "Making brass instruments"
    ],
    "answer": 1
  },
  {
    "id": "clara-quiz-03",
    "person": "clara",
    "factId": "clara-05",
    "prompt": "What did Clara do besides performing music?",
    "choices": [
      "Build church organs",
      "Make violins for other players",
      "Write music of her own"
    ],
    "answer": 2
  },
  {
    "id": "clara-quiz-04",
    "person": "clara",
    "factId": "clara-06",
    "prompt": "When did Clara start her Piano Concerto in A minor?",
    "choices": [
      "When she was a teenager",
      "After she stopped playing concerts",
      "After she turned eighty"
    ],
    "answer": 0
  },
  {
    "id": "clara-quiz-05",
    "person": "clara",
    "factId": "clara-09",
    "prompt": "Who usually plays chamber music?",
    "choices": [
      "Only one singer with no instruments",
      "A small group of musicians",
      "A whole town singing together"
    ],
    "answer": 1
  },
  {
    "id": "clara-quiz-06",
    "person": "clara",
    "factId": "clara-12",
    "prompt": "Who did Clara marry in 1840?",
    "choices": [
      "Joseph Haydn",
      "Johannes Brahms",
      "Robert Schumann"
    ],
    "answer": 2
  },
  {
    "id": "clara-quiz-07",
    "person": "clara",
    "factId": "clara-15",
    "prompt": "Whose music did Clara help more people hear?",
    "choices": [
      "Johannes Brahms’s",
      "Antonio Vivaldi’s",
      "Scott Joplin’s"
    ],
    "answer": 0
  },
  {
    "id": "clara-quiz-08",
    "person": "clara",
    "factId": "clara-19",
    "prompt": "What does playing piano from memory mean?",
    "choices": [
      "Playing only with another pianist",
      "Playing without looking at written music",
      "Reading each note from the music page"
    ],
    "answer": 1
  },
  {
    "id": "clara-quiz-09",
    "person": "clara",
    "factId": "clara-20",
    "prompt": "What kind of school is a conservatory?",
    "choices": [
      "A cooking school",
      "A school for caring for farm animals",
      "A music school"
    ],
    "answer": 2
  },
  {
    "id": "clara-quiz-10",
    "person": "clara",
    "factId": "clara-22",
    "prompt": "Who also wrote music and played piano in the 1800s?",
    "choices": [
      "Fanny Hensel",
      "Ella Fitzgerald",
      "Nina Simone"
    ],
    "answer": 0
  },
  {
    "id": "joplin-quiz-01",
    "person": "joplin",
    "factId": "joplin-01",
    "prompt": "What was Joplin’s family like?",
    "choices": [
      "Many family members made music.",
      "No one in his family liked music.",
      "They only worked as painters."
    ],
    "answer": 0
  },
  {
    "id": "joplin-quiz-02",
    "person": "joplin",
    "factId": "joplin-02",
    "prompt": "Which instrument did Joplin play?",
    "choices": [
      "Violin",
      "Piano",
      "Trumpet"
    ],
    "answer": 1
  },
  {
    "id": "joplin-quiz-03",
    "person": "joplin",
    "factId": "joplin-03",
    "prompt": "What often happens in ragtime music?",
    "choices": [
      "Every player uses the same note.",
      "The music has no steady beat.",
      "Strong notes fall between the main beats."
    ],
    "answer": 2
  },
  {
    "id": "joplin-quiz-04",
    "person": "joplin",
    "factId": "joplin-06",
    "prompt": "Which piece helped make Joplin famous?",
    "choices": [
      "Maple Leaf Rag",
      "Kind of Blue",
      "Mood Indigo"
    ],
    "answer": 0
  },
  {
    "id": "joplin-quiz-05",
    "person": "joplin",
    "factId": "joplin-13",
    "prompt": "What advice did Joplin give ragtime players?",
    "choices": [
      "Play as fast as possible.",
      "Do not play too fast.",
      "Never keep a steady beat."
    ],
    "answer": 1
  },
  {
    "id": "joplin-quiz-06",
    "person": "joplin",
    "factId": "joplin-18",
    "prompt": "What is an opera, like Joplin’s Treemonisha?",
    "choices": [
      "A book of piano exercises",
      "A dance with no music",
      "A story acted out by singers"
    ],
    "answer": 2
  },
  {
    "id": "joplin-quiz-07",
    "person": "joplin",
    "factId": "joplin-19",
    "prompt": "What does Treemonisha show about learning?",
    "choices": [
      "It can help people gain freedom.",
      "It keeps people from helping others.",
      "It only matters to musicians."
    ],
    "answer": 0
  },
  {
    "id": "joplin-quiz-08",
    "person": "joplin",
    "factId": "joplin-23",
    "prompt": "How did Joplin work with Scott Hayden?",
    "choices": [
      "They made movies together.",
      "They wrote ragtime music together.",
      "They built pianos together."
    ],
    "answer": 1
  },
  {
    "id": "joplin-quiz-09",
    "person": "joplin",
    "factId": "joplin-27",
    "prompt": "What kind of music did Tom Turpin help shape?",
    "choices": [
      "Opera",
      "Rock",
      "Ragtime"
    ],
    "answer": 2
  },
  {
    "id": "joplin-quiz-10",
    "person": "joplin",
    "factId": "joplin-28",
    "prompt": "How are ragtime and early jazz linked?",
    "choices": [
      "Ragtime helped shape early jazz.",
      "Jazz and ragtime are the same thing.",
      "Ragtime had no effect on early jazz."
    ],
    "answer": 0
  },
  {
    "id": "ellington-quiz-01",
    "person": "ellington",
    "factId": "ellington-01",
    "prompt": "Where was Duke Ellington born?",
    "choices": [
      "New York City",
      "Washington, D.C.",
      "New Orleans"
    ],
    "answer": 1
  },
  {
    "id": "ellington-quiz-02",
    "person": "ellington",
    "factId": "ellington-02",
    "prompt": "What did Ellington do as a musician?",
    "choices": [
      "He only sang in a choir.",
      "He only played the drums.",
      "He played piano, wrote music, and led a band."
    ],
    "answer": 2
  },
  {
    "id": "ellington-quiz-03",
    "person": "ellington",
    "factId": "ellington-05",
    "prompt": "How did people far from the club hear Ellington’s band?",
    "choices": [
      "Through radio shows",
      "Through silent movies",
      "Through letters without music"
    ],
    "answer": 0
  },
  {
    "id": "ellington-quiz-04",
    "person": "ellington",
    "factId": "ellington-06",
    "prompt": "What helped Ellington decide how to write for his band?",
    "choices": [
      "The color of the stage lights",
      "Each band member’s own sound",
      "The number of seats in the room"
    ],
    "answer": 1
  },
  {
    "id": "ellington-quiz-05",
    "person": "ellington",
    "factId": "ellington-12",
    "prompt": "What kind of feel does swing give music?",
    "choices": [
      "A silent feel",
      "A completely steady, flat feel",
      "A bouncy feel"
    ],
    "answer": 2
  },
  {
    "id": "ellington-quiz-06",
    "person": "ellington",
    "factId": "ellington-15",
    "prompt": "What history does Black, Brown and Beige share?",
    "choices": [
      "Black American history",
      "The history of space travel",
      "The history of ancient Rome"
    ],
    "answer": 0
  },
  {
    "id": "ellington-quiz-07",
    "person": "ellington",
    "factId": "ellington-16",
    "prompt": "What is a musical suite?",
    "choices": [
      "One note held for a long time",
      "A set of pieces played together",
      "A kind of trumpet"
    ],
    "answer": 1
  },
  {
    "id": "ellington-quiz-08",
    "person": "ellington",
    "factId": "ellington-17",
    "prompt": "How did Billy Strayhorn work with Ellington?",
    "choices": [
      "He built Ellington’s piano.",
      "He taught Ellington to paint.",
      "They wrote music together."
    ],
    "answer": 2
  },
  {
    "id": "ellington-quiz-09",
    "person": "ellington",
    "factId": "ellington-28",
    "prompt": "How did Ella Fitzgerald share Ellington’s music?",
    "choices": [
      "She made an album of his songs.",
      "She made a book of his drawings.",
      "She built a new instrument for him."
    ],
    "answer": 0
  },
  {
    "id": "ellington-quiz-10",
    "person": "ellington",
    "factId": "ellington-29",
    "prompt": "Which honor did Ellington receive in 1969?",
    "choices": [
      "A prize for space travel",
      "The Presidential Medal of Freedom",
      "An Olympic gold medal"
    ],
    "answer": 1
  },
  {
    "id": "ella-quiz-01",
    "person": "ella",
    "factId": "ella-01",
    "prompt": "In which state was Ella Fitzgerald born?",
    "choices": [
      "New York",
      "Illinois",
      "Virginia"
    ],
    "answer": 2
  },
  {
    "id": "ella-quiz-02",
    "person": "ella",
    "factId": "ella-03",
    "prompt": "What helped young Ella show her singing talent?",
    "choices": [
      "Winning a contest at the Apollo Theater",
      "Winning a piano-building contest",
      "Writing music for a silent movie"
    ],
    "answer": 0
  },
  {
    "id": "ella-quiz-03",
    "person": "ella",
    "factId": "ella-04",
    "prompt": "Whose band did Ella join in the 1930s?",
    "choices": [
      "Scott Joplin’s",
      "Chick Webb’s",
      "J. S. Bach’s"
    ],
    "answer": 1
  },
  {
    "id": "ella-quiz-04",
    "person": "ella",
    "factId": "ella-07",
    "prompt": "What did Ella do after Chick Webb died?",
    "choices": [
      "She stopped making music forever.",
      "She only made piano records.",
      "She led his band for a time."
    ],
    "answer": 2
  },
  {
    "id": "ella-quiz-05",
    "person": "ella",
    "factId": "ella-09",
    "prompt": "What do singers use when they scat?",
    "choices": [
      "Made-up sounds instead of the usual words",
      "Only words read from a book",
      "Only humming with closed mouths"
    ],
    "answer": 0
  },
  {
    "id": "ella-quiz-06",
    "person": "ella",
    "factId": "ella-11",
    "prompt": "What nickname did people often use for Ella?",
    "choices": [
      "The King of Ragtime",
      "The First Lady of Song",
      "The Piano Captain"
    ],
    "answer": 1
  },
  {
    "id": "ella-quiz-07",
    "person": "ella",
    "factId": "ella-12",
    "prompt": "What did Ella share on her songbook albums?",
    "choices": [
      "Only drum solos",
      "Stories with no music",
      "Songs by many great songwriters"
    ],
    "answer": 2
  },
  {
    "id": "ella-quiz-08",
    "person": "ella",
    "factId": "ella-19",
    "prompt": "What is a duet, like those Ella made with Louis Armstrong?",
    "choices": [
      "Music for two performers",
      "Music for ten performers",
      "Music with no performers"
    ],
    "answer": 0
  },
  {
    "id": "ella-quiz-09",
    "person": "ella",
    "factId": "ella-24",
    "prompt": "What did Ella do when she forgot words during a show?",
    "choices": [
      "She left the stage at once.",
      "She made up new words as she sang.",
      "She asked the band to stop forever."
    ],
    "answer": 1
  },
  {
    "id": "ella-quiz-10",
    "person": "ella",
    "factId": "ella-27",
    "prompt": "What kind of music did Ella’s peer Sarah Vaughan sing?",
    "choices": [
      "Only opera",
      "Only country music",
      "Jazz"
    ],
    "answer": 2
  },
  {
    "id": "nina-quiz-01",
    "person": "nina",
    "factId": "nina-02",
    "prompt": "When did Nina Simone start playing piano?",
    "choices": [
      "When she was a young child",
      "Only after she retired",
      "Only after her first hit record"
    ],
    "answer": 0
  },
  {
    "id": "nina-quiz-02",
    "person": "nina",
    "factId": "nina-03",
    "prompt": "What did Nina study before becoming a famous singer?",
    "choices": [
      "Painting",
      "Classical piano music",
      "Ballet dancing"
    ],
    "answer": 1
  },
  {
    "id": "nina-quiz-03",
    "person": "nina",
    "factId": "nina-04",
    "prompt": "Whose music helped shape Nina’s piano playing?",
    "choices": [
      "Scott Joplin’s",
      "Miles Davis’s",
      "J. S. Bach’s"
    ],
    "answer": 2
  },
  {
    "id": "nina-quiz-04",
    "person": "nina",
    "factId": "nina-10",
    "prompt": "How did Nina use different kinds of music?",
    "choices": [
      "She mixed several kinds together.",
      "She used only one kind her whole life.",
      "She avoided all older music."
    ],
    "answer": 0
  },
  {
    "id": "nina-quiz-05",
    "person": "nina",
    "factId": "nina-12",
    "prompt": "What instrument did Nina often play while singing?",
    "choices": [
      "Trumpet",
      "Piano",
      "Violin"
    ],
    "answer": 1
  },
  {
    "id": "nina-quiz-06",
    "person": "nina",
    "factId": "nina-15",
    "prompt": "What led Nina to write Mississippi Goddam?",
    "choices": [
      "A trip to the beach",
      "A new piano at home",
      "Racist attacks on Black people"
    ],
    "answer": 2
  },
  {
    "id": "nina-quiz-07",
    "person": "nina",
    "factId": "nina-16",
    "prompt": "What cause did Mississippi Goddam help support?",
    "choices": [
      "Equal rights",
      "A new sports team",
      "A faster train service"
    ],
    "answer": 0
  },
  {
    "id": "nina-quiz-08",
    "person": "nina",
    "factId": "nina-18",
    "prompt": "What does Nina’s song Four Women explore?",
    "choices": [
      "The rules of four sports",
      "Racism and unfair ideas about Black women",
      "The four seasons of the year"
    ],
    "answer": 1
  },
  {
    "id": "nina-quiz-09",
    "person": "nina",
    "factId": "nina-20",
    "prompt": "Who does To Be Young, Gifted and Black honor?",
    "choices": [
      "J. S. Bach",
      "Duke Ellington",
      "Lorraine Hansberry"
    ],
    "answer": 2
  },
  {
    "id": "nina-quiz-10",
    "person": "nina",
    "factId": "nina-25",
    "prompt": "How did singer Miriam Makeba use music?",
    "choices": [
      "To fight unfair laws",
      "To keep laws secret",
      "To teach people to build pianos"
    ],
    "answer": 0
  },
  {
    "id": "miles-quiz-01",
    "person": "miles",
    "factId": "miles-03",
    "prompt": "Which instrument did Miles Davis play?",
    "choices": [
      "Piano",
      "Trumpet",
      "Violin"
    ],
    "answer": 1
  },
  {
    "id": "miles-quiz-02",
    "person": "miles",
    "factId": "miles-04",
    "prompt": "Why did Miles move to New York in 1944?",
    "choices": [
      "To become a painter",
      "To build a music store",
      "To study music"
    ],
    "answer": 2
  },
  {
    "id": "miles-quiz-03",
    "person": "miles",
    "factId": "miles-06",
    "prompt": "Which instrument did Miles’s fellow musician Charlie Parker play?",
    "choices": [
      "Saxophone",
      "Drums",
      "Flute"
    ],
    "answer": 0
  },
  {
    "id": "miles-quiz-04",
    "person": "miles",
    "factId": "miles-07",
    "prompt": "What is a chord in music?",
    "choices": [
      "One note played alone",
      "A group of notes played together",
      "A pause with no sound"
    ],
    "answer": 1
  },
  {
    "id": "miles-quiz-05",
    "person": "miles",
    "factId": "miles-12",
    "prompt": "How many musicians play in a quintet?",
    "choices": [
      "Two",
      "Four",
      "Five"
    ],
    "answer": 2
  },
  {
    "id": "miles-quiz-06",
    "person": "miles",
    "factId": "miles-14",
    "prompt": "Which album did Miles record in 1959?",
    "choices": [
      "Kind of Blue",
      "Maple Leaf Rag",
      "Black, Brown and Beige"
    ],
    "answer": 0
  },
  {
    "id": "miles-quiz-07",
    "person": "miles",
    "factId": "miles-15",
    "prompt": "What do players do in the modal jazz on Kind of Blue?",
    "choices": [
      "Play only one fixed tune forever",
      "Use sets of notes to make up music",
      "Avoid choosing any notes"
    ],
    "answer": 1
  },
  {
    "id": "miles-quiz-08",
    "person": "miles",
    "factId": "miles-22",
    "prompt": "How old was Tony Williams when he joined Miles’s band?",
    "choices": [
      "A very young child",
      "Over sixty years old",
      "Still a teenager"
    ],
    "answer": 2
  },
  {
    "id": "miles-quiz-09",
    "person": "miles",
    "factId": "miles-24",
    "prompt": "What did Bitches Brew bring into jazz?",
    "choices": [
      "Electric instruments and rock-like beats",
      "Only church bells and silence",
      "Only unaccompanied singing"
    ],
    "answer": 0
  },
  {
    "id": "miles-quiz-10",
    "person": "miles",
    "factId": "miles-26",
    "prompt": "What tool helped Miles change his trumpet sound?",
    "choices": [
      "A drumstick",
      "A Harmon mute",
      "A piano pedal"
    ],
    "answer": 1
  },
  {
    "id": "chopin-quiz-01",
    "person": "chopin",
    "factId": "chopin-01",
    "prompt": "Near which city was Chopin born?",
    "choices": [
      "Warsaw",
      "Vienna",
      "London"
    ],
    "answer": 0
  },
  {
    "id": "chopin-quiz-02",
    "person": "chopin",
    "factId": "chopin-05",
    "prompt": "Where did Chopin make his home after leaving Poland?",
    "choices": [
      "London",
      "Paris",
      "Venice"
    ],
    "answer": 1
  },
  {
    "id": "chopin-quiz-03",
    "person": "chopin",
    "factId": "chopin-06",
    "prompt": "Which instrument is in almost every piece Chopin wrote?",
    "choices": [
      "The violin",
      "The flute",
      "The piano"
    ],
    "answer": 2
  },
  {
    "id": "chopin-quiz-04",
    "person": "chopin",
    "factId": "chopin-08",
    "prompt": "What do Chopin’s études, or study pieces, help players do?",
    "choices": [
      "Learn piano skills and show feelings",
      "Learn skills without making music",
      "Practice singing with an orchestra"
    ],
    "answer": 0
  },
  {
    "id": "chopin-quiz-05",
    "person": "chopin",
    "factId": "chopin-11",
    "prompt": "Which country’s dances helped shape Chopin’s mazurkas?",
    "choices": [
      "France",
      "Poland",
      "England"
    ],
    "answer": 1
  },
  {
    "id": "chopin-quiz-06",
    "person": "chopin",
    "factId": "chopin-18",
    "prompt": "What were Chopin’s waltzes often made for?",
    "choices": [
      "Only for dancing at a ball",
      "Only for marching in a parade",
      "For listening, rather than ballroom dancing"
    ],
    "answer": 2
  },
  {
    "id": "chopin-quiz-07",
    "person": "chopin",
    "factId": "chopin-21",
    "prompt": "How did Chopin earn much of his money in Paris?",
    "choices": [
      "Teaching piano",
      "Building violins",
      "Leading an opera house"
    ],
    "answer": 0
  },
  {
    "id": "chopin-quiz-08",
    "person": "chopin",
    "factId": "chopin-22",
    "prompt": "What kind of performance did Chopin often prefer?",
    "choices": [
      "A concert for a huge crowd",
      "Playing for a small group",
      "Playing in a large marching band"
    ],
    "answer": 1
  },
  {
    "id": "chopin-quiz-09",
    "person": "chopin",
    "factId": "chopin-23",
    "prompt": "Which pianist was part of Chopin’s music circle in Paris?",
    "choices": [
      "J. S. Bach",
      "George Frideric Handel",
      "Franz Liszt"
    ],
    "answer": 2
  },
  {
    "id": "chopin-quiz-10",
    "person": "chopin",
    "factId": "chopin-24",
    "prompt": "How did Robert Schumann support Chopin’s early music?",
    "choices": [
      "He praised it in his writing.",
      "He told people not to hear it.",
      "He said Chopin should stop writing."
    ],
    "answer": 0
  },
  {
    "id": "haydn-quiz-01",
    "person": "haydn",
    "factId": "haydn-01",
    "prompt": "In which country was Joseph Haydn born?",
    "choices": [
      "Austria",
      "Poland",
      "France"
    ],
    "answer": 0
  },
  {
    "id": "haydn-quiz-02",
    "person": "haydn",
    "factId": "haydn-02",
    "prompt": "How did Haydn make music as a boy?",
    "choices": [
      "He led an opera house.",
      "He sang in a choir.",
      "He built pianos for concerts."
    ],
    "answer": 1
  },
  {
    "id": "haydn-quiz-03",
    "person": "haydn",
    "factId": "haydn-03",
    "prompt": "What did the family that hired Haydn pay him to do?",
    "choices": [
      "Build and repair pianos",
      "Print and sell other people’s music",
      "Write music and lead concerts"
    ],
    "answer": 2
  },
  {
    "id": "haydn-quiz-04",
    "person": "haydn",
    "factId": "haydn-05",
    "prompt": "What kind of piece did Haydn help shape?",
    "choices": [
      "The symphony, for a large group of players",
      "A solo song with no instruments",
      "A piano exercise for one hand"
    ],
    "answer": 0
  },
  {
    "id": "haydn-quiz-05",
    "person": "haydn",
    "factId": "haydn-07",
    "prompt": "Which instruments usually play in a string quartet?",
    "choices": [
      "Two flutes and two drums",
      "Two violins, a viola, and a cello",
      "One piano and a large choir"
    ],
    "answer": 1
  },
  {
    "id": "haydn-quiz-06",
    "person": "haydn",
    "factId": "haydn-10",
    "prompt": "What is surprising in Haydn’s Surprise Symphony?",
    "choices": [
      "A singer walks in from the crowd.",
      "All the players leave at once.",
      "A sudden loud chord comes in a slow part."
    ],
    "answer": 2
  },
  {
    "id": "haydn-quiz-07",
    "person": "haydn",
    "factId": "haydn-12",
    "prompt": "What happens in Haydn’s Farewell Symphony?",
    "choices": [
      "Players leave one by one until two violin players stay.",
      "A new choir joins the players.",
      "The whole group starts the piece again."
    ],
    "answer": 0
  },
  {
    "id": "haydn-quiz-08",
    "person": "haydn",
    "factId": "haydn-15",
    "prompt": "Which city did Haydn visit twice in the 1790s?",
    "choices": [
      "Paris",
      "London",
      "Warsaw"
    ],
    "answer": 1
  },
  {
    "id": "haydn-quiz-09",
    "person": "haydn",
    "factId": "haydn-24",
    "prompt": "What did Mozart and Haydn think of each other’s music?",
    "choices": [
      "Neither one had heard it.",
      "They both disliked it.",
      "They both thought it was great."
    ],
    "answer": 2
  },
  {
    "id": "haydn-quiz-10",
    "person": "haydn",
    "factId": "haydn-26",
    "prompt": "What did Beethoven do after moving to Vienna in 1792?",
    "choices": [
      "Studied music with Haydn",
      "Gave Haydn his first music lesson",
      "Stopped writing music"
    ],
    "answer": 0
  },
  {
    "id": "dj-quiz-01",
    "person": "dj",
    "factId": "dj-01",
    "prompt": "Which description of DJ Coda is true?",
    "choices": [
      "A made-up arcade host",
      "A real jazz trumpet player",
      "A real composer from the 1700s"
    ],
    "answer": 0
  },
  {
    "id": "dj-quiz-02",
    "person": "dj",
    "factId": "dj-02",
    "prompt": "What did the first disc jockeys do?",
    "choices": [
      "Build musical instruments",
      "Choose and play records for a crowd",
      "Write music for orchestras"
    ],
    "answer": 1
  },
  {
    "id": "dj-quiz-03",
    "person": "dj",
    "factId": "dj-05",
    "prompt": "What does beatmatching line up in two songs?",
    "choices": [
      "The words",
      "The instruments",
      "The beats"
    ],
    "answer": 2
  },
  {
    "id": "dj-quiz-04",
    "person": "dj",
    "factId": "dj-09",
    "prompt": "Which communities helped disco grow?",
    "choices": [
      "Black, Latino, and LGBTQ+ communities",
      "Only musicians in classical orchestras",
      "Only people who made church organs"
    ],
    "answer": 0
  },
  {
    "id": "dj-quiz-05",
    "person": "dj",
    "factId": "dj-15",
    "prompt": "Whose Bronx parties helped hip-hop get its start?",
    "choices": [
      "Frankie Knuckles’s",
      "Thomas Edison’s",
      "DJ Kool Herc’s"
    ],
    "answer": 2
  },
  {
    "id": "dj-quiz-06",
    "person": "dj",
    "factId": "dj-20",
    "prompt": "How does a DJ scratch a record?",
    "choices": [
      "Strike it with a drumstick",
      "Move it back and forth",
      "Blow air across its edge"
    ],
    "answer": 1
  },
  {
    "id": "dj-quiz-07",
    "person": "dj",
    "factId": "dj-22",
    "prompt": "Where did house music grow in the 1980s?",
    "choices": [
      "Paris concert halls",
      "Chicago dance clubs",
      "Vienna opera houses"
    ],
    "answer": 1
  },
  {
    "id": "dj-quiz-08",
    "person": "dj",
    "factId": "dj-23",
    "prompt": "Which musician helped shape house music at the Warehouse?",
    "choices": [
      "Frankie Knuckles",
      "Ravi Shankar",
      "Michael Jackson"
    ],
    "answer": 0
  },
  {
    "id": "dj-quiz-09",
    "person": "dj",
    "factId": "dj-29",
    "prompt": "What does sampling use to make new music?",
    "choices": [
      "Only words from a book",
      "Only sounds played live",
      "A piece of recorded sound"
    ],
    "answer": 2
  },
  {
    "id": "dj-quiz-10",
    "person": "dj",
    "factId": "dj-30",
    "prompt": "What can a remix change in a recording?",
    "choices": [
      "Its parts, beat, or sound",
      "The size of the record player",
      "How many strings a violin has"
    ],
    "answer": 0
  },
  {
    "id": "vee-jay-quiz-01",
    "person": "vee-jay",
    "factId": "vee-jay-01",
    "prompt": "Which description of Vee Jay is true?",
    "choices": [
      "A real singer from Egypt",
      "A made-up arcade visitor",
      "A real inventor from the 1800s"
    ],
    "answer": 1
  },
  {
    "id": "vee-jay-quiz-02",
    "person": "vee-jay",
    "factId": "vee-jay-03",
    "prompt": "What could Edison’s phonograph do?",
    "choices": [
      "Show moving pictures",
      "Send a text message",
      "Record sound and play it back"
    ],
    "answer": 2
  },
  {
    "id": "vee-jay-quiz-03",
    "person": "vee-jay",
    "factId": "vee-jay-06",
    "prompt": "What did studios start using in the 1920s?",
    "choices": [
      "Microphones",
      "Digital video cameras",
      "Online music services"
    ],
    "answer": 0
  },
  {
    "id": "vee-jay-quiz-04",
    "person": "vee-jay",
    "factId": "vee-jay-10",
    "prompt": "What does multitrack recording let musicians do?",
    "choices": [
      "Record each part on its own",
      "Record only one instrument in a whole song",
      "Make music without recording sound"
    ],
    "answer": 0
  },
  {
    "id": "vee-jay-quiz-05",
    "person": "vee-jay",
    "factId": "vee-jay-15",
    "prompt": "What kind of music did the cartoons in Fantasia use?",
    "choices": [
      "Only a solo drum",
      "Music played by an orchestra",
      "Only a person whistling"
    ],
    "answer": 1
  },
  {
    "id": "vee-jay-quiz-06",
    "person": "vee-jay",
    "factId": "vee-jay-21",
    "prompt": "How did the Beatles help shape music videos?",
    "choices": [
      "They invented the phonograph",
      "They started every music TV channel",
      "They made short films to share songs"
    ],
    "answer": 2
  },
  {
    "id": "vee-jay-quiz-07",
    "person": "vee-jay",
    "factId": "vee-jay-25",
    "prompt": "What did Michael Jackson’s Thriller video include?",
    "choices": [
      "A story and big dance scenes",
      "Only printed words on a screen",
      "Only a still picture of a record"
    ],
    "answer": 0
  },
  {
    "id": "vee-jay-quiz-08",
    "person": "vee-jay",
    "factId": "vee-jay-28",
    "prompt": "What music can a film’s soundtrack use?",
    "choices": [
      "Only music written that day",
      "New music and older recordings",
      "Only music played without instruments"
    ],
    "answer": 1
  },
  {
    "id": "vee-jay-quiz-09",
    "person": "vee-jay",
    "factId": "vee-jay-29",
    "prompt": "What do Foley artists make for films?",
    "choices": [
      "The words to every song",
      "New musical instruments",
      "Sound effects matched to actions"
    ],
    "answer": 2
  },
  {
    "id": "vee-jay-quiz-10",
    "person": "vee-jay",
    "factId": "vee-jay-30",
    "prompt": "What does digital editing help creators line up?",
    "choices": [
      "Music and moving pictures",
      "Seats in a concert hall",
      "Strings on a guitar"
    ],
    "answer": 0
  },
  {
    "id": "zizi-quiz-01",
    "person": "zizi",
    "factId": "zizi-01",
    "prompt": "Which description of Zizi is true?",
    "choices": [
      "A real singer from Brazil",
      "A real composer from India",
      "A made-up visitor from space"
    ],
    "answer": 2
  },
  {
    "id": "zizi-quiz-02",
    "person": "zizi",
    "factId": "zizi-02",
    "prompt": "Which music tradition uses the sitar?",
    "choices": [
      "Hindustani music from northern India",
      "Mariachi music from Mexico",
      "Samba from Brazil"
    ],
    "answer": 0
  },
  {
    "id": "zizi-quiz-03",
    "person": "zizi",
    "factId": "zizi-05",
    "prompt": "What does a raga guide in Indian classical music?",
    "choices": [
      "How to build drums",
      "How to make tunes",
      "Where an audience should sit"
    ],
    "answer": 1
  },
  {
    "id": "zizi-quiz-04",
    "person": "zizi",
    "factId": "zizi-06",
    "prompt": "How does a tala organize beats?",
    "choices": [
      "In a cycle that repeats",
      "In pictures on a screen",
      "In a list of song titles"
    ],
    "answer": 0
  },
  {
    "id": "zizi-quiz-05",
    "person": "zizi",
    "factId": "zizi-09",
    "prompt": "What instruments often play in Indonesian gamelan?",
    "choices": [
      "Only guitars and trumpets",
      "Bronze gongs and metal bars that players hit",
      "Only a piano and a violin"
    ],
    "answer": 1
  },
  {
    "id": "zizi-quiz-06",
    "person": "zizi",
    "factId": "zizi-13",
    "prompt": "What do West African griots keep alive through music?",
    "choices": [
      "Only plans for building instruments",
      "Only rules for sports",
      "History and stories of the past"
    ],
    "answer": 2
  },
  {
    "id": "zizi-quiz-07",
    "person": "zizi",
    "factId": "zizi-17",
    "prompt": "Where was the singer Umm Kulthum from?",
    "choices": [
      "Japan",
      "Egypt",
      "Mexico"
    ],
    "answer": 1
  },
  {
    "id": "zizi-quiz-08",
    "person": "zizi",
    "factId": "zizi-23",
    "prompt": "What instruments often play in mariachi groups from Mexico?",
    "choices": [
      "Violins, trumpets, and guitars",
      "Only bronze gongs",
      "Only a piano and a flute"
    ],
    "answer": 0
  },
  {
    "id": "zizi-quiz-09",
    "person": "zizi",
    "factId": "zizi-26",
    "prompt": "Where does samba have deep musical roots?",
    "choices": [
      "Only in French opera houses",
      "Only in Japanese flute music",
      "Black communities in Brazil"
    ],
    "answer": 2
  },
  {
    "id": "zizi-quiz-10",
    "person": "zizi",
    "factId": "zizi-29",
    "prompt": "Who helped create Afrobeat in Nigeria?",
    "choices": [
      "Fela Kuti",
      "Umm Kulthum",
      "Frankie Knuckles"
    ],
    "answer": 0
  },
  {
    "id": "metronome-quiz-01",
    "person": "metronome",
    "factId": "metronome-01",
    "prompt": "Which description of Metronome is true?",
    "choices": [
      "A made-up visitor who works like a clock",
      "A real singer from South Africa",
      "A real composer from the 1700s"
    ],
    "answer": 0
  },
  {
    "id": "metronome-quiz-02",
    "person": "metronome",
    "factId": "metronome-04",
    "prompt": "What do the metronome marks in Beethoven’s music tell players?",
    "choices": [
      "To show what color to paint a piano",
      "How fast to play",
      "To show where the audience should sit"
    ],
    "answer": 1
  },
  {
    "id": "metronome-quiz-03",
    "person": "metronome",
    "factId": "metronome-05",
    "prompt": "How often does a metronome beat at 60 beats per minute?",
    "choices": [
      "Once each minute",
      "Twice each second",
      "Once each second"
    ],
    "answer": 2
  },
  {
    "id": "metronome-quiz-04",
    "person": "metronome",
    "factId": "metronome-07",
    "prompt": "What changes the speed of a wind-up metronome?",
    "choices": [
      "Moving the weight on its swinging arm",
      "Adding a new string",
      "Blowing harder into it"
    ],
    "answer": 0
  },
  {
    "id": "metronome-quiz-05",
    "person": "metronome",
    "factId": "metronome-11",
    "prompt": "What happens in a polyrhythm?",
    "choices": [
      "Everyone stops playing",
      "Only one note plays with no beat",
      "Different beat patterns play at the same time"
    ],
    "answer": 2
  },
  {
    "id": "metronome-quiz-06",
    "person": "metronome",
    "factId": "metronome-16",
    "prompt": "What did Wendy Carlos use on Switched-On Bach?",
    "choices": [
      "A player piano",
      "A synthesizer that makes sound with electricity",
      "A drum with no other instruments"
    ],
    "answer": 1
  },
  {
    "id": "metronome-quiz-07",
    "person": "metronome",
    "factId": "metronome-21",
    "prompt": "Who made the first Doctor Who theme sound electronic?",
    "choices": [
      "Clara Rockmore",
      "Delia Derbyshire",
      "Beethoven"
    ],
    "answer": 1
  },
  {
    "id": "metronome-quiz-08",
    "person": "metronome",
    "factId": "metronome-23",
    "prompt": "How do you play a theremin?",
    "choices": [
      "Move your hands near its antennas",
      "Press keys that strike strings",
      "Blow air through its mouthpiece"
    ],
    "answer": 0
  },
  {
    "id": "metronome-quiz-09",
    "person": "metronome",
    "factId": "metronome-27",
    "prompt": "What kind of information can MIDI messages carry?",
    "choices": [
      "Pictures of musicians",
      "Recordings of a crowd cheering",
      "Instructions to start or stop notes"
    ],
    "answer": 2
  },
  {
    "id": "metronome-quiz-10",
    "person": "metronome",
    "factId": "metronome-28",
    "prompt": "What can a drum machine repeat?",
    "choices": [
      "A pattern of drum sounds",
      "A film’s moving pictures",
      "The words printed in a book"
    ],
    "answer": 0
  },
  {
    "id": "schoenberg-quiz-01",
    "person": "schoenberg",
    "factId": "schoenberg-01",
    "prompt": "Where was Arnold Schoenberg born?",
    "choices": [
      "Vienna",
      "Berlin",
      "London"
    ],
    "answer": 0
  },
  {
    "id": "schoenberg-quiz-02",
    "person": "schoenberg",
    "factId": "schoenberg-02",
    "prompt": "How did Schoenberg learn much about music?",
    "choices": [
      "Only by listening to radio shows",
      "By reading music and playing in small groups",
      "Only by studying dance steps"
    ],
    "answer": 1
  },
  {
    "id": "schoenberg-quiz-03",
    "person": "schoenberg",
    "factId": "schoenberg-10",
    "prompt": "What is a feature of atonal music?",
    "choices": [
      "One key must always feel like home.",
      "It cannot use written rhythms.",
      "It has no main key that feels like home."
    ],
    "answer": 2
  },
  {
    "id": "schoenberg-quiz-04",
    "person": "schoenberg",
    "factId": "schoenberg-16",
    "prompt": "What did Schoenberg’s twelve-tone method use?",
    "choices": [
      "All 12 kinds of notes in a set order",
      "Only the notes of a major scale",
      "A list of 12 different instruments"
    ],
    "answer": 0
  },
  {
    "id": "schoenberg-quiz-05",
    "person": "schoenberg",
    "factId": "schoenberg-09",
    "prompt": "Did all of Schoenberg’s music use his twelve-tone method?",
    "choices": [
      "Yes, every piece used it.",
      "No, some of his music uses a home key.",
      "No, because he never used that method."
    ],
    "answer": 1
  },
  {
    "id": "schoenberg-quiz-06",
    "person": "schoenberg",
    "factId": "schoenberg-22",
    "prompt": "What did Schoenberg do besides writing music?",
    "choices": [
      "Built concert pianos",
      "Made clay pots",
      "Painted pictures, often of himself"
    ],
    "answer": 2
  },
  {
    "id": "schoenberg-quiz-07",
    "person": "schoenberg",
    "factId": "schoenberg-24",
    "prompt": "What did Schoenberg’s student Alban Berg later write?",
    "choices": [
      "Operas, with stories sung on stage",
      "Only books about dance steps",
      "Only drum practice pieces"
    ],
    "answer": 0
  },
  {
    "id": "schoenberg-quiz-08",
    "person": "schoenberg",
    "factId": "schoenberg-25",
    "prompt": "What were Anton Webern’s pieces known for?",
    "choices": [
      "Long marches for a large band",
      "Short works packed with music ideas",
      "Only easy songs for children"
    ],
    "answer": 1
  },
  {
    "id": "schoenberg-quiz-09",
    "person": "schoenberg",
    "factId": "schoenberg-28",
    "prompt": "Where did Schoenberg move in 1933?",
    "choices": [
      "Italy",
      "Poland",
      "The United States"
    ],
    "answer": 2
  },
  {
    "id": "schoenberg-quiz-10",
    "person": "schoenberg",
    "factId": "schoenberg-29",
    "prompt": "In which city did Schoenberg teach in the United States?",
    "choices": [
      "Los Angeles",
      "Chicago",
      "New York"
    ],
    "answer": 0
  },
  {
    "id": "handel-quiz-01",
    "person": "handel",
    "factId": "handel-01",
    "prompt": "In which city was George Frideric Handel born?",
    "choices": [
      "Halle",
      "London",
      "Vienna"
    ],
    "answer": 0
  },
  {
    "id": "handel-quiz-02",
    "person": "handel",
    "factId": "handel-02",
    "prompt": "What did Handel and J. S. Bach have in common?",
    "choices": [
      "They grew up in the same family.",
      "They were born in the same year.",
      "They both lived only in Paris."
    ],
    "answer": 1
  },
  {
    "id": "handel-quiz-03",
    "person": "handel",
    "factId": "handel-03",
    "prompt": "What did Handel learn to do when he was young?",
    "choices": [
      "Only sing and dance",
      "Only play the drums",
      "Play violin and keyboards, and write music"
    ],
    "answer": 2
  },
  {
    "id": "handel-quiz-04",
    "person": "handel",
    "factId": "handel-04",
    "prompt": "What is an opera, like those Handel worked on?",
    "choices": [
      "A story told with singing and acting",
      "A piece for drums alone",
      "A painting of a music show"
    ],
    "answer": 0
  },
  {
    "id": "handel-quiz-05",
    "person": "handel",
    "factId": "handel-10",
    "prompt": "Which city did Handel make his home in 1712?",
    "choices": [
      "Venice",
      "London",
      "Warsaw"
    ],
    "answer": 1
  },
  {
    "id": "handel-quiz-06",
    "person": "handel",
    "factId": "handel-12",
    "prompt": "Which language did Handel use for his oratorios in London?",
    "choices": [
      "Italian",
      "French",
      "English"
    ],
    "answer": 2
  },
  {
    "id": "handel-quiz-07",
    "person": "handel",
    "factId": "handel-17",
    "prompt": "What kind of event used Handel’s Water Music in 1717?",
    "choices": [
      "A royal boat trip on the River Thames",
      "A royal crowning in a church",
      "A lesson for young violin players"
    ],
    "answer": 0
  },
  {
    "id": "handel-quiz-08",
    "person": "handel",
    "factId": "handel-20",
    "prompt": "Where was Handel’s Messiah first performed?",
    "choices": [
      "London",
      "Dublin",
      "Hamburg"
    ],
    "answer": 1
  },
  {
    "id": "handel-quiz-09",
    "person": "handel",
    "factId": "handel-25",
    "prompt": "Why did Handel give concerts for the Foundling Hospital?",
    "choices": [
      "To raise money for a new opera house",
      "To pay for a royal boat trip",
      "To help children in need"
    ],
    "answer": 2
  },
  {
    "id": "handel-quiz-10",
    "person": "handel",
    "factId": "handel-30",
    "prompt": "In which city did Handel die in 1759?",
    "choices": [
      "London",
      "Paris",
      "Venice"
    ],
    "answer": 0
  },
  {
    "id": "vivaldi-quiz-01",
    "person": "vivaldi",
    "factId": "vivaldi-01",
    "prompt": "In which city was Antonio Vivaldi born?",
    "choices": [
      "Venice",
      "Vienna",
      "Paris"
    ],
    "answer": 0
  },
  {
    "id": "vivaldi-quiz-02",
    "person": "vivaldi",
    "factId": "vivaldi-02",
    "prompt": "Who helped Vivaldi learn to play the violin?",
    "choices": [
      "His brother",
      "His father",
      "His mother"
    ],
    "answer": 1
  },
  {
    "id": "vivaldi-quiz-03",
    "person": "vivaldi",
    "factId": "vivaldi-05",
    "prompt": "Why was Vivaldi called the Red Priest?",
    "choices": [
      "He always wrote in red ink.",
      "His players all wore red.",
      "He had red hair."
    ],
    "answer": 2
  },
  {
    "id": "vivaldi-quiz-04",
    "person": "vivaldi",
    "factId": "vivaldi-07",
    "prompt": "Who did the Pietà, where Vivaldi worked, care for?",
    "choices": [
      "Girls in need",
      "Only princes from royal families",
      "Only people who made violins"
    ],
    "answer": 0
  },
  {
    "id": "vivaldi-quiz-05",
    "person": "vivaldi",
    "factId": "vivaldi-10",
    "prompt": "How many concertos did Vivaldi write?",
    "choices": [
      "Fewer than ten",
      "More than 500",
      "Exactly 100"
    ],
    "answer": 1
  },
  {
    "id": "vivaldi-quiz-06",
    "person": "vivaldi",
    "factId": "vivaldi-13",
    "prompt": "What makes up Vivaldi’s The Four Seasons?",
    "choices": [
      "Four songs for a choir",
      "Four pieces for drums",
      "Four violin concertos, one for each season"
    ],
    "answer": 2
  },
  {
    "id": "vivaldi-quiz-07",
    "person": "vivaldi",
    "factId": "vivaldi-17",
    "prompt": "What does the music in Vivaldi’s Spring sound like?",
    "choices": [
      "Birds, streams, and a storm",
      "Cold shivers and slipping on ice",
      "A harvest party and a hunt"
    ],
    "answer": 0
  },
  {
    "id": "vivaldi-quiz-08",
    "person": "vivaldi",
    "factId": "vivaldi-20",
    "prompt": "What does Vivaldi’s Winter help us picture?",
    "choices": [
      "Birds and streams",
      "Cold, shivering, and slipping on ice",
      "A harvest party and a hunt"
    ],
    "answer": 1
  },
  {
    "id": "vivaldi-quiz-09",
    "person": "vivaldi",
    "factId": "vivaldi-22",
    "prompt": "How do the three parts of many Vivaldi concertos go?",
    "choices": [
      "Slow, fast, slow",
      "The same slow speed in all three",
      "Fast, slow, fast"
    ],
    "answer": 2
  },
  {
    "id": "vivaldi-quiz-10",
    "person": "vivaldi",
    "factId": "vivaldi-28",
    "prompt": "Who made keyboard versions of some Vivaldi concertos?",
    "choices": [
      "J. S. Bach",
      "Claude Debussy",
      "Johannes Brahms"
    ],
    "answer": 0
  }
];
 for(const question of QUESTIONS){Object.freeze(question.choices);Object.freeze(question);}
 return Object.freeze(QUESTIONS);
});
