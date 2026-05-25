'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  assetType: 'background' | 'stamp' | 'cover'
}

export function UploadAssetButton({ assetType }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, startUpload] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleClick() {
    setError(null)
    inputRef.current?.click()
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    startUpload(async () => {
      const form = new FormData()
      form.append('file', file)
      form.append('asset_type', assetType)
      form.append('name', file.name.replace(/\.[^.]+$/, ''))

      try {
        const res = await fetch('/api/assets/upload', {
          method: 'POST',
          body: form,
        })

        if (!res.ok) {
          const json = (await res.json()) as { error?: string }
          throw new Error(json.error ?? `Upload failed (${res.status})`)
        }

        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        // Reset input so the same file can be selected again if needed
        if (inputRef.current) inputRef.current.value = ''
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        className="sr-only"
        onChange={handleChange}
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={uploading}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-panel text-sm font-medium bg-green text-white hover:bg-green disabled:opacity-60 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
      >
        {uploading ? 'Uploading…' : 'Upload asset'}
      </button>
      {error && (
        <p role="alert" className="text-xs text-accent max-w-[200px] text-right">
          {error}
        </p>
      )}
    </div>
  )
}
