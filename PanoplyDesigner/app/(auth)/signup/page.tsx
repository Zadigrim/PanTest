'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  displayName:     z.string().min(2, 'Name must be at least 2 characters'),
  email:           z.string().email('Enter a valid email'),
  password:        z.string().min(8, 'Password must be at least 8 characters'),
  accountType:     z.enum(['individual', 'institution']),
  institutionName: z.string().optional(),
  institutionType: z.enum(['school', 'library', 'tourism_board', 'proprietor', 'other']).optional(),
}).superRefine((data, ctx) => {
  if (data.accountType === 'institution' && !data.institutionName?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['institutionName'], message: 'Institution name is required' })
  }
})
type FormData = z.infer<typeof schema>

const INSTITUTION_TYPES = [
  { value: 'school',        label: 'School / District' },
  { value: 'library',       label: 'Library' },
  { value: 'tourism_board', label: 'Tourism Board' },
  { value: 'proprietor',    label: 'Business / Proprietor' },
  { value: 'other',         label: 'Other' },
] as const

export default function SignupPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { accountType: 'individual' },
  })
  const accountType = watch('accountType')

  const onSubmit = async (data: FormData) => {
    setServerError(null)
    const supabase = createClient()

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    })
    if (signUpError || !authData.user) {
      setServerError(signUpError?.message ?? 'Sign up failed')
      return
    }

    // Create profile
    await supabase.from('profiles').insert({
      id: authData.user.id,
      display_name: data.displayName,
      role: data.accountType === 'institution' ? 'creator' : 'collector',
    })

    // Create institution if applicable
    if (data.accountType === 'institution' && data.institutionName) {
      const slug = data.institutionName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      await supabase.from('institutions').insert({
        name: data.institutionName,
        slug: `${slug}-${authData.user.id.slice(0, 6)}`,
        type: data.institutionType ?? 'other',
        admin_user_id: authData.user.id,
      })
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-panoply-navy py-12">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <span className="text-4xl">🧭</span>
          <h1 className="mt-3 font-serif text-3xl font-bold text-white tracking-wide">
            Create account
          </h1>
          <p className="mt-1 text-sm text-panoply-gray-3 italic">
            Start building Panoply passports
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Account type toggle */}
          <div>
            <Label className="mb-2 block text-panoply-gray-2">I am creating as</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['individual', 'institution'] as const).map((type) => (
                <label
                  key={type}
                  className={`flex cursor-pointer items-center justify-center rounded-panel border py-2.5 text-sm font-medium transition-colors ${
                    accountType === type
                      ? 'border-panoply-teal bg-panoply-teal/20 text-panoply-teal'
                      : 'border-white/10 text-panoply-gray-3 hover:border-white/20'
                  }`}
                >
                  <input type="radio" value={type} className="sr-only" {...register('accountType')} />
                  {type === 'individual' ? '👤 Individual' : '🏛 Institution'}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="displayName" className="text-panoply-gray-2">Your name</Label>
            <Input
              id="displayName"
              placeholder="Jamie Rivera"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-panoply-teal"
              {...register('displayName')}
            />
            {errors.displayName && (
              <p className="text-xs text-panoply-coral">{errors.displayName.message}</p>
            )}
          </div>

          {accountType === 'institution' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="institutionName" className="text-panoply-gray-2">Institution name</Label>
                <Input
                  id="institutionName"
                  placeholder="McMenamins, Portland Public Schools, etc."
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-panoply-teal"
                  {...register('institutionName')}
                />
                {errors.institutionName && (
                  <p className="text-xs text-panoply-coral">{errors.institutionName.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="institutionType" className="text-panoply-gray-2">Institution type</Label>
                <select
                  id="institutionType"
                  className="flex h-9 w-full rounded-panel border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-panoply-teal"
                  {...register('institutionType')}
                >
                  {INSTITUTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value} className="bg-panoply-navy">
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-panoply-gray-2">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-panoply-teal"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-panoply-coral">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-panoply-gray-2">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-panoply-teal"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-panoply-coral">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <p className="rounded-panel bg-panoply-coral/20 px-3 py-2 text-sm text-panoply-coral">
              {serverError}
            </p>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="text-center text-sm text-panoply-gray-3">
          Already have an account?{' '}
          <Link href="/login" className="text-panoply-teal hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
