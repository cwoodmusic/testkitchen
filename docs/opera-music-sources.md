# Coda Town Concert Hall: music and recording credits

The initial programme contains **eight real recorded performances, about 28 minutes**, shipped locally as MP3 (21.5 MiB total). The music works on GitHub Pages without cross-origin streaming, expiring links, or a third-party player. [`concert-programme.mjs`](../town/world/concert-programme.mjs) provides the game’s immutable track catalogue and absolute asset URLs. [`audio/manifest.json`](../town/assets/concert/audio/manifest.json) records the exact sources, download URLs, file sizes, durations, processing and SHA-256 hashes. [`audio/LICENSES.txt`](../town/assets/concert/audio/LICENSES.txt) contains the recording attribution notices.

These are complete performances of the selected pieces or separate orchestral movements, not synthesized stand-ins or short identification samples. A symphony movement is labelled as a movement. The first version has three orchestral tracks, three solo-piano tracks and two early jazz-band tracks.

## Programme

| Work | Composition | Actual recording performer | Recording date | Duration | Recording rights |
| --- | --- | --- | --- | --- | --- |
| Grieg: Morning Mood, Peer Gynt Op. 46 No. 1 | Incidental music 1875; suite 1888 | Musopen Symphony / Czech National Symphony Orchestra | 2012 | 3:49 | Musopen public-domain dedication |
| Chopin: Nocturne in E-flat major, Op. 9 No. 2 | 1830–1832; published 1832 | Frank Lévy, piano, for Musopen | Session year not confirmed | 4:32 | Musopen public-domain dedication, Set Chopin Free project |
| Dippermouth Blues | Joe “King” Oliver and Louis Armstrong, 1923 | King Oliver’s Creole Jazz Band, with Louis Armstrong | 6 April 1923 | 2:15 | Public domain in the United States |
| Beethoven: Symphony No. 6 “Pastoral”, IV. Thunderstorm | 1808 | Musopen orchestra; individual orchestra not identified by source | Not confirmed | 3:40 | Musopen public-domain dedication |
| Liszt: Consolation No. 3 in D-flat major, S. 172 | Published 1850 | Benedict Kramer, piano | 2005 | 3:46 | CC BY-SA 4.0, permission confirmed in Commons VRTS metadata |
| Riverboat Shuffle | Hoagy Carmichael and Dick Voynow, 1924 | Wolverine Orchestra, with Bix Beiderbecke | 6 May 1924 | 2:31 | Public domain in the United States |
| Grieg: In the Hall of the Mountain King, Peer Gynt Op. 46 No. 4 | Incidental music 1875; suite 1888 | Musopen Symphony / Czech National Symphony Orchestra | 2012 | 2:34 | Musopen public-domain dedication |
| Debussy: Clair de lune, Suite bergamasque | Begun 1890; revised/published 1905 | Laurens Goedhart, piano | 2011 | 5:04 | CC BY 3.0 |

The Chopin and Liszt stage characters are **historical portrayals**. The recordings are by the modern pianists credited above. No audio recording by Chopin or Liszt is asserted. Debussy also has a separate portrayal profile; the supplied recording is by Goedhart.

Dippermouth Blues is a foundational recording by a Black New Orleans band, with Oliver and Armstrong on cornets, trombone, clarinet, piano, banjo and drums. Riverboat Shuffle documents the Midwestern development of early New Orleans-style ensemble jazz; the Wolverines were not a New Orleans resident band. These distinctions belong in the programme notes rather than presenting all early jazz as interchangeable.

## Recording permission and geographic scope

The permission for a recording was checked separately from the copyright in its composition. No track is accepted merely because Chopin, Liszt, Grieg or Beethoven’s score is public domain. No NC, ND, subscription-only, standard YouTube, or “free to listen” grant is used.

- **Musopen:** the sources identify a rights-holder dedication of these performances to the public domain. This includes the two Grieg recordings and the Beethoven movement. Frank Lévy’s Chopin recording is from Musopen’s *Set Chopin Free* project; the canonical Commons notice identifies `PD-author|Musopen`, referring to the [project release](https://www.kickstarter.com/projects/Musopen/set-chopin-free/posts/1193714). The Public Domain Mark link in the catalogue describes status; it is not represented as a new Creative Commons licence granted by this game.
- **Liszt / Benedict Kramer:** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Credit Kramer, link the source and licence, and identify the MP3 conversion/loudness normalization. **The adapted Liszt audio remains CC BY-SA 4.0.** This notice does not purport to license other game files or music under that licence.
- **Debussy / Laurens Goedhart:** [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The retained source notes identify Goedhart’s original SoundCloud permission and the Commons recording licence. Credit Goedhart, source, licence and processing changes.
- **Historic jazz:** both the underlying published 1923/1924 versions and the historical masters are in the **United States public domain**. Their source Archive items carry CC0 metadata, but a third-party uploader cannot waive rights it does not own. Consequently the catalogue deliberately records **US public domain**, not an unrestricted worldwide CC0 grant. Copyright terms for compositions differ outside the US; these entries do not establish clearance for every territory. The statutory recording terms are summarized by the [US Copyright Office](https://www.copyright.gov/music-modernization/pre1972-soundrecordings/).

Commercial redistribution is allowed under the CC BY/CC BY-SA terms and the public-domain status described above. Attribution must remain visible in the hall’s music credits and travel with downloadable audio; the full plain-text notices are also distributed alongside the audio. Retain the geographic distinction for the historical jazz when expanding distribution.

## Canonical sources and pinned download mirrors

The managed environment could access GitHub but denied direct connections to Wikimedia Commons and Internet Archive. Audio was obtained from legitimate existing GitHub copies with recording-specific attribution/permission documentation. The repository’s general code licence was **not** used to infer permission for its recordings. Canonical recording pages remain in every track entry so the source can be independently reviewed.

The selected Liszt and Grieg source metadata returned by Commons and preserved by the mirror is retained in [`source-evidence.json`](../town/assets/concert/audio/source-evidence.json), including Liszt’s `CC BY-SA 4.0` and `Items with VRTS permission confirmed` fields. This is a retained upstream metadata report, not a claim that Coda Town obtained its own permission ticket. The mirror’s recording credits identify Kramer and the year.

**Musopen orchestral / Liszt copies:** [`jpavia10/titan-reliquary-preview`](https://github.com/jpavia10/titan-reliquary-preview/tree/f22a0725b0879dc68b7d16e2674556a9b9f63c95/audio/music), pinned commit `f22a0725b0879dc68b7d16e2674556a9b9f63c95`.

- [Recording manifest](https://github.com/jpavia10/titan-reliquary-preview/blob/f22a0725b0879dc68b7d16e2674556a9b9f63c95/audio/music/manifest.json)
- [Per-recording credits](https://github.com/jpavia10/titan-reliquary-preview/blob/f22a0725b0879dc68b7d16e2674556a9b9f63c95/audio/music/CREDITS.md)
- [Retained Commons metadata](https://github.com/jpavia10/titan-reliquary-preview/blob/f22a0725b0879dc68b7d16e2674556a9b9f63c95/docs/music/intake_report.json)

**Chopin / Debussy / historic jazz copies:** [`lfpose/caset`](https://github.com/lfpose/caset/tree/1bc77a0b112191dbea85283a52599c6bfa9edb62/public/audio), pinned commit `1bc77a0b112191dbea85283a52599c6bfa9edb62`.

- [Recording source and licence notes](https://github.com/lfpose/caset/blob/1bc77a0b112191dbea85283a52599c6bfa9edb62/SOURCES.md)
- [Track and performer metadata](https://github.com/lfpose/caset/blob/1bc77a0b112191dbea85283a52599c6bfa9edb62/public/tapes.json)

Each track’s `downloadUrl` is a raw GitHub URL pinned to the corresponding commit; `sourceSha256` fingerprints the file actually downloaded. Canonical Commons/Archive recording URLs are in `sourceUrl`. Neither mirror is treated as the composer or performer.

## Processing and maintenance

Full source files were decoded, loudness-normalised to a target of -18 LUFS / -1.5 dBTP with LRA target 11, and encoded as 44.1 kHz MP3. Classical recordings use 112 kb/s stereo; the historic mono jazz recordings use 80 kb/s mono. Tags were removed to keep the displayed credits in the catalogue authoritative. No music was cut in this edition. The upstream copies had already been normalised/transcoded, so these files are intended for in-game playback, not preservation masters.

```sh
ffmpeg -i SOURCE -vn -map_metadata -1 -ac CHANNELS -ar 44100 \
  -af loudnorm=I=-18:TP=-1.5:LRA=11 \
  -c:a libmp3lame -b:a BITRATE OUTPUT.mp3
```

When adding music, require recording-specific evidence, performer credits, a canonical source page, an exact licence/status, a pinned download, processing notes and a file hash. Keep attribution/share-alike requirements attached to each file. Do not claim an anonymous Internet Archive upload or a “public domain composition” label clears a modern recording.
