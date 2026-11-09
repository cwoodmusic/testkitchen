# Recovering a missing town

Open [map recovery](../town/maps/recovery.html) to restore or download the last uploaded project. `town/maps/coda-town-uploaded-3.json` is an exact copy of `coda-town (3).json`: 120 objects, 49,152 terrain cells, SHA-256 `c1eaa096ff14b3a4d2b66ba85a87eb9cfda95027e6d138162c27c8c1e73277b9`. It is a separate backup; the existing sample maps are unchanged.

The builder's **Recover map** button lists the current browser save, up to three previous versions and the uploaded backup. Raw browser data can be downloaded even if the project cannot be parsed. Restoring a map preserves the displaced current value in the same transaction as the replacement. A failed write keeps the old data intact.

A blank grass view can mean an absent browser save or a failed load. The builder now distinguishes these cases. Failed loads block autosave and Play from replacing the protected save. Explicitly opening or restoring a validated map can replace it while retaining its preceding data. If browser storage is unavailable, the uploaded map can open in the current tab and be exported.

The `?recover=uploaded-3` link restores the uploaded map automatically only when the current save is missing or exactly blank. It never automatically replaces an existing nonblank town or unreadable data. Normal page loads do not write to storage. Saves still use the existing `coda-town-builder` database, version 1, `maps/current` key; query parameters do not change the origin or storage partition.

Browser saves belong to the site origin, browser profile and any storage partition. A direct GitHub Pages link, another domain or an embedded browser can therefore see a different save. This recovery flow does not claim to inspect another device's saved data. Routines and NPC behavior are unchanged.

Verification: `node --test town/world/storage-recovery.test.mjs` and `python tests/town-map-recovery-browser.py --map project.json`.
