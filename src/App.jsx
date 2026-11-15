import { useEffect, useRef, useState } from 'react'
import {
  Heading1, Heading2, Heading3, Bold, List, ListOrdered, Table, Code, Workflow, RectangleHorizontal, RectangleVertical,
  ZoomIn, ZoomOut, RotateCcw, Users, Wifi, WifiOff, FileText, FileCode, FileDown, Printer, Link2, HardDrive,
  Sun, Moon, Plus, Pencil, X, Palette, BookOpen
} from 'lucide-react'
import { createWorkspace, newDoc, bind, useY, applyVars } from './store.js'
import { TEMPLATES } from './templates.js'
import { CoverPanel } from './Cover.jsx'
import { StylePanel } from './StylePanel.jsx'
import Preview from './Preview.jsx'
import { exportMd, exportHtml, exportDocx } from './export.js'

const W = createWorkspace()

const tools = [
  [Heading1, 'Encabezado 1', '# ', ''],
  [Heading2, 'Encabezado 2', '## ', ''],
  [Heading3, 'Encabezado 3', '### ', ''],
  [Bold, 'Negrita', '**', ''],
  [List, 'Lista con viñetas', '- ', ''],
  [ListOrdered, 'Lista numerada', '1. ', ''],
  [Table, 'Tabla', '\n| Columna 1 | Columna 2 |\n|---|---|\n| ', ' | |\n'],
  [Code, 'Bloque de código', '\n```\n', '\n```\n'],
  [Workflow, 'Diagrama Mermaid', '\n```mermaid\n', '\n```\n', 'graph TD\n  A[Inicio] --> B[Fin]'],
  [RectangleHorizontal, 'Siguiente página en horizontal', '\n@pagina(horizontal)\n', '', ''],
  [RectangleVertical, 'Siguiente página en vertical', '\n@pagina(vertical)\n', '', '']
]

const Zoom = ({ v, set }) => (
  <div className="zoom">
    <button title="Reducir zoom" onClick={() => set(Math.max(0.4, +(v - 0.1).toFixed(2)))}>
      <ZoomOut size={16} />
    </button>
    <span>{Math.round(v * 100)}%</span>
    <button title="Aumentar zoom" onClick={() => set(Math.min(2.5, +(v + 0.1).toFixed(2)))}>
      <ZoomIn size={16} />
    </button>
    <button title="Restablecer 100%" onClick={() => set(1)}>
      <RotateCcw size={16} />
    </button>
  </div>
)

function DocView({ S }) {
  useY(S.text)
  useY(S.meta)
  useY(S.blocks)
  useY(S.vars)
  useY(S.style)
  const [split, setSplit] = useState(50)
  const [ze, setZe] = useState(1)
  const [zp, setZp] = useState(1)
  const [panel, setPanel] = useState(null)
  const ta = useRef()
  const main = useRef()
  const md = S.text.toString()
  const m = Object.fromEntries(S.meta.entries())
  const bl = S.blocks.toArray()
  const vars = Object.fromEntries(S.vars.entries())
  const st = Object.fromEntries(S.style.entries())
  const rm = Object.fromEntries(Object.entries(m).map(([k, x]) => [k, typeof x === 'string' ? applyVars(x, vars) : x]))
  const rst = { ...st, header: applyVars(String(st.header || ''), vars) }
  const rmd = applyVars(md, vars)

  const setMd = (v) => {
    const o = S.text.toString()
    let a = 0
    while (a < o.length && a < v.length && o[a] === v[a]) a++
    let b = 0
    while (b < o.length - a && b < v.length - a && o[o.length - 1 - b] === v[v.length - 1 - b]) b++
    S.doc.transact(() => {
      S.text.delete(a, o.length - a - b)
      S.text.insert(a, v.slice(a, v.length - b))
    })
  }

  const wrap = (pre, post, ph) => {
    const t = ta.current
    const s = t.selectionStart
    const e = t.selectionEnd
    const v = t.value
    const sel = v.slice(s, e) || (ph ?? 'texto')
    setMd(v.slice(0, s) + pre + sel + post + v.slice(e))
    requestAnimationFrame(() => {
      t.focus()
      t.setSelectionRange(s + pre.length, s + pre.length + sel.length)
    })
  }

  const pickTemplate = (e) => {
    const k = e.target.value
    e.target.value = ''
    if (k && confirm('¿Reemplazar el contenido actual por la plantilla ' + k + '?')) {
      setMd(TEMPLATES[k])
      S.meta.set('tipo', k)
    }
  }

  const drag = (e) => {
    if (e.buttons !== 1) return
    const r = main.current.getBoundingClientRect()
    setSplit(Math.min(85, Math.max(15, ((e.clientX - r.left) / r.width) * 100)))
  }

  const toggle = (p) => setPanel(panel === p ? null : p)

  return (
    <div className="main" ref={main}>
      <section className="left" style={{ width: `calc(${split}% - 4px)` }}>
        <div className="bar">
          {tools.map(([Icon, tip, pre, post, ph]) => (
            <button key={tip} title={tip} onClick={() => wrap(pre, post, ph)}>
              <Icon size={16} />
            </button>
          ))}
          <select defaultValue="" title="Plantillas" onChange={pickTemplate}>
            <option value="">Plantilla…</option>
            <option value="DRN">DRN</option>
            <option value="DRU">DRU</option>
            <option value="DRS">DRS (IEEE 830)</option>
          </select>
          <button title="Portada, pie de página e imágenes" onClick={() => toggle('cover')}>
            <BookOpen size={16} />
          </button>
          <button title="Fuentes, tamaños, tablas, encabezado y variables" onClick={() => toggle('style')}>
            <Palette size={16} />
          </button>
          <Zoom v={ze} set={setZe} />
        </div>
        {panel === 'cover' && <CoverPanel S={S} m={m} bl={bl} />}
        {panel === 'style' && <StylePanel S={S} st={st} vars={vars} />}
        <textarea ref={ta} className="editor" spellCheck={false} style={{ fontSize: 14 * ze + 'px' }} value={md} onChange={(e) => setMd(e.target.value)} />
      </section>
      <div className="resizer" onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)} onPointerMove={drag} />
      <section className="right">
        <div className="bar pv-bar">
          <button title="Exportar Markdown" onClick={() => exportMd(md, m, vars)}>
            <FileText size={16} /> .md
          </button>
          <button title="Exportar HTML" onClick={() => exportHtml(rm, rst)}>
            <FileCode size={16} /> .html
          </button>
          <button title="Exportar Word" onClick={() => exportDocx(rmd, rm, bl, rst)}>
            <FileDown size={16} /> .docx
          </button>
          <button title="Exportar PDF (imprimir)" onClick={() => window.print()}>
            <Printer size={16} /> .pdf
          </button>
          <Zoom v={zp} set={setZp} />
        </div>
        <div className="pv-scroll">
          <Preview md={rmd} m={rm} bl={bl} st={rst} zoom={zp} />
        </div>
      </section>
    </div>
  )
}

const initTheme = () => {
  try {
    return localStorage.getItem('rd-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  } catch {
    return 'light'
  }
}

export default function App() {
  useY(W.docs)
  const [active, setActive] = useState(null)
  const [theme, setTheme] = useState(initTheme)
  const [net, setNet] = useState(W.rtc.state)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('rd-theme', theme)
    } catch {
      document.documentElement.dataset.theme = theme
    }
  }, [theme])

  useEffect(() => {
    W.idb.whenSynced.then(() => setSaved(true))
    const handle = (s) => {
      setNet({ ...s })
      if (s.ready && W.docs.size === 0) newDoc(W, 'Documento 1', TEMPLATES.DRS, 'inicial')
    }
    W.rtc.onChange = handle
    handle(W.rtc.state)
    return () => {
      W.rtc.onChange = null
    }
  }, [])

  const ids = Array.from(W.docs.keys())
  const id = W.docs.has(active) ? active : ids[0]
  const S = id ? bind(W, id) : null

  useEffect(() => {
    if (id) W.rtc.setDoc(id)
  }, [id])

  const rename = () => {
    const n = prompt('Nombre del documento', String(W.docs.get(id).get('name')))
    if (n && n.trim()) W.docs.get(id).set('name', n.trim().slice(0, 60))
  }
  const remove = () => {
    if (ids.length > 1 && confirm('¿Eliminar este documento para todos los participantes?')) W.docs.delete(id)
  }

  return (
    <div className="app">
      <header className="top">
        <b>ReqDocs Studio</b>
        <span className="badge" title={net.online ? 'Conectado al servidor' : 'Sin conexión: los cambios se guardan y se fusionan al reconectar'}>
          {net.online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {net.online ? (net.ready ? 'Sincronizado' : 'Conectando') : 'Sin conexión'}
        </span>
        <span className="badge" title="Usuarios conectados">
          <Users size={14} /> {net.total}
        </span>
        <span className="badge" title="Guardado automático en este navegador">
          <HardDrive size={14} /> {saved ? 'Guardado local' : 'Cargando'}
        </span>
        <button title="Copiar enlace de la sala (incluye la clave de acceso)" onClick={() => navigator.clipboard.writeText(location.href)}>
          <Link2 size={16} /> Compartir
        </button>
        <button title="Cambiar modo claro u oscuro" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </header>
      <nav className="tabs">
        {ids.map((i) => (
          <div key={i} className={'tab' + (i === id ? ' on' : '')}>
            <button title="Abrir documento" onClick={() => setActive(i)}>
              {String(W.docs.get(i).get('name'))}
              <small>
                <Users size={11} /> {net.byDoc[i] || 0}
              </small>
            </button>
            {i === id && (
              <>
                <button title="Renombrar" onClick={rename}>
                  <Pencil size={13} />
                </button>
                {ids.length > 1 && (
                  <button title="Eliminar" onClick={remove}>
                    <X size={13} />
                  </button>
                )}
              </>
            )}
          </div>
        ))}
        <button title="Nuevo documento" onClick={() => setActive(newDoc(W, 'Documento ' + (ids.length + 1), TEMPLATES.DRS))}>
          <Plus size={14} />
        </button>
      </nav>
      {S ? <DocView key={id} S={S} /> : <p className="loading">Cargando…</p>}
    </div>
  )
}
