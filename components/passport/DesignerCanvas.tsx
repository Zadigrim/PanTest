// Renders all designer-placed elements and stop boxes at scaled absolute positions.
// The artboard coordinate space is 612×792px; multiply by `scale` for screen pixels.
import React from 'react'
import { View, Text, Image } from 'react-native'
import Svg, { Line as SvgLine } from 'react-native-svg'
import { DesignerLocationBox } from './DesignerLocationBox'
import type {
  PassportPage,
  Stop,
  Stamp,
  StampSlotState,
  StampPlacement,
  TextDesignerEl,
  ImageDesignerEl,
  LineDesignerEl,
  HLineDesignerEl,
  VLineDesignerEl,
  PageDesignerElement,
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

function TextEl({ el, scale }: { el: TextDesignerEl; scale: number }) {
  const rotation = el.rotation ?? 0
  return (
    <View
      style={{
        position: 'absolute',
        left: el.x * scale,
        top: el.y * scale,
        width: el.width * scale,
        height: el.height * scale,
        transform: rotation ? [{ rotate: `${rotation}deg` }] : undefined,
        overflow: 'hidden',
        justifyContent: 'center',
      }}
      pointerEvents="none"
    >
      <Text
        style={{
          fontSize: (el.fontSize ?? 14) * scale,
          fontWeight: el.fontWeight ?? 'normal',
          color: `#${el.color ?? '0D1B2A'}`,
          textAlign: el.align ?? 'left',
        }}
        numberOfLines={0}
      >
        {el.content ?? ''}
      </Text>
    </View>
  )
}

function ImageEl({ el, scale }: { el: ImageDesignerEl; scale: number }) {
  const rotation = el.rotation ?? 0
  const opacity = (el.opacity ?? 100) / 100
  if (!el.imageUrl) return null
  return (
    <View
      style={{
        position: 'absolute',
        left: el.x * scale,
        top: el.y * scale,
        width: el.width * scale,
        height: el.height * scale,
        transform: rotation ? [{ rotate: `${rotation}deg` }] : undefined,
        opacity,
      }}
      pointerEvents="none"
    >
      <Image
        source={{ uri: el.imageUrl }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="contain"
      />
    </View>
  )
}

function LineEl({ el, scale }: { el: LineDesignerEl; scale: number }) {
  const x1 = el.x1 * scale
  const y1 = el.y1 * scale
  const x2 = el.x2 * scale
  const y2 = el.y2 * scale
  const PAD = 4
  const minX = Math.min(x1, x2) - PAD
  const minY = Math.min(y1, y2) - PAD
  const svgW = Math.max(Math.abs(x2 - x1) + PAD * 2, 2)
  const svgH = Math.max(Math.abs(y2 - y1) + PAD * 2, 2)
  return (
    <View
      style={{ position: 'absolute', left: minX, top: minY }}
      pointerEvents="none"
    >
      <Svg width={svgW} height={svgH}>
        <SvgLine
          x1={x1 - minX}
          y1={y1 - minY}
          x2={x2 - minX}
          y2={y2 - minY}
          stroke={`#${el.lineColor ?? '0D1B2A'}`}
          strokeWidth={el.thickness ?? 2}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  )
}

function HLineEl({ el, scale }: { el: HLineDesignerEl; scale: number }) {
  const thickness = el.thickness ?? 2
  return (
    <View
      style={{
        position: 'absolute',
        left: el.x * scale,
        top: (el.y + el.height / 2) * scale - thickness / 2,
        width: el.width * scale,
        height: thickness,
        backgroundColor: `#${el.lineColor ?? '0D1B2A'}`,
      }}
      pointerEvents="none"
    />
  )
}

function VLineEl({ el, scale }: { el: VLineDesignerEl; scale: number }) {
  const thickness = el.thickness ?? 2
  return (
    <View
      style={{
        position: 'absolute',
        left: (el.x + el.width / 2) * scale - thickness / 2,
        top: el.y * scale,
        width: thickness,
        height: el.height * scale,
        backgroundColor: `#${el.lineColor ?? '0D1B2A'}`,
      }}
      pointerEvents="none"
    />
  )
}

function renderElement(el: PageDesignerElement, scale: number) {
  switch (el.type) {
    case 'text':  return <TextEl  key={el.id} el={el} scale={scale} />
    case 'image': return <ImageEl key={el.id} el={el} scale={scale} />
    case 'line':  return <LineEl  key={el.id} el={el} scale={scale} />
    case 'hline': return <HLineEl key={el.id} el={el} scale={scale} />
    case 'vline': return <VLineEl key={el.id} el={el} scale={scale} />
    default:      return null
  }
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
      {elements.map((el) => renderElement(el, scale))}

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
