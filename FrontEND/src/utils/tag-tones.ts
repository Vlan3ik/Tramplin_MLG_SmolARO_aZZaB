const EXACT_TAG_TONE_MAP: Record<string, string> = {
  '.net': 'opportunity-tag--tech-net',
  'c#': 'opportunity-tag--tech-csharp',
  angular: 'opportunity-tag--tech-angular',
  react: 'opportunity-tag--tech-react',
  vue: 'opportunity-tag--tech-vue',
  java: 'opportunity-tag--tech-java',
  kotlin: 'opportunity-tag--tech-kotlin',
  python: 'opportunity-tag--tech-python',
  go: 'opportunity-tag--tech-go',
  postgresql: 'opportunity-tag--tech-postgresql',
  kafka: 'opportunity-tag--tech-kafka',
  docker: 'opportunity-tag--tech-docker',
  devops: 'opportunity-tag--tech-devops',
  'data science': 'opportunity-tag--tech-data-science',
  qa: 'opportunity-tag--tech-qa',
  internship: 'opportunity-tag--vacancy-internship',
  job: 'opportunity-tag--vacancy-job',
  hackathon: 'opportunity-tag--event-hackathon',
  'open day': 'opportunity-tag--event-open-day',
  lecture: 'opportunity-tag--event-lecture',
  other: 'opportunity-tag--event-other',
}

export function getTagToneClass(tag: string) {
  const key = tag.trim().toLowerCase()
  return EXACT_TAG_TONE_MAP[key] ?? 'opportunity-tag--default'
}
