// One-shot directions handoff to the device's maps app.
//
// HARD ephemeral-location boundary: okuji reads NO location here. We hand the
// STOP's destination coordinate to the OS maps app (Apple Maps on iOS, the
// geo: handler — Google Maps or default — on Android), which supplies the
// user's own position. This is NOT in-app navigation: no map that follows the
// user, no continuous tracking, no position watch, no route held. Equivalent
// to tapping "Directions" on any address. See the passport-touch spec.
import { Linking, Platform } from 'react-native'

const universal = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

export async function openDirections(lat: number, lng: number, label?: string): Promise<void> {
  const q = label ? encodeURIComponent(label) : ''
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${lat},${lng}${q ? `&q=${q}` : ''}`,
    android: `geo:${lat},${lng}?q=${lat},${lng}${label ? `(${label})` : ''}`,
    default: universal(lat, lng),
  }) as string

  try {
    await Linking.openURL(url)
  } catch {
    // Scheme not handled (e.g. no maps app registered) — fall back to the
    // universal https maps URL, which any browser/maps app resolves.
    await Linking.openURL(universal(lat, lng))
  }
}
