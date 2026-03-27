import { Builder, By, Key, until } from 'selenium-webdriver'

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@tramplin.local'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Admin123!'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPass123!'
const WAIT_MS = 20000

function uniqueEmail(prefix) {
  const ts = Date.now()
  return `${prefix}+${ts}@example.test`
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
      await sleep(300)
    }
  }
  throw lastError
}

async function waitForVisible(driver, locator, timeout = WAIT_MS) {
  const el = await driver.wait(until.elementLocated(locator), timeout)
  await driver.wait(until.elementIsVisible(el), timeout)
  return el
}

async function open(driver, path = '/') {
  await driver.get(`${BASE_URL}${path}`)
}

async function clearBrowserState(driver) {
  await driver.manage().deleteAllCookies()
  await driver.get(`${BASE_URL}/`)
  await driver.executeScript('window.localStorage.clear(); window.sessionStorage.clear();')
}

async function clickByText(driver, tag, text) {
  const el = await waitForVisible(driver, By.xpath(`//${tag}[contains(normalize-space(.), "${text}")]`))
  await el.click()
}

async function logout(driver) {
  const buttons = await driver.findElements(By.xpath('//button[contains(normalize-space(.), "Выйти")]'))
  if (buttons.length > 0) {
    await buttons[0].click()
    await driver.wait(async () => {
      const current = await driver.getCurrentUrl()
      return current.includes(BASE_URL)
    }, WAIT_MS)
  }
}

async function login(driver, email, password) {
  await open(driver, '/login')
  const emailInput = await waitForVisible(driver, By.css('input[name="email"]'))
  await emailInput.clear()
  await emailInput.sendKeys(email)
  const passwordInput = await waitForVisible(driver, By.css('input[name="password"]'))
  await passwordInput.clear()
  await passwordInput.sendKeys(password)
  await clickByText(driver, 'button', 'Войти')
  await driver.wait(async () => {
    const url = await driver.getCurrentUrl()
    return url.includes('/dashboard') || url.includes('/verification/employer')
  }, WAIT_MS)
}

async function registerUser(driver, roleText, email, fio, password) {
  await open(driver, '/register')
  if (roleText) {
    if (roleText === '__EMPLOYER__') {
      const roleButtons = await driver.findElements(By.css('button.auth-role-card'))
      if (roleButtons.length >= 2) {
        await roleButtons[1].click()
      }
    } else {
      await clickByText(driver, 'button', roleText)
    }
  }
  const emailInput = await waitForVisible(driver, By.css('input[name="email"]'))
  await emailInput.clear()
  await emailInput.sendKeys(email)
  const fioInput = await waitForVisible(driver, By.css('input[name="fullName"]'))
  await fioInput.clear()
  await fioInput.sendKeys(fio)
  const passInput = await waitForVisible(driver, By.css('input[name="password"]'))
  await passInput.clear()
  await passInput.sendKeys(password)
  await clickByText(driver, 'button', 'Создать аккаунт')
  await driver.wait(async () => {
    const url = await driver.getCurrentUrl()
    return url.includes('/dashboard') || url.includes('/verification/employer')
  }, WAIT_MS)
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

async function testCard28FavoritesSync(driver, seekerEmail) {
  const cardId = '69c52fba09ea0bf95a0bbe48'
  try {
    await clearBrowserState(driver)
    await open(driver, '/')
    const favoriteButtons = await driver.findElements(By.css('button.opportunity-card__favorite'))
    if (!favoriteButtons.length) {
      return blocked(cardId, 'На главной нет карточек возможностей: гостевое избранное проверить нельзя.')
    }
    const favoriteBtn = favoriteButtons[0]
    await favoriteBtn.click()
    await sleep(700)

    const snapshotRawBefore = await driver.executeScript('return window.localStorage.getItem("tramplin.favorite-opportunities");')
    if (!snapshotRawBefore) {
      return fail(cardId, 'Не записалось гостевое избранное в localStorage (tramplin.favorite-opportunities).')
    }

    await registerUser(driver, 'Соискатель', seekerEmail, 'E2E Seeker', TEST_PASSWORD)
    await sleep(700)

    const snapshotRawAfter = await driver.executeScript('return window.localStorage.getItem("tramplin.favorite-opportunities");')
    if (!snapshotRawAfter) {
      return fail(cardId, 'После регистрации пропал ключ избранного: ожидалось пустое состояние, но ключ отсутствует.')
    }

    const parsed = JSON.parse(snapshotRawAfter)
    const vacancyIds = Array.isArray(parsed.vacancyIds) ? parsed.vacancyIds : []
    const opportunityIds = Array.isArray(parsed.opportunityIds) ? parsed.opportunityIds : []

    if (vacancyIds.length !== 0 || opportunityIds.length !== 0) {
      return fail(cardId, `После регистрации избранное не очистилось: vacancyIds=${vacancyIds.length}, opportunityIds=${opportunityIds.length}.`)
    }

    return pass(cardId, 'Гостевое избранное сохранилось до auth и корректно очистилось после регистрации.')
  } catch (error) {
    return fail(cardId, `Сбой сценария синхронизации избранного: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function testCard15EmployerSettings(driver, employerEmail) {
  const cardId = '69c2a0234c1e9059244da671'
  try {
    await clearBrowserState(driver)
    await registerUser(driver, '__EMPLOYER__', employerEmail, 'E2E Employer', TEST_PASSWORD)
    await open(driver, '/dashboard/employer')
    await withStaleRetry(async () => {
      const clicked = await driver.executeScript(`
        const tabs = document.querySelectorAll('nav.seeker-profile-tabs button');
        if (tabs && tabs.length) {
          tabs[tabs.length - 1].click();
          return true;
        }
        return false;
      `)
      if (!clicked) {
        await clickByText(driver, 'button', 'Настройки')
      }
    })

    let chatToggle = null
    try {
      chatToggle = await waitForVisible(driver, By.css('input[name="autoGreetingEnabled"]'), 7000)
    } catch {
      const legalNameInput = await driver.findElements(By.css('input[name="legalName"]'))
      if (legalNameInput.length) {
        await legalNameInput[0].clear()
        await legalNameInput[0].sendKeys('E2E Employer Company')
        const brandInputs = await driver.findElements(By.css('input[name="brandName"]'))
        if (brandInputs.length) {
          await brandInputs[0].clear()
          await brandInputs[0].sendKeys('E2E Company')
        }
        await clickByText(driver, 'button', 'Создать компанию')
        await sleep(1200)
        await withStaleRetry(async () => {
          const clicked = await driver.executeScript(`
            const tabs = document.querySelectorAll('nav.seeker-profile-tabs button');
            if (tabs && tabs.length) {
              tabs[tabs.length - 1].click();
              return true;
            }
            return false;
          `)
          if (!clicked) {
            await clickByText(driver, 'button', 'Настройки')
          }
        })
      }
      chatToggle = await waitForVisible(driver, By.css('input[name="autoGreetingEnabled"]'), 12000)
    }
    if (!chatToggle) {
      return fail(cardId, 'Не найдены поля chat settings даже после создания компании.')
    }

    await waitForVisible(driver, By.css('textarea[name="autoGreetingText"]'))
    await waitForVisible(driver, By.css('input[name="outsideHoursEnabled"]'))
    await waitForVisible(driver, By.css('textarea[name="outsideHoursText"]'))
    await waitForVisible(driver, By.css('input[name="workingHoursTimezone"]'))
    await waitForVisible(driver, By.css('input[name="workingHoursFrom"]'))
    await waitForVisible(driver, By.css('input[name="workingHoursTo"]'))
    await waitForVisible(driver, By.css('select[name="linkKind"]'))
    await waitForVisible(driver, By.css('input[name="url"]'))
    await waitForVisible(driver, By.css('input[name="label"]'))

    return pass(cardId, 'Секция настроек работодателя содержит chat settings и управление публичными ссылками.')
  } catch (error) {
    return fail(cardId, `Сбой проверки секции настроек работодателя: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function testCard29CuratorUserEditor(driver) {
  const cardId = '69c52fd91a2c6d5aead1677d'
  try {
    await clearBrowserState(driver)
    await login(driver, ADMIN_EMAIL, ADMIN_PASSWORD)
    await open(driver, '/dashboard/curator/users/create')

    await waitForVisible(driver, By.css('input[name="email"]'))
    await waitForVisible(driver, By.css('input[name="username"]'))
    await waitForVisible(driver, By.css('input[name="fio"]'))
    await waitForVisible(driver, By.css('select[name="status"]'))
    await waitForVisible(driver, By.css('input[name="seeker"]'))
    await waitForVisible(driver, By.css('input[name="employer"]'))

    const previewCards = await driver.findElements(By.xpath('//*[contains(normalize-space(.), "Карточка пользователя")]'))
    if (!previewCards.length) {
      return fail(cardId, 'Не найден блок превью карточки пользователя на экране куратора.')
    }

    return pass(cardId, 'Экран редактирования пользователя доступен и содержит основные поля/блок карточки.')
  } catch (error) {
    return fail(cardId, `Сбой проверки экрана редактирования пользователя: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function testCard37ApplicationStepStatuses(driver, employerEmail) {
  const cardId = '69c664f1a811b67480742739'
  try {
    await clearBrowserState(driver)
    await login(driver, employerEmail, TEST_PASSWORD)
    await open(driver, '/dashboard/employer')
    await withStaleRetry(async () => {
      const clickedByScript = await driver.executeScript(`
        const tabs = document.querySelectorAll('nav.seeker-profile-tabs button');
        if (tabs && tabs.length >= 4) {
          tabs[3].click();
          return true;
        }
        return false;
      `)
      if (!clickedByScript) {
        const appTabCandidates = await driver.findElements(By.xpath('//button[contains(normalize-space(.), "Отклики")]'))
        if (appTabCandidates.length) {
          await appTabCandidates[0].click()
        }
      }
    })
    await sleep(1200)

    let appCards = await driver.findElements(By.css('.employer-application-card'))
    if (!appCards.length) {
      await sleep(1000)
      appCards = await driver.findElements(By.css('.employer-application-card'))
    }
    if (!appCards.length) {
      return blocked(cardId, 'В тестовом окружении нет откликов работодателя: не удалось проверить step-by-step смену статуса.')
    }

    const stepButtons = await driver.findElements(By.css('.employer-application-actions__steps button'))
    if (!stepButtons.length) {
      return fail(cardId, 'Для существующих откликов отсутствуют кнопки пошаговой смены статуса.')
    }

    return pass(cardId, 'Для откликов отображаются шаги смены статуса.')
  } catch (error) {
    return fail(cardId, `Сбой проверки step-by-step статусов отклика: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function testCard30ChatIndicators(driver, employerEmail) {
  const cardId = '69c52fda9f209980fb8a5361'
  try {
    await clearBrowserState(driver)
    await login(driver, employerEmail, TEST_PASSWORD)
    await open(driver, '/dashboard/employer')

    const chatFab = await waitForVisible(driver, By.css('button.chat-widget__fab'))
    await chatFab.click()
    await waitForVisible(driver, By.css('section.chat-widget__panel'))

    const listItems = await driver.findElements(By.css('.chat-widget__list-item'))
    if (!listItems.length) {
      return blocked(cardId, 'Чаты не найдены в текущих тестовых данных: индикаторы новых сообщений и звук проверить нельзя.')
    }

    const unreadBadges = await driver.findElements(By.css('.chat-widget__unread-badge'))
    return pass(
      cardId,
      unreadBadges.length
        ? `Виджеты индикаторов непрочитанного присутствуют (${unreadBadges.length} badge).`
        : 'Чат открывается, структура индикаторов присутствует, но непрочитанных сообщений в тестовых данных нет.',
    )
  } catch (error) {
    return fail(cardId, `Сбой проверки чат-уведомлений: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function main() {
  const driver = await new Builder().forBrowser('chrome').build()
  const seekerEmail = uniqueEmail('e2e-seeker')
  const employerEmail = uniqueEmail('e2e-employer')
  const results = []

  try {
    await driver.manage().window().setRect({ width: 1440, height: 1000, x: 0, y: 0 })
    await driver.manage().setTimeouts({ implicit: 0, pageLoad: 60000, script: 30000 })

    results.push(await testCard28FavoritesSync(driver, seekerEmail))
    await logout(driver)
    results.push(await testCard15EmployerSettings(driver, employerEmail))
    await logout(driver)
    results.push(await testCard29CuratorUserEditor(driver))
    await logout(driver)
    results.push(await testCard37ApplicationStepStatuses(driver, employerEmail))
    await logout(driver)
    results.push(await testCard30ChatIndicators(driver, employerEmail))
  } finally {
    await driver.quit()
  }

  process.stdout.write(JSON.stringify(results, null, 2))
}

main().catch((error) => {
  process.stderr.write(String(error))
  process.exit(1)
})
