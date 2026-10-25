#!/usr/bin/env python3
"""
build-branding.py

Makes every derived brand picture from the originals pasted into branding/.

    python scripts/build-branding.py

Needs Python 3 with Pillow and numpy. The originals are only read:
    branding/source/icon-v1.png        icon tile on a white background
    branding/logo/logo-dark.png        symbol + name on near-black
    branding/installer/sidebar.png     tall installer picture

Written:
    branding/app-icon/icon.png         tile cut out of the white, transparent corners, 1024 x 1024
    branding/logo/symbol.png           symbol alone, transparent background
    branding/logo/symbol-mono.png      the same in one flat colour
    branding/installer/*.bmp           sidebar, header, banner, dialog, wizard images
    apps/desktop/src/assets/brand/app-icon.png   tile for the title bar, sidebar and About page
    apps/desktop/public/favicon.png              browser favicon

The Windows icons (apps/desktop/src-tauri/icons) are made from branding/app-icon/icon.png by
`npm run tauri --prefix apps/desktop -- icon <that file>`.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / 'branding'
APP = ROOT / 'apps' / 'desktop'

SOURCE_ICON = BRAND / 'source' / 'icon-v1.png'
SOURCE_LOGO_DARK = BRAND / 'logo' / 'logo-dark.png'
SOURCE_SIDEBAR = BRAND / 'installer' / 'sidebar.png'

TEAL = (0, 212, 170)
WHITE = (255, 255, 255)


def luminance(rgb: np.ndarray) -> np.ndarray:
    return rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)


def filtered(mask: np.ndarray, f: ImageFilter.Filter) -> np.ndarray:
    return np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(f)) > 0


def cut_tile(path: Path, size: int = 1024, margin: float = 0.025) -> Image.Image:
    """The dark rounded tile of the icon, with the white around it made transparent."""
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    lum = luminance(rgb)
    inside = lum <= 205                                   # the tile; its symbol is never this bright
    core = filtered(inside, ImageFilter.MinFilter(7))     # sure inside
    reach = filtered(inside, ImageFilter.MaxFilter(7))    # sure inside + the soft edge

    # Tile colour: the ring just inside the edge, before the glow starts
    ring = core & ~filtered(inside, ImageFilter.MinFilter(21))
    tile_rgb = np.median(rgb[ring], axis=0)
    tile_lum = float(np.median(lum[ring]))
    bg_lum = float(np.median(lum[~reach]))

    # Edge pixels are a mix of tile and background: how much tile decides the transparency
    alpha = np.zeros(lum.shape, dtype=np.float32)
    alpha[core] = 1.0
    band = reach & ~core
    alpha[band] = np.clip((bg_lum - lum[band]) / (bg_lum - tile_lum), 0, 1)
    out = rgb.copy()
    out[band] = tile_rgb

    rgba = np.dstack([out, alpha * 255]).astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA')
    img = img.crop(img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())

    side = max(img.size)
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
    inner = round(size * (1 - 2 * margin))
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.paste(square.resize((inner, inner), Image.LANCZOS), ((size - inner) // 2,) * 2)
    return canvas


def cut_symbol(path: Path) -> Image.Image:
    """The symbol of the logo (left of the name), with its dark background made transparent."""
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    bg = np.median(rgb[:40, :40].reshape(-1, 3), axis=0)
    d = np.clip(rgb.max(axis=2) - bg.max(), 0, None)     # how far each pixel is from the background

    # The symbol is the first run of columns with content; the name starts after a gap
    cols = np.where(d.max(axis=0) > 25)[0]
    end = cols[0]
    for x in cols[1:]:
        if x - end > 15:
            break
        end = x
    keep = np.zeros(d.shape, dtype=bool)
    keep[:, max(cols[0] - 12, 0):end + 12] = True
    d = np.where(keep, d, 0)

    # An edge pixel is a mix of symbol and background: the nearby strongest pixel is the symbol
    strongest = np.asarray(Image.fromarray(np.clip(d, 0, 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))).astype(np.float32)
    alpha = np.where((strongest >= 30) & (d >= 6), np.clip(d / (0.9 * np.maximum(strongest, 1)), 0, 1), 0)
    partial = (alpha > 0) & (alpha < 1)
    out = rgb.copy()
    out[partial] = np.clip((rgb[partial] - (1 - alpha[partial, None]) * bg) / alpha[partial, None], 0, 255)

    img = Image.fromarray(np.dstack([out, alpha * 255]).astype(np.uint8), 'RGBA')
    box = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    pad = round((box[2] - box[0]) * 0.03)
    return img.crop((box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad))


def mono(symbol: Image.Image, colour=TEAL) -> Image.Image:
    flat = Image.new('RGBA', symbol.size, colour + (0,))
    flat.putalpha(symbol.getchannel('A'))
    return flat


def fit(img: Image.Image, height: int) -> Image.Image:
    return img.resize((round(img.width * height / img.height), height), Image.LANCZOS)


def centered_on_white(img: Image.Image, size: tuple[int, int], height: int, right: int | None = None) -> Image.Image:
    """White picture of `size` with `img` (scaled to `height`) centered, or `right` pixels from the right edge."""
    canvas = Image.new('RGB', size, WHITE)
    small = fit(img, height)
    x = (size[0] - small.width) // 2 if right is None else size[0] - small.width - right
    canvas.paste(small, (x, (size[1] - small.height) // 2), small)
    return canvas


def remove_sparkle(img: Image.Image) -> Image.Image:
    """Hides the generator's star mark in the bottom-right corner with the background just left of it."""
    w, h = img.size
    box = (w - 176, h - 177, w - 46, h - 47)
    patch = img.crop((box[0] - 150, box[1], box[2] - 150, box[3]))
    mask = Image.new('L', patch.size, 0)
    ImageDraw.Draw(mask).rectangle((12, 12, patch.width - 12, patch.height - 12), fill=255)
    out = img.copy()
    out.paste(patch, box[:2], mask.filter(ImageFilter.GaussianBlur(7)))
    return out


def tall_crop(img: Image.Image, ratio: float) -> Image.Image:
    """Full height, sides trimmed to width / height = ratio."""
    width = round(img.height * ratio)
    left = (img.width - width) // 2
    return img.crop((left, 0, left + width, img.height))


def save(img: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)
    print(f'  {path.relative_to(ROOT)}  {img.size[0]}x{img.size[1]}')


def main():
    print('Icon')
    tile = cut_tile(SOURCE_ICON)
    save(tile, BRAND / 'app-icon' / 'icon.png')
    save(tile.resize((256, 256), Image.LANCZOS), APP / 'src' / 'assets' / 'brand' / 'app-icon.png')
    save(tile.resize((256, 256), Image.LANCZOS), APP / 'public' / 'favicon.png')

    print('Symbol')
    symbol = cut_symbol(SOURCE_LOGO_DARK)
    save(symbol, BRAND / 'logo' / 'symbol.png')
    save(mono(symbol), BRAND / 'logo' / 'symbol-mono.png')

    print('Installer')
    sidebar = remove_sparkle(Image.open(SOURCE_SIDEBAR).convert('RGB'))
    tall = tall_crop(sidebar, 164 / 314)
    for size in ((164, 314), (328, 628)):
        save(tall.resize(size, Image.LANCZOS), BRAND / 'installer' / f'sidebar-{size[0]}x{size[1]}.bmp')

    # Header strips and small wizard pictures sit on the installer's white pages
    for scale in (1, 2):
        save(centered_on_white(symbol, (150 * scale, 57 * scale), 40 * scale), BRAND / 'installer' / f'header-{150 * scale}x{57 * scale}.bmp')
        save(centered_on_white(tile, (55 * scale, 58 * scale), 50 * scale), BRAND / 'installer' / f'wizard-small-{55 * scale}x{58 * scale}.bmp')
    save(centered_on_white(symbol, (493, 58), 44, right=14), BRAND / 'installer' / 'banner-493x58.bmp')

    dialog = Image.new('RGB', (493, 312), WHITE)
    dialog.paste(tall_crop(sidebar, 164 / 312).resize((164, 312), Image.LANCZOS), (0, 0))
    save(dialog, BRAND / 'installer' / 'dialog-493x312.bmp')


if __name__ == '__main__':
    main()
