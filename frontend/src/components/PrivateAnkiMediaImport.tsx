import { useRef, useState } from 'react'
import { AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY, REPS_AUTH_TOKEN_KEY, readWithLegacyFallback } from '../lib/storageKeys'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const HASH = /^[a-f0-9]{64}$/

export function PrivateAnkiMediaImport() {
  const input = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const upload = async () => {
    const files = [...(input.current?.files ?? [])].filter((file) => HASH.test(file.name))
    if (!files.length) { setStatus('Choose the hash-named files from the exported media folder.'); return }
    const token = readWithLegacyFallback(AUTH_TOKEN_KEY, REPS_AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY)
    if (!token) { setStatus('Your session expired. Sign in again, then retry.'); return }
    setBusy(true)
    let done = 0
    try {
      for (const file of files) {
        const response = await fetch(`${API_URL}/api/private-anki-media/import/${file.name}`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' }, body: file,
        })
        if (!response.ok) throw new Error(`Upload failed for ${file.name}: ${response.status}`)
        done += 1
        setStatus(`Uploaded ${done} of ${files.length} images…`)
      }
      setStatus(`Uploaded ${done} private Anki images.`)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Upload failed.') }
    finally { setBusy(false) }
  }

  return <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
    <h3 className="text-sm font-semibold text-slate-800">Private Anki media</h3>
    <p className="text-xs text-slate-500">Choose all hash-named files in the exported <code>media</code> folder. They are uploaded only to your private account.</p>
    <input ref={input} type="file" multiple disabled={busy} className="block text-xs" />
    <button type="button" onClick={() => void upload()} disabled={busy} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Uploading…' : 'Upload Anki media'}</button>
    {status && <p className="text-xs text-slate-600" aria-live="polite">{status}</p>}
  </section>
}
