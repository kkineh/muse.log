'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-email'
import { MuseLogo } from '@/components/neural/MuseLogo'

const fieldClass =
  'peer w-full h-12 rounded-xl border border-white/10 bg-white/[0.03] pl-11 pr-4 text-[15px] text-[var(--neural-text-primary)] ' +
  'placeholder:text-white/25 outline-none transition-[border-color,background-color,box-shadow] duration-200 ' +
  'hover:border-white/20 focus:border-[var(--neural-accent)] focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgb(56_189_248/0.12)] ' +
  'disabled:opacity-50'

const iconClass =
  'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30 transition-colors peer-focus:text-[var(--neural-accent)]'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // 이미 로그인된 경우 /admin으로 리디렉션
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/admin')
      }
    }
    checkSession()
  }, [router, supabase.auth])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      // 관리자 이메일 확인
      if (!isAdminEmail(data.user?.email)) {
        await supabase.auth.signOut()
        setError('Unauthorized. Admin access only.')
        setLoading(false)
        return
      }

      // 성공 - /admin으로 리디렉션
      router.push('/admin')
    } catch (_err) {
      console.error('Login error:', _err);
      setError('An unexpected error occurred.')
      setLoading(false)
    }
  }

  return (
    <main
      className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12"
      style={{ background: 'var(--neural-bg)', fontFamily: 'var(--font-inter), sans-serif' }}
    >
      {/* 배경: 점 격자 + 두 색 빛 번짐 */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.35] [background-image:radial-gradient(rgb(255_255_255/0.12)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -z-10 h-[520px] w-[520px] -translate-x-[70%] -translate-y-[60%] rounded-full bg-[rgb(56_189_248/0.16)] blur-[110px] motion-safe:animate-[login-drift_14s_ease-in-out_infinite]"
      />
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -z-10 h-[440px] w-[440px] -translate-x-[20%] -translate-y-[25%] rounded-full bg-[rgb(139_92_246/0.14)] blur-[110px] motion-safe:animate-[login-drift_18s_ease-in-out_infinite_reverse]"
      />

      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <MuseLogo className="text-[34px] leading-none" />
          <span
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[var(--neural-text-muted)]"
            style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
          >
            Admin console
          </span>
        </div>

        {/* 카드: 위쪽 가장자리에만 빛나는 선 */}
        <div className="relative rounded-2xl border border-white/10 bg-[rgb(10_14_22/0.7)] p-6 shadow-[0_24px_80px_-24px_rgb(0_0_0/0.8)] backdrop-blur-xl sm:p-8">
          <div
            aria-hidden
            className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-[var(--neural-accent)] to-transparent opacity-70"
          />

          <h1 className="text-lg! font-semibold text-[var(--neural-text-primary)]">Sign in</h1>
          <p className="mt-1 text-sm text-[var(--neural-text-muted)]">사유, 기록, 연결을 관리합니다.</p>

          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-400/25 bg-red-400/[0.08] px-3.5 py-3 text-sm text-red-300"
            >
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-white/50">
                Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className={fieldClass}
                  placeholder="admin@example.com"
                />
                <Mail size={17} className={iconClass} />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-white/50">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className={`${fieldClass} pr-12`}
                  placeholder="••••••••"
                />
                <Lock size={17} className={iconClass} />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/70"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative mt-2 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] text-[15px] font-semibold text-white shadow-[0_8px_30px_-8px_rgb(56_189_248/0.6)] transition-[transform,box-shadow,filter] duration-200 hover:brightness-110 hover:shadow-[0_10px_40px_-8px_rgb(139_92_246/0.7)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
            >
              {loading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 flex items-center justify-between px-1 text-xs text-[var(--neural-text-muted)]">
          <Link href="/" className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--neural-text-primary)]">
            <ArrowLeft size={13} />
            블로그로 돌아가기
          </Link>
          <span>Admin access only</span>
        </div>
      </div>
    </main>
  )
}
