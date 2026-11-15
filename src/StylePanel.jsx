import { Plus, Trash2 } from 'lucide-react'
import { FONTS, styleDefaults } from './store.js'

const sizes = [
  ['sizeTitle', 'Título (pt)'],
  ['sizeSub', 'Subtítulo (pt)'],
  ['sizeH1', 'Encabezado 1 (pt)'],
  ['sizeH2', 'Encabezado 2 (pt)'],
  ['sizeH3', 'Encabezado 3 (pt)'],
  ['sizeBody', 'Texto normal (pt)'],
  ['tbWidth', 'Borde tabla (px)'],
  ['tbPad', 'Relleno tabla (px)']
]

const colors = [
  ['tbBorder', 'Borde'],
  ['tbHead', 'Fondo cabecera'],
  ['tbHeadText', 'Texto cabecera'],
  ['tbZebra', 'Filas alternas']
]

export function StylePanel({ S, st, vars }) {
  const set = (k, v) => S.style.set(k, v)
  const addVar = () => {
    const n = prompt('Nombre de la variable (letras, números, - y _)')
    if (n && /^[\w-]+$/.test(n) && !S.vars.has(n)) S.vars.set(n, '')
  }
  return (
    <div className="cover-panel">
      {[
        ['fontBody', 'Fuente del texto'],
        ['fontHead', 'Fuente de títulos']
      ].map(([k, l]) => (
        <label key={k} className="fld">
          <span>{l}</span>
          <select value={st[k] || FONTS[0]} onChange={(e) => set(k, e.target.value)}>
            {FONTS.map((f) => (
              <option key={f} value={f}>
                {f.split(',')[0]}
              </option>
            ))}
          </select>
        </label>
      ))}
      <div className="row">
        {sizes.map(([k, l]) => (
          <label key={k} className="fld">
            <span>{l}</span>
            <input type="number" style={{ width: 84 }} value={st[k] ?? styleDefaults[k]} onChange={(e) => set(k, Number(e.target.value))} />
          </label>
        ))}
      </div>
      <div className="row">
        {colors.map(([k, l]) => (
          <label key={k} className="fld">
            <span>{l}</span>
            <input type="color" value={st[k] || styleDefaults[k]} onChange={(e) => set(k, e.target.value)} />
          </label>
        ))}
      </div>
      <label className="fld">
        <span>Encabezado de página</span>
        <input value={st.header || ''} onChange={(e) => set('header', e.target.value)} />
      </label>
      <b>Variables: usa @var(nombre) en el texto</b>
      {Object.keys(vars).map((n) => (
        <div className="row" key={n}>
          <code>@var({n})</code>
          <input value={vars[n]} onChange={(e) => S.vars.set(n, e.target.value)} />
          <button title="Eliminar variable" onClick={() => S.vars.delete(n)}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div className="row">
        <button title="Agregar variable" onClick={addVar}>
          <Plus size={14} /> Variable
        </button>
      </div>
    </div>
  )
}
