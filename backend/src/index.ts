import express from 'express'
import cors from 'cors'
import { db, runMigrations } from './db/database'
import { progressRouter } from './routes/progress'
import { statsRouter } from './routes/stats'

const app = express()
const PORT = process.env.PORT ?? 3001
const ALLOWED_CORS_ORIGINS = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      const isLocalhost =
        /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
      const isConfiguredOrigin = ALLOWED_CORS_ORIGINS.includes(origin)
      callback(null, isLocalhost || isConfiguredOrigin)
    },
  })
)
app.use(express.json())

app.use('/api/progress', progressRouter)
app.use('/api/stats', statsRouter)

app.get('/', (_req, res) => {
  res.json({
    name: 'LangQuiz API',
    status: 'ok',
    endpoints: ['/api/health', '/api/stats', '/api/progress'],
  })
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

async function bootstrap(): Promise<void> {
  await runMigrations()

  const server = app.listen(PORT, () => {
    console.log(`LangQuiz backend running on http://localhost:${PORT}`)
  })

  const shutdown = async () => {
    server.close()
    await db.end()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

bootstrap().catch((error) => {
  console.error('Failed to start backend:', error)
  process.exit(1)
})
