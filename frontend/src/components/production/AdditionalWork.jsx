import { useState } from 'react'
import { MdSwapHoriz, MdCheckCircle, MdArrowForward, MdWarning } from 'react-icons/md'
import { apiFetch } from '../../config'
import { Badge, Modal, FormRow, STAGE_LABELS, STAGE_COLORS, WORK_TYPES_ADDITIONAL } from './helpers'
import QuickAddWorker from './QuickAddWorker'
import styles from './AdditionalWork.module.css'

function AdditionalWork({ workers, workerStock, ledger, onRefresh }) {
  const [modal, setModal] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [localWorkers, setLocalWorkers] = useState(workers)

  const [transferForm, setTransferForm] = useState({
    from_worker: '', to_worker: '', sku_name: '', quantity: '', work_type: 'Diamond Work', notes: ''
  })
  const [receiveForm, setReceiveForm] = useState({
    worker_name: '', sku_name: '', quantity: '', mrp: '', notes: ''
  })

  const close = () => { setModal(null); setError(null) }

  const openTransfer = () => {
    setTransferForm({ from_worker: '', to_worker: '', sku_name: '', quantity: '', work_type: 'Diamond Work', notes: '' })
    setLocalWorkers(workers)
    setModal('transfer')
  }

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

  const handleReceiveFinal = async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await apiFetch('/api/production/receive-final', {
        method: 'POST',
        body: JSON.stringify(receiveForm)
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

  const additionalLedger = ledger.filter(e => ['transferred', 'final_received'].includes(e.stage))

  const skuOptions = workerStock
    .filter(ws => !receiveForm.worker_name || ws.worker_name === receiveForm.worker_name)

  return (
    <div>
      {/* Action bar */}
      <div className={styles.toolbar}>
        <button className="btn btn-primary" onClick={openTransfer}>
          <MdSwapHoriz size={17} /> Transfer Between Workers
        </button>
        <button className="btn btn-outline" style={{ borderColor: 'var(--success-color)', color: 'var(--success-color)' }}
          onClick={() => { setReceiveForm({ worker_name: '', sku_name: '', quantity: '', mrp: '', notes: '' }); setModal('receive') }}>
          <MdCheckCircle size={17} /> Receive Finished Goods
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
                  <span>{item.sku_name}</span>
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
            Transfer &amp; Final Receive Ledger
          </h3>
        </div>
        {additionalLedger.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>SKU</th><th>From</th><th></th><th>To</th><th>Qty</th><th>Stage</th><th>Work Type</th><th>Date</th></tr>
              </thead>
              <tbody>
                {additionalLedger.map((e, i) => (
                  <tr key={i}>
                    <td><strong>{e.sku_name}</strong></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{e.from_entity}</td>
                    <td><MdArrowForward size={14} /></td>
                    <td style={{ fontWeight: 600 }}>{e.to_entity}</td>
                    <td><span className="badge badge-primary">{e.quantity}</span></td>
                    <td><Badge text={STAGE_LABELS[e.stage] || e.stage} color={STAGE_COLORS[e.stage]} /></td>
                    <td style={{ fontSize: 12 }}>{e.work_type || '—'}</td>
                    <td style={{ fontSize: 12 }}>{new Date(e.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 32 }}>
            <div className="empty-state-title">No transfers or final receives yet</div>
          </div>
        )}
      </div>

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
              {localWorkers.map(w => <option key={w.worker_id} value={w.name}>{w.name}</option>)}
            </select>
          </FormRow>
          {transferForm.from_worker && workerStock.filter(ws => ws.worker_name === transferForm.from_worker).length > 0 && (
            <div className={styles.holdingInfo}>
              <strong>Holding:</strong> {workerStock.filter(ws => ws.worker_name === transferForm.from_worker).map(ws => `${ws.sku_name}: ${ws.quantity}`).join(', ')}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">To Worker <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <select className="form-input" value={transferForm.to_worker}
              onChange={e => setTransferForm(p => ({ ...p, to_worker: e.target.value }))}>
              <option value="">Select Worker...</option>
              {localWorkers.map(w => w.name !== transferForm.from_worker && <option key={w.worker_id} value={w.name}>{w.name}</option>)}
            </select>
            <QuickAddWorker defaultWorkType="Additional Work"
              onWorkerAdded={(w) => { mergeWorker(w); setTransferForm(p => ({ ...p, to_worker: w.name })) }} />
          </div>
          <FormRow label="SKU Name" required>
            <select className="form-input" value={transferForm.sku_name}
              onChange={e => setTransferForm(p => ({ ...p, sku_name: e.target.value }))}>
              <option value="">Select SKU...</option>
              {transferForm.from_worker
                ? workerStock.filter(ws => ws.worker_name === transferForm.from_worker).map((ws, i) => <option key={i} value={ws.sku_name}>{ws.sku_name}</option>)
                : workerStock.map((ws, i) => <option key={i} value={ws.sku_name}>{ws.sku_name}</option>)
              }
            </select>
          </FormRow>
          <FormRow label="Quantity" required>
            <input className="form-input" type="number" min="1" value={transferForm.quantity}
              onChange={e => setTransferForm(p => ({ ...p, quantity: e.target.value }))} />
          </FormRow>
          <FormRow label="Work Type">
            <select className="form-input" value={transferForm.work_type}
              onChange={e => setTransferForm(p => ({ ...p, work_type: e.target.value }))}>
              {WORK_TYPES_ADDITIONAL.map(t => <option key={t}>{t}</option>)}
            </select>
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

      {/* ── Receive Final Modal ───────────────────────────────────────────── */}
      {modal === 'receive' && (
        <Modal title="Receive Finished Goods" onClose={close}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}><MdWarning size={16} /> {error}</div>}
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0 }}>
            Worker returns completed pieces to company. You can generate barcodes after this.
          </p>
          <FormRow label="Worker" required>
            <select className="form-input" value={receiveForm.worker_name}
              onChange={e => setReceiveForm(p => ({ ...p, worker_name: e.target.value, sku_name: '' }))}>
              <option value="">Select Worker...</option>
              {workers.map(w => <option key={w.worker_id} value={w.name}>{w.name}</option>)}
            </select>
          </FormRow>
          {receiveForm.worker_name && workerStock.filter(ws => ws.worker_name === receiveForm.worker_name).length > 0 && (
            <div className={styles.holdingInfo}>
              <strong>Holding:</strong> {workerStock.filter(ws => ws.worker_name === receiveForm.worker_name).map(ws => `${ws.sku_name}: ${ws.quantity}`).join(', ')}
            </div>
          )}
          <FormRow label="SKU Name" required>
            <select className="form-input" value={receiveForm.sku_name}
              onChange={e => setReceiveForm(p => ({ ...p, sku_name: e.target.value }))}>
              <option value="">Select SKU...</option>
              {skuOptions.length > 0
                ? skuOptions.map((ws, i) => <option key={i} value={ws.sku_name}>{ws.sku_name}</option>)
                : <option disabled>— no pieces with this worker —</option>}
            </select>
          </FormRow>
          <FormRow label="Quantity Received" required>
            <input className="form-input" type="number" min="1" value={receiveForm.quantity}
              onChange={e => setReceiveForm(p => ({ ...p, quantity: e.target.value }))} />
          </FormRow>
          <FormRow label="MRP ₹ (for barcode)">
            <input className="form-input" type="number" min="0" step="0.01" placeholder="e.g. 299" value={receiveForm.mrp}
              onChange={e => setReceiveForm(p => ({ ...p, mrp: e.target.value }))} />
          </FormRow>
          <FormRow label="Notes">
            <input className="form-input" placeholder="Optional" value={receiveForm.notes}
              onChange={e => setReceiveForm(p => ({ ...p, notes: e.target.value }))} />
          </FormRow>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleReceiveFinal} disabled={submitting}>
            {submitting ? 'Receiving...' : 'Receive Finished Goods'}
          </button>
        </Modal>
      )}
    </div>
  )
}

export default AdditionalWork
