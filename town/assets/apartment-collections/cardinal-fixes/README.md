# Reviewed cardinal furniture artwork

This folder contains source-crop substitutions for explicitly reviewed asset/facing pairs. Original collection atlases and manifests remain unchanged. The runtime preserves each original world envelope, authored floor anchor, collision base and saved placement.

`manifest.json` records the original source SHA/frame, accepted generation SHA/cell/crop, packed sprite SHA and exact decoded RGBA crop hash. `originals/` retains accepted raw image generations. Packing only crops images and encodes lossless WebP with `exact=True`; it never skews, stretches, recolors or repaints source pixels. Six detached neighboring fragments are removed with exact native source subcrops.

`review.json` describes the actual visual audit coverage and verification. The compact preview sheet supplies the corrected artwork during catalog startup; native sprite files load only when requested through the existing bounded cache.
