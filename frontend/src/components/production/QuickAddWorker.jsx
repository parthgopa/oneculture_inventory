import { useState } from 'react'
import { MdAdd, MdClose } from 'react-icons/md'
import { apiFetch } from '../../config'
import { WORK_TYPES_WORKER } from './helpers'
import styles from './QuickAddWorker.module.css'

function QuickAddWorker({ defaultWorkType = 'Job Work', onWorkerAdded }) {
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')
  const [workType, setWorkType] = useState(defaultWorkType)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)

  const handleAdd = async () => {
    if (!name.trim()) { setError('Name required'); return }
    setAdding(true); setError(null)
    try {
      const res = await apiFetch('/api/production/workers', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), work_type: workType })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onWorkerAdded(data)
      setShow(false); setName(''); setWorkType(defaultWorkType)
    } catch (e) { setError(e.message) }
    finally { setAdding(false) }
  }

  if (!show) return (
    <button type="button" className={styles.addLink} onClick={() => setShow(true)}>
      <MdAdd size={14} /> Add New Worker
    </button>
  )

  return (
    <div className={styles.panel}>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Name *</label>
          <input className="form-input" placeholder="Worker name" value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        </div>
        <div className={styles.typeField}>
          <label className={styles.fieldLabel}>Work Type</label>
          <select className="form-input" value={workType} onChange={e => setWorkType(e.target.value)}>
            {WORK_TYPES_WORKER.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-primary" style={{ fontSize: 12, padding: '8px 14px', flexShrink: 0 }}
          onClick={handleAdd} disabled={adding}>
          {adding ? '...' : 'Add'}
        </button>
        <button type="button" onClick={() => { setShow(false); setError(null) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, flexShrink: 0 }}>
          <MdClose size={16} />
        </button>
      </div>
    </div>
  )
}

export default QuickAddWorker
