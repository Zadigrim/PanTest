// Collector-facing QR scanner — opens when a stamp placement lands on a
// QR-verified stop (experience_verification_method 'qr', tier 1/2
// fallback) and no code has been scanned for that stop this session.
//
// This does NOT bypass anything: the scanned qrCodeId feeds the existing
// verify-stamp QR check (server-side equality against the stop's stored
// code, alongside the GPS check the tier requires). Visual pattern
// follows the employee field scanner (app/field/scan.tsx).
import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native'
import { Camera, CameraView } from 'expo-camera'
import { parseQrPayload } from '../../lib/qr'
import { palette } from '../../lib/colors'

interface Props {
  /** The stop being stamped; null = sheet closed. */
  stopId: string | null
  stopName?: string
  /** Called with the scanned qrCodeId when a valid code for this stop is read. */
  onScanned: (qrCodeId: string) => void
  onCancel: () => void
}

export function QRScanSheet({ stopId, stopName, onScanned, onCancel }: Props) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [mismatch, setMismatch] = useState(false)

  const visible = stopId != null

  useEffect(() => {
    if (!visible) return
    setMismatch(false)
    Camera.requestCameraPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted')
    })
  }, [visible])

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (!stopId) return
    const parsed = parseQrPayload(data)
    if (!parsed) { setMismatch(true); return }
    if (parsed.stopId !== stopId) { setMismatch(true); return }
    onScanned(parsed.qrCodeId)
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        {hasPermission === false ? (
          <View style={styles.centered}>
            <Text style={styles.mutedText}>
              Camera permission is needed to scan this stop&apos;s QR code.
            </Text>
          </View>
        ) : (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={mismatch ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
        )}

        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.reticle} />
          <Text style={styles.scanHint}>
            {stopName ? `Scan the QR code at ${stopName}` : 'Scan the QR code at this stop'}
          </Text>
          {mismatch && (
            <Text style={styles.mismatch}>
              That code doesn&apos;t match this stop.
            </Text>
          )}
        </View>

        <View style={styles.bottomBar}>
          {mismatch && (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setMismatch(false)}>
              <Text style={styles.primaryBtnText}>Scan again</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.ghostBtn} onPress={onCancel}>
            <Text style={styles.ghostBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.navy },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  reticle: {
    width: 240, height: 240, borderRadius: 16,
    borderWidth: 2, borderColor: palette.accent,
    backgroundColor: 'transparent',
  },
  scanHint: {
    marginTop: 20, color: palette.cream, fontSize: 14,
    fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 32,
    textShadowColor: '#000', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },
  mismatch: {
    marginTop: 10, color: palette.accent, fontSize: 13, fontWeight: '600',
    textShadowColor: '#000', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },
  bottomBar: {
    position: 'absolute', bottom: 48, left: 0, right: 0,
    alignItems: 'center', gap: 12, paddingHorizontal: 32,
  },
  primaryBtn: {
    backgroundColor: palette.green, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', width: '100%',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  ghostBtn: { paddingVertical: 12, alignItems: 'center', width: '100%' },
  ghostBtnText: { color: '#888', fontSize: 14 },
  mutedText: { color: '#888', fontSize: 15, fontStyle: 'italic', textAlign: 'center' },
})
