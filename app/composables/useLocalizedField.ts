import type { LocalizedString } from '~/types/character'

export function useLocalizedField() {
  const { locale } = useI18n()

  function localize(field: LocalizedString): string {
    if (locale.value === 'zh-TW') return field['zh-TW']
    if (locale.value === 'zh-CN') return field['zh-CN']
    if (locale.value === 'ja') return field.ja
    return field.en
  }

  return { localize }
}
