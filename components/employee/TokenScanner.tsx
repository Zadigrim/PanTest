import React, { useState, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { isValidTokenFormat } from '../../lib/qr'

interface Props {
  onTokenScanned: (code: string) => void
}

export function TokenScanner({ onTokenScanned }: Props) {
  const [permission, requestPermission] = useCameraPermissions()
  const [manualCode, setManualCode] = useState('')
  const [scanned, setScanned] = useState(false)

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return
    setScanned(true)

    let code = data.trim().toUpperCase()
    if (isValidTokenFormat(code)) {
      onTokenScanned(code)
    } else {
      Alert.alert('Invalid QR', 'This QR code is not a Okuji redemption token.', [
        { text: 'Try Again', onPress: () => setScanned(false) },
      ])
    }
  }

  const handleManualEntry = () => {
    const code = manualCode.trim().toUpperCase()
    if (!isValidTokenFormat(code)) {
      Alert.alert('Invalid format', 'Enter a code in the format MCM-XXXX-XX.')
      return
    }
    onTokenScanned(code)
  }

  if (!permission) return <View />

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Camera access is needed to scan tokens.</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionBtn}>
          <Text style={styles.permissionBtnText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      >
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanHint}>Point camera at collector's QR token</Text>
        </View>
      </CameraView>

      {scanned && (
        <TouchableOpacity onPress={() => setScanned(false)} style={styles.rescanBtn}>
          <Text style={styles.rescanText}>Tap to scan again</Text>
        </TouchableOpacity>
      )}

      <View style={styles.manualEntry}>
        <Text style={styles.manualLabel}>Or enter code manually:</Text>
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            placeholder="MCM-XXXX-XX"
            placeholderTextColor="#aaa"
            value={manualCode}
            onChangeText={setManualCode}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={10}
          />
          <TouchableOpacity onPress={handleManualEntry} style={styles.manualBtn}>
            <Text style={styles.manualBtnText}>Look up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: '#C9A84C',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scanHint: {
    color: '#fff',
    marginTop: 16,
    fontSize: 14,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  rescanBtn: {
    backgroundColor: '#333',
    padding: 12,
    alignItems: 'center',
  },
  rescanText: { color: '#fff', fontSize: 14 },
  manualEntry: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  manualLabel: { fontSize: 12, color: '#888', marginBottom: 8 },
  manualRow: { flexDirection: 'row', gap: 8 },
  manualInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  manualBtn: {
    backgroundColor: '#0D1B2A',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  manualBtnText: { color: '#fff', fontWeight: '600' },
  permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permissionText: { fontSize: 15, color: '#333', textAlign: 'center', marginBottom: 16 },
  permissionBtn: { backgroundColor: '#0D1B2A', borderRadius: 8, padding: 12 },
  permissionBtnText: { color: '#fff', fontWeight: '600' },
})
