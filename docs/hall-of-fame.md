# Shared Hall of Fame

The Records view offers **Global**, **My class**, and **My best**. Shared rows
contain a generated player alias and numeric game results. Private profiles,
card passes, class labels, and authentication UIDs are never copied into them.
Global entry keys use the existing opaque, random profile ID. Scores stay
separate for every game mode. Guest and teacher personal records remain local.

The client uses `classroomV1/hallOfFame/global/<board>/<profileId>` and
`classroomV1/hallOfFame/classes/<classId>/<board>/<profileId>`. Only a student with
a current card session and an active writing lease can submit their own result.
The alias must match the profile's generated alias. A shared record can improve
or remain equal, but cannot be lowered or erased by a student. Approved school
administrators can remove records when deleting a class or profile.

Global reads require a rank-ordered query limited to at most 50 results. Class
boards are readable only by members of that class and approved school staff.
The separate profile and roster access rules keep their existing restrictions.
The row schema is closed: `alias`, `score`, `tiebreak`, `rank`, and `at` only.
Stored scores use hundredths; `rank = score * 1000001 + tiebreak` preserves
score-first ordering in bounded queries. Game results remain client-reported.

## Activate the shared views

Publishing the site does not install Firebase Database rules. Until the new
rules are installed, shared requests show an unavailable message; personal
records and achievements continue working.

1. In the Firebase console, select the configured **pitch-race** project and
   its Realtime Database, then open **Rules**. Save a complete backup of the
   currently installed rules before editing.
2. Inside `rules.classroomV1`, add the `hallOfFame` property from
   [HALL-OF-FAME-RULES.json](HALL-OF-FAME-RULES.json). Preserve every other live
   rule, including the existing `classroomV1` children and all game namespaces.
   If a `hallOfFame` property already exists, compare it before replacing it.
3. Publish the merged rules. Do not replace the whole live rules document with
   the Hall fragment or with the repository's classroom-only rules file.
4. Open Hall of Fame using a student card: **My class** should load, a completed
   cabinet result should appear on its mode's board, and **Global** should show
   aliases from shared results. A guest can view Global but cannot submit a
   shared score or read a class board.

Completed cabinet games submit improved personal bests for the current student.
Opening a shared view can also sync that student's already-saved completed
bests; a failed share can be retried. Only the compact alias/score row is sent,
never the personal journal or another profile's records. Demonstrations and
developer test play do not submit shared scores. Syncing grants no new rewards.

## Local verification

`node tools/build-classroom-rules.cjs --check` checks both generated artifacts.
`node tools/test-classroom-rules.cjs` runs the rules against a local demo Firebase
Database emulator. It never deploys rules or reads student records.
