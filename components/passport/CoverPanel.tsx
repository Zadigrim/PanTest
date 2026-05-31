// Renders one HALF of a designer-built cover spread, scaled to a mobile
// page. Used by BookCover (outside front) and InsideCoverPage (inside
// front), and by any future cover surfaces that need to display the back
// panels.
//
// Cover spread coordinate space (matching okujiKobo's designer):
//   total width = 1248
//   back panel: x = 0..612
//   spine:      x = 612..636 (24 wide)
//   front panel: x = 636..1248
//   height = 792
//
// A mobile page is the artboard's 612×792, so each cover page shows ONE
// of the two 612-wide panels at the page's full size. The spread is
// translated inside an overflow-hidden viewport so the chosen panel sits
// where the page begins — no scaling distortion. Elements outside the
// visible panel are clipped naturally.
import React from 'react'
import { View, Image, StyleSheet } from 'react-native'
import { renderPageElement } from './PageElementRenderer'
import type { CoverSideData } from '../../types'

const COVER_SPREAD_W = 1248
const COVER_SPREAD_H = 792
const PANEL_W = 612

type Half = 'front' | 'back'

interface Props {
  data: CoverSideData
  // Which half of the spread to show. 'front' = right panel (x=636..1248);
  // 'back' = left panel (x=0..612). The book's CLOSED state shows the
  // outside-front; the FIRST inside page shows the inside-front (which is
  // the LEFT panel of the inside spread, because the inside-front-cover is
  // on the left when you open a book).
  //
  // Mobile usage today:
  //   - BookCover (outside, closed)   -> half='front'  (outside front face)
  //   - InsideCoverPage (just opened) -> half='back'   (inside front face)
  half: Half
  // The page's rendered size on screen. The 612-wide panel scales to fit
  // this width; height scales proportionally to maintain aspect.
  pageWidth: number
  pageHeight: number
}

export function CoverPanel({ data, half, pageWidth, pageHeight }: Props) {
  const scale = pageWidth / PANEL_W

  // The panel that's shown determines BOTH the background color AND the
  // x-translation applied to the spread inside the clipping viewport.
  // front panel (x=636..1248): bg=front_bg, translate by -636
  // back  panel (x=0..612):    bg=back_bg,  translate by 0
  const isFront = half === 'front'
  const panelBg = `#${(isFront ? data.front_bg : data.back_bg) || 'F5F2EC'}`
  const panelOffsetXSpread = isFront ? PANEL_W + 24 : 0 // = 636 for front, 0 for back

  return (
    <View
      style={[
        styles.viewport,
        { width: pageWidth, height: pageHeight, backgroundColor: panelBg },
      ]}
    >
      {/* The spread's element/image layer, translated so the chosen
          panel aligns to the viewport origin. */}
      <View
        style={{
          position: 'absolute',
          left: -panelOffsetXSpread * scale,
          top: 0,
          width: COVER_SPREAD_W * scale,
          height: COVER_SPREAD_H * scale,
        }}
        pointerEvents="none"
      >
        {/* Designer-uploaded cover image. Placed in spread space at
            (image_position_x, image_position_y) with image_scale and
            image_opacity, then clipped by the viewport above. */}
        {data.image_url && (
          <View
            style={{
              position: 'absolute',
              left: (data.image_position_x ?? 0) * scale,
              top: (data.image_position_y ?? 0) * scale,
              width: COVER_SPREAD_W * (data.image_scale ?? 1) * scale,
              height: COVER_SPREAD_H * (data.image_scale ?? 1) * scale,
              opacity: (data.image_opacity ?? 100) / 100,
            }}
          >
            <Image
              source={{ uri: data.image_url }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          </View>
        )}

        {/* Designer-placed elements (text/image/lines). Coords are in
            the 1248×792 spread space; renderPageElement scales them. */}
        {(data.elements ?? []).map((el) => renderPageElement(el, scale))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
    position: 'relative',
  },
})
