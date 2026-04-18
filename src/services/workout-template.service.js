const prisma = require('../config/database')

const buildTemplateInclude = () => ({
  exercises: {
    orderBy: { order: 'asc' },
    include: {
      exercise: {
        include: {
          muscleGroups: {
            orderBy: { order: 'asc' },
            include: { muscleGroup: true },
          },
        },
      },
      sets: { orderBy: { id: 'asc' } },
    },
  },
})

const formatTemplate = (template) => ({
  id: template.id,
  name: template.name,
  studentId: template.student_id,
  createdById: template.created_by_id,
  version: template.version,
  createdAt: template.created_at,
  updatedAt: template.updated_at,
  exercises: template.exercises.map((te) => ({
    id: te.id,
    exerciseId: te.exercise_id,
    order: te.order,
    sectionTitle: te.section_title,
    supersetGroup: te.superset_group,
    defaultRestSeconds: te.default_rest_seconds,
    notes: te.notes,
    exercise: {
      id: te.exercise.id,
      name: te.exercise.name,
      youtubeUrl: te.exercise.youtube_url,
      muscleGroups: te.exercise.muscleGroups.map((mg) => ({
        id: mg.muscleGroup.id,
        name: mg.muscleGroup.name,
        order: mg.order,
      })),
    },
    sets: te.sets.map((s) => ({
      id: s.id,
      type: s.type,
      quantity: s.quantity,
      repsRange: s.reps_range,
      restSeconds: s.rest_seconds,
    })),
  })),
})

const listTemplates = async (userId) => {
  const templates = await prisma.workoutTemplate.findMany({
    where: { student_id: userId },
    include: buildTemplateInclude(),
    orderBy: { name: 'asc' },
  })
  return templates.map(formatTemplate)
}

const getTemplateById = async (id, userId) => {
  const template = await prisma.workoutTemplate.findFirst({
    where: { id, student_id: userId },
    include: buildTemplateInclude(),
  })

  if (!template) {
    const err = new Error('Template não encontrado')
    err.statusCode = 404
    throw err
  }

  return formatTemplate(template)
}

const createTemplate = async ({ id, name, exercises }, userId) => {
  const template = await prisma.$transaction(async (tx) => {
    await tx.workoutTemplate.create({
      data: {
        id,
        name,
        student_id: userId,
        created_by_id: userId,
        version: 1,
      },
    })

    for (const ex of exercises) {
      await tx.templateExercise.create({
        data: {
          id: ex.id,
          template_id: id,
          exercise_id: ex.exerciseId,
          order: ex.order,
          section_title: ex.sectionTitle ?? null,
          superset_group: ex.supersetGroup ?? null,
          default_rest_seconds: ex.defaultRestSeconds ?? 60,
          notes: ex.notes ?? null,
          sets: {
            create: (ex.sets || []).map((s) => ({
              id: s.id,
              type: s.type,
              quantity: s.quantity,
              reps_range: s.repsRange,
              rest_seconds: s.restSeconds ?? null,
            })),
          },
        },
      })
    }

    return tx.workoutTemplate.findUnique({
      where: { id },
      include: buildTemplateInclude(),
    })
  })

  return formatTemplate(template)
}

const updateTemplate = async (id, data, userId) => {
  const existing = await prisma.workoutTemplate.findFirst({
    where: { id, student_id: userId },
  })

  if (!existing) {
    const err = new Error('Template não encontrado')
    err.statusCode = 404
    throw err
  }

  const template = await prisma.$transaction(async (tx) => {
    await tx.workoutTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        version: existing.version + 1,
      },
    })

    if (data.exercises !== undefined) {
      // Deletar todos os exercícios e recriar
      await tx.templateExercise.deleteMany({ where: { template_id: id } })

      for (const ex of data.exercises) {
        await tx.templateExercise.create({
          data: {
            id: ex.id,
            template_id: id,
            exercise_id: ex.exerciseId,
            order: ex.order,
            section_title: ex.sectionTitle ?? null,
            superset_group: ex.supersetGroup ?? null,
            default_rest_seconds: ex.defaultRestSeconds ?? 60,
            notes: ex.notes ?? null,
            sets: {
              create: (ex.sets || []).map((s) => ({
                id: s.id,
                type: s.type,
                quantity: s.quantity,
                reps_range: s.repsRange,
                rest_seconds: s.restSeconds ?? null,
              })),
            },
          },
        })
      }
    }

    return tx.workoutTemplate.findUnique({
      where: { id },
      include: buildTemplateInclude(),
    })
  })

  return formatTemplate(template)
}

const deleteTemplate = async (id, userId) => {
  const existing = await prisma.workoutTemplate.findFirst({
    where: { id, student_id: userId },
  })

  if (!existing) {
    const err = new Error('Template não encontrado')
    err.statusCode = 404
    throw err
  }

  await prisma.workoutTemplate.delete({ where: { id } })
}

module.exports = { listTemplates, getTemplateById, createTemplate, updateTemplate, deleteTemplate }
