'use client'

// One-click PDF download for the "Print physical passports" feature.
//
// The previous flow opened a modal that exposed stop-selection, copies,
// journal-override radios, a Preview button, and a Download button. All
// of those options have been removed: every stop is always included,
// copies are chosen at the printer, and journal lines don't render
// at all (that mechanism — lines layered onto stop pages — is being
// retired; future journal-line support will be implemented as dedicated
// journal pages, not as an overlay on stop pages).
//
// What's left is this: POST the request, take the blob, fire an <a>
// click to download. The caller wires a single button (no modal, no
// state). Returns a result so the caller can surface an error banner.

export type DownloadResult = { ok: true } | { ok: false; error: string }

export async function downloadPrintPdf(
  passportId: string,
  passportTitle: string,
): Promise<DownloadResult> {
  const res = await fetch(`/api/passports/${passportId}/print-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // No body fields anymore. The route accepts empty JSON and includes
    // every stop, no copy multiplication, no journal toggle.
    body: '{}',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, error: text || `HTTP ${res.status}` }
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const today = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `${passportTitle} — Print Passport — ${today}.pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return { ok: true }
}
