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

export function applyToc(md) {
  let fence = false
  const heads = []
  md.split('\n').forEach((l) => {
    if (/^```/.test(l)) fence = !fence
    const h = !fence && l.match(/^(#{1,4})\s+(.+?)\s*#*$/)
    if (h) heads.push('  '.repeat(h[1].length - 1) + '- ' + h[2])
  })
  return md.replace(/^\[TOC\][ \t]*$/gm, () => heads.join('\n'))
}

export function prepare(md, vars) {
  const defs = {}
  const body = md.replace(/^```vars[^\n]*\n([\s\S]*?)^```[ \t]*\n?/gm, (_, b) => {
    b.split('\n').forEach((l) => {
      const m = l.match(/^@var\(\s*([\w-]+)\s*,\s*(.*)\)\s*$/)
      if (m) defs[m[1]] = m[2]
    })
    return ''
  })
  const all = { ...vars, ...defs }
  return { md: applyToc(applyVars(body, all)), vars: all }
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
  'Centro': [480, 'center'],
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