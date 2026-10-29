CODA ARCADE + SONG MACHINE — CLOUD JUKEBOX

Deploy the CONTENTS of this ZIP together at the ROOT of the existing arcade GitHub Pages site.
Keep the song-machine/ subfolder and song-cloud.js in place. Do not deploy just index.html.

The arcade now has a Song Machine button. Song Machine uses the same Firebase project and Google account. Guests can compose but cloud saving requires login. Saved songs appear under My Songs in the arcade jukebox, with Play / Edit / Delete. Original five radio tracks remain.

IMPORTANT — Firebase Realtime Database Rules:
Merge this child into your EXISTING top-level `rules` object. DO NOT REPLACE existing rules (they contain arcadeProfiles, leaderboards, lobbies, etc.).

"songLibrary": {
  "$uid": {
    ".read": "auth != null && auth.uid === $uid",
    ".write": "auth != null && auth.uid === $uid",
    "$songId": {
      ".validate": "newData.hasChildren(['title','composition','updatedAt','createdAt','version']) && newData.child('title').isString() && newData.child('title').val().length <= 60 && newData.child('version').val() === 1 && newData.child('composition').hasChildren(['tracks','drums','meter','bars','bpm','root','scale']) && newData.child('composition/bars').isNumber() && newData.child('composition/bars').val() >= 1 && newData.child('composition/bars').val() <= 16 && newData.child('composition/bpm').isNumber() && newData.child('composition/bpm').val() >= 40 && newData.child('composition/bpm').val() <= 240"
    }
  }
}

Existing .write permissions higher in the tree can override privacy; check root rules do not grant broad read/write. For classroom use, review school policies for Google account sign-in and student data.

The cloud uses Firebase JS modules via internet. On file:// or localhost, the composition editor works but cloud saving is disabled. Test cloud behavior after deployment on cwoodmusic.github.io.

IMPORTANT: The existing original arcade ZIP has no HTML file for a separate Song Machine app; this package adds it.
