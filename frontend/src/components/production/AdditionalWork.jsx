import { useState, useEffect } from 'react'
import { MdSwapHoriz, MdArrowForward, MdWarning, MdUndo } from 'react-icons/md'
import { apiFetch } from '../../config'
import {
  Badge, Modal, FormRow, STAGE_LABELS, STAGE_COLORS, WORK_TYPES_WORKER,
  EditableDateCell, RevertButton
} from './helpers'
import QuickAddWorker from './QuickAddWorker'
import WorkerHoldingsMasterDetail from './WorkerHoldingsMasterDetail'
import styles from './AdditionalWork.module.css'

function AdditionalWork({ workers, workerStock, ledger, orders, onRefresh }) {
  const [modal, setModal] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [localWorkers, setLocalWorkers] = useState(workers)
  const [suppliers, setSuppliers] = useState([])

  const today = new Date().toISOString().slice(0, 10)
  const [transferForm, setTransferForm] = useState({
    from_worker: '', to_worker: '', order_id: '', sku_name: '', color: '', quantity: '', work_type: '', notes: '', date: today
  })

  const [returnForm, setReturnForm] = useState({
    from_entity: '', sku_name: '', color: '', quantity: '', supplier_name: '', notes: ''
  })

  const [bulkTransfer, setBulkTransfer] = useState(false)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)

  const close = () => { setModal(null); setError(null); setBulkTransfer(false) }

  const handleBulkTransfer = async () => {
    setBulkSubmitting(true); setError(null)
    try {
      const res = await apiFetch('/api/production/transfer-bulk', {
        method: 'POST',
        body: JSON.stringify({
          from_worker: transferForm.from_worker,
          to_worker: transferForm.to_worker,
          order_id: transferForm.order_id,
          date: transferForm.date,
          notes: transferForm.notes
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Show success message with details
      if (data.errors && data.errors.length > 0) {
        setError(`Bulk transfer completed with ${data.results?.length || 0} successes and ${data.errors.length} errors: ${data.errors.join(', ')}`)
      } else {
        close(); onRefresh()
        // Refresh the page after successful bulk transfer
        setTimeout(() => window.location.reload(), 500)
      }
    } catch (e) { setError(e.message) }
    finally { setBulkSubmitting(false) }
  }

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

  const openTransfer = (itemData = null) => {
    if (itemData && typeof itemData === 'object' && itemData.workerName) {
      const isBulk = Boolean(itemData.bulk)
      setBulkTransfer(isBulk)
      setTransferForm({
        from_worker: itemData.workerName || '',
        to_worker: '',
        order_id: itemData.orderId || '',
        sku_name: isBulk ? '' : (itemData.skuName || ''),
        color: isBulk ? '' : (itemData.color || ''),
        quantity: isBulk ? '' : (itemData.quantity || ''),
        work_type: '',
        notes: '',
        date: today
      })
    } else {
      setBulkTransfer(false)
      setTransferForm({ from_worker: '', to_worker: '', order_id: '', sku_name: '', color: '', quantity: '', work_type: '', notes: '', date: today })
    }
    setLocalWorkers(workers)
    setModal('transfer')
  }

  // Fetch suppliers on mount
  useEffect(() => {
    apiFetch('/api/production/suppliers')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setSuppliers(data)
      })
      .catch(() => { })
  }, [])

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

  // Build order→supplier map for display
  const orderSupplierMap = {}
  orders.forEach(o => { orderSupplierMap[o.order_id] = o.supplier_name || '—' })

  const additionalLedger = ledger.filter(e =>
    ['job_assigned', 'transferred', 'returned_to_supplier', 'reverted', 'revert_source'].includes(e.stage)
  )

  return (
    <div>
      {/* Action bar */}
      <div className={styles.toolbar}>
        <button className="btn btn-primary" onClick={() => openTransfer()}>
          <MdSwapHoriz size={17} /> Transfer Between Workers
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
        emptyTitle="No worker holdings yet"
        emptyDescription="Assign cloth in Job Work first, then transfer here for diamond work, jari, etc."
        onItemAction={(itemData) => openTransfer(itemData)}
        itemActionLabel="Transfer"
        itemActionColor="var(--primary-color, #6366f1)"
        onChalanAction={(chalanData) => openTransfer(chalanData)}
        chalanActionLabel="Transfer Whole Chalan"
        chalanActionColor="var(--primary-color, #6366f1)"
      />

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
                {additionalLedger.map((e, i) => {
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
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12, opacity: e.stage === 'revert_source' ? 0.55 : 1 }}>{e.from_entity}</td>
                      <td><MdArrowForward size={14} /></td>
                      <td style={{ fontWeight: 600, fontSize: 12, opacity: e.stage === 'revert_source' ? 0.55 : 1 }}>{e.to_entity}</td>
                      <td><span className="badge badge-primary">{e.quantity}</span></td>
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
          <FormRow label="From (Worker / company)" required>
            <select className="form-input" value={returnForm.from_entity}
              onChange={e => setReturnForm(p => ({ ...p, from_entity: e.target.value }))}>
              <option value="">Select source...</option>
              <option value="company">company</option>
              {[...new Set(workerStock.filter(ws => ws.quantity > 0).map(ws => ws.worker_name))].sort()
                .map(name => <option key={name} value={name}>{name}</option>)}
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
            <input className="form-input" value={returnForm.quantity}
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
              onChange={e => {
                const w = e.target.value
                setTransferForm(p => ({
                  ...p,
                  from_worker: w,
                  order_id: '',
                  sku_name: '',
                  color: '',
                  quantity: ''
                }))
              }}>
              <option value="">Select Worker...</option>
              {[...new Set(workerStock.filter(ws => ws.quantity > 0).map(ws => ws.worker_name))].sort()
                .map(name => <option key={name} value={name}>{name}</option>)}
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

                return Object.entries(byOrder).map(([orderId, items]) => {
                  const chalanNumber = items[0]?.chalan_number || ''
                  return (
                    <div key={orderId} style={{ marginTop: 8, marginLeft: 8 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                        {chalanNumber && (
                          <span style={{ color: '#dc2626', fontWeight: 700 }}>
                            # ({chalanNumber})
                          </span>
                        )}
                        <span>
                          {orderId.startsWith('ORD') ? `Order: ${orderId}` : orderId}
                        </span>
                        <span style={{ fontWeight: 'normal', color: '#6366f1' }}>
                          ({orderSupplierMap[orderId] || '—'})
                        </span>
                      </div>
                      <div style={{ marginLeft: 8, fontSize: 13 }}>
                        {items.map((ws, i) => (
                          <div key={i}>
                            • {ws.sku_name}{ws.color ? <span style={{ color: 'var(--text-secondary)' }}> ({ws.color})</span> : ''}: <strong>{ws.quantity}</strong> pcs
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
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
          </div>
          <FormRow label="Order ID" required>
            <select className="form-input" value={transferForm.order_id}
              onChange={e => {
                const oid = e.target.value
                setTransferForm(p => ({
                  ...p,
                  order_id: oid,
                  sku_name: '',
                  color: '',
                  quantity: ''
                }))
              }}>
              <option value="">Select Order...</option>
              {transferForm.from_worker
                ? [...new Set(workerStock
                  .filter(ws => ws.worker_name === transferForm.from_worker && ws.quantity > 0)
                  .map(ws => ws.order_id))]
                  .filter(Boolean)
                  .sort()
                  .map(oid => {
                    const chalanNumber = workerStock.find(ws => ws.order_id === oid)?.chalan_number || ''
                    const displayText = chalanNumber ? `${oid} / # (${chalanNumber})` : oid
                    return <option key={oid} value={oid}>{displayText} ({orderSupplierMap[oid] || '—'})</option>
                  })
                : [...new Set(workerStock.map(ws => ws.order_id).filter(Boolean))].sort()
                  .map(oid => {
                    const chalanNumber = workerStock.find(ws => ws.order_id === oid)?.chalan_number || ''
                    const displayText = chalanNumber ? `${oid} / # (${chalanNumber})` : oid
                    return <option key={oid} value={oid}>{displayText} ({orderSupplierMap[oid] || '—'})</option>
                  })
              }
            </select>
          </FormRow>

          {/* Highlighted Bulk Transfer Checkbox */}
          {transferForm.from_worker && transferForm.order_id && (
            <div style={{
              backgroundColor: '#fef3c7',
              border: '2px solid #f59e0b',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                color: '#92400e'
              }}>
                <input
                  type="checkbox"
                  checked={bulkTransfer}
                  onChange={e => setBulkTransfer(e.target.checked)}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ fontSize: '14px' }}>
                  🚀 TRANSFER ALL SKUs for this order ({(() => {
                    const orderHoldings = workerStock.filter(ws =>
                      ws.worker_name === transferForm.from_worker &&
                      ws.order_id === transferForm.order_id &&
                      ws.quantity > 0
                    )
                    const totalPcs = orderHoldings.reduce((sum, item) => sum + item.quantity, 0)
                    return `${totalPcs} pieces`
                  })()})
                </span>
              </label>
              <p style={{
                margin: '6px 0 0 0',
                fontSize: '12px',
                color: '#78350f',
                paddingLeft: '26px'
              }}>
                This will transfer all items from this order at once, saving you time!
              </p>
            </div>
          )}

          {/* Show note and calculate totals when bulk transfer is selected */}
          {bulkTransfer && transferForm.from_worker && transferForm.to_worker && transferForm.order_id && (() => {
            const orderHoldings = workerStock.filter(ws =>
              ws.worker_name === transferForm.from_worker &&
              ws.order_id === transferForm.order_id &&
              ws.quantity > 0
            )
            const totalQuantity = orderHoldings.reduce((sum, item) => sum + item.quantity, 0)
            const uniqueSkus = [...new Set(orderHoldings.map(h => h.sku_name))]
            return (
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#166534', fontWeight: 600 }}>
                  📦 Bulk Transfer Mode:
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#166534' }}>
                  The following SKUs are selected for bulk transfer:
                </p>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', fontSize: '11px', color: '#166534' }}>
                  {uniqueSkus.map(sku => {
                    const skuItems = orderHoldings.filter(item => item.sku_name === sku)
                    return (
                      <li key={sku}>
                        {sku} ({skuItems.map(item => item.color).filter(c => c).join(', ') || 'No color'}) -
                        Total: {skuItems.reduce((sum, item) => sum + item.quantity, 0)} pcs
                      </li>
                    )
                  })}
                </ul>
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#166534', fontWeight: 600 }}>
                  Total Quantity: <span style={{ fontSize: '14px' }}>{totalQuantity}</span> pieces
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#166534' }}>
                  Individual SKU selection, quantity, and color will be handled automatically.
                </p>
              </div>
            )
          })()}

          {/* Individual SKU fields - hidden when bulk transfer is selected */}
          {!bulkTransfer && (
            <>
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
                <input className="form-input"  value={transferForm.quantity}
                  onChange={e => setTransferForm(p => ({ ...p, quantity: e.target.value }))} />
              </FormRow>
              <FormRow label="Work Type">
                <select className="form-input" value={transferForm.work_type}
                  onChange={e => setTransferForm(p => ({ ...p, work_type: e.target.value }))}>
                  <option value="">Select Work Type...</option>
                  {WORK_TYPES_WORKER.map(t => <option key={t}>{t}</option>)}
                </select>
              </FormRow>
            </>
          )}
          <FormRow label="Date (if backdating)">
            <input className="form-input" type="date" value={transferForm.date}
              onChange={e => setTransferForm(p => ({ ...p, date: e.target.value }))} />
          </FormRow>
          <FormRow label="Notes">
            <input className="form-input" placeholder="Optional" value={transferForm.notes}
              onChange={e => setTransferForm(p => ({ ...p, notes: e.target.value }))} />
          </FormRow>
          {bulkTransfer ? (
            <button
              className="btn btn-primary"
              style={{ width: '100%', backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}
              onClick={handleBulkTransfer}
              disabled={bulkSubmitting}
            >
              {bulkSubmitting ? 'Bulk Transferring...' : '🚀 TRANSFER ALL SKUs'}
            </button>
          ) : (
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleTransfer} disabled={submitting}>
              {submitting ? 'Transferring...' : 'Transfer Pieces'}
            </button>
          )}
        </Modal>
      )}

    </div>
  )
}

export default AdditionalWork
