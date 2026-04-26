// SVG guilloche security-printing pattern — oval + diamond per tile.
// Identical visual language to physical McMenamins passports.
import React from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Defs, Pattern, Ellipse, Path, Rect } from 'react-native-svg'

interface Props {
  color?: string
  opacity?: number
  width: number
  height: number
}

export function GuillocheBackground({ color = '#4a6fa5', opacity = 0.11, width, height }: Props) {
  const tileSize = 36

  return (
    <View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <Pattern
            id="guilloche"
            x="0"
            y="0"
            width={tileSize}
            height={tileSize}
            patternUnits="userSpaceOnUse"
          >
            {/* Outer ellipse */}
            <Ellipse
              cx="18" cy="18"
              rx="16" ry="11"
              stroke={color}
              strokeWidth="0.4"
              fill="none"
              opacity="0.45"
            />
            {/* Middle ellipse */}
            <Ellipse
              cx="18" cy="18"
              rx="12" ry="8"
              stroke={color}
              strokeWidth="0.3"
              fill="none"
              opacity="0.35"
            />
            {/* Inner ellipse */}
            <Ellipse
              cx="18" cy="18"
              rx="8" ry="5"
              stroke={color}
              strokeWidth="0.2"
              fill="none"
              opacity="0.25"
            />
            {/* Diamond */}
            <Path
              d="M18 7 L29 18 L18 29 L7 18 Z"
              stroke={color}
              strokeWidth="0.25"
              fill="none"
              opacity="0.20"
            />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#guilloche)" />
      </Svg>
    </View>
  )
}
