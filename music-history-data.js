/* Short, authored history facts. Reference reading: docs/music-history.md. */
(function(root){
 const people={
  "bach": {
    "name": "J. S. Bach",
    "facts": [
      {
        "id": "bach-01",
        "text": "Bach was born in Eisenach in 1685, into a large family of musicians."
      },
      {
        "id": "bach-02",
        "text": "Bach worked as an organist before becoming a church music director in Leipzig."
      },
      {
        "id": "bach-03",
        "text": "In 1723, Bach became cantor at Leipzig’s St. Thomas School."
      },
      {
        "id": "bach-04",
        "text": "Bach often wrote cantatas for church services, combining singers and instruments."
      },
      {
        "id": "bach-05",
        "text": "A fugue lets a musical subject enter in different voices, one after another."
      },
      {
        "id": "bach-06",
        "text": "Bach’s Well-Tempered Clavier has preludes and fugues in all 24 major and minor keys."
      },
      {
        "id": "bach-07",
        "text": "Bach wrote two books of the Well-Tempered Clavier, completed about 20 years apart."
      },
      {
        "id": "bach-08",
        "text": "The six Brandenburg Concertos explore different combinations of solo instruments."
      },
      {
        "id": "bach-09",
        "text": "Bach dedicated the Brandenburg Concertos to the Margrave of Brandenburg in 1721."
      },
      {
        "id": "bach-10",
        "text": "Bach’s six cello suites let one instrument suggest melody, rhythm, and harmony."
      },
      {
        "id": "bach-11",
        "text": "The Goldberg Variations begin with an aria and return to it at the end."
      },
      {
        "id": "bach-12",
        "text": "Bach’s St. Matthew Passion tells its story through soloists, choirs, and orchestra."
      },
      {
        "id": "bach-13",
        "text": "Bach wrote much of his instrumental music while working at the court in Köthen."
      },
      {
        "id": "bach-14",
        "text": "Bach’s first wife, Maria Barbara Bach, came from the extended Bach family."
      },
      {
        "id": "bach-15",
        "text": "Anna Magdalena Bach was a professional singer as well as Bach’s second wife."
      },
      {
        "id": "bach-16",
        "text": "Notebooks associated with Anna Magdalena preserve music used in the Bach household."
      },
      {
        "id": "bach-17",
        "text": "Bach’s son Carl Philipp Emanuel became an important composer in his own right."
      },
      {
        "id": "bach-18",
        "text": "Bach’s son Johann Christian worked in London and influenced the young Mozart."
      },
      {
        "id": "bach-19",
        "text": "Handel was born in 1685, the same year as Bach."
      },
      {
        "id": "bach-20",
        "text": "Handel built much of his career in London, while Bach worked in German cities."
      },
      {
        "id": "bach-21",
        "text": "Domenico Scarlatti was also born in 1685 and became famous for keyboard sonatas."
      },
      {
        "id": "bach-22",
        "text": "Vivaldi’s concertos helped shape Bach’s understanding of concerto writing."
      },
      {
        "id": "bach-23",
        "text": "Bach arranged concertos by Vivaldi for keyboard instruments."
      },
      {
        "id": "bach-24",
        "text": "Georg Philipp Telemann was a friend of Bach and godfather to his son Carl Philipp Emanuel."
      },
      {
        "id": "bach-25",
        "text": "Bach admired Dieterich Buxtehude and traveled to Lübeck to hear him in 1705."
      },
      {
        "id": "bach-26",
        "text": "Élisabeth Jacquet de La Guerre was a French harpsichordist and composer during Bach’s lifetime."
      },
      {
        "id": "bach-27",
        "text": "François Couperin wrote keyboard pieces in France while Bach worked in German lands."
      },
      {
        "id": "bach-28",
        "text": "The Baroque era included both richly ornamented melodies and clear repeating bass patterns."
      },
      {
        "id": "bach-29",
        "text": "Bach died in Leipzig in 1750."
      },
      {
        "id": "bach-30",
        "text": "In 1829, Mendelssohn directed a performance of Bach’s St. Matthew Passion that helped renew interest in it."
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
        "id": "mozart-02",
        "text": "Mozart’s father, Leopold, was a musician and an influential violin teacher."
      },
      {
        "id": "mozart-03",
        "text": "Mozart’s sister Maria Anna, nicknamed Nannerl, was an accomplished keyboard player."
      },
      {
        "id": "mozart-04",
        "text": "Mozart and Nannerl toured Europe as child performers."
      },
      {
        "id": "mozart-05",
        "text": "As a child, Mozart played for courts and audiences far from Salzburg."
      },
      {
        "id": "mozart-06",
        "text": "Mozart wrote music in many forms, including operas, symphonies, and concertos."
      },
      {
        "id": "mozart-07",
        "text": "In 1781, Mozart settled in Vienna and pursued work beyond a single court employer."
      },
      {
        "id": "mozart-08",
        "text": "Mozart often performed as the soloist in his own piano concertos."
      },
      {
        "id": "mozart-09",
        "text": "A concerto sets a solo instrument, or a group of soloists, against an ensemble."
      },
      {
        "id": "mozart-10",
        "text": "Mozart’s The Marriage of Figaro is an opera with a libretto by Lorenzo Da Ponte."
      },
      {
        "id": "mozart-11",
        "text": "Da Ponte also wrote the librettos for Mozart’s Don Giovanni and Così fan tutte."
      },
      {
        "id": "mozart-12",
        "text": "The Magic Flute combines spoken dialogue with singing."
      },
      {
        "id": "mozart-13",
        "text": "The Magic Flute was first performed in Vienna in 1791."
      },
      {
        "id": "mozart-14",
        "text": "Mozart wrote The Magic Flute with theater-maker Emanuel Schikaneder."
      },
      {
        "id": "mozart-15",
        "text": "Mozart’s Clarinet Concerto was written for the clarinetist Anton Stadler."
      },
      {
        "id": "mozart-16",
        "text": "Mozart’s Eine kleine Nachtmusik is a serenade for strings."
      },
      {
        "id": "mozart-17",
        "text": "Mozart’s Symphony No. 41 is commonly called the Jupiter Symphony."
      },
      {
        "id": "mozart-18",
        "text": "Mozart left his Requiem unfinished when he died in 1791."
      },
      {
        "id": "mozart-19",
        "text": "Franz Xaver Süssmayr completed the best-known early performing version of Mozart’s Requiem."
      },
      {
        "id": "mozart-20",
        "text": "The Köchel catalogue organizes Mozart’s works; its numbers often begin with K."
      },
      {
        "id": "mozart-21",
        "text": "Joseph Haydn and Mozart admired one another’s music."
      },
      {
        "id": "mozart-22",
        "text": "Mozart dedicated a set of six string quartets to Haydn."
      },
      {
        "id": "mozart-23",
        "text": "A string quartet usually has two violins, a viola, and a cello."
      },
      {
        "id": "mozart-24",
        "text": "Johann Christian Bach met the young Mozart in London and influenced his music."
      },
      {
        "id": "mozart-25",
        "text": "Christoph Willibald Gluck sought to make opera’s music serve its drama more directly."
      },
      {
        "id": "mozart-26",
        "text": "Antonio Salieri was a successful composer and teacher in Mozart’s Vienna."
      },
      {
        "id": "mozart-27",
        "text": "There is no sound historical evidence that Salieri poisoned Mozart."
      },
      {
        "id": "mozart-28",
        "text": "Marianna Martines was a composer, keyboard player, and singer in Vienna during Mozart’s lifetime."
      },
      {
        "id": "mozart-29",
        "text": "Beethoven was a teenager when Mozart’s late operas were first performed."
      },
      {
        "id": "mozart-30",
        "text": "Mozart’s wife Constanze helped preserve and promote his music after his death."
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
        "text": "Beethoven moved to Vienna in 1792 and studied with Joseph Haydn."
      },
      {
        "id": "beethoven-03",
        "text": "Beethoven first gained attention in Vienna as a pianist and improviser."
      },
      {
        "id": "beethoven-04",
        "text": "Beethoven wrote nine completed symphonies."
      },
      {
        "id": "beethoven-05",
        "text": "The opening of Beethoven’s Fifth Symphony builds a huge work from a tiny rhythmic idea."
      },
      {
        "id": "beethoven-06",
        "text": "Beethoven’s Sixth Symphony is called the Pastoral and evokes experiences in nature."
      },
      {
        "id": "beethoven-07",
        "text": "Beethoven’s Ninth Symphony adds solo singers and a choir to the orchestra."
      },
      {
        "id": "beethoven-08",
        "text": "The Ninth Symphony’s finale uses words from Friedrich Schiller’s poem To Joy."
      },
      {
        "id": "beethoven-09",
        "text": "Beethoven wrote 32 piano sonatas."
      },
      {
        "id": "beethoven-10",
        "text": "The Moonlight nickname for Beethoven’s Sonata Op. 27 No. 2 was added after his death."
      },
      {
        "id": "beethoven-11",
        "text": "Beethoven’s Pathétique Sonata was published in 1799."
      },
      {
        "id": "beethoven-12",
        "text": "Beethoven’s only opera is Fidelio."
      },
      {
        "id": "beethoven-13",
        "text": "Fidelio centers on a woman who disguises herself to rescue her imprisoned husband."
      },
      {
        "id": "beethoven-14",
        "text": "Beethoven wrote 16 string quartets."
      },
      {
        "id": "beethoven-15",
        "text": "Beethoven’s late quartets experiment boldly with form, texture, and expression."
      },
      {
        "id": "beethoven-16",
        "text": "Beethoven began noticing hearing problems while still a young adult."
      },
      {
        "id": "beethoven-17",
        "text": "Beethoven continued composing as his hearing loss became severe."
      },
      {
        "id": "beethoven-18",
        "text": "The Heiligenstadt Testament is a private letter describing Beethoven’s struggles with hearing loss."
      },
      {
        "id": "beethoven-19",
        "text": "Beethoven’s Third Symphony is known as the Eroica, meaning heroic."
      },
      {
        "id": "beethoven-20",
        "text": "Beethoven removed Napoleon’s name from the dedication of the Eroica score."
      },
      {
        "id": "beethoven-21",
        "text": "Beethoven’s Für Elise was published decades after his death."
      },
      {
        "id": "beethoven-22",
        "text": "Beethoven’s music spans the Classical era and helped shape Romantic musical ideas."
      },
      {
        "id": "beethoven-23",
        "text": "Haydn’s teaching connected Beethoven to an older generation of Viennese composers."
      },
      {
        "id": "beethoven-24",
        "text": "Mozart’s piano concertos and chamber music were important models for Beethoven."
      },
      {
        "id": "beethoven-25",
        "text": "Franz Schubert lived in Vienna during Beethoven’s later years."
      },
      {
        "id": "beethoven-26",
        "text": "Schubert was among the torchbearers at Beethoven’s funeral in 1827."
      },
      {
        "id": "beethoven-27",
        "text": "Johann Nepomuk Hummel was another celebrated pianist and composer of Beethoven’s time."
      },
      {
        "id": "beethoven-28",
        "text": "Pianist and composer Muzio Clementi helped develop the piano sonata tradition."
      },
      {
        "id": "beethoven-29",
        "text": "Louis Spohr was a violinist and composer active during Beethoven’s lifetime."
      },
      {
        "id": "beethoven-30",
        "text": "Beethoven died in Vienna in 1827."
      }
    ]
  },
  "clara": {
    "name": "Clara Schumann",
    "facts": [
      {
        "id": "clara-01",
        "text": "Clara Schumann was born Clara Wieck in Leipzig in 1819."
      },
      {
        "id": "clara-02",
        "text": "Clara’s father, Friedrich Wieck, taught piano and supervised her early training."
      },
      {
        "id": "clara-03",
        "text": "Clara made her public concert debut in Leipzig as a child."
      },
      {
        "id": "clara-04",
        "text": "Clara became one of the leading concert pianists of the nineteenth century."
      },
      {
        "id": "clara-05",
        "text": "Clara composed as well as performed."
      },
      {
        "id": "clara-06",
        "text": "Clara began her Piano Concerto in A minor while she was a teenager."
      },
      {
        "id": "clara-07",
        "text": "Clara performed the premiere of her Piano Concerto in Leipzig in 1835."
      },
      {
        "id": "clara-08",
        "text": "Felix Mendelssohn conducted the premiere of Clara’s Piano Concerto."
      },
      {
        "id": "clara-09",
        "text": "Clara’s music includes songs, piano pieces, and chamber music."
      },
      {
        "id": "clara-10",
        "text": "Clara’s Piano Trio in G minor was composed in 1846."
      },
      {
        "id": "clara-11",
        "text": "Clara’s Three Romances for violin and piano were dedicated to Joseph Joachim."
      },
      {
        "id": "clara-12",
        "text": "Clara married composer Robert Schumann in 1840."
      },
      {
        "id": "clara-13",
        "text": "Clara and Robert had eight children."
      },
      {
        "id": "clara-14",
        "text": "Clara performed Robert’s music and helped establish its place in concert life."
      },
      {
        "id": "clara-15",
        "text": "Clara also championed the music of Johannes Brahms."
      },
      {
        "id": "clara-16",
        "text": "Brahms met Clara and Robert Schumann in 1853."
      },
      {
        "id": "clara-17",
        "text": "Clara’s friendship with Brahms continued for decades."
      },
      {
        "id": "clara-18",
        "text": "Clara’s concert programs helped make older music central to piano recitals."
      },
      {
        "id": "clara-19",
        "text": "Clara was an important early champion of performing piano music from memory."
      },
      {
        "id": "clara-20",
        "text": "Clara taught piano at the Hoch Conservatory in Frankfurt from 1878."
      },
      {
        "id": "clara-21",
        "text": "Robert Schumann wrote music criticism as well as composing."
      },
      {
        "id": "clara-22",
        "text": "Fanny Hensel was another nineteenth-century composer and pianist."
      },
      {
        "id": "clara-23",
        "text": "Fanny Hensel and Felix Mendelssohn were siblings who shared musical ideas."
      },
      {
        "id": "clara-24",
        "text": "Felix Mendelssohn helped revive public interest in Bach’s music."
      },
      {
        "id": "clara-25",
        "text": "Frédéric Chopin was a contemporary whose piano works Clara performed."
      },
      {
        "id": "clara-26",
        "text": "Franz Liszt was a contemporary famous for dazzling piano performances."
      },
      {
        "id": "clara-27",
        "text": "Joseph Joachim was a major violinist and a close musical collaborator of Clara’s."
      },
      {
        "id": "clara-28",
        "text": "The Romantic era valued personal expression, but its composers used many different styles."
      },
      {
        "id": "clara-29",
        "text": "Clara continued her performing career long after Robert’s death in 1856."
      },
      {
        "id": "clara-30",
        "text": "Clara Schumann died in Frankfurt in 1896."
      }
    ]
  },
  "joplin": {
    "name": "Scott Joplin",
    "facts": [
      {
        "id": "joplin-01",
        "text": "Scott Joplin grew up in the Texarkana area in a musical family."
      },
      {
        "id": "joplin-02",
        "text": "Joplin became a pianist and composer during the rise of ragtime."
      },
      {
        "id": "joplin-03",
        "text": "Ragtime often places syncopated melodies over a steady accompaniment."
      },
      {
        "id": "joplin-04",
        "text": "Syncopation emphasizes beats or parts of beats that listeners may not expect."
      },
      {
        "id": "joplin-05",
        "text": "Joplin’s Maple Leaf Rag was published in 1899."
      },
      {
        "id": "joplin-06",
        "text": "The Maple Leaf Rag helped establish Joplin’s reputation."
      },
      {
        "id": "joplin-07",
        "text": "Publisher John Stark played an important role in bringing Joplin’s music to readers."
      },
      {
        "id": "joplin-08",
        "text": "Joplin spent part of his career in Sedalia, Missouri."
      },
      {
        "id": "joplin-09",
        "text": "Joplin later lived and worked in St. Louis."
      },
      {
        "id": "joplin-10",
        "text": "Joplin moved to New York in 1907."
      },
      {
        "id": "joplin-11",
        "text": "Joplin’s The Entertainer was published in 1902."
      },
      {
        "id": "joplin-12",
        "text": "The Entertainer became widely popular again through the film The Sting in 1973."
      },
      {
        "id": "joplin-13",
        "text": "Joplin wrote instructions warning performers not to play ragtime too fast."
      },
      {
        "id": "joplin-14",
        "text": "Joplin’s School of Ragtime includes exercises for learning ragtime’s rhythms."
      },
      {
        "id": "joplin-15",
        "text": "Joplin’s piano rags usually have several distinct musical sections."
      },
      {
        "id": "joplin-16",
        "text": "Joplin’s Solace carries the subtitle A Mexican Serenade."
      },
      {
        "id": "joplin-17",
        "text": "Solace uses a habanera rhythm, a pattern connected with Cuban dance music."
      },
      {
        "id": "joplin-18",
        "text": "Joplin composed the opera Treemonisha."
      },
      {
        "id": "joplin-19",
        "text": "Treemonisha presents education as a source of freedom and community strength."
      },
      {
        "id": "joplin-20",
        "text": "Joplin published the piano-vocal score of Treemonisha in 1911."
      },
      {
        "id": "joplin-21",
        "text": "Treemonisha did not receive a full professional staging during Joplin’s lifetime."
      },
      {
        "id": "joplin-22",
        "text": "Joplin also wrote an earlier opera, A Guest of Honor, whose score is lost."
      },
      {
        "id": "joplin-23",
        "text": "Joplin collaborated with Scott Hayden on several rags."
      },
      {
        "id": "joplin-24",
        "text": "Arthur Marshall was another ragtime composer who collaborated with Joplin."
      },
      {
        "id": "joplin-25",
        "text": "James Scott was an important ragtime composer of Joplin’s era."
      },
      {
        "id": "joplin-26",
        "text": "Joseph Lamb was another major composer in the classic ragtime tradition."
      },
      {
        "id": "joplin-27",
        "text": "Tom Turpin was a pianist, composer, and important figure in St. Louis ragtime."
      },
      {
        "id": "joplin-28",
        "text": "Ragtime influenced early jazz, but ragtime and jazz are not the same thing."
      },
      {
        "id": "joplin-29",
        "text": "Joplin died in New York in 1917."
      },
      {
        "id": "joplin-30",
        "text": "Joplin received a posthumous Pulitzer Prize special award in 1976."
      }
    ]
  },
  "ellington": {
    "name": "Duke Ellington",
    "facts": [
      {
        "id": "ellington-01",
        "text": "Duke Ellington was born Edward Kennedy Ellington in Washington, D.C., in 1899."
      },
      {
        "id": "ellington-02",
        "text": "Ellington was a pianist, composer, and bandleader."
      },
      {
        "id": "ellington-03",
        "text": "Ellington moved to New York in the 1920s."
      },
      {
        "id": "ellington-04",
        "text": "Ellington’s orchestra became closely associated with Harlem’s Cotton Club."
      },
      {
        "id": "ellington-05",
        "text": "Radio broadcasts helped Ellington’s orchestra reach listeners far beyond the club."
      },
      {
        "id": "ellington-06",
        "text": "Ellington often wrote music with the distinctive sounds of particular band members in mind."
      },
      {
        "id": "ellington-07",
        "text": "Johnny Hodges gave Ellington’s orchestra a celebrated alto saxophone voice."
      },
      {
        "id": "ellington-08",
        "text": "Harry Carney played baritone saxophone in Ellington’s orchestra for decades."
      },
      {
        "id": "ellington-09",
        "text": "Trumpeter Cootie Williams was known for expressive muted sounds."
      },
      {
        "id": "ellington-10",
        "text": "A plunger mute can help a brass player create a speech-like wah sound."
      },
      {
        "id": "ellington-11",
        "text": "Ellington’s Mood Indigo was first recorded in 1930."
      },
      {
        "id": "ellington-12",
        "text": "Ellington’s It Don’t Mean a Thing highlights swing in its title and rhythmic feel."
      },
      {
        "id": "ellington-13",
        "text": "Ellington’s Sophisticated Lady became a widely performed standard."
      },
      {
        "id": "ellington-14",
        "text": "Ellington’s Black, Brown and Beige premiered at Carnegie Hall in 1943."
      },
      {
        "id": "ellington-15",
        "text": "Black, Brown and Beige was conceived as a musical portrait of African American history."
      },
      {
        "id": "ellington-16",
        "text": "Ellington wrote extended suites as well as short songs."
      },
      {
        "id": "ellington-17",
        "text": "Ellington and Billy Strayhorn formed a long-lasting composing partnership."
      },
      {
        "id": "ellington-18",
        "text": "Billy Strayhorn wrote Take the A Train, a signature tune for Ellington’s orchestra."
      },
      {
        "id": "ellington-19",
        "text": "Strayhorn’s Lush Life became a jazz standard."
      },
      {
        "id": "ellington-20",
        "text": "Ellington’s Such Sweet Thunder suite was inspired by Shakespeare."
      },
      {
        "id": "ellington-21",
        "text": "Ellington’s Far East Suite was created with Billy Strayhorn."
      },
      {
        "id": "ellington-22",
        "text": "Ellington made a celebrated appearance at the Newport Jazz Festival in 1956."
      },
      {
        "id": "ellington-23",
        "text": "Saxophonist Paul Gonsalves played a famously extended solo at that Newport performance."
      },
      {
        "id": "ellington-24",
        "text": "Ellington’s Sacred Concerts brought together jazz, voices, and spiritual themes."
      },
      {
        "id": "ellington-25",
        "text": "Count Basie led another major orchestra during the swing era."
      },
      {
        "id": "ellington-26",
        "text": "Louis Armstrong helped shape jazz’s focus on the individual soloist."
      },
      {
        "id": "ellington-27",
        "text": "Mary Lou Williams was a pianist, composer, and arranger working across several jazz eras."
      },
      {
        "id": "ellington-28",
        "text": "Ella Fitzgerald recorded a songbook devoted to Ellington’s music."
      },
      {
        "id": "ellington-29",
        "text": "Ellington received the Presidential Medal of Freedom in 1969."
      },
      {
        "id": "ellington-30",
        "text": "Ellington died in New York in 1974."
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
        "id": "ella-02",
        "text": "Fitzgerald grew up in Yonkers, New York."
      },
      {
        "id": "ella-03",
        "text": "Fitzgerald won an amateur-night contest at Harlem’s Apollo Theater in 1934."
      },
      {
        "id": "ella-04",
        "text": "Fitzgerald joined drummer Chick Webb’s orchestra in the 1930s."
      },
      {
        "id": "ella-05",
        "text": "Webb’s orchestra played at Harlem’s Savoy Ballroom."
      },
      {
        "id": "ella-06",
        "text": "Fitzgerald’s recording of A-Tisket, A-Tasket became a major hit in 1938."
      },
      {
        "id": "ella-07",
        "text": "After Webb died, Fitzgerald led his orchestra for a time."
      },
      {
        "id": "ella-08",
        "text": "Fitzgerald became especially famous for scat singing."
      },
      {
        "id": "ella-09",
        "text": "Scat singing uses improvised syllables instead of a song’s usual words."
      },
      {
        "id": "ella-10",
        "text": "Fitzgerald could shape a scat solo with the rhythmic detail of an instrumentalist."
      },
      {
        "id": "ella-11",
        "text": "Fitzgerald was often called the First Lady of Song."
      },
      {
        "id": "ella-12",
        "text": "Fitzgerald’s songbook albums explored the work of major songwriters."
      },
      {
        "id": "ella-13",
        "text": "Her first Verve songbook album focused on Cole Porter."
      },
      {
        "id": "ella-14",
        "text": "Fitzgerald’s songbooks also featured George and Ira Gershwin."
      },
      {
        "id": "ella-15",
        "text": "Irving Berlin’s songs were another subject of Fitzgerald’s songbook series."
      },
      {
        "id": "ella-16",
        "text": "Fitzgerald recorded a songbook devoted to Duke Ellington with his orchestra."
      },
      {
        "id": "ella-17",
        "text": "Norman Granz managed Fitzgerald and founded the Verve record label."
      },
      {
        "id": "ella-18",
        "text": "Granz’s Jazz at the Philharmonic concerts brought jazz stars together on tour."
      },
      {
        "id": "ella-19",
        "text": "Fitzgerald recorded several celebrated duet albums with Louis Armstrong."
      },
      {
        "id": "ella-20",
        "text": "Armstrong’s rough-edged voice contrasted with Fitzgerald’s clear tone."
      },
      {
        "id": "ella-21",
        "text": "Fitzgerald and Armstrong recorded songs from Porgy and Bess."
      },
      {
        "id": "ella-22",
        "text": "Pianist Oscar Peterson accompanied Fitzgerald on recordings."
      },
      {
        "id": "ella-23",
        "text": "Fitzgerald worked frequently with pianist and bandleader Tommy Flanagan."
      },
      {
        "id": "ella-24",
        "text": "At a 1960 Berlin concert, Fitzgerald improvised new lyrics after forgetting words to Mack the Knife."
      },
      {
        "id": "ella-25",
        "text": "That Berlin performance became one of Fitzgerald’s best-known live recordings."
      },
      {
        "id": "ella-26",
        "text": "Billie Holiday was a contemporary with a very different approach to phrasing."
      },
      {
        "id": "ella-27",
        "text": "Sarah Vaughan was another leading jazz vocalist of Fitzgerald’s generation."
      },
      {
        "id": "ella-28",
        "text": "Dizzy Gillespie’s bebop style helped inspire Fitzgerald’s scat singing."
      },
      {
        "id": "ella-29",
        "text": "Fitzgerald received the National Medal of Arts in 1987."
      },
      {
        "id": "ella-30",
        "text": "Fitzgerald died in Beverly Hills in 1996."
      }
    ]
  },
  "nina": {
    "name": "Nina Simone",
    "facts": [
      {
        "id": "nina-01",
        "text": "Nina Simone was born Eunice Kathleen Waymon in Tryon, North Carolina, in 1933."
      },
      {
        "id": "nina-02",
        "text": "Simone began playing piano as a young child."
      },
      {
        "id": "nina-03",
        "text": "Simone trained in classical piano before becoming known as a singer."
      },
      {
        "id": "nina-04",
        "text": "Bach’s music remained an important influence on Simone’s keyboard playing."
      },
      {
        "id": "nina-05",
        "text": "Simone hoped to build a career as a classical concert pianist."
      },
      {
        "id": "nina-06",
        "text": "Simone adopted her stage name while working in Atlantic City."
      },
      {
        "id": "nina-07",
        "text": "Simone’s first album, Little Girl Blue, was released in 1959."
      },
      {
        "id": "nina-08",
        "text": "Her recording of I Loves You, Porgy became an early hit."
      },
      {
        "id": "nina-09",
        "text": "I Loves You, Porgy comes from the opera Porgy and Bess."
      },
      {
        "id": "nina-10",
        "text": "Simone mixed elements of classical music, blues, gospel, folk, and jazz."
      },
      {
        "id": "nina-11",
        "text": "Simone often changed a song’s pacing and accompaniment to create her own interpretation."
      },
      {
        "id": "nina-12",
        "text": "Simone accompanied herself at the piano while singing."
      },
      {
        "id": "nina-13",
        "text": "Simone recorded My Baby Just Cares for Me on her debut album."
      },
      {
        "id": "nina-14",
        "text": "That recording found a new audience through a television advertisement in the 1980s."
      },
      {
        "id": "nina-15",
        "text": "Simone wrote Mississippi Goddam in response to racist violence in 1963."
      },
      {
        "id": "nina-16",
        "text": "Mississippi Goddam became an important song of the civil rights movement."
      },
      {
        "id": "nina-17",
        "text": "Simone performed at civil rights events, including during the Selma-to-Montgomery march period."
      },
      {
        "id": "nina-18",
        "text": "Simone’s Four Women tells four stories shaped by racism and stereotypes."
      },
      {
        "id": "nina-19",
        "text": "Simone and Weldon Irvine wrote To Be Young, Gifted and Black."
      },
      {
        "id": "nina-20",
        "text": "To Be Young, Gifted and Black honors playwright Lorraine Hansberry."
      },
      {
        "id": "nina-21",
        "text": "Hansberry and Simone were friends."
      },
      {
        "id": "nina-22",
        "text": "Simone recorded a version of Strange Fruit, a song also closely associated with Billie Holiday."
      },
      {
        "id": "nina-23",
        "text": "Simone’s Feeling Good comes from the musical The Roar of the Greasepaint – The Smell of the Crowd."
      },
      {
        "id": "nina-24",
        "text": "Simone’s Sinnerman builds intensity through repetition and a driving piano part."
      },
      {
        "id": "nina-25",
        "text": "Simone’s contemporary Miriam Makeba also connected music with political resistance."
      },
      {
        "id": "nina-26",
        "text": "Aretha Franklin recorded her own version of To Be Young, Gifted and Black."
      },
      {
        "id": "nina-27",
        "text": "Langston Hughes wrote the words for Backlash Blues, which Simone recorded."
      },
      {
        "id": "nina-28",
        "text": "Simone lived in several countries after leaving the United States."
      },
      {
        "id": "nina-29",
        "text": "Simone published her autobiography I Put a Spell on You in 1991."
      },
      {
        "id": "nina-30",
        "text": "Simone died in France in 2003."
      }
    ]
  },
  "miles": {
    "name": "Miles Davis",
    "facts": [
      {
        "id": "miles-01",
        "text": "Miles Davis was born in Alton, Illinois, in 1926."
      },
      {
        "id": "miles-02",
        "text": "Davis grew up in East St. Louis."
      },
      {
        "id": "miles-03",
        "text": "Davis played trumpet and became a major jazz bandleader."
      },
      {
        "id": "miles-04",
        "text": "Davis moved to New York in 1944 to study at the school now called Juilliard."
      },
      {
        "id": "miles-05",
        "text": "Davis soon became involved in New York’s bebop scene."
      },
      {
        "id": "miles-06",
        "text": "Davis played with saxophonist Charlie Parker early in his career."
      },
      {
        "id": "miles-07",
        "text": "Bebop often uses fast-moving melodies and complex harmonies."
      },
      {
        "id": "miles-08",
        "text": "Davis’s Birth of the Cool recordings used a nine-piece ensemble."
      },
      {
        "id": "miles-09",
        "text": "Arranger Gil Evans helped shape the sound of the Birth of the Cool project."
      },
      {
        "id": "miles-10",
        "text": "Davis and Evans later collaborated on Miles Ahead, Porgy and Bess, and Sketches of Spain."
      },
      {
        "id": "miles-11",
        "text": "Sketches of Spain draws partly on Spanish concert music and traditional musical ideas."
      },
      {
        "id": "miles-12",
        "text": "Davis’s first great quintet included John Coltrane on tenor saxophone."
      },
      {
        "id": "miles-13",
        "text": "Pianist Red Garland, bassist Paul Chambers, and drummer Philly Joe Jones also played in that quintet."
      },
      {
        "id": "miles-14",
        "text": "Davis recorded Kind of Blue in 1959."
      },
      {
        "id": "miles-15",
        "text": "Kind of Blue explores modal approaches to improvisation."
      },
      {
        "id": "miles-16",
        "text": "Modal jazz can give players room to explore a scale or mode rather than rapidly changing chords."
      },
      {
        "id": "miles-17",
        "text": "Bill Evans played piano on most of Kind of Blue."
      },
      {
        "id": "miles-18",
        "text": "Wynton Kelly played piano on Freddie Freeloader from Kind of Blue."
      },
      {
        "id": "miles-19",
        "text": "Cannonball Adderley played alto saxophone on Kind of Blue."
      },
      {
        "id": "miles-20",
        "text": "Davis’s second great quintet included Wayne Shorter, Herbie Hancock, Ron Carter, and Tony Williams."
      },
      {
        "id": "miles-21",
        "text": "Wayne Shorter contributed many compositions to that quintet’s repertoire."
      },
      {
        "id": "miles-22",
        "text": "Tony Williams joined Davis’s band while still a teenager."
      },
      {
        "id": "miles-23",
        "text": "Davis’s In a Silent Way was released in 1969."
      },
      {
        "id": "miles-24",
        "text": "Davis’s Bitches Brew helped bring electric instruments and rock-influenced rhythms into jazz."
      },
      {
        "id": "miles-25",
        "text": "Producer Teo Macero used tape editing as part of shaping Davis’s recordings."
      },
      {
        "id": "miles-26",
        "text": "Davis often used a Harmon mute to create a close, focused trumpet sound."
      },
      {
        "id": "miles-27",
        "text": "Dizzy Gillespie was another pioneering trumpeter in the bebop era."
      },
      {
        "id": "miles-28",
        "text": "John Coltrane later led his own influential groups."
      },
      {
        "id": "miles-29",
        "text": "Herbie Hancock developed a major career in acoustic jazz and electronic music."
      },
      {
        "id": "miles-30",
        "text": "Davis died in 1991."
      }
    ]
  },
  "chopin": {
    "name": "Frédéric Chopin",
    "facts": [
      {
        "id": "chopin-01",
        "text": "Chopin was born in 1810 in Żelazowa Wola, near Warsaw."
      },
      {
        "id": "chopin-02",
        "text": "Chopin grew up in Warsaw and studied music there."
      },
      {
        "id": "chopin-03",
        "text": "Chopin’s father came from France, and his mother was Polish."
      },
      {
        "id": "chopin-04",
        "text": "Chopin was recognized as a gifted pianist while still a child."
      },
      {
        "id": "chopin-05",
        "text": "Chopin left Poland in 1830 and later settled in Paris."
      },
      {
        "id": "chopin-06",
        "text": "Nearly all of Chopin’s compositions include the piano."
      },
      {
        "id": "chopin-07",
        "text": "Chopin composed two piano concertos as a young man."
      },
      {
        "id": "chopin-08",
        "text": "Chopin’s études combine technical challenges with expressive musical ideas."
      },
      {
        "id": "chopin-09",
        "text": "An étude is a study piece, often built around a particular playing skill."
      },
      {
        "id": "chopin-10",
        "text": "Chopin’s 24 Preludes, Op. 28, visit all 24 major and minor keys."
      },
      {
        "id": "chopin-11",
        "text": "Chopin’s mazurkas draw on rhythms associated with Polish dances."
      },
      {
        "id": "chopin-12",
        "text": "A mazurka often places unexpected emphasis within a three-beat measure."
      },
      {
        "id": "chopin-13",
        "text": "Chopin’s polonaises draw on a stately Polish dance tradition."
      },
      {
        "id": "chopin-14",
        "text": "Chopin’s nocturnes often pair a singing melody with a flowing accompaniment."
      },
      {
        "id": "chopin-15",
        "text": "Irish composer John Field helped establish the piano nocturne before Chopin developed it further."
      },
      {
        "id": "chopin-16",
        "text": "Chopin wrote four ballades for solo piano."
      },
      {
        "id": "chopin-17",
        "text": "Chopin’s four scherzos turn a title meaning joke into large, dramatic piano works."
      },
      {
        "id": "chopin-18",
        "text": "Chopin’s waltzes were often intended for listening rather than ordinary ballroom dancing."
      },
      {
        "id": "chopin-19",
        "text": "Chopin’s Funeral March is part of his Piano Sonata No. 2."
      },
      {
        "id": "chopin-20",
        "text": "Rubato allows expressive flexibility in timing without simply abandoning the musical pulse."
      },
      {
        "id": "chopin-21",
        "text": "Chopin earned much of his living in Paris through piano teaching."
      },
      {
        "id": "chopin-22",
        "text": "Chopin often preferred intimate performances to large public concerts."
      },
      {
        "id": "chopin-23",
        "text": "Franz Liszt was a fellow pianist-composer in Chopin’s Paris circle."
      },
      {
        "id": "chopin-24",
        "text": "Robert Schumann praised Chopin’s early music in print."
      },
      {
        "id": "chopin-25",
        "text": "Clara Schumann performed Chopin’s music during her concert career."
      },
      {
        "id": "chopin-26",
        "text": "Composer and pianist Friedrich Kalkbrenner was an established Paris musician when Chopin arrived."
      },
      {
        "id": "chopin-27",
        "text": "Writer George Sand was Chopin’s partner for several years."
      },
      {
        "id": "chopin-28",
        "text": "Chopin spent a difficult winter on Mallorca with George Sand in 1838–1839."
      },
      {
        "id": "chopin-29",
        "text": "Chopin died in Paris in 1849 and is buried at Père Lachaise Cemetery."
      },
      {
        "id": "chopin-30",
        "text": "Chopin’s heart was taken to Warsaw and is kept in Holy Cross Church."
      }
    ]
  },
  "haydn": {
    "name": "Joseph Haydn",
    "facts": [
      {
        "id": "haydn-01",
        "text": "Joseph Haydn was born in Rohrau, Austria, in 1732."
      },
      {
        "id": "haydn-02",
        "text": "Haydn sang as a choirboy at St. Stephen’s Cathedral in Vienna."
      },
      {
        "id": "haydn-03",
        "text": "Haydn worked for the Esterházy family for much of his adult life."
      },
      {
        "id": "haydn-04",
        "text": "Haydn’s court duties included composing, rehearsing, and directing performances."
      },
      {
        "id": "haydn-05",
        "text": "Haydn helped develop the symphony and string quartet as major musical forms."
      },
      {
        "id": "haydn-06",
        "text": "Haydn did not invent the symphony or string quartet single-handedly."
      },
      {
        "id": "haydn-07",
        "text": "A string quartet usually brings together two violins, a viola, and a cello."
      },
      {
        "id": "haydn-08",
        "text": "Haydn often gave all four quartet players interesting musical roles."
      },
      {
        "id": "haydn-09",
        "text": "Haydn’s Symphony No. 94 is nicknamed the Surprise."
      },
      {
        "id": "haydn-10",
        "text": "The Surprise Symphony includes a sudden loud chord in its slow movement."
      },
      {
        "id": "haydn-11",
        "text": "Haydn’s Symphony No. 45 is called the Farewell."
      },
      {
        "id": "haydn-12",
        "text": "In the Farewell Symphony’s last movement, players leave one by one until two violinists remain."
      },
      {
        "id": "haydn-13",
        "text": "Haydn’s Symphony No. 101 is nicknamed the Clock because of its ticking-like accompaniment."
      },
      {
        "id": "haydn-14",
        "text": "Haydn’s Symphony No. 104 is often called the London Symphony."
      },
      {
        "id": "haydn-15",
        "text": "Haydn made two successful visits to London in the 1790s."
      },
      {
        "id": "haydn-16",
        "text": "Violinist and impresario Johann Peter Salomon helped arrange Haydn’s London visits."
      },
      {
        "id": "haydn-17",
        "text": "The twelve London Symphonies were written for Haydn’s London concert opportunities."
      },
      {
        "id": "haydn-18",
        "text": "Haydn’s The Creation is an oratorio for soloists, choir, and orchestra."
      },
      {
        "id": "haydn-19",
        "text": "An oratorio tells a story through music, usually without staged acting or scenery."
      },
      {
        "id": "haydn-20",
        "text": "Haydn’s The Seasons follows country life through the year."
      },
      {
        "id": "haydn-21",
        "text": "Gottfried van Swieten prepared the texts Haydn used for The Creation and The Seasons."
      },
      {
        "id": "haydn-22",
        "text": "Haydn wrote music for the baryton, an unusual bowed string instrument favored by his patron."
      },
      {
        "id": "haydn-23",
        "text": "Haydn’s younger brother Michael was also a composer."
      },
      {
        "id": "haydn-24",
        "text": "Mozart and Haydn admired one another’s music."
      },
      {
        "id": "haydn-25",
        "text": "Mozart dedicated six string quartets to Haydn."
      },
      {
        "id": "haydn-26",
        "text": "Beethoven studied with Haydn after arriving in Vienna in 1792."
      },
      {
        "id": "haydn-27",
        "text": "Carl Philipp Emanuel Bach’s keyboard music influenced Haydn."
      },
      {
        "id": "haydn-28",
        "text": "Haydn’s contemporary Marianna Martines was a composer and keyboard player in Vienna."
      },
      {
        "id": "haydn-29",
        "text": "Haydn’s music often plays with listeners’ expectations through pauses, surprises, and false endings."
      },
      {
        "id": "haydn-30",
        "text": "Haydn died in Vienna in 1809."
      }
    ]
  },
  "dj": {
    "name": "DJ Coda",
    "facts": [
      {
        "id": "dj-01",
        "text": "DJ Coda is a fictional arcade host; these facts explore real DJ and dance-music history."
      },
      {
        "id": "dj-02",
        "text": "A disc jockey originally selected and played records for an audience."
      },
      {
        "id": "dj-03",
        "text": "Radio DJs helped listeners discover new recordings before digital streaming existed."
      },
      {
        "id": "dj-04",
        "text": "Dance-floor DJs shape a set by choosing both tracks and their order."
      },
      {
        "id": "dj-05",
        "text": "Beatmatching lines up the pulses of two recordings so their transition can feel continuous."
      },
      {
        "id": "dj-06",
        "text": "A crossfader lets a DJ shift the balance between two audio sources."
      },
      {
        "id": "dj-07",
        "text": "Francis Grasso helped develop beatmatching as a nightclub DJ in New York."
      },
      {
        "id": "dj-08",
        "text": "David Mancuso’s Loft parties became an important part of New York dance culture."
      },
      {
        "id": "dj-09",
        "text": "Disco grew through clubs and communities, especially Black, Latino, and LGBTQ+ scenes."
      },
      {
        "id": "dj-10",
        "text": "Disco often features a steady kick drum on all four beats of the bar."
      },
      {
        "id": "dj-11",
        "text": "The twelve-inch single gave DJs longer versions of tracks and more room for dance mixes."
      },
      {
        "id": "dj-12",
        "text": "Tom Moulton helped develop the extended disco remix."
      },
      {
        "id": "dj-13",
        "text": "Donna Summer and producer Giorgio Moroder helped popularize electronic disco sounds."
      },
      {
        "id": "dj-14",
        "text": "Donna Summer’s I Feel Love was released in 1977."
      },
      {
        "id": "dj-15",
        "text": "DJ Kool Herc’s Bronx parties are central to the early history of hip-hop."
      },
      {
        "id": "dj-16",
        "text": "Herc emphasized instrumental breaks where dancers could show their moves."
      },
      {
        "id": "dj-17",
        "text": "Using two copies of a record can let a DJ repeat a short break."
      },
      {
        "id": "dj-18",
        "text": "Grandmaster Flash developed precise techniques for repeating and cutting between record sections."
      },
      {
        "id": "dj-19",
        "text": "Grand Wizzard Theodore is widely credited with developing record scratching."
      },
      {
        "id": "dj-20",
        "text": "Scratching moves a record back and forth to turn recorded sound into a rhythmic gesture."
      },
      {
        "id": "dj-21",
        "text": "Hip-hop MCs developed spoken performances alongside DJs and dancers."
      },
      {
        "id": "dj-22",
        "text": "House music grew in Chicago’s club scene in the 1980s."
      },
      {
        "id": "dj-23",
        "text": "Frankie Knuckles helped shape house music at Chicago’s Warehouse club."
      },
      {
        "id": "dj-24",
        "text": "Chicago DJ Ron Hardy was known for adventurous sets at the Music Box."
      },
      {
        "id": "dj-25",
        "text": "Jesse Saunders’s On and On was released in 1984 and is an early house record."
      },
      {
        "id": "dj-26",
        "text": "Detroit musicians Juan Atkins, Derrick May, and Kevin Saunderson helped shape techno."
      },
      {
        "id": "dj-27",
        "text": "Drum machines let producers program repeating percussion patterns."
      },
      {
        "id": "dj-28",
        "text": "The Roland TR-808 and TR-909 became influential tools in electronic dance music."
      },
      {
        "id": "dj-29",
        "text": "Sampling reuses recorded sound as material for a new musical work."
      },
      {
        "id": "dj-30",
        "text": "A remix can reshape an existing recording’s structure, rhythm, and sound."
      }
    ]
  },
  "vee-jay": {
    "name": "Vee Jay",
    "facts": [
      {
        "id": "vee-jay-01",
        "text": "Vee Jay is a fictional arcade visitor; this collection explores real music-video and recording history."
      },
      {
        "id": "vee-jay-02",
        "text": "Early phonographs recorded sound mechanically, before microphones were used in recording studios."
      },
      {
        "id": "vee-jay-03",
        "text": "Thomas Edison demonstrated his phonograph in 1877."
      },
      {
        "id": "vee-jay-04",
        "text": "Emile Berliner developed the flat-disc gramophone in the late nineteenth century."
      },
      {
        "id": "vee-jay-05",
        "text": "Early commercial records could capture only a few minutes on each side."
      },
      {
        "id": "vee-jay-06",
        "text": "Electrical recording brought microphones into commercial recording in the 1920s."
      },
      {
        "id": "vee-jay-07",
        "text": "Magnetic tape made it easier to edit and combine recorded performances."
      },
      {
        "id": "vee-jay-08",
        "text": "Les Paul experimented with overdubbing and multitrack recording."
      },
      {
        "id": "vee-jay-09",
        "text": "Mary Ford layered vocal parts on recordings made with Les Paul."
      },
      {
        "id": "vee-jay-10",
        "text": "Multitrack recording lets musicians record different parts separately."
      },
      {
        "id": "vee-jay-11",
        "text": "Pierre Schaeffer experimented with recorded sounds in musique concrète."
      },
      {
        "id": "vee-jay-12",
        "text": "A tape loop repeats a recorded section by joining the tape’s ends together."
      },
      {
        "id": "vee-jay-13",
        "text": "Musique concrète used recorded sound as compositional material, including everyday noises."
      },
      {
        "id": "vee-jay-14",
        "text": "Animation and music were closely linked in early sound cartoons."
      },
      {
        "id": "vee-jay-15",
        "text": "Disney’s Fantasia brought orchestral concert music to animated film in 1940."
      },
      {
        "id": "vee-jay-16",
        "text": "Fantasia includes music by Bach, Beethoven, Stravinsky, and other composers."
      },
      {
        "id": "vee-jay-17",
        "text": "Short musical films called Soundies circulated in the 1940s."
      },
      {
        "id": "vee-jay-18",
        "text": "Soundies could be watched on coin-operated machines called Panorams."
      },
      {
        "id": "vee-jay-19",
        "text": "Scopitone machines later showed short music films using color film."
      },
      {
        "id": "vee-jay-20",
        "text": "Television variety shows introduced performers to large audiences before dedicated music channels existed."
      },
      {
        "id": "vee-jay-21",
        "text": "The Beatles’ promotional films helped develop the idea of a music video as a separate production."
      },
      {
        "id": "vee-jay-22",
        "text": "Queen’s Bohemian Rhapsody promotional video was released in 1975."
      },
      {
        "id": "vee-jay-23",
        "text": "MTV began broadcasting in the United States in 1981."
      },
      {
        "id": "vee-jay-24",
        "text": "Video Killed the Radio Star by the Buggles was MTV’s first broadcast music video."
      },
      {
        "id": "vee-jay-25",
        "text": "Michael Jackson’s Thriller video used storytelling and choreography on an ambitious scale."
      },
      {
        "id": "vee-jay-26",
        "text": "Missy Elliott’s videos became known for inventive visual design and dance."
      },
      {
        "id": "vee-jay-27",
        "text": "Music-video directors often work with choreographers, editors, and production designers."
      },
      {
        "id": "vee-jay-28",
        "text": "A soundtrack can use music written for a film or recordings made earlier."
      },
      {
        "id": "vee-jay-29",
        "text": "Foley artists create sound effects matched to actions on screen."
      },
      {
        "id": "vee-jay-30",
        "text": "Digital editing lets creators align recorded music and moving pictures with great precision."
      }
    ]
  },
  "zizi": {
    "name": "Zizi",
    "facts": [
      {
        "id": "zizi-01",
        "text": "Zizi is a fictional cosmic visitor; these facts explore real musical traditions on Earth."
      },
      {
        "id": "zizi-02",
        "text": "The sitar is a plucked string instrument associated with Hindustani music in northern India."
      },
      {
        "id": "zizi-03",
        "text": "Ravi Shankar helped introduce Hindustani music to audiences around the world."
      },
      {
        "id": "zizi-04",
        "text": "Tabla are a pair of hand-played drums used in Hindustani music."
      },
      {
        "id": "zizi-05",
        "text": "A raga provides a melodic framework in Indian classical music."
      },
      {
        "id": "zizi-06",
        "text": "A tala organizes musical time in recurring cycles in Indian classical traditions."
      },
      {
        "id": "zizi-07",
        "text": "Carnatic music is a classical tradition associated with southern India."
      },
      {
        "id": "zizi-08",
        "text": "M. S. Subbulakshmi was a celebrated Carnatic vocalist."
      },
      {
        "id": "zizi-09",
        "text": "Indonesian gamelan ensembles often include bronze gongs and metallophones."
      },
      {
        "id": "zizi-10",
        "text": "Javanese and Balinese gamelan have related but distinct musical traditions."
      },
      {
        "id": "zizi-11",
        "text": "The kora is a West African string instrument with a large gourd body."
      },
      {
        "id": "zizi-12",
        "text": "Toumani Diabaté was a renowned Malian kora player."
      },
      {
        "id": "zizi-13",
        "text": "Griots in West Africa preserve histories through words, music, and performance."
      },
      {
        "id": "zizi-14",
        "text": "The mbira uses metal keys plucked with the fingers and thumbs."
      },
      {
        "id": "zizi-15",
        "text": "Mbira music has an important place in Shona cultural traditions in Zimbabwe."
      },
      {
        "id": "zizi-16",
        "text": "The oud is a fretless plucked lute used across many Middle Eastern and North African traditions."
      },
      {
        "id": "zizi-17",
        "text": "Umm Kulthum was an Egyptian singer whose broadcasts reached enormous audiences."
      },
      {
        "id": "zizi-18",
        "text": "Fairuz is a Lebanese singer with a long and influential recording career."
      },
      {
        "id": "zizi-19",
        "text": "The shakuhachi is a Japanese end-blown bamboo flute."
      },
      {
        "id": "zizi-20",
        "text": "The koto is a Japanese zither traditionally fitted with movable bridges."
      },
      {
        "id": "zizi-21",
        "text": "The guqin is a Chinese seven-string zither with a long scholarly tradition."
      },
      {
        "id": "zizi-22",
        "text": "The pipa is a Chinese plucked lute held upright by its player."
      },
      {
        "id": "zizi-23",
        "text": "Mariachi ensembles from Mexico often combine violins, trumpets, and several kinds of guitar."
      },
      {
        "id": "zizi-24",
        "text": "Astor Piazzolla expanded Argentine tango through his nuevo tango style."
      },
      {
        "id": "zizi-25",
        "text": "The bandoneon, a button-operated free-reed instrument, became central to Argentine tango."
      },
      {
        "id": "zizi-26",
        "text": "Samba has deep roots in Afro-Brazilian musical communities."
      },
      {
        "id": "zizi-27",
        "text": "Antônio Carlos Jobim helped shape Brazilian bossa nova."
      },
      {
        "id": "zizi-28",
        "text": "Miriam Makeba brought South African songs to international audiences."
      },
      {
        "id": "zizi-29",
        "text": "Fela Kuti helped develop Afrobeat in Nigeria through extended grooves and large ensembles."
      },
      {
        "id": "zizi-30",
        "text": "Musical traditions change as people travel, collaborate, teach, and listen."
      }
    ]
  },
  "metronome": {
    "name": "Metronome",
    "facts": [
      {
        "id": "metronome-01",
        "text": "Metronome is a fictional clockwork visitor; this collection explores real rhythm and music-technology history."
      },
      {
        "id": "metronome-02",
        "text": "Johann Nepomuk Maelzel patented a mechanical musical metronome in 1815."
      },
      {
        "id": "metronome-03",
        "text": "Dietrich Nikolaus Winkel developed an important early form of the mechanical metronome."
      },
      {
        "id": "metronome-04",
        "text": "Beethoven was among the first major composers to publish metronome markings for his music."
      },
      {
        "id": "metronome-05",
        "text": "A metronome marking of 60 beats per minute means one marked beat each second."
      },
      {
        "id": "metronome-06",
        "text": "A tempo marking must identify its beat unit; the number alone does not tell the whole story."
      },
      {
        "id": "metronome-07",
        "text": "Mechanical metronomes use a swinging pendulum with an adjustable weight."
      },
      {
        "id": "metronome-08",
        "text": "Electronic metronomes can produce clicks without a swinging pendulum."
      },
      {
        "id": "metronome-09",
        "text": "A player piano can reproduce performances from patterns stored on a roll."
      },
      {
        "id": "metronome-10",
        "text": "Conlon Nancarrow wrote player-piano studies with rhythms difficult for human hands to perform."
      },
      {
        "id": "metronome-11",
        "text": "A polyrhythm combines contrasting rhythmic patterns at the same time."
      },
      {
        "id": "metronome-12",
        "text": "Steve Reich’s early tape pieces explore sounds gradually moving out of alignment."
      },
      {
        "id": "metronome-13",
        "text": "Reich’s Piano Phase applies shifting alignment to live piano performance."
      },
      {
        "id": "metronome-14",
        "text": "Terry Riley’s In C uses repeated musical patterns that performers coordinate flexibly."
      },
      {
        "id": "metronome-15",
        "text": "Philip Glass became known for music with repeating patterns and gradual change."
      },
      {
        "id": "metronome-16",
        "text": "Wendy Carlos’s Switched-On Bach used a Moog synthesizer to perform Bach’s music."
      },
      {
        "id": "metronome-17",
        "text": "Switched-On Bach was released in 1968."
      },
      {
        "id": "metronome-18",
        "text": "Robert Moog helped develop influential voltage-controlled synthesizers."
      },
      {
        "id": "metronome-19",
        "text": "Don Buchla developed a different influential approach to electronic musical instruments."
      },
      {
        "id": "metronome-20",
        "text": "Daphne Oram helped establish the BBC Radiophonic Workshop."
      },
      {
        "id": "metronome-21",
        "text": "Delia Derbyshire created the electronic realization of the original Doctor Who theme."
      },
      {
        "id": "metronome-22",
        "text": "Ron Grainer composed the Doctor Who theme that Derbyshire realized electronically."
      },
      {
        "id": "metronome-23",
        "text": "The theremin is played by moving the hands near antennas without touching the instrument."
      },
      {
        "id": "metronome-24",
        "text": "Clara Rockmore became a celebrated theremin performer."
      },
      {
        "id": "metronome-25",
        "text": "A sequencer stores instructions about the order and timing of musical events."
      },
      {
        "id": "metronome-26",
        "text": "MIDI was introduced in the early 1980s so electronic instruments could exchange performance instructions."
      },
      {
        "id": "metronome-27",
        "text": "MIDI messages describe events such as note starts and stops; they are not audio recordings."
      },
      {
        "id": "metronome-28",
        "text": "A drum machine can repeat a programmed pattern at a chosen tempo."
      },
      {
        "id": "metronome-29",
        "text": "A digital audio workstation combines recording, editing, and arranging tools on a computer."
      },
      {
        "id": "metronome-30",
        "text": "Human performers can use tiny timing differences to give a repeated rhythm its character."
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
        "text": "Schoenberg learned much of his craft by studying scores and playing chamber music."
      },
      {
        "id": "schoenberg-03",
        "text": "Alexander Zemlinsky was an important early teacher and musical colleague of Schoenberg."
      },
      {
        "id": "schoenberg-04",
        "text": "Schoenberg’s early music grew from the rich harmonies of late Romantic composers."
      },
      {
        "id": "schoenberg-05",
        "text": "Schoenberg composed Verklärte Nacht, meaning Transfigured Night, in 1899."
      },
      {
        "id": "schoenberg-06",
        "text": "Verklärte Nacht was first written for a string sextet: six string players."
      },
      {
        "id": "schoenberg-07",
        "text": "Schoenberg later arranged Verklärte Nacht for string orchestra."
      },
      {
        "id": "schoenberg-08",
        "text": "Schoenberg’s Gurre-Lieder uses solo singers, choirs, and a very large orchestra."
      },
      {
        "id": "schoenberg-09",
        "text": "Not all of Schoenberg’s music is atonal or written with twelve-tone methods."
      },
      {
        "id": "schoenberg-10",
        "text": "Atonal music can avoid making one key feel like the music’s main home."
      },
      {
        "id": "schoenberg-11",
        "text": "Schoenberg’s Second String Quartet adds a soprano singer in its final two movements."
      },
      {
        "id": "schoenberg-12",
        "text": "Schoenberg wrote Five Pieces for Orchestra in 1909."
      },
      {
        "id": "schoenberg-13",
        "text": "Schoenberg’s Pierrot lunaire was first performed in 1912."
      },
      {
        "id": "schoenberg-14",
        "text": "Pierrot lunaire uses a small instrumental ensemble and a speech-like vocal part."
      },
      {
        "id": "schoenberg-15",
        "text": "Sprechstimme combines features of speaking and singing, guided by written rhythms and pitches."
      },
      {
        "id": "schoenberg-16",
        "text": "Schoenberg developed a method of composing with an ordered set of all twelve chromatic pitch classes."
      },
      {
        "id": "schoenberg-17",
        "text": "A twelve-tone row is an ordering of the twelve pitch classes, rather than a scale in one key."
      },
      {
        "id": "schoenberg-18",
        "text": "Composers can transpose a twelve-tone row, shifting its notes by the same interval."
      },
      {
        "id": "schoenberg-19",
        "text": "A row can also be reversed or inverted to create related musical material."
      },
      {
        "id": "schoenberg-20",
        "text": "Schoenberg’s Suite for Piano, Op. 25, uses his twelve-tone method."
      },
      {
        "id": "schoenberg-21",
        "text": "Schoenberg wrote a music-theory book called Theory of Harmony, published in 1911."
      },
      {
        "id": "schoenberg-22",
        "text": "Schoenberg was also a painter and made many self-portraits."
      },
      {
        "id": "schoenberg-23",
        "text": "Painter Wassily Kandinsky and Schoenberg exchanged ideas about art and music."
      },
      {
        "id": "schoenberg-24",
        "text": "Alban Berg studied with Schoenberg and later composed the operas Wozzeck and Lulu."
      },
      {
        "id": "schoenberg-25",
        "text": "Anton Webern studied with Schoenberg and became known for highly concentrated musical works."
      },
      {
        "id": "schoenberg-26",
        "text": "Schoenberg, Berg, and Webern are often grouped as the Second Viennese School."
      },
      {
        "id": "schoenberg-27",
        "text": "Gustav Mahler supported Schoenberg even when Schoenberg’s music was controversial."
      },
      {
        "id": "schoenberg-28",
        "text": "Schoenberg left Europe for the United States in 1933, as the Nazis persecuted Jewish people."
      },
      {
        "id": "schoenberg-29",
        "text": "Schoenberg taught in Los Angeles, including at the University of California, Los Angeles."
      },
      {
        "id": "schoenberg-30",
        "text": "Schoenberg died in Los Angeles in 1951."
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
        "text": "Handel, J. S. Bach, and Domenico Scarlatti were all born in the same year."
      },
      {
        "id": "handel-03",
        "text": "Handel learned keyboard playing, violin, and composition while young."
      },
      {
        "id": "handel-04",
        "text": "As a young musician, Handel worked at the opera house in Hamburg."
      },
      {
        "id": "handel-05",
        "text": "Handel spent several years in Italy, learning from its opera and vocal traditions."
      },
      {
        "id": "handel-06",
        "text": "Handel’s opera Agrippina was first performed in Venice in 1709."
      },
      {
        "id": "handel-07",
        "text": "Handel became music director to the Elector of Hanover in 1710."
      },
      {
        "id": "handel-08",
        "text": "Handel’s opera Rinaldo was first performed in London in 1711."
      },
      {
        "id": "handel-09",
        "text": "Rinaldo helped establish Handel’s reputation with London opera audiences."
      },
      {
        "id": "handel-10",
        "text": "Handel settled in London in 1712."
      },
      {
        "id": "handel-11",
        "text": "Handel became a naturalized British citizen in 1727."
      },
      {
        "id": "handel-12",
        "text": "Handel’s London career included both Italian-language operas and English-language oratorios."
      },
      {
        "id": "handel-13",
        "text": "An opera tells a story through staged drama and music; an oratorio is usually performed without staging."
      },
      {
        "id": "handel-14",
        "text": "Handel’s Giulio Cesare, meaning Julius Caesar, premiered in London in 1724."
      },
      {
        "id": "handel-15",
        "text": "Handel’s opera Rodelinda premiered in London in 1725."
      },
      {
        "id": "handel-16",
        "text": "Ombra mai fu, a famous Handel aria, comes from his opera Serse."
      },
      {
        "id": "handel-17",
        "text": "Handel’s Water Music was performed for a royal boating event on the River Thames in 1717."
      },
      {
        "id": "handel-18",
        "text": "Handel’s Music for the Royal Fireworks was written for a London celebration in 1749."
      },
      {
        "id": "handel-19",
        "text": "Handel wrote the coronation anthem Zadok the Priest for King George II in 1727."
      },
      {
        "id": "handel-20",
        "text": "Handel’s Messiah was first performed in Dublin in 1742."
      },
      {
        "id": "handel-21",
        "text": "Charles Jennens assembled the biblical texts used in Messiah."
      },
      {
        "id": "handel-22",
        "text": "The Hallelujah chorus belongs to the second part of Messiah."
      },
      {
        "id": "handel-23",
        "text": "Messiah tells its story through choruses, solo airs, and recitatives."
      },
      {
        "id": "handel-24",
        "text": "A recitative often presents words in a style that follows the rhythms of speech."
      },
      {
        "id": "handel-25",
        "text": "Handel gave benefit performances of Messiah to support London’s Foundling Hospital."
      },
      {
        "id": "handel-26",
        "text": "Handel composed concertos for organ and orchestra that he could perform himself."
      },
      {
        "id": "handel-27",
        "text": "Handel’s Op. 6 concerti grossi feature exchanges between a small solo group and the larger ensemble."
      },
      {
        "id": "handel-28",
        "text": "Arcangelo Corelli’s concerto grosso tradition influenced Handel’s instrumental music."
      },
      {
        "id": "handel-29",
        "text": "Singers Francesca Cuzzoni and Faustina Bordoni both performed in Handel’s London operas."
      },
      {
        "id": "handel-30",
        "text": "Handel died in London in 1759 and was buried in Westminster Abbey."
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
        "text": "Vivaldi’s father was a violinist who helped teach him the instrument."
      },
      {
        "id": "vivaldi-03",
        "text": "Vivaldi became a skilled violinist as well as a composer."
      },
      {
        "id": "vivaldi-04",
        "text": "Vivaldi was ordained as a priest in 1703."
      },
      {
        "id": "vivaldi-05",
        "text": "Vivaldi was nicknamed the Red Priest because of his red hair."
      },
      {
        "id": "vivaldi-06",
        "text": "Vivaldi worked for many years with Venice’s Ospedale della Pietà."
      },
      {
        "id": "vivaldi-07",
        "text": "The Pietà was a charitable institution for girls with a celebrated music program."
      },
      {
        "id": "vivaldi-08",
        "text": "Girls at the Pietà learned to sing and play instruments for public performances."
      },
      {
        "id": "vivaldi-09",
        "text": "Vivaldi wrote concertos that challenged and displayed his students’ skills."
      },
      {
        "id": "vivaldi-10",
        "text": "Vivaldi composed more than 500 concertos."
      },
      {
        "id": "vivaldi-11",
        "text": "Many of Vivaldi’s concertos feature a solo violin, but he wrote for other instruments too."
      },
      {
        "id": "vivaldi-12",
        "text": "Vivaldi wrote concertos for bassoon, cello, flute, and other instruments."
      },
      {
        "id": "vivaldi-13",
        "text": "Vivaldi’s The Four Seasons is a set of four violin concertos."
      },
      {
        "id": "vivaldi-14",
        "text": "The Four Seasons was published in 1725 as part of a larger concerto collection."
      },
      {
        "id": "vivaldi-15",
        "text": "Each Four Seasons concerto portrays a different season of the year."
      },
      {
        "id": "vivaldi-16",
        "text": "Poems printed with The Four Seasons describe scenes that its music evokes."
      },
      {
        "id": "vivaldi-17",
        "text": "Spring includes musical suggestions of birdsong, streams, and a storm."
      },
      {
        "id": "vivaldi-18",
        "text": "Summer builds toward a storm in its fast final movement."
      },
      {
        "id": "vivaldi-19",
        "text": "Autumn depicts harvest celebrations and a hunting scene."
      },
      {
        "id": "vivaldi-20",
        "text": "Winter includes music suggesting cold, shivering, and slipping on ice."
      },
      {
        "id": "vivaldi-21",
        "text": "A concerto often sets a solo instrument against a larger ensemble."
      },
      {
        "id": "vivaldi-22",
        "text": "Many Vivaldi concertos follow a fast–slow–fast three-movement plan."
      },
      {
        "id": "vivaldi-23",
        "text": "In ritornello form, a recurring ensemble passage alternates with contrasting episodes."
      },
      {
        "id": "vivaldi-24",
        "text": "Vivaldi also wrote operas and worked as an opera impresario."
      },
      {
        "id": "vivaldi-25",
        "text": "Vivaldi’s Orlando furioso draws on a poem by Ludovico Ariosto."
      },
      {
        "id": "vivaldi-26",
        "text": "Vivaldi’s Gloria, RV 589, is a sacred work for soloists, choir, and orchestra."
      },
      {
        "id": "vivaldi-27",
        "text": "The RV numbers attached to Vivaldi’s works come from Peter Ryom’s catalogue."
      },
      {
        "id": "vivaldi-28",
        "text": "J. S. Bach arranged several Vivaldi concertos for keyboard instruments."
      },
      {
        "id": "vivaldi-29",
        "text": "Tomaso Albinoni and Benedetto Marcello were other composers active in Venice during Vivaldi’s lifetime."
      },
      {
        "id": "vivaldi-30",
        "text": "Vivaldi died in Vienna in 1741."
      }
    ]
  }
};
 for(const person of Object.values(people)){person.facts.forEach(Object.freeze);Object.freeze(person.facts);Object.freeze(person);}
 const data=Object.freeze(people);if(typeof module==='object'&&module.exports)module.exports=data;if(root)root.CodaMusicHistoryData=data;
})(typeof window==='undefined'?null:window);
