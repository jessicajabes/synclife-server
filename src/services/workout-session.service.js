const prisma = require('../config/database')

const buildSessionInclude = () => ({
  exerciseLogs: {
    include: {
      exercise: { select: { id: true, name: true } },
      substitutedExercise: { select: { id: true, name: true } },
      sets: { orderBy: { set_number: 'asc' } },
    },
  },
})

const formatSession = (session) => ({
  id: session.id,
  studentId: session.student_id,
  workoutTemplateId: session.workout_template_id,
  templateVersion: session.template_version,
  date: session.date,
  startedAt: session.started_at,
  finishedAt: session.finished_at,
  status: session.status,
  totalVolume: session.total_volume,
  syncStatus: session.sync_status,
  notes: session.notes,
  createdAt: session.created_at,
  updatedAt: session.updated_at,
  exerciseLogs: (session.exerciseLogs || []).map((log) => ({
    id: log.id,
    exerciseId: log.exercise_id,
    substitutedExerciseId: log.substituted_exercise_id,
    feeling: log.feeling,
    notes: log.notes,
    exercise: log.exercise,
    substitutedExercise: log.substitutedExercise,
    sets: log.sets.map((s) => ({
      id: s.id,
      setNumber: s.set_number,
      type: s.type,
      weight: s.weight,
      reps: s.reps,
      subReps: s.sub_reps,
    })),
  })),
})

const getInProgressSession = async (userId) => {
  const session = await prisma.workoutSession.findFirst({
    where: { student_id: userId, status: 'in_progress' },
    include: buildSessionInclude(),
  })
  return session ? formatSession(session) : null
}

const listSessions = async (userId, { templateId, status } = {}) => {
  const where = { student_id: userId }
  if (templateId) where.workout_template_id = templateId
  if (status) where.status = status

  const sessions = await prisma.workoutSession.findMany({
    where,
    include: buildSessionInclude(),
    orderBy: { date: 'desc' },
  })
  return sessions.map(formatSession)
}

const getSessionById = async (id, userId) => {
  const session = await prisma.workoutSession.findFirst({
    where: { id, student_id: userId },
    include: buildSessionInclude(),
  })

  if (!session) {
    const err = new Error('Sessão não encontrada')
    err.statusCode = 404
    throw err
  }

  return formatSession(session)
}

const createSession = async ({ id, workoutTemplateId, date, startedAt, syncStatus = 'pending' }, userId) => {
  // Verificar se template existe e pertence ao usuário
  const template = await prisma.workoutTemplate.findFirst({
    where: { id: workoutTemplateId, student_id: userId },
  })

  if (!template) {
    const err = new Error('Template não encontrado')
    err.statusCode = 404
    throw err
  }

  const session = await prisma.workoutSession.create({
    data: {
      id,
      student_id: userId,
      workout_template_id: workoutTemplateId,
      template_version: template.version,
      date: new Date(date),
      started_at: startedAt ? new Date(startedAt) : new Date(),
      status: 'in_progress',
      sync_status: syncStatus,
    },
    include: buildSessionInclude(),
  })

  return formatSession(session)
}

const updateSession = async (id, data, userId) => {
  const existing = await prisma.workoutSession.findFirst({
    where: { id, student_id: userId },
  })

  if (!existing) {
    const err = new Error('Sessão não encontrada')
    err.statusCode = 404
    throw err
  }

  const session = await prisma.$transaction(async (tx) => {
    await tx.workoutSession.update({
      where: { id },
      data: {
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.syncStatus !== undefined && { sync_status: data.syncStatus }),
      },
    })

    if (data.exerciseLogs !== undefined) {
      for (const log of data.exerciseLogs) {
        const existingLog = await tx.sessionExerciseLog.findUnique({ where: { id: log.id } })

        if (existingLog) {
          await tx.sessionExerciseLog.update({
            where: { id: log.id },
            data: {
              ...(log.feeling !== undefined && { feeling: log.feeling }),
              ...(log.notes !== undefined && { notes: log.notes }),
              ...(log.substitutedExerciseId !== undefined && {
                substituted_exercise_id: log.substitutedExerciseId,
              }),
            },
          })
        } else {
          await tx.sessionExerciseLog.create({
            data: {
              id: log.id,
              session_id: id,
              exercise_id: log.exerciseId,
              substituted_exercise_id: log.substitutedExerciseId ?? null,
              feeling: log.feeling ?? null,
              notes: log.notes ?? null,
            },
          })
        }

        if (log.sets) {
          for (const set of log.sets) {
            const existingSet = await tx.sessionSet.findUnique({ where: { id: set.id } })
            if (existingSet) {
              await tx.sessionSet.update({
                where: { id: set.id },
                data: {
                  weight: set.weight,
                  reps: set.reps,
                  ...(set.subReps !== undefined && { sub_reps: set.subReps }),
                },
              })
            } else {
              await tx.sessionSet.create({
                data: {
                  id: set.id,
                  session_exercise_log_id: log.id,
                  set_number: set.setNumber,
                  type: set.type,
                  weight: set.weight,
                  reps: set.reps,
                  sub_reps: set.subReps ?? null,
                },
              })
            }
          }
        }
      }
    }

    return tx.workoutSession.findUnique({
      where: { id },
      include: buildSessionInclude(),
    })
  })

  return formatSession(session)
}

const finishSession = async (id, { notes, finishedAt } = {}, userId) => {
  const existing = await prisma.workoutSession.findFirst({
    where: { id, student_id: userId },
    include: {
      exerciseLogs: {
        include: { sets: true },
      },
    },
  })

  if (!existing) {
    const err = new Error('Sessão não encontrada')
    err.statusCode = 404
    throw err
  }

  // Calcular totalVolume: Σ(peso × reps) apenas das séries "working"
  const totalVolume = existing.exerciseLogs.reduce((sessionAcc, log) => {
    const logVolume = log.sets
      .filter((s) => s.type === 'working')
      .reduce((acc, s) => acc + s.weight * s.reps, 0)
    return sessionAcc + logVolume
  }, 0)

  const session = await prisma.workoutSession.update({
    where: { id },
    data: {
      status: 'completed',
      finished_at: finishedAt ? new Date(finishedAt) : new Date(),
      total_volume: totalVolume,
      ...(notes !== undefined && { notes }),
      sync_status: 'pending',
    },
    include: buildSessionInclude(),
  })

  return formatSession(session)
}

const discardSession = async (id, userId) => {
  const existing = await prisma.workoutSession.findFirst({
    where: { id, student_id: userId },
  })

  if (!existing) {
    const err = new Error('Sessão não encontrada')
    err.statusCode = 404
    throw err
  }

  const session = await prisma.workoutSession.update({
    where: { id },
    data: { status: 'skipped' },
    include: buildSessionInclude(),
  })

  return formatSession(session)
}

const deleteSession = async (id, userId) => {
  const existing = await prisma.workoutSession.findFirst({
    where: { id, student_id: userId },
  })

  if (!existing) {
    const err = new Error('Sessão não encontrada')
    err.statusCode = 404
    throw err
  }

  await prisma.workoutSession.delete({ where: { id } })
}

module.exports = {
  getInProgressSession,
  listSessions,
  getSessionById,
  createSession,
  updateSession,
  finishSession,
  discardSession,
  deleteSession,
}
