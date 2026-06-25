import type { CaptionSize, PinDotShape, PinDotSize, RouteLineStyle, RouteWaypointSize, RouteWaypointStyle } from '@/types'

export function useStickyDefaults() {
  // ── Sticky pin defaults ───────────────────────────────────────────────────
  const stickyEmoji = ref(localStorage.getItem('mapfolio_sticky_emoji') || '📍')
  const stickyColor = ref(localStorage.getItem('mapfolio_sticky_color') || '#ffffff')
  const rawDotSize = localStorage.getItem('mapfolio_sticky_dot_size') as PinDotSize | 'none' | null
  const stickyDotSize = ref<PinDotSize>(rawDotSize && rawDotSize !== 'none' ? rawDotSize : 'm')
  const stickyDotShape = ref<PinDotShape>((localStorage.getItem('mapfolio_sticky_dot_shape') as PinDotShape) || 'circle')
  const stickyShowNumber = ref(localStorage.getItem('mapfolio_sticky_show_number') === 'true')

  watch(stickyEmoji, (v) => localStorage.setItem('mapfolio_sticky_emoji', v))
  watch(stickyColor, (v) => localStorage.setItem('mapfolio_sticky_color', v))
  watch(stickyDotSize, (v) => localStorage.setItem('mapfolio_sticky_dot_size', v))
  watch(stickyDotShape, (v) => localStorage.setItem('mapfolio_sticky_dot_shape', v))
  watch(stickyShowNumber, (v) => localStorage.setItem('mapfolio_sticky_show_number', String(v)))

  // ── Sticky route defaults ─────────────────────────────────────────────────
  const stickyRouteColor = ref(localStorage.getItem('mapfolio_sticky_route_color') || '#0d9488')
  const stickyRouteLineStyle = ref<RouteLineStyle | undefined>((localStorage.getItem('mapfolio_sticky_route_line_style') as RouteLineStyle) || undefined)
  const stickyRouteWaypointStyle = ref<RouteWaypointStyle | undefined>((localStorage.getItem('mapfolio_sticky_route_wp_style') as RouteWaypointStyle) || undefined)
  const stickyRouteWaypointSize = ref<RouteWaypointSize | undefined>((localStorage.getItem('mapfolio_sticky_route_wp_size') as RouteWaypointSize) || undefined)

  watch(stickyRouteColor, (v) => localStorage.setItem('mapfolio_sticky_route_color', v))
  watch(stickyRouteLineStyle, (v) => (v ? localStorage.setItem('mapfolio_sticky_route_line_style', v) : localStorage.removeItem('mapfolio_sticky_route_line_style')))
  watch(stickyRouteWaypointStyle, (v) => (v ? localStorage.setItem('mapfolio_sticky_route_wp_style', v) : localStorage.removeItem('mapfolio_sticky_route_wp_style')))
  watch(stickyRouteWaypointSize, (v) => (v ? localStorage.setItem('mapfolio_sticky_route_wp_size', v) : localStorage.removeItem('mapfolio_sticky_route_wp_size')))

  // ── Sticky caption defaults ───────────────────────────────────────────────
  const stickyCaptionColor = ref(localStorage.getItem('mapfolio_sticky_caption_color') || '#ffffff')
  const stickyCaptionSize = ref<CaptionSize>((localStorage.getItem('mapfolio_sticky_caption_size') as CaptionSize) || 'm')
  const stickyCaptionBackground = ref(localStorage.getItem('mapfolio_sticky_caption_background') !== 'false')

  watch(stickyCaptionColor, (v) => localStorage.setItem('mapfolio_sticky_caption_color', v))
  watch(stickyCaptionSize, (v) => localStorage.setItem('mapfolio_sticky_caption_size', v))
  watch(stickyCaptionBackground, (v) => localStorage.setItem('mapfolio_sticky_caption_background', String(v)))

  return {
    stickyEmoji,
    stickyColor,
    stickyDotSize,
    stickyDotShape,
    stickyShowNumber,
    stickyRouteColor,
    stickyRouteLineStyle,
    stickyRouteWaypointStyle,
    stickyRouteWaypointSize,
    stickyCaptionColor,
    stickyCaptionSize,
    stickyCaptionBackground
  }
}
