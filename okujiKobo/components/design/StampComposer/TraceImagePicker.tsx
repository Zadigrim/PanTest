'use client'

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadImageFromFile, traceImageData, type TraceResult } from '@/lib/design/stamp-composer/trace'

/**
 * Trace-an-image overlay.
 *
 * Upload → threshold slider → live re-trace preview → "Add to
 * canvas" hands back a TracedElement's worth of vector data
 * (path d + source pixel size) so the caller can place it on
 * the surface as an editable element.
 *
 * Honest expectations (matches the spec brief): works on logos,
 * seals, and high-contrast clip-art on plain backgrounds. Photos
 * with gradients trace into chunky silhouettes — usable as a
 * starting point but not the intended path.
 *
 * The tracer runs synchronously after load on the main thread.
 * The threshold slider re-traces on each value change but
 * debounces so a fast drag doesn't queue dozens of renders.
 */
export function TraceImagePicker({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (result: { d: string; sourceW: number; sourceH: number }) => void
}) {
  const [img,         setImg]         = useState<HTMLImageElement | null>(null)
  const [filename,    setFilename]    = useState<string>('')
  const [threshold,   setThreshold]   = useState(128)
  const [tracing,     setTracing]     = useState(false)
  const [result,      setResult]      = useState<TraceResult | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setImg(null); setResult(null); setFilename(''); setError(null)
      setThreshold(128)
    }
  }, [open])

  const reTrace = useCallback((src: HTMLImageElement, t: number) => {
    setTracing(true)
    setError(null)
    // requestAnimationFrame so the slider value visibly updates
    // before we burn the CPU; cheap UX win vs synchronous block.
    requestAnimationFrame(() => {
      try {
        const out = traceImageData(src, { threshold: t })
        setResult(out)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setTracing(false)
      }
    })
  }, [])

  const onFile = useCallback(async (file: File) => {
    setError(null)
    setFilename(file.name)
    try {
      const loaded = await loadImageFromFile(file)
      setImg(loaded)
      reTrace(loaded, threshold)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [reTrace, threshold])

  // Debounced re-trace on threshold change.
  useEffect(() => {
    if (!img) return
    const t = window.setTimeout(() => reTrace(img, threshold), 100)
    return () => window.clearTimeout(t)
  }, [threshold, img, reTrace])

  const previewSvg = useMemo(() => {
    if (!result) return null
    return (
      <svg
        viewBox={`0 0 ${result.w} ${result.h}`}
        className="h-full w-full"
        style={{ color: '#1f1d1a' }}
      >
        <path d={result.d} fill="currentColor" fillRule="evenodd" />
      </svg>
    )
  }, [result])

  if (!open) return null
  const root = typeof document !== 'undefined' ? document.body : null
  if (!root) return null

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
      <div className="flex h-[min(640px,100%)] w-[min(760px,100%)] flex-col overflow-hidden rounded-[12px] border border-hairline bg-white shadow-2xl">
        <header className="flex items-center gap-3 border-b border-hairline px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[2px] text-muted">Trace an image</p>
          <p className="flex-1 truncate text-[12px] text-muted">{filename || 'No file chosen'}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border-[1.5px] border-hairline bg-white px-3 py-1 text-[12px] font-semibold text-muted hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!result || !!error}
            onClick={() => {
              if (!result) return
              onAdd({ d: result.d, sourceW: result.w, sourceH: result.h })
              onClose()
            }}
            className="rounded-[6px] border-[1.5px] border-ink bg-green px-3 py-1 text-[12px] font-semibold text-white hover:bg-green/90 disabled:opacity-50"
          >
            Add to canvas
          </button>
        </header>

        {error && (
          <p role="alert" className="border-b border-red/30 bg-red/5 px-5 py-2 text-[12px] text-red">
            {error}
          </p>
        )}

        {!img ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
            <p className="text-[13px] text-muted">
              Upload a logo, seal, or high-contrast clip-art.
            </p>
            <p className="text-[10.5px] text-muted">
              Photographs work poorly today — the tracer is built for the
              monochrome stamp use case. (AI photo iconization is on
              the roadmap; not in this push.)
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-9 items-center rounded-[8px] border-[1.5px] border-ink bg-white px-3 text-sm font-semibold text-ink hover:bg-surface-workspace"
            >
              ↑ Choose image
            </button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="grid flex-1 grid-cols-2 gap-3 overflow-hidden p-4">
              <figure className="flex flex-col">
                <figcaption className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[1.5px] text-muted">Source</figcaption>
                <div className="flex flex-1 items-center justify-center overflow-hidden rounded-[6px] border border-surface-faintdiv bg-surface-workspace">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.src}
                    alt={filename}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </figure>
              <figure className="flex flex-col">
                <figcaption className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[1.5px] text-muted">
                  Traced {tracing && <span className="ml-1 text-accent">·tracing</span>}
                </figcaption>
                <div className="flex flex-1 items-center justify-center overflow-hidden rounded-[6px] border border-surface-faintdiv bg-cream">
                  {previewSvg ?? <p className="text-[12px] text-muted">No trace yet.</p>}
                </div>
              </figure>
            </div>

            <div className="border-t border-hairline px-5 py-3">
              <label className="flex items-center gap-3 text-[12px] text-muted">
                <span className="w-[70px]">Threshold</span>
                <input
                  type="range"
                  min={20}
                  max={235}
                  step={1}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="flex-1 accent-green"
                />
                <span className="w-[36px] text-right tabular-nums text-ink">{threshold}</span>
              </label>
              <p className="mt-1.5 text-[10.5px] text-muted">
                Pixels darker than the threshold become ink. Slide left to keep
                only the deepest blacks; slide right to ink more grays.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>,
    root,
  )
}
