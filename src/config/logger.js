const winston = require('winston')

const { combine, timestamp, json, colorize, simple } = winston.format

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.File({ filename: 'logs/errors.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: combine(colorize(), simple()),
    })
  )
}

module.exports = logger
