# Branding

Every logo, icon and brand picture of DataBridge Pro lives here. The files you paste are the
originals; everything else is made from them by one script.

Brand colours: teal `#00D4AA`, deep green `#006655`, near-black `#0A0A0A` / `#0E0E0E`.

## Originals (pasted from the image generator)

| File | What it is |
|---|---|
| `source/icon-v1.png` | The icon tile on a white background, 2048 × 2048 |
| `logo/logo-dark.png` | Symbol + "DataBridge PRO" on near-black, 2752 × 1536 |
| `logo/logo-light.png` | The same on white |
| `installer/sidebar.png` | Tall installer picture, 1536 × 2752 |

## Made from them (do not edit by hand)

Run `python scripts/build-branding.py` (needs Python 3 with Pillow and numpy). It rewrites:

| File | Used for |
|---|---|
| `app-icon/icon.png` | The icon tile cut out of the white, transparent corners, 1024 × 1024. Source of every Windows icon |
| `logo/symbol.png`, `logo/symbol-mono.png` | The symbol alone on a transparent background (full colour, and one flat colour) |
| `installer/installer-icon.ico` | Installer icon (copy of the app's `icon.ico`) |
| `installer/sidebar-164x314.bmp`, `sidebar-328x628.bmp` | Welcome and finish pages of the installer (second size for sharp screens) |
| `installer/header-150x57.bmp`, `header-300x114.bmp` | Strip on the inner installer pages |
| `installer/banner-493x58.bmp`, `dialog-493x312.bmp` | The same two for an `.msi` installer |
| `installer/wizard-small-55x58.bmp`, `wizard-small-110x116.bmp` | Small corner picture of Inno Setup installers |

The script also writes the pictures the app uses: `apps/desktop/src/assets/brand/app-icon.png`
(title bar, sidebar, About page) and `apps/desktop/public/favicon.png`.

## After changing the icon

1. Run `python scripts/build-branding.py`.
2. Rebuild the Windows icons: `cd apps/desktop` and
   `npx tauri icon ../../branding/app-icon/icon.png`.
3. Copy `apps/desktop/src-tauri/icons/icon.ico` to `branding/installer/installer-icon.ico`.

## The installer

`npm run build` makes the installer with these pictures already in it: the settings are in
`apps/desktop/src-tauri/tauri.conf.json` (`bundle.windows.nsis` for the `.exe` installer,
`bundle.windows.wix` for the `.msi`). The finished files land in
`apps/desktop/src-tauri/target/release/bundle/`.

For an installer built with another tool (Inno Setup, for example), use the same
files: `installer-icon.ico` as the icon, `sidebar-164x314.bmp` (or the 328 × 628 one) as the
wizard picture and `wizard-small-55x58.bmp` as the small picture.

## Other folders

- `marketing/`: banners, social pictures and screenshots. Suggested sizes: website banner
  1920 × 600, social post 1080 × 1080, share picture 1200 × 630.
- Do not paste `.zip` files here: the repository ignores them.
