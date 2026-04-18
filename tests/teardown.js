const prisma = require('../src/config/database')

module.exports = async () => {
  await prisma.$disconnect()
}
