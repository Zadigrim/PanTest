'use client'

import type { ComposerElement } from '@/lib/design/stamp-composer/types'

/**
 * Left-rail element list — z-order with reorder / duplicate /
 * delete actions per row, plus selection. Mirrors the cover-
 * editor element-list vocabulary so the composer feels like a
 * mode of the same tool.
 */
export function ComposerElementList({
  elements,
  selectedId,
  onSelect,
  onReorder,
  onDuplicate,
  onDelete,
}: {
  elements: ComposerElement[]
  selectedId: string | null
  onSelect: (id: string) => void
  onReorder: (id: string, direction: 'up' | 'down') => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex h-full flex-col">
      <p className="border-b border-surface-faintdiv px-3 py-2.5 text-[10px] font-bold uppercase tracking-[2px] text-muted">
        Elements ({elements.length})
      </p>
      {elements.length === 0 ? (
        <p className="px-3 py-4 text-[11.5px] text-muted">
          No elements yet. Add one from the toolbar above the canvas.
        </p>
      ) : (
        <ul className="flex-1 space-y-1 overflow-y-auto p-1.5">
          {/* Reverse render so top-of-list = top-of-z-stack —
              the human reading order matches the visual stack. */}
          {[...elements].reverse().map((el) => {
            const isSelected = el.id === selectedId
            return (
              <li
                key={el.id}
                className={`rounded-[7px] border transition-colors ${
                  isSelected
                    ? 'border-accent bg-accent/10'
                    : 'border-transparent hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-1 py-[7px] pl-[9px] pr-[7px]">
                  <button
                    type="button"
                    onClick={() => onSelect(el.id)}
                    className={`flex-1 truncate text-left text-[12.5px] ${
                      isSelected ? 'font-semibold text-ink' : 'text-muted hover:text-ink'
                    }`}
                  >
                    <span className="mr-1.5 text-[9.5px] uppercase tracking-[1px] text-muted">
                      {el.type === 'polyshape' ? el.shape : el.type}
                    </span>
                    {el.name ?? ''}
                  </button>
                  <RowButton title="Move up"      onClick={() => onReorder(el.id, 'up')}>▲</RowButton>
                  <RowButton title="Move down"    onClick={() => onReorder(el.id, 'down')}>▼</RowButton>
                  <RowButton title="Duplicate"    onClick={() => onDuplicate(el.id)}>⎘</RowButton>
                  <RowButton title="Delete" danger onClick={() => onDelete(el.id)}>✕</RowButton>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function RowButton({
  children,
  onClick,
  title,
  danger = false,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`h-6 w-6 shrink-0 rounded text-[10px] transition-colors ${
        danger
          ? 'text-muted hover:bg-red/10 hover:text-red'
          : 'text-muted hover:bg-surface-faintdiv hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
