import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { AuthPage } from './auth/AuthPage'
import { AdminQuestions } from './components/AdminQuestions'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { AppLayout } from './components/AppLayout'
import { HomePage } from './pages/HomePage'
import { DeckDetailPage } from './pages/DeckDetailPage'
import { StudySessionPage } from './pages/StudySessionPage'
import { ExamSessionPage } from './pages/ExamSessionPage'
import { ReviewSessionPage } from './pages/ReviewSessionPage'
import { ProgressPage } from './pages/ProgressPage'
import { MarketingSite } from './marketing/MarketingSite'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-slate-400 text-sm">Loading…</div>
    </div>
  )
}

function RequireSignedIn({ children }: { children: ReactNode }) {
  const { user, isLoading, isGuest } = useAuth()
  // Wait for the initial token check (see AuthGate) before deciding: on a hard navigation/reload,
  // `user` starts null and `isGuest` starts false regardless of whether a valid session exists, so
  // redirecting before isLoading settles would bounce a legitimately signed-in user back to "/"
  // during the brief token-verification window.
  if (isLoading) return <LoadingScreen />
  if (!user || isGuest) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isLoading, isGuest } = useAuth()
  if (isLoading) return <LoadingScreen />
  if (!user || isGuest || user.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/library" element={<Navigate to="/" replace />} />
        <Route path="/deck/:slug" element={<DeckDetailPage />} />
        <Route path="/deck/:slug/study" element={<StudySessionPage />} />
        <Route
          path="/deck/:slug/exam"
          element={
            <RequireSignedIn>
              <ExamSessionPage />
            </RequireSignedIn>
          }
        />
        <Route
          path="/review"
          element={
            <RequireSignedIn>
              <ReviewSessionPage />
            </RequireSignedIn>
          }
        />
        <Route
          path="/progress"
          element={
            <RequireSignedIn>
              <ProgressPage />
            </RequireSignedIn>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AppErrorBoundary title="Admin tools unavailable">
                <AdminQuestions />
              </AppErrorBoundary>
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
}

function AuthGate() {
  const { user, isLoading, isGuest } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!user && !isGuest) return <AuthPage />
  return <AppRoutes />
}

function AppShell() {
  return (
    <Routes>
      <Route path="/learn/*" element={<MarketingSite />} />
      <Route path="/*" element={<AuthGate />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
