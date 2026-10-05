const { defineConfig } = require('eslint/config')

module.exports = defineConfig([
  ...require('@infinitetoken/eslint-config/vue'),
  {
    // Renderless components: they drive Leaflet imperatively and render no DOM, so an empty
    // <template> is intentional. vue/valid-template-root requires a single root element.
    files: ['src/components/PinMarker.vue', 'src/components/PrintAreaDrawer.vue', 'src/components/CaptionMarker.vue', 'src/components/CaptionRotateHandle.vue'],
    rules: {
      'vue/valid-template-root': 'off'
    }
  }
])
