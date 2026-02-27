const baseUrl = process.env.SMOKE_API_URL

if (!baseUrl) {
  console.log('SMOKE_API_URL not set; skipping API smoke test.')
  process.exit(0)
}

async function check(path, expected = 200) {
  const res = await fetch(`${baseUrl}${path}`)
  if (res.status !== expected) {
    const body = await res.text()
    throw new Error(`${path} expected ${expected}, got ${res.status}: ${body.slice(0, 200)}`)
  }
  console.log(`ok ${path} -> ${res.status}`)
}

try {
  await check('/api/health', 200)
  await check('/api/ready', 200)
  console.log('Smoke tests passed.')
} catch (err) {
  console.error('Smoke tests failed:', err)
  process.exit(1)
}
