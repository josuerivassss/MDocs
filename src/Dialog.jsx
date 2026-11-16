import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

let opener = null

export const ask = (o) => new Promise((res) => opener && opener({ ...o, res }))

export function DialogHost() {
  const [d, setD] = useState(null)
  const [v, setV] = useState('')
  useEffect(() => {
    opener = (o) => {
      setV(o.value || '')
      setD(o)
    }
    return () => {
      opener = null
    }
  }, [])
  if (!d) return null
  const typed = d.input || d.match
  const done = (r) => {
    d.res(r)
    setD(null)
  }
  const cancel = () => done(d.input ? null : false)
  const ok = !d.match || v === d.match
  return (
    <div className='dlg-back' onMouseDown={cancel}>
      <form
        className='dlg pop'
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && cancel()}
        onSubmit={(e) => {
          e.preventDefault()
          if (ok) done(d.input ? v : true)
        }}
      >
        <div className='dlg-t'>{d.title}</div>
        {d.text && <p>{d.text}</p>}
        {typed && <input autoFocus value={v} placeholder={d.placeholder || ''} onChange={(e) => setV(e.target.value)} />}
        <div className='dlg-b'>
          <button type='button' onClick={cancel}>
            {d.cancel || 'Cancelar'}
          </button>
          <button type='submit' autoFocus={!typed} className={d.danger ? 'danger' : 'primary'} disabled={!ok}>
            {d.ok || 'Aceptar'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function Window({ title, onClose, children, x = 80, y = 140 }) {
  const [p, setP] = useState({ x, y })
  const g = useRef(null)
  const down = (e) => {
    g.current = { sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e) => {
    if (!g.current) return
    setP({ x: Math.max(0, g.current.ox + e.clientX - g.current.sx), y: Math.max(0, g.current.oy + e.clientY - g.current.sy) })
  }
  return (
    <div className='win pop' style={{ left: p.x, top: p.y }}>
      <div
        className='win-t'
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => {
          g.current = null
        }}
      >
        <span>{title}</span>
        <button title='Cerrar' onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      <div className='win-b'>{children}</div>
    </div>
  )
}
