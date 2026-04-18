const { Router } = require('express')
const authController = require('../controllers/auth.controller')
const authenticate = require('../middleware/auth.middleware')
const validate = require('../middleware/validate.middleware')
const { signUpValidators, logInValidators } = require('../validators/auth.validators')

const router = Router()

router.post('/signup', validate(signUpValidators), authController.signUp)
router.post('/login', validate(logInValidators), authController.logIn)
router.get('/me', authenticate, authController.getMe)

module.exports = router
