# Okuji — Passport Page Grounds

Six interior page backgrounds at **612 × 792** (US Letter @ 72dpi), in the
Okuji field-notes palette. Each file bakes in: paper color, double-rule
frame, guilloche / line art, paper grain, corner vignette, and the
left-edge binding shadow — so it drops straight under page content.

The guilloche is generated with real parametric curves (hypotrochoid /
epitrochoid / radial-harmonic), so the **SVGs are resolution-independent**
and recolor cleanly.

## Files

| # | Name | Use |
|---|------|-----|
| 01 | `guilloche-medallion` | Formal title / cover-adjacent page. Central woven rosette + microtext border. |
| 02 | `topographic-contours` | Map-like page. Two elevation systems in moss + a dashed clay trail. |
| 03 | `woven-waves` | Banknote-style interwoven wave bands with a centered wordmark panel. |
| 04 | `trail-waypoints` | The walking-tour ground. Dashed route through 7 numbered waypoints + compass. |
| 05 | `rosette-tiling` | Quiet repeating spirograph grid. Good behind dense content. |
| 06 | `field-rule` | Ledger lines + red margin + giant `o.` watermark. Notes / observations pages. |

```
passport-grounds/
  svg/   okuji-ground-0X-*.svg   ← vector, themeable, ~tiny
  png/   okuji-ground-0X-*.png   ← flat 612×792 raster
```

## Palette

```
paper   #f4ecd8   gold      #c9a84c   moss      #5a7a52   muted    #6b6356
paperCl #f6f1e6   goldDeep  #a98a35   mossDeep  #3f5a3a   hairline #c8bfa9
ink     #1f1d1a   clay      #a45a3c
```

## Using in the app (Expo / RN)

The SVGs match the layering your `PassportPage.tsx` already does, so you can
replace the `GuillocheBackground` layer with a full-bleed ground:

```tsx
import { SvgUri } from 'react-native-svg'
// or bundle the raw string and render with <SvgXml xml={...} />

<SvgUri
  width={width}
  height={height}
  uri={require('../assets/passport-grounds/okuji-ground-04-trail-waypoints.svg')}
/>
```

On web/wireframes just use the PNG or SVG as a background image.

To **recolor** for the forest variant, swap the hex values in each SVG
(`#c9a84c`→bark, `#5a7a52`→moss, `#0d1b2a`→pine, etc.) — they're plain
attribute strings.
