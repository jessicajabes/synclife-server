const request = require('supertest')
const { v4: uuidv4 } = require('uuid')
const app = require('../../src/server')
const prisma = require('../../src/config/database')
const {
  createUser,
  authToken,
  getMuscleGroup,
  createExercise,
  createTemplate,
  createSession,
  cleanDatabase,
  seedMuscleGroups,
} = require('../helpers/factory')

let user, token, anotherUser, anotherToken, template, exercise, muscleGroupId

beforeAll(async () => {
  await cleanDatabase()
  await seedMuscleGroups()

  user = await createUser()
  token = authToken(user.id)
  anotherUser = await createUser()
  anotherToken = authToken(anotherUser.id)

  const mg = await getMuscleGroup('Posterior')
  muscleGroupId = mg.id
  exercise = await createExercise(user.id, muscleGroupId, { name: 'Stiff Barra' })
  template = await createTemplate(user.id, exercise.id, { name: 'Posterior/Glúteos' })
})

afterAll(async () => {
  await cleanDatabase()
})

// ─── GET /api/workout-sessions/in-progress ───────────────────────────────────

describe('GET /api/workout-sessions/in-progress', () => {
  // [Z] Zero — sem sessão em andamento
  it('should return null when no session in progress', async () => {
    // Arrange
    const newUser = await createUser()
    const newToken = authToken(newUser.id)

    // Act
    const response = await request(app)
      .get('/api/workout-sessions/in-progress')
      .set('Authorization', `Bearer ${newToken}`)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data).toBeNull()
  })

  // [O] One — sessão em andamento existe
  it('should return in_progress session when it exists', async () => {
    // Arrange
    const newUser = await createUser()
    const newToken = authToken(newUser.id)
    const newExercise = await createExercise(newUser.id, muscleGroupId)
    const newTemplate = await createTemplate(newUser.id, newExercise.id)
    await createSession(newUser.id, newTemplate.id)

    // Act
    const response = await request(app)
      .get('/api/workout-sessions/in-progress')
      .set('Authorization', `Bearer ${newToken}`)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data).not.toBeNull()
    expect(response.body.data.status).toBe('in_progress')
  })

  // [E] Exceptional — sem token
  it('should return 401 without auth', async () => {
    // Arrange + Act
    const response = await request(app).get('/api/workout-sessions/in-progress')

    // Assert
    expect(response.status).toBe(401)
  })
})

// ─── POST /api/workout-sessions ──────────────────────────────────────────────

describe('POST /api/workout-sessions', () => {
  // [O] One — criar sessão
  it('should create a workout session', async () => {
    // Arrange
    const payload = {
      id: uuidv4(),
      workoutTemplateId: template.id,
      date: '2026-04-18',
    }

    // Act
    const response = await request(app)
      .post('/api/workout-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(201)
    expect(response.body.data.status).toBe('in_progress')
    expect(response.body.data.workoutTemplateId).toBe(template.id)
    expect(response.body.data.templateVersion).toBe(template.version)
    expect(response.body.data.studentId).toBe(user.id)
  })

  // [B] Boundary — data inválida
  it('should return 422 for invalid date', async () => {
    // Arrange
    const payload = {
      id: uuidv4(),
      workoutTemplateId: template.id,
      date: 'not-a-date',
    }

    // Act
    const response = await request(app)
      .post('/api/workout-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(422)
  })

  // [E] Exceptional — template não existe
  it('should return 404 when template does not exist', async () => {
    // Arrange
    const payload = {
      id: uuidv4(),
      workoutTemplateId: uuidv4(),
      date: '2026-04-18',
    }

    // Act
    const response = await request(app)
      .post('/api/workout-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(404)
  })

  // [I] Interface — estrutura de resposta
  it('should return session with correct shape', async () => {
    // Arrange
    const payload = {
      id: uuidv4(),
      workoutTemplateId: template.id,
      date: '2026-04-18',
    }

    // Act
    const response = await request(app)
      .post('/api/workout-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    const { data } = response.body
    expect(data).toHaveProperty('id')
    expect(data).toHaveProperty('status')
    expect(data).toHaveProperty('workoutTemplateId')
    expect(data).toHaveProperty('templateVersion')
    expect(data).toHaveProperty('exerciseLogs')
    expect(Array.isArray(data.exerciseLogs)).toBe(true)
  })
})

// ─── PATCH /api/workout-sessions/:id ─────────────────────────────────────────

describe('PATCH /api/workout-sessions/:id', () => {
  let session

  beforeEach(async () => {
    session = await createSession(user.id, template.id, template.version)
  })

  // [O] One — registrar exercícioLog com sets
  it('should update session with exercise logs and sets', async () => {
    // Arrange
    const logId = uuidv4()
    const setId = uuidv4()
    const payload = {
      exerciseLogs: [
        {
          id: logId,
          exerciseId: exercise.id,
          feeling: 'normal',
          sets: [
            { id: setId, setNumber: 1, type: 'working', weight: 50, reps: 10 },
          ],
        },
      ],
    }

    // Act
    const response = await request(app)
      .patch(`/api/workout-sessions/${session.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data.exerciseLogs).toHaveLength(1)
    expect(response.body.data.exerciseLogs[0].feeling).toBe('normal')
    expect(response.body.data.exerciseLogs[0].sets).toHaveLength(1)
    expect(response.body.data.exerciseLogs[0].sets[0].weight).toBe(50)
  })

  // [S] Security — outro usuário não pode atualizar sessão
  it('should return 404 when another user tries to update session', async () => {
    // Arrange
    const payload = { notes: 'Hackeado' }

    // Act
    const response = await request(app)
      .patch(`/api/workout-sessions/${session.id}`)
      .set('Authorization', `Bearer ${anotherToken}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(404)
  })

  // [E] Exceptional — sessão não existe
  it('should return 404 for non-existent session', async () => {
    // Arrange
    const fakeId = uuidv4()

    // Act
    const response = await request(app)
      .patch(`/api/workout-sessions/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'qualquer' })

    // Assert
    expect(response.status).toBe(404)
  })
})

// ─── POST /api/workout-sessions/:id/finish ───────────────────────────────────

describe('POST /api/workout-sessions/:id/finish', () => {
  // [O] One — finalizar sessão calcula totalVolume
  it('should finish session and calculate totalVolume', async () => {
    // Arrange
    const session = await createSession(user.id, template.id, template.version)

    // Criar logs e sets manualmente para cálculo do volume
    const logId = uuidv4()
    await prisma.sessionExerciseLog.create({
      data: {
        id: logId,
        session_id: session.id,
        exercise_id: exercise.id,
        sets: {
          create: [
            { id: uuidv4(), set_number: 1, type: 'working', weight: 60, reps: 10 },
            { id: uuidv4(), set_number: 2, type: 'working', weight: 60, reps: 8 },
            { id: uuidv4(), set_number: 0, type: 'warmup', weight: 40, reps: 15 }, // não conta no volume
          ],
        },
      },
    })

    // Act
    const response = await request(app)
      .post(`/api/workout-sessions/${session.id}/finish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Treino ótimo!' })

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe('completed')
    expect(response.body.data.totalVolume).toBe(60 * 10 + 60 * 8) // 1080, sem o warmup
    expect(response.body.data.notes).toBe('Treino ótimo!')
  })

  // [B] Boundary — sessão sem sets (volume zero)
  it('should finish session with zero volume when no sets recorded', async () => {
    // Arrange
    const session = await createSession(user.id, template.id, template.version)

    // Act
    const response = await request(app)
      .post(`/api/workout-sessions/${session.id}/finish`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data.totalVolume).toBe(0)
  })

  // [S] Security — outro usuário não pode finalizar
  it('should return 404 when another user tries to finish session', async () => {
    // Arrange
    const session = await createSession(user.id, template.id, template.version)

    // Act
    const response = await request(app)
      .post(`/api/workout-sessions/${session.id}/finish`)
      .set('Authorization', `Bearer ${anotherToken}`)
      .send({})

    // Assert
    expect(response.status).toBe(404)
  })
})

// ─── POST /api/workout-sessions/:id/discard ──────────────────────────────────

describe('POST /api/workout-sessions/:id/discard', () => {
  // [O] One — descartar sessão muda status para skipped
  it('should discard session setting status to skipped', async () => {
    // Arrange
    const session = await createSession(user.id, template.id, template.version)

    // Act
    const response = await request(app)
      .post(`/api/workout-sessions/${session.id}/discard`)
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe('skipped')
  })

  // [S] Security — outro usuário não pode descartar
  it('should return 404 when another user tries to discard', async () => {
    // Arrange
    const session = await createSession(user.id, template.id, template.version)

    // Act
    const response = await request(app)
      .post(`/api/workout-sessions/${session.id}/discard`)
      .set('Authorization', `Bearer ${anotherToken}`)

    // Assert
    expect(response.status).toBe(404)
  })
})

// ─── GET /api/workout-sessions ───────────────────────────────────────────────

describe('GET /api/workout-sessions', () => {
  // [M] Many — listar sessões com filtros
  it('should return sessions filtered by status', async () => {
    // Arrange
    const newUser = await createUser()
    const newToken = authToken(newUser.id)
    const newExercise = await createExercise(newUser.id, muscleGroupId)
    const newTemplate = await createTemplate(newUser.id, newExercise.id)
    await createSession(newUser.id, newTemplate.id, 1, { status: 'completed' })
    await createSession(newUser.id, newTemplate.id, 1, { status: 'in_progress' })

    // Act
    const response = await request(app)
      .get('/api/workout-sessions?status=completed')
      .set('Authorization', `Bearer ${newToken}`)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data.every((s) => s.status === 'completed')).toBe(true)
  })
})

// ─── DELETE /api/workout-sessions/:id ────────────────────────────────────────

describe('DELETE /api/workout-sessions/:id', () => {
  // [O] One — deletar sessão
  it('should delete session', async () => {
    // Arrange
    const session = await createSession(user.id, template.id, template.version)

    // Act
    const response = await request(app)
      .delete(`/api/workout-sessions/${session.id}`)
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(200)

    const check = await request(app)
      .get(`/api/workout-sessions/${session.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(check.status).toBe(404)
  })

  // [E] Exceptional — sessão não existe
  it('should return 404 for non-existent session', async () => {
    // Arrange
    const fakeId = uuidv4()

    // Act
    const response = await request(app)
      .delete(`/api/workout-sessions/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(404)
  })
})
