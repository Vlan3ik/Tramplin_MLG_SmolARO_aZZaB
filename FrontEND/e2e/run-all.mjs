import { Builder } from 'selenium-webdriver'
import { runCards15252728 } from './cards/cards-15-25-27-28.mjs'
import { runCards2329 } from './cards/cards-23-29.mjs'
import { runCards243037 } from './cards/cards-24-30-37.mjs'
import { runCard35 } from './cards/cards-35.mjs'

function parseArgs(argv) {
  const args = { headed: false }
  for (const token of argv) {
    if (token === '--headed') {
      args.headed = true
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

async function runAll({ headed = false } = {}) {
  const ctx = createContext()
  const driver = await createDriver(headed)
  const results = []

  try {
    results.push(...(await runCards15252728(driver, ctx)))
    results.push(...(await runCards2329(driver, ctx)))
    results.push(...(await runCards243037(driver, ctx)))
    results.push(...(await runCard35(driver, ctx)))
  } finally {
    await driver.quit()
  }

  return results
}

const args = parseArgs(process.argv.slice(2))

runAll(args)
  .then((results) => {
    process.stdout.write(JSON.stringify(results, null, 2))
  })
  .catch((error) => {
    process.stderr.write(String(error))
    process.exit(1)
  })
