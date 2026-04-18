const { body } = require('express-validator')

const setValidators = [
  body('exercises.*.sets').isArray({ min: 1 }).withMessage('Cada exercício deve ter ao menos uma série'),
  body('exercises.*.sets.*.type')
    .isIn(['warmup', 'working'])
    .withMessage('Tipo de série inválido'),
  body('exercises.*.sets.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantidade de séries deve ser inteiro positivo'),
  body('exercises.*.sets.*.repsRange')
    .notEmpty()
    .withMessage('Faixa de repetições é obrigatória'),
]

const createTemplateValidators = [
  body('id').isUUID(4).withMessage('ID deve ser UUID v4'),
  body('name').trim().notEmpty().withMessage('Nome é obrigatório'),
  body('exercises').isArray({ min: 1 }).withMessage('Template deve ter ao menos um exercício'),
  body('exercises.*.id').isUUID(4).withMessage('ID do item deve ser UUID v4'),
  body('exercises.*.exerciseId').isUUID(4).withMessage('exerciseId deve ser UUID v4'),
  body('exercises.*.order').isInt({ min: 0 }).withMessage('order deve ser inteiro >= 0'),
  body('exercises.*.defaultRestSeconds').optional().isInt({ min: 0 }),
  ...setValidators,
]

const updateTemplateValidators = [
  body('name').optional().trim().notEmpty().withMessage('Nome não pode ser vazio'),
  body('exercises').optional().isArray({ min: 1 }),
  body('exercises.*.id').optional().isUUID(4),
  body('exercises.*.exerciseId').optional().isUUID(4),
  body('exercises.*.order').optional().isInt({ min: 0 }),
]

module.exports = { createTemplateValidators, updateTemplateValidators }
