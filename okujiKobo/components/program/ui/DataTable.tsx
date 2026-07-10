/**
 * Shared table for the Program hub. Field-token header row (mono
 * uppercase, right-aligned numerics, left-aligned first column),
 * hairline row dividers, hover tint, first column weight 600.
 *
 * Generic over the row type — callers pass `columns` that name a
 * key + render function. Numeric columns auto-align right; the
 * first column always reads as the "name" anchor.
 *
 * The optional `rowHref` makes the first cell a real <Link> with a
 * stretched-link CSS pattern: an invisible ::before pseudo-element
 * grows to fill the row, so clicks anywhere on the row navigate.
 * Keyboard / a11y stays on the actual Link element.
 *
 * Server-component-friendly: NO event handlers, NO hooks. Pure
 * rendering + <Link>. Callers from server components can pass
 * `render` / `rowHref` / `rowKey` functions because DataTable
 * stays server-side — function props only need to be serializable
 * when they cross the server→client boundary, which doesn't
 * happen here.
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
    <div className="overflow-x-auto rounded-program-card border-[1.5px] border-hairline bg-cream">
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
              const href = rowHref?.(row)
              return (
                <tr
                  key={rowKey(row)}
                  // `relative` anchors the stretched-link ::before
                  // pseudo so clicks anywhere on the row reach the
                  // <Link>. Modern browsers handle position:relative
                  // on <tr> consistently.
                  className={cn(
                    'border-t border-hairline/60',
                    i === 0 && 'border-t-[1.5px] border-t-hairline',
                    href && 'relative hover:bg-field/60',
                  )}
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
                      {j === 0 && href ? (
                        // Stretched-link pattern: the ::before
                        // pseudo expands to cover the parent <tr>,
                        // so the whole row is a hit target. Other
                        // cells' content sits visually above the
                        // pseudo but doesn't intercept the click
                        // because pseudo elements have z-index 0
                        // and the cells don't bump their stacking
                        // context. Visible text in this cell is
                        // the underline-on-hover anchor.
                        <Link
                          href={href}
                          className="hover:underline underline-offset-2 before:absolute before:inset-0 before:content-['']"
                        >
                          {c.render(row)}
                        </Link>
                      ) : (
                        c.render(row)
                      )}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
