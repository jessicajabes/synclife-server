const { Router } = require('express')
const exerciseController = require('../controllers/exercise.controller')
const authenticate = require('../middleware/auth.middleware')
const validate = require('../middleware/validate.middleware')
const { createExerciseValidators, updateExerciseValidators } = require('../validators/exercise.validators')

const router = Router()

router.use(authenticate)

router.get('/muscle-groups', exerciseController.listMuscleGroups)
router.get('/', exerciseController.listExercises)
router.get('/:id', exerciseController.getExercise)
router.post('/', validate(createExerciseValidators), exerciseController.createExercise)
router.patch('/:id', validate(updateExerciseValidators), exerciseController.updateExercise)
router.delete('/:id', exerciseController.deleteExercise)

module.exports = router
