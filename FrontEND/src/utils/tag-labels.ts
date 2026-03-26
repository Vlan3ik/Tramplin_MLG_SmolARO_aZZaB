const TAG_DISPLAY_MAP: Record<string, string> = {
  hackathon: 'Хакатон',
  lecture: 'Лекция',
  other: 'Другое',
  'open day': 'День открытых дверей',
}

const TAG_GROUP_DISPLAY_MAP: Record<string, string> = {
  eventtype: 'Тип мероприятия',
  eventkind: 'Тип мероприятия',
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9а-яё]/gi, '')
}

export function getTagDisplayLabel(value: string) {
  const normalized = value.trim().toLowerCase()
  return TAG_DISPLAY_MAP[normalized] ?? value
}

export function getTagGroupDisplayLabel(value: string) {
  const normalized = normalizeToken(value)
  return TAG_GROUP_DISPLAY_MAP[normalized] ?? value
}

