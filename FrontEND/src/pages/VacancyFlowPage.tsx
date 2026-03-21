import { useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import './VacancyFlowPage.css'

type Step = 1 | 2 | 3 | 4 | 5
type FlowType = 'vacancy' | 'event'

const steps = ['Выбор', 'Основные', 'Описание', 'Стоимость и опции', 'Публикация']
const validSteps = new Set(['1', '2', '3', '4', '5'])

type StepperProps = {
  activeStep: Step
}

function Stepper({ activeStep }: StepperProps) {
  return (
    <div className="vf-stepper" aria-label="Прогресс создания">
      {steps.map((label, index) => {
        const stepNumber = (index + 1) as Step
        const isActive = stepNumber === activeStep
        const isDone = stepNumber < activeStep
        const isLast = stepNumber === 5

        return (
          <div
            className={`vf-stepper__item ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''} ${isLast ? 'is-last' : ''}`}
            key={label}
          >
            <div className={`vf-stepper__dot ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}>
              {stepNumber}
            </div>
            <span className={`vf-stepper__label ${isActive ? 'is-active' : ''}`}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function VacancyFlowPage() {
  const { step } = useParams<{ step?: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [eventChatEnabled, setEventChatEnabled] = useState(true)

  if (!step || !validSteps.has(step)) {
    return <Navigate to="/vacancy-flow/1" replace />
  }

  const currentStep = Number(step) as Step
  const flowType: FlowType = searchParams.get('type') === 'event' ? 'event' : 'vacancy'
  const isVacancyFlow = flowType === 'vacancy'

  function navigateSmooth(url: string) {
    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => void
    }

    if (doc.startViewTransition) {
      doc.startViewTransition(() => {
        navigate(url)
      })
      return
    }

    navigate(url)
  }

  function goStep(nextStep: Step, type: FlowType = flowType) {
    navigateSmooth(`/vacancy-flow/${nextStep}?type=${type}`)
  }

  function nextStep() {
    const next = Math.min(5, currentStep + 1) as Step
    goStep(next)
  }

  function prevStep() {
    const prev = Math.max(1, currentStep - 1) as Step
    goStep(prev)
  }

  return (
    <div className="vf-page">
      <main className="vf-content">
        <section className="vf-section">
          <Stepper activeStep={currentStep} />

          <div key={`${currentStep}-${flowType}`} className="vf-stage">
            {currentStep === 1 ? (
              <>
                <h1 className="vf-title">Выберите, что хотите создать</h1>
                <div className="vf-choice-grid">
                  <article className="vf-choice-card">
                    <img src="/чел сидит на цветке.svg" alt="Иллюстрация создания вакансии" />
                    <h2>Я хочу создать вакансию/стажировку</h2>
                    <p>
                      Разместите предложение о работе или стажировке, чтобы найти талантливых
                      кандидатов в свою команду.
                    </p>
                    <button
                      type="button"
                      className="vf-btn vf-btn--primary"
                      onClick={() => goStep(2, 'vacancy')}
                    >
                      Создать
                    </button>
                  </article>

                  <article className="vf-choice-card">
                    <img src="/чел стоит рядом цветок.svg" alt="Иллюстрация создания мероприятия" />
                    <h2>Я хочу создать мероприятие</h2>
                    <p>
                      Создайте страницу события, организовывайте мастер-классы, вебинары и
                      встречи.
                    </p>
                    <button
                      type="button"
                      className="vf-btn vf-btn--primary"
                      onClick={() => goStep(2, 'event')}
                    >
                      Создать
                    </button>
                  </article>
                </div>
              </>
            ) : null}

            {currentStep === 2 ? (
              <>
                <h2 className="vf-title">Основная информация</h2>

                <div className="vf-form-grid">
                  <label className="vf-field vf-field--full">
                    <span>Название</span>
                    <input
                      type="text"
                      placeholder={
                        isVacancyFlow ? 'Например, Frontend-разработчик' : 'Например, Хакатон Трамплин'
                      }
                    />
                  </label>

                  <label className="vf-field">
                    <span>Вид</span>
                    {isVacancyFlow ? (
                      <select defaultValue="Работа">
                        <option>Работа</option>
                        <option>Стажировка</option>
                      </select>
                    ) : (
                      <select defaultValue="Хакатон">
                        <option>Хакатон</option>
                        <option>Митап</option>
                        <option>Вебинар</option>
                        <option>Мастер-класс</option>
                      </select>
                    )}
                  </label>
                  <label className="vf-field">
                    <span>Формат</span>
                    <select defaultValue={isVacancyFlow ? 'Офис' : 'Онлайн'}>
                      <option>Офис</option>
                      <option>Онлайн</option>
                      <option>Гибрид</option>
                    </select>
                  </label>
                  <label className="vf-field">
                    <span>Статус</span>
                    <select defaultValue="Черновик">
                      <option>Черновик</option>
                      <option>Опубликовано</option>
                    </select>
                  </label>
                  <label className="vf-field">
                    <span>Город</span>
                    <select defaultValue="Не выбран">
                      <option>Не выбран</option>
                      <option>Москва</option>
                      <option>Санкт-Петербург</option>
                    </select>
                  </label>
                  <label className="vf-field">
                    <span>Локация</span>
                    <select defaultValue="Не выбрана">
                      <option>Не выбрана</option>
                      <option>Офис на месте</option>
                      <option>Удаленно</option>
                    </select>
                  </label>
                </div>

                <div className="vf-tags">
                  <span className="vf-tags__label">Теги</span>
                  <div className="vf-tags__list">
                    {isVacancyFlow ? (
                      <>
                        <span>Frontend</span>
                        <span>UX/UI</span>
                        <span>Дизайн сайта</span>
                        <span>Стажировка</span>
                      </>
                    ) : (
                      <>
                        <span>Хакатон</span>
                        <span>ML</span>
                        <span>Студенты</span>
                        <span>Вебинар</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="vf-actions">
                  <button type="button" className="vf-btn vf-btn--secondary" onClick={prevStep}>
                    Назад
                  </button>
                  <button type="button" className="vf-btn vf-btn--primary" onClick={nextStep}>
                    Дальше
                  </button>
                </div>
              </>
            ) : null}

            {currentStep === 3 ? (
              <>
                <h2 className="vf-title">Описание</h2>
                <div className="vf-editor-grid">
                  <label className="vf-editor">
                    <span>Краткое описание</span>
                    <textarea
                      rows={7}
                      placeholder={
                        isVacancyFlow
                          ? 'Кратко опишите свою вакансию'
                          : 'Кратко опишите ваше мероприятие'
                      }
                    />
                  </label>
                  <label className="vf-editor">
                    <span>Полное описание</span>
                    <textarea
                      rows={7}
                      placeholder={
                        isVacancyFlow
                          ? 'Полно опишите свою вакансию'
                          : 'Полно опишите программу и условия участия'
                      }
                    />
                  </label>
                </div>

                <div className="vf-actions">
                  <button type="button" className="vf-btn vf-btn--secondary" onClick={prevStep}>
                    Назад
                  </button>
                  <button type="button" className="vf-btn vf-btn--primary" onClick={nextStep}>
                    Дальше
                  </button>
                </div>
              </>
            ) : null}

            {currentStep === 4 ? (
              <>
                <h2 className="vf-title">Стоимость и опции</h2>

                {isVacancyFlow ? (
                  <div className="vf-form-grid vf-form-grid--salary">
                    <label className="vf-field">
                      <span>Зарплата от</span>
                      <input type="number" placeholder="Например, 20000" />
                    </label>
                    <label className="vf-field">
                      <span>Зарплата до</span>
                      <input type="number" placeholder="Например, 50000" />
                    </label>
                    <label className="vf-field vf-field--full">
                      <span>Налоговый режим зарплаты</span>
                      <select defaultValue="Не указано">
                        <option>Не указано</option>
                        <option>До вычета налогов</option>
                        <option>После вычета налогов</option>
                      </select>
                    </label>
                    <label className="vf-field vf-field--full">
                      <span>Дедлайн откликов</span>
                      <input type="date" />
                    </label>
                  </div>
                ) : (
                  <div className="vf-form-grid vf-form-grid--event">
                    <label className="vf-field">
                      <span>Тип цены</span>
                      <select defaultValue="Платно">
                        <option>Платно</option>
                        <option>Бесплатно</option>
                      </select>
                    </label>
                    <label className="vf-field">
                      <span>Сумма</span>
                      <input type="number" placeholder="Например, 2000" />
                    </label>
                    <label className="vf-field">
                      <span>Дата события</span>
                      <input type="datetime-local" />
                    </label>

                    <div className="vf-switch-row">
                      <span>Участники группы могут писать в чат</span>
                      <button
                        type="button"
                        className={`vf-switch ${eventChatEnabled ? 'is-on' : ''}`}
                        onClick={() => setEventChatEnabled((prev) => !prev)}
                        aria-pressed={eventChatEnabled}
                      >
                        <span className="vf-switch__thumb" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="vf-actions">
                  <button type="button" className="vf-btn vf-btn--secondary" onClick={prevStep}>
                    Назад
                  </button>
                  <button type="button" className="vf-btn vf-btn--primary" onClick={nextStep}>
                    Дальше
                  </button>
                </div>
              </>
            ) : null}

            {currentStep === 5 ? (
              <div className="vf-section--publish">
                <h2 className="vf-congrats">Поздравляем!</h2>
                <p className="vf-congrats__text">
                  {isVacancyFlow
                    ? 'Ваша вакансия отправлена на модерацию и скоро появится в поиске.'
                    : 'Ваше мероприятие отправлено на модерацию и скоро появится в поиске.'}
                </p>
                <img
                  className="vf-congrats__image"
                  src="/гордый чел стоит.svg"
                  alt="Иллюстрация успешной отправки"
                />
                <div className="vf-actions">
                  <button type="button" className="vf-btn vf-btn--secondary" onClick={prevStep}>
                    Назад
                  </button>
                  <button type="button" className="vf-btn vf-btn--primary">
                    Опубликовать
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  )
}

