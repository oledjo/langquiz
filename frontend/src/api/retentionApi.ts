const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const TOKEN_STORAGE_KEY = 'langquiz.auth-token'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export interface RetentionPreferences {
  email_enabled: boolean
  reminder_emails_enabled: boolean
  weekly_summary_enabled: boolean
  marketing_emails_enabled: boolean
}

export async function fetchRetentionPreferences(): Promise<RetentionPreferences> {
  const res = await fetch(`${BASE_URL}/api/retention/preferences`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/retention/preferences failed: ${res.status}`)
  return res.json() as Promise<RetentionPreferences>
}

export async function updateRetentionPreferences(input: RetentionPreferences): Promise<RetentionPreferences> {
  const res = await fetch(`${BASE_URL}/api/retention/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`PUT /api/retention/preferences failed: ${res.status}`)
  return res.json() as Promise<RetentionPreferences>
}
