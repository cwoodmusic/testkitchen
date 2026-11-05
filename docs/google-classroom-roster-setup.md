# Google Classroom roster import

The teacher tools can connect to Google Classroom, preview a roster, create or
link arcade profiles, and post each new link as a private Classwork material.
Later roster refreshes can append newcomers. Students keep their private cards.
Teacher sign-in alone does not grant Classroom access: connect explicitly below.

## 1. Enable the Classroom API

Open [Google Cloud Console](https://console.cloud.google.com/) and select
**pitch-race**, the existing project used by the arcade's teacher sign-in.
Go to **APIs & Services → Library**, find **Google Classroom API**, and enable it.
This does not replace the Firebase project or move existing arcade profiles.

## 2. Configure the Google permissions

Under **Google Auth Platform → Data Access**, choose **Add or remove scopes**.
Some Console layouts show this under **APIs & Services → OAuth consent screen**.
Configure these scopes:

| Scope | Google permission |
| --- | --- |
| `https://www.googleapis.com/auth/classroom.courses.readonly` | View your Google Classroom classes |
| `https://www.googleapis.com/auth/classroom.rosters.readonly` | View your Google Classroom class rosters |
| `https://www.googleapis.com/auth/classroom.courseworkmaterials` | See, edit, and create Classwork materials; requested only when preparing posts |

Roster imports use the first two, read-only scopes. The optional third scope
allows private material posting after a separate teacher click. The arcade does
not request grade-writing, Drive, student email, or profile photo permissions.
These scopes apply to classes Google permits the connected teacher to access.

If the OAuth app is already in **Testing**, add the school teacher account under
**Audience → Test users** for a pilot. Keep an existing production app's audience
and publishing status intact. Follow **Verification Center** for any additional
Google requirements. If it says verification is not required and the needed
scopes appear under Data Access, this part is complete. Branding verification is a
separate setting.

## 3. Obtain district approval when required

If the district restricts third-party apps, its Google Workspace administrator
must approve the app's Classroom access. They can use:

**Google Admin console → Security → Access and data control → API controls →
Manage third-party app access**

Provide the app's **OAuth client ID**, found under Google Cloud **APIs & Services
→ Credentials** for the web client used by the arcade. This is different from
the Firebase API key and project ID. The district administrator can allow the
requested Classroom permissions according to district policy.

## 4. Request the permissions inside the arcade

Open **For teachers → Import from Google Classroom → Connect Google Classroom**.
Use the same school Google account that is signed in to the teacher tools, then
approve Google's consent screen. Configuring scopes in the Console does not
grant access by itself. Students do not need a Google sign-in.

The connection requests the two scopes only at this click. It preserves the
active arcade player and Firebase UID, keeps the short-lived access token in
memory, and clears the connection when the teacher disconnects or loses access.
**Prepare Classroom posts** requests the additional material permission through
another explicit Google consent window. Declining it keeps roster imports and
printable cards available.

## 5. Install the private import rules once

The new links live under `classroomV1/classroomImports`. Each approved teacher
can read only their own links. Anonymous students and other teachers cannot read
them. The stored records contain Google course/student IDs, arcade profile IDs,
timestamps, and private delivery status/material IDs and card hashes. Student
names, email addresses, access tokens, raw profile links, and raw card
passes are not saved there.

The [complete prepared rules file](firebase-google-classroom.rules.json) preserves
every existing rule from the most recent full rules backup supplied for this
project and adds only `rules.classroomV1.classroomImports`. It is a whole rules
document, not a fragment. Keep a backup of the currently published rules first.
If they have changed since that backup, merge the new node into the newer backup
instead of replacing newer rules.

In **Firebase Console → pitch-race → Build → Realtime Database → Rules**, replace
the whole editor with that complete file and choose **Publish**. If the earlier
roster-import rules are already installed, use this newer complete file to add
delivery tracking. This changes
permissions, not database records. No classes or profiles are migrated or reset.
The import fails before creating any profiles while this setup is missing.

For an updated backup, the offline merge command is:

```sh
node tools/classroom-rules-merge.cjs --base CURRENT-RULES.json --out UPDATED-RULES.json --add-classroom-deliveries
```

## 6. Preview, link, import, and print

1. Choose a Google Classroom course and a new or existing arcade class.
2. Choose **Preview roster**. Nothing is created at this stage.
3. For students who already play, choose their existing generated profile. This
   preserves their cards and progress. The importer never guesses a match from
   real names or generated aliases.
4. Choose **Create new profile** for newcomers, or **Skip**. Existing nonempty
   arcade classes start unlinked rows at Skip so duplicates are not created by
   default. One profile can be linked to only one student in that course.
5. Review the totals, then import. New profiles, passes, directory rows, and
   private links save together. Repeating an import recognizes existing links;
   removing a child from Google Classroom never deletes their arcade profile.
6. Print the new cards and the **private teacher key**, which matches student
   names to generated aliases. The student card sheets use generated aliases
   and pictures. The private key is separate and contains no sign-in passes.

Up to 200 profiles are supported per arcade class. A linked course keeps its
chosen arcade class. A deleted linked class is not recreated automatically.
Print filenames contain the class label and a unique batch suffix, not names,
email addresses, or private pass codes. Cancelling or failing to print keeps
the new receipts available until they are explicitly cleared. Save them before
closing or reloading the tab.

If an import finishes but its new cards are lost, repeating the import keeps
the same profiles and does not automatically issue new cards. Open that class
in **For teachers** and explicitly use **Replace pass** for each card needed.
Replacing a pass preserves progress but invalidates the old card and its active
devices.

### Rebuild a deleted linked class

If you deleted an arcade class in teacher tools, preview its Google Classroom
course again. When both arcade class records are completely absent, the preview
offers **Rebuild empty class**. Confirm the class name to recreate only the empty
class at its original linked ID. No Firebase rules update is needed.

Review the roster after rebuilding, then explicitly import the selected students
to create fresh profiles and cards. Rebuilding does not restore deleted profiles,
saved progress, or old cards. Other classes and existing Classroom materials are
preserved. Publish the new links after importing; old materials still contain
invalid old links and can be removed manually in Classroom.

Rebuilding is unavailable if either class record still contains data. A missing
class without a saved course connection instead offers **Refresh arcade classes**
so you can remove a stale selection and preview again.

## 7. Post private profile links

1. Keep the new card receipts open after importing.
2. Choose **Prepare Classroom posts** and approve the additional Google
   permission. This checks existing materials and previews recipients; it does
   not publish anything.
3. Review the names and generated aliases. Each new material has exactly one
   assigned student and exactly that student's profile link. Teachers and domain
   administrators retain their normal Classroom access.
4. Choose **Publish profile links**. The arcade creates published Classwork
   materials, matching the teacher's existing individually assigned material
   workflow. It does not create graded assignments or edit old materials.
5. Review the per-student results. Successfully posted links stay posted if a
   later student fails. Recheck the remaining links before retrying.

Existing matching private materials are recognized and skipped, including
materials previously posted by hand. The delivery check validates the intended
Google student, current arcade profile, and current card before publishing.
Closing after all new links are confirmed posted is safe; printing cards remains
optional. Existing profiles without an available saved link are not reissued.

A private per-student/card delivery claim coordinates tabs. Once a request might
have reached Google, the arcade checks Classroom rather than blindly sending it
again. A confirmed existing material is reconciled without another post. If the
outcome remains uncertain, open Classroom and check that student's materials.
The app will not automatically resend an uncertain request. This avoids
duplicates after a lost response while keeping successful earlier posts intact.

## 8. Append newcomers

Use **Check for new students** after saving, printing, or successfully posting the
current batch. The app reloads the same Google course and linked arcade class.
Already linked students keep their profiles, cards, progress, and materials.
Within that open import session, newly seen unlinked students are selected for
review; previously skipped students stay skipped.

When reopening the importer later, preview the same course. The saved course
mapping restores its arcade class. **Select unlinked students** selects only
students without a linked arcade profile; existing and missing profiles are
left unchanged. Review the names and link an existing arcade profile where
appropriate, then import the newcomers and prepare their new links for posting.
The app cannot infer whether an unlinked student already has an older generated
profile, so that choice remains explicit.

## Hosting and school filtering

The existing Firebase projects and game hosting stay in place. Roster requests
go to `https://classroom.googleapis.com` and Google consent uses the existing
Google sign-in flow. Include that API hostname in any district filtering review.
Roster importing uses GET requests. Publishing uses explicit POST requests to
create individually assigned Classwork materials after teacher confirmation.
It does not change enrollment, write grades, or request Drive.

## Local verification

`node tests/google-classroom.test.cjs` checks the scoped API client;
`node tests/classroom-roster-import.test.cjs` checks import decisions and writes.
`node tests/classroom-material-publisher.test.cjs` checks delivery claims,
personalized recipients, retries, and append-only behavior.
`python3 -B tests/classroom-google-import-browser.py` checks preview and printing.
`node tools/test-classroom-service.cjs --google-classroom` runs the actual service
and Firebase SDK against disposable local emulators with Google responses mocked.
`node tools/test-classroom-rules.cjs` checks private access and atomic conflicts.
No automated check accesses a live school roster or creates live student data.

Google references: [Classroom API authorization](https://developers.google.com/workspace/classroom/guides/auth),
[course listing](https://developers.google.com/workspace/classroom/reference/rest/v1/courses/list),
and [student roster listing](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.students/list).
