const { Router } = require('express')
const workoutTemplateController = require('../controllers/workout-template.controller')
const authenticate = require('../middleware/auth.middleware')
const validate = require('../middleware/validate.middleware')
const {
  createTemplateValidators,
  updateTemplateValidators,
} = require('../validators/workout-template.validators')

const router = Router()

router.use(authenticate)

router.get('/', workoutTemplateController.listTemplates)
router.get('/:id', workoutTemplateController.getTemplate)
router.post('/', validate(createTemplateValidators), workoutTemplateController.createTemplate)
router.patch('/:id', validate(updateTemplateValidators), workoutTemplateController.updateTemplate)
router.delete('/:id', workoutTemplateController.deleteTemplate)

module.exports = router
