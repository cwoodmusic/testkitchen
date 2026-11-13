# Island fishing and classroom cloud saves

The shared browser journal supports all 54 cave/coastal species. Classroom profile DTOs and the prepared Realtime Database rules now also accept the 24 coastal IDs and optional legacy coastal count/size summaries. Existing catches, reward receipts, profile leases and access controls are preserved.

The prepared complete rules document is [firebase-google-classroom.rules.json](firebase-google-classroom.rules.json). Compared with the checked-in backup, only the two profile fishing-validation subtrees change, plus equivalent wardrobe enum expressions that share literal prefixes to stay within Firebase's regex compilation budget. No permissions, student records or other database namespaces are changed.

The generated classroom fragment is [classroom-database.rules.json](../classroom-database.rules.json). Generate and check it with `node tools/build-classroom-rules.cjs` and `node tools/build-classroom-rules.cjs --check`. The local demo emulator tests include a coastal save, legacy summaries, malformed fish/summary rejection and the existing profile ownership checks.

Publishing GitHub Pages does **not** publish Firebase rules. This workspace has no Firebase administrator connection or deployment workflow. An administrator must publish the reviewed rules in **Firebase Console → pitch-race → Realtime Database → Rules** for the new species to sync to classroom profiles. Until that update, browser catches remain local and classroom cloud writes containing the new fields will be rejected by the older server validation.

Keep a backup of the currently published rules first. If they differ from the supplied checked-in backup, merge the fishing-validation additions and equivalent wardrobe expressions into that newer backup, preserving its other namespaces and access rules, before publishing.
