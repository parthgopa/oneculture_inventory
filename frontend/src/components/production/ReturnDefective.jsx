import { useState, useEffect } from 'react'
import { MdAssignmentReturn, MdWarning, MdPeople } from 'react-icons/md'
import { apiFetch } from '../../config'
import { Badge, Modal, FormRow, STATUS_LABELS, STATUS_COLORS } from './helpers'
import QuickAddWorker from './QuickAddWorker'
import styles from './ReturnDefective.module.css'

function ReturnDefective({ workers, workerStock, onRefresh }) {
  const [modal, setModal] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [localWorkers, setLocalWorkers] = useState(workers)
  const [suppliers, setSuppliers] = useState([])
  const [selectedWorker, setSelectedWorker] = useState('')
  const [workerHoldings, setWorkerHoldings] = useState([])
  const [loadingDelivered, setLoadingDelivered] = useState(false)
  const [deadStockHistory, setDeadStockHistory] = useState([])
  const [filteredDeadStock, setFilteredDeadStock] = useState([])
  const [loadingDeadStock, setLoadingDeadStock] = useState(false)
  const [showDeadStockHistory, setShowDeadStockHistory] = useState(false)
  const [deadStockFilters, setDeadStockFilters] = useState({
    worker_name: '',
    sku_name: '',
    date_from: '',
    date_to: ''
  })

  const today = new Date().toISOString().slice(0, 10)
  const [returnForm, setReturnForm] = useState({
    from_entity: '',
    order_id: '',
    sku_name: '',
    color: '',
    quantity: '',
    to_entity: '', // 'company' or supplier name
    reason: '',
    date: today
  })

  // Fetch suppliers on mount
  useEffect(() => {
    apiFetch('/api/production/suppliers')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setSuppliers(data)
      })
      .catch(() => {})
  }, [])

  // Fetch dead stock history
  const fetchDeadStockHistory = async (filters = {}) => {
    setLoadingDeadStock(true)
    try {
      const params = new URLSearchParams()
      if (filters.worker_name) params.append('worker_name', filters.worker_name)
      if (filters.sku_name) params.append('sku_name', filters.sku_name)
      if (filters.date_from) params.append('date_from', filters.date_from)
      if (filters.date_to) params.append('date_to', filters.date_to)
      
      const url = params.toString() ? `/api/production/dead-stock-history?${params}` : '/api/production/dead-stock-history'
      const response = await apiFetch(url)
      const data = await response.json()
      setDeadStockHistory(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching dead stock history:', error)
    } finally {
      setLoadingDeadStock(false)
    }
  }

  // Initial fetch of dead stock history
  useEffect(() => {
    fetchDeadStockHistory()
  }, [])

  // Fetch items worker has DELIVERED to company (final_received) when worker is selected
  useEffect(() => {
    if (selectedWorker) {
      setLoadingDelivered(true)
      apiFetch(`/api/production/worker-delivered?worker_name=${encodeURIComponent(selectedWorker)}`)
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setWorkerHoldings(data) })
        .catch(() => setWorkerHoldings([]))
        .finally(() => setLoadingDelivered(false))
    } else {
      setWorkerHoldings([])
    }
  }, [selectedWorker])

  const mergeWorker = (w) => setLocalWorkers(prev => prev.find(p => p.worker_id === w.worker_id) ? prev : [...prev, w])

  const close = () => { 
    setModal(null); 
    setError(null); 
    setSelectedWorker('')
    setWorkerHoldings([])
    setReturnForm({
      from_entity: '',
      order_id: '',
      sku_name: '',
      color: '',
      quantity: '',
      to_entity: '',
      reason: '',
      date: today
    })
  }

  const openReturn = (worker, holding) => {
    setSelectedWorker(worker)
    setReturnForm({
      from_entity: worker,
      order_id: holding.order_id || '',
      sku_name: holding.sku_name || '',
      color: holding.color || '',
      quantity: '',
      to_entity: '',
      reason: '',
      date: today
    })
    setModal('return')
  }

  const handleReturn = async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await apiFetch('/api/production/return-defective', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnForm)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Return failed')
      onRefresh()
      fetchDeadStockHistory() // Refresh dead stock history
      close()
    } catch (e) { 
      setError(e.message) 
    }
    finally { 
      setSubmitting(false) 
    }
  }

  // Get unique SKUs for selected worker
  const getWorkerSKUs = () => {
    return [...new Set(workerHoldings.map(h => h.sku_name))].filter(Boolean)
  }

  // Get colors for selected SKU
  const getSKUColors = (skuName) => {
    return [...new Set(workerHoldings
      .filter(h => h.sku_name === skuName)
      .map(h => h.color || '')
    )].filter(Boolean)
  }

  // Get available quantity for selected SKU and color
  const getAvailableQuantity = (skuName, color) => {
    const holding = workerHoldings.find(h => 
      h.sku_name === skuName && 
      (h.color || '') === (color || '')
    )
    return holding ? holding.quantity : 0
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MdAssignmentReturn size={24} />
          Return/Defective (RF)
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
          Return defective or mistaken items from workers to supplier or company (dead stock)
        </p>
      </div>

      {/* Worker Selection */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Select Worker</h3>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select 
            className="form-input" 
            style={{ width: 200 }}
            value={selectedWorker}
            onChange={e => setSelectedWorker(e.target.value)}
          >
            <option value="">Select worker...</option>
            {workers.map(w => (
              <option key={w.worker_id} value={w.name}>{w.name}</option>
            ))}
          </select>
          {/* <QuickAddWorker 
            defaultWorkType="Job Work"
            onWorkerAdded={(w) => { 
              mergeWorker(w); 
              setSelectedWorker(w.name) 
            }} 
          /> */}
        </div>
      </div>

      {/* Worker Delivered Items */}
      {selectedWorker && loadingDelivered && (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Loading delivered items...</p>
        </div>
      )}
      {selectedWorker && !loadingDelivered && workerHoldings.length > 0 && (
        <div className="card">
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>
              Items Delivered to Company — {selectedWorker}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              Items this worker has already returned to company. Select one to mark as defective / dead stock.
            </p>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>SKU Name</th>
                  <th>Color</th>
                  <th>Quantity</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {workerHoldings.map((holding, idx) => (
                  <tr key={idx}>
                    <td>
                      <span>{holding.order_id || '—'}</span>
                      {holding.chalan_number && (
                        <span style={{ color: '#dc2626', fontWeight: 700, marginLeft: 6 }}>
                          # ({holding.chalan_number})
                        </span>
                      )}
                    </td>
                    <td><strong>{holding.sku_name}</strong></td>
                    <td>{holding.color || '—'}</td>
                    <td><span className="badge badge-primary">{holding.quantity}</span></td>
                    <td>
                      <button 
                        className="btn btn-outline" 
                        style={{ fontSize: 11, padding: '4px 10px' }}
                        onClick={() => openReturn(selectedWorker, holding)}
                      >
                        <MdAssignmentReturn size={13} /> Return
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedWorker && !loadingDelivered && workerHoldings.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <MdPeople size={48} style={{ color: 'var(--text-secondary)', marginBottom: 16 }} />
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            No items delivered to company yet for {selectedWorker}
          </p>
        </div>
      )}

      {/* Dead Stock History Section */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdAssignmentReturn size={20} />
            Dead Stock History
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400 }}>
              ({deadStockHistory.length} items)
            </span>
          </h3>
          <button 
            className="btn btn-outline" 
            style={{ fontSize: 11, padding: '4px 10px' }}
            onClick={() => setShowDeadStockHistory(!showDeadStockHistory)}
          >
            {showDeadStockHistory ? 'Hide' : 'Show'}
          </button>
        </div>

        {showDeadStockHistory && (
          <>
            {/* Filter Controls */}
            <div style={{ 
              backgroundColor: 'var(--background-secondary, #f9fafb)', 
              padding: '12px', 
              borderRadius: '6px', 
              marginBottom: '16px',
              border: '1px solid var(--border-color, #e5e7eb)'
            }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'end' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    Worker
                  </label>
                  <select 
                    className="form-input" 
                    style={{ fontSize: '12px' }}
                    value={deadStockFilters.worker_name}
                    onChange={e => setDeadStockFilters(p => ({ ...p, worker_name: e.target.value }))}
                  >
                    <option value="">All Workers</option>
                    {[...new Set(workers.map(w => w.name))].sort().map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    SKU
                  </label>
                  <input 
                    className="form-input" 
                    style={{ fontSize: '12px' }}
                    placeholder="SKU name..."
                    value={deadStockFilters.sku_name}
                    onChange={e => setDeadStockFilters(p => ({ ...p, sku_name: e.target.value }))}
                  />
                </div>
                
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    From Date
                  </label>
                  <input 
                    className="form-input" 
                    type="date"
                    style={{ fontSize: '12px' }}
                    value={deadStockFilters.date_from}
                    onChange={e => setDeadStockFilters(p => ({ ...p, date_from: e.target.value }))}
                  />
                </div>
                
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    To Date
                  </label>
                  <input 
                    className="form-input" 
                    type="date"
                    style={{ fontSize: '12px' }}
                    value={deadStockFilters.date_to}
                    onChange={e => setDeadStockFilters(p => ({ ...p, date_to: e.target.value }))}
                  />
                </div>
                
                <button 
                  className="btn btn-primary" 
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                  onClick={() => fetchDeadStockHistory(deadStockFilters)}
                >
                  Apply Filters
                </button>
                
                <button 
                  className="btn btn-outline" 
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                  onClick={() => {
                    setDeadStockFilters({ worker_name: '', sku_name: '', date_from: '', date_to: '' })
                    fetchDeadStockHistory({})
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            {loadingDeadStock ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <div className="loading" />
                <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Loading dead stock history...</p>
              </div>
            ) : deadStockHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <MdAssignmentReturn size={48} style={{ color: 'var(--text-secondary)', marginBottom: 16 }} />
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                  No dead stock items found
                </p>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Dead Stock ID</th>
                      <th>Order ID</th>
                      <th>SKU Name</th>
                      <th>Color</th>
                      <th>Quantity</th>
                      <th>From Worker</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deadStockHistory.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {new Date(item.created_at).toLocaleDateString('en-GB')}
                        </td>
                        <td style={{ fontSize: 12, fontFamily: 'monospace' }}>
                          {item.dead_stock_id}
                        </td>
                        <td style={{ fontSize: 12, fontFamily: 'monospace' }}>
                          {item.order_id || '—'}
                        </td>
                        <td><strong>{item.sku_name}</strong></td>
                        <td>{item.color || '—'}</td>
                        <td>
                          <span style={{ 
                            backgroundColor: '#fee2e2', 
                            color: '#dc2626', 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            fontSize: '11px', 
                            fontWeight: 600 
                          }}>
                            {item.quantity}
                          </span>
                        </td>
                        <td>{item.from_worker}</td>
                        <td>
                          <span style={{ 
                            backgroundColor: '#fef3c7', 
                            color: '#92400e', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontSize: '11px',
                            display: 'inline-block',
                            maxWidth: '150px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }} title={item.reason}>
                            {item.reason || 'No reason'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Return Modal */}
      {modal === 'return' && (
        <Modal title="Return/Defective Item" onClose={close}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>
            <MdWarning size={16} /> {error}
          </div>}
          
          <FormRow label="From Worker" required>
            <input className="form-input" value={returnForm.from_entity} disabled />
          </FormRow>

          <FormRow label="Order ID" required>
            <input className="form-input" value={returnForm.order_id} disabled />
          </FormRow>

          <FormRow label="SKU Name" required>
            <select 
              className="form-input" 
              value={returnForm.sku_name}
              onChange={e => {
                const sku = e.target.value
                const colors = getSKUColors(sku)
                setReturnForm(p => ({
                  ...p,
                  sku_name: sku,
                  color: colors.length === 1 ? colors[0] : ''
                }))
              }}
            >
              <option value="">Select SKU...</option>
              {getWorkerSKUs().map(sku => (
                <option key={sku} value={sku}>{sku}</option>
              ))}
            </select>
          </FormRow>

          {returnForm.sku_name && (
            <FormRow label="Color" required>
              <select 
                className="form-input" 
                value={returnForm.color}
                onChange={e => setReturnForm(p => ({ ...p, color: e.target.value }))}
              >
                <option value="">Select color...</option>
                {getSKUColors(returnForm.sku_name).map(color => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
            </FormRow>
          )}

          <FormRow label="Total Delivered (max returnable)">
            <input 
              className="form-input" 
              value={getAvailableQuantity(returnForm.sku_name, returnForm.color)} 
              disabled 
            />
          </FormRow>

          <FormRow label="Return Quantity" required>
            <input 
              className="form-input" 
              type="number" 
              min="1" 
              max={getAvailableQuantity(returnForm.sku_name, returnForm.color)}
              value={returnForm.quantity}
              onChange={e => setReturnForm(p => ({ ...p, quantity: e.target.value }))}
            />
          </FormRow>

          <FormRow label="Return To" required>
            <select 
              className="form-input" 
              value={returnForm.to_entity}
              onChange={e => setReturnForm(p => ({ ...p, to_entity: e.target.value }))}
            >
              <option value="">Select destination...</option>
              <option value="company">Company (Dead Stock)</option>
              {suppliers.map(s => (
                <option key={s.supplier_id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </FormRow>

          <FormRow label="Reason">
            <input 
              className="form-input" 
              placeholder="e.g. Defective, Wrong color, Mistake"
              value={returnForm.reason}
              onChange={e => setReturnForm(p => ({ ...p, reason: e.target.value }))}
            />
          </FormRow>

          <FormRow label="Date">
            <input 
              className="form-input" 
              type="date" 
              value={returnForm.date}
              onChange={e => setReturnForm(p => ({ ...p, date: e.target.value }))}
            />
          </FormRow>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%' }}
            onClick={handleReturn} 
            disabled={submitting}
          >
            {submitting ? 'Processing...' : 'Confirm Return'}
          </button>
        </Modal>
      )}
    </div>
  )
}

export default ReturnDefective
