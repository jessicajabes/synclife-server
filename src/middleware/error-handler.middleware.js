const { Prisma } = require('@prisma/client')
const logger = require('../config/logger')

const errorHandler = (err, req, res, next) => {
  // Erros de validação do express-validator (lançados pelo validate.middleware)
  if (err.type === 'validation') {
    return res.status(422).json({
      data: null,
      error: 'Dados inválidos',
      message: 'Dados inválidos',
      details: err.details,
    })
  }

  // Erros do Prisma
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        data: null,
        error: 'Já existe um registro com esses dados',
        message: 'Já existe um registro com esses dados',
      })
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        data: null,
        error: 'Registro não encontrado',
        message: 'Registro não encontrado',
      })
    }
  }

  // Erros de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      data: null,
      error: 'Token inválido',
      message: 'Token inválido',
    })
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      data: null,
      error: 'Token expirado',
      message: 'Token expirado',
    })
  }

  // Erros com statusCode customizado (lançados pelos services)
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      data: null,
      error: err.message,
      message: err.message,
    })
  }

  // Erro genérico — 500
  logger.error('Internal Server Error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  })

  return res.status(500).json({
    data: null,
    error: 'Erro interno do servidor',
    message: 'Erro interno do servidor',
  })
}

module.exports = errorHandler
