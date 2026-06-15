// QR payload format for printed stop codes.
//
// ⚠️ MUST stay byte-identical to the mobile app's lib/qr.ts
// (generateQrPayload / parseQrPayload). The okuji scanner runs
// parseQrPayload() on the scanned string, checks stopId, and sends qrCodeId
// to verify-stamp, which matches it against stops.qr_code_id. If this shape
// ever changes, change BOTH files together — otherwise printed codes won't
// scan in the field.
//
// Mirror of: lib/qr.ts (mobile)
//   export function generateQrPayload(stopId, qrCodeId) =>
//     JSON.stringify({ stopId, qrCodeId, v: 1 })
export function generateQrPayload(stopId: string, qrCodeId: string): string {
  return JSON.stringify({ stopId, qrCodeId, v: 1 })
}
