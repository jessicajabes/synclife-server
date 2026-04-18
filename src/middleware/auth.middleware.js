const jwt = require('jsonwebtoken')

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err = new Error('Token não fornecido')
    err.statusCode = 401
    return next(err)
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = { id: payload.id, email: payload.email, role: payload.role }
    next()
  } catch (err) {
    next(err)
  }
}

module.exports = authenticate
