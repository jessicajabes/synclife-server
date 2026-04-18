const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const prisma = require('../config/database')

const DEFAULT_PREFERENCES = {
  theme: 'system',
  barbellWeight: 20,
  availablePlates: [1.25, 2.5, 5, 10, 15, 20],
  defaultRestSeconds: 60,
  restTimerEnabled: true,
  restTimerSound: true,
}

const stripPassword = (user) => {
  const { password_hash, ...safeUser } = user
  return safeUser
}

const signUp = async ({ id, name, email, password, birthDate, height, weight }) => {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    const err = new Error('E-mail já cadastrado')
    err.statusCode = 409
    throw err
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      id,
      name,
      email,
      password_hash: passwordHash,
      birth_date: new Date(birthDate),
      height: height ?? null,
      weight: weight ?? null,
      role: 'student',
      preferences: DEFAULT_PREFERENCES,
    },
  })

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )

  return { token, user: stripPassword(user) }
}

const logIn = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    const err = new Error('Credenciais inválidas')
    err.statusCode = 401
    throw err
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatch) {
    const err = new Error('Credenciais inválidas')
    err.statusCode = 401
    throw err
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )

  return { token, user: stripPassword(user) }
}

module.exports = { signUp, logIn }
