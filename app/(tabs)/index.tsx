// Discover tab — segmented control: Nearby (default) ⇄ Catalogue
import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform,
} from 'react-native'
import NearbyMode from '../../components/discover/NearbyMode'
import CatalogueMode from '../../components/discover/CatalogueMode'

const NAVY = '#0D1B2A'
const GOLD = '#C9A84C'
const CREAM = '#F5F0E8'

type Tab = 'nearby' | 'catalogue'

export default function DiscoverScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('nearby')

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Segmented control */}
      <View style={styles.segmentContainer}>
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segBtn, activeTab === 'nearby' && styles.segBtnActive]}
            onPress={() => setActiveTab('nearby')}
            activeOpacity={0.75}
          >
            <Text style={[styles.segLabel, activeTab === 'nearby' && styles.segLabelActive]}>
              Nearby
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segBtn, activeTab === 'catalogue' && styles.segBtnActive]}
            onPress={() => setActiveTab('catalogue')}
            activeOpacity={0.75}
          >
            <Text style={[styles.segLabel, activeTab === 'catalogue' && styles.segLabelActive]}>
              Catalogue
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'nearby' ? <NearbyMode /> : <CatalogueMode />}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: NAVY,
  },
  segmentContainer: {
    backgroundColor: NAVY,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'android' ? 10 : 6,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  segBtnActive: {
    backgroundColor: GOLD,
  },
  segLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(245,240,232,0.55)',
    letterSpacing: 0.3,
  },
  segLabelActive: {
    color: NAVY,
  },
  content: {
    flex: 1,
    backgroundColor: '#f4f4f4',
  },
})
