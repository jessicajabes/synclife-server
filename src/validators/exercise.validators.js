const { body } = require('express-validator')

const createExerciseValidators = [
  body('id').isUUID(4).withMessage('ID deve ser UUID v4'),
  body('name').trim().notEmpty().withMessage('Nome é obrigatório').isLength({ max: 255 }),
  body('muscleGroupIds')
    .isArray({ min: 1 })
    .withMessage('Pelo menos um grupo muscular é obrigatório'),
  body('muscleGroupIds.*').isUUID(4).withMessage('IDs de grupos musculares devem ser UUID v4'),
  body('youtubeUrl').optional({ nullable: true }).isURL().withMessage('URL do YouTube inválida'),
  body('notes').optional({ nullable: true }).isString(),
  body('isGlobal').optional().isBoolean(),
]

const updateExerciseValidators = [
  body('name').optional().trim().notEmpty().withMessage('Nome não pode ser vazio').isLength({ max: 255 }),
  body('muscleGroupIds').optional().isArray({ min: 1 }).withMessage('Pelo menos um grupo muscular'),
  body('muscleGroupIds.*').optional().isUUID(4),
  body('youtubeUrl').optional({ nullable: true }).isURL().withMessage('URL do YouTube inválida'),
  body('notes').optional({ nullable: true }).isString(),
  body('isGlobal').optional().isBoolean(),
]

module.exports = { createExerciseValidators, updateExerciseValidators }
