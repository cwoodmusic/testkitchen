"""Prepare bounds and library thumbnails for the picnic and beach artwork.

The original RGBA sheets are read only. Picnic and beach use four-by-four
grids; directional seating uses four columns and two rows. Bounds retain
meaningful alpha components and nearby soft shadows while ignoring remote
near-transparent noise. No color key, cleanup, resizing or rewrite is applied
to the original source artwork.
"""
from argparse import ArgumentParser
from collections import deque
from hashlib import sha256
from pathlib import Path
import json
import os
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
FAMILIES = {"picnic": 4, "beach": 4, "seating": 2}
COLUMNS = 4


def sprite_bounds(image, name, rows=None):
    """Associate intact alpha components with cells, ignoring remote specks.

    Analysis changes no artwork. Components use alpha >= 3 to ignore invisible
    1–2 alpha noise. Nearby faint shadows and parts crossing a grid line stay
    inside their padded crop. Nearby detached pieces are included; remote
    one-alpha noise cannot enlarge a small prop's crop to a whole atlas cell.
    """
    width, height = image.size
    rows = rows if rows is not None else FAMILIES.get(name, 4)
    alpha = image.getchannel("A")
    if alpha.getextrema()[0] != 0:
        raise ValueError(f"{name}: artwork needs a genuinely transparent background")
    raw = alpha.tobytes()
    remaining = bytearray(value if value >= 3 else 0 for value in raw)
    components = []
    for start in range(width * height):
        if not remaining[start]:
            continue
        remaining[start] = 0
        queue = deque([start])
        left, top, right, bottom = width, height, 0, 0
        count = strong = 0
        core_left, core_top, core_right, core_bottom = width, height, 0, 0
        while queue:
            index = queue.popleft()
            x, y = index % width, index // width
            count += 1
            if raw[index] > 24:
                strong += 1
                core_left, core_top = min(core_left, x), min(core_top, y)
                core_right, core_bottom = max(core_right, x + 1), max(core_bottom, y + 1)
            left, top = min(left, x), min(top, y)
            right, bottom = max(right, x + 1), max(bottom, y + 1)
            for other in (([index - 1] if x else []) +
                          ([index + 1] if x + 1 < width else []) +
                          ([index - width] if y else []) +
                          ([index + width] if y + 1 < height else [])):
                if remaining[other]:
                    remaining[other] = 0
                    queue.append(other)
        col = min(COLUMNS - 1, int((left + right) * COLUMNS / (2 * width)))
        row = min(rows - 1, int((top + bottom) * rows / (2 * height)))
        components.append({"bounds": (left, top, right, bottom),
                           "count": count, "strong": strong,
                           "core": (core_left, core_top, core_right, core_bottom),
                           "owner": row * COLUMNS + col})

    def near(a, b, distance=8):
        l, t, r, btm = a
        ll, tt, rr, bb = b
        return ll <= r + distance and rr >= l - distance and \
            tt <= btm + distance and bb >= t - distance

    def union(a, b):
        return (min(a[0], b[0]), min(a[1], b[1]),
                max(a[2], b[2]), max(a[3], b[3]))

    cells = []
    for index in range(COLUMNS * rows):
        owned = [part for part in components if part["owner"] == index]
        bodies = [part for part in owned if part["strong"] >= 8]
        if not bodies:
            raise ValueError(f"{name}: sprite {index + 1} has no meaningful artwork")
        main = max(bodies, key=lambda part: part["strong"])
        bounds = main["bounds"]
        for part in bodies:
            if part is main or part["strong"] >= max(8, main["strong"] * .01):
                bounds = union(bounds, part["bounds"])
        # Include nearby detached trim and soft shadows without chasing remote
        # speckle chains throughout a cell. Original pixels remain untouched.
        for part in owned:
            if part["count"] >= 8 and near(bounds, part["bounds"]):
                bounds = union(bounds, part["bounds"])
        left, top, right, bottom = bounds
        # An intact component may straddle a logical grid line, but its crop
        # must never capture a meaningful component belonging to another item.
        padded = (max(0, left - 2), max(0, top - 2),
                  min(width, right + 2), min(height, bottom + 2))
        for part in components:
            if part["owner"] == index or part["strong"] < 8:
                continue
            ll, tt, rr, bb = part["core"]
            if ll < padded[2] and rr > padded[0] and tt < padded[3] and bb > padded[1]:
                raise ValueError(f"{name}: sprite {index + 1} crop captures another object")
        if left == 0 or top == 0 or right == width or bottom == height:
            raise ValueError(f"{name}: sprite {index + 1} touches the source sheet edge")
        cells.append({"x": padded[0], "y": padded[1],
                      "w": padded[2] - padded[0], "h": padded[3] - padded[1]})
    return cells


def build(folder):
    sheets = []
    originals = {}
    thumbnails = []
    for family, rows in FAMILIES.items():
        path = folder / f"{family}.png"
        if not path.is_file():
            raise FileNotFoundError(f"Missing generated source artwork: {path}")
        originals[path] = sha256(path.read_bytes()).digest()
        with Image.open(path) as source:
            image = source.convert("RGBA")
        cells = sprite_bounds(image, family, rows)
        thumb = image.resize((512, round(image.height / image.width * 512)),
                             Image.Resampling.LANCZOS)
        sheets.append({"family": family, "file": path.name,
                       "thumb": f"{family}-thumb.webp",
                       "width": image.width, "height": image.height,
                       "columns": COLUMNS, "rows": rows, "cells": cells})
        thumbnails.append((folder / f"{family}-thumb.webp", thumb))

    # Validate all full sheets before replacing any published metadata.
    for path, thumb in thumbnails:
        temporary = path.with_name(path.name + ".tmp")
        thumb.save(temporary, format="WEBP", quality=90, method=6, exact=True)
        os.replace(temporary, path)
    target = folder / "atlas.json"
    temporary = target.with_name(target.name + ".tmp")
    temporary.write_text(json.dumps(sheets, separators=(",", ":")) + "\n")
    os.replace(temporary, target)
    for path, expected in originals.items():
        if sha256(path.read_bytes()).digest() != expected:
            raise RuntimeError(f"Source artwork changed during build: {path}")
    return sheets


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--folder", type=Path,
                        default=ROOT / "town/assets/leisure")
    args = parser.parse_args()
    sheets = build(args.folder)
    print(f"Prepared {len(sheets)} sheets / {sum(len(s['cells']) for s in sheets)} "
          "sprites; original RGBA artwork unchanged.")
