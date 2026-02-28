import { useState } from 'react'
import { useAuth } from './AuthContext'
import { LangQuizLogo } from '../components/LangQuizLogo'
import { launchLanguages } from '../content/launchLanguages'

const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'

export function AuthPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email.trim(), password)
      } else {
        await register(email.trim(), password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'))
    setError('')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-5xl grid gap-4 lg:grid-cols-[1.2fr_0.8fr] items-start">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="max-w-2xl space-y-4">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Learn languages faster with focused practice
            </h2>
            <p className="text-sm leading-6 text-slate-600 sm:text-base">
              LangQuiz gives you short sessions by topic and level across languages, tracks mistakes, and
              prioritizes weak areas so you improve faster with less random repetition.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">Targeted sessions</p>
              <p className="mt-1 text-xs text-slate-600">
                Choose language, group, level and topic to train exactly what you need.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">Mistake-driven learning</p>
              <p className="mt-1 text-xs text-slate-600">
                Missed questions are weighted higher in upcoming sessions.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">GPT-powered custom content</p>
              <p className="mt-1 text-xs text-slate-600">
                Generate your own questions with GPT and import them into your personal practice set.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">Clear progress</p>
              <p className="mt-1 text-xs text-slate-600">
                Track accuracy by day, week, month and by exercise.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Go-Live Language Support</p>
                <h3 className="text-base font-semibold text-slate-900">Languages available at launch</h3>
              </div>
              <p className="text-xs text-slate-500">This list shows the languages included in the public launch scope.</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {launchLanguages.map((language) => (
                <div key={language.code} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">
                      {language.name} <span className="text-slate-400">({language.code})</span>
                    </p>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      {language.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{language.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full max-w-sm lg:max-w-none mx-auto">
        <div className="mb-8 flex flex-col items-center gap-3">
          <LangQuizLogo />
          <h1 className="text-2xl font-bold text-blue-700">LangQuiz</h1>
          <p className="text-sm text-slate-500">Practice languages, track your progress.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {(['login', 'register'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setMode(tab); setError('') }}
                className={[
                  'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                  focusRingClass,
                  mode === tab
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-200 hover:text-slate-700',
                ].join(' ')}
              >
                {tab === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={[
                  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800',
                  'focus:border-blue-400 focus:outline-none',
                  focusRingClass,
                ].join(' ')}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
                className={[
                  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800',
                  'focus:border-blue-400 focus:outline-none',
                  focusRingClass,
                ].join(' ')}
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={[
                'w-full rounded-xl py-2.5 text-sm font-semibold transition-colors',
                focusRingClass,
                isSubmitting
                  ? 'cursor-not-allowed bg-slate-300 text-slate-600'
                  : 'bg-blue-600 text-white hover:bg-blue-700',
              ].join(' ')}
            >
              {isSubmitting
                ? mode === 'login' ? 'Signing in…' : 'Creating account…'
                : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={switchMode}
              className={['font-semibold text-blue-600 hover:underline', focusRingClass].join(' ')}
            >
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
        </div>
      </div>
    </div>
  )
}
