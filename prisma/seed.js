const { PrismaClient } = require('@prisma/client')
const { v4: uuidv4 } = require('uuid')

const prisma = new PrismaClient()

const MUSCLE_GROUPS = [
  'Quadríceps',
  'Glúteos',
  'Posterior',
  'Peito',
  'Costas',
  'Ombros',
  'Bíceps',
  'Tríceps',
  'Core',
]

const seed = async () => {
  console.log('🌱 Iniciando seed...')

  for (const name of MUSCLE_GROUPS) {
    await prisma.muscleGroup.upsert({
      where: { name },
      update: {},
      create: { id: uuidv4(), name },
    })
    console.log(`  ✓ ${name}`)
  }

  console.log('✅ Seed concluído.')
}

seed()
  .catch((err) => {
    console.error('❌ Erro no seed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
