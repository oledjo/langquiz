import express from 'express'
import cors from 'cors'
import { db, runMigrations } from './db/database'
import { progressRouter } from './routes/progress'
import { statsRouter } from './routes/stats'
import { authRouter } from './routes/auth'
import { userExercisesRouter } from './routes/userExercises'
import { exercisesRouter } from './routes/exercises'
import { adminRouter } from './routes/admin'

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
      const isRenderOrigin = /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin)
      callback(null, isLocalhost || isConfiguredOrigin || isRenderOrigin)
    },
  })
)
app.use(express.json())

app.use('/api/auth', authRouter)
app.use('/api/progress', progressRouter)
app.use('/api/stats', statsRouter)
app.use('/api/user-exercises', userExercisesRouter)
app.use('/api/exercises', exercisesRouter)
app.use('/api/admin', adminRouter)

app.get('/', (_req, res) => {
  res.json({
    name: 'LangQuiz API',
    status: 'ok',
    endpoints: [
      '/api/health',
      '/api/auth',
      '/api/stats',
      '/api/progress',
      '/api/user-exercises',
      '/api/exercises',
      '/api/admin',
    ],
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
