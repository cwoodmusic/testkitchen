/* Ten fourth-grade-friendly facts per musician. Reference reading: docs/music-history.md. */
(function(root){
 const people={
  "bach": {
    "name": "J. S. Bach",
    "facts": [
      {
        "id": "bach-01",
        "text": "Bach was born in Eisenach in 1685. Many people in his large family made music."
      },
      {
        "id": "bach-02",
        "text": "Bach played the organ before leading church music in Leipzig. An organ is a large instrument with keys."
      },
      {
        "id": "bach-04",
        "text": "Bach wrote church pieces called cantatas. They bring singers and instruments together."
      },
      {
        "id": "bach-05",
        "text": "In a fugue, one musical idea starts in one part. Other parts then play that same idea."
      },
      {
        "id": "bach-10",
        "text": "Bach wrote six sets of pieces for cello. One cello can suggest a tune, beat, and chords."
      },
      {
        "id": "bach-15",
        "text": "Anna Magdalena Bach was Bach’s second wife. She also earned her living as a singer."
      },
      {
        "id": "bach-17",
        "text": "Bach’s son Carl Philipp Emanuel became a famous composer. Composers write music."
      },
      {
        "id": "bach-19",
        "text": "Handel was born in 1685, the same year as Bach."
      },
      {
        "id": "bach-22",
        "text": "Vivaldi’s concertos gave Bach ideas. These pieces have a solo player or small group play with a larger group."
      },
      {
        "id": "bach-28",
        "text": "Baroque music often adds small extra notes to a tune. It can also use a low part that repeats."
      }
    ]
  },
  "mozart": {
    "name": "Wolfgang Amadeus Mozart",
    "facts": [
      {
        "id": "mozart-01",
        "text": "Mozart was born in Salzburg in 1756."
      },
      {
        "id": "mozart-03",
        "text": "Mozart’s sister Maria Anna was called Nannerl. She was a skilled keyboard player."
      },
      {
        "id": "mozart-04",
        "text": "Mozart and Nannerl traveled around Europe to play music as children."
      },
      {
        "id": "mozart-06",
        "text": "Mozart wrote operas, symphonies, and concertos. An opera tells a story with singing."
      },
      {
        "id": "mozart-07",
        "text": "In 1781, Mozart moved to Vienna. He wanted more freedom in his work."
      },
      {
        "id": "mozart-08",
        "text": "Mozart often played the main piano part in his own concertos. In these pieces, a piano plays with an orchestra."
      },
      {
        "id": "mozart-12",
        "text": "In The Magic Flute, performers speak some lines and sing others."
      },
      {
        "id": "mozart-21",
        "text": "Joseph Haydn and Mozart liked and respected each other’s music."
      },
      {
        "id": "mozart-23",
        "text": "A string quartet usually has four players. They play two violins, a viola, and a cello."
      },
      {
        "id": "mozart-30",
        "text": "Mozart’s wife Constanze helped save and share his music after he died."
      }
    ]
  },
  "beethoven": {
    "name": "Ludwig van Beethoven",
    "facts": [
      {
        "id": "beethoven-01",
        "text": "Beethoven was born in Bonn in 1770."
      },
      {
        "id": "beethoven-02",
        "text": "Beethoven moved to Vienna in 1792. He studied music with Joseph Haydn there."
      },
      {
        "id": "beethoven-03",
        "text": "Beethoven became known in Vienna for playing piano. He could also make up music as he played."
      },
      {
        "id": "beethoven-04",
        "text": "Beethoven finished nine symphonies. A symphony is a long piece for an orchestra, or large group of players."
      },
      {
        "id": "beethoven-05",
        "text": "Beethoven’s Fifth Symphony starts with a short rhythm. He uses that small idea to help build the whole piece."
      },
      {
        "id": "beethoven-06",
        "text": "Beethoven’s Sixth Symphony is called the Pastoral. Its music brings to mind scenes from nature."
      },
      {
        "id": "beethoven-07",
        "text": "Beethoven’s Ninth Symphony adds solo singers and a choir to the orchestra. A choir is a group of singers."
      },
      {
        "id": "beethoven-12",
        "text": "Fidelio is Beethoven’s only opera. An opera tells a story through singing."
      },
      {
        "id": "beethoven-17",
        "text": "Beethoven kept writing music even when his hearing became very poor."
      },
      {
        "id": "beethoven-22",
        "text": "Beethoven’s music links two time periods: Classical and Romantic. His ideas helped shape the music of the Romantic period."
      }
    ]
  },
  "clara": {
    "name": "Clara Schumann",
    "facts": [
      {
        "id": "clara-01",
        "text": "Clara Schumann was born in Leipzig in 1819. Her last name at birth was Wieck."
      },
      {
        "id": "clara-04",
        "text": "Clara became one of the top concert piano players of the 1800s."
      },
      {
        "id": "clara-05",
        "text": "Clara did more than perform music. She wrote music too."
      },
      {
        "id": "clara-06",
        "text": "Clara started her Piano Concerto in A minor as a teen. In a concerto, one instrument often stars with an orchestra."
      },
      {
        "id": "clara-09",
        "text": "Clara wrote songs, piano pieces, and chamber music. Chamber music is played by a small group."
      },
      {
        "id": "clara-12",
        "text": "Clara married Robert Schumann, who also wrote music, in 1840."
      },
      {
        "id": "clara-15",
        "text": "Clara also supported Johannes Brahms’s music. She played his works and helped more people hear them."
      },
      {
        "id": "clara-19",
        "text": "Clara helped make it common to play piano from memory. That means playing without looking at written music."
      },
      {
        "id": "clara-20",
        "text": "Clara began teaching piano in 1878 at the Hoch Conservatory in Frankfurt. A conservatory is a music school."
      },
      {
        "id": "clara-22",
        "text": "Fanny Hensel lived in the 1800s, like Clara. She also wrote music and played piano."
      }
    ]
  },
  "joplin": {
    "name": "Scott Joplin",
    "facts": [
      {
        "id": "joplin-01",
        "text": "Scott Joplin grew up near Texarkana. Many people in his family made music."
      },
      {
        "id": "joplin-02",
        "text": "Joplin played piano and wrote music as ragtime became popular."
      },
      {
        "id": "joplin-03",
        "text": "Ragtime often puts strong notes between the main beats. Another part keeps a steady beat."
      },
      {
        "id": "joplin-06",
        "text": "Maple Leaf Rag helped make Joplin famous."
      },
      {
        "id": "joplin-13",
        "text": "Joplin warned musicians not to play ragtime too fast."
      },
      {
        "id": "joplin-18",
        "text": "Joplin wrote Treemonisha, an opera. In an opera, singers act out a story."
      },
      {
        "id": "joplin-19",
        "text": "Treemonisha shows how learning can help people gain freedom and build a strong community."
      },
      {
        "id": "joplin-23",
        "text": "Joplin and Scott Hayden wrote several rags together."
      },
      {
        "id": "joplin-27",
        "text": "Tom Turpin played piano and wrote music. He helped shape ragtime in St. Louis."
      },
      {
        "id": "joplin-28",
        "text": "Ragtime helped shape early jazz. But ragtime and jazz are different kinds of music."
      }
    ]
  },
  "ellington": {
    "name": "Duke Ellington",
    "facts": [
      {
        "id": "ellington-01",
        "text": "Duke Ellington was born in Washington, D.C., in 1899. His birth name was Edward Kennedy Ellington."
      },
      {
        "id": "ellington-02",
        "text": "Ellington played piano, wrote music, and led a band."
      },
      {
        "id": "ellington-05",
        "text": "Radio shows helped people hear Ellington’s band far beyond the club."
      },
      {
        "id": "ellington-06",
        "text": "Ellington often wrote music to fit each band member’s own sound."
      },
      {
        "id": "ellington-12",
        "text": "Ellington’s song It Don’t Mean a Thing celebrates swing. Swing gives music a bouncy feel."
      },
      {
        "id": "ellington-15",
        "text": "Ellington wrote Black, Brown and Beige to tell parts of Black American history through music."
      },
      {
        "id": "ellington-16",
        "text": "Ellington wrote short songs and long suites. A suite is a set of pieces played together."
      },
      {
        "id": "ellington-17",
        "text": "Ellington and Billy Strayhorn wrote music together for many years."
      },
      {
        "id": "ellington-28",
        "text": "Ella Fitzgerald made an album of Ellington’s songs."
      },
      {
        "id": "ellington-29",
        "text": "Ellington received the Presidential Medal of Freedom in 1969."
      }
    ]
  },
  "ella": {
    "name": "Ella Fitzgerald",
    "facts": [
      {
        "id": "ella-01",
        "text": "Ella Fitzgerald was born in Newport News, Virginia, in 1917."
      },
      {
        "id": "ella-03",
        "text": "Ella won a talent contest at Harlem’s Apollo Theater in 1934."
      },
      {
        "id": "ella-04",
        "text": "Ella joined drummer Chick Webb’s band in the 1930s."
      },
      {
        "id": "ella-07",
        "text": "After Chick Webb died, Ella led his band for a time."
      },
      {
        "id": "ella-09",
        "text": "Scat singers make up sounds, such as ba-doo, instead of singing a song’s usual words."
      },
      {
        "id": "ella-11",
        "text": "People often called Ella the First Lady of Song."
      },
      {
        "id": "ella-12",
        "text": "Ella’s songbook albums shared songs by many great songwriters."
      },
      {
        "id": "ella-19",
        "text": "Ella made several famous albums of duets with Louis Armstrong. A duet is music for two performers."
      },
      {
        "id": "ella-24",
        "text": "In Berlin in 1960, Ella forgot some words to Mack the Knife. She made up new words as she sang."
      },
      {
        "id": "ella-27",
        "text": "Sarah Vaughan was another great jazz singer from Ella’s time."
      }
    ]
  },
  "nina": {
    "name": "Nina Simone",
    "facts": [
      {
        "id": "nina-02",
        "text": "Nina Simone started playing piano when she was a young child."
      },
      {
        "id": "nina-03",
        "text": "Nina first trained to play classical piano music. Later, she became famous for singing."
      },
      {
        "id": "nina-04",
        "text": "Bach’s music helped shape the way Nina played piano."
      },
      {
        "id": "nina-10",
        "text": "Nina mixed many kinds of music. She used classical music, blues, gospel, folk, and jazz."
      },
      {
        "id": "nina-12",
        "text": "Nina often played piano while she sang. She made the music that backed her own voice."
      },
      {
        "id": "nina-15",
        "text": "Nina wrote Mississippi Goddam after racist attacks in 1963. The attacks targeted Black people."
      },
      {
        "id": "nina-16",
        "text": "Mississippi Goddam became a key song in the fight for equal rights."
      },
      {
        "id": "nina-18",
        "text": "Four Women tells four stories about racism. It shows how unfair ideas about Black women can hurt."
      },
      {
        "id": "nina-20",
        "text": "To Be Young, Gifted and Black honors Lorraine Hansberry. Hansberry wrote plays for the stage."
      },
      {
        "id": "nina-25",
        "text": "Miriam Makeba was another singer of Nina’s time. She used songs to fight unfair laws."
      }
    ]
  },
  "miles": {
    "name": "Miles Davis",
    "facts": [
      {
        "id": "miles-03",
        "text": "Miles Davis played trumpet and led famous jazz bands."
      },
      {
        "id": "miles-04",
        "text": "Miles moved to New York in 1944 to study music. His school is now called Juilliard."
      },
      {
        "id": "miles-06",
        "text": "Early in his career, Miles played with Charlie Parker. Parker played the saxophone."
      },
      {
        "id": "miles-07",
        "text": "Bebop often has fast tunes and tricky chords. A chord is a group of notes played together."
      },
      {
        "id": "miles-12",
        "text": "Miles’s first famous quintet was a band of five. John Coltrane played tenor saxophone in it."
      },
      {
        "id": "miles-14",
        "text": "Miles recorded the album Kind of Blue in 1959."
      },
      {
        "id": "miles-15",
        "text": "Kind of Blue uses modal jazz. Players use sets of notes to make up their own music."
      },
      {
        "id": "miles-22",
        "text": "Tony Williams was still a teen when he joined Miles’s band."
      },
      {
        "id": "miles-24",
        "text": "Miles’s Bitches Brew mixed jazz with electric instruments and beats shaped by rock music."
      },
      {
        "id": "miles-26",
        "text": "Miles often used a Harmon mute in his trumpet. The tool helped him make a close, focused sound."
      }
    ]
  },
  "chopin": {
    "name": "Frédéric Chopin",
    "facts": [
      {
        "id": "chopin-01",
        "text": "Chopin was born near Warsaw in 1810."
      },
      {
        "id": "chopin-05",
        "text": "Chopin left Poland in 1830. Later, he made his home in Paris."
      },
      {
        "id": "chopin-06",
        "text": "Almost every piece Chopin wrote includes a piano."
      },
      {
        "id": "chopin-08",
        "text": "Chopin wrote études, or study pieces, to teach hard piano skills. They also show feelings through music."
      },
      {
        "id": "chopin-11",
        "text": "A mazurka is a kind of Polish dance. Chopin used its rhythms in his piano music."
      },
      {
        "id": "chopin-18",
        "text": "Chopin’s waltzes were often made for listening. They were not always meant for dancing at a ball."
      },
      {
        "id": "chopin-21",
        "text": "Chopin earned much of his money in Paris by teaching piano."
      },
      {
        "id": "chopin-22",
        "text": "Chopin often liked playing for small groups more than for large crowds."
      },
      {
        "id": "chopin-23",
        "text": "Franz Liszt was part of Chopin’s music circle in Paris. He also played piano and wrote music."
      },
      {
        "id": "chopin-24",
        "text": "Robert Schumann praised Chopin’s early music in his writing."
      }
    ]
  },
  "haydn": {
    "name": "Joseph Haydn",
    "facts": [
      {
        "id": "haydn-01",
        "text": "Joseph Haydn was born in Austria in 1732."
      },
      {
        "id": "haydn-02",
        "text": "As a boy, Haydn sang in a choir in Vienna."
      },
      {
        "id": "haydn-03",
        "text": "Haydn worked for the Esterházy family for many years. They paid him to write music and lead concerts."
      },
      {
        "id": "haydn-05",
        "text": "Haydn helped shape the symphony, a long piece for an orchestra. An orchestra is a large group of players."
      },
      {
        "id": "haydn-07",
        "text": "A string quartet usually has two violins, a viola, and a cello. These four string instruments play together."
      },
      {
        "id": "haydn-10",
        "text": "Haydn’s Surprise Symphony has a sudden loud chord in a slow part. A chord means notes played at the same time."
      },
      {
        "id": "haydn-12",
        "text": "In the Farewell Symphony, players leave one at a time. Two violin players stay to finish."
      },
      {
        "id": "haydn-15",
        "text": "Haydn visited London twice in the 1790s. His concerts there were a big success."
      },
      {
        "id": "haydn-24",
        "text": "Mozart and Haydn each thought the other wrote great music."
      },
      {
        "id": "haydn-26",
        "text": "Beethoven moved to Vienna in 1792. He studied music with Haydn there."
      }
    ]
  },
  "dj": {
    "name": "DJ Coda",
    "facts": [
      {
        "id": "dj-01",
        "text": "DJ Coda is a made-up arcade host. These facts tell real stories about DJs and dance music."
      },
      {
        "id": "dj-02",
        "text": "Early disc jockeys, or DJs, chose and played records for a crowd."
      },
      {
        "id": "dj-05",
        "text": "Beatmatching lines up the beats in two songs. This helps one song flow smoothly into the next."
      },
      {
        "id": "dj-09",
        "text": "Black, Latino, and LGBTQ+ people helped disco grow. Many shared this music in clubs."
      },
      {
        "id": "dj-15",
        "text": "DJ Kool Herc held parties in the Bronx in New York. These parties helped hip-hop get its start."
      },
      {
        "id": "dj-20",
        "text": "Scratching means moving a record back and forth. The recorded sounds become part of a new rhythm."
      },
      {
        "id": "dj-22",
        "text": "House music grew in Chicago dance clubs in the 1980s."
      },
      {
        "id": "dj-23",
        "text": "Frankie Knuckles helped shape house music at a Chicago club. The club was called the Warehouse."
      },
      {
        "id": "dj-29",
        "text": "Sampling uses a piece of recorded sound in new music."
      },
      {
        "id": "dj-30",
        "text": "A remix changes a recording in new ways. It may change the song’s parts, beat, or sound."
      }
    ]
  },
  "vee-jay": {
    "name": "Vee Jay",
    "facts": [
      {
        "id": "vee-jay-01",
        "text": "Vee Jay is a made-up arcade visitor. These facts tell real stories about music videos and recordings."
      },
      {
        "id": "vee-jay-03",
        "text": "Thomas Edison showed his phonograph in 1877. This machine could record sound and play it back."
      },
      {
        "id": "vee-jay-06",
        "text": "In the 1920s, recording studios began using microphones. This new way of recording used electricity."
      },
      {
        "id": "vee-jay-10",
        "text": "Multitrack recording lets musicians record each part on its own. They can put the parts together later."
      },
      {
        "id": "vee-jay-15",
        "text": "Disney’s Fantasia came out in 1940. Its cartoons showed stories and pictures set to music played by an orchestra."
      },
      {
        "id": "vee-jay-21",
        "text": "The Beatles made short films to share their songs. These films helped shape the music videos we watch today."
      },
      {
        "id": "vee-jay-25",
        "text": "Michael Jackson’s Thriller video told a story. It also used big dance scenes planned for the film."
      },
      {
        "id": "vee-jay-28",
        "text": "A film’s soundtrack may use new music written for that film. It can also use older recordings."
      },
      {
        "id": "vee-jay-29",
        "text": "Foley artists make sound effects for films. They match sounds to actions, like steps, on screen."
      },
      {
        "id": "vee-jay-30",
        "text": "Digital editing helps people match recorded music to moving pictures. They can line up sounds and pictures very closely."
      }
    ]
  },
  "zizi": {
    "name": "Zizi",
    "facts": [
      {
        "id": "zizi-01",
        "text": "Zizi is a made-up visitor from space. These facts explore real ways people make music on Earth."
      },
      {
        "id": "zizi-02",
        "text": "The sitar is a string instrument that players pluck. It is used in Hindustani music from northern India."
      },
      {
        "id": "zizi-05",
        "text": "A raga gives a guide for making tunes in Indian classical music."
      },
      {
        "id": "zizi-06",
        "text": "A tala groups beats in a cycle that repeats. It helps keep time in Indian classical music."
      },
      {
        "id": "zizi-09",
        "text": "In Indonesia, gamelan groups often use bronze gongs. They also play instruments with metal bars that players hit."
      },
      {
        "id": "zizi-13",
        "text": "Griots in West Africa share stories about the past. They keep history alive through words, music, and performances."
      },
      {
        "id": "zizi-17",
        "text": "Umm Kulthum was a singer from Egypt. Her broadcasts reached many people."
      },
      {
        "id": "zizi-23",
        "text": "Mariachi groups from Mexico often play violins and trumpets. They also use several kinds of guitar."
      },
      {
        "id": "zizi-26",
        "text": "Samba has deep roots in the music of Black communities in Brazil."
      },
      {
        "id": "zizi-29",
        "text": "Fela Kuti helped create Afrobeat in Nigeria. He used large bands and long, repeating rhythms."
      }
    ]
  },
  "metronome": {
    "name": "Metronome",
    "facts": [
      {
        "id": "metronome-01",
        "text": "Metronome is a made-up visitor who works like a clock. These facts tell real stories about rhythm and music tools."
      },
      {
        "id": "metronome-04",
        "text": "Beethoven was among the first famous composers to print metronome marks. These marks tell players how fast to play."
      },
      {
        "id": "metronome-05",
        "text": "A metronome makes steady beats to help players keep time. At 60 beats per minute, it makes one beat each second."
      },
      {
        "id": "metronome-07",
        "text": "A wind-up metronome has a swinging arm called a pendulum. Moving its weight changes the speed of the beat."
      },
      {
        "id": "metronome-11",
        "text": "A polyrhythm has different beat patterns played at the same time."
      },
      {
        "id": "metronome-16",
        "text": "Wendy Carlos played Bach’s music on Switched-On Bach. She used a Moog synthesizer, an instrument that makes sounds with electricity."
      },
      {
        "id": "metronome-21",
        "text": "Delia Derbyshire made the electronic version of the first Doctor Who theme tune."
      },
      {
        "id": "metronome-23",
        "text": "To play a theremin, move your hands near its antennas. You do not need to touch the instrument."
      },
      {
        "id": "metronome-27",
        "text": "MIDI messages can say when to start or stop a note. They give instructions, not recordings of sound."
      },
      {
        "id": "metronome-28",
        "text": "A drum machine can repeat a pattern of drum sounds. A person sets the pattern and its speed."
      }
    ]
  },
  "schoenberg": {
    "name": "Arnold Schoenberg",
    "facts": [
      {
        "id": "schoenberg-01",
        "text": "Arnold Schoenberg was born in Vienna in 1874."
      },
      {
        "id": "schoenberg-02",
        "text": "Schoenberg learned by reading written music. He also played music with small groups."
      },
      {
        "id": "schoenberg-10",
        "text": "Atonal music has no main key that feels like home. Schoenberg wrote this kind of music."
      },
      {
        "id": "schoenberg-16",
        "text": "Schoenberg used all 12 kinds of notes in a set order. This became his twelve-tone method."
      },
      {
        "id": "schoenberg-09",
        "text": "Some of Schoenberg’s music uses a home key. Not all of it uses his twelve-tone method."
      },
      {
        "id": "schoenberg-22",
        "text": "Schoenberg painted pictures too. Many were pictures of himself."
      },
      {
        "id": "schoenberg-24",
        "text": "Alban Berg studied music with Schoenberg. He later wrote operas, or stories sung on stage."
      },
      {
        "id": "schoenberg-25",
        "text": "Anton Webern studied with Schoenberg. He wrote short pieces packed with music ideas."
      },
      {
        "id": "schoenberg-28",
        "text": "Schoenberg was Jewish and left Europe for the United States in 1933. The Nazis were hurting Jewish people and taking away their rights."
      },
      {
        "id": "schoenberg-29",
        "text": "Schoenberg taught music in Los Angeles, including at UCLA."
      }
    ]
  },
  "handel": {
    "name": "George Frideric Handel",
    "facts": [
      {
        "id": "handel-01",
        "text": "George Frideric Handel was born in Halle in 1685."
      },
      {
        "id": "handel-02",
        "text": "Handel and J. S. Bach were both born in 1685."
      },
      {
        "id": "handel-03",
        "text": "As a child, Handel learned violin and keyboard instruments. He also learned to write music."
      },
      {
        "id": "handel-04",
        "text": "As a young man, Handel worked at Hamburg’s opera house. An opera tells a story with singing and acting."
      },
      {
        "id": "handel-10",
        "text": "Handel made London his home in 1712."
      },
      {
        "id": "handel-12",
        "text": "In London, Handel wrote operas in Italian and oratorios in English. An oratorio is a sung story, usually without stage acting."
      },
      {
        "id": "handel-17",
        "text": "Handel’s Water Music was played for a royal boat trip. It took place on the River Thames in 1717."
      },
      {
        "id": "handel-20",
        "text": "Handel’s Messiah is a famous oratorio. It was first performed in Dublin in 1742."
      },
      {
        "id": "handel-25",
        "text": "Handel gave Messiah concerts to help London’s Foundling Hospital. This home cared for children in need."
      },
      {
        "id": "handel-30",
        "text": "Handel died in London in 1759. He was buried in Westminster Abbey."
      }
    ]
  },
  "vivaldi": {
    "name": "Antonio Vivaldi",
    "facts": [
      {
        "id": "vivaldi-01",
        "text": "Antonio Vivaldi was born in Venice in 1678."
      },
      {
        "id": "vivaldi-02",
        "text": "Vivaldi’s father played the violin. He helped teach his son to play it too."
      },
      {
        "id": "vivaldi-05",
        "text": "Vivaldi was a priest. People called him the Red Priest because he had red hair."
      },
      {
        "id": "vivaldi-07",
        "text": "Vivaldi worked at the Pietà in Venice. It cared for girls in need and had a famous music program."
      },
      {
        "id": "vivaldi-10",
        "text": "Vivaldi wrote more than 500 concertos. In a concerto, a solo player often plays with a larger group."
      },
      {
        "id": "vivaldi-13",
        "text": "Vivaldi’s The Four Seasons is a set of four violin concertos. Each one shows a different season of the year."
      },
      {
        "id": "vivaldi-17",
        "text": "In Spring, Vivaldi’s music sounds like singing birds, streams, and a storm."
      },
      {
        "id": "vivaldi-20",
        "text": "In Winter, Vivaldi’s music sounds like shivering in the cold. It also makes us picture slipping on ice."
      },
      {
        "id": "vivaldi-22",
        "text": "Many Vivaldi concertos have three main sections. Their speeds go fast, then slow, then fast."
      },
      {
        "id": "vivaldi-28",
        "text": "J. S. Bach made new versions of some Vivaldi concertos for keyboard instruments."
      }
    ]
  }
};
 for(const person of Object.values(people)){person.facts.forEach(Object.freeze);Object.freeze(person.facts);Object.freeze(person);}
 const data=Object.freeze(people);if(typeof module==='object'&&module.exports)module.exports=data;if(root)root.CodaMusicHistoryData=data;
})(typeof window==='undefined'?null:window);
