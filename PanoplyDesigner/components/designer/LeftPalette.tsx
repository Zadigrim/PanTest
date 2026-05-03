'use client'

import { usePassportStore } from '@/lib/stores/passport-store'
import { Button } from '@/components/ui/button'

export function LeftPalette() {
  const passport = usePassportStore((s) => s.passport)

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-panoply-gray-2 bg-white">
      {/* Passport meta */}
      <div className="border-b border-panoply-gray-2 px-4 py-3">
        <p className="truncate text-xs font-semibold text-panoply-navy">
          {passport?.title ?? 'Loading…'}
        </p>
        <p className="mt-0.5 text-xs text-panoply-gray-3 capitalize">
          {passport?.status ?? 'draft'}
        </p>
      </div>

      {/* Element palette — Phase 2 will populate this */}
      <div className="flex-1 overflow-y-auto p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-panoply-gray-3">
          Elements
        </p>

        <div className="space-y-1">
          {PALETTE_ITEMS.map((item) => (
            <button
              key={item.label}
              disabled
              className="flex w-full items-center gap-2.5 rounded-card px-3 py-2 text-left text-sm text-panoply-gray-3 opacity-50 cursor-not-allowed"
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        <p className="mt-4 mb-2 text-xs font-medium uppercase tracking-wider text-panoply-gray-3">
          Stamps
        </p>
        <div className="rounded-card border border-dashed border-panoply-gray-2 py-6 text-center">
          <p className="text-xs text-panoply-gray-3">
            Select a page to add stops
          </p>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="border-t border-panoply-gray-2 p-3">
        <Button variant="secondary" size="sm" className="w-full" disabled>
          + Add page
        </Button>
      </div>
    </aside>
  )
}

const PALETTE_ITEMS = [
  { icon: '📍', label: 'Location stop' },
  { icon: '🎯', label: 'Experience stop' },
  { icon: '📝', label: 'Text block' },
  { icon: '🖼', label: 'Image' },
  { icon: '🔲', label: 'Shape' },
]
