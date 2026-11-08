# Coda Town furniture

Open [Town Builder · Urban kit](https://cwoodmusic.github.io/testkitchen/town/builder/?kit=urban) to place the tower and furniture store in your own map. The [optional example scene](https://cwoodmusic.github.io/testkitchen/town/?urban=1) demonstrates the buildings and previews every apartment. Press E at a door, lift, stairwell, or showroom display during Walk test or Play this town. Floor 15 is your apartment; choose Furnish apartment to place, move, or put away purchases. Scroll to zoom.

The furniture store uses the existing Notes wallet. Each purchase unlocks one décor item permanently; buying an owned item again costs no Notes. Furniture ownership is included in the private classroom wallet schema. Apartment layouts use the local-only `codaUrbanRoomV1` store and do not upload room designs.

Guest players and isolated developer test sessions can buy furniture immediately. Purchases for active classroom and teacher profiles stay disabled until `ARCADE_ACCOUNTS_CONFIG.classroom.townFurnitureEnabled` is explicitly `true`. Browsing the showroom remains available. This prevents new ownership IDs from blocking profile saves while the deployed database still uses older validation rules.

To enable classroom purchases:

1. Regenerate and check the rules with `node tools/build-classroom-rules.cjs` and `node tools/build-classroom-rules.cjs --check`.
2. Back up the current complete live database rules. Merge the generated classroom fragment into that backup using the [existing merge and deployment procedure](../README-CLASSROOM-PROFILES.md#back-up-and-merge-rules-before-deployment), retaining all sibling game namespaces. Review and test the candidate, then deploy it to the intended database. Static-site publication does not deploy database rules.
3. After the rules accepting the furniture IDs are deployed, set `townFurnitureEnabled:true` in [account-config.js](../account-config.js), update that script's version query in each entry page, and publish the site. Verify a classroom furniture purchase and subsequent profile save and reload.

The gate is checked again in the parent arcade before spending Notes. Changing the town frame's UI cannot bypass it.
