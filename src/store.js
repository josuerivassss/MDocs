import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { WsProvider } from './sync.js'
import { IndexeddbPersistence } from 'y-indexeddb'

export const FONTS = ['Georgia, serif', 'Times New Roman, serif', 'Arial, sans-serif', 'Calibri, sans-serif', 'Verdana, sans-serif', 'Courier New, monospace']

export const defaults = {
  institucion: 'Universidad Ejemplo',
  tipo: 'DRS',
  titulo: 'Sistema de Gestión Académica',
  subtitulo: 'Documento de Requisitos de Software',
  autores: 'Equipo de Requisitos',
  version: '1.0',
  fecha: new Date().toISOString().slice(0, 10),
  pie: 'Documento confidencial',
  numeracion: true
}

export const styleDefaults = {
  fontBody: FONTS[0],
  fontHead: FONTS[2],
  sizeBody: 11,
  sizeH1: 20,
  sizeH2: 15,
  sizeH3: 13,
  sizeTitle: 30,
  sizeSub: 16,
  header: '',
  tbBorder: '#9ca3af',
  tbWidth: 1,
  tbHead: '#e5e7eb',
  tbHeadText: '#111111',
  tbZebra: '#f9fafb',
  tbPad: 4
}

export const rid = (n = 12) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('')
export const uid = () => rid(4)

export const safeImg = (s) => typeof s === 'string' && s.length < 4e6 && /^data:image\/(png|jpeg|gif);base64,[A-Za-z0-9+/=]+$/.test(s)

const num = (v, d, lo, hi) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d
}
const col = (v, d) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : d)
const font = (v) => (FONTS.includes(v) ? v : FONTS[0])

export const cleanStyle = (s) => {
  const d = styleDefaults
  return {
    fontBody: font(s.fontBody),
    fontHead: font(s.fontHead),
    sizeBody: num(s.sizeBody, d.sizeBody, 6, 40),
    sizeH1: num(s.sizeH1, d.sizeH1, 6, 72),
    sizeH2: num(s.sizeH2, d.sizeH2, 6, 72),
    sizeH3: num(s.sizeH3, d.sizeH3, 6, 72),
    sizeTitle: num(s.sizeTitle, d.sizeTitle, 6, 96),
    sizeSub: num(s.sizeSub, d.sizeSub, 6, 72),
    header: String(s.header || '').slice(0, 200),
    tbBorder: col(s.tbBorder, d.tbBorder),
    tbWidth: num(s.tbWidth, d.tbWidth, 0, 6),
    tbHead: col(s.tbHead, d.tbHead),
    tbHeadText: col(s.tbHeadText, d.tbHeadText),
    tbZebra: col(s.tbZebra, d.tbZebra),
    tbPad: num(s.tbPad, d.tbPad, 0, 20)
  }
}

export const styleVars = (s) => {
  const c = cleanStyle(s)
  return {
    '--fb': c.fontBody,
    '--fh': c.fontHead,
    '--sb': c.sizeBody + 'pt',
    '--s1': c.sizeH1 + 'pt',
    '--s2': c.sizeH2 + 'pt',
    '--s3': c.sizeH3 + 'pt',
    '--st': c.sizeTitle + 'pt',
    '--ss': c.sizeSub + 'pt',
    '--tbc': c.tbBorder,
    '--tbw': c.tbWidth + 'px',
    '--tbh': c.tbHead,
    '--tbt': c.tbHeadText,
    '--tbz': c.tbZebra,
    '--tbp': c.tbPad + 'px'
  }
}

export const applyVars = (s, v) => s.replace(/(?<!\\)@var\(\s*([\w-]+)\s*\)/g, (a, k) => (Object.hasOwn(v, k) ? String(v[k]) : a))

export function splitSections(md) {
  const out = [{ o: 'v', md: '' }]
  md.split('\n').forEach((l) => {
    const t = l.match(/^@pagina\((vertical|horizontal)\)\s*$/)
    if (t) out.push({ o: t[1] === 'horizontal' ? 'h' : 'v', md: '' })
    else out[out.length - 1].md += l + '\n'
  })
  return out
}

export function createWorkspace(room, key, user, owner) {
  const doc = new Y.Doc()
  const idb = new IndexeddbPersistence('reqdocs-' + room, doc)
  const rtc = new WsProvider(doc, room, key, user.name, owner)
  idb.whenSynced.then(() => rtc.start())
  return { doc, idb, rtc, docs: doc.getMap('docs') }
}

export function newDoc(W, name, tpl, fixed) {
  const id = fixed || uid()
  W.doc.transact(() => {
    const d = new Y.Map()
    W.docs.set(id, d)
    d.set('name', name)
    d.set('md', new Y.Text(tpl))
    d.set('meta', new Y.Map(Object.entries(defaults)))
    d.set('blocks', new Y.Array())
    d.set('vars', new Y.Map())
    d.set('style', new Y.Map(Object.entries(styleDefaults)))
  })
  return id
}

export const bind = (W, id) => {
  const d = W.docs.get(id)
  return d && { ...W, id, text: d.get('md'), meta: d.get('meta'), blocks: d.get('blocks'), vars: d.get('vars'), style: d.get('style') }
}

export function useY(type) {
  const [, set] = useState(0)
  useEffect(() => {
    const f = () => set((n) => n + 1)
    type.observeDeep(f)
    return () => type.unobserveDeep(f)
  }, [type])
}

const HEX = /^[a-f0-9]{32}$/
const read = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null') ?? d
  } catch {
    return d
  }
}
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    return
  }
}
export const loadRooms = () => {
  const l = read('rd-rooms', [])
  return Array.isArray(l) ? l.filter((r) => r && HEX.test(r.room) && HEX.test(r.key)) : []
}
export const saveRooms = (l) => write('rd-rooms', l)
export const getUser = () => {
  const u = read('rd-user', null)
  return u && typeof u.name === 'string' && u.name ? u : null
}
export const saveUser = (u) => write('rd-user', u)

export const NL = String.fromCharCode(10)

export function useDebounced(v, ms) {
  const [d, setD] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return d
}

export function applyToc(md, native = false) {
  const lines = md.split(NL)
  const heads = []
  let fence = false
  lines.forEach((l) => {
    if (l.startsWith('```')) fence = !fence
    const h = !fence && l.match(/^(#{1,4}) +(.+?) *#*$/)
    if (h) heads.push({ d: h[1].length, t: h[2] })
  })
  fence = false
  return lines
    .map((l) => {
      if (l.startsWith('```')) fence = !fence
      const t = l.trim()
      if (fence || !t.startsWith('[TOC') || !t.endsWith(']')) return l
      const parts = t.slice(4, -1).replace(/^[: ]+/, '').split(',')
      const title = parts[0].trim()
      const pages = parts.slice(1).some((p) => p.trim().toLowerCase().startsWith('p'))
      if (native && pages) return NL + '@@TOC@@' + title + NL
      const items = heads.map((h, i) => '  '.repeat(h.d - 1) + '- ' + h.t + (pages ? ' ‹p' + i + '›' : ''))
      return NL + (title ? '**' + title + '**' + NL + NL : '') + items.join(NL) + NL
    })
    .join(NL)
}

const isSep = (r) => r.every((c) => c.length > 0 && !c.replace(/[-: ]/g, ''))

export function parseGrid(text) {
  const rows = text
    .split(NL)
    .filter((l) => l.trim())
    .map((l) => {
      const t = l.trim()
      const a = t.startsWith('|') ? t.slice(1) : t
      return (a.endsWith('|') ? a.slice(0, -1) : a).split('|').map((c) => c.trim())
    })
  const head = rows.length > 1 && isSep(rows[1])
  const data = head ? [rows[0], ...rows.slice(2)] : rows
  const cols = Math.max(1, ...data.map((r) => r.length))
  const fit = (r) => {
    const base = Math.floor(cols / r.length)
    return r.map((t, i) => ({ t, span: base + (i === r.length - 1 ? cols - base * r.length : 0) }))
  }
  return { head, cols, rows: data.map(fit) }
}

export function gridHtml(text, inline) {
  const g = parseGrid(text)
  const row = (r, tag) => '<tr>' + r.map((c) => '<' + tag + ' colspan=' + c.span + '>' + inline(c.t) + '</' + tag + '>').join('') + '</tr>'
  const head = g.head ? '<thead>' + row(g.rows[0], 'th') + '</thead>' : ''
  const body = g.rows.slice(g.head ? 1 : 0).map((r) => row(r, 'td')).join('')
  return '<table>' + head + '<tbody>' + body + '</tbody></table>'
}

const hesc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const sp = (c, s) => '<span class=' + c + '>' + s + '</span>'

export function highlight(md) {
  let fence = false
  const out = md.split(NL).map((raw) => {
    const l = hesc(raw)
    if (raw.startsWith('```')) {
      fence = !fence
      return sp('h-fence', l)
    }
    if (fence) return sp('h-code', l)
    const t = raw.trim()
    if (t.startsWith('[TOC') || raw.startsWith('@pagina(')) return sp('h-dir', l)
    if (t.startsWith('|')) return l.replace(/[|]/g, sp('h-p', '|'))
    if (raw.startsWith('#')) return sp('h-h', l)
    if (raw.startsWith('>')) return sp('h-q', l)
    return l
      .replace(/^( *)([-*+]|[0-9]+[.)]) /, (a, s, m) => s + sp('h-li', m) + ' ')
      .replace(/(`[^`]+`)/g, (a, s) => sp('h-ic', s))
      .replace(/([*][*][^*]+[*][*])/g, (a, s) => sp('h-b', s))
      .replace(/(~~[^~]+~~)/g, (a, s) => sp('h-s', s))
      .replace(/([+][+][^+]+[+][+])/g, (a, s) => sp('h-u', s))
      .replace(/(@var[(][^)]*[)])/g, (a, s) => sp('h-dir', s))
      .replace(/([(]https?:[^)]*[)])/g, (a, s) => sp('h-url', s))
  })
  return out.join(NL) + NL
}

export function prepare(md, vars, native = false) {
  const defs = {}
  const body = md.replace(/^```vars[^\n]*\n([\s\S]*?)^```[ \t]*\n?/gm, (_, b) => {
    b.split('\n').forEach((l) => {
      const m = l.match(/^@var\(\s*([\w-]+)\s*,\s*(.*)\)\s*$/)
      if (m) defs[m[1]] = m[2]
    })
    return ''
  })
  const all = { ...vars, ...defs }
  return { md: applyToc(applyVars(body, all), native), vars: all }
}

export const COVER_DEFAULTS = {
  institucion: { x: 96, y: 80, w: 624, align: 'center' },
  tipo: { x: 96, y: 125, w: 624, align: 'center' },
  titulo: { x: 96, y: 280, w: 624, align: 'center' },
  subtitulo: { x: 96, y: 380, w: 624, align: 'center' },
  autores: { x: 96, y: 880, w: 624, align: 'center' },
  version: { x: 96, y: 930, w: 624, align: 'center' }
}

export const PRESETS = {
  'Arriba izquierda': [80, 'left'],
  'Arriba centro': [80, 'center'],
  'Arriba derecha': [80, 'right'],
  Centro: [480, 'center'],
  'Abajo izquierda': [900, 'left'],
  'Abajo centro': [900, 'center'],
  'Abajo derecha': [900, 'right']
}

const ALIGNS = ['left', 'center', 'right']
const al = (a) => (ALIGNS.includes(a) ? a : 'center')

export const coverPos = (m, k) => {
  const o = m['pos_' + k]
  const p = { ...COVER_DEFAULTS[k], ...(o && typeof o === 'object' ? o : {}) }
  return { x: num(p.x, 96, -816, 816), y: num(p.y, 80, 0, 1056), w: num(p.w, 624, 40, 816), align: al(p.align) }
}

export const blockPos = (b, i) => {
  const free = b.mode === 'free'
  if (b.kind === 'img') {
    const w = num(b.w, 120, 10, 816)
    return {
      x: free ? num(b.x, (816 - w) / 2, -816, 816) : (816 - w) / 2,
      y: free ? num(b.y, 440 + i * 50, 0, 1056) : 440 + i * 50,
      w,
      align: 'center'
    }
  }
  return { x: num(b.x, 96, -816, 816), y: num(b.y, 440 + i * 50, 0, 1056), w: num(b.w, 624, 40, 816), align: al(b.align) }
}
