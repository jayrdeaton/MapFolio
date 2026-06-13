import { onMounted, onUnmounted, ref } from 'vue'

type ColorMode = 'light' | 'dark' | 'system'
const STORAGE_KEY = 'mapfolio_color_mode'

const preference = ref<ColorMode>('system')
const isDark = ref(false)

function applyColorMode(pref: ColorMode) {
  const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = pref === 'dark' || (pref === 'system' && systemIsDark)
  isDark.value = dark
  document.documentElement.classList.toggle('dark', dark)
}

export function useColorMode() {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  function onSystemChange() {
    if (preference.value === 'system') applyColorMode('system')
  }

  function cycle() {
    const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (preference.value === 'system') preference.value = systemIsDark ? 'light' : 'dark'
    else if (preference.value === 'dark') preference.value = systemIsDark ? 'system' : 'light'
    else preference.value = systemIsDark ? 'dark' : 'system'
    localStorage.setItem(STORAGE_KEY, preference.value)
    applyColorMode(preference.value)
  }

  onMounted(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ColorMode | null
    preference.value = stored ?? 'system'
    applyColorMode(preference.value)
    mediaQuery.addEventListener('change', onSystemChange)
  })

  onUnmounted(() => {
    mediaQuery.removeEventListener('change', onSystemChange)
  })

  return { preference, isDark, cycle }
}
