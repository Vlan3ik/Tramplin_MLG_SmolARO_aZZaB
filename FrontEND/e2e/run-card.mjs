import { Builder } from 'selenium-webdriver'
import { runCards15252728 } from './cards/cards-15-25-27-28.mjs'
import { runCards2329 } from './cards/cards-23-29.mjs'
import { runCards243037 } from './cards/cards-24-30-37.mjs'
import { runCard35 } from './cards/cards-35.mjs'

const GROUP_BY_CARD = new Map([
  ['69c2a0234c1e9059244da671', runCards15252728], // 15
  ['69c52fb83b111828cfae1441', runCards15252728], // 25
  ['69c52fb97250b8c9f9cf4c27', runCards15252728], // 27
  ['69c52fba09ea0bf95a0bbe48', runCards15252728], // 28
  ['69c52fb72ce37e1a6dc6d33d', runCards2329], // 23
  ['69c52fd91a2c6d5aead1677d', runCards2329], // 29
  ['69c52fb8f99889a4672c8aa9', runCards243037], // 24
  ['69c52fda9f209980fb8a5361', runCards243037], // 30
  ['69c664f1a811b67480742739', runCards243037], // 37
  ['35', runCard35], // 35
])

function parseArgs(argv) {
  const args = { cardId: '', headed: false }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--headed') {
      args.headed = true
      continue
    }
    if ((token === '--card' || token === '--card-id') && argv[i + 1]) {
      args.cardId = argv[i + 1]
      i += 1
      continue
    }
    if (!token.startsWith('--') && !args.cardId) {
      args.cardId = token
    }
  }
  return args
}

function createContext() {
  return {
    baseUrl: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    adminEmail: process.env.E2E_ADMIN_EMAIL ?? 'admin@tramplin.local',
    adminPassword: process.env.E2E_ADMIN_PASSWORD ?? 'Admin123!',
    testPassword: process.env.E2E_TEST_PASSWORD ?? 'TestPass123!',
    employerPassword: process.env.E2E_TEST_PASSWORD ?? 'TestPass123!',
    seekerPassword: process.env.E2E_TEST_PASSWORD ?? 'TestPass123!',
    shared: {},
  }
}

async function createDriver(headed) {
  if (!headed) {
    process.env.HEADLESS = '1'
  }
  const driver = await new Builder().forBrowser('chrome').build()
  await driver.manage().window().setRect({ width: 1440, height: 1000, x: 0, y: 0 })
  await driver.manage().setTimeouts({ implicit: 0, pageLoad: 60000, script: 30000 })
  return driver
}

async function runOne(cardId, { headed = false } = {}) {
  const runGroup = GROUP_BY_CARD.get(cardId)
  if (!runGroup) {
    throw new Error(`Unknown card id: ${cardId}`)
  }

  const ctx = createContext()
  const driver = await createDriver(headed)
  try {
    const groupResults = await runGroup(driver, ctx)
    const result = groupResults.find((item) => item.cardId === cardId)
    if (!result) {
      throw new Error(`Card ${cardId} did not return a result`)
    }
    return result
  } finally {
    await driver.quit()
  }
}

const args = parseArgs(process.argv.slice(2))
if (!args.cardId) {
  process.stderr.write('Usage: node ./e2e/run-card.mjs --card <cardId> [--headed]\n')
  process.exit(1)
}

runOne(args.cardId, { headed: args.headed })
  .then((result) => {
    process.stdout.write(JSON.stringify(result, null, 2))
  })
  .catch((error) => {
    process.stderr.write(String(error))
    process.exit(1)
  })
