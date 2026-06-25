# MapFolio — Project Context

Vue 3 + Nuxt 4 + TypeScript + Tailwind CSS v4 interactive mapping app. Renamed from "Custom Map" on 2026-06-11.

## Tech stack

- Vue 3 `<script setup lang="ts">`, Nuxt 4 (`srcDir: 'src'`, SSR disabled)
- Tailwind CSS v4 via `@tailwindcss/vite` plugin in `nuxt.config.ts`
- Leaflet via `@vue-leaflet/vue-leaflet`, `leaflet.markercluster`, `leaflet-geosearch`
- Lucide icons via `@lucide/vue`
- `pdf-lib` for PDF export (PNG export not supported — CSS-positioned print area is incompatible with canvas capture; users can convert PDF → PNG if needed)
- `@vite-pwa/nuxt` for installable / offline PWA
- Vitest for tests

## Accent color

Teal — `teal-600` (`#0d9488`) as primary (matches Crumby's `#0f8b8d`). Used for buttons, focus rings, selected states, cluster bubbles, and print area rectangle. Dark mode lighter variant is `teal-400` (`#2dd4bf`).

## Dark mode

- `@nuxtjs/color-mode` with `classSuffix: ''` and `storageKey: 'mapfolio_color_mode'` — same setup as the other related apps.
- Use the auto-imported `useColorMode()` composable from Nuxt (not a custom composable).
- Cycle order (same as other apps): system → away-from-system → opposite → system.

## Storage

- Active key: `mapfolio_v1`
- Legacy fallback: reads `custommap_v1` if `mapfolio_v1` is absent (migration for existing users)

## Header pattern

`icon + "MapFolio" | search bar | [mobile search toggle] [theme toggle] [GitHub]`

Map controls (Locate, Share, Pins, Style, Print/Export) are FABs on the right side of the map, not header buttons.

GitHub URL: `https://github.com/jayrdeaton/mapfolio`

Theme toggle icons: monitor (system) → sun (light) → moon (dark), same SVGs as other apps.

## Related apps (for consistency reference)

Jay's other similar web apps all use Nuxt + `@nuxtjs/color-mode`. MapFolio now uses the same stack.

- `/Users/jay/Developer/GraPDF-Web` — emerald accent
- `/Users/jay/Developer/TrimBox` — no npm link, just GitHub
- `/Users/jay/Developer/Pixelated-Web` — violet accent
- `/Users/jay/Developer/SnaPDF-Web`
