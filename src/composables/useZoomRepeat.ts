export function useZoomRepeat() {
  let timer: ReturnType<typeof setTimeout> | null = null
  let interval: ReturnType<typeof setInterval> | null = null

  function startZoomRepeat(fn: () => void, atLimit: () => boolean) {
    stopZoomRepeat()
    if (atLimit()) return
    fn()
    timer = setTimeout(() => {
      interval = setInterval(() => {
        if (atLimit()) {
          stopZoomRepeat()
          return
        }
        fn()
      }, 350)
    }, 500)
  }

  function stopZoomRepeat() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (interval) {
      clearInterval(interval)
      interval = null
    }
  }

  return { startZoomRepeat, stopZoomRepeat }
}
