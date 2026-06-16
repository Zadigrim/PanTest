// Dev-only preview to eyeball the Icon component + registry before any
// consumer migration. Drop <IconPreview /> into a screen to verify icons
// render and recolor. NOT wired into navigation and NOT a consumer of the
// real surfaces — migration of intended consumers is a separate step.
import React from 'react'
import { View, Text } from 'react-native'
import { Icon } from './Icon'
import { palette } from '../../lib/colors'

export function IconPreview() {
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ color: palette.muted, fontSize: 12 }}>Icon preview — default ink + recolored</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <Icon name="anchor" />
        <Icon name="compass-rose" color={palette.green} size={32} />
        <Icon name="leaf" color={palette.accent} size={40} />
        <Icon name="lighthouse" color={palette.red} size={28} />
        <Icon name="heart" color={palette.navy} size={24} />
      </View>
    </View>
  )
}
