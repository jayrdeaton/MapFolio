export interface LegendSettings {
  legend: boolean
  separatePage: boolean
  title: boolean
  titleText: string
  area: boolean
  areaText: string
  pins: boolean
  routes: boolean
  pinCount: number
  routeCount: number
  compass: boolean
  scale: boolean
}

export function rebuildLegendPreview(legendBoxEl: HTMLDivElement, legendResizeEl: HTMLDivElement | null, settings: LegendSettings | undefined, S: number): void {
  // Clear content children (legendResizeEl is absolutely positioned and stays)
  Array.from(legendBoxEl.children).forEach((c) => {
    if (c !== legendResizeEl) c.remove()
  })

  const isDark = document.documentElement.classList.contains('dark')
  const c = (light: string, dark: string) => (isDark ? dark : light)
  const textCol = c('rgba(17,24,39,.9)', 'rgba(244,244,245,.9)')
  const subCol = c('rgba(107,114,128,.9)', 'rgba(161,161,170,.9)')
  const dotCol = c('rgba(107,114,128,.45)', 'rgba(161,161,170,.45)')
  const divCol = c('rgba(0,0,0,.1)', 'rgba(255,255,255,.1)')
  const scaleCol = c('rgba(17,24,39,.6)', 'rgba(244,244,245,.6)')
  const compassCol = c('rgba(107,114,128,.55)', 'rgba(113,113,122,.7)')
  const tealCol = c('rgba(15,118,110,.9)', 'rgba(45,212,191,.9)')

  const mk = (tag: string, css: string): HTMLElement => {
    const el = document.createElement(tag)
    el.style.cssText = css
    return el
  }
  const pad = Math.max(3, Math.round(8 * S))
  const gap = Math.max(1, Math.round(2 * S))
  const compassSize = settings?.compass ? Math.max(8, Math.round(20 * S)) : 0

  if (!settings) {
    // No active area: centered "Legend" label
    const wrap = mk('div', `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;`)
    const span = mk('span', `font-family:system-ui,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:${Math.max(6, Math.round(9 * S))}px;color:${tealCol};white-space:nowrap;`)
    span.textContent = 'Legend'
    wrap.appendChild(span)
    legendBoxEl.insertBefore(wrap, legendResizeEl ?? null)
    return
  }

  const masterOn = settings.legend
  const onMap = masterOn && !settings.separatePage
  const hasPins = onMap && settings.pins && settings.pinCount > 0
  const hasRoutes = onMap && settings.routes && settings.routeCount > 0
  const hasHeader = masterOn && (settings.title || settings.area)
  const hasContent = hasPins || hasRoutes
  const sepPins = masterOn && settings.separatePage && settings.pins && settings.pinCount > 0
  const sepRoutes = masterOn && settings.separatePage && settings.routes && settings.routeCount > 0
  const hasSepKeys = sepPins || sepRoutes
  const rightPad = masterOn && settings.compass ? pad + compassSize + gap : pad

  const wrap = mk('div', `position:absolute;inset:0;padding:${pad}px ${rightPad}px ${pad}px ${pad}px;display:flex;flex-direction:column;gap:${gap}px;overflow:hidden;box-sizing:border-box;`)

  if (masterOn && settings.title && settings.titleText) {
    const el = mk('div', `font-family:system-ui,sans-serif;font-weight:700;font-size:${Math.max(5, Math.round(11 * S))}px;color:${textCol};line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;`)
    el.textContent = settings.titleText
    wrap.appendChild(el)
  }

  if (masterOn && settings.area && settings.areaText) {
    const el = mk('div', `font-family:system-ui,sans-serif;font-size:${Math.max(4, Math.round(8 * S))}px;color:${subCol};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;line-height:1.15;`)
    el.textContent = settings.areaText
    wrap.appendChild(el)
  }

  if (hasContent) {
    if (hasHeader) wrap.appendChild(mk('div', `height:1px;background:${divCol};flex-shrink:0;margin:${Math.max(0, Math.round(S))}px 0;`))

    if (hasPins) {
      const row = mk('div', `display:flex;align-items:center;gap:${Math.max(1, Math.round(3 * S))}px;flex-shrink:0;`)
      row.appendChild(mk('div', `width:${Math.max(3, Math.round(6 * S))}px;height:${Math.max(3, Math.round(6 * S))}px;border-radius:50%;background:${dotCol};flex-shrink:0;`))
      const t = mk('span', `font-family:system-ui,sans-serif;font-size:${Math.max(4, Math.round(8 * S))}px;color:${subCol};white-space:nowrap;`)
      t.textContent = `${settings.pinCount} Pin${settings.pinCount !== 1 ? 's' : ''}`
      row.appendChild(t)
      wrap.appendChild(row)
    }

    if (hasRoutes) {
      const row = mk('div', `display:flex;align-items:center;gap:${Math.max(1, Math.round(3 * S))}px;flex-shrink:0;`)
      row.appendChild(mk('div', `width:${Math.max(8, Math.round(16 * S))}px;height:${Math.max(1, Math.round(2 * S))}px;background:${dotCol};border-radius:1px;flex-shrink:0;`))
      const t = mk('span', `font-family:system-ui,sans-serif;font-size:${Math.max(4, Math.round(8 * S))}px;color:${subCol};white-space:nowrap;`)
      t.textContent = `${settings.routeCount} Route${settings.routeCount !== 1 ? 's' : ''}`
      row.appendChild(t)
      wrap.appendChild(row)
    }
  }

  if (hasSepKeys) {
    const hint = mk('div', `margin-top:auto;font-family:system-ui,sans-serif;font-size:${Math.max(4, Math.round(7 * S))}px;color:${subCol};white-space:nowrap;flex-shrink:0;opacity:0.75;border-top:1px dashed ${divCol};padding-top:${Math.max(1, Math.round(2 * S))}px;`)
    hint.textContent = 'Keys → pg. 2'
    wrap.appendChild(hint)
  }

  legendBoxEl.insertBefore(wrap, legendResizeEl ?? null)

  if (masterOn && settings.scale) {
    const barW = Math.max(24, Math.round(60 * S))
    const barH = Math.max(2, Math.round(4 * S))
    const bdr = `${Math.max(1, Math.round(S))}px solid ${scaleCol}`
    const halfW = Math.round(barW / 2)
    const scaleRow = mk('div', `position:absolute;bottom:${pad}px;left:${pad}px;right:${pad}px;display:flex;align-items:center;justify-content:center;`)
    scaleRow.appendChild(mk('div', `width:${halfW}px;height:${barH}px;background:${scaleCol};border-top:${bdr};border-bottom:${bdr};border-left:${bdr};box-sizing:border-box;flex-shrink:0;`))
    scaleRow.appendChild(mk('div', `width:${halfW}px;height:${barH}px;border-top:${bdr};border-bottom:${bdr};border-right:${bdr};box-sizing:border-box;flex-shrink:0;`))
    legendBoxEl.insertBefore(scaleRow, legendResizeEl ?? null)
  }

  if (masterOn && settings.compass) {
    const compass = mk('div', `position:absolute;top:${pad}px;right:${pad}px;width:${compassSize}px;height:${compassSize}px;border-radius:50%;border:${Math.max(1, Math.round(S))}px solid ${compassCol};display:flex;align-items:center;justify-content:center;box-sizing:border-box;`)
    const n = mk('span', `font-family:system-ui,sans-serif;font-size:${Math.max(4, Math.round(7 * S))}px;font-weight:700;color:${compassCol};line-height:1;`)
    n.textContent = 'N'
    compass.appendChild(n)
    legendBoxEl.insertBefore(compass, legendResizeEl ?? null)
  }
}
