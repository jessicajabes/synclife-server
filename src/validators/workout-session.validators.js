const { body } = require('express-validator')

const createSessionValidators = [
  body('id').isUUID(4).withMessage('ID deve ser UUID v4'),
  body('workoutTemplateId').isUUID(4).withMessage('workoutTemplateId deve ser UUID v4'),
  body('date').isISO8601().withMessage('date inválida'),
  body('startedAt').optional({ nullable: true }).isISO8601(),
  body('syncStatus').optional().isIn(['synced', 'pending']),
]

const updateSessionValidators = [
  body('date').optional().isISO8601().withMessage('date inválida'),
  body('finishedAt').optional({ nullable: true }).isISO8601(),
  body('notes').optional({ nullable: true }).isString(),
  body('syncStatus').optional().isIn(['synced', 'pending']),
  body('exerciseLogs').optional().isArray(),
  body('exerciseLogs.*.id').optional().isUUID(4),
  body('exerciseLogs.*.exerciseId').optional().isUUID(4),
  body('exerciseLogs.*.substitutedExerciseId').optional({ nullable: true }).isUUID(4),
  body('exerciseLogs.*.feeling').optional({ nullable: true }).isIn(['light', 'normal', 'heavy']),
  body('exerciseLogs.*.sets').optional().isArray(),
  body('exerciseLogs.*.sets.*.id').optional().isUUID(4),
  body('exerciseLogs.*.sets.*.setNumber').optional().isInt({ min: 1 }),
  body('exerciseLogs.*.sets.*.type').optional().isIn(['warmup', 'working']),
  body('exerciseLogs.*.sets.*.weight').optional().isFloat({ min: 0 }),
  body('exerciseLogs.*.sets.*.reps').optional().isInt({ min: 0 }),
]

module.exports = { createSessionValidators, updateSessionValidators }
