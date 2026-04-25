require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')

const authRoutes = require('./routes/auth.routes')
const exerciseRoutes = require('./routes/exercise.routes')
const workoutTemplateRoutes = require('./routes/workout-template.routes')
const trainingPlanRoutes = require('./routes/training-plan.routes')
const workoutSessionRoutes = require('./routes/workout-session.routes')
const checkinRoutes = require('./routes/checkin.routes')
const errorHandler = require('./middleware/error-handler.middleware')
const logger = require('./config/logger')

const app = express()

// ─── Middlewares globais ──────────────────────────────────────────────────────
app.use(helmet())
app.use(cors())
app.use(express.json())

// ─── Rotas ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/exercises', exerciseRoutes)
app.use('/api/workout-templates', workoutTemplateRoutes)
app.use('/api/training-plans', trainingPlanRoutes)
app.use('/api/workout-sessions', workoutSessionRoutes)
app.use('/api/checkin', checkinRoutes)

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ data: null, error: 'Rota não encontrada', message: 'Rota não encontrada' })
})

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use(errorHandler)

// ─── Inicialização ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`SyncLife server running on port ${PORT}`)
  })
}

module.exports = app
