// QR scanner for employee field mode.
// Scans a QR encoding OKUJI:{userId}:{stopId}
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { Camera, CameraView } from 'expo-camera'
import { router } from 'expo-router'
import { palette } from '../../lib/colors'

function parseOkujiQr(raw: string): { userId: string; stopId: string } | null {
  const parts = raw.split(':')
  if (parts.length !== 3 || parts[0] !== 'OKUJI') return null
  const [, userId, stopId] = parts
  if (!userId || !stopId) return null
  return { userId, stopId }
}

export default function ScanScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [scanned, setScanned] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [manualText, setManualText] = useState('')

  useEffect(() => {
    Camera.requestCameraPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted')
    })
  }, [])

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return
    setScanned(true)

    const parsed = parseOkujiQr(data)
    if (!parsed) {
      Alert.alert(
        'Unrecognized code',
        'This QR does not appear to be a Okuji visitor code.',
        [{ text: 'Try again', onPress: () => setScanned(false) }]
      )
      return
    }

    router.replace({
      pathname: '/field/lookup',
      params: { userId: parsed.userId, stopId: parsed.stopId },
    })
  }

  const handleManualSubmit = () => {
    const raw = manualText.trim().toUpperCase()
    // Manual entry: OKUJI:userId:stopId or just userId:stopId
    const parsed = parseOkujiQr(raw) ?? parseOkujiQr(`OKUJI:${raw}`)
    if (!parsed) {
      Alert.alert('Invalid format', 'Enter the code as shown on the visitor\'s screen.')
      return
    }
    router.replace({
      pathname: '/field/lookup',
      params: { userId: parsed.userId, stopId: parsed.stopId },
    })
  }

  if (manualMode) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.manualContainer}>
          <Text style={styles.manualTitle}>Enter visitor code</Text>
          <Text style={styles.manualHint}>Ask the visitor to show their code</Text>
          <TextInput
            style={styles.manualInput}
            value={manualText}
            onChangeText={setManualText}
            placeholder="OKUJI:userId:stopId"
            placeholderTextColor="#555"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleManualSubmit}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleManualSubmit}>
            <Text style={styles.primaryBtnText}>Look up visitor</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => setManualMode(false)}>
            <Text style={styles.ghostBtnText}>Back to camera</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    )
  }

  if (hasPermission === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.mutedText}>Requesting camera access…</Text>
      </View>
    )
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centered}>
        <Text style={styles.mutedText}>Camera permission denied.</Text>
        <TouchableOpacity style={[styles.primaryBtn, { marginTop: 20 }]} onPress={() => setManualMode(true)}>
          <Text style={styles.primaryBtnText}>Enter code manually</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      <View style={styles.overlay}>
        <View style={styles.reticle} />
        <Text style={styles.scanHint}>Point at the visitor's QR code</Text>
      </View>
      <View style={styles.bottomBar}>
        {scanned && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setScanned(false)}>
            <Text style={styles.primaryBtnText}>Scan again</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.ghostBtn} onPress={() => setManualMode(true)}>
          <Text style={styles.ghostBtnText}>Enter code manually</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.navy },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.navy, padding: 32,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none',
  },
  reticle: {
    width: 240, height: 240, borderRadius: 16,
    borderWidth: 2, borderColor: palette.accent,
    backgroundColor: 'transparent',
  },
  scanHint: {
    marginTop: 20, color: palette.cream, fontSize: 14,
    fontStyle: 'italic',
    textShadowColor: '#000', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },
  bottomBar: {
    position: 'absolute', bottom: 48, left: 0, right: 0,
    alignItems: 'center', gap: 12, paddingHorizontal: 32,
  },
  manualContainer: {
    flex: 1, padding: 28, justifyContent: 'center',
  },
  manualTitle: {
    fontSize: 22, color: palette.cream, fontFamily: 'serif', marginBottom: 6,
  },
  manualHint: {
    fontSize: 13, color: '#888', marginBottom: 24, fontStyle: 'italic',
  },
  manualInput: {
    backgroundColor: '#152232', borderRadius: 10, padding: 16,
    color: palette.cream, fontSize: 16, fontFamily: 'monospace',
    borderWidth: 1, borderColor: '#1a2d44', marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: palette.green, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', width: '100%',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  ghostBtn: {
    paddingVertical: 12, alignItems: 'center', width: '100%',
  },
  ghostBtnText: { color: '#888', fontSize: 14 },
  mutedText: { color: '#888', fontSize: 15, fontStyle: 'italic' },
})
