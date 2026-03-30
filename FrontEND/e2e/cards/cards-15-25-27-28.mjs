import { By, until } from 'selenium-webdriver'

const DEFAULT_BASE_URL = 'http://localhost:5173'
const DEFAULT_ADMIN_EMAIL = 'admin@tramplin.local'
const DEFAULT_ADMIN_PASSWORD = 'Admin123!'
const DEFAULT_TEST_PASSWORD = 'TestPass123!'
const WAIT_MS = 20000

function createResult(cardId, status, details) {
  return { cardId, status, details }
}

function pass(cardId, details) {
  return createResult(cardId, 'PASS', details)
}

function fail(cardId, details) {
  return createResult(cardId, 'FAIL', details)
}

function blocked(cardId, details) {
  return createResult(cardId, 'BLOCKED', details)
}

function uniqueEmail(prefix) {
  return `${prefix}+${Date.now()}@example.test`
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function escapeXpathText(value) {
  if (!value.includes("'")) {
    return `'${value}'`
  }

  if (!value.includes('"')) {
    return `"${value}"`
  }

  return `concat('${value.replace(/'/g, `', "'", `)}')`
}

function isStaleError(error) {
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes('stale element')
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

async function open(driver, baseUrl, path = '/') {
  await driver.get(`${baseUrl}${path}`)
}

async function clearBrowserState(driver, baseUrl) {
  await driver.manage().deleteAllCookies()
  await driver.get(`${baseUrl}/`)
  await driver.executeScript('window.localStorage.clear(); window.sessionStorage.clear();')
}

async function waitForVisible(driver, locator, timeout = WAIT_MS) {
  const element = await driver.wait(until.elementLocated(locator), timeout)
  await driver.wait(until.elementIsVisible(element), timeout)
  return element
}

async function waitForNotVisible(driver, locator, timeout = WAIT_MS) {
  const element = await driver.wait(until.elementLocated(locator), timeout)
  await driver.wait(until.elementIsNotVisible(element), timeout)
  return element
}

async function findVisibleElements(driver, locator) {
  const elements = await driver.findElements(locator)
  const visible = []
  for (const element of elements) {
    try {
      if (await element.isDisplayed()) {
        visible.push(element)
      }
    } catch {
      // Ignore stale/hidden elements.
    }
  }
  return visible
}

async function clickByText(driver, tagName, text, timeout = WAIT_MS) {
  const locator = By.xpath(`//${tagName}[contains(normalize-space(.), ${escapeXpathText(text)})]`)
  const element = await waitForVisible(driver, locator, timeout)
  await element.click()
  return element
}

async function maybeClickByText(driver, tagName, texts, timeout = 4000) {
  for (const text of texts) {
    const locator = By.xpath(`//${tagName}[contains(normalize-space(.), ${escapeXpathText(text)})]`)
    const elements = await findVisibleElements(driver, locator)
    if (elements.length > 0) {
      await elements[0].click()
      return true
    }
    try {
      const element = await driver.wait(until.elementLocated(locator), timeout)
      if (await element.isDisplayed()) {
        await element.click()
        return true
      }
    } catch {
      // Try the next label.
    }
  }
  return false
}

async function setTextInput(driver, selector, value) {
  const input = await waitForVisible(driver, By.css(selector))
  await input.clear()
  await input.sendKeys(value)
  return input
}

async function setNativeSelectValue(driver, selector, value) {
  const select = await waitForVisible(driver, By.css(selector))
  await driver.executeScript(
    (el, nextValue) => {
      const element = el
      element.value = String(nextValue)
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
    },
    select,
    value,
  )
  return select
}

async function setCheckboxValue(driver, selector, nextValue) {
  const checkbox = await waitForVisible(driver, By.css(selector))
  const currentValue = await checkbox.isSelected()
  if (currentValue !== nextValue) {
    await checkbox.click()
  }
  return checkbox
}

async function login(driver, baseUrl, email, password) {
  await open(driver, baseUrl, '/login')
  await setTextInput(driver, 'input[name="email"]', email)
  await setTextInput(driver, 'input[name="password"]', password)
  await clickByText(driver, 'button', 'Войти')
  await driver.wait(async () => {
    const url = await driver.getCurrentUrl()
    return url.includes('/dashboard') || url.includes('/verification/employer')
  }, WAIT_MS)
}

async function registerUser(driver, baseUrl, role, email, fullName, password) {
  await open(driver, baseUrl, '/register')

  if (role === 'employer') {
    const roleCards = await findVisibleElements(driver, By.css('button.auth-role-card'))
    if (roleCards.length >= 2) {
      await roleCards[1].click()
    } else {
      await clickByText(driver, 'button', 'Работодатель')
    }
  } else {
    const roleCards = await findVisibleElements(driver, By.css('button.auth-role-card'))
    if (roleCards.length > 0 && (await roleCards[0].getAttribute('aria-pressed')) !== 'true') {
      await roleCards[0].click()
    }
  }

  await setTextInput(driver, 'input[name="email"]', email)
  await setTextInput(driver, 'input[name="fullName"]', fullName)
  await setTextInput(driver, 'input[name="password"]', password)
  await clickByText(driver, 'button', 'Создать аккаунт')
  await driver.wait(async () => {
    const url = await driver.getCurrentUrl()
    return url.includes('/dashboard') || url.includes('/verification/employer')
  }, WAIT_MS)
}

async function logoutIfPresent(driver) {
  const candidates = await findVisibleElements(driver, By.xpath('//button[contains(normalize-space(.), "Выйти")]'))
  if (candidates.length > 0) {
    await candidates[0].click()
    await sleep(500)
  }
}

async function waitForUrlIncludes(driver, fragment, timeout = WAIT_MS) {
  await driver.wait(async () => (await driver.getCurrentUrl()).includes(fragment), timeout)
}

async function waitForBodyText(driver, text, timeout = WAIT_MS) {
  const locator = By.xpath(`//*[contains(normalize-space(.), ${escapeXpathText(text)})]`)
  return waitForVisible(driver, locator, timeout)
}

async function getBodyText(driver) {
  return normalizeText(await driver.findElement(By.css('body')).getText())
}

async function readLocalStorage(driver, key) {
  return driver.executeScript((storageKey) => window.localStorage.getItem(storageKey), key)
}

async function readElementValue(driver, element) {
  return driver.executeScript((el) => el.value, element)
}

async function parseFavoriteSnapshot(driver) {
  const raw = await readLocalStorage(driver, 'tramplin.favorite-opportunities')
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function createEmployerCompanyIfMissing(driver) {
  const companyName = `E2E Company ${Date.now()}`
  const legalInput = (await findVisibleElements(driver, By.css('input[name="legalName"]')))[0] ?? null

  if (!legalInput) {
    const companyTabClicked = await maybeClickByText(driver, 'button', ['Профиль компании', 'Компания'])
    if (!companyTabClicked) {
      throw new Error('Не удалось открыть вкладку профиля компании.')
    }
  }

  const inputs = await findVisibleElements(driver, By.css('input[name="legalName"]'))
  if (!inputs.length) {
    return { created: false, companyName }
  }

  await setTextInput(driver, 'input[name="legalName"]', companyName)
  await setTextInput(driver, 'input[name="brandName"]', `Brand ${companyName}`)
  const submitButtons = await findVisibleElements(driver, By.xpath('//button[contains(normalize-space(.), "Создать компанию")]'))
  if (!submitButtons.length) {
    throw new Error('Не найдена кнопка создания компании.')
  }
  await submitButtons[0].click()
  await waitForBodyText(driver, 'Компания создана. Данные кабинета обновлены.')
  await sleep(1200)

  return { created: true, companyName }
}

async function ensureEmployerDashboardReady(driver) {
  const dashboardText = await getBodyText(driver)
  if (
    !dashboardText.includes('Создать компанию') &&
    !dashboardText.includes('Создать возможность') &&
    !dashboardText.includes('Настройки чата')
  ) {
    throw new Error('Не загрузился кабинет работодателя.')
  }
}

async function switchEmployerTab(driver, tabLabel) {
  const clicked = await maybeClickByText(driver, 'button', [tabLabel])
  if (!clicked) {
    throw new Error(`Не найдена вкладка "${tabLabel}".`)
  }
  await sleep(800)
}

async function testCard15EmployerSettings(driver, ctx) {
  const cardId = '69c2a0234c1e9059244da671'
  try {
    const baseUrl = ctx.baseUrl ?? DEFAULT_BASE_URL
    const employerEmail = ctx.employerEmail ?? uniqueEmail('e2e-employer')
    const employerPassword = ctx.employerPassword ?? DEFAULT_TEST_PASSWORD

    await clearBrowserState(driver, baseUrl)
    await registerUser(driver, baseUrl, 'employer', employerEmail, 'E2E Employer', employerPassword)
    await open(driver, baseUrl, '/dashboard/employer')
    await ensureEmployerDashboardReady(driver)
    await createEmployerCompanyIfMissing(driver)
    await open(driver, baseUrl, '/dashboard/employer')
    await ensureEmployerDashboardReady(driver)

    await switchEmployerTab(driver, 'Настройки')
    await waitForVisible(driver, By.css('input[name="autoGreetingEnabled"]'))
    await waitForVisible(driver, By.css('textarea[name="autoGreetingText"]'))
    await waitForVisible(driver, By.css('input[name="outsideHoursEnabled"]'))
    await waitForVisible(driver, By.css('textarea[name="outsideHoursText"]'))
    await waitForVisible(driver, By.css('input[name="workingHoursTimezone"]'))
    await waitForVisible(driver, By.css('input[name="workingHoursFrom"]'))
    await waitForVisible(driver, By.css('input[name="workingHoursTo"]'))
    await waitForVisible(driver, By.css('select[name="linkKind"]'))
    await waitForVisible(driver, By.css('input[name="url"]'))
    await waitForVisible(driver, By.css('input[name="label"]'))

    const autoGreeting = `Привет! Это автосообщение ${Date.now()}`
    const outsideHours = `Спасибо, ответим в рабочее время ${Date.now()}`
    const publicLinkUrl = `https://example.com/${Date.now()}`
    const publicLinkLabel = 'Telegram'

    await setCheckboxValue(driver, 'input[name="autoGreetingEnabled"]', true)
    await setTextInput(driver, 'textarea[name="autoGreetingText"]', autoGreeting)
    await setCheckboxValue(driver, 'input[name="outsideHoursEnabled"]', true)
    await setTextInput(driver, 'textarea[name="outsideHoursText"]', outsideHours)
    await setTextInput(driver, 'input[name="workingHoursTimezone"]', 'Europe/Moscow')
    await setTextInput(driver, 'input[name="workingHoursFrom"]', '09:00')
    await setTextInput(driver, 'input[name="workingHoursTo"]', '18:00')
    await clickByText(driver, 'button', 'Сохранить чат-настройки')
    await sleep(1200)

    await setNativeSelectValue(driver, 'select[name="linkKind"]', 2)
    await setTextInput(driver, 'input[name="url"]', publicLinkUrl)
    await setTextInput(driver, 'input[name="label"]', publicLinkLabel)
    await clickByText(driver, 'button', 'Добавить ссылку')
    await waitForBodyText(driver, publicLinkUrl)

    await switchEmployerTab(driver, 'Верификация')
    await waitForVisible(driver, By.xpath('//button[contains(normalize-space(.), "Отправить на верификацию")]'))
    await clickByText(driver, 'button', 'Отправить на верификацию')
    await sleep(1200)

    await open(driver, baseUrl, '/dashboard/employer')
    await ensureEmployerDashboardReady(driver)
    await switchEmployerTab(driver, 'Настройки')
    await waitForVisible(driver, By.css('input[name="autoGreetingEnabled"]'))

    const savedGreeting = await readElementValue(driver, await driver.findElement(By.css('textarea[name="autoGreetingText"]')))
    const savedOutsideHours = await readElementValue(driver, await driver.findElement(By.css('textarea[name="outsideHoursText"]')))
    const savedTimezone = await driver.findElement(By.css('input[name="workingHoursTimezone"]')).getAttribute('value')
    const savedLink = await waitForVisible(driver, By.xpath(`//*[contains(normalize-space(.), ${escapeXpathText(publicLinkUrl)})]`))
    const savedLinkText = normalizeText(await savedLink.getText())

    if (!savedGreeting.includes(autoGreeting.slice(0, 12))) {
      return fail(cardId, 'Не сохранился текст авто-приветствия работодателя.')
    }

    if (!savedOutsideHours.includes(outsideHours.slice(0, 12))) {
      return fail(cardId, 'Не сохранился текст сообщения вне рабочего времени.')
    }

    if ((savedTimezone ?? '') !== 'Europe/Moscow') {
      return fail(cardId, `Неверный timezone после сохранения: ${savedTimezone ?? 'пусто'}.`)
    }

    if (!savedLinkText.includes(publicLinkLabel) && !savedLinkText.includes(publicLinkUrl)) {
      return fail(cardId, 'Публичная ссылка компании не отображается после сохранения.')
    }

    await switchEmployerTab(driver, 'Создать возможность')
    await waitForUrlIncludes(driver, '/vacancy-flow/1?type=vacancy')
    await waitForBodyText(driver, 'Выберите, что хотите создать')

    return pass(
      cardId,
      'Отдельная секция настроек работодателя доступна, chat settings и публичная ссылка сохраняются, верификация и создание вакансий вынесены в отдельные экраны.',
    )
  } catch (error) {
    return fail(cardId, `Сбой проверки настроек работодателя: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function testCard25Privacy(driver, ctx) {
  const cardId = '69c52fb83b111828cfae1441'
  try {
    const baseUrl = ctx.baseUrl ?? DEFAULT_BASE_URL
    const seekerEmail = ctx.seekerEmail ?? uniqueEmail('e2e-seeker')
    const seekerPassword = ctx.seekerPassword ?? DEFAULT_TEST_PASSWORD
    const publicLinkUrl = `https://privacy.example/${Date.now()}`

    await clearBrowserState(driver, baseUrl)
    await registerUser(driver, baseUrl, 'seeker', seekerEmail, 'E2E Seeker', seekerPassword)
    await open(driver, baseUrl, '/dashboard/seeker')
    await waitForBodyText(driver, 'Редактировать профиль')
    await clickByText(driver, 'button', 'Редактировать профиль')
    const visibilityLabel = await waitForVisible(
      driver,
      By.xpath('//label[contains(normalize-space(.), "Видимость профиля в списке резюме")]'),
    )
    const visibilitySelect = await visibilityLabel.findElement(By.css('select'))
    await driver.executeScript(
      (el, nextValue) => {
        const element = el
        element.value = String(nextValue)
        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
      },
      visibilitySelect,
      'private',
    )

    const linksToggleLabels = await findVisibleElements(driver, By.xpath('//label[.//span[contains(normalize-space(.), "Показывать ссылки в резюме")]]'))
    const proofsToggleLabels = await findVisibleElements(driver, By.xpath('//label[.//span[contains(normalize-space(.), "Показывать соцдоказательства в карточках")]]'))
    if (!linksToggleLabels.length || !proofsToggleLabels.length) {
      return blocked(cardId, 'Не удалось найти переключатели приватности в модальном окне профиля.')
    }

    const linksInput = await linksToggleLabels[0].findElement(By.css('input'))
    const proofsInput = await proofsToggleLabels[0].findElement(By.css('input'))
    if (await linksInput.isSelected()) {
      await linksInput.click()
    }
    if (await proofsInput.isSelected()) {
      await proofsInput.click()
    }

    await clickByText(driver, 'button', 'Сохранить')
    await waitForBodyText(driver, 'Профиль сохранен.')

    await open(driver, baseUrl, '/dashboard/seeker')
    await clickByText(driver, 'button', 'Редактировать профиль')
    const reopenedVisibilityLabel = await waitForVisible(
      driver,
      By.xpath('//label[contains(normalize-space(.), "Видимость профиля в списке резюме")]'),
    )
    const reopenedVisibilitySelect = await reopenedVisibilityLabel.findElement(By.css('select'))
    const reopenedVisibility = await reopenedVisibilitySelect.getAttribute('value')
    if (reopenedVisibility !== 'private') {
      return fail(cardId, `Видимость профиля не сохранилась как private, текущий value=${reopenedVisibility ?? 'null'}.`)
    }

    const reopenedLinksToggle = await waitForVisible(
      driver,
      By.xpath('//label[.//span[contains(normalize-space(.), "Показывать ссылки в резюме")]]'),
    )
    const reopenedProofsToggle = await waitForVisible(
      driver,
      By.xpath('//label[.//span[contains(normalize-space(.), "Показывать соцдоказательства в карточках")]]'),
    )
    const reopenedLinksInput = await reopenedLinksToggle.findElement(By.css('input'))
    const reopenedProofsInput = await reopenedProofsToggle.findElement(By.css('input'))
    if (await reopenedLinksInput.isSelected()) {
      return fail(cardId, 'Переключатель показа ссылок в резюме не сохранился в выключенном состоянии.')
    }
    if (await reopenedProofsInput.isSelected()) {
      return fail(cardId, 'Переключатель соцдоказательств не сохранился в выключенном состоянии.')
    }

    await clickByText(driver, 'button', 'Отмена')
    const infoBody = await getBodyText(driver)
    if (!infoBody.includes('Ссылки из резюме скрыты настройками приватности')) {
      return fail(cardId, 'Ссылки из резюме не скрылись на странице профиля после выключения privacy.')
    }

    await open(driver, baseUrl, '/dashboard/seeker/resume/edit')
    await waitForBodyText(driver, 'Желаемая позиция')
    const resumeBasics = await findVisibleElements(driver, By.css('.resume-step-form input, .resume-step-form textarea'))
    if (resumeBasics.length < 3) {
      return blocked(cardId, 'Не удалось найти базовые поля резюме для прохождения шага с приватностью.')
    }

    await resumeBasics[0].clear()
    await resumeBasics[0].sendKeys('QA Engineer')
    await resumeBasics[1].clear()
    await resumeBasics[1].sendKeys('100000')
    await resumeBasics[2].clear()
    await resumeBasics[2].sendKeys('150000')
    const summaryArea = await waitForVisible(driver, By.css('.resume-step-form textarea'))
    await summaryArea.clear()
    await summaryArea.sendKeys('Тестовый профиль для проверки приватности.')

    await clickByText(driver, 'button', 'Дальше')
    await clickByText(driver, 'button', 'Дальше')
    await clickByText(driver, 'button', 'Дальше')
    await clickByText(driver, 'button', 'Дальше')
    await clickByText(driver, 'button', 'Дальше')

    const linkStepText = await getBodyText(driver)
    if (!linkStepText.includes('Ссылки на соцсети')) {
      return blocked(cardId, 'Не удалось добраться до шага резюме со ссылками для проверки приватности.')
    }

    const resumeLinkInputs = await findVisibleElements(driver, By.css('.resume-step-body input'))
    if (resumeLinkInputs.length < 2) {
      return blocked(cardId, 'На шаге резюме со ссылками не нашлись ожидаемые поля.')
    }
    await resumeLinkInputs[0].clear()
    await resumeLinkInputs[0].sendKeys(publicLinkUrl)
    await resumeLinkInputs[1].clear()
    await resumeLinkInputs[1].sendKeys('Скрытая ссылка')

    await clickByText(driver, 'button', 'Добавить ссылку')
    await clickByText(driver, 'button', 'Сохранить резюме')
    await waitForBodyText(driver, 'Резюме сохранено.')

    await open(driver, baseUrl, '/dashboard/seeker')
    const seekerProfileBody = await getBodyText(driver)
    if (!seekerProfileBody.includes('Ссылки скрыты настройками приватности')) {
      return fail(cardId, 'Ссылки на соцсети не скрылись после отключения privacy.')
    }

    const socialProofSnapshot = seekerProfileBody.includes('Соцдоказательства в карточках')
      ? 'Настройка соцдоказательств отображается в интерфейсе.'
      : 'Настройка соцдоказательств не найдена.'

    return pass(
      cardId,
      `Privacy сохраняется: профиль скрывается, ссылки не показываются, а флаг соцдоказательств доступен в UI. ${socialProofSnapshot}`,
    )
  } catch (error) {
    return fail(cardId, `Сбой проверки приватности: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function pickFirstSuggestion(driver, suggestionSelector, fallbackText) {
  const suggestionText = await driver.executeScript((selector) => {
    const elements = Array.from(document.querySelectorAll(selector))
    const visible = elements.find((element) => {
      const style = window.getComputedStyle(element)
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0
    })

    if (!visible) {
      return null
    }

    const text = (visible.textContent || '').replace(/\s+/g, ' ').trim()
    ;(visible instanceof HTMLElement ? visible : null)?.click()
    return text || null
  }, suggestionSelector)

  if (typeof suggestionText === 'string' && suggestionText.trim()) {
    return normalizeText(suggestionText)
  }

  const suggestions = await findVisibleElements(driver, By.css(suggestionSelector))
  if (suggestions.length > 0) {
    return normalizeText(await suggestions[0].getText())
  }

  const fallback = await findVisibleElements(
    driver,
    By.xpath(`//*[contains(normalize-space(.), ${escapeXpathText(fallbackText)})]`),
  )
  if (fallback.length > 0) {
    await fallback[0].click()
    return normalizeText(await fallback[0].getText())
  }

  return null
}

async function testCard27AddressSuggestions(driver, ctx) {
  const cardId = '69c52fb97250b8c9f9cf4c27'
  try {
    const baseUrl = ctx.baseUrl ?? DEFAULT_BASE_URL
    const employerEmail = ctx.employerEmail ?? uniqueEmail('e2e-employer-address')
    const employerPassword = ctx.employerPassword ?? DEFAULT_TEST_PASSWORD
    const title = `E2E Vacancy ${Date.now()}`

    await clearBrowserState(driver, baseUrl)
    await registerUser(driver, baseUrl, 'employer', employerEmail, 'E2E Employer Address', employerPassword)
    await open(driver, baseUrl, '/dashboard/employer')
    await ensureEmployerDashboardReady(driver)
    await createEmployerCompanyIfMissing(driver)

    await open(driver, baseUrl, '/vacancy-flow/1?type=vacancy')
    await waitForBodyText(driver, 'Выберите, что хотите создать')
    await clickByText(driver, 'button', 'Создать')
    await waitForVisible(driver, By.css('input[name="title"]'))

    await setTextInput(driver, 'input[name="title"]', title)
    await setTextInput(driver, 'input[name="cityQuery"]', 'Москва')
    await sleep(800)
    const citySuggestionText = await withStaleRetry(async () => {
      await setTextInput(driver, 'input[name="cityQuery"]', 'Москва')
      await sleep(800)
      return pickFirstSuggestion(driver, '.vf-suggestion', 'Москва')
    })
    if (!citySuggestionText) {
      return blocked(cardId, 'Не удалось получить подсказку города для последовательного адреса city -> street -> house.')
    }

    await waitForVisible(driver, By.css('input[name="streetName"]'))
    const streetSuggestionText = await withStaleRetry(async () => {
      await setTextInput(driver, 'input[name="streetName"]', 'Тверская')
      await sleep(800)
      return pickFirstSuggestion(driver, '.vf-suggestion', 'Тверская')
    })
    if (!streetSuggestionText) {
      return blocked(cardId, 'Не удалось получить подсказку улицы для последовательного адреса city -> street -> house.')
    }

    await waitForVisible(driver, By.css('input[name="houseNumber"]'))
    const houseSuggestionText = await withStaleRetry(async () => {
      await setTextInput(driver, 'input[name="houseNumber"]', '1')
      await sleep(800)
      return pickFirstSuggestion(driver, '.vf-suggestion', '1')
    })
    if (!houseSuggestionText) {
      return blocked(cardId, 'Не удалось получить подсказку дома для последовательного адреса city -> street -> house.')
    }

    const addressText = normalizeText(await driver.findElement(By.css('.vf-map-address')).getText())
    if (!addressText.includes('Москва') || !addressText.includes('Тверская') || !addressText.includes('1')) {
      return fail(cardId, `Адресный preview не собрался в текстовом режиме: "${addressText}".`)
    }

    await clickByText(driver, 'button', 'Дальше')
    await waitForVisible(driver, By.css('textarea[name="shortDescription"]'))
    await setTextInput(driver, 'textarea[name="shortDescription"]', `Краткое описание ${Date.now()}`)
    await setTextInput(driver, 'textarea[name="fullDescription"]', `Полное описание ${Date.now()}`)
    await clickByText(driver, 'button', 'Дальше')
    await waitForVisible(driver, By.css('input[name="salaryFrom"]'))
    await setTextInput(driver, 'input[name="salaryFrom"]', '100000')
    await setTextInput(driver, 'input[name="salaryTo"]', '150000')
    await clickByText(driver, 'button', 'Дальше')
    await clickByText(driver, 'button', 'Дальше')
    await waitForBodyText(driver, 'Готово!')
    await clickByText(driver, 'button', 'Опубликовать')
    await waitForBodyText(driver, 'Вакансия сохранена.')

    return pass(
      cardId,
      `Подсказки адреса отработали последовательно: город "${citySuggestionText}", улица "${streetSuggestionText}", дом "${houseSuggestionText}", и вакансия опубликовалась с текстовым адресом.`,
    )
  } catch (error) {
    return fail(cardId, `Сбой проверки адресных подсказок: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function testCard28FavoritesSync(driver, ctx) {
  const cardId = '69c52fba09ea0bf95a0bbe48'
  try {
    const baseUrl = ctx.baseUrl ?? DEFAULT_BASE_URL
    const seekerEmail = ctx.seekerEmail ?? uniqueEmail('e2e-favorites')
    const seekerPassword = ctx.seekerPassword ?? DEFAULT_TEST_PASSWORD
    const candidateRoutes = ['/', '/events']

    await clearBrowserState(driver, baseUrl)
    let selectedRoute = null
    let favoriteButtons = []

    for (const route of candidateRoutes) {
      await open(driver, baseUrl, route)
      await sleep(1200)
      favoriteButtons = await findVisibleElements(driver, By.css('button.opportunity-card__favorite'))
      if (favoriteButtons.length > 0) {
        selectedRoute = route
        break
      }
    }

    if (!selectedRoute || !favoriteButtons.length) {
      return blocked(cardId, 'Не нашлось ни одной страницы с карточками возможностей для гостевого избранного.')
    }

    await favoriteButtons[0].click()
    await sleep(800)

    const beforeAuthSnapshot = await parseFavoriteSnapshot(driver)
    if (!beforeAuthSnapshot || !Array.isArray(beforeAuthSnapshot.opportunityIds) || beforeAuthSnapshot.opportunityIds.length === 0) {
      return fail(cardId, 'Гостевое избранное не записалось в localStorage.')
    }

    await registerUser(driver, baseUrl, 'seeker', seekerEmail, 'E2E Favorites Seeker', seekerPassword)
    await sleep(1200)

    const afterAuthSnapshot = await parseFavoriteSnapshot(driver)
    if (!afterAuthSnapshot) {
      return fail(cardId, 'После auth snapshot избранного исчез вместо очистки.')
    }

    const vacancyIds = Array.isArray(afterAuthSnapshot.vacancyIds) ? afterAuthSnapshot.vacancyIds : []
    const opportunityIds = Array.isArray(afterAuthSnapshot.opportunityIds) ? afterAuthSnapshot.opportunityIds : []
    if (vacancyIds.length !== 0 || opportunityIds.length !== 0) {
      return fail(cardId, `После auth localStorage не очистился: vacancyIds=${vacancyIds.length}, opportunityIds=${opportunityIds.length}.`)
    }

    await open(driver, baseUrl, selectedRoute)
    await sleep(1200)
    const activeFavorites = await findVisibleElements(
      driver,
      By.css('button.opportunity-card__favorite.btn--icon-active, button.opportunity-card__favorite[aria-label="Убрать из избранного"]'),
    )
    if (!activeFavorites.length) {
      return fail(cardId, 'Синхронизированное избранное не отразилось в UI после авторизации.')
    }

    return pass(cardId, 'Гостевое избранное сохранилось до auth, после регистрации/логина очистилось из localStorage и подтянулось в UI.')
  } catch (error) {
    return fail(cardId, `Сбой синхронизации избранного: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function runCards15252728(driver, ctx = {}) {
  const results = []
  const nextCtx = {
    baseUrl: ctx.baseUrl ?? DEFAULT_BASE_URL,
    adminEmail: ctx.adminEmail ?? DEFAULT_ADMIN_EMAIL,
    adminPassword: ctx.adminPassword ?? DEFAULT_ADMIN_PASSWORD,
    employerEmail: ctx.employerEmail,
    employerPassword: ctx.employerPassword ?? DEFAULT_TEST_PASSWORD,
    seekerEmail: ctx.seekerEmail,
    seekerPassword: ctx.seekerPassword ?? DEFAULT_TEST_PASSWORD,
  }

  results.push(await testCard15EmployerSettings(driver, nextCtx))
  results.push(await testCard25Privacy(driver, nextCtx))
  results.push(await testCard27AddressSuggestions(driver, nextCtx))
  results.push(await testCard28FavoritesSync(driver, nextCtx))

  return results
}
