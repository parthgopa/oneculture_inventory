import { useState, useEffect } from 'react'
import { MdAdd, MdDelete, MdEdit, MdPeople, MdWarning, MdVisibility,
         MdCheckCircle, MdSchedule, MdHistory, MdBuild, MdSwapHoriz } from 'react-icons/md'
import { apiFetch } from '../../config'
import { Badge, Modal, FormRow, WORK_TYPES_WORKER, STAGE_LABELS, STAGE_COLORS } from './helpers'
import styles from './WorkersTab.module.css'

function WorkerDetailModal({ worker, onClose }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    apiFetch(`/api/production/workers/${encodeURIComponent(worker.name)}/history`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [worker.name])

  return (
    <Modal title={`Worker: ${worker.name}`} onClose={onClose} width={700}>
      {loading && <div style={{ textAlign: 'center', padding: 40 }}><div className="loading" /><p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>Loading history...</p></div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {data && (
        <div>
          {/* Summary stats */}
          <div className={styles.detailStats}>
            <div className={styles.detailStat}>
              <div className={styles.detailStatVal} style={{ color: '#f59e0b' }}>{data.total_pieces_current}</div>
              <div className={styles.detailStatLabel}>Currently Holding</div>
            </div>
            <div className={styles.detailStat}>
              <div className={styles.detailStatVal} style={{ color: '#10b981' }}>{data.total_pieces_completed}</div>
              <div className={styles.detailStatLabel}>Pieces Completed</div>
            </div>
          </div>

          {/* Current holdings */}
          <div style={{ marginBottom: 20 }}>
            <div className={styles.sectionTitle}>
              <MdSchedule size={16} /> Current Work In-Hand
            </div>
            {data.current_holdings.length > 0 ? (
              <div className={styles.holdingTable}>
                {data.current_holdings.map((h, i) => (
                  <div key={i} className={styles.holdingRow}>
                    <span className={styles.skuPill}>{h.sku_name}</span>
                    {h.color && <span style={{ fontSize: 11, color: '#6366f1', background: '#eef2ff', padding: '2px 8px', borderRadius: 4, marginLeft: 8 }}>{h.color}</span>}
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 12 }}>
                      Received: {h.total_received} · Forwarded: {h.total_sent}
                    </span>
                    <span className="badge badge-warning">{h.quantity} pcs</span>
                  </div>
                ))}
              </div>
            ) : <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0' }}>No pieces currently in hand.</p>}
          </div>

          {/* Completed work */}
          {data.completed_skus.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className={styles.sectionTitle}>
                <MdCheckCircle size={16} style={{ color: '#10b981' }} /> Completed Work (Past)
              </div>
              <div className={styles.holdingTable}>
                {data.completed_skus.map((c, i) => (
                  <div key={i} className={styles.holdingRow}>
                    <span className={styles.skuPill}>{c.sku_name}</span>
                    {c.color && <span style={{ fontSize: 11, color: '#10b981', background: '#ecfdf5', padding: '2px 8px', borderRadius: 4, marginLeft: 8 }}>{c.color}</span>}
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 12 }}>
                      {c.total_received} pcs · {c.last_date ? new Date(c.last_date).toLocaleDateString('en-GB') : ''}
                    </span>
                    <span className="badge badge-success">Done</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full activity log */}
          <div>
            <div className={styles.sectionTitle}>
              <MdHistory size={16} /> Full Activity Log
            </div>
            {data.activity.length > 0 ? (
              <div className={styles.activityLog}>
                {data.activity.map((e, i) => (
                  <div key={i} className={styles.activityRow}>
                    <div className={styles.activityDot} style={{ background: STAGE_COLORS[e.stage] || '#94a3b8' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {e.sku_name}
                        {e.color && <span style={{ fontSize: 10, color: '#6366f1', background: '#eef2ff', padding: '1px 6px', borderRadius: 4 }}>{e.color}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.from_entity}</span>
                        <span style={{ color: '#6366f1', fontWeight: 800, fontSize: 13, lineHeight: 1 }}>→</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.to_entity}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{e.quantity} pcs</div>
                      <Badge text={STAGE_LABELS[e.stage] || e.stage} color={STAGE_COLORS[e.stage]} />
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {e.ledger_number_int ? <span style={{ color: '#6366f1', marginRight: 6 }}>#{e.ledger_number_int}</span> : null}
                        {new Date(e.created_at).toLocaleDateString('en-GB')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0' }}>No activity yet.</p>}
          </div>
        </div>
      )}
    </Modal>
  )
}

function WorkersTab({ workers, workerStock, onRefresh }) {
  const [modal, setModal]           = useState(null)
  const [selectedWorker, setSelectedWorker] = useState(null)
  const [editingWorker, setEditingWorker]   = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState(null)
  const [form, setForm]             = useState({ name: '', phone: '', work_type: 'Job Work' })
  const [editForm, setEditForm]     = useState({ name: '', phone: '', work_type: 'Job Work' })

  const close = () => { setModal(null); setError(null); setEditingWorker(null) }

  const openEdit = (w) => {
    setEditingWorker(w)
    setEditForm({ name: w.name, phone: w.phone || '', work_type: w.work_type || 'Job Work' })
    setError(null)
    setModal('edit')
  }

  const handleEdit = async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await apiFetch(`/api/production/workers/${editingWorker.worker_id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      close(); onRefresh()
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const handleAdd = async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await apiFetch('/api/production/workers', {
        method: 'POST',
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      close(); onRefresh()
      setForm({ name: '', phone: '', work_type: 'Job Work' })
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const handleDelete = async (workerId) => {
    if (!window.confirm('Remove this worker?')) return
    await apiFetch(`/api/production/workers/${workerId}`, { method: 'DELETE' })
    onRefresh()
  }

  // Seroski = Embroidery jobwork only, Additional Work = everything else
  const seroskiWorkers    = workers.filter(w => w.work_type === 'Embroidery')
  const additionalWorkers = workers.filter(w => w.work_type !== 'Embroidery')

  const renderCard = (w) => {
    const holding = workerStock.filter(ws => ws.worker_name === w.name)
    const total   = holding.reduce((s, h) => s + h.quantity, 0)
    return (
      <div key={w.worker_id} className={styles.workerCard}>
        <div className={styles.cardTop}>
          <div className={styles.avatar}>{w.name[0].toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div className={styles.workerName}>{w.name}</div>
          </div>
          <div className={styles.holdingBadge}>
            {total > 0
              ? <span className="badge badge-warning">{total} pcs</span>
              : <span className={styles.noHolding}>0 pcs</span>}
          </div>
          <button onClick={() => setSelectedWorker(w)} className={styles.viewBtn} title="View Details">
            <MdVisibility size={17} />
          </button>
          <button onClick={() => openEdit(w)} className={styles.editBtn} title="Edit Worker">
            <MdEdit size={17} />
          </button>
          <button onClick={() => handleDelete(w.worker_id)} className={styles.deleteBtn} title="Remove">
            <MdDelete size={17} />
          </button>
        </div>
        <div className={styles.cardBody}>
          <Badge text={w.work_type} color="#6366f1" />
       
        </div>
        {/*  */}
      </div>
    )
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <button className="btn btn-primary" onClick={() => setModal('add')}>
          <MdAdd size={18} /> Add Worker
        </button>
      </div>

      {workers.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 56 }}>
            <div className="empty-state-icon"><MdPeople size={56} /></div>
            <div className="empty-state-title">No workers added yet</div>
            <div className="empty-state-description">Add workers like Nilesh, Ramesh, Paresh etc.</div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setModal('add')}>
              <MdAdd size={18} /> Add First Worker
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.splitPane}>
          {/* Left — Seroski (Embroidery) */}
          <div className={styles.paneCol}>
            <div className={styles.paneHeader}>
              <MdBuild size={15} /> Seroski
              <span className={styles.paneCount}>{seroskiWorkers.length}</span>
            </div>
            <div className={styles.paneScroll}>
              {seroskiWorkers.length > 0
                ? seroskiWorkers.map(renderCard)
                : <p className={styles.emptyPane}>No Seroski workers</p>}
            </div>
          </div>
          {/* Right — Additional Work */}
          <div className={styles.paneCol}>
            <div className={styles.paneHeader}>
              <MdSwapHoriz size={15} /> Additional Work
              <span className={styles.paneCount}>{additionalWorkers.length}</span>
            </div>
            <div className={styles.paneScroll}>
              {additionalWorkers.length > 0
                ? additionalWorkers.map(renderCard)
                : <p className={styles.emptyPane}>No additional-work workers</p>}
            </div>
          </div>
        </div>
      )}

      {selectedWorker && (
        <WorkerDetailModal worker={selectedWorker} onClose={() => setSelectedWorker(null)} />
      )}

      {modal === 'edit' && editingWorker && (
        <Modal title={`Edit Worker: ${editingWorker.name}`} onClose={close} width={440}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}><MdWarning size={16} /> {error}</div>}
          <FormRow label="Worker Name" required>
            <input className="form-input" placeholder="e.g. Nilesh Bhai" value={editForm.name}
              onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
          </FormRow>
          <FormRow label="Phone Number">
            <input className="form-input" placeholder="Optional" value={editForm.phone}
              onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
          </FormRow>
          <FormRow label="Work Type">
            <select className="form-input" value={editForm.work_type}
              onChange={e => setEditForm(p => ({ ...p, work_type: e.target.value }))}>
              {WORK_TYPES_WORKER.map(t => <option key={t}>{t}</option>)}
            </select>
          </FormRow>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleEdit} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </Modal>
      )}

      {modal === 'add' && (
        <Modal title="Add New Worker" onClose={close} width={440}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}><MdWarning size={16} /> {error}</div>}
          <FormRow label="Worker Name" required>
            <input className="form-input" placeholder="e.g. Nilesh Bhai" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </FormRow>
          <FormRow label="Phone Number">
            <input className="form-input" placeholder="Optional" value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </FormRow>
          <FormRow label="Work Type">
            <select className="form-input" value={form.work_type}
              onChange={e => setForm(p => ({ ...p, work_type: e.target.value }))}>
              {WORK_TYPES_WORKER.map(t => <option key={t}>{t}</option>)}
            </select>
          </FormRow>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAdd} disabled={submitting}>
            {submitting ? 'Adding...' : 'Add Worker'}
          </button>
        </Modal>
      )}
    </div>
  )
}

export default WorkersTab
