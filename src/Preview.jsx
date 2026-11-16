import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { CoverSheet } from './Cover.jsx'
import { splitSections, styleVars, useDebounced, gridHtml } from './store.js'
import { cache, ensure, keyOf, isDiagram } from './diagrams.js'

DOMPurify.addHook('afterSanitizeAttributes', (n) => {
  if (n.tagName === 'IMG') {
    if (!/^(data:image\/(png|jpeg|gif);base64,|https:\/\/)/.test(n.getAttribute('src') || '')) n.removeAttribute('src')
    n.setAttribute('referrerpolicy', 'no-referrer')
  }
  if (n.tagName === 'A') {
    n.setAttribute('rel', 'noopener noreferrer')
    n.setAttribute('target', '_blank')
  }
})

const CLEAN = {
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#|data:image\/(?:png|jpeg|gif);base64,)/i,
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'object', 'embed']
}

let cur = []

marked.use({
  renderer: {
    code({ text, lang }) {
      if (lang === 'tabla') return gridHtml(text, (s) => marked.parseInline(s))
      if (!isDiagram(lang)) return false
      cur.push([lang, text])
      return `<div class="mmd" data-m="${cur.length - 1}"></div>`
    }
  }
})

function render(s) {
  cur = []
  const found = cur
  const h = DOMPurify.sanitize(marked.parse(s), CLEAN)
  return h.replace(/<div class="mmd" data-m="(\d+)"><\/div>/g, (a, i) => `<div class="mmd">${cache.get(keyOf(found[i][0], found[i][1])) ?? `<span class="spin"></span> Renderizando diagrama…`}</div>`)
}

function paginate(el, limit) {
  const pages = [[]]
  let h = 0
  const mh = (c) => {
    const s = getComputedStyle(c)
    return c.offsetHeight + parseFloat(s.marginTop) + parseFloat(s.marginBottom)
  }
  const add = (html, ch) => {
    pages[pages.length - 1].push(html)
    h += ch
  }
  const brk = () => {
    pages.push([])
    h = 0
  }
  const items = (c) =>
    c.tagName === 'PRE'
      ? c.textContent.replace(/\n$/, '').split('\n')
      : c.tagName === 'TABLE'
        ? Array.from(c.tBodies[0] ? c.tBodies[0].rows : [])
        : Array.from(c.children)
  const shell = (c, its, from) => {
    const n = c.cloneNode(false)
    if (c.tagName === 'PRE') n.textContent = its.join('\n')
    else if (c.tagName === 'TABLE') {
      if (c.tHead) n.appendChild(c.tHead.cloneNode(true))
      const tb = document.createElement('tbody')
      its.forEach((r) => tb.appendChild(r.cloneNode(true)))
      n.appendChild(tb)
    } else its.forEach((i) => n.appendChild(i.cloneNode(true)))
    if (c.tagName === 'OL') n.setAttribute('start', String((c.start || 1) + from))
    return n
  }
  const size = (n) => {
    el.appendChild(n)
    const r = mh(n)
    el.removeChild(n)
    return r
  }
  Array.from(el.children).forEach((c) => {
    const ch = mh(c)
    if (ch <= limit - h) return add(c.outerHTML, ch)
    const splittable = ['PRE', 'TABLE', 'UL', 'OL'].includes(c.tagName)
    if (!splittable || ch <= limit) {
      if (pages[pages.length - 1].length) brk()
      return add(c.outerHTML, ch)
    }
    const its = items(c)
    let i = 0
    while (i < its.length) {
      const room = limit - h
      let k = 0
      while (i + k < its.length && size(shell(c, its.slice(i, i + k + 1), i)) <= room) k++
      if (k === 0) {
        if (pages[pages.length - 1].length) {
          brk()
          continue
        }
        k = 1
      }
      const n = shell(c, its.slice(i, i + k), i)
      add(n.outerHTML, size(n))
      i += k
      if (i < its.length) brk()
    }
  })
  return pages.map((p) => p.join(''))
}

export default function Preview({ md: rawMd, m, bl, st, zoom, onMove }) {
  const md = useDebounced(rawMd, 250)
  const ref = useRef()
  const [pages, setPages] = useState([])
  const [tick, setTick] = useState(0)
  const vars = styleVars(st)
  const sk = JSON.stringify(vars)

  useEffect(() => {
    const need = new Map()
    marked.walkTokens(marked.lexer(md), (t) => {
      if (t.type !== 'code' || !isDiagram(t.lang)) return
      const k = keyOf(t.lang, t.text)
      if (!cache.has(k)) need.set(k, [t.lang, t.text])
    })
    if (!need.size) return
    let dead = false
    ;(async () => {
      for (const [l, t] of need.values()) await ensure(l, t)
      if (!dead) setTick((n) => n + 1)
    })()
    return () => {
      dead = true
    }
  }, [md])

  useLayoutEffect(() => {
    const el = ref.current
    const secs = splitSections(md).filter((s) => s.md.trim())
    const out = []
    ;(secs.length ? secs : [{ o: 'v', md: '' }]).forEach((s) => {
      const land = s.o === 'h'
      el.style.width = (land ? 864 : 624) + 'px'
      el.innerHTML = render(s.md)
      paginate(el, land ? 640 : 880).forEach((html) => out.push({ land, html }))
    })
    const where = []
    out.forEach((p, i) => {
      const n = (p.html.match(/<h[1-4][ >]/g) || []).length
      for (let k = 0; k < n; k++) where.push(i + 1)
    })
    setPages(
      out.map((p) => ({
        ...p,
        html: p.html.replace(/‹p([0-9]+)›/g, (a, i) => `<span class='toc-p'>${where[i] ?? ''}</span>`)
      }))
    )
  }, [md, tick, sk])

  return (
    <>
      <div className="sheets" style={{ ...vars, zoom }}>
        <CoverSheet m={m} bl={bl} zoom={zoom} onMove={onMove} />
        {pages.map((p, i) => (
          <section className={'sheet' + (p.land ? ' land' : '')} key={i}>
            {st.header && <header>{st.header}</header>}
            <div className="content" dangerouslySetInnerHTML={{ __html: p.html }} />
            <footer>
              <span>{m.pie}</span>
              {m.numeracion && <span>Página {i + 1}</span>}
            </footer>
          </section>
        ))}
      </div>
      <div ref={ref} className="measure content" style={vars} />
    </>
  )
}
