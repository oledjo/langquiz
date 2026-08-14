import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { RepzyLogo } from './RepzyLogo'

const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'

const TAB_LABELS: Record<string, string> = {
  home: 'Home',
  progress: 'Progress',
  admin: 'Admin',
}

export function Header() {
  const { user, logout, isGuest } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const tabs = isGuest
    ? (['home'] as const)
    : user?.role === 'admin'
      ? (['home', 'progress', 'admin'] as const)
      : (['home', 'progress'] as const)

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur shadow-sm">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <RepzyLogo />
          <h1 className="text-xl font-bold text-blue-700">Repzy</h1>
        </div>

        <nav
          className={[
            'grid w-full gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto',
            isGuest ? 'grid-cols-1 sm:min-w-[120px]' : tabs.length === 3 ? 'grid-cols-3 sm:min-w-[320px]' : 'grid-cols-2 sm:min-w-[220px]',
          ].join(' ')}
        >
          {tabs.map((tab) => {
            const tabPath = tab === 'home' ? '/' : `/${tab}`
            const isActive = location.pathname === tabPath
            return (
              <button
                key={tab}
                onClick={() => navigate(tabPath)}
                className={[
                  'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                  focusRingClass,
                  isActive
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-200 hover:text-slate-700',
                ].join(' ')}
              >
                {TAB_LABELS[tab]}
              </button>
            )
          })}
        </nav>

        <div className="flex items-center gap-2 sm:ml-2">
          <span className="hidden text-xs text-slate-500 sm:block">{isGuest ? 'Guest trial' : user?.email}</span>
          <button
            onClick={logout}
            className={[
              'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50',
              focusRingClass,
            ].join(' ')}
          >
            {isGuest ? 'Exit guest mode' : 'Sign out'}
          </button>
        </div>
      </div>
    </header>
  )
}
