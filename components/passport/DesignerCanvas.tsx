// Renders all designer-placed elements and stop boxes at scaled absolute positions.
// The artboard coordinate space is 612×792px; multiply by `scale` for screen pixels.
//
// Element rendering (text/image/line/hline/vline) is delegated to
// PageElementRenderer so the same logic powers cover-spread rendering
// in CoverPanel without duplication.
import React from 'react'
import { View } from 'react-native'
import { DesignerLocationBox } from './DesignerLocationBox'
import { renderPageElement } from './PageElementRenderer'
import type {
  PassportPage,
  Stop,
  Stamp,
  StampSlotState,
  StampPlacement,
} from '../../types'

interface Props {
  page: PassportPage
  stops: Stop[]
  stamps: Record<string, Stamp>
  slotStates: Record<string, StampSlotState>
  scale: number
  artboardH: number
  onStampPlaced: (stopId: string, placement: StampPlacement) => void
  onPressStart: (stopId: string) => void
  onPressCancel: (stopId: string) => void
}

export function DesignerCanvas({
  page,
  stops,
  stamps,
  slotStates,
  scale,
  artboardH,
  onStampPlaced,
  onPressStart,
  onPressCancel,
}: Props) {
  const elements = page.elements ?? []

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, width: 612 * scale, height: artboardH }}>
      {elements.map((el) => renderPageElement(el, scale))}

      {stops.map((stop) =>
        stop.box_x != null && stop.box_y != null ? (
          <DesignerLocationBox
            key={stop.id}
            stop={stop}
            scale={scale}
            slotState={slotStates[stop.id] ?? 'dormant'}
            stamp={stamps[stop.id]}
            onStampPlaced={(p) => onStampPlaced(stop.id, p)}
            onPressStart={() => onPressStart(stop.id)}
            onPressCancel={() => onPressCancel(stop.id)}
          />
        ) : null
      )}
    </View>
  )
}
