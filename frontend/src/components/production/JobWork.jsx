import { useState, useEffect } from 'react'
import { MdBuild, MdArrowForward, MdPeople, MdWarning, MdUndo } from 'react-icons/md'
import { apiFetch } from '../../config'
import { Badge, Modal, FormRow, STAGE_LABELS, STAGE_COLORS, WORK_TYPES_JOB,
         EditableDateCell, RevertButton } from './helpers'
import QuickAddWorker from './QuickAddWorker'
import WorkerHoldingsMasterDetail from './WorkerHoldingsMasterDetail'
import styles from './JobWork.module.css'

function JobWork({ workers, workerStock, ledger, orders, onRefresh }) {
  const [modal, setModal] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [localWorkers, setLocalWorkers] = useState(workers)
  const [suppliers, setSuppliers] = useState([])

  const [assignForm, setAssignForm] = useState({
    order_id: '', item_id: '', sku_name: '', worker_name: '',
    quantity: '', work_type: 'Embroidery', notes: '', date: ''
  })

  const [returnForm, setReturnForm] = useState({
    from_entity: '', sku_name: '', color: '', quantity: '', supplier_name: '', notes: ''
  })

  const close = () => { setModal(null); setError(null) }

  const openReturn = () => {
    setReturnForm({ from_entity: '', sku_name: '', color: '', quantity: '', supplier_name: '', notes: '' })
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

  // Fetch suppliers on mount
  useEffect(() => {
    apiFetch('/api/production/suppliers')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setSuppliers(data)
      })
      .catch(() => {})
  }, [])

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

  // Build order→supplier map for display
  const orderSupplierMap = {}
  orders.forEach(o => { orderSupplierMap[o.order_id] = o.supplier_name || '—' })

  const grouped = {}
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

      {/* Master-Detail Worker Holdings */}
      <WorkerHoldingsMasterDetail
        workerStock={workerStock}
        workers={workers}
        orders={orders}
        emptyTitle="No pieces with workers"
        emptyDescription="Assign cloth to a worker after receiving an order to see holdings here."
        headerAction={(group) => (
          <button
            className="btn btn-outline"
            style={{ fontSize: 12, padding: '4px 12px' }}
            onClick={() => {
              setAssignForm(p => ({ ...p, worker_name: group.worker_name }))
              setModal('assign')
            }}
          >
            <MdBuild size={13} style={{ marginRight: 4 }} />
            Assign More
          </button>
        )}
      />

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
                {jobLedger.map((e, i) => {
                  const chalanNum = e.chalan_number || orders.find(o => o.order_id === e.order_id)?.chalan_number || ''
                  return (
                    <tr key={i} style={{ background: e.stage === 'revert_source' ? 'rgba(107,114,128,0.06)' : 'transparent' }}>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>{e.ledger_number_int || '—'}</td>
                      <td>
                        {chalanNum && (
                          <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 11, marginRight: 5 }}>#{chalanNum}</span>
                        )}
                        <strong style={{ textDecoration: e.stage === 'revert_source' ? 'line-through' : 'none', opacity: e.stage === 'revert_source' ? 0.55 : 1 }}>{e.sku_name}</strong>
                        {e.color && <span style={{ fontSize: 10, color: '#6366f1', marginLeft: 4 }}>({e.color})</span>}
                      </td>
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
                  )
                })}
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
                // Get available colors for this SKU and worker
                const availableColors = returnForm.from_entity
                  ? [...new Set(workerStock
                      .filter(ws => ws.worker_name === returnForm.from_entity && ws.sku_name === sku)
                      .map(ws => ws.color || ''))]
                  : [...new Set(workerStock
                      .filter(ws => ws.sku_name === sku)
                      .map(ws => ws.color || ''))]
                // Auto-fill color if only one option (including empty)
                const autoColor = availableColors.length === 1 ? availableColors[0] : ''
                setReturnForm(p => ({
                  ...p,
                  sku_name: sku,
                  color: autoColor,
                  supplier_name: skuSupplierMap[sku] || p.supplier_name
                }))
              }}>
              <option value="">Select SKU...</option>
              {(returnForm.from_entity
                ? [...new Set(workerStock.filter(ws => ws.worker_name === returnForm.from_entity).map(ws => ws.sku_name))]
                : [...new Set(workerStock.map(ws => ws.sku_name))]
              ).map(s => <option key={s}>{s}</option>)}
            </select>
          </FormRow>
          {returnForm.from_entity && returnForm.sku_name && (
            <FormRow label="Color" required>
              <select className="form-input" value={returnForm.color}
                onChange={e => setReturnForm(p => ({ ...p, color: e.target.value }))}>
                <option value="">Select Color...</option>
                <option value="">No Color / Plain</option>
                {[...new Set(workerStock
                  .filter(ws => ws.worker_name === returnForm.from_entity && ws.sku_name === returnForm.sku_name)
                  .map(ws => ws.color || ''))]
                  .filter(c => c)
                  .map((color, i) => <option key={i} value={color}>{color}</option>)
                }
              </select>
            </FormRow>
          )}
          <FormRow label="Quantity" required>
            <input className="form-input"  value={returnForm.quantity}
              onChange={e => setReturnForm(p => ({ ...p, quantity: e.target.value }))} />
          </FormRow>
          <FormRow label="Supplier Name" required>
            <select className="form-input" value={returnForm.supplier_name}
              onChange={e => setReturnForm(p => ({ ...p, supplier_name: e.target.value }))}>
              <option value="">Select supplier...</option>
              {suppliers.map(s => <option key={s.supplier_id} value={s.name}>{s.name}</option>)}
            </select>
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
            {/* <QuickAddWorker defaultWorkType="Job Work"
              onWorkerAdded={(w) => { mergeWorker(w); setAssignForm(p => ({ ...p, worker_name: w.name })) }} /> */}
          </div>
          <FormRow label="Quantity" required>
            <input className="form-input" placeholder="e.g. 50" value={assignForm.quantity}
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
