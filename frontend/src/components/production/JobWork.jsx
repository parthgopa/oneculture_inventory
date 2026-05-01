import { useState } from 'react'
import { MdBuild, MdArrowForward, MdPeople, MdWarning } from 'react-icons/md'
import { apiFetch } from '../../config'
import { Badge, Modal, FormRow, STAGE_LABELS, STAGE_COLORS, WORK_TYPES_JOB } from './helpers'
import QuickAddWorker from './QuickAddWorker'
import styles from './JobWork.module.css'

function JobWork({ workers, workerStock, ledger, onRefresh }) {
  const [modal, setModal] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [localWorkers, setLocalWorkers] = useState(workers)

  const [assignForm, setAssignForm] = useState({
    order_id: '', item_id: '', sku_name: '', worker_name: '',
    quantity: '', work_type: 'Embroidery', notes: ''
  })

  const close = () => { setModal(null); setError(null) }

  const openAssign = () => {
    setAssignForm({ order_id: '', item_id: '', sku_name: '', worker_name: '', quantity: '', work_type: 'Embroidery', notes: '' })
    setLocalWorkers(workers)
    setModal('assign')
  }

  const mergeWorker = (w) => setLocalWorkers(prev => prev.find(p => p.worker_id === w.worker_id) ? prev : [...prev, w])

  const handleAssign = async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await apiFetch('/api/production/assign', {
        method: 'POST',
        body: JSON.stringify(assignForm)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      close(); onRefresh()
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const grouped = {}
  workerStock.forEach(ws => {
    if (!grouped[ws.worker_name]) grouped[ws.worker_name] = []
    grouped[ws.worker_name].push(ws)
  })

  const jobLedger = ledger.filter(e => e.stage === 'job_assigned')

  return (
    <div>
      {/* Action bar */}
      <div className={styles.toolbar}>
        <button className="btn btn-primary" onClick={openAssign}>
          <MdBuild size={17} /> Assign to Worker
        </button>
      </div>

      {/* Worker Cards */}
      {Object.keys(grouped).length > 0 ? (
        <div className={styles.workerGrid}>
          {Object.entries(grouped).map(([workerName, items]) => (
            <div key={workerName} className={styles.workerCard}>
              <div className={styles.workerCardHeader}>
                <div className={styles.avatar}>{workerName[0].toUpperCase()}</div>
                <div>
                  <div className={styles.workerName}>{workerName}</div>
                  <div className={styles.workerSub}>{items.reduce((s, i) => s + i.quantity, 0)} pieces total</div>
                </div>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className={styles.skuRow}>
                  <span className={styles.skuName}>{item.sku_name}</span>
                  <span className="badge badge-warning">{item.quantity}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon"><MdPeople size={52} /></div>
            <div className="empty-state-title">No pieces with workers</div>
            <div className="empty-state-description">Assign cloth to a worker after receiving an order</div>
          </div>
        </div>
      )}

      {/* Job Work Ledger */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <MdBuild size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Job Work Assignments
          </h3>
        </div>
        {jobLedger.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>SKU</th><th>Assigned To</th><th>Qty</th><th>Work Type</th><th>Notes</th><th>Date</th></tr>
              </thead>
              <tbody>
                {jobLedger.map((e, i) => (
                  <tr key={i}>
                    <td><strong>{e.sku_name}</strong></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className={styles.miniAvatar}>{e.to_entity[0].toUpperCase()}</div>
                        {e.to_entity}
                      </div>
                    </td>
                    <td><span className="badge badge-primary">{e.quantity}</span></td>
                    <td><Badge text={e.work_type || '—'} color="#f59e0b" /></td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e.notes || '—'}</td>
                    <td style={{ fontSize: 12 }}>{new Date(e.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 32 }}>
            <div className="empty-state-title">No job assignments yet</div>
            <div className="empty-state-description">Use the button above to assign pieces to a worker</div>
          </div>
        )}
      </div>

      {/* ── Assign Work Modal ──────────────────────────────────────────────── */}
      {modal === 'assign' && (
        <Modal title="Assign Work to Worker" onClose={close}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}><MdWarning size={16} /> {error}</div>}
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0 }}>
            Send pieces from company stock to a worker for job work.
          </p>
          <FormRow label="SKU Name" required>
            <input className="form-input" placeholder="e.g. Design A" value={assignForm.sku_name}
              onChange={e => setAssignForm(p => ({ ...p, sku_name: e.target.value }))} />
          </FormRow>
          <div className="form-group">
            <label className="form-label">Worker <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <select className="form-input" value={assignForm.worker_name}
              onChange={e => setAssignForm(p => ({ ...p, worker_name: e.target.value }))}>
              <option value="">Select Worker...</option>
              {localWorkers.map(w => <option key={w.worker_id} value={w.name}>{w.name} ({w.work_type})</option>)}
            </select>
            <QuickAddWorker defaultWorkType="Job Work"
              onWorkerAdded={(w) => { mergeWorker(w); setAssignForm(p => ({ ...p, worker_name: w.name })) }} />
          </div>
          <FormRow label="Quantity" required>
            <input className="form-input" type="number" min="1" placeholder="e.g. 50" value={assignForm.quantity}
              onChange={e => setAssignForm(p => ({ ...p, quantity: e.target.value }))} />
          </FormRow>
          <FormRow label="Work Type">
            <select className="form-input" value={assignForm.work_type}
              onChange={e => setAssignForm(p => ({ ...p, work_type: e.target.value }))}>
              {WORK_TYPES_JOB.map(t => <option key={t}>{t}</option>)}
            </select>
          </FormRow>
          <FormRow label="Notes">
            <input className="form-input" placeholder="Optional" value={assignForm.notes}
              onChange={e => setAssignForm(p => ({ ...p, notes: e.target.value }))} />
          </FormRow>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAssign} disabled={submitting}>
            {submitting ? 'Assigning...' : `Assign to ${assignForm.worker_name || 'Worker'}`}
          </button>
        </Modal>
      )}
    </div>
  )
}

export default JobWork
