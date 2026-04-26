// SVG stamp renderer with shape, color, icon, smudge filter.
import React from 'react'
import { View } from 'react-native'
import Svg, { Circle, Rect, Path, Text as SvgText, Defs, Filter, FeTurbulence, FeDisplacementMap } from 'react-native-svg'
import type { Stop } from '../../types'

interface Props {
  stop: Pick<Stop, 'stamp_icon' | 'stamp_color' | 'stamp_shape' | 'stamp_smudge'>
  size: number
  rotationDeg?: number
  smudge?: Stop['stamp_smudge']
  ghost?: boolean
}

function smudgeScale(smudge: Stop['stamp_smudge']): number {
  return { none: 0, light: 2, medium: 5, heavy: 10 }[smudge] ?? 0
}

export function StampArtwork({ stop, size, rotationDeg = 0, ghost = false }: Props) {
  const filterId = `smudge-${stop.stamp_smudge}`
  const scale = smudgeScale(stop.stamp_smudge)
  const opacity = ghost ? 0.3 : 1
  const color = ghost ? stop.stamp_color + '80' : stop.stamp_color

  const shapeEl = () => {
    const half = size / 2
    switch (stop.stamp_shape) {
      case 'rectangle':
        return <Rect x="4" y="4" width={size - 8} height={size - 8} rx="4" stroke={color} strokeWidth="2.5" fill="none" />
      case 'hexagon': {
        const r = half - 4
        const pts = Array.from({ length: 6 }, (_, i) => {
          const a = (Math.PI / 3) * i - Math.PI / 6
          return `${half + r * Math.cos(a)},${half + r * Math.sin(a)}`
        }).join(' ')
        return <Path d={`M ${pts} Z`} stroke={color} strokeWidth="2.5" fill="none" />
      }
      case 'badge': {
        const pts = `${half},4 ${size - 4},${size * 0.35} ${size * 0.8},${size - 4} ${size * 0.2},${size - 4} 4,${size * 0.35}`
        return <Path d={`M ${pts} Z`} stroke={color} strokeWidth="2.5" fill="none" />
      }
      default:
        return <Circle cx={half} cy={half} r={half - 4} stroke={color} strokeWidth="2.5" fill="none" />
    }
  }

  return (
    <View style={{ width: size, height: size, transform: [{ rotate: `${rotationDeg}deg` }], opacity }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {scale > 0 && (
          <Defs>
            <Filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
              <FeTurbulence type="turbulence" baseFrequency="0.65" numOctaves="3" seed="2" />
              <FeDisplacementMap in="SourceGraphic" scale={scale} xChannelSelector="R" yChannelSelector="G" />
            </Filter>
          </Defs>
        )}
        <Svg width={size} height={size} filter={scale > 0 ? `url(#${filterId})` : undefined}>
          {shapeEl()}
          <SvgText
            x={size / 2}
            y={size / 2 + size * 0.12}
            fontSize={size * 0.38}
            textAnchor="middle"
            fill={ghost ? color : stop.stamp_color}
          >
            {stop.stamp_icon}
          </SvgText>
        </Svg>
      </Svg>
    </View>
  )
}
