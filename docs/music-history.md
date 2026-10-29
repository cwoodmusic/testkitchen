# Music History Journal

In **testkitchen**, walk to a musician and choose **Tell me some music history**.
Each click discovers one short fact and saves its ID. The next click reveals the
next undiscovered fact from that character. After 30 discoveries the collection
is complete; reading the journal never unlocks entries or grants currency/XP.

Open **Settings → Music History Journal**, or use **Open Music History Journal**
from a history conversation. All 540 entries across 18 collections begin locked. Locked cards show an
entry number and the character to visit; their factual text is absent from the
journal DOM and store snapshots. Search covers discovered text and character
names, and cannot reveal locked facts. These are gameplay locks, not a means of
concealing static JavaScript assets from developer tools.

The collections cover Bach, Mozart, Beethoven, Clara Schumann, Scott Joplin,
Duke Ellington, Ella Fitzgerald, Nina Simone, Miles Davis, Chopin, Haydn,
Arnold Schoenberg, George Frideric Handel, and Antonio Vivaldi.
DJ Coda shares DJ/dance history. Unlockable visitors Vee Jay, Zizi, and Metronome
share recording/video, global musical traditions, and rhythm/technology history.
The Notes Shop attendant, boutique attendant, and Captain Cadence are excluded.
Fictional hosts are identified as fictional, and the facts are authored summaries,
not invented historical quotations. Historical characters discuss both their own
work and musicians connected to their lifetime and influence.

The key `codaMusicHistoryV1` stores only versioned, known discovery IDs. It joins
`LOCAL_ONLY_KEYS` and the optional backup-key list so guest/player changes clear
or restore it with the other local educational records. It is not part of the
Firebase profile payload. Discoveries persist for this player on this device;
they do not sync across devices. Developer test mode uses its existing in-memory
storage. Unavailable or damaged saves report an error without overwriting progress
or claiming an entry was saved. No live Firebase rules or schema changes are needed.

## Reference reading

The text uses standard biographical, repertoire, and genre-history information.
These reference collections are useful for editorial review and further reading:

- [Bach Archive Leipzig](https://www.bach-digital.de/) and [Bachhaus Eisenach](https://www.bachhaus.de/)
- [International Mozarteum Foundation](https://mozarteum.at/en/)
- [Beethoven-Haus Bonn](https://www.beethoven.de/en/)
- [Schumann Portal](https://www.schumann-portal.de/)
- [Fryderyk Chopin Institute](https://nifc.pl/en)
- [Haydn House Eisenstadt](https://haydnhaus.at/)
- [Arnold Schönberg Center](https://www.schoenberg.at/)
- [Handel Hendrix House](https://handelhendrix.org/) and [Handel House Halle](https://haendelhaus.de/)
- [Italian Antonio Vivaldi Institute, Fondazione Giorgio Cini](https://www.cini.it/)
- [Library of Congress: Scott Joplin](https://www.loc.gov/item/ihas.200035814/)
- [Smithsonian National Museum of American History: jazz collections](https://americanhistory.si.edu/collections)
- [Ella Fitzgerald official biography](https://www.ellafitzgerald.com/biography/)
- [Nina Simone official biography](https://www.ninasimone.com/biography/)
- [Miles Davis official biography](https://www.milesdavis.com/biography/)
- [Smithsonian Folkways](https://folkways.si.edu/) for musical traditions and their cultural contexts
- [Science Museum Group collections](https://collection.sciencemuseumgroup.org.uk/) for recorded sound and electronic instruments

These links are further-reading references, not live dependencies. No external
requests are made by journal discovery, search, or storage.

## Validation

```sh
node --test tests/music-history.test.cjs
PYTHONDONTWRITEBYTECODE=1 python3 tests/music-history-browser.py
```

The browser suite routes production-origin requests to this checkout and blocks
external services. It exercises real NPC conversations and the assembled game,
not a replacement implementation of the journal.
