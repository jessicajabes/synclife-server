const { v4: uuidv4 } = require('uuid')
const bcrypt = require('bcrypt')
const prisma = require('../../src/config/database')
const jwt = require('jsonwebtoken')

const DEFAULT_PASSWORD = 'senha123456'
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync(DEFAULT_PASSWORD, 10)

const createUser = async (overrides = {}) => {
  const id = overrides.id || uuidv4()
  const user = await prisma.user.create({
    data: {
      id,
      name: overrides.name || 'Usuária Teste',
      email: overrides.email || `user-${id}@test.com`,
      password_hash: DEFAULT_PASSWORD_HASH,
      birth_date: new Date('1995-01-01'),
      height: overrides.height ?? null,
      weight: overrides.weight ?? null,
      role: overrides.role || 'student',
      preferences: {
        theme: 'system',
        barbellWeight: 20,
        availablePlates: [1.25, 2.5, 5, 10, 15, 20],
        defaultRestSeconds: 60,
        restTimerEnabled: true,
        restTimerSound: true,
      },
    },
  })
  return user
}

const authToken = (userId, role = 'student') => {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET || 'test-secret-key', { expiresIn: '1d' })
}

const getMuscleGroup = async (name = 'Quadríceps') => {
  return prisma.muscleGroup.findFirst({ where: { name } })
}

const seedMuscleGroups = async () => {
  const groups = [
    'Quadríceps', 'Glúteos', 'Posterior', 'Peito',
    'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Core',
  ]
  for (const name of groups) {
    await prisma.muscleGroup.upsert({
      where: { name },
      create: { id: uuidv4(), name },
      update: {},
    })
  }
}

const createExercise = async (userId, muscleGroupId, overrides = {}) => {
  const id = overrides.id || uuidv4()
  const exercise = await prisma.exercise.create({
    data: {
      id,
      name: overrides.name || `Exercício ${id.slice(0, 8)}`,
      youtube_url: overrides.youtubeUrl ?? null,
      notes: overrides.notes ?? null,
      is_global: overrides.isGlobal ?? false,
      created_by_id: userId,
      muscleGroups: {
        create: [{ muscle_group_id: muscleGroupId, order: 0 }],
      },
    },
    include: {
      muscleGroups: { include: { muscleGroup: true } },
    },
  })
  return exercise
}

const createTemplate = async (userId, exerciseId, overrides = {}) => {
  const id = overrides.id || uuidv4()
  const templateExerciseId = uuidv4()
  const setId = uuidv4()

  const template = await prisma.workoutTemplate.create({
    data: {
      id,
      name: overrides.name || `Template ${id.slice(0, 8)}`,
      student_id: userId,
      created_by_id: userId,
      version: 1,
      exercises: {
        create: [{
          id: templateExerciseId,
          exercise_id: exerciseId,
          order: 0,
          default_rest_seconds: 60,
          sets: {
            create: [{
              id: setId,
              type: 'working',
              quantity: 3,
              reps_range: '8-12',
            }],
          },
        }],
      },
    },
    include: {
      exercises: { include: { sets: true, exercise: true } },
    },
  })
  return template
}

const createSession = async (userId, templateId, templateVersion = 1, overrides = {}) => {
  const id = overrides.id || uuidv4()
  const session = await prisma.workoutSession.create({
    data: {
      id,
      student_id: userId,
      workout_template_id: templateId,
      template_version: templateVersion,
      date: overrides.date ? new Date(overrides.date) : new Date(),
      started_at: overrides.startedAt ? new Date(overrides.startedAt) : new Date(),
      status: overrides.status || 'in_progress',
      sync_status: 'pending',
    },
  })
  return session
}

const cleanDatabase = async () => {
  await prisma.sessionSet.deleteMany()
  await prisma.sessionExerciseLog.deleteMany()
  await prisma.workoutSession.deleteMany()
  await prisma.trainingPlan.deleteMany()
  await prisma.templateExerciseSet.deleteMany()
  await prisma.templateExercise.deleteMany()
  await prisma.workoutTemplate.deleteMany()
  await prisma.exerciseMuscleGroup.deleteMany()
  await prisma.exercise.deleteMany()
  await prisma.user.deleteMany()
}

module.exports = {
  DEFAULT_PASSWORD,
  createUser,
  authToken,
  getMuscleGroup,
  seedMuscleGroups,
  createExercise,
  createTemplate,
  createSession,
  cleanDatabase,
}
