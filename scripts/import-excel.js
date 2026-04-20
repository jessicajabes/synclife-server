#!/usr/bin/env node
/**
 * SyncLife – Script de Importação da Planilha Excel
 *
 * Uso: node scripts/import-excel.js <caminho-do-xlsx> [email-do-usuario]
 *
 * Idempotente: pode rodar múltiplas vezes sem duplicar dados.
 * Exercícios são identificados por nome (case-insensitive, sem acentos).
 * Templates são identificados por nome.
 * Sessões são identificadas por (studentId, templateId, date).
 */

require('dotenv').config()
const path = require('path')
const XLSX = require('xlsx')
const { v4: uuidv4 } = require('uuid')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// ── Configuração ──────────────────────────────────────────────────────────────

const XLSX_PATH = process.argv[2] || path.join(__dirname, '../../2026_Controle_de_Carga Jessica Jabes.xlsx')
const USER_EMAIL = process.argv[3] || null

// Mapeamento de título de seção → grupos musculares [primário, ...secundários]
const SECTION_MUSCLE_MAP = {
  'posterior': ['Posterior', 'Glúteos'],
  'glúteos': ['Glúteos', 'Posterior'],
  'gluteos': ['Glúteos', 'Posterior'],
  'quadríceps': ['Quadríceps', 'Glúteos'],
  'quadriceps': ['Quadríceps', 'Glúteos'],
  'ombros': ['Ombros'],
  'peito': ['Peito'],
  'triceps': ['Tríceps'],
  'tríceps': ['Tríceps'],
  'costas': ['Costas'],
  'bíceps': ['Bíceps'],
  'biceps': ['Bíceps'],
  'core': ['Core'],
  'abdominal': ['Core'],
  'perna': ['Quadríceps', 'Glúteos', 'Posterior'],
}

// Sufixo de mesociclo por aba
const SHEET_MESO_SUFFIX = {
  '1': 'Ciclo 1',
  '2': 'Ciclo 2',
  '3': 'Ciclo 3',
  '4': 'Ciclo 4',
  '5': 'Ciclo 5',
}

/** Gera o nome do template: "Posterior/Glúteos – Ciclo 1" */
const makeTemplateName = (sectionTitle, sheetName) => {
  const suffix = SHEET_MESO_SUFFIX[sheetName] || `Ciclo ${sheetName}`
  return `${sectionTitle} – ${suffix}`
}

// ── Utilitários ───────────────────────────────────────────────────────────────

const normalize = (str) =>
  str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim()

const log = {
  info: (msg) => console.log('  ✓', msg),
  warn: (msg) => console.log('  ⚠', msg),
  skip: (msg) => console.log('  –', msg),
  error: (msg) => console.log('  ✗', msg),
  section: (msg) => console.log('\n' + '─'.repeat(60) + '\n' + msg),
}

/** Converte serial de data do Excel para objeto Date */
const excelDateToJs = (serial) => {
  if (typeof serial !== 'number') return null
  const msFromEpoch = (serial - 25569) * 86400 * 1000
  return new Date(msFromEpoch)
}

/** Determina quais colunas pertencem a cada semana com base nas linhas 1 e 2 */
const buildColumnMap = (data) => {
  // row1[i] = "Semana N" → marca início de semana
  // row2[i] = "Série N"  → marca início de série (Peso em i, Reps em i+1)
  const weekCols = {} // weekNum → colIndex de início
  const seriesMap = [] // [{week, series, pesoCol, repsCol}]

  const row1 = data[0] || []
  const row2 = data[1] || []

  row1.forEach((v, i) => {
    const m = String(v).match(/Semana\s*(\d+)/i)
    if (m) weekCols[parseInt(m[1])] = i
  })

  const weekNums = Object.keys(weekCols).map(Number).sort((a, b) => a - b)

  row2.forEach((v, i) => {
    if (!String(v).match(/Série/i)) return
    // encontrar a qual semana pertence
    for (let w = weekNums.length - 1; w >= 0; w--) {
      if (i >= weekCols[weekNums[w]]) {
        seriesMap.push({ week: weekNums[w], pesoCol: i, repsCol: i + 1 })
        break
      }
    }
  })

  return seriesMap
}

/** Detecta se a linha é um separador de seção (não um exercício) */
const isSectionHeader = (row) => {
  const colA = String(row[0] || '').trim()
  const colD = String(row[3] || '').trim()
  if (!colA) return false
  // Seção: tem texto em A, mas D está vazio ou é "REPETIÇÕES"
  return !colD || /^REPETI[ÇC]/.test(colD)
}

/** Detecta se a linha é uma instrução geral (ex: "FALHAR SOMENTE NA ULTIMA") */
const isInstructionRow = (row) => {
  const colA = String(row[0] || '').trim()
  const colD = String(row[3] || '').trim()
  if (!colA || colD) return false
  // Tem texto longo em A sem prescrição
  return colA.length > 40 && !colA.match(/^\d/)
}

/**
 * Parseia o texto de prescrição e retorna array de sets.
 * Ex: "AQUECIMENTO 1x12-15   2x7-9" → [{type:warmup,qty:1,range:"12-15"},{type:working,qty:2,range:"7-9"}]
 */
const parsePrescription = (text) => {
  if (!text || !text.trim()) return []
  let cleaned = text.trim()
  const sets = []

  let firstIsWarmup = false

  // Padrão "AQUECIMENTO + NxReps ..." — aquecimento genérico sem especificação
  if (/AQUECIMENTO\s*\+/i.test(cleaned)) {
    sets.push({ type: 'warmup', quantity: 1, repsRange: '12-15', repsLabel: '12-15' })
    cleaned = cleaned.replace(/AQUECIMENTO\s*\+/i, '').trim()
  } else if (/AQUECIMENTO/i.test(cleaned)) {
    // Primeiro NxReps será warmup
    firstIsWarmup = true
    cleaned = cleaned.replace(/AQUECIMENTO/i, '').trim()
  }

  // Captura padrões de séries: NxReps(optional_rest_pause)
  // Exemplos: "2x7-9", "1x12-15", "1x4+4+4+4 (20'' pausa)", "3xMax", "2x30"
  const setPattern = /(\d+)x([\d\-+]+[^,\s()]*?)(?:\s*\((\d+)['"'']\s*pausa\))?(?=\s|$|,)/gi
  let match
  let isFirst = true

  while ((match = setPattern.exec(cleaned)) !== null) {
    const quantity = parseInt(match[1])
    const repsRange = match[2].trim()
    const restSeconds = match[3] ? parseInt(match[3]) : undefined
    const type = firstIsWarmup && isFirst ? 'warmup' : 'working'

    sets.push({
      type,
      quantity,
      repsRange,
      ...(restSeconds !== undefined && { restSeconds }),
    })
    isFirst = false
  }

  // Fallback: se não parsear nada mas tem texto
  if (sets.length === 0 && cleaned.trim()) {
    sets.push({ type: 'working', quantity: 1, repsRange: cleaned.replace(/[^\d\-+xX]/g, '') || '??' })
  }

  return sets
}

/** Determina grupos musculares com base no título da seção */
const getMuscleGroupsForSection = (sectionTitle, muscleGroupsByName) => {
  const title = normalize(sectionTitle)
  const result = []

  for (const [key, names] of Object.entries(SECTION_MUSCLE_MAP)) {
    if (title.includes(key)) {
      for (const name of names) {
        const mg = muscleGroupsByName[name]
        if (mg && !result.find((r) => r.id === mg.id)) {
          result.push(mg)
        }
      }
    }
  }

  // Fallback: "Core" para exercícios não mapeados
  if (result.length === 0) {
    const core = muscleGroupsByName['Core']
    if (core) result.push(core)
  }

  return result
}

// ── Parser de sheet ───────────────────────────────────────────────────────────

/**
 * Parseia uma sheet e retorna:
 * { sections: [{title, exercises: [{name, prescription, sets, rowIndex}]}], columnMap }
 */
const parseSheet = (sheetName, wb) => {
  const ws = wb.Sheets[sheetName]
  if (!ws) return null

  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const columnMap = buildColumnMap(data)

  const sections = []
  let currentSection = null
  let exerciseOrder = 0

  for (let i = 2; i < data.length; i++) {
    const row = data[i]
    const colA = String(row[0] || '').trim()
    const colD = String(row[3] || '').trim()

    // Linha vazia
    if (!colA) continue

    // Instrução geral (ex: "FALHAR SOMENTE NA ULTIMA")
    if (isInstructionRow(row)) continue

    // Seção
    if (isSectionHeader(row)) {
      currentSection = { title: colA, exercises: [] }
      sections.push(currentSection)
      exerciseOrder = 0
      continue
    }

    // Exercício (tem prescrição em col D)
    if (!currentSection) {
      // Exercício antes de qualquer seção — criar seção genérica
      currentSection = { title: 'Geral', exercises: [] }
      sections.push(currentSection)
    }

    const sets = parsePrescription(colD)

    // Coletar dados históricos por semana
    const weeklyData = {}
    for (const col of columnMap) {
      const peso = row[col.pesoCol]
      const reps = row[col.repsCol]
      if (
        (typeof peso === 'number' && peso > 0) ||
        (typeof reps === 'number' && reps > 0)
      ) {
        if (!weeklyData[col.week]) weeklyData[col.week] = []
        weeklyData[col.week].push({
          pesoCol: col.pesoCol,
          repsCol: col.repsCol,
          weight: typeof peso === 'number' ? peso : 0,
          reps: typeof reps === 'number' ? reps : 0,
        })
      }
    }

    currentSection.exercises.push({
      name: colA,
      prescriptionText: colD,
      sets,
      order: exerciseOrder++,
      weeklyData,
      rowIndex: i + 1,
    })
  }

  return { sections, columnMap }
}

// ── Importação ────────────────────────────────────────────────────────────────

const importExcel = async () => {
  console.log('\n🏋️  SyncLife – Importação da Planilha Excel')
  console.log('Arquivo:', XLSX_PATH)

  // 1. Carregar planilha
  let wb
  try {
    wb = XLSX.readFile(XLSX_PATH)
  } catch (err) {
    console.error('❌ Erro ao ler o arquivo:', err.message)
    process.exit(1)
  }

  const skippedSheets = ['Check-in']
  const workoutSheets = wb.SheetNames.filter((n) => !skippedSheets.includes(n))
  console.log('Abas de treino encontradas:', workoutSheets.join(', '))

  // 2. Encontrar usuário
  log.section('Buscando usuário')
  let user
  if (USER_EMAIL) {
    user = await prisma.user.findUnique({ where: { email: USER_EMAIL } })
  } else {
    user = await prisma.user.findFirst({ orderBy: { created_at: 'asc' } })
  }
  if (!user) {
    console.error('❌ Nenhum usuário encontrado. Faça o cadastro primeiro via app ou API.')
    process.exit(1)
  }
  log.info(`Usuário: ${user.name} (${user.email})`)

  // 3. Carregar grupos musculares
  log.section('Carregando grupos musculares')
  const allMuscleGroups = await prisma.muscleGroup.findMany()
  const muscleGroupsByName = {}
  for (const mg of allMuscleGroups) {
    muscleGroupsByName[mg.name] = mg
  }
  log.info(`${allMuscleGroups.length} grupos encontrados: ${allMuscleGroups.map((m) => m.name).join(', ')}`)

  // 4. Carregar exercícios existentes (para idempotência)
  const existingExercises = await prisma.exercise.findMany({
    include: { muscleGroups: { include: { muscleGroup: true } } },
  })
  const exerciseByName = {}
  for (const ex of existingExercises) {
    exerciseByName[normalize(ex.name)] = ex
  }

  // 5. Carregar templates existentes (para idempotência)
  const existingTemplates = await prisma.workoutTemplate.findMany()
  const templateByName = {}
  for (const t of existingTemplates) {
    templateByName[normalize(t.name)] = t
  }

  // 6. Processar cada sheet
  const stats = {
    exercisesCreated: 0,
    exercisesSkipped: 0,
    templatesCreated: 0,
    templatesSkipped: 0,
    sessionsCreated: 0,
    sessionsSkipped: 0,
    warnings: [],
  }

  for (const sheetName of workoutSheets) {
    log.section(`Aba ${sheetName}`)

    const parsed = parseSheet(sheetName, wb)
    if (!parsed) {
      log.warn(`Não foi possível parsear a aba ${sheetName}`)
      continue
    }

    const { sections, columnMap } = parsed

    // ── 6a. Criar/buscar exercícios (para todas as seções da aba) ─────────────
    console.log('\n  [Exercícios]')
    const exerciseIdMap = {} // normalizedName → exerciseId

    for (const section of sections) {
      const sectionMuscleGroups = getMuscleGroupsForSection(section.title, muscleGroupsByName)

      for (const ex of section.exercises) {
        const key = normalize(ex.name)

        if (exerciseByName[key]) {
          log.skip(`Já existe: "${ex.name}"`)
          exerciseIdMap[key] = exerciseByName[key].id
          stats.exercisesSkipped++
          continue
        }

        const mgs = sectionMuscleGroups.length > 0
          ? sectionMuscleGroups
          : [allMuscleGroups[0]]

        if (sectionMuscleGroups.length === 0) {
          log.warn(`Sem grupo muscular para "${ex.name}" (seção: "${section.title}")`)
          stats.warnings.push(`Sem grupo muscular: "${ex.name}"`)
        }

        try {
          const id = uuidv4()
          const created = await prisma.exercise.create({
            data: {
              id,
              name: ex.name,
              is_global: false,
              created_by_id: user.id,
              muscleGroups: {
                create: mgs.map((mg, idx) => ({
                  muscle_group_id: mg.id,
                  order: idx,
                })),
              },
            },
          })
          exerciseByName[key] = created
          exerciseIdMap[key] = created.id
          log.info(`Criado: "${ex.name}" [${mgs.map((m) => m.name).join(', ')}]`)
          stats.exercisesCreated++
        } catch (err) {
          log.error(`Erro ao criar "${ex.name}": ${err.message}`)
          stats.warnings.push(`Erro ao criar exercício "${ex.name}": ${err.message}`)
        }
      }
    }

    // ── 6b. Criar um template por seção ──────────────────────────────────────
    const sheetIndex = workoutSheets.indexOf(sheetName)
    const baseDate = new Date('2025-01-06')
    baseDate.setDate(baseDate.getDate() + sheetIndex * 10 * 7) // ~10 semanas por aba

    for (const section of sections) {
      const templateName = makeTemplateName(section.title, sheetName)
      console.log(`\n  [Template] "${templateName}"`)

      let template = templateByName[normalize(templateName)]

      if (template) {
        log.skip(`Já existe: "${templateName}"`)
        stats.templatesSkipped++
      } else {
        const templateExercises = []
        let order = 0

        for (const ex of section.exercises) {
          const key = normalize(ex.name)
          const exerciseId = exerciseIdMap[key]
          if (!exerciseId) continue

          const sets = ex.sets.length > 0
            ? ex.sets
            : [{ type: 'working', quantity: 3, repsRange: '8-12' }]

          templateExercises.push({
            id: uuidv4(),
            exerciseId,
            order: order++,
            sectionTitle: null, // cada template já É a seção — sem sub-títulos
            defaultRestSeconds: 60,
            sets: sets.map((s) => ({
              id: uuidv4(),
              type: s.type,
              quantity: s.quantity,
              repsRange: s.repsRange,
              ...(s.restSeconds !== undefined && { rest_seconds: s.restSeconds }),
            })),
          })
        }

        if (templateExercises.length === 0) {
          log.warn(`Template "${templateName}" ficou vazio — pulando`)
          stats.warnings.push(`Template "${templateName}" sem exercícios válidos`)
          continue
        }

        try {
          template = await prisma.$transaction(async (tx) => {
            const t = await tx.workoutTemplate.create({
              data: {
                id: uuidv4(),
                name: templateName,
                student_id: user.id,
                created_by_id: user.id,
                version: 1,
              },
            })

            for (const ex of templateExercises) {
              await tx.templateExercise.create({
                data: {
                  id: ex.id,
                  template_id: t.id,
                  exercise_id: ex.exerciseId,
                  order: ex.order,
                  section_title: ex.sectionTitle,
                  default_rest_seconds: ex.defaultRestSeconds,
                  notes: null,
                  sets: {
                    create: ex.sets.map((s) => ({
                      id: s.id,
                      type: s.type,
                      quantity: s.quantity,
                      reps_range: s.repsRange,
                      rest_seconds: s.rest_seconds ?? null,
                    })),
                  },
                },
              })
            }

            return t
          })

          templateByName[normalize(templateName)] = template
          log.info(`Criado com ${templateExercises.length} exercício(s)`)
          stats.templatesCreated++
        } catch (err) {
          log.error(`Erro ao criar template "${templateName}": ${err.message}`)
          stats.warnings.push(`Erro ao criar template: ${err.message}`)
          continue
        }
      }

      // ── 6c. Importar sessões históricas desta seção ───────────────────────
      // Coletar semanas com dados nos exercícios DESTA seção
      const weeksWithData = new Set()
      for (const ex of section.exercises) {
        for (const week of Object.keys(ex.weeklyData)) {
          weeksWithData.add(parseInt(week))
        }
      }

      if (weeksWithData.size === 0) {
        log.skip('Sem histórico')
        continue
      }

      for (const weekNum of [...weeksWithData].sort((a, b) => a - b)) {
        const sessionDate = new Date(baseDate)
        sessionDate.setDate(sessionDate.getDate() + (weekNum - 1) * 7)
        const dateStr = sessionDate.toISOString().slice(0, 10)

        const existing = await prisma.workoutSession.findFirst({
          where: {
            student_id: user.id,
            workout_template_id: template.id,
            date: new Date(dateStr),
          },
        })

        if (existing) {
          log.skip(`Sessão semana ${weekNum} (${dateStr}) já existe`)
          stats.sessionsSkipped++
          continue
        }

        // Exercícios desta seção com dados na semana
        const exerciseLogs = []
        for (const ex of section.exercises) {
          const key = normalize(ex.name)
          const exerciseId = exerciseIdMap[key]
          if (!exerciseId) continue

          const weekData = ex.weeklyData[weekNum]
          if (!weekData || weekData.length === 0) continue

          exerciseLogs.push({
            id: uuidv4(),
            exercise_id: exerciseId,
            sets: weekData.map((d, idx) => ({
              id: uuidv4(),
              set_number: idx + 1,
              type: ex.sets[idx]?.type || 'working',
              weight: d.weight,
              reps: d.reps,
            })),
          })
        }

        if (exerciseLogs.length === 0) continue

        const totalVolume = exerciseLogs.reduce((acc, log) => {
          return acc + log.sets
            .filter((s) => s.type === 'working')
            .reduce((a, s) => a + s.weight * s.reps, 0)
        }, 0)

        try {
          await prisma.$transaction(async (tx) => {
            const session = await tx.workoutSession.create({
              data: {
                id: uuidv4(),
                student_id: user.id,
                workout_template_id: template.id,
                template_version: template.version,
                date: new Date(dateStr),
                status: 'completed',
                total_volume: totalVolume,
                sync_status: 'synced',
              },
            })

            for (const log of exerciseLogs) {
              await tx.sessionExerciseLog.create({
                data: {
                  id: log.id,
                  session_id: session.id,
                  exercise_id: log.exercise_id,
                  sets: { create: log.sets },
                },
              })
            }
          })

          log.info(`Sessão semana ${weekNum} (${dateStr}): ${exerciseLogs.length} ex, ${totalVolume.toFixed(0)}kg`)
          stats.sessionsCreated++
        } catch (err) {
          log.error(`Erro sessão semana ${weekNum}: ${err.message}`)
          stats.warnings.push(`Erro sessão semana ${weekNum} (${templateName}): ${err.message}`)
        }
      }
    }
  }

  // 7. Relatório final
  console.log('\n' + '═'.repeat(60))
  console.log('✅ Importação concluída!')
  console.log(`   Exercícios criados:  ${stats.exercisesCreated}`)
  console.log(`   Exercícios pulados:  ${stats.exercisesSkipped} (já existiam)`)
  console.log(`   Templates criados:   ${stats.templatesCreated}`)
  console.log(`   Templates pulados:   ${stats.templatesSkipped} (já existiam)`)
  console.log(`   Sessões criadas:     ${stats.sessionsCreated}`)
  console.log(`   Sessões puladas:     ${stats.sessionsSkipped} (já existiam)`)

  if (stats.warnings.length > 0) {
    console.log(`\n⚠  ${stats.warnings.length} aviso(s) para revisão manual:`)
    stats.warnings.forEach((w, i) => console.log(`   ${i + 1}. ${w}`))
  }
  console.log('')
}

// ── Entry point ───────────────────────────────────────────────────────────────

importExcel()
  .catch((err) => {
    console.error('\n❌ Erro fatal:', err.message)
    if (process.env.NODE_ENV !== 'production') console.error(err.stack)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
