# Coda Content Workshop

Open `coda-content-editor.html` in a desktop browser. It is self-contained and
works offline; the arcade, a server, and an account are not needed.

1. Choose a section or search for a character, lesson, question, or phrase.
2. Edit wording, answer choices, correct answers, lessons, facts, rewards,
   progression targets, melodies, fishing definitions, or level requirements.
3. Use **Open collection** to navigate nested content. **Add entry**, **Delete
   this entry**, and **Edit as JSON** allow structural edits as well as wording.
4. Choose **Check file**, then **Export JSON**.
5. Upload `coda-content-edited.json` here and ask the assistant to apply it.

The JSON file can also be edited directly in a text editor. Use **Open JSON** in
the HTML editor to continue working on an exported file. Export regularly;
browser-local drafts depend on the browser's file-storage permissions.

## Included material

- Resolved character conversations, including current world-project overrides,
  historical quotations, and their source notes.
- All nine classroom lessons, study chapters, understanding checks, lesson
  quizzes and variants, the 800-question exam bank, visual/notation data,
  reference books, assessment settings and lesson ordering.
- All 180 current history facts and 180 linked questions, including the latest
  world project 13 edits and the four subsequently uploaded fact edits.
- All 180 authored friendship-quest positions, their games, goals, targets,
  reward amounts, fact tiers, quiz rules and collection bonuses.
- Musician missions, music trivia, Piano Lab melodies/scales/intervals, fishing
  content, dance content, XP levels, prizes and unlock requirements.
- Remaining inline dialogue, hints and messages from the main arcade and its
  rooms under **Other dialogue & screen text**. These include dialogue that
  does not currently have an in-game editor. Dynamic text fragments retain
  their original variable bindings.
- Remaining numeric and boolean source constants under **Advanced numeric
  rules**, with file, line and context information for applying edits.

This is Coda Arcade and its rooms. It excludes separate Pitch Race, Music Triad
and Rhythm Room source/tutorial content, account credentials and player saves.

## IDs, rules, and applying the file

Correct-answer indexes start at **0**. The editor shows answer text beside
these indexes. Keep existing IDs where possible: facts, questions, lessons,
missions and saved progress use them to refer to one another.

You can edit every exported field and add/remove entries. New IDs, new activity
kinds, changed lesson mechanics, altered quest rules and new visual types may
require game-code changes or progress migration. The JSON remains an authoring
document for the assistant to review and apply; it is **not** a world-project
file and is not imported directly into the arcade. A content check verifies
data consistency, not musical accuracy or compatibility with every possible
new mechanic. The assistant applies changed sections, preserves unrelated
layout/graphics, runs relevant checks, and commits/pushes only as requested.

The file carries a baseline commit, source hashes, an application map and exact
anchors for inline text/rules. These help identify changes and detect source
updates rather than overwriting newer work. They are not executable commands.
Exporting or opening a file never changes the live game or player progress.

## Repository commands

```sh
node tools/content-workshop.cjs export /workspace/scratch/coda-content-workshop
node tools/content-workshop.cjs validate /path/to/coda-content-edited.json
node tools/content-workshop.cjs diff /path/to/coda-content-edited.json
```

`diff` produces a complete field-level application plan and reports source
conflicts. It does not apply changes or publish. The exporter uses the vendored
Acorn 8.15.0 parser (MIT, `tools/vendor/acorn.LICENSE`) to enumerate real source
literals without guessing with regular expressions or executing imported JSON.
