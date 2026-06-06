import { useState } from 'react'
import { MdSwapHoriz, MdArrowForward, MdWarning, MdUndo } from 'react-icons/md'
import { apiFetch } from '../../config'
import { Badge, Modal, FormRow, STAGE_LABELS, STAGE_COLORS, WORK_TYPES_WORKER,
         EditableDateCell, RevertButton } from './helpers'
import QuickAddWorker from './QuickAddWorker'
import styles from './AdditionalWork.module.css'

function AdditionalWork({ workers, workerStock, ledger, orders, onRefresh }) {
  const [modal, setModal] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [localWorkers, setLocalWorkers] = useState(workers)

  const today = new Date().toISOString().slice(0, 10)
  const [transferForm, setTransferForm] = useState({
    from_worker: '', to_worker: '', order_id: '', sku_name: '', color: '', quantity: '', work_type: '', notes: '', date: today
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

  const openTransfer = () => {
    setTransferForm({ from_worker: '', to_worker: '', order_id: '', sku_name: '', color: '', quantity: '', work_type: '', notes: '', date: today })
    setLocalWorkers(workers)
    setModal('transfer')
  }

  // Worker name → work_type map for autofill
  const workerTypeMap = Object.fromEntries(workers.map(w => [w.name, w.work_type]))

  const mergeWorker = (w) => setLocalWorkers(prev => prev.find(p => p.worker_id === w.worker_id) ? prev : [...prev, w])

  const handleTransfer = async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await apiFetch('/api/production/transfer', {
        method: 'POST',
        body: JSON.stringify(transferForm)
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

  // Filter to only "Additional Work" workers (non-Embroidery)
  const additionalWorkerNames = new Set(workers.filter(w => w.work_type !== 'Embroidery').map(w => w.name))

  // Build order→supplier map for display
  const orderSupplierMap = {}
  orders.forEach(o => { orderSupplierMap[o.order_id] = o.supplier_name || '—' })

  const grouped = {}
  workerStock.filter(ws => additionalWorkerNames.has(ws.worker_name)).forEach(ws => {
    if (!grouped[ws.worker_name]) grouped[ws.worker_name] = []
    grouped[ws.worker_name].push(ws)
  })

  const additionalLedger = ledger.filter(e =>
    ['transferred', 'returned_to_supplier', 'reverted', 'revert_source'].includes(e.stage) &&
    (additionalWorkerNames.has(e.from_entity) || additionalWorkerNames.has(e.to_entity))
  )

  return (
    <div>
      {/* Action bar */}
      <div className={styles.toolbar}>
        <button className="btn btn-primary" onClick={openTransfer}>
          <MdSwapHoriz size={17} /> Transfer Between Workers
        </button>
        <button className="btn btn-outline" style={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={openReturn}>
          <MdUndo size={17} /> Return to Supplier
        </button>
      </div>

      {/* Worker Holdings */}
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
                  <span>{item.sku_name}{item.color ? <span style={{fontSize: 10, color: 'var(--text-secondary)', marginLeft: 6}}>({item.color})</span> : ''}</span>
                  <span className="badge badge-warning">{item.quantity}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon"><MdSwapHoriz size={52} /></div>
            <div className="empty-state-title">No worker holdings yet</div>
            <div className="empty-state-description">Assign cloth in Job Work first, then transfer here for diamond work, jari, etc.</div>
          </div>
        </div>
      )}

      {/* Ledger */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <MdSwapHoriz size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Transfer Ledger
          </h3>
        </div>
        {additionalLedger.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>#</th><th>SKU</th><th>From</th><th></th><th>To</th><th>Qty</th><th>Stage</th><th>Date</th><th></th></tr>
              </thead>
              <tbody>
                {additionalLedger.map((e, i) => (
                  <tr key={i} style={{ background: e.stage === 'revert_source' ? 'rgba(107,114,128,0.06)' : 'transparent' }}>
                    <td style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>{e.ledger_number_int || '—'}</td>
                    <td>
                      <strong style={{ textDecoration: e.stage === 'revert_source' ? 'line-through' : 'none', opacity: e.stage === 'revert_source' ? 0.55 : 1 }}>{e.sku_name}</strong>
                      {e.color && <span style={{ fontSize: 10, color: '#6366f1', marginLeft: 4 }}>({e.color})</span>}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12, opacity: e.stage === 'revert_source' ? 0.55 : 1 }}>{e.from_entity}</td>
                    <td><MdArrowForward size={14} /></td>
                    <td style={{ fontWeight: 600, fontSize: 12, opacity: e.stage === 'revert_source' ? 0.55 : 1 }}>{e.to_entity}</td>
                    <td><span className="badge badge-primary">{e.quantity}</span></td>
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
            <div className="empty-state-title">No transfers yet</div>
          </div>
        )}
      </div>

      {/* ── Return to Supplier Modal ──────────────────────────────────────── */}
      {modal === 'return' && (
        <Modal title="Return Cloth to Supplier" onClose={close}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}><MdWarning size={16} /> {error}</div>}
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0 }}>
            Return defective or plain pieces from a worker back to the supplier.
          </p>
          <FormRow label="From Worker" required>
            <select className="form-input" value={returnForm.from_entity}
              onChange={e => setReturnForm(p => ({ ...p, from_entity: e.target.value }))}>
              <option value="">Select worker...</option>
              {workers.filter(w => workerStock.some(ws => ws.worker_name === w.name && ws.quantity > 0))
                .map(w => <option key={w.worker_id} value={w.name}>{w.name}</option>)}
            </select>
          </FormRow>
          <FormRow label="SKU Name" required>
            <select className="form-input" value={returnForm.sku_name}
              onChange={e => {
                const sku = e.target.value
                setReturnForm(p => ({
                  ...p,
                  sku_name: sku,
                  color: '',
                  supplier_name: skuSupplierMap[sku] || p.supplier_name
                }))
              }}>
              <option value="">Select SKU...</option>
              {(returnForm.from_entity
                ? [...new Set(workerStock.filter(ws => ws.worker_name === returnForm.from_entity).map(ws => ws.sku_name))]
                : [...new Set(workerStock.map(ws => ws.sku_name))]
              ).map((sku, i) => <option key={i} value={sku}>{sku}</option>)}
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
            <input className="form-input" type="number" min="1" value={returnForm.quantity}
              onChange={e => setReturnForm(p => ({ ...p, quantity: e.target.value }))} />
          </FormRow>
          <FormRow label="Supplier Name">
            <input className="form-input" placeholder="e.g. Raj Textiles" value={returnForm.supplier_name}
              onChange={e => setReturnForm(p => ({ ...p, supplier_name: e.target.value }))} />
          </FormRow>
          <FormRow label="Reason / Notes">
            <input className="form-input" placeholder="e.g. Plain saree defect" value={returnForm.notes}
              onChange={e => setReturnForm(p => ({ ...p, notes: e.target.value }))} />
          </FormRow>
          <button className="btn btn-primary" style={{ width: '100%', background: '#ef4444', borderColor: '#ef4444' }}
            onClick={handleReturn} disabled={submitting}>
            {submitting ? 'Returning...' : 'Confirm Return'}
          </button>
        </Modal>
      )}

      {/* ── Transfer Modal ────────────────────────────────────────────────── */}
      {modal === 'transfer' && (
        <Modal title="Transfer Between Workers" onClose={close}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}><MdWarning size={16} /> {error}</div>}
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0 }}>
            Move pieces from one worker to another for additional work.
          </p>
          <FormRow label="From Worker" required>
            <select className="form-input" value={transferForm.from_worker}
              onChange={e => setTransferForm(p => ({ ...p, from_worker: e.target.value }))}>
              <option value="">Select Worker...</option>
              {localWorkers.filter(w => workerStock.some(ws => ws.worker_name === w.name && ws.quantity > 0))
                .map(w => <option key={w.worker_id} value={w.name}>{w.name}</option>)}
            </select>
          </FormRow>
          {transferForm.from_worker && workerStock.filter(ws => ws.worker_name === transferForm.from_worker).length > 0 && (
            <div className={styles.holdingInfo}>
              <strong>Current Holding:</strong>
              {(() => {
                let holdings = workerStock.filter(ws => ws.worker_name === transferForm.from_worker)
                // If order selected, filter to that order
                if (transferForm.order_id) {
                  holdings = holdings.filter(ws => ws.order_id === transferForm.order_id)
                }
                // Group by order_id
                const byOrder = {}
                holdings.forEach(ws => {
                  const oid = ws.order_id || 'Other'
                  if (!byOrder[oid]) byOrder[oid] = []
                  byOrder[oid].push(ws)
                })
                return Object.entries(byOrder).map(([orderId, items]) => (
                  <div key={orderId} style={{ marginTop: 8, marginLeft: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {orderId.startsWith('ORD') ? `Order: ${orderId}` : orderId}
                      <span style={{ fontWeight: 'normal', color: '#6366f1', marginLeft: 4 }}>({orderSupplierMap[orderId] || '—'})</span>
                    </div>
                    <div style={{ marginLeft: 8, fontSize: 13 }}>
                      {items.map((ws, i) => (
                        <div key={i}>
                          • {ws.sku_name}{ws.color ? <span style={{ color: 'var(--text-secondary)' }}> ({ws.color})</span> : ''}: <strong>{ws.quantity}</strong> pcs
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">To Worker <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <select className="form-input" value={transferForm.to_worker}
              onChange={e => {
                const name = e.target.value
                const wt = workerTypeMap[name] || ''
                setTransferForm(p => ({ ...p, to_worker: name, work_type: wt }))
              }}>
              <option value="">Select Worker...</option>
              {localWorkers.filter(w => w.name !== transferForm.from_worker).map(w => 
                <option key={w.worker_id} value={w.name}>{w.name} ({w.work_type || 'Job Work'})</option>
              )}
            </select>
            <QuickAddWorker defaultWorkType="Additional Work"
              onWorkerAdded={(w) => { mergeWorker(w); setTransferForm(p => ({ ...p, to_worker: w.name, work_type: w.work_type })) }} />
          </div>
          <FormRow label="Order ID" required>
            <select className="form-input" value={transferForm.order_id}
              onChange={e => setTransferForm(p => ({ ...p, order_id: e.target.value, sku_name: '', color: '' }))}>
              <option value="">Select Order...</option>
              {transferForm.from_worker
                ? [...new Set(workerStock
                    .filter(ws => ws.worker_name === transferForm.from_worker && ws.quantity > 0)
                    .map(ws => ws.order_id))]
                    .filter(Boolean)
                    .sort()
                    .map(oid => <option key={oid} value={oid}>{oid} ({orderSupplierMap[oid] || '—'})</option>)
                : [...new Set(workerStock.map(ws => ws.order_id).filter(Boolean))].sort()
                    .map(oid => <option key={oid} value={oid}>{oid} ({orderSupplierMap[oid] || '—'})</option>)
              }
            </select>
          </FormRow>
          <FormRow label="SKU Name" required>
            <select className="form-input" value={transferForm.sku_name}
              onChange={e => {
                const sku = e.target.value
                // Find matching stock entries for autofill
                let matching = workerStock.filter(ws =>
                  ws.worker_name === transferForm.from_worker &&
                  ws.sku_name === sku &&
                  ws.quantity > 0
                )
                if (transferForm.order_id) {
                  matching = matching.filter(ws => ws.order_id === transferForm.order_id)
                }
                // Get unique colors
                const colors = [...new Set(matching.map(ws => ws.color || ''))]
                // Autofill color if only one option (including empty)
                const autoColor = colors.length === 1 ? colors[0] : ''
                // Autofill quantity (total for this SKU, or specific color if only one)
                const autoQty = matching.reduce((s, ws) => s + ws.quantity, 0)
                setTransferForm(p => ({
                  ...p,
                  sku_name: sku,
                  color: autoColor,
                  quantity: String(autoQty)
                }))
              }}>
              <option value="">Select SKU...</option>
              {(() => {
                let filtered = workerStock.filter(ws => ws.worker_name === transferForm.from_worker && ws.quantity > 0)
                if (transferForm.order_id) {
                  filtered = filtered.filter(ws => ws.order_id === transferForm.order_id)
                }
                return [...new Set(filtered.map(ws => ws.sku_name))].map((sku, i) => <option key={i} value={sku}>{sku}</option>)
              })()}
            </select>
          </FormRow>
          {transferForm.from_worker && transferForm.sku_name && (
            <FormRow label="Color" required>
              <select className="form-input" value={transferForm.color}
                onChange={e => setTransferForm(p => ({ ...p, color: e.target.value }))}>
                <option value="">Select Color...</option>
                <option value="">No Color / Plain</option>
                {(() => {
                  let filtered = workerStock.filter(ws => ws.worker_name === transferForm.from_worker && ws.sku_name === transferForm.sku_name)
                  if (transferForm.order_id) {
                    filtered = filtered.filter(ws => ws.order_id === transferForm.order_id)
                  }
                  return [...new Set(filtered.map(ws => ws.color || ''))].filter(c => c).map((color, i) => <option key={i} value={color}>{color}</option>)
                })()}
              </select>
            </FormRow>
          )}
          <FormRow label="Quantity" required>
            <input className="form-input" type="number" min="1" value={transferForm.quantity}
              onChange={e => setTransferForm(p => ({ ...p, quantity: e.target.value }))} />
          </FormRow>
          <FormRow label="Work Type">
            <select className="form-input" value={transferForm.work_type}
              onChange={e => setTransferForm(p => ({ ...p, work_type: e.target.value }))}>
              <option value="">Select Work Type...</option>
              {WORK_TYPES_WORKER.map(t => <option key={t}>{t}</option>)}
            </select>
          </FormRow>
          <FormRow label="Date (if backdating)">
            <input className="form-input" type="date" value={transferForm.date}
              onChange={e => setTransferForm(p => ({ ...p, date: e.target.value }))} />
          </FormRow>
          <FormRow label="Notes">
            <input className="form-input" placeholder="Optional" value={transferForm.notes}
              onChange={e => setTransferForm(p => ({ ...p, notes: e.target.value }))} />
          </FormRow>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleTransfer} disabled={submitting}>
            {submitting ? 'Transferring...' : 'Transfer Pieces'}
          </button>
        </Modal>
      )}

    </div>
  )
}

export default AdditionalWork
