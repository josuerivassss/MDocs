import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { uid } from './store.js'
import { mokaToDiagram } from './moka.js'

export const cache = new Map()
export const keyOf = (lang, text) => lang + ':' + text
export const isDiagram = (lang) => lang === 'mermaid' || lang === 'moka'

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
const clean = (svg) => DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true, html: true } })

export async function ensure(lang, text) {
  const k = keyOf(lang, text)
  if (cache.has(k)) return
  try {
    const mm = (await import('mermaid')).default
    mm.initialize({ startOnLoad: false, securityLevel: 'strict', flowchart: { htmlLabels: false } })
    let svg
    if (lang === 'moka') {
      const r = await mokaToDiagram(text)
      svg = r.svg || (await mm.render('m' + uid(), r.mermaid)).svg
    } else {
      svg = (await mm.render('m' + uid(), text)).svg
    }
    cache.set(k, clean(svg))
  } catch (e) {
    cache.set(k, `<pre class='mmd-err'>${esc(e && e.message ? e.message : e)}</pre>`)
  }
}

export async function svgToPng(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const el = doc.querySelector('svg')
  if (!el) return null
  const vb = (el.getAttribute('viewBox') || '').trim().split(/[ ,]+/).map(Number)
  const w = vb.length === 4 && vb[2] > 0 ? vb[2] : parseFloat(el.getAttribute('width')) || 800
  const h = vb.length === 4 && vb[3] > 0 ? vb[3] : parseFloat(el.getAttribute('height')) || 600
  el.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  el.setAttribute('width', String(w))
  el.setAttribute('height', String(h))
  el.removeAttribute('style')
  const xml = new XMLSerializer().serializeToString(el)
  const img = new Image()
  await new Promise((ok, no) => {
    img.onload = ok
    img.onerror = no
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
  })
  const c = document.createElement('canvas')
  c.width = Math.round(w * 2)
  c.height = Math.round(h * 2)
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, c.width, c.height)
  g.drawImage(img, 0, 0, c.width, c.height)
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'))
  if (!blob) return null
  const k = Math.min(1, 600 / w)
  return { data: new Uint8Array(await blob.arrayBuffer()), w: Math.round(w * k), h: Math.round(h * k) }
}

marked.use({
  extensions: [
    {
      name: 'ins',
      level: 'inline',
      start: (s) => s.indexOf('++'),
      tokenizer(s) {
        const m = /^[+][+]([^+]+)[+][+]/.exec(s)
        if (m) return { type: 'ins', raw: m[0], text: m[1], tokens: this.lexer.inlineTokens(m[1]) }
      },
      renderer(t) {
        return '<u>' + this.parser.parseInline(t.tokens) + '</u>'
      }
    }
  ]
})
