'use client'

import { usePersistentBool } from './usePersistent'
import { useMediaQuery } from '@/lib/use-media-query'

interface Props {
  children: React.ReactNode
}

/**
 * The OkujiDesigner canvas is a desktop, drag-and-drop surface. Rather than
 * hard-blocking narrow or touch clients (the old behavior), we let the designer
 * render and surface a DISMISSIBLE notice when the viewport is under ~1100px or
 * the primary pointer is coarse (touch). The notice is fixed to the top so it
 * doesn't reflow the canvas, and dismissal persists (localStorage) so it
 * doesn't nag on every visit.
 *
 * Both the media-query hook and usePersistentBool start `false`/default on the
 * server + first client render, so there's no hydration mismatch and no banner
 * flash on desktop — the notice only appears after mount if the client is
 * actually narrow/touch and hasn't been dismissed before.
 */
export function DesktopGate({ children }: Props) {
  const narrow = useMediaQuery('(max-width: 1099px)')
  const coarse = useMediaQuery('(pointer: coarse)')
  const [dismissed, setDismissed] = usePersistentBool(
    'okuji.designer-touch-notice-dismissed',
    false,
  )

  const showNotice = (narrow || coarse) && !dismissed

  return (
    <>
      {showNotice && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999] flex justify-center px-4 pt-3">
          <div className="pointer-events-auto flex max-w-lg items-start gap-3 rounded-panel border-[1.5px] border-accent bg-accent/10 px-3 py-2 shadow-md backdrop-blur">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-white"
            >
              <svg
                width={11}
                height={11}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-ink">
                okuji Designer works best on a desktop browser
              </p>
              <p className="mt-0.5 text-[11.5px] text-ink">
                The passport designer relies on drag-and-drop, which may not work on a
                touch screen or a narrow window. For the full experience, open it on a
                desktop with a mouse or trackpad.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss notice"
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-[6px] border border-hairline bg-white px-3 text-[11px] text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
            >
              Got it
            </button>
          </div>
        </div>
      )}
      {children}
    </>
  )
}
