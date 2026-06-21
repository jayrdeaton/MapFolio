import { onBeforeUnmount, type Ref, watch } from 'vue'

// Fires `onLongPress` after a ~600ms touch hold that hasn't moved more than
// 10px, then swallows the synthetic click so the element's tap handler doesn't
// also fire. The touch equivalent of a right-click — mirrors the map-level
// long press in `useLongPress.ts`, but bound to an arbitrary DOM element.
export function useElementLongPress(elRef: Ref<HTMLElement | null>, onLongPress: (x: number, y: number) => void): void {
  let timer: ReturnType<typeof setTimeout> | null = null
  let start: { x: number; y: number } | null = null
  let fired = false

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]!
    start = { x: t.clientX, y: t.clientY }
    fired = false
    timer = setTimeout(() => {
      if (!start) return
      fired = true
      window.getSelection()?.removeAllRanges()
      onLongPress(start.x, start.y)
      start = null
    }, 600)
  }

  const onTouchMove = (e: TouchEvent) => {
    if (!start || !timer) return
    const t = e.touches[0]!
    if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) {
      clearTimeout(timer)
      timer = null
    }
  }

  const onTouchEnd = () => {
    if (fired) {
      fired = false
      const swallow = (ce: MouseEvent) => {
        ce.preventDefault()
        ce.stopImmediatePropagation()
      }
      document.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 300)
    }
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    start = null
  }

  let bound: HTMLElement | null = null
  const detach = () => {
    if (!bound) return
    bound.removeEventListener('touchstart', onTouchStart)
    bound.removeEventListener('touchmove', onTouchMove)
    bound.removeEventListener('touchend', onTouchEnd)
    bound.removeEventListener('touchcancel', onTouchEnd)
    bound = null
  }

  watch(
    elRef,
    (el) => {
      detach()
      if (!el) return
      el.addEventListener('touchstart', onTouchStart, { passive: true })
      el.addEventListener('touchmove', onTouchMove, { passive: true })
      el.addEventListener('touchend', onTouchEnd)
      el.addEventListener('touchcancel', onTouchEnd)
      bound = el
    },
    { immediate: true }
  )

  onBeforeUnmount(detach)
}
