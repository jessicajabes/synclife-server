const { Router } = require('express')
const workoutSessionController = require('../controllers/workout-session.controller')
const authenticate = require('../middleware/auth.middleware')
const validate = require('../middleware/validate.middleware')
const { createSessionValidators, updateSessionValidators } = require('../validators/workout-session.validators')

const router = Router()

router.use(authenticate)

router.get('/in-progress', workoutSessionController.getInProgressSession)
router.get('/history/unified', workoutSessionController.getUnifiedHistory)
router.get('/', workoutSessionController.listSessions)
router.get('/:id', workoutSessionController.getSession)
router.post('/', validate(createSessionValidators), workoutSessionController.createSession)
router.patch('/:id', validate(updateSessionValidators), workoutSessionController.updateSession)
router.post('/:id/finish', workoutSessionController.finishSession)
router.post('/:id/discard', workoutSessionController.discardSession)
router.delete('/:id', workoutSessionController.deleteSession)

module.exports = router
