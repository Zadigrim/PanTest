# Okuji — App Icon (J1)

The **J1** mark: an "o" with a faint dashed walking path threading through it,
ending at a solid dot. Ink `#1f1d1a` on paper `#f6f1e6`.

## What's here

```
appicon/
  okuji-icon.svg              master — square, paper bg, centered (iOS masks corners)
  okuji-icon-rounded.svg      rounded tile w/ ink hairline (web / preview)
  okuji-icon-mark.svg         transparent, glyph only (safe-zone padded)
  favicon.png                 32×32

  png/                        square, full-bleed paper — iOS & store & web
    okuji-icon-1024 … 16.png  (1024,512,256,192,180,167,152,120,80,64,48,32,16)

  png-rounded/                rounded preview tiles (1024,512,256,180)

  android/                    adaptive icon layers (1024)
    okuji-adaptive-foreground.png   transparent glyph, inside the 66% safe zone
    okuji-adaptive-background.png   solid paper
    okuji-adaptive-foreground.svg
```

## Placement

**Expo / `app.json`** (matches the Okuji styles brief):
```json
{
  "expo": {
    "icon": "./assets/appicon/png/okuji-icon-1024.png",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/appicon/android/okuji-adaptive-foreground.png",
        "backgroundColor": "#f6f1e6"
      }
    },
    "web": { "favicon": "./assets/appicon/favicon.png" }
  }
}
```

**iOS** — supply `png/okuji-icon-1024.png` as the App Store / asset-catalog
source. iOS rounds the corners itself, so use the **square** (not rounded)
PNG. The smaller sizes are provided if you populate an asset catalog by hand.

**Android** — use the `android/` foreground + a `#f6f1e6` background color
(or the background PNG). The glyph already sits inside the 66% safe zone so
it won't get clipped by round / squircle / teardrop masks.

**Web / favicon** — `favicon.png`, or any size from `png/`.

## Notes

- Want the icon on **ink** instead of paper (dark tile, paper-colored mark)?
  Say the word — it's a one-value swap and I'll regenerate the set.
- Everything derives from `okuji-icon.svg`; re-export at any size from that
  master.
