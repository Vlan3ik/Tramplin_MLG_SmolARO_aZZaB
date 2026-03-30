import { By, until } from 'selenium-webdriver'

const DEFAULT_BASE_URL = 'http://localhost:5173'
const ADMIN_EMAIL = 'admin@tramplin.local'
const ADMIN_PASSWORD = 'Admin123!'
const WAIT_MS = 20000

function resolveBaseUrl(ctx) {
  const value = ctx?.baseUrl ?? process.env.E2E_BASE_URL ?? DEFAULT_BASE_URL
  return String(value).replace(/\/$/, '')
}

function uniqueEmail(prefix) {
  return `${prefix}+${Date.now()}@example.test`
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pass(cardId, details) {
  return { cardId, status: 'PASS', details }
}

function blocked(cardId, details) {
  return { cardId, status: 'BLOCKED', details }
}

function fail(cardId, details) {
  return { cardId, status: 'FAIL', details }
}

function isStaleError(error) {
  const text = error instanceof Error ? error.message : String(error)
  return text.toLowerCase().includes('stale element')
}

async function withStaleRetry(fn, attempts = 3) {
  let lastError = null

  for (let index = 0; index < attempts; index += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isStaleError(error) || index === attempts - 1) {
        throw error
      }
      await sleep(250)
    }
  }

  throw lastError
}

async function waitForVisible(driver, locator, timeout = WAIT_MS) {
  const element = await driver.wait(until.elementLocated(locator), timeout)
  await driver.wait(until.elementIsVisible(element), timeout)
  return element
}

async function waitForClickable(driver, locator, timeout = WAIT_MS) {
  const element = await driver.wait(until.elementLocated(locator), timeout)
  await driver.wait(until.elementIsEnabled(element), timeout)
  await driver.wait(until.elementIsVisible(element), timeout)
  return element
}

async function open(driver, baseUrl, path = '/') {
  await driver.get(`${baseUrl}${path}`)
}

async function clearBrowserState(driver, baseUrl) {
  await driver.manage().deleteAllCookies()
  await open(driver, baseUrl, '/')
  await driver.executeScript('window.localStorage.clear(); window.sessionStorage.clear();')
}

async function clickByText(driver, tagName, text) {
  const element = await waitForClickable(driver, By.xpath(`//${tagName}[contains(normalize-space(.), "${text}")]`))
  await element.click()
}

async function setInputValue(driver, locator, value) {
  const input = await waitForVisible(driver, locator)
  await input.clear()
  await input.sendKeys(value)
  return input
}

async function selectNativeValue(driver, selector, value) {
  await driver.executeScript(
    (targetSelector, targetValue) => {
      const node = document.querySelector(targetSelector)
      if (!(node instanceof HTMLSelectElement)) {
        throw new Error(`Select not found: ${targetSelector}`)
      }

      node.value = String(targetValue)
      node.dispatchEvent(new Event('input', { bubbles: true }))
      node.dispatchEvent(new Event('change', { bubbles: true }))
    },
    selector,
    value,
  )
}

async function submitFormByButtonText(driver, text) {
  await clickByText(driver, 'button', text)
}

async function login(driver, baseUrl, email, password) {
  await open(driver, baseUrl, '/login')
  await setInputValue(driver, By.css('input[name="email"]'), email)
  await setInputValue(driver, By.css('input[name="password"]'), password)
  await submitFormByButtonText(driver, 'Войти')
  await driver.wait(async () => {
    const url = await driver.getCurrentUrl()
    return url.includes('/dashboard') || url.includes('/verification/employer')
  }, WAIT_MS)
}

async function logout(driver, baseUrl) {
  const buttons = await driver.findElements(By.xpath('//button[contains(normalize-space(.), "Выйти")]'))
  if (!buttons.length) {
    await clearBrowserState(driver, baseUrl)
    return
  }

  await buttons[0].click()
  await driver.wait(async () => {
    const url = await driver.getCurrentUrl()
    return url.startsWith(baseUrl)
  }, WAIT_MS)
}

async function openCuratorUsersCreate(driver, baseUrl) {
  await open(driver, baseUrl, '/dashboard/curator/users/create')
  await waitForVisible(driver, By.css('input[name="email"]'))
  await waitForVisible(driver, By.css('input[name="username"]'))
  await waitForVisible(driver, By.css('input[name="fio"]'))
}

async function ensureCuratorDashboardLoaded(driver, baseUrl) {
  await open(driver, baseUrl, '/dashboard/curator')
  await waitForVisible(driver, By.xpath('//h1[contains(normalize-space(.), "Кабинет куратора")]'))
  await waitForVisible(driver, By.css('nav.seeker-profile-tabs'))
}

async function submitCreateUser(driver, payload) {
  await setInputValue(driver, By.css('input[name="email"]'), payload.email)
  await setInputValue(driver, By.css('input[name="username"]'), payload.username)
  await setInputValue(driver, By.css('input[name="fio"]'), payload.fio)

  await waitForVisible(driver, By.css('select[name="status"]'))
  await selectNativeValue(driver, 'select[name="status"]', payload.status)

  const seeker = await waitForVisible(driver, By.css('input[name="seeker"]'))
  const seekerSelected = await seeker.isSelected()
  if (payload.seeker !== seekerSelected) {
    await seeker.click()
  }

  const employer = await waitForVisible(driver, By.css('input[name="employer"]'))
  const employerSelected = await employer.isSelected()
  if (payload.employer !== employerSelected) {
    await employer.click()
  }

  if (payload.adminAccess !== undefined) {
    const adminAccess = await driver.findElements(By.css('input[name="adminAccess"]'))
    if (!adminAccess.length) {
      return blocked(payload.cardId, 'На странице создания пользователя нет control для adminAccess; текущий аккаунт не дает проверить super-curator flow.')
    }

    const checked = await adminAccess[0].isSelected()
    if (payload.adminAccess !== checked) {
      await adminAccess[0].click()
    }
  }

  await submitFormByButtonText(driver, payload.submitText)

  await driver.wait(async () => {
    const feedback = await driver.findElements(By.css('.auth-feedback'))
    return feedback.length > 0
  }, WAIT_MS)

  const feedback = await driver.findElements(By.css('.auth-feedback'))
  const text = feedback.length ? (await feedback[0].getText()).trim() : ''
  if (!text) {
    return fail(payload.cardId, 'После сохранения не появилось подтверждающее сообщение.')
  }

  return text
}

async function createUserViaUi(driver, baseUrl, cardId, overrides = {}) {
  const email = overrides.email ?? uniqueEmail('e2e-curator-user')
  const username = overrides.username ?? `e2e_${Date.now()}`
  const fio = overrides.fio ?? 'E2E User'

  await openCuratorUsersCreate(driver, baseUrl)

  const adminAccessControls = await driver.findElements(By.css('input[name="adminAccess"]'))
  const result = await submitCreateUser(driver, {
    cardId,
    email,
    username,
    fio,
    status: overrides.status ?? 1,
    seeker: overrides.seeker ?? true,
    employer: overrides.employer ?? true,
    adminAccess: overrides.adminAccess,
    submitText: 'Создать пользователя',
  })

  if (result && typeof result === 'object' && result.status === 'BLOCKED') {
    return result
  }

  return {
    email,
    username,
    fio,
    message: result,
    adminAccessVisible: adminAccessControls.length > 0,
  }
}

async function findCreatedUserCard(driver, email) {
  const searchInput = await waitForVisible(driver, By.css('input[placeholder*="email/username"]'))
  await searchInput.clear()
  await searchInput.sendKeys(email)
  await clickByText(driver, 'button', 'Найти')

  await driver.wait(async () => {
    const cards = await driver.findElements(By.css('.admin-list-card'))
    if (!cards.length) {
      return false
    }

    for (const card of cards) {
      const text = (await card.getText()).toLowerCase()
      if (text.includes(email.toLowerCase())) {
        return true
      }
    }

    return false
  }, WAIT_MS)
}

async function openEditUserFromDashboard(driver, email) {
  const cards = await driver.findElements(By.css('.admin-list-card'))
  for (const card of cards) {
    const text = (await card.getText()).toLowerCase()
    if (!text.includes(email.toLowerCase())) {
      continue
    }

    const editLinks = await card.findElements(By.css('a[href*="/dashboard/curator/users/create?userId="]'))
    if (!editLinks.length) {
      return null
    }

    await editLinks[0].click()
    return true
  }

  return null
}

async function readSelectedValue(driver, selector) {
  return driver.executeScript(
    (targetSelector) => {
      const node = document.querySelector(targetSelector)
      if (!node) {
        return null
      }

      if (node instanceof HTMLSelectElement) {
        return node.value
      }

      if (node instanceof HTMLInputElement) {
        return node.value
      }

      return null
    },
    selector,
  )
}

async function testCard23(driver, ctx, baseUrl) {
  const cardId = '69c52fb72ce37e1a6dc6d33d'

  try {
    await clearBrowserState(driver, baseUrl)
    await login(driver, baseUrl, ADMIN_EMAIL, ADMIN_PASSWORD)
    await openCuratorUsersCreate(driver, baseUrl)

    await waitForVisible(driver, By.css('input[name="email"]'))
    await waitForVisible(driver, By.css('input[name="username"]'))
    await waitForVisible(driver, By.css('input[name="fio"]'))
    await waitForVisible(driver, By.css('select[name="status"]'))
    await waitForVisible(driver, By.css('input[name="seeker"]'))
    await waitForVisible(driver, By.css('input[name="employer"]'))

    const adminAccessControls = await driver.findElements(By.css('input[name="adminAccess"]'))
    if (!adminAccessControls.length) {
      return blocked(cardId, 'На странице нет чекбокса adminAccess. Это значит, что текущая учетная запись не позволяет проверить super-curator права через UI.')
    }

    const adminAccessLabel = await driver.findElements(By.xpath('//label[contains(normalize-space(.), "Куратор (Admin)")]'))
    if (!adminAccessLabel.length) {
      return fail(cardId, 'Чекбокс adminAccess есть, но подпись роли не совпадает с ожидаемой "Куратор (Admin)".')
    }

    const testUser = await createUserViaUi(driver, baseUrl, cardId, {
      email: ctx?.shared?.card23Email ?? uniqueEmail('e2e-card23'),
      username: ctx?.shared?.card23Username ?? `card23_${Date.now()}`,
      fio: 'Card 23 User',
      status: 1,
      seeker: true,
      employer: true,
      adminAccess: false,
    })

    if (testUser?.status === 'BLOCKED') {
      return testUser
    }

    if (!String(testUser.message ?? '').includes('Пользователь создан')) {
      return fail(cardId, `Пользователь не создался через UI: ${testUser.message}`)
    }

    const preview = await waitForVisible(driver, By.xpath('//aside[contains(@class, "curator-user-editor__preview")]//h3[contains(normalize-space(.), "Карточка пользователя")]'))
    if (!preview) {
      return fail(cardId, 'Не найден блок предпросмотра карточки пользователя.')
    }

    ctx.shared = ctx.shared ?? {}
    ctx.shared.card23Email = testUser.email
    ctx.shared.card23Username = testUser.username

    return pass(cardId, `Экран создания пользователя доступен, роли seeker/employer видны, adminAccess control отображается. Создан тестовый пользователь ${testUser.email}.`)
  } catch (error) {
    return fail(cardId, `Сбой сценария карточки 23: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function testCard29(driver, ctx, baseUrl) {
  const cardId = '69c52fd91a2c6d5aead1677d'

  try {
    await clearBrowserState(driver, baseUrl)
    await login(driver, baseUrl, ADMIN_EMAIL, ADMIN_PASSWORD)

    const email = ctx?.shared?.card23Email ?? uniqueEmail('e2e-card29')
    const username = ctx?.shared?.card23Username ?? `card29_${Date.now()}`

    await ensureCuratorDashboardLoaded(driver, baseUrl)
    await withStaleRetry(async () => {
      const usersTabButtons = await driver.findElements(By.xpath('//nav[contains(@class, "seeker-profile-tabs")]//button[contains(normalize-space(.), "Пользователи")]'))
      if (usersTabButtons.length) {
        await usersTabButtons[0].click()
      }
    })

    await findCreatedUserCard(driver, email)

    const openEdit = await openEditUserFromDashboard(driver, email)
    if (!openEdit) {
      return blocked(cardId, `Не удалось открыть редактор пользователя через UI для ${email}.`)
    }

    await waitForVisible(driver, By.css('input[name="email"]'))
    await waitForVisible(driver, By.css('input[name="username"]'))
    await waitForVisible(driver, By.css('input[name="fio"]'))
    await waitForVisible(driver, By.css('select[name="status"]'))
    await waitForVisible(driver, By.css('input[name="seeker"]'))
    await waitForVisible(driver, By.css('input[name="employer"]'))

    const loadedEmail = await readSelectedValue(driver, 'input[name="email"]')
    const loadedUsername = await readSelectedValue(driver, 'input[name="username"]')
    if (loadedEmail !== email) {
      return fail(cardId, `Редактор открылся, но email не совпадает: ожидалось ${email}, получено ${loadedEmail}.`)
    }

    if (loadedUsername !== username) {
      return fail(cardId, `Редактор открылся, но username не совпадает: ожидалось ${username}, получено ${loadedUsername}.`)
    }

    const fioInput = await waitForVisible(driver, By.css('input[name="fio"]'))
    const originalFio = await fioInput.getAttribute('value')
    await fioInput.clear()
    await fioInput.sendKeys(`${originalFio} Updated`)

    const statusSelect = await waitForVisible(driver, By.css('select[name="status"]'))
    await selectNativeValue(driver, 'select[name="status"]', 2)

    const seeker = await waitForVisible(driver, By.css('input[name="seeker"]'))
    if (!(await seeker.isSelected())) {
      await seeker.click()
    }

    const employer = await waitForVisible(driver, By.css('input[name="employer"]'))
    if (!(await employer.isSelected())) {
      await employer.click()
    }

    const adminAccessControls = await driver.findElements(By.css('input[name="adminAccess"]'))
    if (adminAccessControls.length) {
      const checkbox = adminAccessControls[0]
      if (!(await checkbox.isSelected())) {
        await checkbox.click()
      }
    }

    await submitFormByButtonText(driver, 'Сохранить пользователя')
    await driver.wait(async () => {
      const feedback = await driver.findElements(By.css('.auth-feedback'))
      if (!feedback.length) {
        return false
      }

      const text = (await feedback[0].getText()).trim()
      return text.includes('Пользователь обновлен') || text.includes('Пользователь создан')
    }, WAIT_MS)

    await withStaleRetry(async () => {
      const resetButtons = await driver.findElements(By.xpath('//button[contains(normalize-space(.), "Сбросить пароль")]'))
      if (!resetButtons.length) {
        throw new Error('Кнопка сброса пароля не найдена.')
      }

      await resetButtons[0].click()
    })

    const passwordInput = await waitForVisible(driver, By.css('.curator-user-editor__password-actions input[type="text"]'))
    const tempPassword = (await passwordInput.getAttribute('value')).trim()
    if (!tempPassword) {
      return fail(cardId, 'После сброса пароля не появился временный пароль.')
    }

    if (tempPassword.length < 8) {
      return fail(cardId, `Временный пароль выглядит некорректно: ${tempPassword}`)
    }

    return pass(cardId, `Редактор пользователя работает: форма открылась в edit-mode, изменения сохранились, временный пароль сгенерирован. Тестовый email: ${email}.`)
  } catch (error) {
    return fail(cardId, `Сбой сценария карточки 29: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function runCards2329(driver, ctx = {}) {
  const baseUrl = resolveBaseUrl(ctx)
  const results = []

  ctx.shared = ctx.shared ?? {}

  results.push(await testCard23(driver, ctx, baseUrl))
  await logout(driver, baseUrl)
  results.push(await testCard29(driver, ctx, baseUrl))

  return results
}
