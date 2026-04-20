const request = require('supertest')
const { v4: uuidv4 } = require('uuid')
const app = require('../../src/server')
const { createUser, cleanDatabase, seedMuscleGroups, DEFAULT_PASSWORD, authToken } = require('../helpers/factory')

beforeAll(async () => {
  await cleanDatabase()
  await seedMuscleGroups()
})

afterAll(async () => {
  await cleanDatabase()
})

// ─── POST /api/auth/signup ────────────────────────────────────────────────────

describe('POST /api/auth/signup', () => {
  // [Z] Zero — campos obrigatórios ausentes
  it('should return 422 when required fields are missing', async () => {
    // Arrange
    const payload = {}

    // Act
    const response = await request(app).post('/api/auth/signup').send(payload)

    // Assert
    expect(response.status).toBe(422)
    expect(response.body.error).toBe('Dados inválidos')
  })

  // [O] One — cadastro bem-sucedido
  it('should create a user and return token', async () => {
    // Arrange
    const payload = {
      id: uuidv4(),
      name: 'Jessica Teste',
      email: `jessica-${uuidv4()}@test.com`,
      password: 'senha123456',
      birthDate: '1995-06-15',
    }

    // Act
    const response = await request(app).post('/api/auth/signup').send(payload)

    // Assert
    expect(response.status).toBe(201)
    expect(response.body.data).toHaveProperty('token')
    expect(response.body.data.user).not.toHaveProperty('password_hash')
    expect(response.body.data.user.email).toBe(payload.email)
  })

  // [B] Boundary — senha muito curta
  it('should return 422 when password has less than 8 chars', async () => {
    // Arrange
    const payload = {
      id: uuidv4(),
      name: 'Teste',
      email: `b-${uuidv4()}@test.com`,
      password: '123',
      birthDate: '1995-01-01',
    }

    // Act
    const response = await request(app).post('/api/auth/signup').send(payload)

    // Assert
    expect(response.status).toBe(422)
  })

  // [B] Boundary — email inválido
  it('should return 422 when email is invalid', async () => {
    // Arrange
    const payload = {
      id: uuidv4(),
      name: 'Teste',
      email: 'nao-e-um-email',
      password: 'senha123456',
      birthDate: '1995-01-01',
    }

    // Act
    const response = await request(app).post('/api/auth/signup').send(payload)

    // Assert
    expect(response.status).toBe(422)
  })

  // [B] Boundary — id não é UUID v4
  it('should return 422 when id is not UUID v4', async () => {
    // Arrange
    const payload = {
      id: 'not-a-uuid',
      name: 'Teste',
      email: `uuid-${uuidv4()}@test.com`,
      password: 'senha123456',
      birthDate: '1995-01-01',
    }

    // Act
    const response = await request(app).post('/api/auth/signup').send(payload)

    // Assert
    expect(response.status).toBe(422)
  })

  // [I] Interface — resposta tem estrutura correta
  it('should return { data, error, message } structure', async () => {
    // Arrange
    const payload = {
      id: uuidv4(),
      name: 'Interface Test',
      email: `interface-${uuidv4()}@test.com`,
      password: 'senha123456',
      birthDate: '1995-01-01',
    }

    // Act
    const response = await request(app).post('/api/auth/signup').send(payload)

    // Assert
    expect(response.body).toHaveProperty('data')
    expect(response.body).toHaveProperty('error')
    expect(response.body).toHaveProperty('message')
  })

  // [E] Exceptional — e-mail duplicado
  it('should return 409 when email is already registered', async () => {
    // Arrange
    const email = `dup-${uuidv4()}@test.com`
    await request(app).post('/api/auth/signup').send({
      id: uuidv4(), name: 'Primeiro', email, password: 'senha123456', birthDate: '1995-01-01',
    })

    // Act
    const response = await request(app).post('/api/auth/signup').send({
      id: uuidv4(), name: 'Segundo', email, password: 'senha123456', birthDate: '1995-01-01',
    })

    // Assert
    expect(response.status).toBe(409)
  })
})

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  let userEmail

  beforeAll(async () => {
    userEmail = `login-${uuidv4()}@test.com`
    await createUser({ email: userEmail })
  })

  // [O] One — login bem-sucedido
  it('should return token on valid credentials', async () => {
    // Arrange
    const payload = { email: userEmail, password: DEFAULT_PASSWORD }

    // Act
    const response = await request(app).post('/api/auth/login').send(payload)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data).toHaveProperty('token')
    expect(response.body.data.user).not.toHaveProperty('password_hash')
  })

  // [E] Exceptional — e-mail não existe
  it('should return 401 when email is not found', async () => {
    // Arrange
    const payload = { email: 'nao@existe.com', password: DEFAULT_PASSWORD }

    // Act
    const response = await request(app).post('/api/auth/login').send(payload)

    // Assert
    expect(response.status).toBe(401)
    expect(response.body.error).toBe('Credenciais inválidas')
  })

  // [E] Exceptional — senha errada
  it('should return 401 when password is wrong', async () => {
    // Arrange
    const payload = { email: userEmail, password: 'senhaerrada' }

    // Act
    const response = await request(app).post('/api/auth/login').send(payload)

    // Assert
    expect(response.status).toBe(401)
    expect(response.body.error).toBe('Credenciais inválidas')
  })

  // [S] Security — não retorna hash da senha
  it('should never return password_hash in response', async () => {
    // Arrange
    const payload = { email: userEmail, password: DEFAULT_PASSWORD }

    // Act
    const response = await request(app).post('/api/auth/login').send(payload)

    // Assert
    expect(response.body.data.user).not.toHaveProperty('password_hash')
    expect(JSON.stringify(response.body)).not.toContain('password_hash')
  })
})

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  let user, token

  beforeAll(async () => {
    user = await createUser()
    token = authToken(user.id)
  })

  // [O] One — retorna usuário autenticado
  it('should return authenticated user', async () => {
    // Arrange — token gerado no beforeAll

    // Act
    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data.id).toBe(user.id)
  })

  // [E] Exceptional — sem token
  it('should return 401 when token is missing', async () => {
    // Arrange
    const endpoint = '/api/auth/me'

    // Act
    const response = await request(app).get(endpoint)

    // Assert
    expect(response.status).toBe(401)
    expect(response.body.error).toBe('Token não fornecido')
  })

  // [S] Security — token inválido
  it('should return 401 when token is invalid', async () => {
    // Arrange
    const fakeToken = 'Bearer invalid.token.here'

    // Act
    const response = await request(app).get('/api/auth/me').set('Authorization', fakeToken)

    // Assert
    expect(response.status).toBe(401)
  })
})
