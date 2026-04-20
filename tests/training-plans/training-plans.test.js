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

let user, token, anotherUser, anotherToken, templateId

beforeAll(async () => {
  await cleanDatabase()
  await seedMuscleGroups()

  user = await createUser()
  token = authToken(user.id)
  anotherUser = await createUser()
  anotherToken = authToken(anotherUser.id)

  const mg = await getMuscleGroup('Peito')
  const exercise = await createExercise(user.id, mg.id, { name: 'Supino Reto' })
  const template = await createTemplate(user.id, exercise.id, { name: 'Peito/Tríceps' })
  templateId = template.id
})

afterAll(async () => {
  await cleanDatabase()
})

const weeklyPlan = () => ({
  id: uuidv4(),
  name: 'Plano Semanal',
  mode: 'weekly',
  startDate: '2026-01-01',
  weekMap: {
    monday: templateId,
    wednesday: templateId,
    friday: templateId,
  },
})

const sequentialPlan = () => ({
  id: uuidv4(),
  name: 'Plano Sequencial',
  mode: 'sequential',
  startDate: '2026-01-01',
  sequence: [{ templateId }, { rest: true }, { templateId }],
})

// ─── GET /api/training-plans ──────────────────────────────────────────────────

describe('GET /api/training-plans', () => {
  // [Z] Zero — lista vazia
  it('should return empty array when no plans exist', async () => {
    // Arrange
    const newUser = await createUser()
    const newToken = authToken(newUser.id)

    // Act
    const response = await request(app)
      .get('/api/training-plans')
      .set('Authorization', `Bearer ${newToken}`)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data).toEqual([])
  })

  // [E] Exceptional — sem token
  it('should return 401 without auth', async () => {
    // Arrange + Act
    const response = await request(app).get('/api/training-plans')

    // Assert
    expect(response.status).toBe(401)
  })
})

// ─── POST /api/training-plans ────────────────────────────────────────────────

describe('POST /api/training-plans', () => {
  // [O] One — criar plano weekly
  it('should create a weekly training plan', async () => {
    // Arrange
    const payload = weeklyPlan()

    // Act
    const response = await request(app)
      .post('/api/training-plans')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(201)
    expect(response.body.data.mode).toBe('weekly')
    expect(response.body.data.weekMap).toBeDefined()
    expect(response.body.data.studentId).toBe(user.id)
  })

  // [O] One — criar plano sequential
  it('should create a sequential training plan', async () => {
    // Arrange
    const payload = sequentialPlan()

    // Act
    const response = await request(app)
      .post('/api/training-plans')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(201)
    expect(response.body.data.mode).toBe('sequential')
    expect(Array.isArray(response.body.data.sequence)).toBe(true)
  })

  // [B] Boundary — modo weekly sem weekMap
  it('should return 422 when weekly plan has no weekMap', async () => {
    // Arrange
    const payload = {
      id: uuidv4(),
      name: 'Plano Sem Mapa',
      mode: 'weekly',
      startDate: '2026-01-01',
    }

    // Act
    const response = await request(app)
      .post('/api/training-plans')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(422)
  })

  // [B] Boundary — modo inválido
  it('should return 422 when mode is invalid', async () => {
    // Arrange
    const payload = {
      id: uuidv4(), name: 'Plano Inválido', mode: 'random', startDate: '2026-01-01',
    }

    // Act
    const response = await request(app)
      .post('/api/training-plans')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(422)
  })

  // [B] Boundary — modo sequential sem sequence
  it('should return 422 when sequential plan has no sequence', async () => {
    // Arrange
    const payload = {
      id: uuidv4(), name: 'Sequencial Sem Sequência', mode: 'sequential', startDate: '2026-01-01',
    }

    // Act
    const response = await request(app)
      .post('/api/training-plans')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(422)
  })

  // [I] Interface — estrutura da resposta
  it('should return plan with correct shape', async () => {
    // Arrange
    const payload = weeklyPlan()

    // Act
    const response = await request(app)
      .post('/api/training-plans')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    const { data } = response.body
    expect(data).toHaveProperty('id')
    expect(data).toHaveProperty('name')
    expect(data).toHaveProperty('mode')
    expect(data).toHaveProperty('startDate')
    expect(data).toHaveProperty('studentId')
  })
})

// ─── GET /api/training-plans/:id ─────────────────────────────────────────────

describe('GET /api/training-plans/:id', () => {
  let plan

  beforeAll(async () => {
    const payload = weeklyPlan()
    const res = await request(app)
      .post('/api/training-plans')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
    plan = res.body.data
  })

  // [O] One — plano encontrado
  it('should return plan by id', async () => {
    // Arrange
    const { id } = plan

    // Act
    const response = await request(app)
      .get(`/api/training-plans/${id}`)
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data.id).toBe(id)
  })

  // [E] Exceptional — plano não existe
  it('should return 404 for non-existent plan', async () => {
    // Arrange
    const fakeId = uuidv4()

    // Act
    const response = await request(app)
      .get(`/api/training-plans/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(404)
  })

  // [S] Security — outro usuário não acessa plano alheio
  it('should return 404 when another user tries to access', async () => {
    // Arrange
    const { id } = plan

    // Act
    const response = await request(app)
      .get(`/api/training-plans/${id}`)
      .set('Authorization', `Bearer ${anotherToken}`)

    // Assert
    expect(response.status).toBe(404)
  })
})

// ─── PATCH /api/training-plans/:id ───────────────────────────────────────────

describe('PATCH /api/training-plans/:id', () => {
  let plan

  beforeAll(async () => {
    const payload = weeklyPlan()
    const res = await request(app)
      .post('/api/training-plans')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
    plan = res.body.data
  })

  // [O] One — atualizar nome do plano
  it('should update plan name', async () => {
    // Arrange
    const payload = { name: 'Plano Atualizado' }

    // Act
    const response = await request(app)
      .patch(`/api/training-plans/${plan.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data.name).toBe('Plano Atualizado')
  })

  // [S] Security — outro usuário não pode atualizar
  it('should return 404 when another user tries to update', async () => {
    // Arrange
    const payload = { name: 'Hackeado' }

    // Act
    const response = await request(app)
      .patch(`/api/training-plans/${plan.id}`)
      .set('Authorization', `Bearer ${anotherToken}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(404)
  })
})

// ─── DELETE /api/training-plans/:id ──────────────────────────────────────────

describe('DELETE /api/training-plans/:id', () => {
  // [O] One — deletar plano
  it('should delete training plan', async () => {
    // Arrange
    const payload = weeklyPlan()
    const created = await request(app)
      .post('/api/training-plans')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
    const planId = created.body.data.id

    // Act
    const response = await request(app)
      .delete(`/api/training-plans/${planId}`)
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(200)

    const check = await request(app)
      .get(`/api/training-plans/${planId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(check.status).toBe(404)
  })

  // [E] Exceptional — plano não existe
  it('should return 404 for non-existent plan', async () => {
    // Arrange
    const fakeId = uuidv4()

    // Act
    const response = await request(app)
      .delete(`/api/training-plans/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(404)
  })
})
