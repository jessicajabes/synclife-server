const workoutTemplateService = require('../services/workout-template.service')

const listTemplates = async (req, res, next) => {
  try {
    const templates = await workoutTemplateService.listTemplates(req.user.id)
    return res.status(200).json({ data: templates, error: null, message: null })
  } catch (err) {
    next(err)
  }
}

const getTemplate = async (req, res, next) => {
  try {
    const template = await workoutTemplateService.getTemplateById(req.params.id, req.user.id)
    return res.status(200).json({ data: template, error: null, message: null })
  } catch (err) {
    next(err)
  }
}

const createTemplate = async (req, res, next) => {
  try {
    const { id, name, exercises } = req.body
    const template = await workoutTemplateService.createTemplate({ id, name, exercises }, req.user.id)
    return res.status(201).json({ data: template, error: null, message: 'Template criado com sucesso' })
  } catch (err) {
    next(err)
  }
}

const updateTemplate = async (req, res, next) => {
  try {
    const template = await workoutTemplateService.updateTemplate(req.params.id, req.body, req.user.id)
    return res.status(200).json({ data: template, error: null, message: 'Template atualizado com sucesso' })
  } catch (err) {
    next(err)
  }
}

const deleteTemplate = async (req, res, next) => {
  try {
    await workoutTemplateService.deleteTemplate(req.params.id, req.user.id)
    return res.status(200).json({ data: null, error: null, message: 'Template excluído com sucesso' })
  } catch (err) {
    next(err)
  }
}

module.exports = { listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate }
