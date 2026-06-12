okuji — app background
======================
Forest-green field with the o. crest summit, the winding trail, topographic
contours, wordmark + "PASSPORTS FOR REAL PLACES", and the EST. 2026 footer.

files
  okuji-app-background.svg        vector master — resolution-independent (recommended).
                                  Use with react-native-svg, or rasterize to any size.
  okuji-bg@3x-1170x2532.png       full-res raster (iPhone @3x reference)
  okuji-bg@2x-780x1688.png        @2x
  okuji-bg@1x-390x844.png         @1x

notes
  - SVG scales to ANY screen with no quality loss — preferred for a phone background.
  - The wordmark uses Inter 500 (-0.02em); load Inter where the SVG is rendered, or
    keep the PNGs which already have the type baked in.
  - okuji palette only: forest #1d4d2e, cream #f4ecd8, gold #c9a84c, ink #1f1d1a.