# Generous family-room furniture

This new collection adds four owner-specific products per theme: an eight-seat family dining table, a broad low coffee table, a grand area rug and a statement indoor tree. Existing products, artwork and saved furniture remain separate.

Dining and coffee tables have newly drawn cardinal artwork. Symmetric construction allows the reviewed South front to serve North and the separately drawn East side to serve West. Each owner retains their own material, palette and decorative motifs. Native atlases only pack unchanged RGBA source crops; raw accepted image generations and exact SHA/crop provenance are retained in `manifest.json`.

Rugs and plants use the approved owner collection's corrected source API through `family-furniture-source.mjs`. Rugs contain the true overhead art without stretching; statement trees have separately authored geometry at 1.5 times the original source size. No additional native donor images are decoded by the adapter.

Startup loads one compact table preview. Native table owner sheets load on demand through the established bounded collection runtime. Derived source-product canvases share their own bounded LRU.
