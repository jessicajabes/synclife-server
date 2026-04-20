const { body } = require('express-validator')

const createPlanValidators = [
  body('id').isUUID(4).withMessage('ID deve ser UUID v4'),
  body('name').trim().notEmpty().withMessage('Nome é obrigatório'),
  body('mode').isIn(['weekly', 'sequential']).withMessage('Modo inválido (weekly ou sequential)'),
  body('startDate').isISO8601().withMessage('startDate inválida'),
  body('endDate').optional({ nullable: true }).isISO8601().withMessage('endDate inválida'),
  body('weekMap').optional({ nullable: true }).isObject(),
  body('sequence').optional({ nullable: true }).isArray(),
]

const updatePlanValidators = [
  body('name').optional().trim().notEmpty(),
  body('mode').optional().isIn(['weekly', 'sequential']),
  body('startDate').optional().isISO8601(),
  body('endDate').optional({ nullable: true }).isISO8601(),
  body('weekMap').optional({ nullable: true }).isObject(),
  body('sequence').optional({ nullable: true }).isArray(),
]

module.exports = { createPlanValidators, updatePlanValidators }
