const workoutSessionService = require('../services/workout-session.service')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const getInProgressSession = async (req, res, next) => {
  try {
    const session = await workoutSessionService.getInProgressSession(req.user.id)
    return res.status(200).json({ data: session, error: null, message: null })
  } catch (err) {
    next(err)
  }
}

const listSessions = async (req, res, next) => {
  try {
    const { templateId, status } = req.query
    const sessions = await workoutSessionService.listSessions(req.user.id, { templateId, status })
    return res.status(200).json({ data: sessions, error: null, message: null })
  } catch (err) {
    next(err)
  }
}

const getSession = async (req, res, next) => {
  try {
    const session = await workoutSessionService.getSessionById(req.params.id, req.user.id)
    return res.status(200).json({ data: session, error: null, message: null })
  } catch (err) {
    next(err)
  }
}

const createSession = async (req, res, next) => {
  try {
    const { id, workoutTemplateId, date, startedAt, syncStatus } = req.body
    const session = await workoutSessionService.createSession(
      { id, workoutTemplateId, date, startedAt, syncStatus },
      req.user.id
    )
    return res.status(201).json({ data: session, error: null, message: 'Sessão criada com sucesso' })
  } catch (err) {
    next(err)
  }
}

const updateSession = async (req, res, next) => {
  try {
    const session = await workoutSessionService.updateSession(req.params.id, req.body, req.user.id)
    return res.status(200).json({ data: session, error: null, message: 'Sessão atualizada com sucesso' })
  } catch (err) {
    next(err)
  }
}

const finishSession = async (req, res, next) => {
  try {
    const { notes, finishedAt } = req.body
    const session = await workoutSessionService.finishSession(req.params.id, { notes, finishedAt }, req.user.id)
    return res.status(200).json({ data: session, error: null, message: 'Treino finalizado!' })
  } catch (err) {
    next(err)
  }
}

const discardSession = async (req, res, next) => {
  try {
    const session = await workoutSessionService.discardSession(req.params.id, req.user.id)
    return res.status(200).json({ data: session, error: null, message: 'Sessão descartada' })
  } catch (err) {
    next(err)
  }
}

const deleteSession = async (req, res, next) => {
  try {
    await workoutSessionService.deleteSession(req.params.id, req.user.id)
    return res.status(200).json({ data: null, error: null, message: 'Sessão excluída com sucesso' })
  } catch (err) {
    next(err)
  }
}

const getUnifiedHistory = async (req, res, next) => {
  try {
    const { from, to, page = 1, limit = 20 } = req.query
    const userId = req.user.id

    const [sessions, checkins] = await Promise.all([
      prisma.workoutSession.findMany({
        where: {
          student_id: userId,
          date: { gte: new Date(from), lte: new Date(to) },
        },
        include: {
          workoutTemplate: { select: { name: true } },
          exerciseLogs: {
            include: { sets: true, exercise: { select: { id: true, name: true } } },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { date: 'desc' },
      }),
      prisma.checkinEntry.findMany({
        where: {
          user_id: userId,
          date: { gte: new Date(from), lte: new Date(to) },
        },
        include: {
          answers: {
            include: {
              question: {
                select: { label: true, field_type: true, unit: true, is_active: true },
              },
            },
            orderBy: { question: { order: 'asc' } },
          },
        },
        orderBy: { date: 'desc' },
      }),
    ])

    const items = [
      ...sessions.map(s => ({ type: 'workout', date: s.date, data: workoutSessionService.formatSession(s) })),
      ...checkins.map(c => ({ type: 'checkin', date: c.date, data: c })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date))

    const start = (Number(page) - 1) * Number(limit)
    return res.status(200).json({
      data: {
        items: items.slice(start, start + Number(limit)),
        total: items.length,
        page: Number(page),
      },
      error: null,
      message: null,
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getInProgressSession,
  listSessions,
  getSession,
  createSession,
  updateSession,
  finishSession,
  discardSession,
  deleteSession,
  getUnifiedHistory,
}
