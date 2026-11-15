export default function Ribbon({ model, tab, setTab }) {
  return (
    <div className="ribbon">
      <div className="rb-tabs">
        {Object.keys(model).map((t) => (
          <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="rb-body">
        {(model[tab] || []).map(([n, items]) => (
          <div className="grp" key={n}>
            <div className="grp-in">
              {items.map((x, i) =>
                x.node ? (
                  <span key={i}>{x.node}</span>
                ) : (
                  <button key={x.t} className={'rb' + (x.big ? ' big' : '')} title={x.t} onClick={x.on}>
                    <x.i size={x.big ? 22 : 16} />
                    {x.big && <span>{x.t}</span>}
                  </button>
                )
              )}
            </div>
            <div className="grp-n">{n}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
