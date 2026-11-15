import * as Y from 'yjs'

const enc = (u) => {
  let s = ''
  for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192))
  return btoa(s)
}
const dec = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '').replace(/^http/, 'ws')

export class WsProvider {
  constructor(doc, room, key, name, owner) {
    this.name = name
    this.owner = owner || ''
    this.onGone = null
    this.doc = doc
    this.room = room
    this.key = key
    this.ws = null
    this.mirror = null
    this.ready = false
    this.stopped = false
    this.retry = 0
    this.cur = ''
    this.onChange = null
    this.cid = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('')
    this.state = { online: false, ready: false, total: 1, byDoc: {}, users: [] }
    doc.on('update', this.onUpdate)
  }

  setState = (p) => {
    this.state = { ...this.state, ...p }
    if (this.onChange) this.onChange(this.state)
  }

  send = (o) => {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o))
  }

  setDoc = (id) => {
    if (this.cur === id) return
    this.cur = id
    this.send({ t: 'doc', doc: id })
  }

  start = () => {
    this.connect()
  }

  stop = () => {
    this.stopped = true
    clearTimeout(this.timer)
    clearInterval(this.hb)
    this.doc.off('update', this.onUpdate)
    if (this.ws) this.ws.close()
  }

  connect = () => {
    if (this.stopped || !API) return
    const ws = new WebSocket(`${API}/json/reqdocs/${this.room}/ws`)
    this.ws = ws
    ws.onopen = () => {
      this.retry = 0
      this.mirror = new Y.Doc()
      this.send({ t: 'hello', key: this.key, client: this.cid, doc: this.cur, name: this.name, owner: this.owner })
      this.hb = setInterval(() => this.send({ t: 'ping' }), 25000)
    }
    ws.onmessage = (e) => this.onMessage(JSON.parse(e.data))
    ws.onclose = () => {
      clearInterval(this.hb)
      if (this.mirror) this.mirror.destroy()
      this.mirror = null
      this.ready = false
      this.setState({ online: false, ready: false })
      if (!this.stopped) this.timer = setTimeout(this.connect, Math.min(15000, 1000 * 2 ** this.retry++) + Math.random() * 500)
    }
  }

  onMessage = (m) => {
    if (m.t === 'sync') {
      this.doc.transact(() => {
        m.ups.forEach((s) => {
          const u = dec(s)
          Y.applyUpdate(this.doc, u)
          if (this.mirror) Y.applyUpdate(this.mirror, u)
        })
      }, this)
    } else if (m.t === 'ready') {
      const d = Y.encodeStateAsUpdate(this.doc, Y.encodeStateVector(this.mirror))
      this.mirror.destroy()
      this.mirror = null
      if (d.length > 2) this.send({ t: 'upd', u: enc(d) })
      this.ready = true
      this.setState({ online: true, ready: true })
    } else if (m.t === 'upd') {
      Y.applyUpdate(this.doc, dec(m.u), this)
    } else if (m.t === 'gone') {
      if (this.onGone) this.onGone()
    } else if (m.t === 'pres') {
      const users = (m.users || []).map((u) => ({ id: String(u.id), name: String(u.name), doc: String(u.doc), color: /^#[0-9a-f]{6}$/.test(u.color) ? u.color : '#888888' }))
      this.setState({ total: m.total, byDoc: m.by_doc, users })
    }
  }

  onUpdate = (u, origin) => {
    if (origin === this || !this.ready) return
    this.send({ t: 'upd', u: enc(u) })
  }
}

export const deleteRemote = (room, key, owner) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(`${API}/json/reqdocs/${room}/ws`)
    let done = false
    const timer = setTimeout(() => {
      ws.close()
      reject(new Error('timeout'))
    }, 15000)
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', key, client: 'aaaaaaaa', doc: '', name: 'Propietario', owner }))
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.t === 'ready') ws.send(JSON.stringify({ t: 'del', owner }))
      if (m.t === 'gone') {
        done = true
        clearTimeout(timer)
        resolve()
      }
    }
    ws.onclose = () => {
      clearTimeout(timer)
      if (!done) reject(new Error('closed'))
    }
  })
