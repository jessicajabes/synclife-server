const { body } = require('express-validator')

const signUpValidators = [
  body('id').isUUID(4).withMessage('ID deve ser UUID v4'),
  body('name').trim().notEmpty().withMessage('Nome é obrigatório'),
  body('email').isEmail().normalizeEmail().withMessage('E-mail inválido'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Senha deve ter no mínimo 8 caracteres'),
  body('birthDate').isISO8601().withMessage('Data de nascimento inválida (use ISO 8601)'),
  body('height').optional().isFloat({ min: 50, max: 300 }).withMessage('Altura inválida (cm)'),
  body('weight').optional().isFloat({ min: 10, max: 500 }).withMessage('Peso inválido (kg)'),
]

const logInValidators = [
  body('email').isEmail().normalizeEmail().withMessage('E-mail inválido'),
  body('password').notEmpty().withMessage('Senha é obrigatória'),
]

module.exports = { signUpValidators, logInValidators }
