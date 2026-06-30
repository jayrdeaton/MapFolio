// Single source of truth for the multi-select modifier: Cmd on Mac, Ctrl on Windows/Linux.
export const isAdditiveEvent = (e: MouseEvent | PointerEvent): boolean => e.metaKey || e.ctrlKey
