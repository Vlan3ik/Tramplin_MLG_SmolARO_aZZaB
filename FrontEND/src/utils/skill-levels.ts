export const SKILL_LEVEL_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Новичок' },
  { value: 2, label: 'Джуниор' },
  { value: 3, label: 'Мидл' },
  { value: 4, label: 'Сеньор' },
  { value: 5, label: 'Эксперт' },
]

function clampLevel(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1
  }

  return Math.max(1, Math.min(5, Math.round(value)))
}

export function getSkillLevelLabel(value: number | null | undefined) {
  const normalized = clampLevel(value)
  return SKILL_LEVEL_OPTIONS.find((item) => item.value === normalized)?.label ?? 'Новичок'
}

export function formatSkillLevelDisplay(value: number | null | undefined) {
  const normalized = clampLevel(value)
  return `${getSkillLevelLabel(normalized)} (${normalized}/5)`
}
