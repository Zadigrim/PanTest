/**
 * Shared table for the Program hub. Field-token header row (mono
 * uppercase, right-aligned numerics, left-aligned first column),
 * hairline row dividers, hover tint, first column weight 600.
 *
 * Generic over the row type — callers pass `columns` that name a
 * key + render function. Numeric columns auto-align right; the
 * first column always reads as the "name" anchor.
 *
 * The optional `rowHref` makes each row a Link (used by Overview's
 * + Analytics's per-passport tables that drill into a passport).
 * When omitted, rows are non-interactive.
 */

import Link from 'next/link'
import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  label: string
  align?: 'left' | 'right'
  render: (row: T) => ReactNode
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  rowHref?: (row: T) => string
  empty?: ReactNode
}

export function DataTable<T>({ columns, rows, rowKey, rowHref, empty }: Props<T>) {
  return (
    <div className="overflow-hidden rounded-program-card border-[1.5px] border-hairline bg-cream">
      <table className="w-full text-[12.5px]">
        <thead className="bg-field">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  'px-4 py-2 font-mono text-[10.5px] uppercase text-muted',
                  c.align === 'right' ? 'text-right' : 'text-left',
                )}
                style={{ letterSpacing: '1.5px' }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-6 text-center text-[12px] text-muted"
              >
                {empty ?? 'No rows.'}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const cells = columns.map((c, j) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-4 py-3',
                    c.align === 'right' ? 'text-right tabular-nums text-ink' : 'text-ink',
                    j === 0 && 'font-semibold',
                  )}
                >
                  {c.render(row)}
                </td>
              ))
              return rowHref ? (
                <tr
                  key={rowKey(row)}
                  className={cn(
                    'border-t border-hairline/60 hover:bg-field/60 cursor-pointer transition-colors',
                    i === 0 && 'border-t-[1.5px] border-t-hairline',
                  )}
                  onClick={(e) => {
                    // Server-rendered: clicking anywhere on the row
                    // navigates. We render an actual Link inside the
                    // first cell for accessibility / keyboard / SEO;
                    // this handler covers mouse clicks elsewhere.
                    const target = e.target as HTMLElement
                    if (target.closest('a, button')) return
                    window.location.href = rowHref(row)
                  }}
                >
                  {columns.map((c, j) => (
                    <td
                      key={c.key}
                      className={cn(
                        'px-4 py-3',
                        c.align === 'right' ? 'text-right tabular-nums text-ink' : 'text-ink',
                        j === 0 && 'font-semibold',
                      )}
                    >
                      {j === 0 ? (
                        <Link
                          href={rowHref(row)}
                          className="hover:underline underline-offset-2"
                        >
                          {c.render(row)}
                        </Link>
                      ) : (
                        c.render(row)
                      )}
                    </td>
                  ))}
                </tr>
              ) : (
                <tr
                  key={rowKey(row)}
                  className={cn(
                    'border-t border-hairline/60',
                    i === 0 && 'border-t-[1.5px] border-t-hairline',
                  )}
                >
                  {cells}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
