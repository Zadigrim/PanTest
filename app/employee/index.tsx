// Employee Terminal — Step 1 of 2: Scan or enter token.
// Two-column layout: camera viewfinder (left) + manual token input (right).
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Alert,
  useWindowDimensions, ActivityIndicator,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { router } from 'expo-router'
import { useEmployeeAuth, useTokenScanner, useRedemption } from '../../hooks/useEmployee'
import { getCurrentUser } from '../../lib/supabase'
import { useCounterRefresh } from './_layout'
import { palette } from '../../lib/colors'

const INK   = palette.ink
const PAPER = palette.paper
const MUTED = palette.muted
const ACCENT = palette.accent
const HAIRLINE = palette.hairline
const CORNER_SZ = 22
const CORNER_T  = 2.5

function CornerBrackets({ size }: { size: number }) {
  const c: React.CSSProperties[] = [
    { position: 'absolute', top: 8, left: 8 },
    { position: 'absolute', top: 8, right: 8 },
    { position: 'absolute', bottom: 8, left: 8 },
    { position: 'absolute', bottom: 8, right: 8 },
  ]
  const borders = [
    { borderTopWidth: CORNER_T, borderLeftWidth: CORNER_T },
    { borderTopWidth: CORNER_T, borderRightWidth: CORNER_T },
    { borderBottomWidth: CORNER_T, borderLeftWidth: CORNER_T },
    { borderBottomWidth: CORNER_T, borderRightWidth: CORNER_T },
  ]
  return (
    <>
      {([0, 1, 2, 3] as const).map(i => (
        <View
          key={i}
          style={[
            { position: 'absolute', width: CORNER_SZ, height: CORNER_SZ, borderColor: ACCENT },
            borders[i] as any,
            c[i] as any,
          ]}
        />
      ))}
    </>
  )
}

export default function ScanScreen() {
  const [userId, setUserId] = useState<string | null>(null)
  const { auth, loading: authLoading } = useEmployeeAuth(userId ?? '')
  const { scanning, scanToken, error } = useTokenScanner()
  const { recordScan } = useRedemption()
  const { refresh } = useCounterRefresh()
  const [permission, requestPermission] = useCameraPermissions()
  const [manualCode, setManualCode] = useState('')
  const [scanned, setScanned] = useState(false)
  const { width } = useWindowDimensions()

  const scanLineY = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineY, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(scanLineY, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [scanLineY])

  useEffect(() => {
    getCurrentUser().then(u => {
      if (!u) { router.replace('/(auth)/login'); return }
      setUserId(u.id)
    })
  }, [])

  const handleToken = async (code: string) => {
    const result = await scanToken(code)
    if (!result || !userId) return
    await recordScan(result.id, userId)
    refresh()
    setScanned(false)
    router.push({ pathname: '/employee/redeem', params: { tokenId: result.id } })
  }

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned || scanning) return
    setScanned(true)
    handleToken(data.trim().toUpperCase())
  }

  const handleManualLookup = () => {
    const code = manualCode.trim().toUpperCase()
    if (!code) return
    setManualCode('')
    handleToken(code)
  }

  if (authLoading || !userId) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={ACCENT} />
      </View>
    )
  }

  if (!auth) {
    return (
      <View style={s.centered}>
        <Text style={s.noAccountText}>
          No active employee authorization found.{'\n'}Contact your manager.
        </Text>
      </View>
    )
  }

  // Viewfinder height — square, capped at available width half
  const vfSize = Math.min(width * 0.42, 260)

  return (
    <View style={s.container}>
      {/* Step header */}
      <View style={s.stepHeader}>
        <Text style={s.stepLabel}>STEP 1 OF 2</Text>
        <Text style={s.stepTitle}>Scan or enter token</Text>
      </View>

      {!!error && (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {/* Two-column body */}
      <View style={s.body}>

        {/* Left: camera */}
        <View style={s.cameraCol}>
          <Text style={s.colLabel}>FROM CAMERA</Text>
          <View style={[s.viewfinderWrap, { width: vfSize, height: vfSize }]}>
            {!permission?.granted ? (
              <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
                <Text style={s.permBtnText}>Allow camera</Text>
              </TouchableOpacity>
            ) : (
              <>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  onBarcodeScanned={scanned || scanning ? undefined : handleBarcodeScanned}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                />
                <CornerBrackets size={CORNER_SZ} />
                <Animated.View
                  style={[
                    s.scanLine,
                    {
                      transform: [{
                        translateY: scanLineY.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, vfSize - 2],
                        }),
                      }],
                    },
                  ]}
                />
                {scanned && (
                  <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    onPress={() => setScanned(false)}
                  >
                    <View style={s.rescanOverlay}>
                      <Text style={s.rescanText}>Tap to scan again</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>

        {/* Right: manual input */}
        <View style={s.inputCol}>
          <Text style={s.colLabel}>OR TYPE</Text>
          <TextInput
            style={s.tokenInput}
            placeholder="BX-7H4K"
            placeholderTextColor={HAIRLINE}
            value={manualCode}
            onChangeText={t => setManualCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
            returnKeyType="go"
            onSubmitEditing={handleManualLookup}
          />
          <Text style={s.formatHint}>format MCM-XXXX-XX</Text>
          <TouchableOpacity
            style={[s.lookupBtn, (scanning || !manualCode) && s.lookupBtnDisabled]}
            onPress={handleManualLookup}
            disabled={scanning || !manualCode}
          >
            <Text style={s.lookupBtnText}>
              {scanning ? 'Looking up…' : 'Look up token →'}
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  noAccountText: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 22 },

  stepHeader: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0ece3',
  },
  stepLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2.5,
    color: MUTED, textTransform: 'uppercase', marginBottom: 4,
  },
  stepTitle: { fontSize: 22, fontWeight: '700', color: INK },

  errorBanner: {
    backgroundColor: '#fdecea', borderLeftWidth: 3, borderLeftColor: '#c0392b',
    marginHorizontal: 28, marginTop: 12, padding: 12, borderRadius: 4,
  },
  errorText: { fontSize: 13, color: '#c0392b' },

  body: {
    flex: 1, flexDirection: 'row', padding: 28, gap: 24, alignItems: 'flex-start',
  },

  // Camera column
  cameraCol: { flex: 1, alignItems: 'center' },
  colLabel: {
    fontSize: 9, fontWeight: '700', letterSpacing: 2, color: MUTED,
    textTransform: 'uppercase', marginBottom: 10,
  },
  viewfinderWrap: {
    backgroundColor: '#0a0a0a',
    overflow: 'hidden',
    position: 'relative',
  },
  scanLine: {
    position: 'absolute', left: 0, right: 0, height: 1.5,
    backgroundColor: ACCENT, opacity: 0.7,
  },
  rescanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  rescanText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  permBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  permBtnText: { color: ACCENT, fontSize: 13, fontWeight: '600' },

  // Input column
  inputCol: { flex: 1 },
  tokenInput: {
    borderWidth: 1.5, borderColor: HAIRLINE, borderRadius: 4,
    padding: 14, fontSize: 22, fontWeight: '600', color: INK,
    letterSpacing: 6, fontFamily: 'monospace',
    textAlign: 'center', marginBottom: 6,
  },
  formatHint: { fontSize: 10, color: MUTED, textAlign: 'center', marginBottom: 16 },
  lookupBtn: {
    backgroundColor: INK, borderRadius: 4, paddingVertical: 14, paddingHorizontal: 16,
    alignItems: 'center',
  },
  lookupBtnDisabled: { opacity: 0.4 },
  lookupBtnText: { color: palette.cream, fontSize: 15, fontWeight: '600' },
})
