'use client'

import { useEffect, useState } from 'react'

interface Props {
  children: React.ReactNode
}

/**
 * Blocks access to the designer on screens narrower than 1024px.
 * Renders a full-screen overlay instructing the user to use a desktop browser.
 */
export function DesktopGate({ children }: Props) {
  const [isTooNarrow, setIsTooNarrow] = useState(false)

  useEffect(() => {
    const check = () => setIsTooNarrow(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (isTooNarrow) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-navy px-8 text-center">
        <span className="mb-6 text-5xl" aria-hidden="true">
          🖥️
        </span>
        <h1 className="text-xl font-semibold text-[#F5F2EC]">
          OkujiDesigner requires a desktop browser.
        </h1>
        <p className="mt-3 max-w-sm text-sm text-[#F5F2EC]/70">
          Please open this page on a larger screen (at least 1024 px wide) to use the
          passport designer.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
