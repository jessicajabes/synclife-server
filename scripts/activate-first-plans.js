const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const activateFirstPlans = async () => {
  console.log('🔧 Ativando primeiro plano de cada usuário...')

  try {
    const users = await prisma.user.findMany({
      include: {
        trainingPlans: {
          orderBy: { created_at: 'asc' },
        },
      },
    })

    for (const user of users) {
      if (user.trainingPlans.length === 0) {
        console.log(`  ⊘ Usuário ${user.id} sem planos`)
        continue
      }

      // Mark first plan as active
      const firstPlan = user.trainingPlans[0]
      await prisma.trainingPlan.updateMany({
        where: { student_id: user.id },
        data: { is_active: false },
      })
      
      await prisma.trainingPlan.update({
        where: { id: firstPlan.id },
        data: { is_active: true },
      })

      console.log(`  ✓ Usuário ${user.id}: "${firstPlan.name}" ativado`)
    }

    console.log('✅ Ativação concluída.')
  } catch (err) {
    console.error('❌ Erro:', err)
  } finally {
    await prisma.$disconnect()
  }
}

activateFirstPlans()
