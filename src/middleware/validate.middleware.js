const { validationResult } = require('express-validator')

const validate = (validations) => async (req, res, next) => {
  for (const validation of validations) {
    await validation.run(req)
  }

  const errors = validationResult(req)
  if (errors.isEmpty()) return next()

  const err = new Error('Dados inválidos')
  err.type = 'validation'
  err.details = errors.array()
  next(err)
}

module.exports = validate
