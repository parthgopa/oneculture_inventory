import { useState, useEffect } from 'react'
import { MdCheckCircle, MdArrowForward, MdWarning, MdInbox } from 'react-icons/md'
import { apiFetch } from '../../config'
import { Badge, Modal, FormRow, STAGE_LABELS, STAGE_COLORS, EditableDateCell, RevertButton } from './helpers'
import styles from './AdditionalWork.module.css'

function ReceiveGoods({ workers, workerStock, ledger, orders, onRefresh }) {
  const [modal, setModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [bulkReceive, setBulkReceive] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const [receiveForm, setReceiveForm] = useState({
    worker_name: '', sku_name: '', color: '', quantity: '', mrp: '', notes: '', date: today, order_id: '', item_id: ''
  })

  // Fetch MRP when SKU and Color are selected
  useEffect(() => {
    if (!receiveForm.sku_name) return
    apiFetch(`/api/production/mrp?sku_name=${encodeURIComponent(receiveForm.sku_name)}&color=${encodeURIComponent(receiveForm.color || '')}&order_id=${encodeURIComponent(receiveForm.order_id || '')}`)
      .then(r => r.json())
      .then(data => {
        if (data.found && data.mrp > 0) {
          setReceiveForm(p => ({
            ...p,
            mrp: data.mrp,
            order_id: p.order_id || data.order_id || '',
            item_id: data.item_id || ''
          }))
        }
      })
      .catch(() => { })
  }, [receiveForm.sku_name, receiveForm.color, receiveForm.order_id])

  const close = () => { setModal(false); setError(null); setBulkReceive(false) }

  // Build order→supplier map for display
  const orderSupplierMap = {}
  orders.forEach(o => { orderSupplierMap[o.order_id] = o.supplier_name || '—' })

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
      // Refresh the page after successful receive
      setTimeout(() => window.location.reload(), 500)
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const handleBulkReceive = async () => {
    setBulkSubmitting(true); setError(null)
    try {
      const res = await apiFetch('/api/production/receive-final-bulk', {
        method: 'POST',
        body: JSON.stringify({
          worker_name: receiveForm.worker_name,
          order_id: receiveForm.order_id,
          date: receiveForm.date,
          notes: receiveForm.notes
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Show success message with details
      if (data.errors && data.errors.length > 0) {
        setError(`Bulk receive completed with ${data.results?.length || 0} successes and ${data.errors.length} errors: ${data.errors.join(', ')}`)
      } else {
        close(); onRefresh()
        // Refresh the page after successful bulk receive
        setTimeout(() => window.location.reload(), 500)
      }
    } catch (e) { setError(e.message) }
    finally { setBulkSubmitting(false) }
  }

  const receiveLedger = ledger.filter(e => ['final_received', 'reverted', 'revert_source'].includes(e.stage))

  return (
    <div>
      <div className={styles.toolbar}>
        <button
          className="btn btn-outline"
          style={{ borderColor: 'var(--success-color)', color: 'var(--success-color)' }}
          onClick={() => { setReceiveForm({ worker_name: '', sku_name: '', color: '', quantity: '', mrp: '', notes: '', date: today, order_id: '', item_id: '' }); setModal(true) }}
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
              {/* Group by order_id */}
              {Object.entries(items.reduce((acc, item) => {
                const oid = item.order_id || 'Other'
                if (!acc[oid]) acc[oid] = []
                acc[oid].push(item)
                return acc
              }, {})).map(([orderId, orderItems]) => {
                // Get chalan number from orders
                const order = orders.find(o => o.order_id === orderId)
                const chalanNumber = order?.chalan_number || ''
                return (
                  <div key={orderId} style={{ marginBottom: 8, padding: '6px 8px', background: 'rgba(0,0,0,0.02)', borderRadius: 6, border: '1px solid var(--border-color, #e5e7eb)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {chalanNumber && (
                        <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 12 }}>
                          # ({chalanNumber})
                        </span>
                      )}
                      <span style={{ color: 'var(--text-primary)' }}>
                        {orderId.startsWith('ORD') ? orderId : 'Other'}
                      </span>
                      <span style={{ color: '#6366f1', fontWeight: 400 }}>({orderSupplierMap[orderId] || '—'})</span>
                    </div>
                    {orderItems.map((item, idx) => (
                      <div key={idx} className={styles.skuRow} style={{ marginLeft: 8 }}>
                        <span>{item.sku_name}{item.color ? <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 6 }}>({item.color})</span> : ''}</span>
                        <span className="badge badge-warning">{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
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
                <tr><th>#</th><th>SKU</th><th>From</th><th></th><th>To</th><th>Qty</th><th>Stage</th><th>Date</th><th></th></tr>
              </thead>
              <tbody>
                {receiveLedger.map((e, i) => {
                  const chalanNum = orders.find(o => o.order_id === e.order_id)?.chalan_number || ''
                  return (
                    <tr key={i} style={{ background: e.stage === 'revert_source' ? 'rgba(107,114,128,0.06)' : 'transparent' }}>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>{e.ledger_number_int || '—'}</td>
                      <td>
                        {chalanNum && (
                          <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 11, marginRight: 5 }}>#{chalanNum}</span>
                        )}
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
                  )
                })}
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
              {workers.filter(w => workerStock.some(ws => ws.worker_name === w.name && ws.quantity > 0))
                .map(w => <option key={w.worker_id} value={w.name}>{w.name}</option>)}
            </select>
          </FormRow>
          {receiveForm.worker_name && workerStock.filter(ws => ws.worker_name === receiveForm.worker_name).length > 0 && (
            <div className={styles.holdingInfo}>
              <strong>Current Holding:</strong>
              {(() => {
                let holdings = workerStock.filter(ws => ws.worker_name === receiveForm.worker_name)
                // If order selected, filter to that order
                if (receiveForm.order_id) {
                  holdings = holdings.filter(ws => ws.order_id === receiveForm.order_id)
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
              })()} {/* <--- FIXED: Added () here to invoke the function */}
            </div>
          )}
          <FormRow label="Order ID / Chalan Number" required>
            <select className="form-input" value={receiveForm.order_id}
              onChange={e => setReceiveForm(p => ({ ...p, order_id: e.target.value, sku_name: '', color: '', bulkReceive: false }))}>
              <option value="">Select Order...</option>
              {receiveForm.worker_name
                ? [...new Set(workerStock
                  .filter(ws => ws.worker_name === receiveForm.worker_name && ws.quantity > 0)
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
            {receiveForm.order_id && (() => {
              const chalanNumber = workerStock.find(ws => ws.order_id === receiveForm.order_id)?.chalan_number || ''
              return chalanNumber && (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Selected: {receiveForm.order_id} / <span style={{ color: '#dc2626', fontWeight: 'bold' }}># ({chalanNumber})</span>
                </div>
              )
            })()}
          </FormRow>

          {/* Highlighted Bulk Receive Checkbox */}
          {receiveForm.worker_name && receiveForm.order_id && (() => {
            const orderHoldings = workerStock.filter(ws =>
              ws.worker_name === receiveForm.worker_name &&
              ws.order_id === receiveForm.order_id &&
              ws.quantity > 0
            )
            const uniqueSkus = [...new Set(orderHoldings.map(h => h.sku_name))]
            return uniqueSkus.length > 1
          })() && (
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
                    checked={bulkReceive}
                    onChange={e => setBulkReceive(e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontSize: '14px' }}>
                    🚀 RECEIVE ALL SKUs for this order ({(() => {
                      const orderHoldings = workerStock.filter(ws =>
                        ws.worker_name === receiveForm.worker_name &&
                        ws.order_id === receiveForm.order_id &&
                        ws.quantity > 0
                      )
                      const uniqueSkus = [...new Set(orderHoldings.map(h => h.sku_name))]
                      return uniqueSkus.length
                    })()} different SKUs)
                  </span>
                </label>
                <p style={{
                  margin: '8px 0 0 0',
                  fontSize: '12px',
                  color: '#78350f',
                  paddingLeft: '26px'
                }}>
                  This will receive all items from this order at once, saving you time!
                </p>
              </div>
            )}

          {/* Show note and calculate totals when bulk receive is selected */}
          {bulkReceive && receiveForm.worker_name && receiveForm.order_id && (() => {
            const orderHoldings = workerStock.filter(ws =>
              ws.worker_name === receiveForm.worker_name &&
              ws.order_id === receiveForm.order_id &&
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
                  📦 Bulk Receive Mode:
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#166534' }}>
                  The following SKUs are selected for bulk receive:
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
                  Individual SKU selection, quantity, and MRP will be handled automatically.
                </p>
              </div>
            )
          })()}

          {/* Individual SKU fields - hidden when bulk receive is selected */}
          {!bulkReceive && (
            <>
              <FormRow label="SKU Name" required>
                <select className="form-input" value={receiveForm.sku_name}
                  onChange={e => {
                    const sku = e.target.value;
                    // Find matching stock for autofill
                    let matching = workerStock.filter(ws =>
                      ws.worker_name === receiveForm.worker_name &&
                      ws.sku_name === sku &&
                      ws.quantity > 0
                    );
                    if (receiveForm.order_id) {
                      matching = matching.filter(ws => ws.order_id === receiveForm.order_id);
                    }
                    // Get unique colors
                    const colors = [...new Set(matching.map(ws => ws.color || ''))].filter(c => c);
                    const autoColor = colors.length === 1 ? colors[0] : '';
                    // Autofill quantity (total available for this SKU)
                    const autoQty = matching.reduce((s, ws) => s + ws.quantity, 0);
                    setReceiveForm(p => ({ ...p, sku_name: sku, color: autoColor, quantity: String(autoQty) }));
                  }}>
                  <option value="">Select SKU...</option>
                  {(() => {
                    let filtered = workerStock.filter(ws => ws.worker_name === receiveForm.worker_name && ws.quantity > 0);
                    if (receiveForm.order_id) {
                      filtered = filtered.filter(ws => ws.order_id === receiveForm.order_id);
                    }
                    return [...new Set(filtered.map(ws => ws.sku_name))].map((sku, i) => <option key={i} value={sku}>{sku}</option>);
                  })()}
                </select>
              </FormRow>
              {receiveForm.worker_name && receiveForm.sku_name && (
                <FormRow label="Color" required>
                  <select className="form-input" value={receiveForm.color}
                    onChange={e => setReceiveForm(p => ({ ...p, color: e.target.value }))}>
                    <option value="">Select Color...</option>
                    <option value="">No Color / Plain</option>
                    {(() => {
                      let filtered = workerStock.filter(ws => ws.worker_name === receiveForm.worker_name && ws.sku_name === receiveForm.sku_name);
                      if (receiveForm.order_id) {
                        filtered = filtered.filter(ws => ws.order_id === receiveForm.order_id);
                      }
                      return [...new Set(filtered.map(ws => ws.color || ''))].filter(c => c).map((color, i) => <option key={i} value={color}>{color}</option>);
                    })()}
                  </select>
                </FormRow>
              )}
              <FormRow label="Quantity Received" required>
                <input className="form-input" value={receiveForm.quantity}
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
            </>
          )}
          <FormRow label="Date (if backdating)">
            <input className="form-input" type="date" value={receiveForm.date}
              onChange={e => setReceiveForm(p => ({ ...p, date: e.target.value }))} />
          </FormRow>
          <FormRow label="Notes">
            <input className="form-input" placeholder="Optional" value={receiveForm.notes}
              onChange={e => setReceiveForm(p => ({ ...p, notes: e.target.value }))} />
          </FormRow>
          {bulkReceive ? (
            <button
              className="btn btn-primary"
              style={{ width: '100%', backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}
              onClick={handleBulkReceive}
              disabled={bulkSubmitting}
            >
              {bulkSubmitting ? 'Bulk Receiving...' : '🚀 RECEIVE ALL SKUs'}
            </button>
          ) : (
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleReceiveFinal} disabled={submitting}>
              {submitting ? 'Receiving...' : 'Receive Finished Goods'}
            </button>
          )}
        </Modal>
      )}
    </div>
  )
}

export default ReceiveGoods
