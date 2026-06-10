import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdAdd, MdCheckCircle, MdBuild, MdDelete, MdWarning, MdTimeline, MdPeople, MdEdit, MdClose, MdAssignment, MdBook } from 'react-icons/md'
import { apiFetch } from '../../config'
import { Badge, Modal, FormRow, STATUS_LABELS, STATUS_COLORS, OrderDateCell, WORK_TYPES_JOB } from './helpers'
import QuickAddWorker from './QuickAddWorker'
import styles from './ClothOrders.module.css'

function ClothOrders({ orders, workers, workerStock, onRefresh }) {
  const navigate = useNavigate()
  const [modal, setModal] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [skuNames, setSkuNames] = useState([])
  const [skuMap, setSkuMap] = useState({}) // sku_name → {color, fabric, mrp}
  const [supplierNames, setSupplierNames] = useState([])
  const [supplierMap, setSupplierMap] = useState({}) // name → company_name
  const [nextChalanNumber, setNextChalanNumber] = useState(1)
  const [sortOrder, setSortOrder] = useState('last_added') // 'last_added' | 'chalan_asc' | 'chalan_desc'
  const [chalanFilter, setChalanFilter] = useState('')

  useEffect(() => {
    apiFetch('/api/production/suppliers').then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        setSupplierNames(d.map(s => s.name))
        const map = {}
        d.forEach(s => { map[s.name] = s.company_name || '' })
        setSupplierMap(map)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    apiFetch('/api/skus').then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        setSkuNames(d.map(s => s.sku_name))
        const map = {}
        d.forEach(s => { map[s.sku_name] = { color: s.color || '', fabric_type: s.fabric || '', mrp: s.mrp != null ? s.mrp : '' } })
        setSkuMap(map)
      }
    }).catch(() => {})
  }, [])

  // Fetch next chalan number whenever modal opens
  const fetchNextChalan = (cb) => {
    apiFetch('/api/production/next-chalan')
      .then(r => r.json())
      .then(d => {
        if (d.chalan_number) {
          setNextChalanNumber(d.chalan_number)
          if (cb) cb(d.chalan_number)
        }
      })
      .catch(() => {})
  }

  // Check if a chalan number is already used by an existing order
  const getChalanConflict = (num) => {
    if (!num) return null
    return orders.find(o => o.chalan_number === Number(num))
  }

  // Create Order form
  const emptyItem = () => ({ sku_name: '', fabric_type: '', color: '', quantity_ordered: '', mrp: '' })
  const [orderForm, setOrderForm] = useState({ supplier_name: '', company_name: '', chalan_number: '', items: [emptyItem()] })

  // Receive Cloth
  const [receiveTarget, setReceiveTarget] = useState(null)
  const [receiveItems, setReceiveItems] = useState([])
  const [receiveDate, setReceiveDate] = useState('')

  // Edit Order
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({ supplier_name: '', company_name: '', chalan_number: '', items: [] })

  // Delete Order
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Assign Work
  const today = new Date().toISOString().slice(0, 10)
  const [assignForm, setAssignForm] = useState({ order_id: '', item_id: '', sku_name: '', color: '', worker_name: '', quantity: '', work_type: 'Embroidery', notes: '', date: today })
  const [assignOrder, setAssignOrder] = useState(null) // full-order assign target
  const [localWorkers, setLocalWorkers] = useState(workers)

  // Order Ledger
  const [orderLedger, setOrderLedger] = useState([])
  const [viewingOrder, setViewingOrder] = useState(null)

  // sync workers prop → local (new workers added via QuickAddWorker)
  const mergeWorker = (w) => setLocalWorkers(prev => prev.find(p => p.worker_id === w.worker_id) ? prev : [...prev, w])

  const close = () => { setModal(null); setError(null); setEditTarget(null); setDeleteTarget(null); setAssignOrder(null); setViewingOrder(null); setOrderLedger([]) }
  const flash = (msg, isError) => { if (isError) setError(msg) }

  // ── Edit Order ──────────────────────────────────────────────────────────────
  const openEdit = (order) => {
    setEditTarget(order)
    setEditForm({
      supplier_name: order.supplier_name || '',
      company_name: supplierMap[order.supplier_name] || order.notes || '',
      chalan_number: order.chalan_number || '',
      items: order.items.map(i => ({ ...i })),
    })
    setError(null)
    setModal('editOrder')
  }

  const updateEditItem = (idx, field, val) => {
    const items = [...editForm.items]
    items[idx][field] = val
    if (field === 'sku_name' && skuMap[val]) {
      const s = skuMap[val]
      items[idx].color = s.color
      items[idx].fabric_type = s.fabric_type
      items[idx].mrp = s.mrp
    }
    setEditForm(p => ({ ...p, items }))
  }

  const handleEditOrder = async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await apiFetch(`/api/production/orders/${editTarget.order_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...editForm, notes: editForm.company_name, chalan_number: editForm.chalan_number ? Number(editForm.chalan_number) : undefined })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      close(); onRefresh()
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  // ── Delete Order ────────────────────────────────────────────────────────────
  const openDelete = (order) => {
    setDeleteTarget(order)
    setModal('deleteOrder')
  }

  const handleDeleteOrder = async () => {
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/production/orders/${deleteTarget.order_id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      close(); onRefresh()
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  // ── Create Order ────────────────────────────────────────────────────────────
  const handleCreateOrder = async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await apiFetch('/api/production/orders', {
        method: 'POST',
        body: JSON.stringify({ ...orderForm, notes: orderForm.company_name, company_name: 'OneCulture', chalan_number: orderForm.chalan_number ? Number(orderForm.chalan_number) : undefined })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      close(); onRefresh()
      setOrderForm({ supplier_name: '', company_name: '', chalan_number: '', items: [emptyItem()] })
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  // ── Receive Cloth ───────────────────────────────────────────────────────────
  const openReceive = (order) => {
    setReceiveTarget(order)
    setReceiveItems(order.items.map(i => ({ item_id: i.item_id, sku_name: i.sku_name, quantity_received: i.quantity_ordered })))
    setReceiveDate('')
    setModal('receive')
  }

  const handleReceive = async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await apiFetch(`/api/production/orders/${receiveTarget.order_id}/receive`, {
        method: 'PATCH',
        body: JSON.stringify({ items: receiveItems, date: receiveDate || undefined })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      close(); onRefresh()
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  // ── Assign Work ─────────────────────────────────────────────────────────────
  const workerMap = Object.fromEntries(localWorkers.map(w => [w.name, w.work_type || 'Embroidery']))

  const openAssign = (order, item) => {
    const totalQty = item.quantity_ordered || ''
    setAssignOrder(null)
    setAssignForm({ order_id: order.order_id, item_id: item.item_id, sku_name: item.sku_name, color: item.color || '', worker_name: '', quantity: String(totalQty), work_type: 'Embroidery', notes: '', date: today })
    setLocalWorkers(workers)
    setModal('assign')
  }

  const openAssignOrder = (order) => {
    const totalQty = order.items.reduce((s, i) => s + (Number(i.quantity_ordered) || 0), 0)
    setAssignOrder(order)
    setAssignForm({ order_id: order.order_id, item_id: '', sku_name: '', color: '', worker_name: '', quantity: String(totalQty), work_type: 'Embroidery', notes: '', date: today })
    setLocalWorkers(workers)
    setModal('assign')
  }

  const openOrderLedger = async (order) => {
    setViewingOrder(order)
    try {
      const res = await apiFetch(`/api/production/orders/${order.order_id}`)
      const data = await res.json()
      setOrderLedger(data.ledger || [])
    } catch (e) {
      setOrderLedger([])
    }
    setModal('orderLedger')
  }

  const handleAssign = async () => {
    setSubmitting(true); setError(null)
    try {
      if (assignOrder) {
        // Full order: fire one assign call per item, distribute quantity proportionally
        const items = assignOrder.items
        const totalOrdered = items.reduce((s, i) => s + (Number(i.quantity_ordered) || 0), 0)
        const totalAssign = Number(assignForm.quantity) || totalOrdered
        for (const item of items) {
          const itemQty = totalOrdered > 0
            ? Math.round((Number(item.quantity_ordered) / totalOrdered) * totalAssign)
            : Number(item.quantity_ordered)
          if (itemQty <= 0) continue
          const res = await apiFetch('/api/production/assign', {
            method: 'POST',
            body: JSON.stringify({ ...assignForm, item_id: item.item_id, sku_name: item.sku_name, color: item.color || assignForm.color, quantity: itemQty })
          })
          const data = await res.json()
          if (!res.ok) throw new Error(`${item.sku_name}: ${data.error}`)
        }
      } else {
        const res = await apiFetch('/api/production/assign', {
          method: 'POST',
          body: JSON.stringify(assignForm)
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
      }
      close(); onRefresh()
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const updateItem = (idx, field, val) => {
    const items = [...orderForm.items]
    items[idx][field] = val
    if (field === 'sku_name' && skuMap[val]) {
      const s = skuMap[val]
      items[idx].color = s.color
      items[idx].fabric_type = s.fabric_type
      items[idx].mrp = s.mrp
    }
    setOrderForm(p => ({ ...p, items }))
  }

  // Sorted and filtered orders
  const displayedOrders = [...orders]
    .filter(o => {
      if (!chalanFilter) return true
      return String(o.chalan_number || '').includes(chalanFilter)
    })
    .sort((a, b) => {
      if (sortOrder === 'chalan_asc') return (a.chalan_number || 0) - (b.chalan_number || 0)
      if (sortOrder === 'chalan_desc') return (b.chalan_number || 0) - (a.chalan_number || 0)
      // last_added: newest first
      return new Date(b.created_at) - new Date(a.created_at)
    })

  return (
    <div>
      <div className={styles.toolbar} style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => { fetchNextChalan(n => setOrderForm(p => ({ ...p, chalan_number: String(n) }))); setModal('createOrder') }}>
          <MdAdd size={18} /> New Cloth Order
        </button>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
          <input
            className="form-input"
            style={{ width: 140, fontSize: 13 }}
            placeholder="Filter by Chalan #"
            value={chalanFilter}
            onChange={e => setChalanFilter(e.target.value)}
            type="number"
            min="1"
          />
          <select className="form-input" style={{ width: 160, fontSize: 13 }} value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
            <option value="last_added">Sort: Last Added</option>
            <option value="chalan_asc">Sort: Chalan ↑</option>
            <option value="chalan_desc">Sort: Chalan ↓</option>
          </select>
        </div>
      </div>

      {displayedOrders.length > 0 ? displayedOrders.map(order => (
        <div key={order.order_id} className={styles.orderCard}>
          <div className={styles.orderHeader}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {order.chalan_number != null && (
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--primary-color)', lineHeight: 1.2 }}>
                  Chalan #{order.chalan_number}
                </div>
              )}
              <div className={styles.orderMeta}>
                Supplier: <strong>{order.supplier_name || '—'}</strong>
                &nbsp;·&nbsp;<OrderDateCell orderId={order.order_id} dateStr={order.created_at} onSaved={onRefresh} />
                {order.notes && <>&nbsp;·&nbsp;<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{order.notes}</span></>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge text={STATUS_LABELS[order.status] || order.status} color={STATUS_COLORS[order.status]} />
              {order.items.some(i => i.status !== 'in_work' && i.status !== 'completed') && (
                <button className="btn btn-primary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => openAssignOrder(order)}>
                  <MdAssignment size={13} /> Assign All
                </button>
              )}
              <button className="btn btn-outline" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => openOrderLedger(order)}>
                <MdBook size={13} /> Ledger
              </button>
              <button className="btn btn-outline" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => openEdit(order)}>
                <MdEdit size={13} /> Edit
              </button>
              <button className="btn btn-outline" style={{ fontSize: 11, padding: '3px 10px', color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }} onClick={() => openDelete(order)}>
                <MdDelete size={13} /> Delete
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>SKU</th><th>Fabric</th><th>Color</th><th>Ordered</th><th>With Supplier</th><th>MRP</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {order.items?.map(item => (
                  <tr key={item.item_id}>
                    <td><strong>{item.sku_name}</strong></td>
                    <td>{item.fabric_type || '—'}</td>
                    <td>{item.color || '—'}</td>
                    <td><span className="badge badge-primary">{item.quantity_ordered}</span></td>
                    <td><span className="badge badge-info">{item.quantity_ordered}</span></td>
                    <td>{item.mrp > 0 ? `₹${item.mrp.toFixed(2)}` : '—'}</td>
                    <td><Badge text={STATUS_LABELS[item.status] || item.status} color={STATUS_COLORS[item.status]} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {item.status !== 'in_work' && item.status !== 'completed' && (
                          <button className="btn btn-outline" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => openAssign(order, item)}>
                            <MdBuild size={13} /> Assign
                          </button>
                        )}
                        <button className={styles.trackBtn} onClick={() => navigate(`/tracker?sku=${encodeURIComponent(item.sku_name)}`)}>
                          <MdTimeline size={13} /> Track
                        </button>
                        {workerStock && workerStock.filter(ws => ws.sku_name === item.sku_name && ws.order_id === order.order_id).length > 0 && (
                          <button className={styles.workerBtn} onClick={() => navigate('/production?tab=workers')} title="View in Workers tab">
                            <MdPeople size={13} />
                            {(() => {
                              const stock = workerStock.filter(ws => ws.sku_name === item.sku_name && ws.order_id === order.order_id)
                              const total = stock.reduce((s, ws) => s + ws.quantity, 0)
                              // Group by color for display
                              const byColor = {}
                              stock.forEach(ws => {
                                const color = ws.color || 'No Color'
                                byColor[color] = (byColor[color] || 0) + ws.quantity
                              })
                              const colorBreakdown = Object.entries(byColor)
                                .map(([color, qty]) => `${color}: ${qty}`)
                                .join(', ')
                              return `${total} with workers (${colorBreakdown})`
                            })()}
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
          <datalist id="sku-datalist">
            {skuNames.map(name => <option key={name} value={name} />)}
          </datalist>
          <datalist id="supplier-datalist">
            {supplierNames.map(name => <option key={name} value={name} />)}
          </datalist>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}><MdWarning size={16} />{error}</div>}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Supplier Name</label>
              <input className="form-input" placeholder="e.g. Raj Textiles" list="supplier-datalist" value={orderForm.supplier_name}
                onChange={e => {
                  const name = e.target.value
                  setOrderForm(p => ({ ...p, supplier_name: name, company_name: supplierMap[name] || '' }))
                }} />
            </div>
            <div style={{ width: 140 }}>
              <label className="form-label">Chalan Number</label>
              <input className="form-input" type="number" min="1"
                value={orderForm.chalan_number}
                onChange={e => setOrderForm(p => ({ ...p, chalan_number: e.target.value }))} />
              {(() => {
                const conflict = getChalanConflict(orderForm.chalan_number)
                if (!conflict) return null
                return (
                  <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                    ⚠ Already used by order: <strong>{conflict.order_id}</strong> ({conflict.supplier_name || '—'})
                  </div>
                )
              })()}
            </div>
          </div>
          {orderForm.company_name && (
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              Company: <strong style={{ color: 'var(--text-primary)' }}>{orderForm.company_name}</strong>
            </div>
          )}
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
                  <input className="form-input" placeholder="e.g. Design A" list="sku-datalist" value={item.sku_name} onChange={e => updateItem(idx, 'sku_name', e.target.value)} />
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


      {/* ── Edit Order Modal ───────────────────────────────────────────────── */}
      {modal === 'editOrder' && editTarget && (
        <Modal title={`Edit Order — ${editTarget.order_id}`} onClose={close} width={720}>
          <datalist id="sku-datalist-edit">
            {skuNames.map(name => <option key={name} value={name} />)}
          </datalist>
          <datalist id="supplier-datalist-edit">
            {supplierNames.map(name => <option key={name} value={name} />)}
          </datalist>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}><MdWarning size={16} /> {error}</div>}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Supplier Name</label>
              <input className="form-input" list="supplier-datalist-edit" value={editForm.supplier_name}
                onChange={e => {
                  const name = e.target.value
                  setEditForm(p => ({ ...p, supplier_name: name, company_name: supplierMap[name] || p.company_name }))
                }} />
            </div>
            <div style={{ width: 140 }}>
              <label className="form-label">Chalan Number</label>
              <input className="form-input" type="number" min="1"
                value={editForm.chalan_number}
                onChange={e => setEditForm(p => ({ ...p, chalan_number: e.target.value }))} />
              {(() => {
                const conflict = getChalanConflict(editForm.chalan_number)
                if (!conflict || conflict.order_id === editTarget?.order_id) return null
                return (
                  <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                    ⚠ Already used by order: <strong>{conflict.order_id}</strong> ({conflict.supplier_name || '—'})
                  </div>
                )
              })()}
            </div>
          </div>
          {editForm.company_name && (
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              Company: <strong style={{ color: 'var(--text-primary)' }}>{editForm.company_name}</strong>
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 4 }}>
            <strong style={{ fontSize: 14 }}>Items</strong>
            {editForm.items.map((item, idx) => (
              <div key={item.item_id} className={styles.itemRow} style={{ marginTop: 12 }}>
                <div className={styles.itemField} style={{ flex: 2 }}>
                  <label className={styles.fieldLabel}>SKU Name *</label>
                  <input className="form-input" list="sku-datalist-edit" value={item.sku_name} onChange={e => updateEditItem(idx, 'sku_name', e.target.value)} />
                </div>
                <div className={styles.itemField}>
                  <label className={styles.fieldLabel}>Fabric</label>
                  <input className="form-input" value={item.fabric_type} onChange={e => updateEditItem(idx, 'fabric_type', e.target.value)} />
                </div>
                <div className={styles.itemField}>
                  <label className={styles.fieldLabel}>Color</label>
                  <input className="form-input" value={item.color} onChange={e => updateEditItem(idx, 'color', e.target.value)} />
                </div>
                <div className={styles.itemField}>
                  <label className={styles.fieldLabel}>Qty *</label>
                  <input className="form-input" type="number" min="1" value={item.quantity_ordered} onChange={e => updateEditItem(idx, 'quantity_ordered', e.target.value)} />
                </div>
                <div className={styles.itemField}>
                  <label className={styles.fieldLabel}>MRP ₹</label>
                  <input className="form-input" type="number" min="0" value={item.mrp} onChange={e => updateEditItem(idx, 'mrp', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={handleEditOrder} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </Modal>
      )}

      {/* ── Delete Confirm Modal ───────────────────────────────────────────── */}
      {modal === 'deleteOrder' && deleteTarget && (
        <Modal title="Delete Cloth Order?" onClose={close} width={420}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}><MdWarning size={16} /> {error}</div>}
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 8px' }}>
            This will permanently delete order <strong>{deleteTarget.order_id}</strong> and all its ledger entries.
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 20px' }}>
            Supplier: <strong>{deleteTarget.supplier_name || '—'}</strong> &nbsp;·&nbsp; {deleteTarget.items?.length || 0} item(s)
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, background: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
              disabled={submitting}
              onClick={handleDeleteOrder}
            >
              {submitting ? 'Deleting...' : 'Yes, Delete'}
            </button>
            <button className="btn btn-outline" onClick={close} disabled={submitting}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* ── Assign Work Modal ──────────────────────────────────────────────── */}
      {modal === 'assign' && (
        <Modal title={assignOrder ? `Assign All Items — ${assignOrder.order_id}` : 'Assign Work to Worker'} onClose={close}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

          {/* Context summary */}
          <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            {assignOrder ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>Supplier: <strong>{assignOrder.supplier_name || '—'}</strong></span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
                  {assignOrder.items.map(i => (
                    <span key={i.item_id} style={{ fontSize: 12, background: 'white', border: '1px solid var(--border-color)', borderRadius: 6, padding: '2px 8px' }}>
                      {i.sku_name}{i.color ? ` · ${i.color}` : ''} <strong>×{i.quantity_ordered}</strong>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>SKU: <strong>{assignForm.sku_name}</strong></span>
                {assignForm.color && <span>Color: <strong>{assignForm.color}</strong></span>}
              </div>
            )}
          </div>

          {/* Single-item color override (not shown for full order) */}
          {!assignOrder && (
            <FormRow label="Color">
              <input className="form-input" placeholder="e.g. Red (leave blank if none)" value={assignForm.color} onChange={e => setAssignForm(p => ({ ...p, color: e.target.value }))} />
            </FormRow>
          )}

          {/* Worker */}
          <div className="form-group">
            <label className="form-label">Worker <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <select className="form-input" value={assignForm.worker_name}
              onChange={e => {
                const name = e.target.value
                const wt = workerMap[name] || assignForm.work_type
                setAssignForm(p => ({ ...p, worker_name: name, work_type: wt }))
              }}>
              <option value="">Select Worker...</option>
              {localWorkers.map(w => <option key={w.worker_id} value={w.name}>{w.name} ({w.work_type})</option>)}
            </select>
            <QuickAddWorker defaultWorkType="Job Work" onWorkerAdded={(w) => { mergeWorker(w); setAssignForm(p => ({ ...p, worker_name: w.name, work_type: w.work_type || p.work_type })) }} />
          </div>

          {/* Quantity — editable but pre-filled */}
          <FormRow label="Quantity" required>
            <input className="form-input" type="number" min="1" value={assignForm.quantity} onChange={e => setAssignForm(p => ({ ...p, quantity: e.target.value }))} />
          </FormRow>

          {/* Work Type — auto-filled from worker */}
          <FormRow label="Work Type">
            <select className="form-input" value={assignForm.work_type} onChange={e => setAssignForm(p => ({ ...p, work_type: e.target.value }))}>
              {WORK_TYPES_JOB.map(t => <option key={t}>{t}</option>)}
            </select>
          </FormRow>

          {/* Date — defaults to today */}
          <FormRow label="Date">
            <input className="form-input" type="date" value={assignForm.date}
              onChange={e => setAssignForm(p => ({ ...p, date: e.target.value }))} />
          </FormRow>

          <FormRow label="Notes">
            <input className="form-input" placeholder="Optional" value={assignForm.notes} onChange={e => setAssignForm(p => ({ ...p, notes: e.target.value }))} />
          </FormRow>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAssign} disabled={submitting}>
            {submitting ? 'Assigning...' : `Assign to ${assignForm.worker_name || 'Worker'}`}
          </button>
        </Modal>
      )}

      {/* ── Order Ledger Modal ──────────────────────────────────────────────── */}
      {modal === 'orderLedger' && viewingOrder && (
        <Modal title={`Ledger — ${viewingOrder.order_id}`} onClose={close} width={800}>
          <div style={{ marginBottom: 16 }}>
            <strong>Supplier:</strong> {viewingOrder.supplier_name} &nbsp;|&nbsp;
            <strong>Status:</strong> <Badge text={STATUS_LABELS[viewingOrder.status] || viewingOrder.status} color={STATUS_COLORS[viewingOrder.status]} />
          </div>
          {orderLedger.length > 0 ? (
            <div className="table-container" style={{ maxHeight: 400, overflow: 'auto' }}>
              <table className="table">
                <thead>
                  <tr><th>#</th><th>Stage</th><th>SKU</th><th>From→To</th><th>Qty</th><th>Work Type</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {orderLedger.map((e, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 11, textAlign: 'center' }}>{e.ledger_number_int || '—'}</td>
                      <td><Badge text={STATUS_LABELS[e.stage] || e.stage} color={STATUS_COLORS[e.stage] || '#6b7280'} /></td>
                      <td><strong>{e.sku_name}</strong>{e.color ? <span style={{ fontSize: 10, color: '#6366f1', marginLeft: 4 }}>({e.color})</span> : ''}</td>
                      <td style={{ fontSize: 12 }}><span style={{ color: 'var(--text-secondary)' }}>{e.from_entity}</span> → <span style={{ fontWeight: 600 }}>{e.to_entity}</span></td>
                      <td><span className="badge badge-primary">{e.quantity}</span></td>
                      <td>{e.work_type || '—'}</td>
                      <td style={{ fontSize: 12 }}>{e.created_at ? new Date(e.created_at).toLocaleDateString('en-GB') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 32 }}>No ledger entries for this order.</div>
          )}
        </Modal>
      )}
    </div>
  )
}

export default ClothOrders
