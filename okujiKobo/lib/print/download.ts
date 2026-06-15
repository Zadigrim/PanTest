'use client'

// PDF download for the "Print physical passports" feature.
//
// An earlier flow exposed stop-selection, copies, and journal-override
// radios; those were removed (every stop is always included, copies are
// chosen at the printer, journal lines don't render). The one option
// that survives is `showStamps`: whether to render each stop's stamp
// image inside its location box. Off by default — a blank box is what
// collectors physically stamp into; on is a "how it'll look when
// stamped" preview. The caller opens a small modal to set it.
//
// POST the request, take the blob, fire an <a> click to download.
// Returns a result so the caller can surface an error banner.

export type DownloadResult = { ok: true } | { ok: false; error: string }

export async function downloadPrintPdf(
  passportId: string,
  passportTitle: string,
  showStamps = false,
  // 'booklet' = the home-printer cut/fold/staple PDF (default).
  // 'trim' = a partner-ready single-leaf PDF at true trim size + 3 mm bleed.
  format: 'booklet' | 'trim' = 'booklet',
): Promise<DownloadResult> {
  const qs = format === 'trim' ? '?format=trim' : ''
  const res = await fetch(`/api/passports/${passportId}/print-pdf${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // show_stamps drives whether stop stamp images render in the boxes.
    // Every stop is still always included; no copy multiplication, no
    // journal toggle.
    body: JSON.stringify({ show_stamps: showStamps }),
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
  const label = format === 'trim' ? 'Print-Ready' : 'Print Passport'
  a.download = `${passportTitle} — ${label} — ${today}.pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return { ok: true }
}
