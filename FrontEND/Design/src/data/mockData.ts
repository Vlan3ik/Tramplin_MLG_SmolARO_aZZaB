export type OpportunityType = 'vacancy' | 'internship' | 'mentorship' | 'event'

export type Opportunity = {
  id: number
  title: string
  type: OpportunityType
  compensation: string
  company: string
  location: string
  workFormat: string
  date: string
  description: string
  tags: string[]
  verified: boolean
  favoriteCompany?: boolean
}

export const typeLabel: Record<OpportunityType, string> = {
  vacancy: 'Вакансия',
  internship: 'Стажировка',
  mentorship: 'Менторство',
  event: 'Мероприятие',
}

export const opportunities: Opportunity[] = [
  {
    id: 1,
    title: 'Frontend Engineer (React + TypeScript)',
    type: 'vacancy',
    compensation: 'от 180 000 ?',
    company: 'CloudLine',
    location: 'Москва',
    workFormat: 'Гибрид',
    date: 'Опубликовано сегодня',
    description:
      'Разработка интерфейсов карьерной платформы, работа с дизайн-системой и совместная реализация продуктовых гипотез.',
    tags: ['React', 'TypeScript', 'Design System', 'A11y'],
    verified: true,
    favoriteCompany: true,
  },
  {
    id: 2,
    title: 'Стажировка Data Analyst',
    type: 'internship',
    compensation: '80 000 ?',
    company: 'Urban Metrics',
    location: 'Санкт-Петербург',
    workFormat: 'Офис / Гибрид',
    date: '2 дня назад',
    description:
      'Анализ продуктовых метрик, подготовка dashboard-отчётов, участие в исследованиях рынка цифровых сервисов.',
    tags: ['SQL', 'Python', 'BI', 'A/B Testing'],
    verified: true,
  },
  {
    id: 3,
    title: 'Менторская программа Product Discovery',
    type: 'mentorship',
    compensation: 'Бесплатно',
    company: 'Launch Academy',
    location: 'Онлайн',
    workFormat: 'Онлайн',
    date: 'Набор до 29 марта',
    description:
      '6-недельная программа с ревью проектов, карьерной консультацией и практикой интервью на роль Product Manager.',
    tags: ['Product', 'Discovery', 'JTBD', 'Roadmap'],
    verified: true,
    favoriteCompany: true,
  },
  {
    id: 4,
    title: 'Career Tech Meetup: AI + Hiring 2026',
    type: 'event',
    compensation: 'Регистрация открыта',
    company: 'IT Planet Community',
    location: 'Казань + онлайн',
    workFormat: 'Гибрид',
    date: '24 марта, 19:00',
    description:
      'Открытая дискуссия работодателей и студентов о будущем найма, карьерных стратегиях и новых ролях в ИТ.',
    tags: ['Meetup', 'Career', 'Networking', 'AI'],
    verified: true,
  },
  {
    id: 5,
    title: 'Junior QA Engineer',
    type: 'vacancy',
    compensation: 'не указано',
    company: 'StackForge',
    location: 'Екатеринбург',
    workFormat: 'Удалённо',
    date: '3 часа назад',
    description:
      'Построение тестовых сценариев, регрессионное тестирование веб-платформы и взаимодействие с командой разработки.',
    tags: ['QA', 'Postman', 'API', 'Cypress'],
    verified: false,
  },
]

export const quickTags = [
  'Frontend',
  'Backend',
  'Data Science',
  'Product',
  'DevOps',
  'UX/UI',
  'Без опыта',
  'Стажировки',
  'Хакатоны',
]

export const filterGroups = [
  {
    title: 'Тип возможности',
    options: ['Вакансии', 'Стажировки', 'Менторство', 'Мероприятия'],
  },
  {
    title: 'Формат работы',
    options: ['Удалённо', 'Гибрид', 'Офис', 'Онлайн'],
  },
  {
    title: 'Уровень',
    options: ['Junior', 'Middle', 'Senior', 'Без опыта'],
  },
  {
    title: 'Зарплата / Оплачиваемость',
    options: ['от 50 000 ?', 'от 100 000 ?', 'Оплачиваемая стажировка', 'Бесплатные программы'],
  },
  {
    title: 'Технологические теги',
    options: ['React', 'Python', 'Java', 'Go', 'ML', 'QA'],
  },
  {
    title: 'Занятость и сроки',
    options: ['Полный день', 'Частичная', 'Проектная', 'Срочно'],
  },
  {
    title: 'Дата публикации',
    options: ['Сегодня', 'За 3 дня', 'За неделю', 'За месяц'],
  },
]

