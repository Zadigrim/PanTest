'use client'

import { usePassportStore } from '@/lib/design/passport-store'
import { Button } from './ui/Button'
import { getSideData } from './CoverCanvas'
import type { CoverFace } from './CoverCanvas'
import type { DesignerPageElement, PageElementType } from '@/lib/design/types'

interface Props {
  face: CoverFace
}

export function CoverPalette({ face }: Props) {
  const passport           = usePassportStore((s) => s.passport)
  const updatePassport     = usePassportStore((s) => s.updatePassport)
  const setSelectedElement = usePassportStore((s) => s.setSelectedElement)

  const sideKey = face === 'outside' ? 'cover_outside_data' : 'cover_inside_data'

  const handleAddElement = (type: PageElementType) => {
    if (!passport) return
    const id =
      typeof window !== 'undefined' && window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : Math.random().toString(36).slice(2)

    const defaults: DesignerPageElement =
      type === 'text'
        ? {
            id,
            type,
            x: 40,
            y: 140,
            width: 200,
            height: 28,
            content: 'Cover Text',
            fontSize: 16,
            fontWeight: 'bold',
            color: 'FFFFFF',
            align: 'center',
          }
        : type === 'hline'
        ? { id, type, x: 40, y: 200, width: 200, height: 8, thickness: 2, lineColor: 'FFFFFF' }
        : { id, type, x: 140, y: 40, width: 8, height: 300, thickness: 2, lineColor: 'FFFFFF' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (passport as any)[sideKey]
    const side = getSideData(raw)
    const next = { ...side, elements: [...(side.elements ?? []), defaults] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatePassport({ [sideKey]: next } as any)
    setSelectedElement(id)

    const { createClient } = require('@/lib/supabase/client')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any
    void db.from('passports').update({ [sideKey]: next }).eq('id', passport.id)
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-hairline bg-white">
      <div className="border-b border-hairline px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          Cover — {face}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">
          Cover elements
        </p>
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs gap-2"
            onClick={() => handleAddElement('text')}
            disabled={!passport}
          >
            <span className="font-bold">T</span> Add text block
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs gap-2"
            onClick={() => handleAddElement('hline')}
            disabled={!passport}
          >
            <span>—</span> Add H-line
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs gap-2"
            onClick={() => handleAddElement('vline')}
            disabled={!passport}
          >
            <span>|</span> Add V-line
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted leading-relaxed">
          Click any element on the canvas to select and edit it.
          Text blocks are draggable and resizable.
        </p>
      </div>
    </aside>
  )
}
