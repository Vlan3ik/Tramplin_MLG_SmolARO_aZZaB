import { Builder, By, until } from 'selenium-webdriver'

const DEFAULT_BASE_URL = 'http://localhost:5173'
const DEFAULT_ADMIN_EMAIL = 'admin@tramplin.local'
const DEFAULT_ADMIN_PASSWORD = 'Admin123!'
const DEFAULT_TEST_PASSWORD = 'TestPass123!'
const WAIT_MS = 25000

function uniqueValue(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
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

async function waitForVisible(driver, locator, timeout = WAIT_MS) {
  const element = await driver.wait(until.elementLocated(locator), timeout)
  await driver.wait(until.elementIsVisible(element), timeout)
  return element
}

async function open(driver, path = '/', baseUrl = DEFAULT_BASE_URL) {
  await driver.get(`${baseUrl}${path}`)
}

async function clearBrowserState(driver, baseUrl = DEFAULT_BASE_URL) {
  await driver.manage().deleteAllCookies()
  await driver.get(`${baseUrl}/`)
  await driver.executeScript('window.localStorage.clear(); window.sessionStorage.clear();')
}

async function clickByText(driver, tag, text, timeout = WAIT_MS) {
  const element = await waitForVisible(
    driver,
    By.xpath(`//${tag}[contains(normalize-space(.), ${JSON.stringify(text)})]`),
    timeout,
  )
  await element.click()
  return element
}

async function setInputValue(driver, locator, value) {
  const input = await waitForVisible(driver, locator)
  await input.clear()
  await input.sendKeys(value)
  return input
}

async function setSelectByText(driver, selectLocator, optionText) {
  const select = await waitForVisible(driver, selectLocator)
  const options = await select.findElements(By.css('option'))
  for (const option of options) {
    const text = normalizeText(await option.getText())
    if (text === normalizeText(optionText) || text.includes(normalizeText(optionText))) {
      await option.click()
      return option
    }
  }
  throw new Error(`Не найден option с текстом "${optionText}".`)
}

async function setSelectByValue(driver, selectLocator, value) {
  const select = await waitForVisible(driver, selectLocator)
  const options = await select.findElements(By.css('option'))
  for (const option of options) {
    if (String(await option.getAttribute('value')) === String(value)) {
      await option.click()
      return option
    }
  }
  throw new Error(`Не найден option со значением "${value}".`)
}

async function getFieldValue(driver, locator) {
  const element = await waitForVisible(driver, locator)
  const tagName = normalizeText(await element.getTagName())
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return normalizeText(await element.getAttribute('value'))
  }
  return normalizeText(await element.getText())
}

function makeResult(cardId, status, details) {
  return { cardId, status, details }
}

function pass(cardId, details) {
  return makeResult(cardId, 'PASS', details)
}

function blocked(cardId, details) {
  return makeResult(cardId, 'BLOCKED', details)
}

function fail(cardId, details) {
  return makeResult(cardId, 'FAIL', details)
}

async function login(driver, email, password, baseUrl = DEFAULT_BASE_URL) {
  await open(driver, '/login', baseUrl)
  await setInputValue(driver, By.css('input[name="email"]'), email)
  await setInputValue(driver, By.css('input[name="password"]'), password)
  await clickByText(driver, 'button', 'Войти')
  await driver.wait(async () => {
    const url = await driver.getCurrentUrl()
    return url.includes('/dashboard') || url.includes('/verification/employer')
  }, WAIT_MS)
}

async function registerUser(driver, roleText, email, fio, password, baseUrl = DEFAULT_BASE_URL) {
  await open(driver, '/register', baseUrl)

  if (roleText === 'employer') {
    const cards = await driver.findElements(By.css('button.auth-role-card'))
    if (cards.length >= 2) {
      await cards[1].click()
    }
  } else if (roleText === 'seeker') {
    const cards = await driver.findElements(By.css('button.auth-role-card'))
    if (cards.length >= 1) {
      await cards[0].click()
    }
  }

  await setInputValue(driver, By.css('input[name="email"]'), email)
  await setInputValue(driver, By.css('input[name="fullName"]'), fio)
  await setInputValue(driver, By.css('input[name="password"]'), password)
  await clickByText(driver, 'button', 'Создать аккаунт')

  await driver.wait(async () => {
    const url = await driver.getCurrentUrl()
    return url.includes('/dashboard') || url.includes('/verification/employer')
  }, WAIT_MS)
}

async function ensureEmployerCompany(driver, ctx, employerEmail, companyName) {
  await driver.wait(async () => {
    const url = await driver.getCurrentUrl()
    return url.includes('/dashboard/employer') || url.includes('/verification/employer')
  }, WAIT_MS)

  await open(driver, '/dashboard/employer', ctx.baseUrl)
  const createTitle = await driver.findElements(By.xpath('//*[contains(normalize-space(.), "Создание компании")]'))
  if (createTitle.length > 0) {
    await setInputValue(driver, By.css('input[name="legalName"]'), `${companyName} LLC`)
    const brand = await driver.findElements(By.css('input[name="brandName"]'))
    if (brand.length > 0) {
      await brand[0].clear()
      await brand[0].sendKeys(companyName)
    }
    await clickByText(driver, 'button', 'Создать компанию')
    await driver.wait(async () => {
      const body = normalizeText(await driver.getPageSource())
      return !body.includes('создание компании') && body.includes('настройки чата')
    }, WAIT_MS)
  }

  return {
    employerEmail,
    companyName,
    password: ctx.testPassword,
  }
}

async function verifyEmployerCompanyInAdmin(driver, ctx, companyName) {
  await login(driver, ctx.adminEmail, ctx.adminPassword, ctx.baseUrl)
  await open(driver, '/dashboard/curator', ctx.baseUrl)
  await clickByText(driver, 'button', 'Компании')
  await setInputValue(driver, By.xpath('//input[contains(@placeholder, "названию") or contains(@placeholder, "названию/индустрии")]'), companyName)
  await clickByText(driver, 'button', 'Найти')
  const companyCard = await waitForVisible(driver, By.xpath(`//article[contains(.,"${companyName}")]`))
  const verifyButtons = await companyCard.findElements(By.xpath('.//button[contains(normalize-space(.), "Подтвердить")]'))
  if (!verifyButtons.length) {
    return false
  }
  await verifyButtons[0].click()
  await driver.wait(async () => normalizeText(await driver.getPageSource()).includes('компания подтверждена'), WAIT_MS)
  return true
}

async function createAdminVacancy(driver, ctx, companyName, authorEmail, vacancyTitle) {
  await login(driver, ctx.adminEmail, ctx.adminPassword, ctx.baseUrl)
  await open(driver, '/dashboard/curator/vacancies/create', ctx.baseUrl)

  await setSelectByText(driver, By.css('select[name="companyId"]'), companyName)
  await setSelectByText(driver, By.css('select[name="createdByUserId"]'), authorEmail)
  await setInputValue(driver, By.css('input[name="title"]'), vacancyTitle)
  await setInputValue(driver, By.css('textarea[name="shortDescription"]'), `${vacancyTitle} short`)
  await setInputValue(driver, By.css('textarea[name="fullDescription"]'), `${vacancyTitle} full description for selenium coverage`)
  await setSelectByValue(driver, By.css('select[name="status"]'), '2')
  await clickByText(driver, 'button', 'Создать вакансию')

  await driver.wait(async () => normalizeText(await driver.getPageSource()).includes('вакансия успешно создана'), WAIT_MS)
  return vacancyTitle
}

async function approveVacancyInAdmin(driver, ctx, vacancyTitle) {
  await login(driver, ctx.adminEmail, ctx.adminPassword, ctx.baseUrl)
  await open(driver, '/dashboard/curator', ctx.baseUrl)
  await clickByText(driver, 'button', 'Вакансии')
  await setInputValue(driver, By.css('input[placeholder*="заголовку"]'), vacancyTitle)
  await clickByText(driver, 'button', 'Найти')
  const card = await waitForVisible(driver, By.xpath(`//article[contains(.,"${vacancyTitle}")]`))
  const statusSelect = await card.findElement(By.css('select'))
  const options = await statusSelect.findElements(By.css('option'))
  for (const option of options) {
    const text = normalizeText(await option.getText())
    if (text === 'активно') {
      await option.click()
      break
    }
  }
  await driver.wait(async () => normalizeText(await card.getText()).includes('активно'), WAIT_MS)
}

async function createSeekerApplication(driver, ctx, seekerEmail, vacancyTitle) {
  await registerUser(driver, 'seeker', seekerEmail, uniqueValue('Seeker'), ctx.testPassword, ctx.baseUrl)
  await open(driver, '/', ctx.baseUrl)
  await setInputValue(driver, By.css('input[placeholder="Адрес, должность, компания или мероприятие"]'), vacancyTitle)
  await clickByText(driver, 'button', 'Найти')
  await clickByText(driver, 'button', 'Список')
  await waitForVisible(driver, By.css('article.opportunity-card'))
  const cards = await driver.findElements(By.css('article.opportunity-card'))
  let targetCard = null
  for (const card of cards) {
    const title = await card.findElements(By.css('h3.opportunity-card__title'))
    if (title.length) {
      const text = normalizeText(await title[0].getText())
      if (text.includes(normalizeText(vacancyTitle))) {
        targetCard = card
        break
      }
    }
  }
  if (!targetCard) {
    throw new Error(`Не найден публичный список с вакансией "${vacancyTitle}".`)
  }
  await targetCard.click()
  await waitForVisible(driver, By.css('.opportunity-page'))
  await clickByText(driver, 'button', 'Откликнуться')
  await driver.wait(async () => normalizeText(await driver.getPageSource()).includes('отклик отправлен'), WAIT_MS)
}

async function getEmployerApplicationCard(driver, vacancyTitle) {
  const cards = await driver.findElements(By.css('.employer-application-card'))
  for (const card of cards) {
    const head = await card.findElements(By.css('h3'))
    if (!head.length) {
      continue
    }
    const text = normalizeText(await head[0].getText())
    if (text.includes(normalizeText(vacancyTitle))) {
      return card
    }
  }
  return null
}

async function findChatWidgetItemByText(driver, text) {
  const expected = normalizeText(text)
  const items = await driver.findElements(By.css('.chat-widget__list-item'))

  for (const item of items) {
    const titleNodes = await item.findElements(By.css('strong'))
    const metaNodes = await item.findElements(By.css('.chat-widget__list-item-meta span'))
    const haystack = normalizeText(
      [titleNodes[0] ? await titleNodes[0].getText() : '', metaNodes[0] ? await metaNodes[0].getText() : ''].join(' '),
    )

    if (haystack.includes(expected)) {
      return item
    }
  }

  return null
}

async function prepareVacancyAndApplication(ctx) {
  const employerEmail = uniqueValue('employer') + '@example.test'
  const seekerEmail = uniqueValue('seeker') + '@example.test'
  const companyName = uniqueValue('Tramplin Company')
  const vacancyTitle = uniqueValue('Selenium Vacancy')
  const driver = ctx.driver

  await clearBrowserState(driver, ctx.baseUrl)
  await registerUser(driver, 'employer', employerEmail, companyName, ctx.testPassword, ctx.baseUrl)
  await ensureEmployerCompany(driver, ctx, employerEmail, companyName)
  await verifyEmployerCompanyInAdmin(driver, ctx, companyName)
  await createAdminVacancy(driver, ctx, companyName, employerEmail, vacancyTitle)
  await approveVacancyInAdmin(driver, ctx, vacancyTitle)
  await createSeekerApplication(driver, ctx, seekerEmail, vacancyTitle)

  return {
    employerEmail,
    seekerEmail,
    companyName,
    vacancyTitle,
  }
}

async function setupEmployerWithCompany(ctx, employerEmail = uniqueValue('employer') + '@example.test') {
  const companyName = uniqueValue('Tramplin Company')
  const driver = ctx.driver
  await clearBrowserState(driver, ctx.baseUrl)
  await registerUser(driver, 'employer', employerEmail, companyName, ctx.testPassword, ctx.baseUrl)
  await ensureEmployerCompany(driver, ctx, employerEmail, companyName)
  return {
    employerEmail,
    companyName,
  }
}

async function testCard24EmployerSettings(ctx) {
  const cardId = '69c52fb8f99889a4672c8aa9'
  try {
    const { employerEmail, companyName } = await setupEmployerWithCompany(ctx)
    const driver = ctx.driver

    await open(driver, '/dashboard/employer', ctx.baseUrl)
    await clickByText(driver, 'button', 'Настройки чата')

    const autoGreeting = await waitForVisible(driver, By.css('input[name="autoGreetingEnabled"]'))
    const greetingText = await waitForVisible(driver, By.css('textarea[name="autoGreetingText"]'))
    const outsideHours = await waitForVisible(driver, By.css('input[name="outsideHoursEnabled"]'))
    const outsideText = await waitForVisible(driver, By.css('textarea[name="outsideHoursText"]'))
    const timezone = await waitForVisible(driver, By.css('input[name="workingHoursTimezone"]'))
    const fromTime = await waitForVisible(driver, By.css('input[name="workingHoursFrom"]'))
    const toTime = await waitForVisible(driver, By.css('input[name="workingHoursTo"]'))
    const linkKind = await waitForVisible(driver, By.css('select[name="linkKind"]'))
    const url = await waitForVisible(driver, By.css('input[name="url"]'))
    const label = await waitForVisible(driver, By.css('input[name="label"]'))

    await autoGreeting.click()
    await greetingText.clear()
    await greetingText.sendKeys(`Здравствуйте! Это автоприветствие ${companyName}.`)
    await outsideHours.click()
    await outsideText.clear()
    await outsideText.sendKeys('Спасибо за сообщение. Ответим в рабочее время.')
    await timezone.clear()
    await timezone.sendKeys('Europe/Moscow')
    await fromTime.clear()
    await fromTime.sendKeys('09:00')
    await toTime.clear()
    await toTime.sendKeys('18:00')
    await setSelectByValue(driver, By.css('select[name="linkKind"]'), '1')
    await url.clear()
    await url.sendKeys('https://example.com')
    await label.clear()
    await label.sendKeys('Main site')

    const saveChatSettings = await clickByText(driver, 'button', 'Сохранить чат-настройки')
    if (!saveChatSettings) {
      return fail(cardId, 'Не удалось нажать кнопку сохранения chat settings.')
    }
    await driver.wait(async () => normalizeText(await driver.getPageSource()).includes('сохран'), WAIT_MS)

    await driver.navigate().refresh()
    await clickByText(driver, 'button', 'Настройки чата')
    const savedGreeting = await getFieldValue(driver, By.css('textarea[name="autoGreetingText"]'))
    const savedUrl = await getFieldValue(driver, By.css('input[name="url"]'))
    const savedLabel = await getFieldValue(driver, By.css('input[name="label"]'))
    const savedTimezone = await getFieldValue(driver, By.css('input[name="workingHoursTimezone"]'))

    if (!savedGreeting.includes('автоприветствие') || savedUrl !== 'https://example.com' || savedLabel !== 'Main site' || savedTimezone !== 'europe/moscow') {
      return fail(
        cardId,
        `Настройки не сохранились как ожидалось. greeting="${savedGreeting}", url="${savedUrl}", label="${savedLabel}", timezone="${savedTimezone}".`,
      )
    }

    return pass(
      cardId,
      `Секция настроек работодателя открывается, chat settings и публичная ссылка доступны, значения сохраняются после reload. Employer=${employerEmail}.`,
    )
  } catch (error) {
    return fail(cardId, `Сбой проверки настроек работодателя: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function testCard37ApplicationStatuses(ctx) {
  const cardId = '69c664f1a811b67480742739'
  const driver = ctx.driver
  try {
    const setup = await prepareVacancyAndApplication(ctx)
    await clearBrowserState(driver, ctx.baseUrl)
    await login(driver, setup.employerEmail, ctx.testPassword, ctx.baseUrl)
    await open(driver, '/dashboard/employer', ctx.baseUrl)
    await clickByText(driver, 'button', 'Отклики')

    const card = await getEmployerApplicationCard(driver, setup.vacancyTitle)
    if (!card) {
      return blocked(cardId, `Не найден карточка отклика для вакансии "${setup.vacancyTitle}".`)
    }

    const observedStatuses = []
    const expectedStatuses = ['На рассмотрении', 'Интервью', 'Оффер', 'Нанят']

    for (const expected of expectedStatuses) {
      const activeCard = await getEmployerApplicationCard(driver, setup.vacancyTitle)
      if (!activeCard) {
        return fail(cardId, `Отклик для вакансии "${setup.vacancyTitle}" пропал из списка во время смены статуса.`)
      }

      const buttons = await activeCard.findElements(By.css('.employer-application-actions__steps button'))
      if (!buttons.length) {
        return fail(cardId, `Для отклика "${setup.vacancyTitle}" нет кнопок пошаговой смены статуса.`)
      }

      let clicked = false
      for (const button of buttons) {
        const text = normalizeText(await button.getText())
        if (text === normalizeText(expected)) {
          await button.click()
          clicked = true
          break
        }
      }
      if (!clicked) {
        return fail(cardId, `Не нашлась кнопка статуса "${expected}" для отклика "${setup.vacancyTitle}".`)
      }

      await driver.wait(async () => {
        const refreshed = await getEmployerApplicationCard(driver, setup.vacancyTitle)
        if (!refreshed) {
          return false
        }
        const label = await refreshed.findElements(By.css('.status-chip'))
        if (!label.length) {
          return false
        }
        const value = normalizeText(await label[0].getText())
        observedStatuses.push(value)
        return value.includes(normalizeText(expected))
      }, WAIT_MS)
    }

    const chatFab = await waitForVisible(driver, By.css('button.chat-widget__fab'))
    await chatFab.click()
    await waitForVisible(driver, By.css('section.chat-widget__panel'))
    const targetChat = await findChatWidgetItemByText(driver, setup.vacancyTitle)
    if (!targetChat) {
      return blocked(cardId, `Не найден чат с вакансионным названием "${setup.vacancyTitle}" для проверки системного сообщения.`)
    }
    await targetChat.click()
    await waitForVisible(driver, By.css('.chat-widget__thread'))
    const messages = await driver.findElements(By.css('.chat-widget__message.is-system'))
    const systemTexts = []
    for (const message of messages) {
      systemTexts.push(normalizeText(await message.getText()))
    }
    const hasStatusLog = systemTexts.some((text) => text.includes('статус') || text.includes('отклик'))
    if (!hasStatusLog) {
      return blocked(cardId, 'Статус отклика сменился, но системное сообщение в чате не найдено в UI.')
    }

    return pass(
      cardId,
      `Ступени отклика пройдены: ${expectedStatuses.join(' -> ')}. Системное сообщение в чате видно. Отслеженные статусы: ${observedStatuses.join(', ')}.`,
    )
  } catch (error) {
    return fail(cardId, `Сбой проверки step-by-step статусов отклика: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function createSecondaryDriver(ctx) {
  const secondary = await new Builder().forBrowser('chrome').build()
  await secondary.manage().window().setRect({ width: 1440, height: 1000, x: 0, y: 0 })
  await secondary.manage().setTimeouts({ implicit: 0, pageLoad: 60000, script: 30000 })
  return secondary
}

async function testCard30ChatIndicators(ctx) {
  const cardId = '69c52fda9f209980fb8a5361'
  const mainDriver = ctx.driver
  let secondaryDriver = null

  try {
    const setup = await prepareVacancyAndApplication(ctx)

    await clearBrowserState(mainDriver, ctx.baseUrl)
    await login(mainDriver, setup.employerEmail, ctx.testPassword, ctx.baseUrl)
    await open(mainDriver, '/dashboard/employer', ctx.baseUrl)

    await mainDriver.executeScript(`
      window.__playedNotificationSounds = [];
      const originalPlay = HTMLMediaElement.prototype.play;
      if (!HTMLMediaElement.prototype.__tramplinPatched) {
        HTMLMediaElement.prototype.__tramplinPatched = true;
        HTMLMediaElement.prototype.play = function patchedPlay() {
          try {
            const src = this.currentSrc || this.src || '';
            window.__playedNotificationSounds.push(src);
          } catch {}
          return originalPlay.apply(this, arguments);
        };
      }
      try {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      } catch {}
    `)

    const chatFab = await waitForVisible(mainDriver, By.css('button.chat-widget__fab'))
    await chatFab.click()
    await waitForVisible(mainDriver, By.css('section.chat-widget__panel'))
    const employerChat = await findChatWidgetItemByText(mainDriver, setup.vacancyTitle)
    if (!employerChat) {
      return blocked(cardId, `Не найден чат работодателя по вакансии "${setup.vacancyTitle}".`)
    }
    await employerChat.click()
    await waitForVisible(mainDriver, By.css('.chat-widget__thread'))

    secondaryDriver = await createSecondaryDriver(ctx)
    await clearBrowserState(secondaryDriver, ctx.baseUrl)
    await login(secondaryDriver, setup.seekerEmail, ctx.testPassword, ctx.baseUrl)
    await open(secondaryDriver, '/dashboard/seeker', ctx.baseUrl)
    const seekerChatFab = await waitForVisible(secondaryDriver, By.css('button.chat-widget__fab'))
    await seekerChatFab.click()
    await waitForVisible(secondaryDriver, By.css('section.chat-widget__panel'))
    const seekerChat = await findChatWidgetItemByText(secondaryDriver, setup.vacancyTitle)
    if (!seekerChat) {
      return blocked(cardId, `Не найден чат соискателя по вакансии "${setup.vacancyTitle}".`)
    }
    await seekerChat.click()
    await waitForVisible(secondaryDriver, By.css('.chat-widget__thread'))
    const composer = await waitForVisible(secondaryDriver, By.css('.chat-widget__composer-row input'))
    await composer.sendKeys(`Notification ping ${uniqueValue('msg')}`)
    const sendButton = await waitForVisible(secondaryDriver, By.css('.chat-widget__composer-row .btn.btn--primary'))
    await sendButton.click()

    await mainDriver.executeScript('window.dispatchEvent(new Event("tramplin:chat-refresh"))')
    await mainDriver.wait(async () => {
      const badge = await mainDriver.findElements(By.css('.chat-widget__fab-count'))
      if (!badge.length) {
        return false
      }
      return Number.parseInt(normalizeText(await badge[0].getText()), 10) > 0
    }, WAIT_MS)

    const unreadBadge = await mainDriver.findElements(By.css('.chat-widget__unread-badge'))
    const threadUnreadBadge = await mainDriver.findElements(By.css('.chat-widget__unread-badge--inline'))
    const playedSounds = await mainDriver.executeScript('return window.__playedNotificationSounds || [];')

    if (!unreadBadge.length) {
      return blocked(cardId, 'FAB обновился, но badge в списке чатов не появился.')
    }
    if (!threadUnreadBadge.length) {
      return blocked(cardId, 'FAB обновился, но badge в активном треде не появился.')
    }
    if (!Array.isArray(playedSounds) || playedSounds.length === 0) {
      return blocked(cardId, 'Badge сработали, но событие play для уведомляющего звука не было зафиксировано.')
    }

    return pass(
      cardId,
      `FAB, badge в списке и badge в активном треде появились после нового сообщения. Зафиксирован звук: ${playedSounds.join(', ')}.`,
    )
  } catch (error) {
    return fail(cardId, `Сбой проверки чат-индикаторов и звука: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    if (secondaryDriver) {
      try {
        await secondaryDriver.quit()
      } catch {}
    }
  }
}

export async function runCards243037(driver, ctx = {}) {
  const runtimeCtx = {
    driver,
    baseUrl: ctx.baseUrl ?? DEFAULT_BASE_URL,
    adminEmail: ctx.adminEmail ?? DEFAULT_ADMIN_EMAIL,
    adminPassword: ctx.adminPassword ?? DEFAULT_ADMIN_PASSWORD,
    testPassword: ctx.testPassword ?? DEFAULT_TEST_PASSWORD,
  }

  const results = []

  results.push(await testCard24EmployerSettings(runtimeCtx))
  results.push(await testCard30ChatIndicators(runtimeCtx))
  results.push(await testCard37ApplicationStatuses(runtimeCtx))

  return results
}
