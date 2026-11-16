import { useState } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { saveAs } from 'file-saver'
import { Plus, Link2, LogIn, Trash2 } from 'lucide-react'
import { rid, loadRooms, saveRooms } from './store.js'
import { deleteRemote } from './sync.js'
import { ask } from './Dialog.jsx'

async function downloadMd(r) {
  const doc = new Y.Doc()
  const p = new IndexeddbPersistence('reqdocs-' + r.room, doc)
  await p.whenSynced
  const out = []
  doc.getMap('docs').forEach((d) => out.push(d.get('md').toString()))
  await p.destroy()
  saveAs(new Blob([out.join('\n\n---\n\n')], { type: 'text/markdown;charset=utf-8' }), 'sala.md')
}

export default function Home({ notify }) {
  const [rooms, setRooms] = useState(loadRooms)
  const [name, setName] = useState('')
  const update = (l) => {
    setRooms(l)
    saveRooms(l)
  }
  const create = (e) => {
    e.preventDefault()
    const room = rid(16)
    const key = rid(16)
    update([{ room, key, owner: rid(16), name: name.trim().slice(0, 40) || 'Sala nueva', ts: Date.now() }, ...rooms])
    location.hash = `sala=${room}&clave=${key}`
  }
  const share = (r) =>
    navigator.clipboard.writeText(`${location.origin}${location.pathname}#sala=${r.room}&clave=${r.key}`).then(() => notify('Enlace copiado al portapapeles'))
  const remove = (r) => update(rooms.filter((x) => x.room !== r.room))
  const del = async (r) => {
    if (!r.owner) {
      if (await ask({ title: 'Quitar de mi lista', text: 'La sala no se borra para los demás.', ok: 'Quitar' })) remove(r)
      return
    }
    const sure = await ask({
      title: 'Eliminar sala',
      text: 'Esto elimina la sala para todos. Escribe eliminar todo para confirmar.',
      match: 'eliminar todo',
      placeholder: 'eliminar todo',
      ok: 'Eliminar',
      danger: true
    })
    if (!sure) return
    if (await ask({ title: 'Descargar copia', text: '¿Quieres descargar el .md antes de eliminar?', ok: 'Descargar', cancel: 'No, solo eliminar' })) {
      await downloadMd(r)
    }
    try {
      await deleteRemote(r.room, r.key, r.owner)
    } catch {
      notify('No se pudo eliminar en el servidor', 'warn')
      return
    }
    indexedDB.deleteDatabase('reqdocs-' + r.room)
    remove(r)
    notify('Sala eliminada', 'success')
  }

  return (
    <div className="home">
      <form className="row" onSubmit={create}>
        <input placeholder="Nombre de la nueva sala" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit">
          <Plus size={14} /> Nueva sala
        </button>
      </form>
      {rooms.length === 0 && <p>No tienes salas guardadas. Crea una o abre un enlace de invitación.</p>}
      {rooms.map((r) => (
        <div className="room" key={r.room}>
          <div style={{ flex: 1 }}>
            <b>{r.name}</b>
            <div className="mu">
              {r.owner ? 'Propietario' : 'Invitado'} · {new Date(r.ts).toLocaleString()}
            </div>
          </div>
          <button title="Entrar" onClick={() => (location.hash = `sala=${r.room}&clave=${r.key}`)}>
            <LogIn size={14} /> Entrar
          </button>
          <button title="Compartir enlace" onClick={() => share(r)}>
            <Link2 size={14} /> Compartir
          </button>
          <button title={r.owner ? 'Eliminar sala' : 'Quitar de mi lista'} onClick={() => del(r)}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
