const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// ─── Question Management ──────────────────────────────────────────────────

/**
 * GET /checkin/questions
 * List active questions for the current user, ordered by position
 */
exports.listQuestions = async (req, res, next) => {
  try {
    const questions = await prisma.checkinQuestion.findMany({
      where: { user_id: req.user.id, is_active: true },
      orderBy: { order: 'asc' },
    })
    res.json(questions)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /checkin/questions/search
 * Search for questions (active and inactive) by label - for autocomplete
 * Query: ?q=termo (optional)
 */
exports.searchQuestions = async (req, res, next) => {
  try {
    const { q } = req.query
    const where = { user_id: req.user.id }
    
    if (q) {
      where.label = { contains: q, mode: 'insensitive' }
    }

    const questions = await prisma.checkinQuestion.findMany({
      where,
      orderBy: { label: 'asc' },
      select: {
        id: true,
        label: true,
        field_type: true,
        unit: true,
        is_active: true,
      },
    })

    res.json(questions)
  } catch (error) {
    next(error)
  }
}

/**
 * PATCH /checkin/questions/:id/activate
 * Activate a previously deactivated question
 */
exports.activateQuestion = async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    // Check if question exists and belongs to user
    const question = await prisma.checkinQuestion.findUnique({
      where: { id },
    })

    if (!question || question.user_id !== userId) {
      return res.status(404).json({ error: 'Pergunta não encontrada' })
    }

    if (question.is_active) {
      return res.status(400).json({ 
        error: 'Esta pergunta já está ativa',
        question,
      })
    }

    const updated = await prisma.checkinQuestion.update({
      where: { id },
      data: { is_active: true },
    })

    res.json({
      message: 'Pergunta ativada com sucesso',
      question: updated,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * POST /checkin/questions
 * Create a new question for the current user
 * Body: { label: string, field_type: 'number'|'text'|'boolean'|'scale', unit?: string }
 */
exports.createQuestion = async (req, res, next) => {
  try {
    const { label, field_type, unit } = req.body

    // Get current count to assign order
    const count = await prisma.checkinQuestion.count({
      where: { user_id: req.user.id },
    })

    const question = await prisma.checkinQuestion.create({
      data: {
        user_id: req.user.id,
        label,
        field_type,
        unit: unit || null,
        order: count + 1,
      },
    })

    res.status(201).json(question)
  } catch (error) {
    next(error)
  }
}

/**
 * PATCH /checkin/questions/:id
 * Edit label and/or unit of a question
 * Body: { label?: string, unit?: string }
 */
exports.updateQuestion = async (req, res, next) => {
  try {
    const { id } = req.params
    const { label, unit } = req.body

    const question = await prisma.checkinQuestion.update({
      where: { id, user_id: req.user.id },
      data: {
        ...(label !== undefined && { label }),
        ...(unit !== undefined && { unit }),
      },
    })

    res.json(question)
  } catch (error) {
    next(error)
  }
}

/**
 * DELETE /checkin/questions/:id
 * Soft delete (deactivate) a question
 * Responses are preserved in history
 */
exports.deactivateQuestion = async (req, res, next) => {
  try {
    const { id } = req.params

    await prisma.checkinQuestion.update({
      where: { id, user_id: req.user.id },
      data: { is_active: false },
    })

    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
}

/**
 * PATCH /checkin/questions/reorder
 * Reorder questions by updating their order field
 * Body: [{ id: string, order: number }]
 */
exports.reorderQuestions = async (req, res, next) => {
  try {
    const updates = req.body

    await prisma.$transaction(
      updates.map(({ id, order }) =>
        prisma.checkinQuestion.update({
          where: { id, user_id: req.user.id },
          data: { order },
        })
      )
    )

    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
}

// ─── Daily Check-in ───────────────────────────────────────────────────────

/**
 * GET /checkin/entries/:date
 * Get check-in entry for a specific date (YYYY-MM-DD)
 */
exports.getEntry = async (req, res, next) => {
  try {
    const { date } = req.params
    const parsedDate = new Date(date)

    const entry = await prisma.checkinEntry.findUnique({
      where: {
        user_id_date: {
          user_id: req.user.id,
          date: parsedDate,
        },
      },
      include: {
        answers: {
          include: { question: true },
          orderBy: { question: { order: 'asc' } },
        },
      },
    })

    res.json(entry ?? null)
  } catch (error) {
    next(error)
  }
}

/**
 * POST /checkin/entries
 * Create or update check-in entry for a date
 * Body: {
 *   date: string (YYYY-MM-DD),
 *   notes?: string,
 *   answers: [{ question_id: string, value: number|string|boolean }]
 * }
 */
exports.saveEntry = async (req, res, next) => {
  try {
    const { date, notes, answers } = req.body
    const parsedDate = new Date(date)

    // Fetch question types to map values to correct columns
    const questions = await prisma.checkinQuestion.findMany({
      where: {
        id: { in: answers.map(a => a.question_id) },
        user_id: req.user.id,
      },
    })

    const typeMap = Object.fromEntries(
      questions.map(q => [q.id, q.field_type])
    )

    // Create or update entry
    const entry = await prisma.checkinEntry.upsert({
      where: {
        user_id_date: {
          user_id: req.user.id,
          date: parsedDate,
        },
      },
      create: {
        user_id: req.user.id,
        date: parsedDate,
        notes: notes || null,
      },
      update: {
        notes: notes || null,
      },
    })

    // Upsert answers
    await prisma.$transaction(
      answers.map(({ question_id, value }) => {
        const type = typeMap[question_id]
        const valueData = {
          value_number: type === 'number' && value !== null && value !== undefined && value !== '' ? Number(value) : null,
          value_text: type === 'text' && value !== null && value !== undefined ? String(value) : null,
          value_boolean: type === 'boolean' && value !== null && value !== undefined ? Boolean(value) : null,
          value_scale: type === 'scale' && value !== null && value !== undefined && value !== '' ? Number(value) : null,
          value_time: type === 'time' && value !== null && value !== undefined && value !== '' ? String(value) : null,
        }

        return prisma.checkinAnswer.upsert({
          where: {
            entry_id_question_id: {
              entry_id: entry.id,
              question_id,
            },
          },
          create: {
            entry_id: entry.id,
            question_id,
            ...valueData,
          },
          update: valueData,
        })
      })
    )

    // Return entry with answers
    const updatedEntry = await prisma.checkinEntry.findUnique({
      where: {
        user_id_date: {
          user_id: req.user.id,
          date: parsedDate,
        },
      },
      include: {
        answers: {
          include: { question: true },
          orderBy: { question: { order: 'asc' } },
        },
      },
    })

    res.json(updatedEntry)
  } catch (error) {
    next(error)
  }
}

/**
 * DELETE /checkin/entries/:id
 * Delete a check-in entry
 */
exports.deleteEntry = async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    // Verify the entry belongs to the user before deleting
    const entry = await prisma.checkinEntry.findFirst({
      where: { id, user_id: userId },
    })

    if (!entry) {
      return res.status(404).json({ error: 'Check-in não encontrado' })
    }

    // Delete the entry (this will cascade delete answers due to onDelete: Cascade)
    await prisma.checkinEntry.delete({
      where: { id },
    })

    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
}

// ─── Evolution/History ────────────────────────────────────────────────────

/**
 * GET /checkin/questions/:id/evolution
 * Get evolution/history of all responses for a specific question
 * Returns array of { date, value, entry_id } ordered by date descending
 */
exports.getQuestionEvolution = async (req, res, next) => {
  try {
    const { id: questionId } = req.params
    const userId = req.user.id

    // Verify the question belongs to the user
    const question = await prisma.checkinQuestion.findUnique({
      where: { id: questionId },
    })

    if (!question || question.user_id !== userId) {
      return res.status(404).json({ error: 'Pergunta não encontrada' })
    }

    // Get all answers for this question, ordered by date descending
    const answers = await prisma.checkinAnswer.findMany({
      where: {
        question_id: questionId,
        entry: { user_id: userId },
      },
      include: {
        entry: {
          select: { date: true },
        },
      },
      orderBy: {
        entry: { date: 'desc' },
      },
    })

    // Format response: extract the value based on field type and include date
    const evolution = answers.map(answer => {
      let value
      switch (question.field_type) {
        case 'number':
          value = answer.value_number ? Number(answer.value_number) : null
          break
        case 'text':
          value = answer.value_text
          break
        case 'boolean':
          value = answer.value_boolean
          break
        case 'scale':
          value = answer.value_scale
          break
        case 'time':
          value = answer.value_time
          break
        default:
          value = null
      }

      return {
        date: answer.entry.date,
        value,
        answer_id: answer.id,
      }
    })

    res.json({
      question: {
        id: question.id,
        label: question.label,
        field_type: question.field_type,
        unit: question.unit,
      },
      evolution,
      total_entries: evolution.length,
    })
  } catch (error) {
    next(error)
  }
}
