import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 🌟 精准拦截 shouldHideEditorAfterDelay，让它永远返回 false
function bypassTldrawLicense() {
  return {
    name: 'bypass-tldraw-license',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('LicenseProvider')) {
        // 直接将 shouldHideEditorAfterDelay 函数重写为返回 false
        let modified = code.replace(
          /function\s+shouldHideEditorAfterDelay\s*\([^)]*\)\s*\{[\s\S]*?\}/g,
          'function shouldHideEditorAfterDelay() { return false; }'
        )
        return {
          code: modified,
          map: null,
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    bypassTldrawLicense(),
  ],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8080',
      '/static': 'http://127.0.0.1:8080',
    },
  },
  build: {
    target: 'esnext',
  },
})