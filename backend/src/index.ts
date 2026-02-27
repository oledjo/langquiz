import express from 'express'
import cors from 'cors'
import { db, runMigrations } from './db/database'
import { progressRouter } from './routes/progress'
import { statsRouter } from './routes/stats'
import { authRouter } from './routes/auth'
import { userExercisesRouter } from './routes/userExercises'
import { exercisesRouter } from './routes/exercises'
import { adminRouter } from './routes/admin'
import { eventsRouter } from './routes/events'
import { retentionRouter } from './routes/retention'
import { attachRequestContext, errorHandler } from './middleware/requestContext'

const app = express()
const PORT = process.env.PORT ?? 3001
const ALLOWED_CORS_ORIGINS = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const ALLOW_RENDER_ORIGINS = process.env.ALLOW_RENDER_ORIGINS === 'true'

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      const isLocalhost =
        /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
      const isConfiguredOrigin = ALLOWED_CORS_ORIGINS.includes(origin)
      const isRenderOrigin = ALLOW_RENDER_ORIGINS && /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin)
      callback(null, isLocalhost || isConfiguredOrigin || isRenderOrigin)
    },
  })
)
app.use(express.json())
app.use(attachRequestContext)

app.use('/api/auth', authRouter)
app.use('/api/progress', progressRouter)
app.use('/api/stats', statsRouter)
app.use('/api/user-exercises', userExercisesRouter)
app.use('/api/exercises', exercisesRouter)
app.use('/api/admin', adminRouter)
app.use('/api/events', eventsRouter)
app.use('/api/retention', retentionRouter)

app.get('/', (_req, res) => {
  res.json({
    name: 'LangQuiz API',
    status: 'ok',
    endpoints: [
      '/api/health',
      '/api/ready',
      '/api/auth',
      '/api/stats',
      '/api/progress',
      '/api/user-exercises',
      '/api/exercises',
      '/api/admin',
      '/api/events',
      '/api/retention',
    ],
  })
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/ready', async (_req, res) => {
  try {
    await db.query('SELECT 1')
    res.json({ status: 'ready' })
  } catch (error) {
    console.error('Readiness check failed:', error)
    res.status(503).json({ status: 'not-ready' })
  }
})

app.use(errorHandler)

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
