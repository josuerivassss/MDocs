import { useState } from 'react'
import { ArrowUp, ArrowDown, Trash2, Type, ImagePlus } from 'lucide-react'
import { uid, safeImg, coverPos, blockPos, PRESETS } from './store.js'

const fields = [
  ['institucion', 'Institución'],
  ['tipo', 'Tipo de documento'],
  ['titulo', 'Título'],
  ['subtitulo', 'Subtítulo'],
  ['autores', 'Autores'],
  ['version', 'Versión'],
  ['fecha', 'Fecha']
]

const names = [
  ['institucion', 'Institución'],
  ['tipo', 'Tipo'],
  ['titulo', 'Título'],
  ['subtitulo', 'Subtítulo'],
  ['autores', 'Autores'],
  ['version', 'Versión y fecha']
]

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export function CoverSheet({ m, bl, zoom = 1, onMove }) {
  const [drag, setDrag] = useState(null)
  const down = (id, p) => (e) => {
    if (!onMove) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, x: p.x, y: p.y, w: p.w })
  }
  const move = (e) => {
    if (!drag) return
    setDrag({
      ...drag,
      x: clamp(drag.ox + (e.clientX - drag.sx) / zoom, 20 - drag.w, 796),
      y: clamp(drag.oy + (e.clientY - drag.sy) / zoom, 0, 1036)
    })
  }
  const up = () => {
    if (!drag) return
    onMove(drag.id, { x: Math.round(drag.x), y: Math.round(drag.y) })
    setDrag(null)
  }
  const box = (id, p, cls, extra, children) => {
    const q = drag && drag.id === id ? { ...p, x: drag.x, y: drag.y } : p
    return (
      <div
        key={id}
        className={'cv-el ' + cls + (onMove ? ' mv' : '')}
        style={{ left: q.x, top: q.y, width: q.w, textAlign: q.align, ...extra }}
        onPointerDown={down(id, p)}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {children}
      </div>
    )
  }
  const P = (k) => coverPos(m, k)
  return (
    <section className='sheet cover'>
      {box('institucion', P('institucion'), 'cv-inst', {}, m.institucion)}
      {box('tipo', P('tipo'), 'cv-tipo', {}, m.tipo)}
      {box('titulo', P('titulo'), 'cv-title', {}, m.titulo)}
      {box('subtitulo', P('subtitulo'), 'cv-sub', {}, m.subtitulo)}
      {box('autores', P('autores'), 'cv-foot', {}, m.autores)}
      {box('version', P('version'), 'cv-foot', {}, 'Versión ' + m.version + ' · ' + m.fecha)}
      {bl.map((b, i) => {
        if (b.kind !== 'txt' && !safeImg(b.src)) return null
        const p = blockPos(b, i)
        if (b.kind === 'txt') {
          const st = { fontSize: clamp(Number(b.size) || 16, 6, 96) + 'px', fontWeight: b.bold ? 700 : 400 }
          return box(i, p, 'cv-txt', st, b.text)
        }
        const img = (
          <img
            src={b.src}
            alt=''
            draggable={false}
            style={{ width: '100%', height: clamp(Number(b.h) || p.w, 5, 1056), opacity: clamp(Number(b.opacity) || 1, 0.05, 1), display: 'block' }}
          />
        )
        return box(i, p, 'cv-img', { zIndex: b.z < 0 ? -1 : 1 }, img)
      })}
    </section>
  )
}

const Num = ({ v, on, t }) => (
  <input type='number' title={t} style={{ width: 64 }} value={v} onChange={(e) => on(Number(e.target.value))} />
)

const preset = (p, v) => {
  const [y, a] = PRESETS[v]
  const x = a === 'left' ? 96 : a === 'right' ? 720 - p.w : (816 - p.w) / 2
  return { x: Math.round(x), y, align: a }
}

const PosRow = ({ label, p, on, width }) => (
  <div className='row'>
    <b style={{ minWidth: 96 }}>{label}</b>
    <select value='' onChange={(e) => e.target.value && on(preset(p, e.target.value))}>
      <option value=''>Ubicar…</option>
      {Object.keys(PRESETS).map((k) => (
        <option key={k} value={k}>
          {k}
        </option>
      ))}
    </select>
    <Num t='X (px)' v={Math.round(p.x)} on={(v) => on({ x: v })} />
    <Num t='Y (px)' v={Math.round(p.y)} on={(v) => on({ y: v })} />
    {width && <Num t='Ancho (px)' v={Math.round(p.w)} on={(v) => on({ w: v })} />}
  </div>
)

export function CoverPanel({ S, m, bl }) {
  const set = (k, v) => S.meta.set(k, v)
  const setPos = (k, patch) => S.meta.set('pos_' + k, { ...coverPos(m, k), ...patch })
  const upd = (i, p) =>
    S.doc.transact(() => {
      S.blocks.delete(i, 1)
      S.blocks.insert(i, [{ ...bl[i], ...p }])
    })
  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= bl.length) return
    S.doc.transact(() => {
      S.blocks.delete(i, 1)
      S.blocks.insert(j, [bl[i]])
    })
  }
  const addText = () =>
    S.blocks.push([{ id: uid(), kind: 'txt', text: 'Nuevo texto', align: 'center', size: 16, bold: false }])
  const addImage = (f) => {
    if (!f || f.size > 1e6) return
    const r = new FileReader()
    r.onload = () =>
      S.blocks.push([{ id: uid(), kind: 'img', src: r.result, w: 120, h: 120, mode: 'free', opacity: 1, z: 1 }])
    r.readAsDataURL(f)
  }
  return (
    <div className='cover-panel'>
      {fields.map(([k, l]) => (
        <label key={k} className='fld'>
          <span>{l}</span>
          <input value={m[k] || ''} onChange={(e) => set(k, e.target.value)} />
        </label>
      ))}
      <label className='fld'>
        <span>Texto del pie de página</span>
        <input value={m.pie || ''} onChange={(e) => set('pie', e.target.value)} />
      </label>
      <label className='row'>
        <input type='checkbox' checked={!!m.numeracion} onChange={(e) => set('numeracion', e.target.checked)} />
        Numeración automática de páginas
      </label>
      <b>Posición (también puedes arrastrar cada elemento en la vista previa)</b>
      {names.map(([k, l]) => (
        <PosRow key={k} label={l} p={coverPos(m, k)} on={(patch) => setPos(k, patch)} width />
      ))}
      <div className='row'>
        <button title='Agregar bloque de texto' onClick={addText}>
          <Type size={16} /> Texto
        </button>
        <label className='btn' title='Subir imagen (máximo 1 MB)'>
          <ImagePlus size={16} /> Imagen
          <input type='file' accept='image/png,image/jpeg,image/gif' hidden onChange={(e) => addImage(e.target.files[0])} />
        </label>
      </div>
      {bl.map((b, i) => (
        <div className='blk' key={b.id}>
          <div className='row'>
            <b>{b.kind === 'txt' ? 'Texto' : 'Imagen'}</b>
            <button title='Subir' onClick={() => move(i, -1)}>
              <ArrowUp size={14} />
            </button>
            <button title='Bajar' onClick={() => move(i, 1)}>
              <ArrowDown size={14} />
            </button>
            <button title='Eliminar' onClick={() => S.blocks.delete(i, 1)}>
              <Trash2 size={14} />
            </button>
          </div>
          <PosRow label='Posición' p={blockPos(b, i)} on={(patch) => upd(i, { ...patch, mode: 'free' })} width={b.kind === 'txt'} />
          {b.kind === 'txt' ? (
            <div className='row'>
              <input value={b.text} onChange={(e) => upd(i, { text: e.target.value })} />
              <Num t='Tamaño (px)' v={b.size} on={(v) => upd(i, { size: v })} />
              <label className='row'>
                <input type='checkbox' checked={!!b.bold} onChange={(e) => upd(i, { bold: e.target.checked })} />
                Negrita
              </label>
            </div>
          ) : (
            <div className='row'>
              <Num t='Ancho (px)' v={b.w} on={(v) => upd(i, { w: v })} />
              <Num t='Alto (px)' v={b.h} on={(v) => upd(i, { h: v })} />
              <select value={b.z} onChange={(e) => upd(i, { z: Number(e.target.value) })}>
                <option value={1}>Al frente</option>
                <option value={-1}>Detrás</option>
              </select>
              <input type='range' min='0.1' max='1' step='0.05' value={b.opacity} onChange={(e) => upd(i, { opacity: Number(e.target.value) })} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}