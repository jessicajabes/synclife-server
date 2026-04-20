const exerciseService = require('../services/exercise.service')

const listExercises = async (req, res, next) => {
  try {
    const { muscleGroupId } = req.query
    const exercises = await exerciseService.listExercises(req.user.id, { muscleGroupId })
    return res.status(200).json({ data: exercises, error: null, message: null })
  } catch (err) {
    next(err)
  }
}

const getExercise = async (req, res, next) => {
  try {
    const exercise = await exerciseService.getExerciseById(req.params.id, req.user.id)
    return res.status(200).json({ data: exercise, error: null, message: null })
  } catch (err) {
    next(err)
  }
}

const createExercise = async (req, res, next) => {
  try {
    const { id, name, muscleGroupIds, youtubeUrl, notes, isGlobal } = req.body
    const exercise = await exerciseService.createExercise(
      { id, name, muscleGroupIds, youtubeUrl, notes, isGlobal },
      req.user.id
    )
    return res.status(201).json({ data: exercise, error: null, message: 'Exercício criado com sucesso' })
  } catch (err) {
    next(err)
  }
}

const updateExercise = async (req, res, next) => {
  try {
    const exercise = await exerciseService.updateExercise(req.params.id, req.body, req.user.id)
    return res.status(200).json({ data: exercise, error: null, message: 'Exercício atualizado com sucesso' })
  } catch (err) {
    next(err)
  }
}

const deleteExercise = async (req, res, next) => {
  try {
    await exerciseService.deleteExercise(req.params.id, req.user.id)
    return res.status(200).json({ data: null, error: null, message: 'Exercício excluído com sucesso' })
  } catch (err) {
    next(err)
  }
}

const listMuscleGroups = async (req, res, next) => {
  try {
    const groups = await exerciseService.listMuscleGroups()
    return res.status(200).json({ data: groups, error: null, message: null })
  } catch (err) {
    next(err)
  }
}

module.exports = { listExercises, getExercise, createExercise, updateExercise, deleteExercise, listMuscleGroups }
