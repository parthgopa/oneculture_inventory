import { useState, useEffect } from 'react'
import { MdBook, MdFilterList, MdSearch, MdClear, MdCalendarToday } from 'react-icons/md'
import { apiFetch } from '../config'
import { Badge, Modal, STAGE_LABELS, STAGE_COLORS } from './production/helpers'
import styles from './production/AdditionalWork.module.css'

function GeneralLedger() {
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [search, setSearch] = useState('')
  const [orderFilter, setOrderFilter] = useState('')
  const [skuFilter, setSkuFilter] = useState('')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [ledgerNum, setLedgerNum] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    fetchLedger()
  }, [])

  const fetchLedger = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/production/ledger')
      const data = await res.json()
      setLedger(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setOrderFilter('')
    setSkuFilter('')
    setFromFilter('')
    setToFilter('')
    setDateFrom('')
    setDateTo('')
    setLedgerNum('')
  }

  // Apply filters
  const filtered = ledger.filter(e => {
    // Basic search (across multiple fields)
    if (search) {
      const s = search.toLowerCase()
      const matches = (
        (e.sku_name || '').toLowerCase().includes(s) ||
        (e.order_id || '').toLowerCase().includes(s) ||
        (e.from_entity || '').toLowerCase().includes(s) ||
        (e.to_entity || '').toLowerCase().includes(s) ||
        String(e.ledger_number_int || '').includes(s)
      )
      if (!matches) return false
    }

    // Advanced filters
    if (orderFilter && !(e.order_id || '').toLowerCase().includes(orderFilter.toLowerCase())) return false
    if (skuFilter && !(e.sku_name || '').toLowerCase().includes(skuFilter.toLowerCase())) return false
    if (fromFilter && !(e.from_entity || '').toLowerCase().includes(fromFilter.toLowerCase())) return false
    if (toFilter && !(e.to_entity || '').toLowerCase().includes(toFilter.toLowerCase())) return false
    if (ledgerNum && String(e.ledger_number_int || '') !== ledgerNum) return false

    // Date range
    if (dateFrom || dateTo) {
      const entryDate = e.created_at ? new Date(e.created_at) : null
      if (!entryDate) return false
      if (dateFrom && entryDate < new Date(dateFrom)) return false
      if (dateTo) {
        const endDate = new Date(dateTo)
        endDate.setHours(23, 59, 59)
        if (entryDate > endDate) return false
      }
    }

    return true
  })

  // Get unique values for dropdowns
  const uniqueOrders = [...new Set(ledger.map(e => e.order_id).filter(Boolean))].sort()
  const uniqueSkus = [...new Set(ledger.map(e => e.sku_name).filter(Boolean))].sort()
  const uniqueFrom = [...new Set(ledger.map(e => e.from_entity).filter(Boolean))].sort()
  const uniqueTo = [...new Set(ledger.map(e => e.to_entity).filter(Boolean))].sort()

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <MdBook size={28} /> General Ledger
        </h1>
      </div>

      {/* Basic Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 12px' }}>
              <MdSearch size={18} color="var(--text-secondary)" />
              <input
                type="text"
                placeholder="Search by SKU, Order, Entity, Ledger #..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 14 }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <MdClear size={16} />
                </button>
              )}
            </div>
          </div>

          <button
            className="btn btn-outline"
            onClick={() => setShowAdvanced(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <MdFilterList size={16} /> Advanced
          </button>

          {(search || orderFilter || skuFilter || fromFilter || toFilter || dateFrom || dateTo || ledgerNum) && (
            <button className="btn btn-outline" onClick={clearFilters} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
              <MdClear size={16} /> Clear
            </button>
          )}
        </div>

        {/* Active filter pills */}
        {(orderFilter || skuFilter || fromFilter || toFilter || dateFrom || dateTo || ledgerNum) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
            {ledgerNum && <span className="badge badge-primary">Ledger #: {ledgerNum}</span>}
            {orderFilter && <span className="badge badge-primary">Order: {orderFilter}</span>}
            {skuFilter && <span className="badge badge-primary">SKU: {skuFilter}</span>}
            {fromFilter && <span className="badge badge-primary">From: {fromFilter}</span>}
            {toFilter && <span className="badge badge-primary">To: {toFilter}</span>}
            {(dateFrom || dateTo) && (
              <span className="badge badge-primary">
                <MdCalendarToday size={12} style={{ marginRight: 4 }} />
                {dateFrom || '...'} to {dateTo || '...'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Results count */}
      <div style={{ marginBottom: 12, color: 'var(--text-secondary)', fontSize: 14 }}>
        Showing {filtered.length} of {ledger.length} entries
      </div>

      {/* Ledger Table */}
      <div className="card">
        {loading ? (
          <div className="empty-state" style={{ padding: 60 }}>
            <div className="loading" />
            <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Loading ledger...</p>
          </div>
        ) : error ? (
          <div className="alert alert-danger" style={{ margin: 20 }}>{error}</div>
        ) : filtered.length > 0 ? (
          <div className="table-container" style={{ maxHeight: 'calc(100vh - 300px)', overflow: 'auto' }}>
            <table className="table">
              <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
                <tr>
                  <th>#</th>
                  <th>Order ID</th>
                  <th>Stage</th>
                  <th>SKU</th>
                  <th>From → To</th>
                  <th>Qty</th>
                  <th>Work Type</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={i} style={{ background: e.stage === 'revert_source' ? 'rgba(107,114,128,0.06)' : 'transparent' }}>
                    <td style={{ fontSize: 11, textAlign: 'center' }}>
                      {e.ledger_number_int || '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>{e.order_id || '—'}</td>
                    <td><Badge text={STAGE_LABELS[e.stage] || e.stage} color={STAGE_COLORS[e.stage] || '#6b7280'} /></td>
                    <td>
                      <strong style={{ textDecoration: e.stage === 'revert_source' ? 'line-through' : 'none', opacity: e.stage === 'revert_source' ? 0.55 : 1 }}>
                        {e.sku_name}
                      </strong>
                      {e.color && <span style={{ fontSize: 10, color: '#6366f1', marginLeft: 4 }}>({e.color})</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <span style={{ color: 'var(--text-secondary)', textDecoration: e.stage === 'revert_source' ? 'line-through' : 'none', opacity: e.stage === 'revert_source' ? 0.55 : 1 }}>
                        {e.from_entity}
                      </span>
                      <span style={{ margin: '0 4px', color: '#6366f1' }}>→</span>
                      <span style={{ fontWeight: 600, textDecoration: e.stage === 'revert_source' ? 'line-through' : 'none', opacity: e.stage === 'revert_source' ? 0.55 : 1 }}>
                        {e.to_entity}
                      </span>
                    </td>
                    <td><span className="badge badge-primary">{e.quantity}</span></td>
                    <td style={{ fontSize: 12 }}>{e.work_type || '—'}</td>
                    <td style={{ fontSize: 12 }}>{e.created_at ? new Date(e.created_at).toLocaleDateString('en-GB') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 60 }}>
            <div className="empty-state-icon"><MdBook size={52} /></div>
            <div className="empty-state-title">No ledger entries found</div>
            <div className="empty-state-description">
              {ledger.length > 0 ? 'Try adjusting your filters' : 'Start by creating cloth orders and assigning work'}
            </div>
          </div>
        )}
      </div>

      {/* Advanced Filters Modal */}
      {showAdvanced && (
        <Modal title="Advanced Filters" onClose={() => setShowAdvanced(false)} width={500}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="form-label">Ledger Number</label>
              <input
                type="number"
                className="form-input"
                placeholder="e.g. 1, 2, 3..."
                value={ledgerNum}
                onChange={e => setLedgerNum(e.target.value)}
                list="ledger-nums"
              />
              <datalist id="ledger-nums">
                {[...new Set(ledger.map(e => e.ledger_number_int).filter(Boolean))].sort((a,b)=>a-b).map(n => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="form-label">Order ID</label>
              <input
                className="form-input"
                placeholder="Filter by order..."
                value={orderFilter}
                onChange={e => setOrderFilter(e.target.value)}
                list="order-ids"
              />
              <datalist id="order-ids">
                {uniqueOrders.map(o => <option key={o} value={o} />)}
              </datalist>
            </div>

            <div>
              <label className="form-label">SKU Name</label>
              <input
                className="form-input"
                placeholder="Filter by SKU..."
                value={skuFilter}
                onChange={e => setSkuFilter(e.target.value)}
                list="sku-names"
              />
              <datalist id="sku-names">
                {uniqueSkus.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="form-label">From Entity</label>
                <input
                  className="form-input"
                  placeholder="From..."
                  value={fromFilter}
                  onChange={e => setFromFilter(e.target.value)}
                  list="from-entities"
                />
                <datalist id="from-entities">
                  {uniqueFrom.map(f => <option key={f} value={f} />)}
                </datalist>
              </div>
              <div>
                <label className="form-label">To Entity</label>
                <input
                  className="form-input"
                  placeholder="To..."
                  value={toFilter}
                  onChange={e => setToFilter(e.target.value)}
                  list="to-entities"
                />
                <datalist id="to-entities">
                  {uniqueTo.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="form-label">Date From</label>
                <input
                  type="date"
                  className="form-input"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Date To</label>
                <input
                  type="date"
                  className="form-input"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowAdvanced(false)}>
                Apply Filters
              </button>
              <button className="btn btn-outline" onClick={clearFilters} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
                Clear All
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default GeneralLedger
