const trainingPlanService = require('../services/training-plan.service')

const listPlans = async (req, res, next) => {
  try {
    const plans = await trainingPlanService.listPlans(req.user.id)
    return res.status(200).json({ data: plans, error: null, message: null })
  } catch (err) {
    next(err)
  }
}

const getPlan = async (req, res, next) => {
  try {
    const plan = await trainingPlanService.getPlanById(req.params.id, req.user.id)
    return res.status(200).json({ data: plan, error: null, message: null })
  } catch (err) {
    next(err)
  }
}

const createPlan = async (req, res, next) => {
  try {
    const { id, name, mode, weekMap, sequence, startDate, endDate } = req.body
    const plan = await trainingPlanService.createPlan(
      { id, name, mode, weekMap, sequence, startDate, endDate },
      req.user.id
    )
    return res.status(201).json({ data: plan, error: null, message: 'Plano criado com sucesso' })
  } catch (err) {
    next(err)
  }
}

const updatePlan = async (req, res, next) => {
  try {
    const plan = await trainingPlanService.updatePlan(req.params.id, req.body, req.user.id)
    return res.status(200).json({ data: plan, error: null, message: 'Plano atualizado com sucesso' })
  } catch (err) {
    next(err)
  }
}

const deletePlan = async (req, res, next) => {
  try {
    await trainingPlanService.deletePlan(req.params.id, req.user.id)
    return res.status(200).json({ data: null, error: null, message: 'Plano excluído com sucesso' })
  } catch (err) {
    next(err)
  }
}

module.exports = { listPlans, getPlan, createPlan, updatePlan, deletePlan }
