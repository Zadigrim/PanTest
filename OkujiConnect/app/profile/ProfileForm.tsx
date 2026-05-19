'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userId: string
  email: string
  initialDisplayName: string
  initialBio: string
  initialWebsiteUrl: string
  initialAvatarUrl: string | null
}

export function ProfileForm({
  userId,
  email,
  initialDisplayName,
  initialBio,
  initialWebsiteUrl,
  initialAvatarUrl,
}: Props) {
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [bio, setBio] = useState(initialBio)
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [saving, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const initials = (displayName || email || '?')[0].toUpperCase()
  const displaySrc = avatarPreview ?? avatarUrl

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const url = URL.createObjectURL(file)
    setAvatarPreview(url)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!displayName.trim()) {
      setError('Display name is required.')
      return
    }

    startSave(async () => {
      try {
        const supabase = createClient()
        let finalAvatarUrl = avatarUrl

        // Upload avatar if changed
        if (avatarFile) {
          const ext = avatarFile.name.split('.').pop() ?? 'jpg'
          const path = `avatars/${userId}.${ext}`
          const bytes = await avatarFile.arrayBuffer()
          const { error: upErr } = await supabase.storage
            .from('avatars')
            .upload(path, Buffer.from(bytes), {
              contentType: avatarFile.type,
              upsert: true,
            })
          if (upErr) throw new Error(upErr.message)
          const { data } = supabase.storage.from('avatars').getPublicUrl(path)
          finalAvatarUrl = `${data.publicUrl}?t=${Date.now()}`
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateErr } = await (supabase as any)
          .from('profiles')
          .update({
            display_name: displayName.trim(),
            bio: bio.trim() || null,
            website_url: websiteUrl.trim() || null,
            avatar_url: finalAvatarUrl,
          })
          .eq('id', userId)

        if (updateErr) throw new Error(updateErr.message)

        setAvatarUrl(finalAvatarUrl)
        setAvatarFile(null)
        if (avatarPreview) {
          URL.revokeObjectURL(avatarPreview)
          setAvatarPreview(null)
        }
        setSuccess(true)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  return (
    <section className="rounded-panel border border-okuji-gray-2 bg-white p-6">
      <h2 className="mb-6 text-base font-semibold text-okuji-navy">Profile</h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-okuji-gray-2 bg-okuji-teal hover:border-okuji-teal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-okuji-teal"
            aria-label="Change avatar"
          >
            {displaySrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displaySrc} alt="Your avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-semibold text-white select-none">{initials}</span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium">
              Change
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleAvatarChange}
            tabIndex={-1}
            aria-hidden="true"
          />
          <div className="text-sm text-okuji-gray-3">
            <p>Click avatar to upload a new photo.</p>
            <p className="text-xs mt-0.5">JPEG, PNG, or WebP · max 5 MB</p>
          </div>
        </div>

        {/* Display name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-okuji-navy" htmlFor="display-name">
            Display name <span className="text-okuji-coral">*</span>
          </label>
          <input
            id="display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={64}
            required
            className="h-9 rounded-panel border border-okuji-gray-2 px-3 text-sm text-okuji-navy focus:outline-none focus:ring-2 focus:ring-okuji-teal focus:border-okuji-teal transition-colors"
          />
        </div>

        {/* Email (read-only) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-okuji-navy" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            readOnly
            className="h-9 rounded-panel border border-okuji-gray-2 px-3 text-sm text-okuji-gray-3 bg-okuji-gray-1 cursor-not-allowed"
          />
        </div>

        {/* Bio */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-okuji-navy" htmlFor="bio">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Tell others a little about yourself…"
            className="rounded-panel border border-okuji-gray-2 px-3 py-2 text-sm text-okuji-navy resize-none focus:outline-none focus:ring-2 focus:ring-okuji-teal focus:border-okuji-teal transition-colors"
          />
          <p className="text-xs text-okuji-gray-3 text-right">{bio.length}/500</p>
        </div>

        {/* Website */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-okuji-navy" htmlFor="website">
            Website
          </label>
          <input
            id="website"
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://example.com"
            className="h-9 rounded-panel border border-okuji-gray-2 px-3 text-sm text-okuji-navy focus:outline-none focus:ring-2 focus:ring-okuji-teal focus:border-okuji-teal transition-colors"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-okuji-coral">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-okuji-teal-dk font-medium">
            Profile saved.
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="h-9 px-5 rounded-panel bg-okuji-teal text-white text-sm font-medium hover:bg-okuji-teal-dk disabled:opacity-60 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-okuji-teal"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>
    </section>
  )
}
