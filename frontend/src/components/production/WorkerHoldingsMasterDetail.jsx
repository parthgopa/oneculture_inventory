import { useState, useMemo } from 'react'
import { MdSearch, MdPeople, MdInventory2 } from 'react-icons/md'
import styles from './WorkerHoldingsMasterDetail.module.css'

export default function WorkerHoldingsMasterDetail({
  workerStock = [],
  workers = [],
  orders = [],
  filterWorkerNames = null,
  emptyTitle = 'No worker holdings found',
  emptyDescription = 'Assign cloth via Job Work or transfers to view holdings here.',
  headerAction = null,
  onItemAction = null,
  itemActionLabel = null,
  itemActionColor = 'var(--primary-color, #6366f1)',
  onChalanAction = null,
  chalanActionLabel = null,
  chalanActionColor = 'var(--primary-color, #6366f1)'
}) {
  const [search, setSearch] = useState('')
  const [selectedWorker, setSelectedWorker] = useState(null)

  // Build lookup maps
  const orderSupplierMap = useMemo(() => {
    const map = {}
    orders.forEach(o => {
      if (o.order_id) map[o.order_id] = o.supplier_name || '—'
    })
    return map
  }, [orders])

  const orderChalanMap = useMemo(() => {
    const map = {}
    orders.forEach(o => {
      if (o.order_id && o.chalan_number) map[o.order_id] = o.chalan_number
    })
    return map
  }, [orders])

  const workerMetaMap = useMemo(() => {
    const map = {}
    workers.forEach(w => {
      if (w.name) map[w.name] = w
    })
    return map
  }, [workers])

  // Group worker stock by worker_name
  const workerGroups = useMemo(() => {
    const groups = {}
    workerStock.forEach(ws => {
      const name = ws.worker_name
      if (!name) return
      if (filterWorkerNames && !filterWorkerNames.has(name)) return

      if (!groups[name]) {
        groups[name] = {
          worker_name: name,
          items: [],
          total_pieces: 0,
          chalans: new Set(),
          order_ids: new Set()
        }
      }

      groups[name].items.push(ws)
      groups[name].total_pieces += Number(ws.quantity || 0)
      if (ws.chalan_number) {
        groups[name].chalans.add(ws.chalan_number)
      } else if (ws.order_id && orderChalanMap[ws.order_id]) {
        groups[name].chalans.add(orderChalanMap[ws.order_id])
      }
      if (ws.order_id) groups[name].order_ids.add(ws.order_id)
    })

    return Object.values(groups).sort((a, b) => b.total_pieces - a.total_pieces)
  }, [workerStock, filterWorkerNames, orderChalanMap])

  // Filtered workers based on search (searches worker name OR chalan number OR sku name)
  const filteredWorkers = useMemo(() => {
    if (!search.trim()) return workerGroups
    const q = search.toLowerCase().trim()
    return workerGroups.filter(w => {
      const nameMatch = w.worker_name.toLowerCase().includes(q)
      const chalanMatch = Array.from(w.chalans).some(c => String(c).includes(q))
      const skuMatch = w.items.some(i => (i.sku_name || '').toLowerCase().includes(q))
      return nameMatch || chalanMatch || skuMatch
    })
  }, [workerGroups, search])

  // Auto-select first worker if none selected or if selected worker is filtered out
  const activeWorkerName = useMemo(() => {
    if (selectedWorker && filteredWorkers.some(w => w.worker_name === selectedWorker)) {
      return selectedWorker
    }
    return filteredWorkers.length > 0 ? filteredWorkers[0].worker_name : null
  }, [selectedWorker, filteredWorkers])

  // Get active worker group data
  const activeGroup = useMemo(() => {
    if (!activeWorkerName) return null
    return workerGroups.find(w => w.worker_name === activeWorkerName) || null
  }, [workerGroups, activeWorkerName])

  // Group active worker items by order_id
  const activeOrdersGrouped = useMemo(() => {
    if (!activeGroup) return []
    const byOrder = {}
    activeGroup.items.forEach(item => {
      const oid = item.order_id || 'Other'
      if (!byOrder[oid]) {
        byOrder[oid] = {
          order_id: oid,
          chalan_number: item.chalan_number || orderChalanMap[oid] || '',
          supplier_name: orderSupplierMap[oid] || '—',
          items: [],
          total_qty: 0
        }
      }
      byOrder[oid].items.push(item)
      byOrder[oid].total_qty += Number(item.quantity || 0)
    })

    return Object.values(byOrder).sort((a, b) => (b.chalan_number || 0) - (a.chalan_number || 0))
  }, [activeGroup, orderChalanMap, orderSupplierMap])

  if (workerGroups.length === 0) {
    return (
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="empty-state" style={{ padding: 40 }}>
          <div className="empty-state-icon"><MdPeople size={52} /></div>
          <div className="empty-state-title">{emptyTitle}</div>
          <div className="empty-state-description">{emptyDescription}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* ── Left Sidebar ────────────────────────────────────────────── */}
      <div className={styles.sidebar}>
        {/* <div className={styles.sidebarHeader}>
          <input
            type="text"
            className={styles.searchBox}
            placeholder="🔍 Search worker or # chalan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div> */}

        <div className={styles.workerList}>
          {filteredWorkers.map(w => {
            const isActive = w.worker_name === activeWorkerName
            const chalansList = Array.from(w.chalans).sort((a, b) => b - a)

            return (
              <div
                key={w.worker_name}
                className={`${styles.workerItem} ${isActive ? styles.workerItemActive : ''}`}
                onClick={() => setSelectedWorker(w.worker_name)}
              >
                <div className={styles.workerItemHeader}>
                  <div className={styles.avatar}>
                    {w.worker_name.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.workerName} title={w.worker_name}>
                    {w.worker_name}
                  </div>
                  <div className={styles.totalBadge}>
                    {w.total_pieces} pcs
                  </div>
                </div>

                {/* Below Worker Name: Current holding Chalan numbers */}
                <div className={styles.chalanPillsRow}>
                  <span className={styles.chalanPillsLabel}>Chalans:</span>
                  {chalansList.length > 0 ? (
                    chalansList.map(chalanNum => (
                      <span key={chalanNum} className={styles.chalanPill}>
                        #{chalanNum}
                      </span>
                    ))
                  ) : (
                    <span className={styles.chalanPillOther}>
                      {w.order_ids.size > 0 ? `${w.order_ids.size} orders` : 'Other'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Right Content / Detail View ─────────────────────────────── */}
      <div className={styles.detailPanel}>
        {activeGroup ? (
          <>
            <div className={styles.detailHeader}>
              <div className={styles.detailWorkerInfo}>
                <div className={styles.largeAvatar}>
                  {activeGroup.worker_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className={styles.detailTitle}>{activeGroup.worker_name}</div>
                  <div className={styles.detailSub}>
                    <span>
                      {workerMetaMap[activeGroup.worker_name]?.work_type
                        ? `Role: ${workerMetaMap[activeGroup.worker_name].work_type}`
                        : 'Worker'}
                    </span>
                    <span>•</span>
                    <span style={{ fontWeight: 700, color: '#b45309' }}>
                      {activeGroup.total_pieces} pieces in hand
                    </span>
                    <span>•</span>
                    <span>
                      {activeGroup.chalans.size > 0
                        ? `${activeGroup.chalans.size} Chalans`
                        : `${activeGroup.order_ids.size} Orders`}
                    </span>
                  </div>
                </div>
              </div>

              {headerAction && (
                <div className={styles.detailActions}>
                  {typeof headerAction === 'function' ? headerAction(activeGroup) : headerAction}
                </div>
              )}
            </div>

            {/* Orders & Chalans List */}
            <div className={styles.chalanGrid}>
              {activeOrdersGrouped.map(ord => (
                <div key={ord.order_id} className={styles.chalanCard}>
                  <div className={styles.chalanCardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {ord.chalan_number && (
                        <span className={styles.chalanTag}>
                          #{ord.chalan_number}
                        </span>
                      )}
                      <span className={styles.orderIdText}>
                        {ord.order_id.startsWith('ORD') ? ord.order_id : 'Direct / Other'}
                      </span>
                      {ord.supplier_name && ord.supplier_name !== '—' && (
                        <span className={styles.supplierText}>
                          ({ord.supplier_name})
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className={styles.chalanPiecesBadge}>
                        {ord.total_qty} pieces
                      </div>
                      {onChalanAction && (
                        <button
                          className="btn btn-outline"
                          style={{
                            fontSize: 11,
                            padding: '3px 10px',
                            fontWeight: 600,
                            borderColor: chalanActionColor,
                            color: chalanActionColor,
                            background: 'white'
                          }}
                          onClick={() => onChalanAction({
                            workerName: activeGroup.worker_name,
                            orderId: ord.order_id,
                            chalanNumber: ord.chalan_number,
                            totalQty: ord.total_qty,
                            bulk: true
                          })}
                        >
                          {chalanActionLabel || 'Transfer Chalan'}
                        </button>
                      )}
                    </div>
                  </div>

                  <table className={styles.itemsTable}>
                    <thead>
                      <tr>
                        <th>SKU Name</th>
                        <th>Color</th>
                        <th style={{ textAlign: 'right' }}>Quantity</th>
                        {onItemAction && <th style={{ textAlign: 'center', width: 110 }}>Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {ord.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className={styles.skuNameCell}>{item.sku_name}</td>
                          <td>
                            {item.color ? (
                              <span className={styles.colorBadge}>{item.color}</span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="badge badge-warning" style={{ fontSize: 12, padding: '3px 8px' }}>
                              {item.quantity}
                            </span>
                          </td>
                          {onItemAction && (
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="btn btn-outline"
                                style={{
                                  fontSize: 11,
                                  padding: '2px 8px',
                                  borderColor: itemActionColor,
                                  color: itemActionColor
                                }}
                                onClick={() => onItemAction({
                                  workerName: activeGroup.worker_name,
                                  orderId: ord.order_id,
                                  chalanNumber: ord.chalan_number,
                                  skuName: item.sku_name,
                                  color: item.color,
                                  quantity: item.quantity
                                })}
                              >
                                {itemActionLabel || 'Select'}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className={styles.emptyStateContainer}>
            <MdInventory2 size={40} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div>Select a worker from the sidebar to view detailed holdings</div>
          </div>
        )}
      </div>
    </div>
  )
}
