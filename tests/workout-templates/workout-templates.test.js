const request = require('supertest')
const { v4: uuidv4 } = require('uuid')
const app = require('../../src/server')
const {
  createUser,
  authToken,
  getMuscleGroup,
  createExercise,
  createTemplate,
  cleanDatabase,
  seedMuscleGroups,
} = require('../helpers/factory')

let user, token, anotherUser, anotherToken, muscleGroupId, exercise

beforeAll(async () => {
  await cleanDatabase()
  await seedMuscleGroups()

  user = await createUser()
  token = authToken(user.id)
  anotherUser = await createUser()
  anotherToken = authToken(anotherUser.id)

  const mg = await getMuscleGroup('Glúteos')
  muscleGroupId = mg.id
  exercise = await createExercise(user.id, muscleGroupId, { name: 'Stiff Template Test' })
})

afterAll(async () => {
  await cleanDatabase()
})

const validTemplatePayload = (exerciseId) => ({
  id: uuidv4(),
  name: 'Posterior/Glúteos',
  exercises: [
    {
      id: uuidv4(),
      exerciseId,
      order: 0,
      sectionTitle: 'Posterior',
      defaultRestSeconds: 90,
      sets: [
        { id: uuidv4(), type: 'warmup', quantity: 1, repsRange: '12-15' },
        { id: uuidv4(), type: 'working', quantity: 3, repsRange: '7-9' },
      ],
    },
  ],
})

// ─── GET /api/workout-templates ───────────────────────────────────────────────

describe('GET /api/workout-templates', () => {
  // [Z] Zero — lista vazia
  it('should return empty array when no templates exist', async () => {
    // Arrange
    const newUser = await createUser()
    const newToken = authToken(newUser.id)

    // Act
    const response = await request(app)
      .get('/api/workout-templates')
      .set('Authorization', `Bearer ${newToken}`)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data).toEqual([])
  })

  // [M] Many — templates do próprio usuário
  it('should return only templates belonging to the user', async () => {
    // Arrange
    await createTemplate(user.id, exercise.id, { name: 'Template A' })
    await createTemplate(user.id, exercise.id, { name: 'Template B' })
    const otherExercise = await createExercise(anotherUser.id, muscleGroupId)
    await createTemplate(anotherUser.id, otherExercise.id, { name: 'Template Outro User' })

    // Act
    const response = await request(app)
      .get('/api/workout-templates')
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data.every((t) => t.studentId === user.id)).toBe(true)
  })

  // [E] Exceptional — sem token
  it('should return 401 without auth', async () => {
    // Arrange + Act
    const response = await request(app).get('/api/workout-templates')

    // Assert
    expect(response.status).toBe(401)
  })
})

// ─── GET /api/workout-templates/:id ──────────────────────────────────────────

describe('GET /api/workout-templates/:id', () => {
  let template

  beforeAll(async () => {
    template = await createTemplate(user.id, exercise.id, { name: 'Template GET' })
  })

  // [O] One — template encontrado com exercícios e séries
  it('should return template with exercises and sets', async () => {
    // Arrange
    const { id } = template

    // Act
    const response = await request(app)
      .get(`/api/workout-templates/${id}`)
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data.id).toBe(id)
    expect(Array.isArray(response.body.data.exercises)).toBe(true)
    expect(response.body.data.exercises[0]).toHaveProperty('sets')
  })

  // [E] Exceptional — template não existe
  it('should return 404 for non-existent template', async () => {
    // Arrange
    const fakeId = uuidv4()

    // Act
    const response = await request(app)
      .get(`/api/workout-templates/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(404)
  })

  // [S] Security — outro usuário não acessa template alheio
  it('should return 404 when another user tries to access', async () => {
    // Arrange
    const { id } = template

    // Act
    const response = await request(app)
      .get(`/api/workout-templates/${id}`)
      .set('Authorization', `Bearer ${anotherToken}`)

    // Assert
    expect(response.status).toBe(404)
  })
})

// ─── POST /api/workout-templates ─────────────────────────────────────────────

describe('POST /api/workout-templates', () => {
  // [O] One — criar template com exercícios e séries
  it('should create a template with exercises and sets', async () => {
    // Arrange
    const payload = validTemplatePayload(exercise.id)

    // Act
    const response = await request(app)
      .post('/api/workout-templates')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(201)
    expect(response.body.data.name).toBe(payload.name)
    expect(response.body.data.version).toBe(1)
    expect(response.body.data.exercises).toHaveLength(1)
    expect(response.body.data.exercises[0].sets).toHaveLength(2)
    expect(response.body.data.exercises[0].sectionTitle).toBe('Posterior')
  })

  // [B] Boundary — sem exercícios
  it('should return 422 when exercises array is empty', async () => {
    // Arrange
    const payload = { id: uuidv4(), name: 'Treino Vazio', exercises: [] }

    // Act
    const response = await request(app)
      .post('/api/workout-templates')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(422)
  })

  // [B] Boundary — nome vazio
  it('should return 422 when name is empty', async () => {
    // Arrange
    const payload = { id: uuidv4(), name: '', exercises: [{ id: uuidv4(), exerciseId: exercise.id, order: 0, sets: [{ id: uuidv4(), type: 'working', quantity: 1, repsRange: '10' }] }] }

    // Act
    const response = await request(app)
      .post('/api/workout-templates')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(422)
  })

  // [I] Interface — versão inicial deve ser 1
  it('should start with version 1', async () => {
    // Arrange
    const payload = validTemplatePayload(exercise.id)

    // Act
    const response = await request(app)
      .post('/api/workout-templates')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.body.data.version).toBe(1)
  })
})

// ─── PATCH /api/workout-templates/:id ────────────────────────────────────────

describe('PATCH /api/workout-templates/:id', () => {
  let template

  beforeAll(async () => {
    template = await createTemplate(user.id, exercise.id, { name: 'Template PATCH' })
  })

  // [O] One — atualizar nome incrementa versão
  it('should increment version on update', async () => {
    // Arrange
    const payload = { name: 'Template PATCH Atualizado' }

    // Act
    const response = await request(app)
      .patch(`/api/workout-templates/${template.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data.version).toBe(template.version + 1)
    expect(response.body.data.name).toBe('Template PATCH Atualizado')
  })

  // [S] Security — outro usuário não pode editar
  it('should return 404 when another user tries to update', async () => {
    // Arrange
    const payload = { name: 'Hackeado' }

    // Act
    const response = await request(app)
      .patch(`/api/workout-templates/${template.id}`)
      .set('Authorization', `Bearer ${anotherToken}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(404)
  })
})

// ─── DELETE /api/workout-templates/:id ───────────────────────────────────────

describe('DELETE /api/workout-templates/:id', () => {
  // [O] One — deletar template
  it('should delete template', async () => {
    // Arrange
    const template = await createTemplate(user.id, exercise.id, { name: 'Template DELETE' })

    // Act
    const response = await request(app)
      .delete(`/api/workout-templates/${template.id}`)
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(200)

    const check = await request(app)
      .get(`/api/workout-templates/${template.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(check.status).toBe(404)
  })

  // [S] Security — outro usuário não pode deletar
  it('should return 404 when another user tries to delete', async () => {
    // Arrange
    const template = await createTemplate(user.id, exercise.id, { name: 'Template Protegido' })

    // Act
    const response = await request(app)
      .delete(`/api/workout-templates/${template.id}`)
      .set('Authorization', `Bearer ${anotherToken}`)

    // Assert
    expect(response.status).toBe(404)
  })

  // [E] Exceptional — template não existe
  it('should return 404 for non-existent template', async () => {
    // Arrange
    const fakeId = uuidv4()

    // Act
    const response = await request(app)
      .delete(`/api/workout-templates/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(404)
  })
})
