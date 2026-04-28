const { execSync } = require('child_process')

module.exports = async () => {
  // Apontar para banco de teste
  process.env.DATABASE_URL =
    process.env.DATABASE_URL_TEST ||
    'postgresql://sincrolife:sincrolife@localhost:5432/sincrolife_test?schema=public'
  process.env.JWT_SECRET = 'test-secret-key'
  process.env.NODE_ENV = 'test'

  // Aplicar schema no banco de teste
  try {
    execSync('npx prisma db push --force-reset --skip-generate', {
      env: { ...process.env },
      stdio: 'pipe',
    })
  } catch (err) {
    console.error('Erro ao fazer db push no banco de teste:', err.message)
    throw err
  }
}
