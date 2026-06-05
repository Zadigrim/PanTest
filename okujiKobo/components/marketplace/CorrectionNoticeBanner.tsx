'use client'

import { useState } from 'react'

/**
 * Holder-facing correction notice — surfaces after a creator
 * republishes a passport this user has acquired. Built per
 * Nathan's call: appears on both the mobile passport detail
 * AND on the web /library row (same database fields drive it).
 *
 * Dismissal hits POST /api/passports/:id/dismiss-correction-notice
 * which writes `last_correction_dismissed_at = now()` to BOTH
 * acquisitions + collector_passports — one dismiss clears both
 * surfaces. The banner removes itself optimistically; a write
 * failure logs to console but doesn't restore the banner
 * (worst case it shows again next page load, fine).
 *
 * Component renders nothing if `whatChanged` is null — server
 * makes the visibility decision (latest republish_log >
 * last_correction_dismissed_at). Keeps the client surface dumb.
 */
export function CorrectionNoticeBanner({
  passportId,
  whatChanged,
  republishedAt,
}: {
  passportId: string
  /** The holder-facing line from passport_republish_log.what_changed.
   *  null = no pending notice; component renders nothing. */
  whatChanged: string | null
  /** ISO timestamp of the republish event — drives the
   *  "Updated {date}" label. */
  republishedAt: string | null
}) {
  const [dismissed, setDismissed] = useState(false)
  if (!whatChanged || dismissed) return null

  function handleDismiss() {
    setDismissed(true)
    void fetch(`/api/passports/${passportId}/dismiss-correction-notice`, {
      method: 'POST',
    }).catch((e) => {
      // eslint-disable-next-line no-console
      console.warn('[correction-notice] dismiss failed:', e)
    })
  }

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-panel border-[1.5px] border-accent bg-accent/10 px-3 py-2"
    >
      <span aria-hidden="true" className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-white">
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4" /><path d="M12 17h.01" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-ink">
          This passport was corrected
          {republishedAt && (
            <span className="ml-1 font-normal text-muted">
              · {new Date(republishedAt).toLocaleDateString()}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[11.5px] text-ink">{whatChanged}</p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss notice"
        className="shrink-0 rounded-[6px] border border-hairline bg-white px-1.5 py-0.5 text-[11px] text-muted hover:text-ink"
      >
        Got it
      </button>
    </div>
  )
}
