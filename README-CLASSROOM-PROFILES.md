# Private classroom profiles

Classroom profiles let a child use the same arcade progress on another device
without providing a real name, email address, birthday, password, or recovery
answer. Each profile has a generated alias and a private printable Profile Pass
card. A school administrator can replace a lost card while keeping the same
profile and progress.

Guest play continues to work locally. Classroom cloud saving requires the
Firebase configuration and rules described below; publishing the static site
alone does not install those rules. Enrollment is enabled for the configured
`pitch-race` project after the merged rules, approved school administrator,
authentication providers, and published origin were checked. When connecting a
different Firebase project, keep `classroom.enabled: false` until those checks
are complete. Classroom privacy protections also apply while enrollment is off.

## Quest validation update — 2026-10-27

The current client supports 29 authored musician quests and level rewards
through Level 50. The live rules were backed up, merged and read back against
the reviewed candidate. Only the two teacher/student mission-validation
subtrees gained the 20 new optional quest entries. Existing quest validators,
profile access checks and all other database namespaces were preserved.
The merged rules compiled in the local emulator; all 21 classroom security
cases passed. No student records were read or changed for this update.

Developer **Test all unlocks** uses temporary browser memory and disables cloud
saving and online play. Its Level 50 preview never needs a real profile card or
administrator account, and its purchases, progress and editor changes do not
replace the active player's saved data. Exit test mode to return to normal play.

The current progress schema also accepts all 24 guided scale rewards and their
24 memory challenges, plus the optional **Major & minor keys**, **Dynamics**,
and **Tempo** lessons and quizzes.
The piano completion journal is bounded to the 80 authored piano challenge IDs.
Old five- and six-lesson saves remain valid; loading them supplies blank new
lessons. Haydn’s Final Exam is an optional closed record containing only known
question IDs, shuffled choice-order codes, numeric answers, progress and scores.
Its 24/40/80-question attempt and best result can follow the profile across
devices. A completed exam requires its saved one-time 200 XP achievement.
These changes were merged into a complete rules backup and read back after
deployment. All 24 classroom security checks passed, including owner-only
round trips, old-save compatibility, and rejection of unknown/private fields
and out-of-range lesson steps and exam choices.
Profile access rules and unrelated game namespaces remain unchanged.

Test mode now virtualizes its temporary browsing-context name as well as its
stores, so reloading a preview cannot invalidate the real administrator's tab
binding. Real Firebase Auth/Database emulator checks cover preserved teacher
logins, repeated preview reloads, independent-tab rejection, student leaves,
expired sessions and the return to the title screen. Session-only sign-in and
unsent-save recovery protections remain in place. Profiles stay signed in during
inactivity; there is no automatic inactivity logout.

## Activation verification — 2026-10-25

The complete live rules were backed up before adding only `classroomV1`.
Existing `leaderboards`, `rooms`, `arcadeProfiles`, and `songLibrary` rules were
preserved exactly, and the installed rules were read back and compared with the
reviewed candidate. The approved administrator was provisioned through project
administration, never through a browser self-promotion operation.

The exact merged candidate passed 14 emulator security cases. A live check used
two temporary anonymous accounts and synthetic profiles to verify saving,
revision conflicts, cross-profile and listing denial, unknown-field rejection,
card revocation, and same-profile recovery. All temporary database records and
both anonymous accounts were removed and their cleanup verified. No existing
student profile was read by these checks.

The live check used project-administrator access only for synthetic setup,
rotation, and cleanup; student requests used ordinary Firebase anonymous ID
tokens. Google-provider staff rules were checked in the emulator. The teacher's
browser Google-popup class/card workflow remains the final user-facing check;
this record does not claim it was automated against the deployed site.

## What is saved

The `classroomV1` Realtime Database namespace contains:

| Path | Purpose | Who can access it |
| --- | --- | --- |
| `admins/{uid}` | Project-provisioned school-admin allowlist | A Google-signed-in user can check only their own entry. No browser client can write any entry. |
| `teacherPlayers/{uid}` | Teacher's private player alias, animal picture and versioned progress DTO | Only that exact Google-signed-in UID while approved as a school admin; parent listing and cross-teacher access are denied |
| `directory/{classId}/meta` | Class label, creator UID, creation time for lightweight class lists | School admins |
| `directory/{classId}/profiles/{profileId}` | Generated alias and animal picture only, for lightweight rosters | School admins |
| `classes/{classId}/meta` | Class label, creator UID, creation time | School admins |
| `classes/{classId}/profiles/{profileId}/meta` | Generated alias, picture, creation time, current pass hash | School admins and devices with that profile's current pass-bound session |
| `classes/{classId}/profiles/{profileId}/state` | Versioned, bounded arcade progress DTO | School admins; the matching student session can read it, and its active leased device can save it |
| `classes/{classId}/profiles/{profileId}/lease` | Active anonymous-auth UID and a short expiration time | School admins and that profile's current sessions |
| `passes/{sha256Pass}` | Exact pass lookup to class/profile IDs | Exact current lookup by an anonymously signed-in student; parent listing is denied |
| `sessions/{anonymousUid}` | Current device's class/profile/hash binding | Only that matching current device session; school admins can query by class for cleanup |

Profile startup preserves earned outfits and saved ownership, including items
which are not currently sold in the Notes shop. The guest wardrobe migration
runs only in a guest workspace; a bound classroom profile is not rewritten
while its cloud progress is being restored. This prevents repeated identity
reloads on the “Opening your profile” screen. Check the regression with
`node tools/test-classroom-service.cjs --profile-open`.

The title screen checks a remembered sign-in before displaying **Signed in**
and **Continue as** the player nickname. This check reads authentication and
profile metadata only; it does not load or overwrite progress, claim a workspace,
or renew a student lease. Fresh guest visits do not load Firebase.

The profile-restoration overlay is loading-only. Profile options are available
from the game’s Settings and Profile UI. Failed restoration opens those options
while hiding and pausing gameplay until the identity is resolved.
**Log out** saves the active profile, ends both student and staff authentication
in this tab, and returns to the title screen. A failed save stays available for
retry; incomplete local/auth cleanup keeps gameplay protected. Test with
`node tools/test-classroom-service.cjs --logout` and
`node tools/test-classroom-service.cjs --loading-logout`.

The progress DTO uses fixed fields and rejects extra fields. It excludes the
avatar's name, school roster data, song titles, compositions/drafts, text answers,
editor projects, and shared leaderboards. [classroom-profile-data.js](classroom-profile-data.js) defines the
allowed appearance values, progress records, collection limits, and number
ranges. Song Machine’s working draft stays in a browser-only scoped key; profile
changes clear it, and leaving the classroom restores the guest’s original draft.
Drafts and master-volume settings are not added to the cloud progress record.
Teacher-authored content is device configuration, stored separately from player
progress and shared through `education-content.json` publication/import/export.
Students use published content, never an unrelated local developer draft.
Edited exam, quiz, and lesson attempts use three additional browser-only scoped
keys; profile changes clear them and restore the guest's original attempts on
exit. Older guest backups remain restorable. These attempts and authoring text
are excluded from the cloud DTO; existing one-time XP rewards still sync through
the normal achievement journal.
The exam-study cards also use a browser-only scoped progress key. Their saved
card IDs and current position stay out of the cloud DTO; player changes clear
them and restore the original guest study progress on exit. The supplemental
accidentals/key-signatures lesson uses those study and authored-quiz journals,
with its existing-style once-only XP award in the normal progress ledger.
An additional 8 MiB UTF-8 limit applies in the client; Realtime Database
rules enforce the typed field and collection bounds, not that overall byte
limit.

School-admin class and roster screens use the metadata-only directory. They do
not download every profile's progress journal or pass hash just to show aliases.
The teacher profile browser groups cards by class, sorts aliases alphabetically
with numbers in natural order, and displays at most 20 profiles per page.
**Find a profile** filters aliases within the selected class. Search text stays
in memory and is cleared when the panel closes or administrator access ends.
Changing classes starts a fresh search; pass-replacement and cancellation keep
the current search and page. Each class supports up to 200 profiles; use separate
classes for larger school rosters.
The service creates and removes directory entries atomically with the matching
class/profile records; the index cannot contain a pass, hash, journal, or extra
identity field.

Aliases and progress are pseudonymous school records. Firebase Authentication
still creates a technical anonymous UID for each student device; its normal
service and network metadata are separate from this progress DTO. Staff use
their own approved Google accounts. Do not ask children to use Google sign-in.

## Teacher's own player

On the device with the teacher's latest progress, open **For teachers**, sign in,
and choose **Save this player to my account**. Confirm the current player. A
missing personal save is never created automatically during sign-in, so an old
computer cannot accidentally become the first authoritative save. A selected
student cannot be saved as the teacher's player.

Subsequent sign-ins open the existing personal save when no student is selected.
With a student selected, teacher sign-in keeps the student active; **Open my
player** explicitly switches after saving and leaving that student. Signing out
of the teacher's personal player restores the previous local guest. Student
class cards and teacher administration remain separate.

The teacher record uses the same closed progress DTO as students, plus a private
player nickname (up to 40 characters) and fixed animal picture. It adds no email,
real-name field or Google display-name copy. Compositions, recordings and editor
projects remain local. Existing local progress is not automatically merged with
an older legacy `arcadeProfiles` save. The first save must come from the correct
device.

Personal saves use revision compare-and-set. If two devices play concurrently,
an older snapshot cannot replace a newer cloud revision; the old device pauses
and offers the existing saved-progress recovery. Wait for saving to finish
before changing devices. Personal records use the approved Google database
connection, never student anonymous sessions or student saving leases. Removing
admin approval removes personal cloud access too. Client deletion is denied.

The teacher-player rules were activated on 2026-10-26 after 19 emulator security
cases, ten personal-player browser cases and four main-game browser cases passed.
Only `classroomV1/teacherPlayers` was added to a fresh backup of the full live
rules; every existing rule was preserved and the installed rules were compared
with the candidate. Logged-out listing was denied. These checks did not read or
create the teacher's real player save; the explicit first save above is required.

## Room-code multiplayer

Pitch Race multiplayer races and Music Triad Simple classmate matches and
2–4 player tournaments are available inside the classroom arcade. Players
create or join a room using its short game code; they do not share Profile
Passes. Advanced Triad remains a computer mode.

These games load their Firebase SDKs only when a player creates or joins an
online room. Classroom game authentication uses a separate anonymous session
held in memory. Room records contain technical player UIDs and game state;
Pitch Race also uses the players' chosen three-letter racing initials. The
parent's private profile, pass, and classroom roster are not sent to game rooms.
Public Pitch Race leaderboards and score-submission forms stay disabled, and
local game progress continues to use the parent's captured profile store.

Pitch Race's deployed room validation now accepts the existing clef choices and
note positions −2 through 10. Only those two validation leaves changed; all
read/write permissions and the complete private-profile namespace were preserved
and verified by readback. A temporary two-browser live check created, joined,
started, and synchronized a Grand Staff race, then removed its room and accounts.
Triad's UI and room flows passed isolated browser checks; a live database check
was blocked by the development environment's network policy.

## Treat cards and hashes as private credentials

Generate each Profile Pass from at least 128 bits of cryptographically random
data. A readable format or a picture/QR card does not reduce this requirement.
Children can scan or present the card; they do not need to memorize it. Keep the
raw pass only long enough to produce that card. Do not put it in analytics,
console logs, a class roster download, a public URL query, or cloud profile data.
For a QR link, use a URL fragment and clear it immediately after processing;
fragments are not sent to the HTTP server.

Profile pictures use a fixed cat, fox, frog, owl, otter, penguin, rabbit, or turtle
symbol. They are identifiers for finding a card, not uploaded child photographs.

Firebase stores the SHA-256 value instead of the printable raw pass. In this
rules-only lookup design, **the hash is itself a reusable bearer credential**:
someone who obtains it can create a matching anonymous session without knowing
the original card text. Do not treat hashes as safe to publish or log. A backend
verifier issuing custom authentication tokens would be needed to prevent reuse
of a stolen hash; this implementation does not claim that protection.

The parent pass collection cannot be listed. Exact lookup is allowed only after
anonymous authentication and only while the mapping matches the profile's
current hash. High entropy is essential because database rules cannot provide a
per-device guessing rate limit.

## School-admin setup

1. Use the existing Firebase project and database instance. Enable **Anonymous**
   authentication for students and **Google** authentication for staff. Add only
   the actual published school/arcade origins to Authentication's authorized
   domains.
2. Have a Firebase project administrator provision
   `classroomV1/admins/STAFF_FIREBASE_UID: true` through the Firebase console or a
   trusted Admin SDK environment. This is not a student/browser operation. A
   Google login alone never grants school-admin access; both the provider and
   allowlist entry are required on every staff request.
3. Use class labels and generated aliases such as `Blue Otter 27`. Keep any
   real-name-to-alias roster in the school's existing approved roster system,
   outside the arcade. The allowlist currently grants school-wide administration
   of this project namespace; `ownerUid` records the class creator and is not a
   separate teacher-isolation role.
4. Install and verify the reviewed database rules before enabling classroom
   cloud saving in the site. Complete the emulator checks and a separate
   authorized deployed-site check. Guest play does not require credentials.

Staff authorization belongs to the signed-in tab. Opening or copying another
tab does not carry over that tab's school-admin authorization. Staff and student
profiles stay signed in during inactivity and page refreshes. An explicit
teacher sign-in still requires the Google provider and current allowlist entry.

## Back up and merge rules before deployment

`classroom-database.rules.json` is a **fragment**, containing only
`rules.classroomV1`. Never deploy that fragment as the entire database ruleset:
doing so would remove the rules for existing games, scores, songs, and profiles.

Download or copy the **complete current live rules** from the Firebase console
into a private local backup. Keep that original file unchanged. The helper below
is offline: it does not authenticate, fetch data, or deploy anything.

```sh
node tools/classroom-rules-merge.cjs \
  --base /tmp/current-database-rules.json \
  --out /tmp/review-classroom-rules.json \
  --firebase-config /tmp/review-classroom-firebase.json \
  --instance YOUR-EXACT-DATABASE-INSTANCE
```

Review the complete diff against the backup. The only intended changed namespace
is `classroomV1`; all existing sibling namespaces and permissions must remain
intact. The helper prints SHA-256 checksums for the backup and candidate and
creates new files with private permissions. It refuses to overwrite an existing
output. If replacing an already-deployed classroom namespace, review that
namespace first and add `--replace-classroom` explicitly.

**Ancestor grants override descendant denials.** A root `.read: true`, root
`.write: true`, authenticated-wide grant, or covering root wildcard can expose
the classroom namespace even when its child rules say false. The helper refuses
such unknown/permissive ancestors. Review and migrate those existing root grants
separately, preserving the exact public access needed by the existing game
namespaces. Do not simply turn off shared root access without checking the other
games, and do not claim the new classroom data is private while an ancestor still
grants access.

After the backup, merge, emulator verification, and human review are complete,
an authorized project administrator can deploy the reviewed candidate with an
explicit project and the generated one-instance configuration:

```sh
firebase deploy --only database \
  --project YOUR-EXACT-FIREBASE-PROJECT \
  --config /tmp/review-classroom-firebase.json
```

This command changes live rules. It is deliberately separate from the offline
helper and from ordinary static-site publication. Keep the original backup for
rollback. Do not paste authentication codes, refresh tokens, raw passes, or
profile data into repository files or chat.

## Live activation checklist

1. Back up the actual live rules, resolve any inherited public grants, and
   deploy the reviewed merged rules while preserving the existing game
   namespaces. Confirm that a logged-out or ordinary student client cannot
   list `classroomV1`, the directory, classes, passes, or other sessions.
2. Verify Anonymous and Google authentication, the published authorized
   origins, and the provisioned school-admin UID. Check that an unapproved
   Google account and a non-Google account cannot administer classes.
3. Enable `classroom.enabled` only after those live prerequisites pass, keep
   classroom privacy enabled, and publish the site configuration. Static-site
   publication and database-rule deployment are separate operations.
4. With a temporary generated profile, verify a saved reward on a second
   device, explicit device takeover, old-device saving lockout, card reissue
   rejecting the old card, and profile/class deletion. Confirm guest play
   remains local and remove the temporary class and cards afterward.

The emulator suites verify the implementation without live credentials. They
do not by themselves prove that a particular live project's providers,
allowlist, deployed rules, or site configuration have been activated.

## Card replacement, saving, and device changes

To replace a lost card, a school admin issues a fresh random pass for the same
class/profile ID, updates `profile.meta.passHash`, removes the old pass mapping,
creates the new mapping, clears the old lease, and deletes obsolete session
records in one atomic update. The saved state stays in place.
Every student read and write checks the current profile hash, so all old device
sessions immediately lose cloud access, including devices with an unexpired
lease. An old browser may still retain its local guest data; revocation prevents
cloud access and does not remotely erase that browser's local storage.

Only one device holds the short saving lease. A student explicitly chooses
**Use this device** to take it over. Leases expire within 90 seconds. Background
renewal must abort when another UID owns the lease, pause saving after
displacement, and require another explicit takeover action. Devices must not
automatically fight to reclaim the lease. Separate tabs on the same browser also
share local storage and usually an anonymous-auth UID. The client allows one tab
to own the classroom workspace; other tabs cannot apply or save a different
student's local progress into that workspace.

Guest backups and unsaved classroom snapshots are bound to the tab that created
them. A copied or newly opened tab cannot restore another tab's guest backup or
pending work after a student signs out. Switching profiles uses replacement
snapshots, with rollback if local saving fails, rather than merging one
student's progress into another's.

A student can release a lease only while the profile pass/session is still
current and the existing lease belongs to that student's authenticated UID.
Release deletes only that lease. It cannot delete another device's lease, and a
revoked old device cannot release the replacement device's saving rights.

Each student save uses revision compare-and-set: the new revision is exactly
the previous revision plus one, starting at 1, and the writer must hold the
current, unexpired lease. Concurrent or stale snapshots cannot silently merge
wallets or overwrite another device's latest state. This prevents conflicting
device saves; it is not server verification of game scores earned by a modified
client.

An offline reload of the same profile retains that tab's pending snapshot and
retries saving it with its original revision check after reconnecting. If the
cloud has a newer revision, saving pauses and the child must explicitly choose
**Use saved progress** to load it; pending and cloud wallets or reward journals
are never merged. Only successfully saved cloud progress transfers to another
device. Wait for the saved status before changing devices; an unsaved offline
snapshot remains on its original tab/device.

Admins can recover or delete profiles and classes. Removing a profile or class
revokes access to its state; remove its pass mappings and obsolete session
records too as part of the admin cleanup. Decide the school's retention period
and delete unused classes after the agreed period. Do not export hashes or
device/session records as a student-facing roster.

## Local security checks

The guest website remains a static site with no package installation or build.
Firebase security tests use a separate temporary toolchain and a demo project;
they must never fall back to a live database. A reproducible isolated install is:

```sh
npm install --prefix /tmp/coda-classroom-emulator \
  --cache /tmp/coda-classroom-emulator/npm-cache --no-audit --no-fund \
  firebase-tools@15.34.1 @firebase/rules-unit-testing@6.0.0 firebase@13.1.0 \
  esbuild@0.28.2
node tools/build-classroom-rules.cjs --check
node --test tests/classroom-rule-generator.test.cjs tests/classroom-rules-merge.test.cjs tests/firebase-emulator-loopback.test.cjs
node tools/test-classroom-rules.cjs
```

Java 21 is required by this Firebase CLI version. The runner uses only the demo
project `demo-coda-classroom-rules`, database port `9100`, hub `4410`, and logging
`4510`, all bound to loopback. It leaves its temporary configuration/log path in
the output. Set `CODA_FIREBASE_TEST_TOOLS` to use another outside-repository
toolchain directory. The test itself refuses to run without an explicit loopback
database emulator endpoint.

The runner includes a small runtime workaround for Firebase CLI/Node SDK
versions that ignore `NO_PROXY`. It sends only literal loopback HTTP and
WebSocket connections directly to the emulators. All external proxy routing,
TLS verification, and original options remain intact; no installed vendor files
are edited.

The separate production-service browser check is:

```sh
node tools/test-classroom-service.cjs
node tools/test-classroom-service.cjs --teacher-player
node tools/test-classroom-service.cjs --world
node --test tests/classroom-storage.test.cjs
python3 tests/classroom-storage-browser.py
```

The browser runner requires Python Playwright and `/usr/bin/chromium` in addition
to the isolated Node dependencies above. It runs
`tests/classroom-service-browser.py` against only
`demo-coda-classroom-e2e`: Auth `9098`, database `9102`, hub `4408`, and logging
`4508`. Its Firebase browser SDK bundle lives in a temporary directory outside
the checkout. The service and security runners use different ports and demo
projects, so neither needs credentials or permission to a live project.

After an intentional canonical schema change, run
`node tools/build-classroom-rules.cjs` to regenerate the fragment, review its
diff, and rerun both test commands. Rules enforce closed fields, scalar ranges,
enums, and bounded numeric array keys. General array uniqueness/density, XP sums,
cross-ledger reward consistency, and the overall byte ceiling are checked by the
canonical client validator; RTDB rules cannot iterate journals to prove them.

Run the tests after every rules or DTO-schema change, including pass rotation, revoked
admin access, anonymous users, unknown fields, expired leases, stale revisions,
and unrelated namespaces. Keep security-test downloads under normal TLS and
verify emulator artifacts; do not disable signature/checksum or TLS checks to
work around a blocked download.
