import { useState, useEffect } from 'react'
import { MdCheckCircle, MdArrowForward, MdWarning, MdInbox } from 'react-icons/md'
import { apiFetch } from '../../config'
import { Badge, Modal, FormRow, STAGE_LABELS, STAGE_COLORS, EditableDateCell, RevertButton } from './helpers'
import styles from './AdditionalWork.module.css'

function ReceiveGoods({ workers, workerStock, ledger, onRefresh }) {
  const [modal, setModal]         = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState(null)
  const [receiveForm, setReceiveForm] = useState({
    worker_name: '', sku_name: '', color: '', quantity: '', mrp: '', notes: '', date: '', order_id: '', item_id: ''
  })

  // Fetch MRP when SKU and Color are selected
  useEffect(() => {
    if (!receiveForm.sku_name) return
    apiFetch(`/api/production/mrp?sku_name=${encodeURIComponent(receiveForm.sku_name)}&color=${encodeURIComponent(receiveForm.color || '')}`)
      .then(r => r.json())
      .then(data => {
        if (data.found && data.mrp > 0) {
          setReceiveForm(p => ({
            ...p,
            mrp: data.mrp,
            order_id: data.order_id || '',
            item_id: data.item_id || ''
          }))
        }
      })
      .catch(() => {})
  }, [receiveForm.sku_name, receiveForm.color])

  const close = () => { setModal(false); setError(null) }

  const skuOptions = workerStock
    .filter(ws => !receiveForm.worker_name || ws.worker_name === receiveForm.worker_name)

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

  const receiveLedger = ledger.filter(e => ['final_received', 'reverted', 'revert_source'].includes(e.stage))

  return (
    <div>
      <div className={styles.toolbar}>
        <button
          className="btn btn-outline"
          style={{ borderColor: 'var(--success-color)', color: 'var(--success-color)' }}
          onClick={() => { setReceiveForm({ worker_name: '', sku_name: '', color: '', quantity: '', mrp: '', notes: '', order_id: '', item_id: '' }); setModal(true) }}
        >
          <MdCheckCircle size={17} /> Receive Finished Goods
        </button>
      </div>

      {/* Worker holdings summary */}
      {workerStock.length > 0 ? (
        <div className={styles.workerGrid} style={{ marginBottom: 24 }}>
          {Object.entries(
            workerStock.reduce((acc, ws) => {
              if (!acc[ws.worker_name]) acc[ws.worker_name] = []
              acc[ws.worker_name].push(ws)
              return acc
            }, {})
          ).map(([workerName, items]) => (
            <div key={workerName} className={styles.workerCard}>
              <div className={styles.workerCardHeader}>
                <div className={styles.avatar}>{workerName[0].toUpperCase()}</div>
                <div>
                  <div className={styles.workerName}>{workerName}</div>
                  <div className={styles.workerSub}>{items.reduce((s, i) => s + i.quantity, 0)} pieces in hand</div>
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
            <div className="empty-state-icon"><MdInbox size={52} /></div>
            <div className="empty-state-title">No pieces held by workers</div>
            <div className="empty-state-description">Assign cloth via Job Work first, then receive finished goods here.</div>
          </div>
        </div>
      )}

      {/* Final receive ledger */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <MdCheckCircle size={18} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--success-color)' }} />
            Final Receive Ledger
          </h3>
        </div>
        {receiveLedger.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>SKU</th><th>From</th><th></th><th>To</th><th>Qty</th><th>Stage</th><th>Date</th><th></th></tr>
              </thead>
              <tbody>
                {receiveLedger.map((e, i) => (
                  <tr key={i} style={{ background: e.stage === 'revert_source' ? 'rgba(107,114,128,0.06)' : 'transparent' }}>
                    <td>
                      <strong>{e.sku_name}</strong>
                      {e.color && <span style={{ fontSize: 10, color: '#6366f1', marginLeft: 4 }}>({e.color})</span>}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{e.from_entity}</td>
                    <td><MdArrowForward size={14} /></td>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{e.to_entity}</td>
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
            <div className="empty-state-title">No final receives yet</div>
          </div>
        )}
      </div>

      {/* ── Receive Modal ─────────────────────────────────────── */}
      {modal && (
        <Modal title="Receive Finished Goods" onClose={close}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}><MdWarning size={16} /> {error}</div>}
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0 }}>
            Worker returns completed pieces to company. You can generate barcodes after this.
          </p>
          <FormRow label="Worker" required>
            <select className="form-input" value={receiveForm.worker_name}
              onChange={e => setReceiveForm(p => ({ ...p, worker_name: e.target.value, sku_name: '', color: '' }))}>
              <option value="">Select Worker...</option>
              {workers.map(w => <option key={w.worker_id} value={w.name}>{w.name}</option>)}
            </select>
          </FormRow>
          {receiveForm.worker_name && workerStock.filter(ws => ws.worker_name === receiveForm.worker_name).length > 0 && (
            <div className={styles.holdingInfo}>
              <strong>Holding:</strong> {workerStock.filter(ws => ws.worker_name === receiveForm.worker_name).map(ws => `${ws.sku_name}${ws.color ? ` (${ws.color})` : ''}: ${ws.quantity}`).join(', ')}
            </div>
          )}
          <FormRow label="SKU Name" required>
            <select className="form-input" value={receiveForm.sku_name}
              onChange={e => setReceiveForm(p => ({ ...p, sku_name: e.target.value, color: '' }))}>
              <option value="">Select SKU...</option>
              {skuOptions.length > 0
                ? [...new Set(skuOptions.map(ws => ws.sku_name))].map((sku, i) => <option key={i} value={sku}>{sku}</option>)
                : <option disabled>— no pieces with this worker —</option>}
            </select>
          </FormRow>
          {receiveForm.worker_name && receiveForm.sku_name && (
            <FormRow label="Color" required>
              <select className="form-input" value={receiveForm.color}
                onChange={e => setReceiveForm(p => ({ ...p, color: e.target.value }))}>
                <option value="">Select Color...</option>
                <option value="">No Color / Plain</option>
                {[...new Set(workerStock
                  .filter(ws => ws.worker_name === receiveForm.worker_name && ws.sku_name === receiveForm.sku_name)
                  .map(ws => ws.color || ''))]
                  .filter(c => c)
                  .map((color, i) => <option key={i} value={color}>{color}</option>)
                }
              </select>
            </FormRow>
          )}
          <FormRow label="Quantity Received" required>
            <input className="form-input" type="number" min="1" value={receiveForm.quantity}
              onChange={e => setReceiveForm(p => ({ ...p, quantity: e.target.value }))} />
          </FormRow>
          <FormRow label="MRP ₹ (for barcode)">
            <input className="form-input" type="number" min="0" step="0.01" placeholder="e.g. 299" value={receiveForm.mrp}
              onChange={e => setReceiveForm(p => ({ ...p, mrp: e.target.value }))} />
            {receiveForm.mrp > 0 && (
              <div style={{ fontSize: 11, color: 'var(--success-color)', marginTop: 4 }}>
                ✓ Auto-filled from cloth order
              </div>
            )}
          </FormRow>
          <FormRow label="Date (if backdating)">
            <input className="form-input" type="date" value={receiveForm.date}
              onChange={e => setReceiveForm(p => ({ ...p, date: e.target.value }))} />
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

export default ReceiveGoods
