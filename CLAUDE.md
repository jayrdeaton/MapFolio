# MapFolio — Project Context

Vue 3 + Vite + TypeScript + Tailwind CSS v4 interactive mapping app. Renamed from "Custom Map" on 2026-06-11.

## Tech stack

- Vue 3 `<script setup lang="ts">`, Vite 8
- Tailwind CSS v4 (`@import "tailwindcss"` + `@custom-variant` for class-based dark mode)
- Leaflet via `@vue-leaflet/vue-leaflet`, `leaflet.markercluster`, `leaflet-geosearch`
- Lucide icons via `@lucide/vue`
- `pdf-lib` for PDF export (PNG export not supported — CSS-positioned print area is incompatible with canvas capture; users can convert PDF → PNG if needed)
- `vite-plugin-pwa` for installable / offline PWA
- Vitest for tests

## Accent color

Cyan — `cyan-500` (`#06b6d4`) as primary. Derived from the icon.svg gradient midpoint (`sky-400 #38bdf8 → teal-400 #2dd4bf`). Used for buttons, focus rings, selected states, cluster bubbles, and print area rectangle.

## Dark mode

- Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *));` in `src/index.css` — the IDE shows an "Unknown at rule" warning, which is cosmetic; it builds correctly.
- Early inline script in `index.html` applies `dark` class to `<html>` before Vue mounts to prevent flash.
- Composable: `src/composables/useColorMode.ts` — reactive `preference` ref (`'light' | 'dark' | 'system'`) + `cycle()` fn, stored in `localStorage` key `mapfolio_color_mode`.
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

Jay's other similar web apps all use Nuxt + `@nuxtjs/color-mode`. MapFolio replicates the same UX pattern without Nuxt.

- `/Users/jay/Developer/GraPDF-Web` — emerald accent
- `/Users/jay/Developer/TrimBox` — no npm link, just GitHub
- `/Users/jay/Developer/Pixelated-Web` — violet accent
- `/Users/jay/Developer/SnaPDF-Web`
