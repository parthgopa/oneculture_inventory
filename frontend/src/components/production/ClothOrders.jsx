import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdAdd, MdCheckCircle, MdBuild, MdDelete, MdWarning, MdTimeline, MdPeople } from 'react-icons/md'
import { apiFetch } from '../../config'
import { Badge, Modal, FormRow, STATUS_LABELS, STATUS_COLORS } from './helpers'
import QuickAddWorker from './QuickAddWorker'
import styles from './ClothOrders.module.css'

function ClothOrders({ orders, workers, workerStock, onRefresh }) {
  const navigate = useNavigate()
  const [modal, setModal] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Create Order form
  const emptyItem = () => ({ sku_name: '', fabric_type: '', color: '', quantity_ordered: '', mrp: '' })
  const [orderForm, setOrderForm] = useState({ supplier_name: '', notes: '', items: [emptyItem()] })

  // Receive Cloth
  const [receiveTarget, setReceiveTarget] = useState(null)
  const [receiveItems, setReceiveItems] = useState([])

  // Assign Work
  const [assignForm, setAssignForm] = useState({ order_id: '', item_id: '', sku_name: '', worker_name: '', quantity: '', work_type: 'Embroidery', notes: '' })
  const [localWorkers, setLocalWorkers] = useState(workers)

  // sync workers prop → local (new workers added via QuickAddWorker)
  const mergeWorker = (w) => setLocalWorkers(prev => prev.find(p => p.worker_id === w.worker_id) ? prev : [...prev, w])

  const close = () => { setModal(null); setError(null) }
  const flash = (msg, isError) => { if (isError) setError(msg) }

  // ── Create Order ────────────────────────────────────────────────────────────
  const handleCreateOrder = async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await apiFetch('/api/production/orders', {
        method: 'POST',
        body: JSON.stringify({ ...orderForm, company_name: 'OneCulture' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      close(); onRefresh()
      setOrderForm({ supplier_name: '', notes: '', items: [emptyItem()] })
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  // ── Receive Cloth ───────────────────────────────────────────────────────────
  const openReceive = (order) => {
    setReceiveTarget(order)
    setReceiveItems(order.items.map(i => ({ item_id: i.item_id, sku_name: i.sku_name, quantity_received: i.quantity_ordered })))
    setModal('receive')
  }

  const handleReceive = async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await apiFetch(`/api/production/orders/${receiveTarget.order_id}/receive`, {
        method: 'PATCH',
        body: JSON.stringify({ items: receiveItems })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      close(); onRefresh()
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  // ── Assign Work ─────────────────────────────────────────────────────────────
  const openAssign = (order, item) => {
    setAssignForm({ order_id: order.order_id, item_id: item.item_id, sku_name: item.sku_name, worker_name: '', quantity: '', work_type: 'Embroidery', notes: '' })
    setLocalWorkers(workers)
    setModal('assign')
  }

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

  const updateItem = (idx, field, val) => {
    const items = [...orderForm.items]
    items[idx][field] = val
    setOrderForm(p => ({ ...p, items }))
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <button className="btn btn-primary" onClick={() => setModal('createOrder')}>
          <MdAdd size={18} /> New Cloth Order
        </button>
      </div>

      {orders.length > 0 ? orders.map(order => (
        <div key={order.order_id} className={styles.orderCard}>
          <div className={styles.orderHeader}>
            <div>
              <div className={styles.orderId}>Order: {order.order_id}</div>
              <div className={styles.orderMeta}>
                Supplier: <strong>{order.supplier_name || '—'}</strong>
                &nbsp;·&nbsp;{new Date(order.created_at).toLocaleDateString()}
                {order.notes && <>&nbsp;·&nbsp;{order.notes}</>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge text={STATUS_LABELS[order.status] || order.status} color={STATUS_COLORS[order.status]} />
              {order.status === 'ordered' && (
                <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => openReceive(order)}>
                  <MdCheckCircle size={14} /> Mark Received
                </button>
              )}
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>SKU</th><th>Fabric</th><th>Color</th><th>Ordered</th><th>Received</th><th>MRP</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {order.items?.map(item => (
                  <tr key={item.item_id}>
                    <td><strong>{item.sku_name}</strong></td>
                    <td>{item.fabric_type || '—'}</td>
                    <td>{item.color || '—'}</td>
                    <td><span className="badge badge-primary">{item.quantity_ordered}</span></td>
                    <td><span className={`badge badge-${item.quantity_received > 0 ? 'success' : 'danger'}`}>{item.quantity_received}</span></td>
                    <td>{item.mrp > 0 ? `₹${item.mrp.toFixed(2)}` : '—'}</td>
                    <td><Badge text={STATUS_LABELS[item.status] || item.status} color={STATUS_COLORS[item.status]} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {/* BUG FIX: show for both 'received' and 'in_work' statuses */}
                        {(item.status === 'received' || item.status === 'in_work') && (
                          <button className="btn btn-outline" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => openAssign(order, item)}>
                            <MdBuild size={13} /> Assign Work
                          </button>
                        )}
                        <button className={styles.trackBtn} onClick={() => navigate(`/tracker?sku=${encodeURIComponent(item.sku_name)}`)}>
                          <MdTimeline size={13} /> Track
                        </button>
                        {workerStock && workerStock.filter(ws => ws.sku_name === item.sku_name).length > 0 && (
                          <button className={styles.workerBtn} onClick={() => navigate('/production?tab=workers')} title="View in Workers tab">
                            <MdPeople size={13} />
                            {workerStock.filter(ws => ws.sku_name === item.sku_name).reduce((s, ws) => s + ws.quantity, 0)} with workers
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )) : (
        <div className="card">
          <div className="empty-state" style={{ padding: 56 }}>
            <div className="empty-state-icon"><MdAdd size={52} /></div>
            <div className="empty-state-title">No cloth orders yet</div>
            <div className="empty-state-description">Create your first order to start the production workflow</div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setModal('createOrder')}>
              <MdAdd size={18} /> Create First Order
            </button>
          </div>
        </div>
      )}

      {/* ── Create Order Modal ─────────────────────────────────────────────── */}
      {modal === 'createOrder' && (
        <Modal title="New Cloth Order" onClose={close} width={720}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}><MdWarning size={16} />{error}</div>}
          <FormRow label="Supplier Name">
            <input className="form-input" placeholder="e.g. Raj Textiles" value={orderForm.supplier_name} onChange={e => setOrderForm(p => ({ ...p, supplier_name: e.target.value }))} />
          </FormRow>
          <FormRow label="Notes">
            <input className="form-input" placeholder="Optional notes" value={orderForm.notes} onChange={e => setOrderForm(p => ({ ...p, notes: e.target.value }))} />
          </FormRow>
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong style={{ fontSize: 14 }}>Items</strong>
              <button className="btn btn-outline" style={{ fontSize: 12, padding: '4px 12px' }}
                onClick={() => setOrderForm(p => ({ ...p, items: [...p.items, emptyItem()] }))}>
                <MdAdd size={14} /> Add Item
              </button>
            </div>
            {orderForm.items.map((item, idx) => (
              <div key={idx} className={styles.itemRow}>
                <div className={styles.itemField} style={{ flex: 2 }}>
                  <label className={styles.fieldLabel}>SKU Name *</label>
                  <input className="form-input" placeholder="e.g. Design A" value={item.sku_name} onChange={e => updateItem(idx, 'sku_name', e.target.value)} />
                </div>
                <div className={styles.itemField}>
                  <label className={styles.fieldLabel}>Fabric</label>
                  <input className="form-input" placeholder="Cotton" value={item.fabric_type} onChange={e => updateItem(idx, 'fabric_type', e.target.value)} />
                </div>
                <div className={styles.itemField}>
                  <label className={styles.fieldLabel}>Color</label>
                  <input className="form-input" placeholder="Red" value={item.color} onChange={e => updateItem(idx, 'color', e.target.value)} />
                </div>
                <div className={styles.itemField}>
                  <label className={styles.fieldLabel}>Qty *</label>
                  <input className="form-input" type="number" min="1" placeholder="100" value={item.quantity_ordered} onChange={e => updateItem(idx, 'quantity_ordered', e.target.value)} />
                </div>
                <div className={styles.itemField}>
                  <label className={styles.fieldLabel}>MRP ₹</label>
                  <input className="form-input" type="number" min="0" placeholder="299" value={item.mrp} onChange={e => updateItem(idx, 'mrp', e.target.value)} />
                </div>
                <button onClick={() => setOrderForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color)', padding: '4px', alignSelf: 'flex-end', marginBottom: 2 }}
                  disabled={orderForm.items.length === 1}>
                  <MdDelete size={18} />
                </button>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={handleCreateOrder} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Order'}
          </button>
        </Modal>
      )}

      {/* ── Receive Cloth Modal ────────────────────────────────────────────── */}
      {modal === 'receive' && receiveTarget && (
        <Modal title="Mark Cloth as Received" onClose={close}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0 }}>Enter the actual quantity received from the supplier.</p>
          {receiveItems.map((item, idx) => (
            <div key={item.item_id} style={{ marginBottom: 14 }}>
              <label className="form-label">{item.sku_name}</label>
              <input className="form-input" type="number" min="0" value={item.quantity_received}
                onChange={e => { const copy = [...receiveItems]; copy[idx].quantity_received = parseInt(e.target.value) || 0; setReceiveItems(copy) }}
                placeholder="Quantity received" />
            </div>
          ))}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={handleReceive} disabled={submitting}>
            {submitting ? 'Saving...' : 'Confirm Receipt'}
          </button>
        </Modal>
      )}

      {/* ── Assign Work Modal ──────────────────────────────────────────────── */}
      {modal === 'assign' && (
        <Modal title="Assign Work to Worker" onClose={close}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
          <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            SKU: <strong>{assignForm.sku_name}</strong>
          </div>
          <div className="form-group">
            <label className="form-label">Worker <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <select className="form-input" value={assignForm.worker_name} onChange={e => setAssignForm(p => ({ ...p, worker_name: e.target.value }))}>
              <option value="">Select Worker...</option>
              {localWorkers.map(w => <option key={w.worker_id} value={w.name}>{w.name} ({w.work_type})</option>)}
            </select>
            <QuickAddWorker defaultWorkType="Job Work" onWorkerAdded={(w) => { mergeWorker(w); setAssignForm(p => ({ ...p, worker_name: w.name })) }} />
          </div>
          <FormRow label="Quantity" required>
            <input className="form-input" type="number" min="1" placeholder="e.g. 50" value={assignForm.quantity} onChange={e => setAssignForm(p => ({ ...p, quantity: e.target.value }))} />
          </FormRow>
          <FormRow label="Work Type">
            <select className="form-input" value={assignForm.work_type} onChange={e => setAssignForm(p => ({ ...p, work_type: e.target.value }))}>
              {['Embroidery', 'Cutting', 'Stitching', 'Printing', 'Dyeing', 'Other'].map(t => <option key={t}>{t}</option>)}
            </select>
          </FormRow>
          <FormRow label="Notes">
            <input className="form-input" placeholder="Optional" value={assignForm.notes} onChange={e => setAssignForm(p => ({ ...p, notes: e.target.value }))} />
          </FormRow>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAssign} disabled={submitting}>
            {submitting ? 'Assigning...' : `Assign to ${assignForm.worker_name || 'Worker'}`}
          </button>
        </Modal>
      )}
    </div>
  )
}

export default ClothOrders
