const authService = require('../services/auth.service')

const signUp = async (req, res, next) => {
  try {
    const { id, name, email, password, birthDate, height, weight } = req.body
    const result = await authService.signUp({ id, name, email, password, birthDate, height, weight })
    return res.status(201).json({ data: result, error: null, message: 'Usuário criado com sucesso' })
  } catch (err) {
    next(err)
  }
}

const logIn = async (req, res, next) => {
  try {
    const { email, password } = req.body
    const result = await authService.logIn({ email, password })
    return res.status(200).json({ data: result, error: null, message: 'Login realizado com sucesso' })
  } catch (err) {
    next(err)
  }
}

const getMe = async (req, res) => {
  return res.status(200).json({ data: req.user, error: null, message: null })
}

module.exports = { signUp, logIn, getMe }
