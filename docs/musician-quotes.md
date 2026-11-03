# Musician greetings and source notes

Historical musicians greet players with either a source-checked quotation or game-written dialogue about their own musical work/history. Both appear as plain speech without quotation marks, author suffixes, biographies, or source credits in chat. The catalogue distinguishes `kind: quotation` from `kind: authored`; authored lines are never exposed as historical quotation metadata.

Bach, Handel, Vivaldi, and Schoenberg use game-written greetings by request. Unverified quotations for Joplin, Ellington, Ella, Nina, Miles, and Haydn were also replaced. Political terminology, religious references, and the Vivaldi opera-count fragment are absent from the greetings. Mozart, Beethoven, Clara Schumann, and Chopin retain source-checked quotations.

Every musician still has one **Advice** choice explaining an associated musical concept simply. Friendship quests and discoverable facts remain available. Chopin and Haydn keep their room lesson/challenge controls.

## Catalogue

### J. S. Bach

**Game-written greeting; not a historical quotation.**

> Welcome! I wrote music for the organ, and I like weaving different tunes together.

Game-written greeting based on the musician’s musical work and history; see music-history-data.js.

Original arcade dialogue, not a historical quotation.

### Mozart

**Historical quotation in translation.**

> My violin has been newly strung, and I play every day.

Letter from Bologna, 4 August 1770; The Letters of Wolfgang Amadeus Mozart, volume I, letter 19, translated by Lady Wallace.

A complete sentence from the translated letter, checked against the source transcription.

[Reference](https://www.gutenberg.org/ebooks/5307)

### Beethoven

**Historical quotation in translation.**

> I live wholly in my music, and scarcely is one work finished when another is begun; indeed, I am now often at work on three or four things at the same time.

Letter to Franz Gerhard Wegeler; Beethoven’s Letters 1790–1826, volume I, letter 14, translated by Lady Wallace.

A complete sentence from the translated letter, checked against the source transcription. The edition’s printed date is not used as an independently verified date.

[Reference](https://www.gutenberg.org/ebooks/13065)

### Clara Schumann

**Historical quotation in translation.**

> In many free hours I used to grow enthusiastic over piano arrangements of operas and other music.

Clara Schumann’s recollections, quoted in Arthur Elson, Woman’s Work in Music (1903), chapter IV.

A translated recollection of enjoying music in her free time.

[Reference](https://www.gutenberg.org/ebooks/20571)

### Scott Joplin

**Game-written greeting; not a historical quotation.**

> Hello! I wrote ragtime music, with a steady beat and bouncy rhythms that skip between the beats.

Game-written greeting based on the musician’s musical work and history; see music-history-data.js.

Original arcade dialogue, not a historical quotation.

### Duke Ellington

**Game-written greeting; not a historical quotation.**

> Welcome! I wrote music for my jazz orchestra, giving each player a chance to share their own sound.

Game-written greeting based on the musician’s musical work and history; see music-history-data.js.

Original arcade dialogue, not a historical quotation.

### Ella Fitzgerald

**Game-written greeting; not a historical quotation.**

> Hello! I love turning my voice into an instrument with playful scat singing.

Game-written greeting based on the musician’s musical work and history; see music-history-data.js.

Original arcade dialogue, not a historical quotation.

### Nina Simone

**Game-written greeting; not a historical quotation.**

> Hello! I learned classical piano as a child and grew up to make music in many different styles.

Game-written greeting based on the musician’s musical work and history; see music-history-data.js.

Original arcade dialogue, not a historical quotation.

### Miles Davis

**Game-written greeting; not a historical quotation.**

> Hello! My trumpet helped me explore new sounds in jazz. A few notes can tell a big story.

Game-written greeting based on the musician’s musical work and history; see music-history-data.js.

Original arcade dialogue, not a historical quotation.

### Arnold Schoenberg

**Game-written greeting; not a historical quotation.**

> Hello! I explored new sounds by putting all twelve notes in a special order.

Game-written greeting based on the musician’s musical work and history; see music-history-data.js.

Original arcade dialogue, not a historical quotation.

### George Frideric Handel

**Game-written greeting; not a historical quotation.**

> Welcome! I wrote Water Music for musicians to play on the River Thames.

Game-written greeting based on the musician’s musical work and history; see music-history-data.js.

Original arcade dialogue, not a historical quotation.

### Antonio Vivaldi

**Game-written greeting; not a historical quotation.**

> Welcome! In The Four Seasons, my violin music paints pictures of birds, storms, and chilly winter days.

Game-written greeting based on the musician’s musical work and history; see music-history-data.js.

Original arcade dialogue, not a historical quotation.

### Frédéric Chopin

**Historical quotation in translation.**

> You must sing if you wish to play.

Chopin’s advice to Madame Rubio, reported in Frederick Niecks, Frederick Chopin as a Man and Musician, volume II, chapter XXIX.

Translated advice reported by his pupil: listen for singing phrases when playing piano. Final punctuation is normalized; the words are unchanged.

[Reference](https://www.gutenberg.org/ebooks/4972)

### Joseph Haydn

**Game-written greeting; not a historical quotation.**

> Welcome! I wrote symphonies for orchestras, and I liked surprising my listeners.

Game-written greeting based on the musician’s musical work and history; see music-history-data.js.

Original arcade dialogue, not a historical quotation.

## Verification and maintenance

The retained quotations were checked against GITenberg transcriptions of Project Gutenberg books 5307 (Mozart), 13065 (Beethoven), 20571 (Clara Schumann), and 4972 (Chopin). Mozart and Beethoven use complete source sentences. Chopin’s imperative has unchanged words with a normalized final period. English translations vary.

Authored greetings use established musical background already represented in `music-history-data.js` and the musician profiles. They are fictional first-person dialogue, not paraphrases presented as quotations. Keep this distinction when editing, exporting, and applying content.

`npc-quotes.js` remains the shared catalogue for compatibility. `npc-behavior.js` only exposes quotation metadata when the entry kind is quotation and the spoken words match. The live chat stays simple. See the [greeting audit](musician-greeting-audit.md).
