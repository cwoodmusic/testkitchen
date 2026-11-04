# Google Classroom roster permissions

This describes setup for a future **Connect Google Classroom** / roster import
feature. The arcade currently uses Google sign-in for teacher authentication;
that sign-in alone does not grant access to Google Classroom. The Rename class
feature does not request additional Google permissions.

## 1. Enable the Classroom API

Open [Google Cloud Console](https://console.cloud.google.com/) and select
**pitch-race**, the existing project used by the arcade's teacher sign-in.
Go to **APIs & Services → Library**, find **Google Classroom API**, and enable it.
This does not replace the Firebase project or move existing arcade profiles.

## 2. Configure the two read-only scopes

Under **Google Auth Platform → Data Access**, choose **Add or remove scopes**.
Some Console layouts show this under **APIs & Services → OAuth consent screen**.
Configure these scopes:

| Scope | Google permission |
| --- | --- |
| `https://www.googleapis.com/auth/classroom.courses.readonly` | View your Google Classroom classes |
| `https://www.googleapis.com/auth/classroom.rosters.readonly` | View your Google Classroom class rosters |

The import does not need grade-writing, posting, Drive, student email, or profile
photo permissions. These scopes let the signed-in teacher read courses and
rosters that Google permits that account to view.

If the OAuth app is already in **Testing**, add the school teacher account under
**Audience → Test users** for a pilot. Keep an existing production app's audience
and publishing status intact. Adding sensitive scopes for external production
use can require Google's OAuth app verification; an eligible school-internal app
has different requirements. Use the Console's verification status to determine
what applies to this project.

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

After the import feature is implemented, a teacher will explicitly choose
**Connect Google Classroom**, select their school Google account, and approve
Google's consent screen. Configuring scopes in the Console does not grant
access by itself. Students can continue using their picture cards.

The connection should request the two scopes only when the teacher connects
Classroom, keep the short-lived Google access token in memory, and bind results
to that teacher's current sign-in. It should preserve the active arcade profile
and leave ordinary teacher/student sign-in unchanged.

## 5. Import without replacing existing profiles

The planned import needs a teacher-only course/student-to-arcade-profile mapping
and corresponding Firebase rules. Existing profiles must be linked once so
later imports can skip them and retain their cards and progress. Keep real
student names in teacher tools and generated aliases in the game and Hall.
New cards should be printed or downloaded during import, because the arcade
does not retain raw card passes after their creation session.

Google references: [Classroom API authorization](https://developers.google.com/workspace/classroom/guides/auth),
[course listing](https://developers.google.com/workspace/classroom/reference/rest/v1/courses/list),
and [student roster listing](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.students/list).
