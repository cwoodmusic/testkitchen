# The Scholar and friendship points

The Scholar sits on the lounge couch. Walk to the couch and press **E** or use
**Interact** on mobile. This is a fixed character, outside the six rotating
visitors. **Settings → Help & updates → Find the scholar** guides the player there; records and
quizzes can only be opened while visiting the scholar.

The first menu offers **Turn in facts**, **My fact book**, **Take a quiz**, and
**How to find facts**. The pouch and book show current player progress. Back or
Escape returns to the Scholar menu; Escape on the menu closes the conversation.
Locked quizzes stay under **Quizzes to unlock** until their collections are recorded.

## Earn, learn, and deliver

Each of the 18 characters has a 10-fact collection. Choose **Music history &
friendship** when talking to a musician, then accept their friendship quest.
Only one friendship quest can be active at once. Start fresh gameplay after
accepting: completed Pitch Race runs, Rhythm Room rounds, Music Triad matches,
Piano Lab challenges, and real fishing catches provide verified progress.
Quests repeat with increasing targets across five tiers; free play, practice
catches, stale runs, repeated result messages, and clicking conversations do not
complete quests.

A completed quest unlocks one fact. The character's history prompt displays
**! New history fact**. Return to that character to learn it; the fact enters
your pouch. Further clicks say there are no new facts rather than replaying
old information. Complete another quest to earn the next fact.

Bring carried facts to the scholar, choose **Turn in facts**, then **Give carried
facts to the scholar**. The historian's record holds deposited facts. All remaining slots
stay locked, including learned facts not yet handed in. Search includes only
recorded text. The pouch and record are separate views at the scholar.

## Rewards and quizzes

Fact hand-ins earn 50, 65, 80, 95, then 110 Notes per fact. The prize rises
after every two facts. Recording all ten facts earns a one-time 2,000-Note
collection bonus. A new, fully earned collection pays 2,800 Notes before its quiz.

Record all 10 facts from a character to unlock their 10-question history quiz.
Questions and answer choices are shuffled. Eight correct answers passes; the
first pass pays 2,000 Notes. Questions are explicitly linked to that character's
readable facts. Review correct answers after finishing. Retakes keep the best
score but do not repay the prize. Each fully earned collection plus its quiz
therefore pays 4,800 Notes. No Artist's Dream room or associated prizes are
introduced in this update.

Awards use saved intents and stable wallet IDs. A failed Notes write can be
retried at the scholar without paying again after a partial success. Larger
prizes are split into two saved installments to respect the existing wallet.

## Read and edit every fact

Use **Developer → Music facts** to browse all 180 facts, including locked entries.
Choose a musician and fact number, or search the whole catalog. Edit the text
and choose **Apply fact**. **Revert draft** returns to the applied version;
**Restore default fact** restores the original wording. Drafts remain available
when moving between facts and musicians.

Quiz questions linked to the selected fact are editable below it. Review the
question, choices, and correct answer when changing the information in a fact,
then choose **Apply quiz question**. The editor keeps the same fact and question
identities, so existing player progress carries over.

Applied edits save with the world project and support console Undo/Redo. Use
**Project → Save project → Export project JSON** to back up the complete project
and share edits for publication. Player discoveries and friendship points remain
separate from authored facts. A quiz already underway keeps its starting content.

## Developer progression

Press **F2 → History progression** to inspect each character's friendship points,
ready fact, carried inventory, records, and quiz state. Normal players are
read-only. **Open temporary progression test** uses the existing isolated test
player; its controls can unlock a next fact, add it to the pouch, set a
10-fact record for quiz preview, or reset a selected friendship. It uses
in-memory browser storage and never changes the original player's save.
Progression is excluded from world-project JSON exports.

## Storage and compatibility

`codaMusicHistoryV1` now contains a version-3 record of earned, learned, and
recorded fact IDs, the active quest, completed quizzes, and reward intents.
Progress from the earlier 30-fact collections carries forward by count, up to
ten facts per musician. Completed collections and passed quizzes stay complete;
previously recorded facts do not pay again. Valid older pending rewards can still
be collected once. An unfinished old quest restarts against the new collection,
so an old game result cannot earn a new fact. Corrupt or unavailable saves produce
a visible error and are not overwritten.

Older authored projects still load. Edits to retired facts remain in the exported
project as a backup. A quiz edit tied to an older, different fact is kept in
`archivedQuizzes` instead of being used with the wrong question. New authoring
uses content version 2; player progress remains a separate record.

History follows the existing local workspace boundary: it survives reloads
within the active player workspace, is isolated between players, and is not
included in Firebase profile data or synced across devices. Classroom profile
changes clear these local educational records under the existing privacy
rules. Notes rewards use the existing wallet and its normal save behavior.
No live database rules or cloud profile schema are changed.

## Reading level

The default facts and quiz text are written for students around fourth grade.
Use short sentences and common words. Explain a new music term with a simple
meaning when it first appears in a collection. Keep names, dates, cultural
history, and the details needed to answer a linked quiz question accurate.
Some names and work titles are unfamiliar even when the surrounding text is
simple; reading-level formulas alone do not measure whether those facts are clear.

When editing a fact, check its linked question and every answer choice too.
The original fact and question IDs stay the same, so this wording update carries
existing discoveries, friendship points, quiz records, and rewards forward.

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
node --test tests/music-history.test.cjs tests/music-history-progress.test.cjs
PYTHONDONTWRITEBYTECODE=1 python3 tests/music-history-browser.py
PYTHONDONTWRITEBYTECODE=1 python3 tests/scholar-dev-console-browser.py
```

Browser checks exercise real conversations, trusted test-served cabinet results,
physical scholar interactions, phone layouts, developer isolation and quizzes.
External services are blocked; tests do not change deployed data.
