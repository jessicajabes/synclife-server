const request = require('supertest')
const { v4: uuidv4 } = require('uuid')
const app = require('../../src/server')
const {
  createUser,
  authToken,
  getMuscleGroup,
  createExercise,
  cleanDatabase,
  seedMuscleGroups,
} = require('../helpers/factory')

let user, token, muscleGroupId, anotherUser, anotherToken

beforeAll(async () => {
  await cleanDatabase()
  await seedMuscleGroups()

  user = await createUser()
  token = authToken(user.id)

  anotherUser = await createUser()
  anotherToken = authToken(anotherUser.id)

  const mg = await getMuscleGroup('Quadríceps')
  muscleGroupId = mg.id
})

afterAll(async () => {
  await cleanDatabase()
})

// ─── GET /api/exercises ───────────────────────────────────────────────────────

describe('GET /api/exercises', () => {
  // [Z] Zero — lista vazia
  it('should return empty array when no exercises exist', async () => {
    // Arrange — banco limpo para este user (nenhum exercício criado ainda)

    // Act
    const response = await request(app)
      .get('/api/exercises')
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data).toEqual([])
  })

  // [M] Many — vários exercícios, filtrar por grupo muscular
  it('should filter exercises by muscleGroupId', async () => {
    // Arrange
    const costas = await getMuscleGroup('Costas')
    await createExercise(user.id, muscleGroupId, { name: 'Agachamento' })
    await createExercise(user.id, costas.id, { name: 'Pulley' })

    // Act
    const response = await request(app)
      .get(`/api/exercises?muscleGroupId=${muscleGroupId}`)
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data.every((e) => e.muscleGroups.some((mg) => mg.id === muscleGroupId))).toBe(true)
  })

  // [E] Exceptional — sem token
  it('should return 401 when token is missing', async () => {
    // Arrange
    const endpoint = '/api/exercises'

    // Act
    const response = await request(app).get(endpoint)

    // Assert
    expect(response.status).toBe(401)
  })
})

// ─── GET /api/exercises/:id ───────────────────────────────────────────────────

describe('GET /api/exercises/:id', () => {
  let exercise

  beforeAll(async () => {
    exercise = await createExercise(user.id, muscleGroupId, { name: 'Stiff GET' })
  })

  // [O] One — exercício encontrado
  it('should return exercise by id', async () => {
    // Arrange
    const { id } = exercise

    // Act
    const response = await request(app)
      .get(`/api/exercises/${id}`)
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data.id).toBe(id)
    expect(response.body.data).toHaveProperty('muscleGroups')
  })

  // [E] Exceptional — exercício não existe
  it('should return 404 for non-existent exercise', async () => {
    // Arrange
    const fakeId = uuidv4()

    // Act
    const response = await request(app)
      .get(`/api/exercises/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(404)
  })

  // [S] Security — usuário B não acessa exercício privado do usuário A
  it('should return 404 when accessing another user private exercise', async () => {
    // Arrange
    const privateExercise = await createExercise(user.id, muscleGroupId, { isGlobal: false })

    // Act
    const response = await request(app)
      .get(`/api/exercises/${privateExercise.id}`)
      .set('Authorization', `Bearer ${anotherToken}`)

    // Assert
    expect(response.status).toBe(404)
  })
})

// ─── POST /api/exercises ──────────────────────────────────────────────────────

describe('POST /api/exercises', () => {
  // [O] One — criar exercício com sucesso
  it('should create an exercise', async () => {
    // Arrange
    const payload = {
      id: uuidv4(),
      name: 'Leg Press',
      muscleGroupIds: [muscleGroupId],
    }

    // Act
    const response = await request(app)
      .post('/api/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(201)
    expect(response.body.data.name).toBe('Leg Press')
    expect(response.body.data.muscleGroups).toHaveLength(1)
    expect(response.body.data.muscleGroups[0].id).toBe(muscleGroupId)
  })

  // [B] Boundary — nome vazio
  it('should return 422 when name is empty', async () => {
    // Arrange
    const payload = { id: uuidv4(), name: '', muscleGroupIds: [muscleGroupId] }

    // Act
    const response = await request(app)
      .post('/api/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(422)
  })

  // [B] Boundary — muscleGroupIds vazio
  it('should return 422 when muscleGroupIds is empty array', async () => {
    // Arrange
    const payload = { id: uuidv4(), name: 'Exercício Sem Grupo', muscleGroupIds: [] }

    // Act
    const response = await request(app)
      .post('/api/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(422)
  })

  // [I] Interface — estrutura de resposta correta
  it('should return exercise with correct shape', async () => {
    // Arrange
    const payload = { id: uuidv4(), name: 'Rosca Direta', muscleGroupIds: [muscleGroupId] }

    // Act
    const response = await request(app)
      .post('/api/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    const { data } = response.body
    expect(data).toHaveProperty('id')
    expect(data).toHaveProperty('name')
    expect(data).toHaveProperty('muscleGroups')
    expect(data).toHaveProperty('isGlobal')
    expect(data).toHaveProperty('createdById')
    expect(Array.isArray(data.muscleGroups)).toBe(true)
  })

  // [E] Exceptional — sem token
  it('should return 401 without auth token', async () => {
    // Arrange
    const payload = { id: uuidv4(), name: 'Exercício', muscleGroupIds: [muscleGroupId] }

    // Act
    const response = await request(app).post('/api/exercises').send(payload)

    // Assert
    expect(response.status).toBe(401)
  })
})

// ─── PATCH /api/exercises/:id ─────────────────────────────────────────────────

describe('PATCH /api/exercises/:id', () => {
  let exercise

  beforeAll(async () => {
    exercise = await createExercise(user.id, muscleGroupId, { name: 'Exercício Patch' })
  })

  // [O] One — atualizar exercício
  it('should update exercise name', async () => {
    // Arrange
    const payload = { name: 'Exercício Atualizado' }

    // Act
    const response = await request(app)
      .patch(`/api/exercises/${exercise.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data.name).toBe('Exercício Atualizado')
  })

  // [S] Security — usuário B não pode editar exercício do usuário A
  it('should return 403 when another user tries to edit', async () => {
    // Arrange
    const payload = { name: 'Hackeado' }

    // Act
    const response = await request(app)
      .patch(`/api/exercises/${exercise.id}`)
      .set('Authorization', `Bearer ${anotherToken}`)
      .send(payload)

    // Assert
    expect(response.status).toBe(403)
  })

  // [E] Exceptional — exercício inexistente
  it('should return 404 for non-existent exercise', async () => {
    // Arrange
    const fakeId = uuidv4()

    // Act
    const response = await request(app)
      .patch(`/api/exercises/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Qualquer' })

    // Assert
    expect(response.status).toBe(404)
  })
})

// ─── DELETE /api/exercises/:id ────────────────────────────────────────────────

describe('DELETE /api/exercises/:id', () => {
  // [O] One — deletar exercício
  it('should delete exercise', async () => {
    // Arrange
    const exercise = await createExercise(user.id, muscleGroupId, { name: 'Exercício Delete' })

    // Act
    const response = await request(app)
      .delete(`/api/exercises/${exercise.id}`)
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(200)

    const check = await request(app)
      .get(`/api/exercises/${exercise.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(check.status).toBe(404)
  })

  // [S] Security — usuário B não pode deletar exercício do usuário A
  it('should return 403 when another user tries to delete', async () => {
    // Arrange
    const exercise = await createExercise(user.id, muscleGroupId, { name: 'Exercício Protegido' })

    // Act
    const response = await request(app)
      .delete(`/api/exercises/${exercise.id}`)
      .set('Authorization', `Bearer ${anotherToken}`)

    // Assert
    expect(response.status).toBe(403)
  })

  // [E] Exceptional — exercício não existe
  it('should return 404 when exercise does not exist', async () => {
    // Arrange
    const fakeId = uuidv4()

    // Act
    const response = await request(app)
      .delete(`/api/exercises/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(404)
  })
})

// ─── GET /api/exercises/muscle-groups ─────────────────────────────────────────

describe('GET /api/exercises/muscle-groups', () => {
  // [M] Many — retorna todos os grupos musculares
  it('should return all muscle groups', async () => {
    // Arrange — seed aplicado no beforeAll

    // Act
    const response = await request(app)
      .get('/api/exercises/muscle-groups')
      .set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data.length).toBeGreaterThanOrEqual(9)
    expect(response.body.data[0]).toHaveProperty('id')
    expect(response.body.data[0]).toHaveProperty('name')
  })
})
