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
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setServerError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword(data)
    if (error) { setServerError(error.message); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-panoply-navy">
      <div className="w-full max-w-sm space-y-8 px-4">
        {/* Wordmark */}
        <div className="text-center">
          <span className="text-4xl">🧭</span>
          <h1 className="mt-3 font-serif text-3xl font-bold text-white tracking-wide">
            PanoplyDesigner
          </h1>
          <p className="mt-1 text-sm text-panoply-gray-3 italic">
            Build passports. Craft experiences.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              autoComplete="current-password"
              placeholder="••••••••"
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

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-center text-sm text-panoply-gray-3">
          New to PanoplyDesigner?{' '}
          <Link href="/signup" className="text-panoply-teal hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
