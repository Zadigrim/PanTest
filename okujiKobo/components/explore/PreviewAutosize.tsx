'use client'

import { useEffect, useRef } from 'react'

// Reports its rendered height to the parent frame so the embedding okuji.app
// iframe can auto-size to the flipper — no inner scrollbar, no guessed fixed
// height that leaves whitespace on desktop or clips on mobile. Height is a
// non-sensitive number, so it posts to '*'; the PARENT validates the message
// shape and the frame's origin before applying it. No-op when not framed.
export function PreviewAutosize({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || window.parent === window) return
    const post = () => {
      const height = Math.ceil(el.getBoundingClientRect().height)
      window.parent.postMessage({ type: 'okuji-preview-height', height }, '*')
    }
    post()
    const ro = new ResizeObserver(post)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return <div ref={ref}>{children}</div>
}
