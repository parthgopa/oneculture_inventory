import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MdTimeline,
  MdSearch,
  MdError,
  MdCheckCircle,
  MdArrowForward,
  MdInfo,
  MdQrCode,
  MdArrowBack,
  MdLayers,
  MdPerson,
  MdBugReport
} from 'react-icons/md'
import { apiFetch } from '../config'
import { Badge, STAGE_LABELS, STAGE_COLORS } from './production/helpers'
import styles from './ChalanDebugger.module.css'

function ChalanDebugger() {
  const [searchParams] = useSearchParams()
  const queryChalan = searchParams.get('chalan') || searchParams.get('chalan_number')
  const queryOrderId = searchParams.get('order_id')
  const querySku = searchParams.get('sku') || searchParams.get('sku_name')
  const queryColor = searchParams.get('color')

  const [orders, setOrders] = useState([])
  const [selectedOrderId, setSelectedOrderId] = useState(queryOrderId || '')
  const [searchChalan, setSearchChalan] = useState(queryChalan || '')
  const [loading, setLoading] = useState(false)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [selectedSkuKey, setSelectedSkuKey] = useState('') // Format: "sku_name|color"
  const [selectedPerson, setSelectedPerson] = useState('')

  // Load all cloth orders on mount
  useEffect(() => {
    setOrdersLoading(true)
    apiFetch('/api/production/orders')
      .then(res => res.json())
      .then(data => {
        setOrders(Array.isArray(data) ? data : [])
      })
      .catch(err => {
        console.error('Failed to load orders:', err)
      })
      .finally(() => {
        setOrdersLoading(false)
      })
  }, [])

  // Auto-fetch if query param present on mount
  useEffect(() => {
    if (queryChalan) {
      setSearchChalan(queryChalan)
      setLoading(true)
      setError(null)
      setData(null)
      setSelectedOrderId('')
      setSelectedSkuKey('')

      apiFetch(`/api/production/chalan-debug-sku-flow?chalan_number=${encodeURIComponent(queryChalan.trim())}`)
        .then(async res => {
          const payload = await res.json()
          if (!res.ok) throw new Error(payload.error || 'Chalan not found')
          setData(payload)
          setSelectedOrderId(payload.order_id)
          // Auto-select SKU if provided in URL
          if (querySku && payload.sku_flows) {
            const matchedKey = Object.keys(payload.sku_flows).find(k => {
              const flow = payload.sku_flows[k]
              const skuMatch = flow.sku_name.toLowerCase() === querySku.toLowerCase()
              const colorMatch = !queryColor || (flow.color && flow.color.toLowerCase() === queryColor.toLowerCase())
              return skuMatch && colorMatch
            }) || Object.keys(payload.sku_flows).find(k => {
              const flow = payload.sku_flows[k]
              return flow.sku_name.toLowerCase() === querySku.toLowerCase()
            })
            if (matchedKey) setSelectedSkuKey(matchedKey)
          }
        })
        .catch(err => {
          setError(err.message)
        })
        .finally(() => {
          setLoading(false)
        })
    } else if (queryOrderId) {
      setSelectedOrderId(queryOrderId)
    }
  }, [queryChalan, queryOrderId, querySku, queryColor])

  // Fetch debug info when selectedOrderId changes
  useEffect(() => {
    if (!selectedOrderId) {
      setData(null)
      setSelectedSkuKey('')
      return
    }

    setLoading(true)
    setError(null)
    apiFetch(`/api/production/chalan-debug-sku-flow?order_id=${encodeURIComponent(selectedOrderId)}`)
      .then(async res => {
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || 'Failed to fetch debug data')
        setData(payload)
        if (querySku && payload.sku_flows) {
          const matchedKey = Object.keys(payload.sku_flows).find(k => {
            const flow = payload.sku_flows[k]
            const skuMatch = flow.sku_name.toLowerCase() === querySku.toLowerCase()
            const colorMatch = !queryColor || (flow.color && flow.color.toLowerCase() === queryColor.toLowerCase())
            return skuMatch && colorMatch
          }) || Object.keys(payload.sku_flows).find(k => {
            const flow = payload.sku_flows[k]
            return flow.sku_name.toLowerCase() === querySku.toLowerCase()
          })
          setSelectedSkuKey(matchedKey || '')
        } else {
          setSelectedSkuKey('')
        }
      })
      .catch(err => {
        setError(err.message)
        setData(null)
        setSelectedSkuKey('')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [selectedOrderId])

  // Handle manual chalan number search
  const handleChalanSearch = (e) => {
    e.preventDefault()
    if (!searchChalan.trim()) return

    setLoading(true)
    setError(null)
    setData(null)
    setSelectedOrderId('')
    setSelectedSkuKey('')

    apiFetch(`/api/production/chalan-debug-sku-flow?chalan_number=${encodeURIComponent(searchChalan.trim())}`)
      .then(async res => {
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || 'Chalan not found')
        setData(payload)
        setSelectedOrderId(payload.order_id)
      })
      .catch(err => {
        setError(err.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  // Reset selected person when SKU changes
  useEffect(() => {
    setSelectedPerson('')
  }, [selectedSkuKey])

  // Helper to format entities' holdings
  const renderHoldings = (holdingsObj) => {
    if (!holdingsObj || Object.keys(holdingsObj).length === 0) {
      return <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '13px' }}>None</span>
    }
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {Object.entries(holdingsObj).map(([entity, qty]) => {
          const isNegative = qty < 0
          let entityLabel = entity
          let bgColor = isNegative ? '#fee2e2' : '#d1fae5'
          let textColor = isNegative ? '#991b1b' : '#065f46'

          if (entity === 'company') {
            entityLabel = isNegative ? 'Company (Outflow)' : 'Company (In Hand)'
          } else {
            entityLabel = `${entity} (In Hand)`
          }

          return (
            <span
              key={entity}
              className={styles.holdingBadge}
              style={{
                backgroundColor: bgColor,
                color: textColor,
                border: `1px solid ${isNegative ? '#fca5a5' : '#a7f3d0'}`
              }}
            >
              {entityLabel}:&nbsp;<strong>{qty} pcs</strong>
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          <MdBugReport size={30} style={{ color: 'var(--primary-color)' }} />
          Chalan Tracker & Audit Tool
        </h1>
        <p className={styles.pageSubtitle}>
          Complete end-to-end trace of physical inventory movements, worker handovers, and piece conservation per chalan.
        </p>
      </div>

      {/* Select / Search Section */}
      <div className={styles.controlCard}>
        <div className={styles.controlRow}>
          <div className={styles.controlGroup} style={{ flex: 2 }}>
            <label className={styles.controlLabel}>Select Order / Chalan</label>
            <select
              className={styles.selectInput}
              value={selectedOrderId}
              onChange={e => {
                setSelectedOrderId(e.target.value)
                setSearchChalan('')
              }}
              disabled={ordersLoading}
            >
              <option value="">Choose an order / chalan...</option>
              {orders.map(o => (
                <option key={o.order_id} value={o.order_id}>
                  {o.order_id} (Chalan #{o.chalan_number || '—'}) — {o.supplier_name || 'No Supplier'}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.controlGroup} style={{ flex: 1, minWidth: '240px' }}>
            <form onSubmit={handleChalanSearch} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label className={styles.controlLabel}>Search Chalan #</label>
                <input
                  type="text"
                  placeholder="e.g. 538"
                  className={styles.textInput}
                  value={searchChalan}
                  onChange={e => setSearchChalan(e.target.value)}
                />
              </div>
              <button type="submit" className={`btn btn-primary ${styles.searchBtn}`}>
                <MdSearch size={18} /> Search
              </button>
            </form>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', fontSize: '14px' }}>
          <MdError size={20} /> {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="loading" style={{ width: 40, height: 40 }} />
          <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 600 }}>Gathering live diagnostics and entity balances...</p>
        </div>
      )}

      {data && !loading && (
        <div>
          {/* Chalan Overview Stats */}
          <div className={styles.statsCard}>
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Chalan / Order ID</span>
                <div className={styles.statValue}>
                  {data.order_id}
                  {data.chalan_number ? <span className={styles.chalanBadge}>[Chalan #{data.chalan_number}]</span> : ''}
                </div>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Supplier Name</span>
                <div className={styles.statValue}>{data.supplier_name || '—'}</div>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Order Status</span>
                <div style={{ marginTop: 2 }}>
                  <Badge text={data.status || 'unknown'} color={data.status === 'completed' ? 'success' : 'warning'} />
                </div>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Created Date</span>
                <div className={styles.statValue}>
                  {data.created_at ? new Date(data.created_at).toLocaleDateString() : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* SKU Select & Audit Toolbar */}
          <div className={styles.toolbarCard}>
            <div className={styles.toolbarGroup}>
              <label className={styles.toolbarLabel}>Select SKU:</label>
              <select
                className={styles.toolbarSelect}
                value={selectedSkuKey}
                onChange={e => setSelectedSkuKey(e.target.value)}
              >
                <option value="">-- View all SKUs in Chalan --</option>
                {Object.keys(data.sku_flows).sort().map(key => {
                  const flow = data.sku_flows[key]
                  return (
                    <option key={key} value={key}>
                      {flow.sku_name} {flow.color ? `(${flow.color})` : ''}
                    </option>
                  )
                })}
              </select>
            </div>

            {selectedSkuKey && (() => {
              const flow = data.sku_flows[selectedSkuKey]
              if (!flow || !flow.steps) return null
              const uniqueEntities = [...new Set(flow.steps.flatMap(s => [s.from_entity, s.to_entity]))].filter(Boolean).sort()
              return (
                <div className={styles.toolbarGroup}>
                  <label className={styles.toolbarLabel}>Audit Person:</label>
                  <select
                    className={styles.toolbarSelect}
                    value={selectedPerson}
                    onChange={e => setSelectedPerson(e.target.value)}
                  >
                    <option value="">-- View all movements --</option>
                    {uniqueEntities.map(ent => (
                      <option key={ent} value={ent}>{ent}</option>
                    ))}
                  </select>
                </div>
              )
            })()}
          </div>

          {!selectedSkuKey ? (
            /* ── VIEW ALL SKUs IN CHALAN TABLE ── */
            <div className={styles.allSkusCard}>
              <div className={styles.allSkusHeader}>
                <h3 className={styles.allSkusTitle}>
                  <MdLayers size={20} style={{ color: 'var(--primary-color)' }} />
                  SKUs List in this Chalan
                </h3>
              </div>
              <div className="table-container">
                <table className={styles.allSkusTable}>
                  <thead>
                    <tr>
                      <th>SKU Name</th>
                      <th>Color</th>
                      <th>Ordered Qty</th>
                      <th>Fabric</th>
                      <th>Status</th>
                      <th>Barcodes</th>
                      <th style={{ width: '120px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.sku_flows).map(([key, flow]) => (
                      <tr key={key}>
                        <td><strong style={{ fontSize: '15px' }}>{flow.sku_name}</strong></td>
                        <td>{flow.color || 'No Color'}</td>
                        <td><strong style={{ fontSize: '15px' }}>{flow.ordered_quantity} pcs</strong></td>
                        <td>{flow.fabric_type || '—'}</td>
                        <td>
                          <Badge text={flow.status || 'unknown'} color={flow.status === 'completed' ? 'success' : 'warning'} />
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: flow.barcode_count > 0 ? 'var(--success-color)' : 'inherit' }}>
                            <MdQrCode size={16} /> {flow.barcode_count} generated
                          </span>
                        </td>
                        <td>
                          <button
                            className={`btn btn-primary ${styles.traceActionBtn}`}
                            onClick={() => setSelectedSkuKey(key)}
                          >
                            Trace <MdArrowForward size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ── DETAILED GRANULAR SKU FLOW ── */
            (() => {
              const flow = data.sku_flows[selectedSkuKey]
              if (!flow) return null

              const filteredSteps = selectedPerson
                ? flow.steps.filter(s => s.from_entity === selectedPerson || s.to_entity === selectedPerson)
                : flow.steps

              let personSummary = null
              if (selectedPerson) {
                const inflow = flow.steps
                  .filter(s => s.to_entity === selectedPerson)
                  .reduce((sum, s) => sum + s.quantity, 0)
                const outflow = flow.steps
                  .filter(s => s.from_entity === selectedPerson)
                  .reduce((sum, s) => sum + s.quantity, 0)
                personSummary = { inflow, outflow, balance: inflow - outflow }
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* SKU Stats Card */}
                  <div className={styles.traceBanner}>
                    <div className={styles.traceHeader}>
                      <div>
                        <h4 className={styles.traceTitle}>
                          Trace: {flow.sku_name} {flow.color ? `(${flow.color})` : ''}
                        </h4>
                        <div className={styles.traceMetaList}>
                          <span className={styles.traceMetaItem}>Fabric: <strong>{flow.fabric_type || '—'}</strong></span>
                          <span className={styles.traceMetaItem}>MRP: <strong>₹{flow.mrp || '—'}</strong></span>
                          <span className={styles.traceMetaItem}>Ordered: <strong>{flow.ordered_quantity} pcs</strong></span>
                          <span className={styles.traceMetaItem}>Barcodes: <strong>{flow.barcode_count}</strong></span>
                        </div>
                      </div>
                      <button
                        className={styles.backBtn}
                        onClick={() => setSelectedSkuKey('')}
                      >
                        <MdArrowBack size={16} /> Back to SKUs List
                      </button>
                    </div>
                  </div>

                  {/* Selected Person Summary Audit */}
                  {selectedPerson && personSummary && (
                    <div className={styles.personAuditCard}>
                      <h4 className={styles.personAuditTitle}>
                        <MdPerson size={20} /> Movement Summary for {selectedPerson}
                      </h4>
                      <div className={styles.personAuditGrid}>
                        <div>Received (Inflow): <strong style={{ color: '#166534', fontSize: '16px' }}>{personSummary.inflow} pcs</strong></div>
                        <div>Sent (Outflow): <strong style={{ color: '#b45309', fontSize: '16px' }}>{personSummary.outflow} pcs</strong></div>
                        <div>Current Remaining: <strong style={{ color: '#1e3a8a', fontSize: '18px' }}>{personSummary.balance} pcs</strong></div>
                      </div>
                    </div>
                  )}

                  {/* Visual Flow Map */}
                  <div className={styles.flowCard}>
                    <div className={styles.flowHeader}>
                      <h3 className={styles.flowTitle}>
                        <MdTimeline size={22} style={{ color: 'var(--primary-color)' }} />
                        SKU Flow Map (Stops & Material Journey)
                      </h3>
                      <p className={styles.flowSubtitle}>
                        Sequential path of inventory. Bubbles show stations that handled the goods. Arrows indicate quantity moved.
                      </p>
                    </div>

                    {filteredSteps && filteredSteps.length > 0 ? (
                      <div>
                        {/* The Station Track */}
                        <div className={styles.trackContainer}>
                          {/* Starting Point station */}
                          <div className={styles.startStation}>
                            <span className={styles.stationSubLabel} style={{ color: '#64748b' }}>Start Location</span>
                            <strong className={styles.stationName} style={{ color: '#1e293b' }}>{filteredSteps[0].from_entity}</strong>
                          </div>

                          {/* Render each step connection and stop */}
                          {filteredSteps.map((step, idx) => {
                            const isHome = step.to_entity === 'company'
                            const isSupplier = idx === 0

                            let stationBg = '#f0fdfa'
                            let stationBorder = '#0d9488'
                            let stationText = '#0f766e'
                            let stationLabel = `Worker (Stop #${idx + 1})`

                            if (isHome) {
                              stationBg = '#f0fdf4'
                              stationBorder = '#22c55e'
                              stationText = '#15803d'
                              stationLabel = 'Company (Received)'
                            } else if (isSupplier) {
                              stationBg = '#fff7ed'
                              stationBorder = '#f97316'
                              stationText = '#c2410c'
                              stationLabel = 'Supplier'
                            }

                            let pillBg = '#4f46e5'
                            let badgeBg = '#f3e8ff'
                            let badgeText = '#6b21a8'

                            if (step.stage === 'cloth_received') {
                              pillBg = '#0284c7'
                              badgeBg = '#e0f2fe'
                              badgeText = '#0369a1'
                            } else if (step.stage === 'job_assigned' || step.stage === 'assigned') {
                              pillBg = '#d97706'
                              badgeBg = '#fef3c7'
                              badgeText = '#b45309'
                            } else if (step.stage === 'transferred') {
                              pillBg = '#8b5cf6'
                              badgeBg = '#f3e8ff'
                              badgeText = '#6b21a8'
                            } else if (step.stage === 'final_received') {
                              pillBg = '#16a34a'
                              badgeBg = '#d1fae5'
                              badgeText = '#065f46'
                            }

                            return (
                              <div key={idx} className={styles.stepConnection}>
                                {/* Arrow & movement details */}
                                <div className={styles.arrowBlock}>
                                  <span
                                    className={styles.quantityPill}
                                    style={{
                                      backgroundColor: pillBg,
                                      boxShadow: `0 3px 8px ${pillBg}50`
                                    }}
                                  >
                                    {step.quantity} pcs
                                  </span>

                                  <span
                                    className={styles.stageLabel}
                                    style={{
                                      color: badgeText,
                                      backgroundColor: badgeBg
                                    }}
                                  >
                                    {STAGE_LABELS[step.stage] || step.stage}
                                  </span>

                                  {/* Connector Line */}
                                  <div className={styles.arrowLine}>
                                    <div className={styles.lineBar} />
                                    <span className={styles.arrowHead}>▶</span>
                                  </div>
                                </div>

                                {/* Station Bubble (To Entity) */}
                                <div
                                  className={styles.stationBubble}
                                  style={{
                                    backgroundColor: stationBg,
                                    color: stationText,
                                    border: `2.5px solid ${stationBorder}`
                                  }}
                                >
                                  <span
                                    className={styles.stationSubLabel}
                                    style={{ color: stationBorder }}
                                  >
                                    {stationLabel}
                                  </span>
                                  <strong className={styles.stationName}>{step.to_entity}</strong>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Station Logs & Comments */}
                        <div className={styles.logBox}>
                          <span className={styles.logTitle}>
                            Station Log & Audit History:
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {filteredSteps.map((step, idx) => (
                              <div key={idx} className={styles.logRow}>
                                <span>
                                  <strong>Stop #{idx + 1} ({step.to_entity}):</strong> {step.notes ? `"${step.notes}"` : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No comment</span>}
                                </span>
                                <span className={styles.logTimestamp}>
                                  {step.created_at ? new Date(step.created_at).toLocaleString() : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Active Stock Remaining */}
                        <div className={styles.activeStockBox}>
                          <span className={styles.logTitle}>
                            Active Stock Remaining Right Now:
                          </span>
                          {renderHoldings(filteredSteps[filteredSteps.length - 1].holdings_after_step)}
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '15px' }}>
                        No movements trace found for this selection.
                      </div>
                    )}
                  </div>
                </div>
              )
            })()
          )}
        </div>
      )}
    </div>
  )
}

export default ChalanDebugger
