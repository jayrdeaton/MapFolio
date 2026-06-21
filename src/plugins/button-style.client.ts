import { HOVER_STYLE, OUTLINED_BUTTONS } from '@/config/buttons'

// Apply the dev-constant button look as global classes on <html>, consumed by
// the `.mf-ibtn` rules in main.css.
export default defineNuxtPlugin(() => {
  const el = document.documentElement
  el.classList.toggle('mf-outlined', OUTLINED_BUTTONS)
  el.classList.toggle('mf-hover-dim', HOVER_STYLE === 'dim')
})
