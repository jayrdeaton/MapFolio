export default defineNuxtPlugin(() => {
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual'
  }

  window.addEventListener('pageshow', (e) => {
    if (e.persisted) window.location.reload()
  })

  let hiddenAt: number | null = null
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
    } else if (hiddenAt && Date.now() - hiddenAt > 6 * 60 * 60 * 1000) {
      window.location.reload()
    }
  })
})
