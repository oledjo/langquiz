import { useCallback, useEffect, useState } from 'react'
import { fetchStudyToday, type StudyToday } from '../api/studyApi'
import { useAuth } from '../auth/AuthContext'
import { PROGRESS_UPDATED_EVENT } from '../lib/storageKeys'

/**
 * Today's review/new limits for the signed-in user. `today` stays null for guests and while
 * loading; callers treat null as "no limit" so a failed fetch never hides due reviews.
 */
export function useStudyToday() {
  const { user, isGuest } = useAuth()
  const [today, setToday] = useState<StudyToday | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user || isGuest) {
      setToday(null)
      setLoading(false)
      return
    }
    try {
      setToday(await fetchStudyToday())
    } catch {
      setToday(null)
    } finally {
      setLoading(false)
    }
  }, [isGuest, user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!user || isGuest) return
    const handle = () => void refresh()
    window.addEventListener(PROGRESS_UPDATED_EVENT, handle)
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, handle)
  }, [isGuest, refresh, user])

  return { today, loading, refresh }
}
