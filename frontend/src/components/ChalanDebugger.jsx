import { useState, useEffect } from 'react'
import { MdTimeline, MdSearch, MdError, MdCheckCircle, MdArrowForward, MdInfo, MdQrCode, MdArrowBack, MdLayers, MdPerson } from 'react-icons/md'
import { apiFetch } from '../config'
import { Badge, STAGE_LABELS, STAGE_COLORS } from './production/helpers'

function ChalanDebugger() {
  const [orders, setOrders] = useState([])
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [searchChalan, setSearchChalan] = useState('')
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
        setSelectedSkuKey('')
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
      return <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '11px' }}>None</span>
    }
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {Object.entries(holdingsObj).map(([entity, qty]) => {
          const isNegative = qty < 0;
          let entityLabel = entity;
          let bgColor = isNegative ? '#fee2e2' : '#d1fae5';
          let textColor = isNegative ? '#991b1b' : '#065f46';

          if (entity === 'company') {
            entityLabel = isNegative ? 'Company (Outflow)' : 'Company (In Hand)';
          } else {
            entityLabel = `${entity} (In Hand)`;
          }

          return (
            <span key={entity} style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: bgColor,
              color: textColor,
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 500
            }}>
              {entityLabel}: <strong>{qty} pcs</strong>
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 16px' }}>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0, fontSize: '20px' }}>
          <MdTimeline size={24} style={{ color: 'var(--primary-color)' }} />
          Chalan Debugger & Audit Tool
        </h1>
      </div>

      {/* Select / Search Section */}
      <div className="card" style={{ padding: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <label className="form-label" style={{ fontWeight: 600, marginBottom: 4, display: 'block', fontSize: '12px' }}>Select Order / Chalan</label>
            <select
              className="form-input"
              value={selectedOrderId}
              onChange={e => {
                setSelectedOrderId(e.target.value)
                setSearchChalan('')
              }}
              disabled={ordersLoading}
              style={{ padding: '6px 10px', fontSize: '13px' }}
            >
              <option value="">Choose an order...</option>
              {orders.map(o => (
                <option key={o.order_id} value={o.order_id}>
                  {o.order_id} (Chalan #{o.chalan_number || '—'}) — {o.supplier_name || 'No Supplier'}
                </option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: '180px' }}>
            <form onSubmit={handleChalanSearch} style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontWeight: 600, marginBottom: 4, display: 'block', fontSize: '12px' }}>Search Chalan Number</label>
                <input
                  type="text"
                  placeholder="e.g. 538"
                  className="form-input"
                  value={searchChalan}
                  onChange={e => setSearchChalan(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '13px' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', fontSize: '13px' }}>
                <MdSearch size={16} /> Search
              </button>
            </form>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: '13px' }}>
          <MdError size={18} /> {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <div className="loading" />
          <p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: '12px' }}>Gathering diagnostics...</p>
        </div>
      )}

      {data && !loading && (
        <div>
          {/* Chalan Overview Stats */}
          <div className="card" style={{ padding: 12, marginBottom: 16, borderLeft: '4px solid var(--primary-color)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Chalan / Order ID</span>
                <div style={{ fontSize: '13px', fontWeight: 700, marginTop: 2 }}>
                  {data.order_id} {data.chalan_number ? <span style={{ color: '#dc2626' }}>[Chalan #{data.chalan_number}]</span> : ''}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Supplier Name</span>
                <div style={{ fontSize: '13px', fontWeight: 600, marginTop: 2 }}>{data.supplier_name || '—'}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Order Status</span>
                <div style={{ marginTop: 2 }}>
                  <Badge text={data.status || 'unknown'} color={data.status === 'completed' ? 'success' : 'warning'} />
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Created Date</span>
                <div style={{ fontSize: '13px', marginTop: 2 }}>
                  {data.created_at ? new Date(data.created_at).toLocaleDateString() : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* SKU Select Dropdown */}
          <div className="card" style={{ padding: 10, marginBottom: 16, backgroundColor: '#f9fafb', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label className="form-label" style={{ fontWeight: 600, margin: 0, fontSize: '12px' }}>
                Select SKU:
              </label>
              <select
                className="form-input"
                value={selectedSkuKey}
                onChange={e => setSelectedSkuKey(e.target.value)}
                style={{ width: '220px', padding: '4px 8px', fontSize: '12px' }}
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
              // Extract unique entities involved in this SKU flow
              const uniqueEntities = [...new Set(flow.steps.flatMap(s => [s.from_entity, s.to_entity]))].filter(Boolean).sort()
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label className="form-label" style={{ fontWeight: 600, margin: 0, fontSize: '12px' }}>
                    Audit Person:
                  </label>
                  <select
                    className="form-input"
                    value={selectedPerson}
                    onChange={e => setSelectedPerson(e.target.value)}
                    style={{ width: '220px', padding: '4px 8px', fontSize: '12px' }}
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
            /* ── VIEW ALL SKUs IN CHALAN ── */
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MdLayers size={16} style={{ color: 'var(--primary-color)' }} />
                  SKUs List in this Chalan
                </h3>
              </div>
              <div className="table-container">
                <table className="table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>SKU Name</th>
                      <th>Color</th>
                      <th>Ordered Qty</th>
                      <th>Fabric</th>
                      <th>Status</th>
                      <th>Barcodes</th>
                      <th style={{ width: '100px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.sku_flows).map(([key, flow]) => (
                      <tr key={key}>
                        <td><strong>{flow.sku_name}</strong></td>
                        <td>{flow.color || 'No Color'}</td>
                        <td>{flow.ordered_quantity} pcs</td>
                        <td>{flow.fabric_type || '—'}</td>
                        <td>
                          <Badge text={flow.status || 'unknown'} color={flow.status === 'completed' ? 'success' : 'warning'} />
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: flow.barcode_count > 0 ? 'var(--success-color)' : 'inherit' }}>
                            <MdQrCode size={14} /> {flow.barcode_count} generated
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setSelectedSkuKey(key)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', fontSize: '11px' }}
                          >
                            Trace <MdArrowForward size={12} />
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

              // Filter steps if selectedPerson is chosen
              const filteredSteps = selectedPerson
                ? flow.steps.filter(s => s.from_entity === selectedPerson || s.to_entity === selectedPerson)
                : flow.steps

              // Calculate summary stats for the selected person
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* SKU Stats Card */}
                  <div className="card" style={{ padding: 10, backgroundColor: '#fef3c7', border: '1px solid #f59e0b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>
                          Trace: {flow.sku_name} {flow.color ? `(${flow.color})` : ''}
                        </h4>
                        <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '11px', color: '#78350f' }}>
                          <span>Fabric: <strong>{flow.fabric_type || '—'}</strong></span>
                          <span>MRP: <strong>₹{flow.mrp || '—'}</strong></span>
                          <span>Ordered: <strong>{flow.ordered_quantity} pcs</strong></span>
                          <span>Barcodes: <strong>{flow.barcode_count}</strong></span>
                        </div>
                      </div>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setSelectedSkuKey('')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', padding: '3px 8px', fontSize: '11px' }}
                      >
                        <MdArrowBack size={14} /> Back
                      </button>
                    </div>
                  </div>

                  {/* Selected Person Summary Audit */}
                  {selectedPerson && personSummary && (
                    <div className="card" style={{ padding: 10, backgroundColor: '#f0fdf4', border: '1px solid #86efac' }}>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MdPerson size={16} /> Audit for {selectedPerson}
                      </h4>
                      <div style={{ display: 'flex', gap: 24, fontSize: '12px' }}>
                        <div>Received (Inflow): <strong style={{ color: '#166534' }}>{personSummary.inflow} pcs</strong></div>
                        <div>Sent (Outflow): <strong style={{ color: '#b45309' }}>{personSummary.outflow} pcs</strong></div>
                        <div>Current Remaining: <strong style={{ color: '#1e3a8a', fontSize: '13px' }}>{personSummary.balance} pcs</strong></div>
                      </div>
                    </div>
                  )}

                  {/* Train-Stop Horizontal Journey Map */}
                  <div className="card" style={{ padding: 12 }}>
                    <div style={{ marginBottom: 12 }}>
                      <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MdTimeline size={18} style={{ color: 'var(--primary-color)' }} />
                        SKU Flow Map (Stops & Arrow Flow)
                      </h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Shows step-by-step path of inventory. Bubbles show who received the goods. Arrows show how many pieces moved.
                      </p>
                    </div>

                    {filteredSteps && filteredSteps.length > 0 ? (
                      <div>
                        {/* The horizontal station track */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '12px 8px',
                          backgroundColor: '#f8fafc',
                          padding: '16px 12px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          justifyContent: 'flex-start'
                        }}>
                          {/* Starting Point station */}
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '6px 12px',
                            backgroundColor: '#f8fafc',
                            border: '2px solid #64748b',
                            borderRadius: '8px',
                            minWidth: '105px',
                            textAlign: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                          }}>
                            <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Location</span>
                            <strong style={{ fontSize: '13px', color: '#1e293b', marginTop: 2 }}>{filteredSteps[0].from_entity}</strong>
                          </div>

                          {/* Render each step connection and stop */}
                          {filteredSteps.map((step, idx) => {
                            const isHome = step.to_entity === 'company';
                            const isSupplier = idx === 0;

                            // Dynamic color configs for stations
                            let stationBg = '#f0fdfa'; // default worker teal
                            let stationBorder = '#0d9488';
                            let stationText = '#0f766e';
                            let stationLabel = `Worker (Stop #${idx + 1})`;

                            if (isHome) {
                              stationBg = '#f0fdf4'; // home green
                              stationBorder = '#22c55e';
                              stationText = '#15803d';
                              stationLabel = 'Home (Received)';
                            } else if (isSupplier) {
                              stationBg = '#fff7ed'; // supplier orange
                              stationBorder = '#f97316';
                              stationText = '#c2410c';
                              stationLabel = 'Supplier';
                            }

                            // Dynamic colors for quantity pills based on stage
                            let pillBg = '#4f46e5'; // default indigo
                            let badgeBg = '#f3e8ff';
                            let badgeText = '#6b21a8';

                            if (step.stage === 'cloth_received') {
                              pillBg = '#0284c7'; // sky blue
                              badgeBg = '#e0f2fe';
                              badgeText = '#0369a1';
                            } else if (step.stage === 'job_assigned' || step.stage === 'assigned') {
                              pillBg = '#d97706'; // amber orange
                              badgeBg = '#fef3c7';
                              badgeText = '#b45309';
                            } else if (step.stage === 'transferred') {
                              pillBg = '#8b5cf6'; // violet
                              badgeBg = '#f3e8ff';
                              badgeText = '#6b21a8';
                            } else if (step.stage === 'final_received') {
                              pillBg = '#16a34a'; // emerald green
                              badgeBg = '#d1fae5';
                              badgeText = '#065f46';
                            }

                            return (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {/* Arrow & movement details */}
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  minWidth: '100px',
                                  position: 'relative'
                                }}>
                                  {/* Qty in stage-specific bubble */}
                                  <span style={{
                                    backgroundColor: pillBg,
                                    color: '#fff',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    boxShadow: `0 2px 4px ${pillBg}40`,
                                    zIndex: 2
                                  }}>
                                    {step.quantity} pcs
                                  </span>

                                  {/* Action badge under the qty */}
                                  <span style={{
                                    fontSize: '9px',
                                    color: badgeText,
                                    fontWeight: 700,
                                    marginTop: '3px',
                                    backgroundColor: badgeBg,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.02em'
                                  }}>
                                    {STAGE_LABELS[step.stage] || step.stage}
                                  </span>

                                  {/* Connector Line */}
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    width: '100%',
                                    marginTop: '4px'
                                  }}>
                                    <div style={{ flex: 1, height: '2px', backgroundColor: '#94a3b8' }} />
                                    <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: -4, marginTop: -5 }}>▶</span>
                                  </div>
                                </div>

                                {/* Station Bubble (To Entity) */}
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  padding: '6px 12px',
                                  backgroundColor: stationBg,
                                  color: stationText,
                                  border: `2px solid ${stationBorder}`,
                                  borderRadius: '8px',
                                  minWidth: '110px',
                                  textAlign: 'center',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                }}>
                                  <span style={{ fontSize: '9px', fontWeight: 700, color: stationBorder, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {stationLabel}
                                  </span>
                                  <strong style={{ fontSize: '13px', marginTop: 2 }}>{step.to_entity}</strong>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Summary metadata (Dates and Notes) in a compact list below */}
                        <div style={{ marginTop: 12, backgroundColor: '#f9fafb', borderRadius: '6px', padding: '8px 12px', border: '1px solid #f3f4f6' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                            Station Log & Comments:
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {filteredSteps.map((step, idx) => (
                              <div key={idx} style={{ fontSize: '11.5px', color: '#4b5563', display: 'flex', justifyContent: 'space-between', borderBottom: idx < filteredSteps.length - 1 ? '1px solid #f3f4f6' : 'none', paddingBottom: 2, marginBottom: 2 }}>
                                <span>
                                  <strong>Stop #{idx + 1} ({step.to_entity}):</strong> {step.notes ? `"${step.notes}"` : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No comment</span>}
                                </span>
                                <span style={{ color: '#9ca3af', fontSize: '10px' }}>
                                  {step.created_at ? new Date(step.created_at).toLocaleString() : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Stock Balance after the entire flow */}
                        <div style={{ marginTop: 12 }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                            Active Stock Remaining Right Now:
                          </span>
                          {renderHoldings(filteredSteps[filteredSteps.length - 1].holdings_after_step)}
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        No movements trace found.
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
