const prisma = require('../config/database')

const formatPlan = (plan) => ({
  id: plan.id,
  name: plan.name,
  studentId: plan.student_id,
  mode: plan.mode,
  weekMap: plan.week_map,
  sequence: plan.sequence,
  startDate: plan.start_date,
  endDate: plan.end_date,
  createdAt: plan.created_at,
})

const validateModeData = (mode, weekMap, sequence) => {
  if (mode === 'weekly' && !weekMap) {
    const err = new Error('Plano semanal requer weekMap')
    err.statusCode = 422
    throw err
  }
  if (mode === 'sequential' && !sequence) {
    const err = new Error('Plano sequencial requer sequence')
    err.statusCode = 422
    throw err
  }
}

const listPlans = async (userId) => {
  const plans = await prisma.trainingPlan.findMany({
    where: { student_id: userId },
    orderBy: { start_date: 'desc' },
  })
  return plans.map(formatPlan)
}

const getPlanById = async (id, userId) => {
  const plan = await prisma.trainingPlan.findFirst({
    where: { id, student_id: userId },
  })

  if (!plan) {
    const err = new Error('Plano não encontrado')
    err.statusCode = 404
    throw err
  }

  return formatPlan(plan)
}

const createPlan = async ({ id, name, mode, weekMap, sequence, startDate, endDate }, userId) => {
  validateModeData(mode, weekMap, sequence)

  const plan = await prisma.trainingPlan.create({
    data: {
      id,
      name,
      student_id: userId,
      mode,
      week_map: weekMap ?? null,
      sequence: sequence ?? null,
      start_date: new Date(startDate),
      end_date: endDate ? new Date(endDate) : null,
    },
  })

  return formatPlan(plan)
}

const updatePlan = async (id, data, userId) => {
  const existing = await prisma.trainingPlan.findFirst({
    where: { id, student_id: userId },
  })

  if (!existing) {
    const err = new Error('Plano não encontrado')
    err.statusCode = 404
    throw err
  }

  const newMode = data.mode ?? existing.mode
  const newWeekMap = data.weekMap !== undefined ? data.weekMap : existing.week_map
  const newSequence = data.sequence !== undefined ? data.sequence : existing.sequence

  validateModeData(newMode, newWeekMap, newSequence)

  const plan = await prisma.trainingPlan.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.mode !== undefined && { mode: data.mode }),
      ...(data.weekMap !== undefined && { week_map: data.weekMap }),
      ...(data.sequence !== undefined && { sequence: data.sequence }),
      ...(data.startDate !== undefined && { start_date: new Date(data.startDate) }),
      ...(data.endDate !== undefined && { end_date: data.endDate ? new Date(data.endDate) : null }),
    },
  })

  return formatPlan(plan)
}

const deletePlan = async (id, userId) => {
  const existing = await prisma.trainingPlan.findFirst({
    where: { id, student_id: userId },
  })

  if (!existing) {
    const err = new Error('Plano não encontrado')
    err.statusCode = 404
    throw err
  }

  await prisma.trainingPlan.delete({ where: { id } })
}

module.exports = { listPlans, getPlanById, createPlan, updatePlan, deletePlan }
