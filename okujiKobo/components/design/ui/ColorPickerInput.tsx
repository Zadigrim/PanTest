'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ── Recent colors (session-scoped, stored in module state) ────────────────────

const MAX_RECENT = 8
let recentColors: string[] = []

function pushRecent(hex: string) {
  const normalised = hex.toUpperCase().replace(/^#/, '')
  recentColors = [normalised, ...recentColors.filter((c) => c !== normalised)].slice(0, MAX_RECENT)
}

// ── Colour conversion helpers ─────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, '').padEnd(6, '0')
  const n = parseInt(h.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  return [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break
      case gn: h = ((bn - rn) / d + 2) / 6; break
      case bn: h = ((rn - gn) / d + 4) / 6; break
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = h / 360, sn = s / 100, ln = l / 100
  if (sn === 0) {
    const v = Math.round(ln * 255)
    return [v, v, v]
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn
  const p = 2 * ln - q
  return [
    Math.round(hue2rgb(p, q, hn + 1/3) * 255),
    Math.round(hue2rgb(p, q, hn) * 255),
    Math.round(hue2rgb(p, q, hn - 1/3) * 255),
  ]
}

// ── Gradient canvas picker ────────────────────────────────────────────────────

function GradientCanvas({
  hue,
  saturation,
  lightness,
  onChange,
}: {
  hue: number
  saturation: number
  lightness: number
  onChange: (s: number, l: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragging = useRef(false)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = canvas

    // Hue base
    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`
    ctx.fillRect(0, 0, width, height)

    // White → transparent (left to right)
    const wGrad = ctx.createLinearGradient(0, 0, width, 0)
    wGrad.addColorStop(0, 'rgba(255,255,255,1)')
    wGrad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = wGrad
    ctx.fillRect(0, 0, width, height)

    // Transparent → black (top to bottom)
    const bGrad = ctx.createLinearGradient(0, 0, 0, height)
    bGrad.addColorStop(0, 'rgba(0,0,0,0)')
    bGrad.addColorStop(1, 'rgba(0,0,0,1)')
    ctx.fillStyle = bGrad
    ctx.fillRect(0, 0, width, height)
  }, [hue])

  useEffect(() => { draw() }, [draw])

  // Convert HSL to canvas coordinates
  // s=0,l=100 → top-left; s=100,l=50 → top-right; s=0,l=0 → bottom-left
  const sx = (saturation / 100) * (canvasRef.current?.width ?? 200)
  const sy = (1 - lightness / 100) * (canvasRef.current?.height ?? 150)

  const pick = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    onChange(Math.round(x * 100), Math.round((1 - y) * 100))
  }, [onChange])

  return (
    <div className="relative" style={{ height: 150 }}>
      <canvas
        ref={canvasRef}
        width={248}
        height={150}
        className="w-full cursor-crosshair rounded-t-card"
        onMouseDown={(e) => { dragging.current = true; pick(e) }}
        onMouseMove={(e) => { if (dragging.current) pick(e) }}
        onMouseUp={() => { dragging.current = false }}
        onMouseLeave={() => { dragging.current = false }}
        onTouchStart={(e) => { dragging.current = true; pick(e) }}
        onTouchMove={(e) => { if (dragging.current) pick(e) }}
        onTouchEnd={() => { dragging.current = false }}
      />
      {/* Crosshair indicator */}
      <div
        className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={{ left: sx, top: sy }}
      />
    </div>
  )
}

// ── Main ColorPickerInput ─────────────────────────────────────────────────────

interface Props {
  value: string       // hex without #
  onChange: (hex: string) => void  // fires on every change (live preview)
  onCommit: (hex: string) => void  // fires on close / confirm
}

export function ColorPickerInput({ value, onChange, onCommit }: Props) {
  const [open, setOpen] = useState(false)
  const [hex, setHex] = useState(value.replace(/^#/, '').toUpperCase())
  const [hexField, setHexField] = useState(hex)
  const popoverRef = useRef<HTMLDivElement>(null)
  const committedRef = useRef(false)

  // Sync when value changes from outside
  useEffect(() => {
    const next = value.replace(/^#/, '').toUpperCase()
    if (next !== hex) { setHex(next); setHexField(next) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const [r, g, b] = hexToRgb(hex)
  const [h, s, l] = rgbToHsl(r, g, b)

  const applyHex = useCallback((raw: string) => {
    const cleaned = raw.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
    if (cleaned.length === 6) {
      setHex(cleaned.toUpperCase())
      setHexField(cleaned.toUpperCase())
      onChange(cleaned)
    } else {
      setHexField(raw)
    }
  }, [onChange])

  const applyHsl = useCallback((nh: number, ns: number, nl: number) => {
    const [nr, ng, nb] = hslToRgb(nh, ns, nl)
    const newHex = rgbToHex(nr, ng, nb)
    setHex(newHex)
    setHexField(newHex)
    onChange(newHex)
  }, [onChange])

  const applyRgb = useCallback((nr: number, ng: number, nb: number) => {
    const newHex = rgbToHex(nr, ng, nb)
    setHex(newHex)
    setHexField(newHex)
    onChange(newHex)
  }, [onChange])

  const commit = useCallback(() => {
    if (!committedRef.current) {
      committedRef.current = true
      pushRecent(hex)
      onCommit(hex)
    }
  }, [hex, onCommit])

  const close = useCallback(() => {
    commit()
    setOpen(false)
    committedRef.current = false
  }, [commit])

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, close])

  return (
    <div className="relative">
      {/* Color swatch — click to open */}
      <button
        type="button"
        className="h-8 w-8 shrink-0 rounded-card border border-hairline focus:outline-none focus:ring-2 focus:ring-green"
        style={{ backgroundColor: `#${hex}` }}
        onClick={() => { committedRef.current = false; setOpen((o) => !o) }}
        title={`#${hex} — click to open color picker`}
        aria-label="Open color picker"
      />

      {/* Popover */}
      {open && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-10 z-50 w-64 rounded-panel border border-hairline bg-white shadow-xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Gradient canvas */}
          <GradientCanvas
            hue={h}
            saturation={s}
            lightness={l}
            onChange={(ns, nl) => applyHsl(h, ns, nl)}
          />

          <div className="space-y-2 p-3">
            {/* Hue slider */}
            <div className="flex items-center gap-2">
              <span className="w-3 shrink-0 text-[10px] text-muted">H</span>
              <input
                type="range" min={0} max={360} value={h}
                onChange={(e) => applyHsl(parseInt(e.target.value), s, l)}
                className="h-2 flex-1 cursor-pointer rounded-full"
                style={{
                  background: `linear-gradient(to right,
                    hsl(0,100%,50%),hsl(30,100%,50%),hsl(60,100%,50%),
                    hsl(90,100%,50%),hsl(120,100%,50%),hsl(150,100%,50%),
                    hsl(180,100%,50%),hsl(210,100%,50%),hsl(240,100%,50%),
                    hsl(270,100%,50%),hsl(300,100%,50%),hsl(330,100%,50%),
                    hsl(360,100%,50%))`,
                }}
              />
              <input
                type="number" min={0} max={360} value={h}
                onChange={(e) => applyHsl(parseInt(e.target.value) || 0, s, l)}
                className="h-6 w-12 rounded border border-hairline px-1 text-center font-mono text-[10px]"
              />
            </div>

            {/* RGB inputs */}
            <div className="grid grid-cols-3 gap-1.5">
              {([['R', r, 0], ['G', g, 1], ['B', b, 2]] as [string, number, number][]).map(([lbl, val]) => (
                <div key={lbl} className="space-y-0.5">
                  <label className="block text-center text-[10px] text-muted">{lbl}</label>
                  <input
                    type="number" min={0} max={255} value={val}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(255, parseInt(e.target.value) || 0))
                      const nr = lbl === 'R' ? v : r
                      const ng = lbl === 'G' ? v : g
                      const nb = lbl === 'B' ? v : b
                      applyRgb(nr, ng, nb)
                    }}
                    className="h-6 w-full rounded border border-hairline px-1 text-center font-mono text-[10px]"
                  />
                </div>
              ))}
            </div>

            {/* Hex field */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted">#</span>
              <input
                type="text"
                value={hexField}
                maxLength={6}
                onChange={(e) => applyHex(e.target.value)}
                className="h-7 flex-1 rounded border border-hairline px-2 font-mono text-sm uppercase text-navy focus:border-green focus:outline-none"
                placeholder="0D1B2A"
              />
              <div className="h-7 w-7 shrink-0 rounded border border-hairline" style={{ backgroundColor: `#${hex}` }} />
            </div>

            {/* Recent colors */}
            {recentColors.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] text-muted">Recent colors</p>
                <div className="flex flex-wrap gap-1">
                  {recentColors.map((rc) => (
                    <button
                      key={rc}
                      type="button"
                      className="h-5 w-5 rounded border border-hairline transition-transform hover:scale-110"
                      style={{ backgroundColor: `#${rc}` }}
                      onClick={() => { setHex(rc); setHexField(rc); onChange(rc) }}
                      title={`#${rc}`}
                    />
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={close}
              className="mt-1 h-7 w-full rounded-card bg-green text-xs font-medium text-white hover:bg-green transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
