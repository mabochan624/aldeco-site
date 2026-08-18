"""Resize a photo for the blog using Pillow.

Used when neither Windows' WIC nor ImageMagick is available (typically a Linux
cloud sandbox). Handles orientation, shrinks the long edge, and re-saves as JPEG
without passing any EXIF through - which is what removes the GPS coordinates.

Japanese notes live in tools/photo.mjs.
"""
import sys
from PIL import Image, ImageOps

src, dst, max_width, quality = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])

im = Image.open(src)
im = ImageOps.exif_transpose(im)          # apply EXIF orientation to the pixels

if im.width > max_width:
    height = round(im.height * max_width / im.width)
    im = im.resize((max_width, height), Image.LANCZOS)

if im.mode not in ("RGB", "L"):
    im = im.convert("RGB")

# No exif= argument, so nothing from the original metadata is carried over.
im.save(dst, "JPEG", quality=quality, optimize=True)
print(f"{im.width} x {im.height}")
