# Authored furniture directions

The runtime manifest pairs the existing South-facing furniture with newly authored North, East, and West views. The original South files, asset IDs, placement coordinates, dimensions, and collision boxes remain authoritative.

Each lossless WebP contains sprite crops packed with transparent gutters. The directional art comes from newly generated views rather than rotating, flipping, or stretching the South bitmap. Long furniture uses the game's fixed elevated South camera; its ground footprint recedes up the screen when it faces East or West. Round furniture keeps its natural proportions and may visually overhang its original collision footprint.

The manifest records each crop's exact RGBA SHA-256 digest, source-generation digest, world dimensions, and ground anchor. The two `showroom-midcentury-studio` aliases reuse the matching teak-bed and box-sofa artwork while preserving their own original dimensions and collision boxes.

`overview.webp` contains every complete view canvas at a maximum edge of 32 pixels, including its transparent padding. The renderer uses it when zoomed out; native direction sheets load only when needed. Generation source PNGs and diagnostic contact sheets are authoring files outside the website payload.
