const { Router } = require('express')
const trainingPlanController = require('../controllers/training-plan.controller')
const authenticate = require('../middleware/auth.middleware')
const validate = require('../middleware/validate.middleware')
const { createPlanValidators, updatePlanValidators } = require('../validators/training-plan.validators')

const router = Router()

router.use(authenticate)

router.get('/', trainingPlanController.listPlans)
router.get('/:id', trainingPlanController.getPlan)
router.post('/', validate(createPlanValidators), trainingPlanController.createPlan)
router.patch('/:id', validate(updatePlanValidators), trainingPlanController.updatePlan)
router.delete('/:id', trainingPlanController.deletePlan)

module.exports = router
