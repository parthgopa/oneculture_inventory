import { useState } from 'react'
import { MdBuild, MdArrowForward, MdPeople, MdWarning, MdUndo } from 'react-icons/md'
import { apiFetch } from '../../config'
import { Badge, Modal, FormRow, STAGE_LABELS, STAGE_COLORS, WORK_TYPES_JOB,
         EditableDateCell, RevertButton } from './helpers'
import QuickAddWorker from './QuickAddWorker'
import styles from './JobWork.module.css'

function JobWork({ workers, workerStock, ledger, onRefresh }) {
  const [modal, setModal] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [localWorkers, setLocalWorkers] = useState(workers)

  const [assignForm, setAssignForm] = useState({
    order_id: '', item_id: '', sku_name: '', worker_name: '',
    quantity: '', work_type: 'Embroidery', notes: '', date: ''
  })

  const [returnForm, setReturnForm] = useState({
    from_entity: '', sku_name: '', quantity: '', supplier_name: '', notes: ''
  })

  const close = () => { setModal(null); setError(null) }

  const openReturn = () => {
    setReturnForm({ from_entity: '', sku_name: '', quantity: '', supplier_name: '', notes: '' })
    setModal('return')
  }

  const handleReturn = async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await apiFetch('/api/production/return-to-supplier', {
        method: 'POST',
        body: JSON.stringify(returnForm)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      close(); onRefresh()
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const openAssign = () => {
    setAssignForm({ order_id: '', item_id: '', sku_name: '', worker_name: '', quantity: '', work_type: 'Embroidery', notes: '', date: '' })
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

  const skuSupplierMap = {}
  ledger.filter(e => e.stage === 'cloth_received').forEach(e => {
    if (e.sku_name && e.from_entity) skuSupplierMap[e.sku_name] = e.from_entity
  })

  // Get available SKUs from company stock
  const availableSkus = ledger
    .filter(e => e.stage === 'cloth_received' && e.to_entity === 'company')
    .reduce((acc, e) => {
      const key = e.sku_name + (e.color ? `|${e.color}` : '')
      if (!acc[key]) {
        acc[key] = { sku_name: e.sku_name, color: e.color || '', quantity: 0 }
      }
      acc[key].quantity += e.quantity
      return acc
    }, {})

  const grouped = {}
  workerStock.forEach(ws => {
    if (!grouped[ws.worker_name]) grouped[ws.worker_name] = []
    grouped[ws.worker_name].push(ws)
  })

  const jobLedger = ledger.filter(e => ['job_assigned', 'returned_to_supplier', 'reverted', 'revert_source'].includes(e.stage))

  return (
    <div>
      {/* Action bar */}
      <div className={styles.toolbar}>
        <button className="btn btn-primary" onClick={openAssign}>
          <MdBuild size={17} /> Assign to Worker
        </button>
        <button className="btn btn-outline" style={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={openReturn}>
          <MdUndo size={17} /> Return to Supplier
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
                <tr><th>#</th><th>SKU</th><th>From→To</th><th>Qty</th><th>Work Type</th><th>Stage</th><th>Date</th><th></th></tr>
              </thead>
              <tbody>
                {jobLedger.map((e, i) => (
                  <tr key={i} style={{ background: e.stage === 'revert_source' ? 'rgba(107,114,128,0.06)' : 'transparent' }}>
                    <td style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>{e.ledger_number_int || '—'}</td>
                    <td><strong style={{ textDecoration: e.stage === 'revert_source' ? 'line-through' : 'none', opacity: e.stage === 'revert_source' ? 0.55 : 1 }}>{e.sku_name}</strong></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                        opacity: e.stage === 'revert_source' ? 0.55 : 1 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{e.from_entity}</span>
                        <MdArrowForward size={12} />
                        <span style={{ fontWeight: 600 }}>{e.to_entity}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-primary">{e.quantity}</span></td>
                    <td><Badge text={e.work_type || '—'} color="#f59e0b" /></td>
                    <td><Badge text={STAGE_LABELS[e.stage] || e.stage} color={STAGE_COLORS[e.stage]} /></td>
                    <td><EditableDateCell ledgerId={e.ledger_id} dateStr={e.created_at} onSaved={onRefresh} /></td>
                    <td><RevertButton ledgerId={e.ledger_id} stage={e.stage} onReverted={onRefresh} /></td>
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

      {/* ── Return to Supplier Modal ───────────────────────────────────────── */}
      {modal === 'return' && (
        <Modal title="Return Cloth to Supplier" onClose={close}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}><MdWarning size={16} /> {error}</div>}
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0 }}>
            Return defective or plain cloth from a worker or company back to the supplier.
          </p>
          <FormRow label="From (Worker / company)" required>
            <select className="form-input" value={returnForm.from_entity}
              onChange={e => setReturnForm(p => ({ ...p, from_entity: e.target.value }))}>
              <option value="">Select source...</option>
              <option value="company">company</option>
              {workers.map(w => <option key={w.worker_id} value={w.name}>{w.name}</option>)}
            </select>
          </FormRow>
          <FormRow label="SKU Name" required>
            <select className="form-input" value={returnForm.sku_name}
              onChange={e => {
                const sku = e.target.value
                setReturnForm(p => ({
                  ...p,
                  sku_name: sku,
                  supplier_name: skuSupplierMap[sku] || p.supplier_name
                }))
              }}>
              <option value="">Select SKU...</option>
              {[...new Set(workerStock.map(ws => ws.sku_name))].map(s => <option key={s}>{s}</option>)}
            </select>
          </FormRow>
          <FormRow label="Quantity" required>
            <input className="form-input" type="number" min="1" value={returnForm.quantity}
              onChange={e => setReturnForm(p => ({ ...p, quantity: e.target.value }))} />
          </FormRow>
          <FormRow label="Supplier Name">
            <input className="form-input" placeholder="e.g. Raj Textiles" value={returnForm.supplier_name}
              onChange={e => setReturnForm(p => ({ ...p, supplier_name: e.target.value }))} />
          </FormRow>
          <FormRow label="Reason / Notes">
            <input className="form-input" placeholder="e.g. Defective cloth" value={returnForm.notes}
              onChange={e => setReturnForm(p => ({ ...p, notes: e.target.value }))} />
          </FormRow>
          <button className="btn btn-primary" style={{ width: '100%', background: '#ef4444', borderColor: '#ef4444' }}
            onClick={handleReturn} disabled={submitting}>
            {submitting ? 'Returning...' : 'Confirm Return'}
          </button>
        </Modal>
      )}

      {/* ── Assign Work Modal ──────────────────────────────────────────────── */}
      {modal === 'assign' && (
        <Modal title="Assign Work to Worker" onClose={close}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}><MdWarning size={16} /> {error}</div>}
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0 }}>
            Send pieces from company stock to a worker for job work.
          </p>
          <FormRow label="SKU Name" required>
            <select className="form-input" value={assignForm.sku_name}
              onChange={e => setAssignForm(p => ({ ...p, sku_name: e.target.value }))}>
              <option value="">Select SKU...</option>
              {Object.values(availableSkus).map((sku, i) => (
                <option key={i} value={sku.sku_name}>
                  {sku.sku_name}{sku.color ? ` (${sku.color})` : ''} - {sku.quantity} available
                </option>
              ))}
            </select>
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
          <FormRow label="Date (if backdating)">
            <input className="form-input" type="date" value={assignForm.date}
              onChange={e => setAssignForm(p => ({ ...p, date: e.target.value }))} />
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
