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

export function createWorkspace() {
  const p = new URLSearchParams(location.hash.slice(1))
  let room = p.get('sala')
  let key = p.get('clave')
  if (!/^[a-f0-9]{32}$/.test(room || '') || !/^[a-f0-9]{32}$/.test(key || '')) {
    room = rid(16)
    key = rid(16)
    location.hash = `sala=${room}&clave=${key}`
  }
  const doc = new Y.Doc()
  const idb = new IndexeddbPersistence('reqdocs-' + room, doc)
  const rtc = new WsProvider(doc, room, key)
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
