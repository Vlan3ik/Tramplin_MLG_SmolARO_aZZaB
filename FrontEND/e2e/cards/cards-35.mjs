import { By, until } from 'selenium-webdriver'

const DEFAULT_BASE_URL = 'http://localhost:5173'
const DEFAULT_ADMIN_EMAIL = 'admin@tramplin.local'
const DEFAULT_ADMIN_PASSWORD = 'Admin123!'
const WAIT_MS = 25000

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

async function waitForVisible(driver, locator, timeout = WAIT_MS) {
  const element = await driver.wait(until.elementLocated(locator), timeout)
  await driver.wait(until.elementIsVisible(element), timeout)
  return element
}

async function clickByText(driver, tag, text) {
  const element = await waitForVisible(
    driver,
    By.xpath(`//${tag}[contains(normalize-space(.), ${JSON.stringify(text)})]`),
  )
  await element.click()
}

async function loginAdmin(driver, ctx) {
  await driver.get(`${ctx.baseUrl}/login`)
  const email = await waitForVisible(driver, By.css('input[name=\"email\"]'))
  const password = await waitForVisible(driver, By.css('input[name=\"password\"]'))
  await email.clear()
  await email.sendKeys(ctx.adminEmail)
  await password.clear()
  await password.sendKeys(ctx.adminPassword)
  await clickByText(driver, 'button', 'Войти')
  await driver.wait(async () => (await driver.getCurrentUrl()).includes('/dashboard'), WAIT_MS)
}

async function testCard35(driver, ctx) {
  const cardId = '35'
  try {
    await loginAdmin(driver, ctx)
    await driver.get(`${ctx.baseUrl}/dashboard/curator/moderation`)
    await clickByText(driver, 'button', 'Companies')

    const hasVerificationControls = await driver.wait(async () => {
      const html = normalizeText(await driver.getPageSource())
      return html.includes('open verification') && html.includes('approve verification')
    }, WAIT_MS)

    if (!hasVerificationControls) {
      return { cardId, status: 'FAIL', details: 'Verification controls are missing on CuratorModerationPage.' }
    }

    return { cardId, status: 'PASS', details: 'Card 35 moderation controls are available in curator flow.' }
  } catch (error) {
    return { cardId, status: 'FAIL', details: `Card 35 e2e failed: ${error instanceof Error ? error.message : String(error)}` }
  }
}

export async function runCard35(driver, ctx = {}) {
  const runtimeCtx = {
    baseUrl: ctx.baseUrl ?? DEFAULT_BASE_URL,
    adminEmail: ctx.adminEmail ?? DEFAULT_ADMIN_EMAIL,
    adminPassword: ctx.adminPassword ?? DEFAULT_ADMIN_PASSWORD,
  }

  return [await testCard35(driver, runtimeCtx)]
}
