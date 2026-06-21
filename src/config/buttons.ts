// Dev-only toggles for the global icon-button look. Flip a value and rebuild to
// compare both ways — these are applied as classes on <html> by
// plugins/button-style.client.ts and consumed by the `.mf-ibtn` rules in main.css.

/** Draw a border around every icon button. */
export const OUTLINED_BUTTONS = false

/** Hover treatment: 'highlight' = cyan accent, 'dim' = neutral darken. */
export const HOVER_STYLE: 'highlight' | 'dim' = 'dim'
