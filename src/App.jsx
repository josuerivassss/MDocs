import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Heading1, Heading2, Heading3, Bold, Italic, List, ListOrdered, Table, Code, Workflow, RectangleHorizontal, RectangleVertical,
  Image as ImageIcon, ListTree, FileText, FileCode, FileDown, Printer, Link2, Sun, Moon, Home as HomeIcon, Plus, Pencil, X,
  Palette, BookOpen, Wifi, WifiOff, HardDrive, ZoomIn, ZoomOut, RotateCcw, Underline, Strikethrough
} from 'lucide-react'
import { createWorkspace, newDoc, bind, useY, prepare, applyVars, FONTS, loadRooms, saveRooms, getUser, saveUser, NL, highlight, coverPos } from './store.js'
import { TEMPLATES } from './templates.js'
import { CoverPanel } from './Cover.jsx'
import { StylePanel } from './StylePanel.jsx'
import Preview from './Preview.jsx'
import Ribbon from './Ribbon.jsx'
import Home from './Home.jsx'
import { Window, DialogHost, ask } from './Dialog.jsx'
import { exportMd, exportHtml, exportDocx } from './export.js'

const logo = import.meta.env.BASE_URL + 'logo.png'

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

const B = (i, t, on, big) => ({ i, t, on, big })

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
  const [tab, setTab] = useState('Inicio')
  const ta = useRef()
  const hl = useRef()
  const main = useRef()
  const [busy, setBusy] = useState('')
  const run = async (label, fn) => {
    setBusy(label)
    try {
      await fn()
    } finally {
      setBusy('')
    }
  }
  const md = S.text.toString()
  const m = Object.fromEntries(S.meta.entries())
  const bl = S.blocks.toArray()
  const vars = Object.fromEntries(S.vars.entries())
  const st = Object.fromEntries(S.style.entries())
  const pre = prepare(md, vars)
  const rm = Object.fromEntries(Object.entries(m).map(([k, x]) => [k, typeof x === 'string' ? applyVars(x, pre.vars) : x]))
  const rst = { ...st, header: applyVars(String(st.header || ''), pre.vars) }

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

  const wrap = (p, post, ph) => {
    const t = ta.current
    const s = t.selectionStart
    const e = t.selectionEnd
    const v = t.value
    const sel = v.slice(s, e) || (ph ?? 'texto')
    setMd(v.slice(0, s) + p + sel + post + v.slice(e))
    requestAnimationFrame(() => {
      t.focus()
      t.setSelectionRange(s + p.length, s + p.length + sel.length)
    })
  }

  const image = async () => {
    const u = await ask({ title: 'Insertar imagen', text: 'Escribe la URL de la imagen (https://...)', input: true, placeholder: 'https://' })
    if (!u || !u.startsWith('https://')) return
    const t = await ask({ title: 'Texto alternativo', text: 'Describe la imagen', input: true })
    const alt = (t || 'imagen').split('[').join('').split(']').join('')
    wrap('', '![' + alt + '](' + u + ')', '')
  }

  const pickTemplate = async (e) => {
    const k = e.target.value
    e.target.value = ''
    if (!k) return
    const ok = await ask({ title: 'Aplicar plantilla', text: 'Se reemplazará el contenido actual por la plantilla ' + k + '.', ok: 'Reemplazar', danger: true })
    if (ok) {
      setMd(TEMPLATES[k])
      S.meta.set('tipo', k)
    }
  }

  const onKey = (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
    const t = e.target
    if (t.selectionStart !== t.selectionEnd) return
    const pos = t.selectionStart
    const v = t.value
    const start = v.lastIndexOf(NL, pos - 1) + 1
    const line = v.slice(start, pos)
    const num = line.match(/^( *)([0-9]+)([.)]) (.*)$/)
    const bul = line.match(/^( *)([-*+]) (.*)$/)
    if (!num && !bul) return
    e.preventDefault()
    const text = num ? num[4] : bul[3]
    if (!text.trim()) {
      setMd(v.slice(0, start) + v.slice(pos))
      requestAnimationFrame(() => t.setSelectionRange(start, start))
      return
    }
    const marker = num ? num[1] + (Number(num[2]) + 1) + num[3] + ' ' : bul[1] + bul[2] + ' '
    setMd(v.slice(0, pos) + NL + marker + v.slice(pos))
    requestAnimationFrame(() => t.setSelectionRange(pos + 1 + marker.length, pos + 1 + marker.length))
  }

  const moveCover = (id, pos) => {
    if (typeof id === 'string') {
      S.meta.set('pos_' + id, { ...coverPos(m, id), ...pos })
      return
    }
    S.doc.transact(() => {
      S.blocks.delete(id, 1)
      S.blocks.insert(id, [{ ...bl[id], ...pos, mode: 'free' }])
    })
  }

  const drag = (e) => {
    if (e.buttons !== 1) return
    const r = main.current.getBoundingClientRect()
    setSplit(Math.min(85, Math.max(15, ((e.clientX - r.left) / r.width) * 100)))
  }

  const toggle = (p) => setPanel(panel === p ? null : p)

  const model = {
    Archivo: [
      ['Exportar', [B(FileText, 'Markdown', () => exportMd(md, m, vars), 1), B(FileCode, 'HTML', () => exportHtml(rm, rst), 1), B(FileDown, 'Word', () => run('Generando Word…', () => exportDocx(prepare(md, vars, true).md, rm, bl, rst)), 1), B(Printer, 'PDF', () => window.print(), 1)]],
      [
        'Plantillas',
        [
          {
            node: (
              <select defaultValue="" title="Plantillas" onChange={pickTemplate}>
                <option value="">Elegir…</option>
                <option value="DRN">DRN</option>
                <option value="DRU">DRU</option>
                <option value="DRS">DRS (IEEE 830)</option>
              </select>
            )
          }
        ]
      ]
    ],
    Inicio: [
      [
        'Fuente',
        [
          {
            node: (
              <select title="Fuente del documento" value={st.fontBody || FONTS[0]} onChange={(e) => S.style.set('fontBody', e.target.value)}>
                {FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f.split(',')[0]}
                  </option>
                ))}
              </select>
            )
          },
          { node: <input type="number" title="Tamaño del texto (pt)" style={{ width: 52 }} value={st.sizeBody ?? 11} onChange={(e) => S.style.set('sizeBody', Number(e.target.value))} /> },
          B(Bold, 'Negrita', () => wrap('**', '**')),
          B(Italic, 'Cursiva', () => wrap('*', '*')),
          B(Underline, 'Subrayado', () => wrap('++', '++')),
          B(Strikethrough, 'Tachado', () => wrap('~~', '~~'))
        ]
      ],
      ['Párrafo', [B(Heading1, 'Título 1', () => wrap('# ', '')), B(Heading2, 'Título 2', () => wrap('## ', '')), B(Heading3, 'Título 3', () => wrap('### ', '')), B(List, 'Viñetas', () => wrap('- ', '')), B(ListOrdered, 'Numeración', () => wrap('1. ', ''))]]
    ],
    Insertar: [
      [
        'Elementos',
        [
          B(Table, 'Tabla', () => wrap('\n| Columna 1 | Columna 2 |\n|---|---|\n| ', ' | |\n'), 1),
          B(Code, 'Código', () => wrap('\n```\n', '\n```\n'), 1),
          B(ImageIcon, 'Imagen URL', image, 1),
          B(Workflow, 'Mermaid', () => wrap('\n```mermaid\n', '\n```\n', 'graph TD\n  A[Inicio] --> B[Fin]'), 1),
          B(ListTree, 'Índice', () => wrap('\n[TOC]\n', '', ''), 1)
        ]
      ],
      ['Página', [B(RectangleHorizontal, 'Horizontal', () => wrap('\n@pagina(horizontal)\n', '', ''), 1), B(RectangleVertical, 'Vertical', () => wrap('\n@pagina(vertical)\n', '', ''), 1)]],
      ['Variables', [B(Palette, 'Bloque vars', () => wrap('\n```vars\n', '\n```\n', '@var(id, contenido)'), 1)]]
    ],
    Diseño: [
      ['Documento', [B(BookOpen, 'Portada', () => toggle('cover'), 1), B(Palette, 'Estilo y variables', () => toggle('style'), 1)]],
      ['Zoom editor', [{ node: <Zoom v={ze} set={setZe} /> }]],
      ['Zoom vista previa', [{ node: <Zoom v={zp} set={setZp} /> }]]
    ]
  }

  return (
    <>
      {busy && (
        <div className="dlg-back">
          <div className="dlg pop loader">
            <span className="spin big" />
            {busy}
          </div>
        </div>
      )}
      {panel === 'cover' && (
        <Window title="Portada" onClose={() => setPanel(null)}>
          <CoverPanel S={S} m={m} bl={bl} />
        </Window>
      )}
      {panel === 'style' && (
        <Window title="Estilo y variables" x={140} y={170} onClose={() => setPanel(null)}>
          <StylePanel S={S} st={st} vars={vars} />
        </Window>
      )}
      <Ribbon model={model} tab={tab} setTab={setTab} />
      <div className="main" ref={main}>
        <section className="left" style={{ width: `calc(${split}% - 4px)` }}>
          <div className="ed-wrap">
            <pre ref={hl} className="hl" aria-hidden="true" style={{ fontSize: 14 * ze + 'px' }} dangerouslySetInnerHTML={{ __html: highlight(md) }} />
            <textarea
              ref={ta}
              className="editor"
              spellCheck={false}
              style={{ fontSize: 14 * ze + 'px' }}
              value={md}
              onChange={(e) => setMd(e.target.value)}
              onKeyDown={onKey}
              onScroll={(e) => {
                hl.current.scrollTop = e.target.scrollTop
                hl.current.scrollLeft = e.target.scrollLeft
              }}
            />
          </div>
        </section>
        <div className="resizer" onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)} onPointerMove={drag} />
        <section className="right">
          <div className="pv-scroll">
            <Preview md={pre.md} m={rm} bl={bl} st={rst} zoom={zp} onMove={moveCover} />
          </div>
        </section>
      </div>
    </>
  )
}

const Title = ({ theme, setTheme, children }) => (
  <header className="top">
    <img src={logo} alt="" />
    <b>ReqDocs Studio</b>
    <span className="sp" />
    {children}
    <button title="Cambiar modo claro u oscuro" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  </header>
)

function Room({ room, keyStr, user, notify, theme, setTheme }) {
  const W = useMemo(() => {
    const list = loadRooms()
    const rec = list.find((r) => r.room === room)
    saveRooms(rec ? list.map((r) => (r.room === room ? { ...r, ts: Date.now() } : r)) : [{ room, key: keyStr, owner: '', name: 'Sala ' + room.slice(0, 4), ts: Date.now() }, ...list])
    return createWorkspace(room, keyStr, user, rec && rec.owner)
  }, [])
  useY(W.docs)
  const [active, setActive] = useState(null)
  const [net, setNet] = useState(W.rtc.state)
  const [saved, setSaved] = useState(false)
  const seen = useRef(null)
  useEffect(() => {
    const now = new Map(net.users.map((u) => [u.id, u.name]))
    if (seen.current && net.ready) {
      now.forEach((n, uid) => {
        if (!seen.current.has(uid) && uid !== W.rtc.cid) notify(n + ' se unió a la sala', 'success')
      })
      seen.current.forEach((n, uid) => {
        if (!now.has(uid)) notify(n + ' salió de la sala')
      })
    }
    if (net.ready) seen.current = now
  }, [net.users])

  useEffect(() => {
    W.idb.whenSynced.then(() => setSaved(true))
    W.rtc.onChange = (s) => {
      setNet({ ...s })
      if (s.ready && W.docs.size === 0) newDoc(W, 'Documento 1', TEMPLATES.DRS, 'inicial')
    }
    W.rtc.onGone = () => {
      saveRooms(loadRooms().filter((r) => r.room !== room))
      indexedDB.deleteDatabase('reqdocs-' + room)
      notify('La sala fue eliminada por su propietario')
      location.hash = ''
    }
    return () => {
      W.rtc.onChange = null
      W.rtc.onGone = null
      W.rtc.stop()
      W.doc.destroy()
    }
  }, [])

  const ids = Array.from(W.docs.keys())
  const id = W.docs.has(active) ? active : ids[0]
  const S = id ? bind(W, id) : null

  useEffect(() => {
    if (id) W.rtc.setDoc(id)
  }, [id])

  const rename = async () => {
    const n = await ask({ title: 'Renombrar documento', text: 'Nuevo nombre', input: true, value: String(W.docs.get(id).get('name')) })
    if (n && n.trim()) W.docs.get(id).set('name', n.trim().slice(0, 60))
  }
  const remove = async () => {
    const ok = ids.length > 1 && (await ask({ title: 'Eliminar documento', text: 'Se eliminará para todos los participantes.', ok: 'Eliminar', danger: true }))
    if (ok) W.docs.delete(id)
  }
  const share = () => navigator.clipboard.writeText(location.href).then(() => notify('Enlace copiado al portapapeles'))
  const docName = (d) => (W.docs.has(d) ? String(W.docs.get(d).get('name')) : '')

  return (
    <div className="app">
      <Title theme={theme} setTheme={setTheme}>
        <button title="Volver a mis salas" onClick={() => (location.hash = '')}>
          <HomeIcon size={14} /> Inicio
        </button>
        <span className="badge" title={net.online ? 'Conectado al servidor' : 'Sin conexión: los cambios se guardan y se fusionan al reconectar'}>
          {net.online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {net.online ? (net.ready ? 'Sincronizado' : (<><span className="spin" /> Conectando</>)) : 'Sin conexión'}
        </span>
        <span className="badge" title="Guardado automático en este navegador">
          <HardDrive size={14} /> {saved ? 'Guardado local' : 'Cargando'}
        </span>
        {net.users.map((u) => (
          <span key={u.id} className="av" style={{ background: u.color }} title={`${u.name}${u.doc ? ' · ' + docName(u.doc) : ''}`}>
            {u.name.slice(0, 1).toUpperCase()}
          </span>
        ))}
        <button title="Copiar enlace de invitación" onClick={share}>
          <Link2 size={14} /> Compartir
        </button>
      </Title>
      <nav className="tabs">
        {ids.map((i) => (
          <div key={i} className={'tab' + (i === id ? ' on' : '')}>
            <button title="Abrir documento" onClick={() => setActive(i)}>
              {docName(i)}
              <small>{net.byDoc[i] || 0}</small>
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
      {S ? <DocView key={id} S={S} /> : <div className="loader"><span className="spin big" /> Cargando documento…</div>}
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

function NameModal({ onDone }) {
  const [n, setN] = useState('')
  return (
    <div className="modal">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (n.trim()) onDone({ name: n.trim().slice(0, 24) })
        }}
      >
        <img src={logo} alt="" height="40" />
        <b>Bienvenido a ReqDocs Studio</b>
        <label className="fld">
          <span>¿Cómo te llamas?</span>
          <input autoFocus maxLength={24} value={n} onChange={(e) => setN(e.target.value)} />
        </label>
        <button type="submit">Entrar</button>
      </form>
    </div>
  )
}

export default function App() {
  const [hash, setHash] = useState(location.hash)
  const [toasts, setToasts] = useState([])
  const [user, setUser] = useState(getUser)
  const [theme, setTheme] = useState(initTheme)

  useEffect(() => {
    const f = () => setHash(location.hash)
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('rd-theme', theme)
    } catch {
      document.documentElement.dataset.theme = theme
    }
  }, [theme])

  const notify = (text, kind = 'info') => {
    const id = Math.random()
    setToasts((l) => [...l, { id, text, kind }])
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 3500)
  }

  const p = new URLSearchParams(hash.slice(1))
  const room = p.get('sala')
  const key = p.get('clave')
  const valid = /^[a-f0-9]{32}$/.test(room || '') && /^[a-f0-9]{32}$/.test(key || '')

  if (!user) {
    return (
      <NameModal
        onDone={(u) => {
          saveUser(u)
          setUser(u)
        }}
      />
    )
  }

  return (
    <>
      {valid ? (
        <Room key={room} room={room} keyStr={key} user={user} notify={notify} theme={theme} setTheme={setTheme} />
      ) : (
        <div className="app">
          <Title theme={theme} setTheme={setTheme}>
            <span className="badge">{user.name}</span>
          </Title>
          <Home notify={notify} />
        </div>
      )}
      <div className="toasts">
        {toasts.map((x) => (
          <div key={x.id} className={'toast ' + x.kind}>
            {x.text}
          </div>
        ))}
      </div>
      <DialogHost />
    </>
  )
}
