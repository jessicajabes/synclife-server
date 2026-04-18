const prisma = require('../config/database')

const buildExerciseSelect = () => ({
  id: true,
  name: true,
  youtube_url: true,
  notes: true,
  is_global: true,
  created_by_id: true,
  created_at: true,
  updated_at: true,
  muscleGroups: {
    orderBy: { order: 'asc' },
    select: {
      order: true,
      muscleGroup: { select: { id: true, name: true } },
    },
  },
})

const formatExercise = (exercise) => ({
  id: exercise.id,
  name: exercise.name,
  youtubeUrl: exercise.youtube_url,
  notes: exercise.notes,
  isGlobal: exercise.is_global,
  createdById: exercise.created_by_id,
  createdAt: exercise.created_at,
  updatedAt: exercise.updated_at,
  muscleGroups: exercise.muscleGroups.map((mg) => ({
    id: mg.muscleGroup.id,
    name: mg.muscleGroup.name,
    order: mg.order,
  })),
})

const listExercises = async (userId, { muscleGroupId } = {}) => {
  const where = {
    OR: [{ is_global: true }, { created_by_id: userId }],
  }

  if (muscleGroupId) {
    where.muscleGroups = { some: { muscle_group_id: muscleGroupId } }
  }

  const exercises = await prisma.exercise.findMany({
    where,
    select: buildExerciseSelect(),
    orderBy: { name: 'asc' },
  })

  return exercises.map(formatExercise)
}

const getExerciseById = async (id, userId) => {
  const exercise = await prisma.exercise.findFirst({
    where: {
      id,
      OR: [{ is_global: true }, { created_by_id: userId }],
    },
    select: buildExerciseSelect(),
  })

  if (!exercise) {
    const err = new Error('Exercício não encontrado')
    err.statusCode = 404
    throw err
  }

  return formatExercise(exercise)
}

const createExercise = async ({ id, name, muscleGroupIds, youtubeUrl, notes, isGlobal = false }, userId) => {
  const exercise = await prisma.$transaction(async (tx) => {
    const created = await tx.exercise.create({
      data: {
        id,
        name,
        youtube_url: youtubeUrl ?? null,
        notes: notes ?? null,
        is_global: isGlobal,
        created_by_id: userId,
      },
    })

    await tx.exerciseMuscleGroup.createMany({
      data: muscleGroupIds.map((mgId, index) => ({
        exercise_id: id,
        muscle_group_id: mgId,
        order: index,
      })),
    })

    return tx.exercise.findUnique({
      where: { id: created.id },
      select: buildExerciseSelect(),
    })
  })

  return formatExercise(exercise)
}

const updateExercise = async (id, data, userId) => {
  const existing = await prisma.exercise.findUnique({ where: { id } })

  if (!existing) {
    const err = new Error('Exercício não encontrado')
    err.statusCode = 404
    throw err
  }

  if (existing.created_by_id !== userId) {
    const err = new Error('Sem permissão para editar este exercício')
    err.statusCode = 403
    throw err
  }

  const exercise = await prisma.$transaction(async (tx) => {
    const updated = await tx.exercise.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.youtubeUrl !== undefined && { youtube_url: data.youtubeUrl }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.isGlobal !== undefined && { is_global: data.isGlobal }),
      },
    })

    if (data.muscleGroupIds) {
      await tx.exerciseMuscleGroup.deleteMany({ where: { exercise_id: id } })
      await tx.exerciseMuscleGroup.createMany({
        data: data.muscleGroupIds.map((mgId, index) => ({
          exercise_id: id,
          muscle_group_id: mgId,
          order: index,
        })),
      })
    }

    return tx.exercise.findUnique({
      where: { id: updated.id },
      select: buildExerciseSelect(),
    })
  })

  return formatExercise(exercise)
}

const deleteExercise = async (id, userId) => {
  const existing = await prisma.exercise.findUnique({ where: { id } })

  if (!existing) {
    const err = new Error('Exercício não encontrado')
    err.statusCode = 404
    throw err
  }

  if (existing.created_by_id !== userId) {
    const err = new Error('Sem permissão para excluir este exercício')
    err.statusCode = 403
    throw err
  }

  await prisma.exercise.delete({ where: { id } })
}

const listMuscleGroups = async () => {
  const groups = await prisma.muscleGroup.findMany({ orderBy: { name: 'asc' } })
  return groups.map((g) => ({ id: g.id, name: g.name }))
}

module.exports = { listExercises, getExerciseById, createExercise, updateExercise, deleteExercise, listMuscleGroups }
