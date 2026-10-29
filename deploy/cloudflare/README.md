# Coda Arcade at www.coda-arcade.com

This Worker serves the existing GitHub Pages files at **https://www.coda-arcade.com/**.
The arcade and its three cabinet games share one browser origin, so classroom
profiles, game progress, and achievements keep their existing storage guards.
GitHub remains the source of the game files; pushing game updates still updates
the upstream sites.

Keep the GitHub Pages custom-domain setting empty and do not add a repository
`CNAME` file. The Worker fetches those existing GitHub Pages URLs. Changing them
to redirect back to this domain would create a loop. The original GitHub arcade
and existing Profile Pass links remain available.

## Deploy through the Cloudflare dashboard

The public address is **www.coda-arcade.com** (`arcade`). The Worker accepts
that address and its apex hostname `coda-arcade.com`.

1. Open **Workers & Pages** and select the existing Worker `coda-arcade-site`.
   If setting up a new account, create that Worker in the account owning
   `coda-arcade.com`.
2. Choose **Edit code**, replace the existing code with the complete contents of
   [worker.mjs](worker.mjs), and click **Deploy**. Updating this repository alone
   does not replace the code already deployed in Cloudflare; this step is also
   required when correcting an existing Worker's domain spelling.
3. Under the Worker's **Settings → Domains & Routes**, ensure both
   **www.coda-arcade.com** and **coda-arcade.com** are listed. For a missing entry,
   choose **Add Domain** (or **Add → Custom Domain**) and enter that exact
   hostname. Cloudflare creates the domain's routing/DNS and manages its TLS
   certificate. If an existing record conflicts, review it before replacement.
4. Open **https://www.coda-arcade.com/** and check the games and teacher sign-in.
   The bare address **https://coda-arcade.com/** redirects to the `www` address,
   preserving the path and query string. The Worker table does not necessarily
   show an **Active** label; it can list these bindings as **Production**.

Both DNS records should appear under the domain's **DNS → Records** as proxied
**Worker** records linked to this Worker. An `NXDOMAIN` browser error indicates
a DNS lookup problem; check the exact domain spelling and those records. The
Firebase authorized-domain configuration and app/game hostname allowlists are
separate from DNS and must also use the registered hostname.

Requests must reach the Worker rather than point `www` directly at GitHub Pages.
The GitHub Pages custom-domain setting stays empty and no repository `CNAME`
file is needed. The original GitHub Pages address remains available.

## Deploy with Wrangler instead

After logging into the correct Cloudflare account with Wrangler, run from this
directory:

```sh
npx wrangler deploy
```

The provided [wrangler.jsonc](wrangler.jsonc) binds both `www.coda-arcade.com`
and `coda-arcade.com` to the existing `coda-arcade-site` Worker.
Deployment requires access to that Cloudflare account and zone; no account
credentials or API tokens are included here. The static game itself still needs
no dependency installation or build step.

## Routing and privacy

| Public path | Fixed upstream |
| --- | --- |
| `/` and main arcade assets | `https://cwoodmusic.github.io/coda-arcade/` |
| `/Pitch-Race/…` | `https://cwoodmusic.github.io/Pitch-Race/…` |
| `/musictriad/…` | `https://cwoodmusic.github.io/musictriad/…` |
| `/rhythmroom/…` | `https://cwoodmusic.github.io/rhythmroom/…` |

Only GET and HEAD are proxied. Query strings, ranges, conditional requests, and
content/cache headers are preserved. Upstream redirects are rewritten only for
these four projects. Encoded path separators and ambiguous traversal encodings
are rejected. Browser cookies, authorization, and other private request headers
are not forwarded, and upstream cookies are not returned to the browser.
Firebase authentication and database requests go directly from the game SDKs to
Firebase; the Worker does not proxy them. Cloudflare and GitHub still receive
normal service/network metadata.

The app must explicitly trust this hostname, load cabinet URLs under this same
origin, and allow its exact origin in the three game-result bridges. Those app
changes are separate from deploying the Worker. A DNS-only main-site migration
with games left on another origin would lose the captured classroom storage
guard, so validate the complete deployment together.

Sign-in and browser storage are origin-specific. A teacher signs in once on the
new address. Students can enter their existing card code in the new site's
profile form; their cloud profiles and Notes stay in the same Firebase project.
An existing QR/pass link continues to open the original site, and newly created
pass links use the address where they are created. Do not rotate passes just to
change the website address: rotation revokes the existing cards.

Guest saves and browser-only artwork/song drafts do not automatically move
between the old and new addresses. Keep the original address available for
those local saves and exports. Opening the same saved profile at both addresses
uses the normal one-device lease and takeover flow.

## Offline checks

From the repository root:

```sh
node --test tests/cloudflare-worker.test.cjs
```

These tests stub upstream responses. They do not deploy Cloudflare resources,
change DNS or Firebase settings, or contact live services.
