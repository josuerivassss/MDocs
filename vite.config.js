import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const api = (env.VITE_API_URL || '').replace(/\/$/, '')
  const ws = api.replace(/^http/, 'ws')
  const csp = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ${ws}; object-src 'none'; base-uri 'none'; form-action 'none'`
  return {
    base: './',
    plugins: [
      react(),
      {
        name: 'csp',
        apply: 'build',
        transformIndexHtml: (html) => html.replace('</head>', `<meta http-equiv="Content-Security-Policy" content="${csp}" /></head>`)
      }
    ]
  }
})
