import { ArrowUp, ArrowDown, Trash2, Type, ImagePlus } from 'lucide-react'
import { uid, safeImg } from './store.js'

const fields = [
  ['institucion', 'Institución'],
  ['tipo', 'Tipo de documento'],
  ['titulo', 'Título'],
  ['subtitulo', 'Subtítulo'],
  ['autores', 'Autores'],
  ['version', 'Versión'],
  ['fecha', 'Fecha']
]

export function CoverSheet({ m, bl }) {
  return (
    <section className="sheet cover">
      <div className="cv-inst">{m.institucion}</div>
      <div className="cv-tipo">{m.tipo}</div>
      <h1 className="cv-title">{m.titulo}</h1>
      <h2 className="cv-sub">{m.subtitulo}</h2>
      {bl.filter((b) => b.kind === 'txt' || safeImg(b.src)).map((b) => {
        if (b.kind === 'txt') {
          return (
            <div key={b.id} style={{ textAlign: b.align, fontSize: b.size + 'px', fontWeight: b.bold ? 700 : 400 }}>
              {b.text}
            </div>
          )
        }
        const style = { width: b.w, height: b.h, opacity: b.opacity }
        if (b.mode === 'free') {
          return <img key={b.id} src={b.src} alt="" style={{ ...style, position: 'absolute', left: b.x, top: b.y, zIndex: b.z }} />
        }
        return (
          <div key={b.id} style={{ textAlign: b.align }}>
            <img src={b.src} alt="" style={style} />
          </div>
        )
      })}
      <div className="cv-foot">
        <p>{m.autores}</p>
        <p>
          Versión {m.version} · {m.fecha}
        </p>
      </div>
    </section>
  )
}

const Num = ({ v, on, w = 64 }) => (
  <input type="number" style={{ width: w }} value={v} onChange={(e) => on(Number(e.target.value))} />
)

export function CoverPanel({ S, m, bl }) {
  const set = (k, v) => S.meta.set(k, v)
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
      S.blocks.push([
        { id: uid(), kind: 'img', src: r.result, w: 120, h: 120, align: 'center', mode: 'flow', x: 40, y: 40, opacity: 1, z: 1 }
      ])
    r.readAsDataURL(f)
  }
  return (
    <div className="cover-panel">
      {fields.map(([k, l]) => (
        <label key={k} className="fld">
          <span>{l}</span>
          <input value={m[k] || ''} onChange={(e) => set(k, e.target.value)} />
        </label>
      ))}
      <label className="fld">
        <span>Texto del pie de página</span>
        <input value={m.pie || ''} onChange={(e) => set('pie', e.target.value)} />
      </label>
      <label className="row">
        <input type="checkbox" checked={!!m.numeracion} onChange={(e) => set('numeracion', e.target.checked)} />
        Numeración automática de páginas
      </label>
      <div className="row">
        <button title="Agregar bloque de texto" onClick={addText}>
          <Type size={16} /> Texto
        </button>
        <label className="btn" title="Subir imagen">
          <ImagePlus size={16} /> Imagen
          <input type="file" accept="image/png,image/jpeg,image/gif" hidden onChange={(e) => addImage(e.target.files[0])} />
        </label>
      </div>
      {bl.map((b, i) => (
        <div className="blk" key={b.id}>
          <div className="row">
            <b>{b.kind === 'txt' ? 'Texto' : 'Imagen'}</b>
            <button title="Subir" onClick={() => move(i, -1)}>
              <ArrowUp size={14} />
            </button>
            <button title="Bajar" onClick={() => move(i, 1)}>
              <ArrowDown size={14} />
            </button>
            <button title="Eliminar" onClick={() => S.blocks.delete(i, 1)}>
              <Trash2 size={14} />
            </button>
          </div>
          {b.kind === 'txt' ? (
            <>
              <input value={b.text} onChange={(e) => upd(i, { text: e.target.value })} />
              <div className="row">
                <select value={b.align} onChange={(e) => upd(i, { align: e.target.value })}>
                  <option value="left">Izquierda</option>
                  <option value="center">Centro</option>
                  <option value="right">Derecha</option>
                </select>
                <Num v={b.size} on={(v) => upd(i, { size: v })} />
                <label className="row">
                  <input type="checkbox" checked={b.bold} onChange={(e) => upd(i, { bold: e.target.checked })} />
                  Negrita
                </label>
              </div>
            </>
          ) : (
            <div className="row">
              <Num v={b.w} on={(v) => upd(i, { w: v })} />
              <Num v={b.h} on={(v) => upd(i, { h: v })} />
              <select value={b.mode} onChange={(e) => upd(i, { mode: e.target.value })}>
                <option value="flow">En flujo</option>
                <option value="free">Libre / superpuesta</option>
              </select>
              <select value={b.align} onChange={(e) => upd(i, { align: e.target.value })}>
                <option value="left">Izquierda</option>
                <option value="center">Centro</option>
                <option value="right">Derecha</option>
              </select>
              <Num v={b.x} on={(v) => upd(i, { x: v })} />
              <Num v={b.y} on={(v) => upd(i, { y: v })} />
              <select value={b.z} onChange={(e) => upd(i, { z: Number(e.target.value) })}>
                <option value={1}>Al frente</option>
                <option value={-1}>Detrás</option>
              </select>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={b.opacity}
                onChange={(e) => upd(i, { opacity: Number(e.target.value) })}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
