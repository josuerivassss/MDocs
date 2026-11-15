import { saveAs } from 'file-saver'
import { marked } from 'marked'
import css from './styles.css?raw'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  AlignmentType,
  Footer,
  PageNumber,
  ImageRun,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  Header,
  BorderStyle,
  PageOrientation
} from 'docx'
import { splitSections, safeImg, cleanStyle, styleVars, coverPos, blockPos } from './store.js'
import { cache, keyOf, isDiagram, ensure, svgToPng } from './diagrams.js'

let ST = cleanStyle({})
let IMGS = new Map()

const slug = (m) =>
  (m.titulo || 'documento')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const dec = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')

export function exportMd(md, m, vars) {
  const keys = ['institucion', 'tipo', 'titulo', 'subtitulo', 'autores', 'version', 'fecha', 'pie']
  const vs = Object.entries(vars).map(([k, x]) => `  ${k}: ${JSON.stringify(String(x))}`)
  const yaml = [
    '---',
    ...keys.map((k) => `${k}: ${JSON.stringify(String(m[k] ?? ''))}`),
    `numeracion: ${!!m.numeracion}`,
    ...(vs.length ? ['variables:', ...vs] : []),
    '---',
    '',
    ''
  ].join('\n')
  saveAs(new Blob([yaml + md], { type: 'text/markdown;charset=utf-8' }), slug(m) + '.md')
}

export function exportHtml(m, st) {
  const body = document.querySelector('.sheets').innerHTML
  const v = Object.entries(styleVars(st))
    .map(([k, x]) => `${k}:${x}`)
    .join(';')
  const title = String(m.titulo || 'Documento').replace(/[<>&"]/g, '')
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${title}</title><style>${css}</style></head><body class="standalone"><div class="sheets" style="${v}">${body}</div></body></html>`
  saveAs(new Blob([html], { type: 'text/html;charset=utf-8' }), slug(m) + '.html')
}

const bd = () => {
  const b = { style: BorderStyle.SINGLE, size: Math.max(2, Math.round(ST.tbWidth * 6)), color: ST.tbBorder.slice(1) }
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b }
}

const al = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT }
const heads = [null, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6]

const inl = (ts, st = {}) =>
  (ts || []).flatMap((t) => {
    if (t.type === 'strong') return inl(t.tokens, { ...st, bold: true })
    if (t.type === 'em') return inl(t.tokens, { ...st, italics: true })
    if (t.type === 'codespan') return [new TextRun({ text: dec(t.text), font: 'Consolas', ...st })]
    if (t.type === 'br') return [new TextRun({ break: 1 })]
    if (t.tokens) return inl(t.tokens, st)
    return [new TextRun({ text: dec(t.text || t.raw || ''), ...st })]
  })

const blk = (t, lv = 0) => {
  if (t.type === 'heading') {
    return [new Paragraph({ heading: heads[t.depth], children: inl(t.tokens), spacing: { before: 240, after: 120 } })]
  }
  if (t.type === 'paragraph') return [new Paragraph({ children: inl(t.tokens), spacing: { after: 120 } })]
  if (t.type === 'blockquote') return t.tokens.flatMap((x) => blk(x, lv))
  if (t.type === 'code') {
    const im = isDiagram(t.lang) && IMGS.get(keyOf(t.lang, t.text))
    if (im) {
      return [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: im.data, transformation: { width: im.w, height: im.h } })] })]
    }
    return t.text.split('\n').map(
      (l) =>
        new Paragraph({
          children: [new TextRun({ text: l, font: 'Consolas', size: 20 })],
          shading: { type: ShadingType.CLEAR, fill: 'F3F4F6' }
        })
    )
  }
  if (t.type === 'list') {
    return t.items.flatMap((it, i) => {
      const first = it.tokens.find((x) => x.type === 'text' || x.type === 'paragraph')
      const rest = it.tokens.filter((x) => x !== first)
      const head = new Paragraph({
        children: [...(t.ordered ? [new TextRun(`${i + (t.start || 1)}. `)] : []), ...inl(first ? first.tokens : [])],
        bullet: t.ordered ? undefined : { level: Math.min(lv, 8) },
        indent: t.ordered ? { left: 360 + lv * 360 } : undefined
      })
      return [head, ...rest.flatMap((x) => blk(x, lv + 1))]
    })
  }
  if (t.type === 'table') {
    const cell = (c, h, z) =>
      new TableCell({
        children: [new Paragraph({ children: inl(c.tokens, h ? { bold: true, color: ST.tbHeadText.slice(1) } : {}) })],
        margins: { top: ST.tbPad * 15, bottom: ST.tbPad * 15, left: 100, right: 100 },
        shading: h || z ? { type: ShadingType.CLEAR, fill: (h ? ST.tbHead : ST.tbZebra).slice(1) } : undefined
      })
    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: bd(),
        rows: [
          new TableRow({ tableHeader: true, children: t.header.map((c) => cell(c, true)) }),
          ...t.rows.map((r, ri) => new TableRow({ children: r.map((c) => cell(c, false, ri % 2 === 1)) }))
        ]
      }),
      new Paragraph('')
    ]
  }
  return []
}

const img = (b, p) => {
  const [head, data] = b.src.split(',')
  const type = /png/.test(head) ? 'png' : /gif/.test(head) ? 'gif' : 'jpg'
  return new ImageRun({
    type,
    data: Uint8Array.from(atob(data), (c) => c.charCodeAt(0)),
    transformation: { width: p.w, height: Number(b.h) || p.w },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: Math.round(p.x * 9525) },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: Math.round(p.y * 9525) },
      behindDocument: b.z < 0,
      allowOverlap: true
    }
  })
}

const tw = (v) => Math.round(v * 15)

const framed = (text, p, size, o = {}) => {
  const cpl = Math.max(1, Math.floor((p.w * 0.75) / (size * 0.5)))
  const lines = Math.max(1, Math.ceil(String(text || '').length / cpl))
  return new Paragraph({
    alignment: al[p.align],
    frame: {
      type: 'absolute',
      position: { x: tw(p.x), y: tw(p.y) },
      width: tw(p.w),
      height: Math.round(lines * size * 1.4 * 20),
      anchor: { horizontal: FrameAnchorType.PAGE, vertical: FrameAnchorType.PAGE }
    },
    children: [new TextRun({ text: String(text || ''), size: size * 2, bold: o.bold })]
  })
}

const cover = (m, bl) => [
  framed(m.institucion, coverPos(m, 'institucion'), 16, { bold: true }),
  framed(m.tipo, coverPos(m, 'tipo'), 13),
  framed(m.titulo, coverPos(m, 'titulo'), ST.sizeTitle, { bold: true }),
  framed(m.subtitulo, coverPos(m, 'subtitulo'), ST.sizeSub),
  framed(m.autores, coverPos(m, 'autores'), 11),
  framed('Versión ' + m.version + ' · ' + m.fecha, coverPos(m, 'version'), 11),
  ...bl.flatMap((b, i) => {
    if (b.kind === 'txt') {
      return [framed(b.text, blockPos(b, i), Math.min(96, Math.max(6, Number(b.size) || 16)), { bold: b.bold })]
    }
    if (!safeImg(b.src)) return []
    return [new Paragraph({ children: [img(b, blockPos(b, i))] })]
  })
]

export async function exportDocx(md, m, bl, st) {
  ST = cleanStyle(st)
    const found = new Map()
  marked.walkTokens(marked.lexer(md || ''), (t) => {
    if (t.type === 'code' && isDiagram(t.lang)) found.set(keyOf(t.lang, t.text), [t.lang, t.text])
  })
  IMGS = new Map()
  for (const [k, [l, t]] of found) {
    await ensure(l, t)
    try {
      const r = await svgToPng(cache.get(k))
      if (r) IMGS.set(k, r)
    } catch {
      continue
    }
  }
  const fb = ST.fontBody.split(',')[0]
  const fh = ST.fontHead.split(',')[0]
  const margin = { top: 1440, right: 1440, bottom: 1440, left: 1440 }
  const size = (o) => ({ width: 12240, height: 15840, orientation: o === 'h' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT })
  const foot = () =>
    new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun(m.pie || ''),
            ...(m.numeracion ? [new TextRun({ children: [(m.pie ? '  ·  ' : '') + 'Página ', PageNumber.CURRENT] })] : [])
          ]
        })
      ]
    })
  const head = () =>
    new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: ST.header, size: 18 })] })] })
  const secs = splitSections(md || '').filter((s) => s.md.trim())
  const content = (secs.length ? secs : [{ o: 'v', md: '' }]).map((s, i) => ({
    properties: { page: { size: size(s.o), margin, ...(i === 0 ? { pageNumbers: { start: 1 } } : {}) } },
    ...(ST.header ? { headers: { default: head() } } : {}),
    footers: { default: foot() },
    children: marked.lexer(s.md).flatMap((t) => blk(t))
  }))
  const hs = [
    [1, ST.sizeH1],
    [2, ST.sizeH2],
    [3, ST.sizeH3]
  ].map(([n, z]) => ({
    id: 'Heading' + n,
    name: 'heading ' + n,
    basedOn: 'Normal',
    next: 'Normal',
    quickFormat: true,
    run: { size: z * 2, bold: true, font: fh },
    paragraph: { spacing: { before: 240, after: 120 } }
  }))
  const doc = new Document({
    styles: { default: { document: { run: { font: fb, size: ST.sizeBody * 2 } } }, paragraphStyles: hs },
    sections: [{ properties: { page: { size: size('v'), margin } }, children: cover(m, bl) }, ...content]
  })
  saveAs(await Packer.toBlob(doc), slug(m) + '.docx')
}
