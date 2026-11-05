#!/usr/bin/env python3
"""Generate the Chores app icons.

The mark is a checklist: three boxes with tick marks on a white field inside a
heavy black frame. It matches the 2px print-border identity without depending
on a font renderer, so the icons can be rebuilt anywhere with the stdlib.
"""

import struct
import zlib
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "apps" / "web" / "public" / "icons"


def chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path: Path, size: int) -> None:
    scale = size / 512
    pixels = bytearray()

    def rect(x: int, y: int, w: int, h: int, colour: tuple[int, int, int]) -> None:
        x0, y0 = max(0, int(x * scale)), max(0, int(y * scale))
        x1, y1 = min(size, int((x + w) * scale)), min(size, int((y + h) * scale))
        for py in range(y0, y1):
            row = py * (size * 3 + 1)
            for px in range(x0, x1):
                offset = row + 1 + px * 3
                pixels[offset : offset + 3] = bytes(colour)

    white = (255, 255, 255)
    black = (10, 10, 10)

    # Row 0 of the PNG filter bytes must be 0 for every scanline.
    pixels.extend(b"\x00" * (size * 3 + 1) * size)
    for py in range(size):
        pixels[py * (size * 3 + 1)] = 0

    rect(0, 0, size, size, white)
    rect(24, 24, 464, 24, black)
    rect(24, 464, 464, 24, black)
    rect(24, 24, 24, 464, black)
    rect(464, 24, 24, 464, black)

    for index in range(3):
        top = 132 + index * 96
        rect(104, top, 56, 56, black)
        # Tick inside the box, drawn in white.
        for step in range(30):
            rect(118 + step, top + 28 - step // 3, 6, 6, white)
        for step in range(18):
            rect(146 + step, top + 18 + step, 6, 6, white)
        rect(192, top + 8, 216, 40, black)

    raw = zlib.compress(bytes(pixels), 9)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", raw)
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


if __name__ == "__main__":
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        target = OUT_DIR / f"icon-{size}.png"
        write_png(target, size)
        print(f"wrote {target} ({target.stat().st_size} bytes)")
