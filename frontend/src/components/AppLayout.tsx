import type { ReactNode } from 'react'
import { Header } from './Header'

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
    </div>
  )
}
