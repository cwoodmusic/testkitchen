# Developer access

The two owner Google accounts, `cwood@sanjacinto.k12.ca.us` and
`cwood.musiced@gmail.com`, can use developer tools and grant or revoke access
for another verified Google account. Signing in as a school administrator alone
does not grant developer access. The owner accounts stay available regardless
of delegated grants; classroom administration keeps its existing allowlist.

The arcade checks the authenticated Google identity rather than a player name,
URL parameter, or stored preference. Students and guests have no Developer
button. Delegated access is watched so removing a grant closes developer tools
without deleting saved projects or player progress.

## Enable grants and revocations

The owner accounts are configured in the game. Managing delegated accounts also
requires the new database permissions:

1. In Firebase, open the **pitch-race** project's **Realtime Database → Rules**
   and save a complete backup of the installed rules.
2. Add the `developerAccess` property from
   [DEVELOPER-ACCESS-RULES.json](DEVELOPER-ACCESS-RULES.json) inside
   `rules.classroomV1`, alongside `hallOfFame`, `admins`, `classes`, and the other
   existing properties. Preserve every existing rule. The supplied fragment
   contains only this new property; it is not a replacement for the full rules.
3. Publish the merged rules. The game can then manage developer grants using an
   owner Google sign-in. Open **For teachers → Developer access**. Enter the
   person's Google email to grant access, or revoke an existing grant. The
   person must sign in with that verified account.

The registry is `classroomV1/developerAccess/<emailKey> = true`. Keys use the
lowercase email with every period replaced by a comma because database keys
cannot contain periods. Only the two verified Google owners can list or change
the registry. Another verified Google account can read only its own entry;
anonymous and unverified accounts cannot read it. Values accept only `true`;
revocation removes the entry.

This registry grants editing controls in the game. It does not transfer GitHub,
Firebase project, domain, or hosting ownership. Those accounts and service roles
are managed separately.

**Test all unlocks** opens an isolated preview in a separate tab while its
verified developer tab stays open. Direct `dev-test` links do not grant access.
Closing the original tab or losing its permission also closes the preview;
the original account, saves, and authentication remain in the original tab.

## Local checks

`node tools/build-classroom-rules.cjs --check` checks the generated rules and
installation fragments. `node tools/test-classroom-rules.cjs` verifies access
against an isolated demo Firebase emulator and never changes a live database.
