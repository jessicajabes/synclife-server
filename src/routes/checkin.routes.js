const { Router } = require('express')
const authenticate = require('../middleware/auth.middleware')
const checkinController = require('../controllers/checkin.controller')

const router = Router()

// ─── Middleware: Require authentication ────────────────────────────────────
router.use(authenticate)

// ─── Question Management ───────────────────────────────────────────────────

// GET /checkin/questions - List active questions
router.get('/questions', checkinController.listQuestions)

// GET /checkin/questions/search - Search questions (for autocomplete)
router.get('/questions/search', checkinController.searchQuestions)

// POST /checkin/questions - Create a new question
router.post('/questions', checkinController.createQuestion)

// PATCH /checkin/questions/:id - Edit label and unit
router.patch('/questions/:id', checkinController.updateQuestion)

// PATCH /checkin/questions/:id/activate - Activate a deactivated question
router.patch('/questions/:id/activate', checkinController.activateQuestion)

// DELETE /checkin/questions/:id - Soft delete (set is_active = false)
router.delete('/questions/:id', checkinController.deactivateQuestion)

// PATCH /checkin/questions/reorder - Reorder questions
router.patch('/questions/reorder', checkinController.reorderQuestions)

// ─── Daily Check-in ───────────────────────────────────────────────────────

// GET /checkin/entries/:date - Get check-in for a specific date
router.get('/entries/:date', checkinController.getEntry)

// POST /checkin/entries - Create or update check-in
router.post('/entries', checkinController.saveEntry)

// DELETE /checkin/entries/:id - Delete check-in entry
router.delete('/entries/:id', checkinController.deleteEntry)

// ─── History/Evolution ─────────────────────────────────────────────────────

// GET /checkin/questions/:id/evolution - Get evolution of a question's responses
router.get('/questions/:id/evolution', checkinController.getQuestionEvolution)

module.exports = router
