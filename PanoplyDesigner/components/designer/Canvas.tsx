'use client'

import { usePassportStore, selectActivePage, selectActivePageStops } from '@/lib/stores/passport-store'

export function Canvas() {
  const activePage = usePassportStore(selectActivePage)
  const stops = usePassportStore(selectActivePageStops)

  if (!activePage) {
    return (
      <div className="flex flex-1 items-center justify-center bg-panoply-gray-1">
        <p className="text-sm text-panoply-gray-3">No page selected</p>
      </div>
    )
  }

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-panoply-gray-1">
      {/* Canvas scroll area */}
      <div className="flex flex-1 items-center justify-center overflow-auto p-8">
        {/* Passport page artboard — 612×792pt (US Letter) */}
        <div
          className="relative shrink-0 rounded-sm shadow-xl"
          style={{
            width: 612,
            height: 792,
            backgroundColor: `#${activePage.paper_color ?? 'F5F2EC'}`,
          }}
        >
          {/* Background layer — Phase 2 will render GuillochePattern here */}

          {/* Stops — Phase 2 will render LocationBox + StampArtwork */}
          {stops.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-panoply-gray-3/60">
                No stops on this page
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Zoom / view controls — Phase 2 */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-card border border-panoply-gray-2 bg-white px-2 py-1 shadow-sm">
        <button className="px-2 py-0.5 text-sm text-panoply-gray-3 hover:text-panoply-navy" disabled>
          −
        </button>
        <span className="min-w-[3rem] text-center text-xs text-panoply-gray-3">100%</span>
        <button className="px-2 py-0.5 text-sm text-panoply-gray-3 hover:text-panoply-navy" disabled>
          +
        </button>
      </div>
    </main>
  )
}
