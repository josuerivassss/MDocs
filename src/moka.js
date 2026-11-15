import * as dsl from 'moka-dsl'

const PREFER = 'svg'
const SVG = ['compileToSvg', 'toSvg', 'renderSvg', 'svg']
const MMD = ['compileToMermaid', 'toMermaid', 'mermaid']
const ANY = ['compile', 'render', 'transpile', 'convert', 'parse']

const pick = (names) => {
  const src = dsl.default && typeof dsl.default === 'object' ? { ...dsl.default, ...dsl } : dsl
  const n = names.find((k) => typeof src[k] === 'function')
  return n ? src[n] : null
}

const isSvg = (s) => {
  const t = s.trim().toLowerCase()
  return t.startsWith('<svg') || t.startsWith('<?xml')
}

const norm = (r) => {
  if (typeof r === 'string') return isSvg(r) ? { svg: r } : { mermaid: r }
  if (r && typeof r === 'object') {
    const errs = r.errors || r.diagnostics || []
    if (PREFER === 'svg' && typeof r.svg === 'string' && r.svg) return { svg: r.svg }
    if (typeof r.mermaid === 'string' && r.mermaid) return { mermaid: r.mermaid }
    if (typeof r.svg === 'string' && r.svg) return { svg: r.svg }
    if (typeof r.output === 'string') return norm(r.output)
    if (errs.length) throw new Error(errs.map((e) => (e && e.message) || String(e)).join(' | '))
  }
  throw new Error('moka-dsl devolvió un resultado que no reconozco')
}

export async function mokaToDiagram(code) {
  const order = PREFER === 'svg' ? [SVG, MMD, ANY] : [MMD, SVG, ANY]
  for (const names of order) {
    const fn = pick(names)
    if (fn) return norm(await fn(code))
  }
  throw new Error('moka-dsl no expone una función conocida. Exports: ' + Object.keys(dsl).join(', '))
}