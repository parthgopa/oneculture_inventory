import { useState, useEffect, useCallback } from 'react'
import {
  MdRefresh, MdArrowDownward, MdCheckCircle, MdSchedule, MdSearch,
  MdQrCode2, MdAssignment, MdExpandMore, MdExpandLess, MdInventory2,
  MdPeople, MdAutorenew, MdWarehouse, MdLocalShipping, MdOpenInNew,
  MdClose, MdFiberManualRecord, MdUndo
} from 'react-icons/md'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../config'
import styles from './ProductionTracker.module.css'

// ── Stage icon map using react-icons ─────────────────────────────────────────
function StageIconEl({ stage, size = 18 }) {
  const map = {
    ordered:               <MdLocalShipping size={size} />,
    received:              <MdInventory2 size={size} />,
    job_work:              <MdPeople size={size} />,
    additional_work:       <MdAutorenew size={size} />,
    returned_to_supplier:  <MdUndo size={size} />,
    final_received:        <MdWarehouse size={size} />,
    barcode:               <MdQrCode2 size={size} />,
  }
  return map[stage] || <MdFiberManualRecord size={size} />
}

// ── Stage Block ───────────────────────────────────────────────────────────────
function StageBlock({ stage, label, color, children, done }) {
  return (
    <div className={`${styles.stageBlock} ${!done ? styles.stagePending : ''}`}>
      <div className={styles.stageIcon}
        style={{ background: done ? color : '#e2e8f0', color: done ? 'white' : '#94a3b8' }}>
        <StageIconEl stage={stage} size={18} />
      </div>
      <div className={styles.stageContent}>
        <div className={styles.stageLabel} style={{ color: done ? color : '#94a3b8' }}>{label}</div>
        {done ? children : <div className={styles.stageEmpty}>Not started yet</div>}
      </div>
    </div>
  )
}

// ── Stage Connector ───────────────────────────────────────────────────────────
function StageConnector({ done }) {
  const c = done ? 'var(--primary-color)' : '#e2e8f0'
  return (
    <div className={styles.connector}>
      <div className={styles.connectorLine} style={{ background: c }} />
      <MdArrowDownward size={14} style={{ color: c, flexShrink: 0 }} />
    </div>
  )
}

// ── SKU Tracker Card ──────────────────────────────────────────────────────────
function SkuTracker({ sku, ledger, batches }) {
  const navigate   = useNavigate()
  const [open, setOpen] = useState(false)

  const skuLedger          = ledger.filter(e => e.sku_name === sku.sku_name)
  const clothReceived      = skuLedger.filter(e => e.stage === 'cloth_received')
  const jobAssigned        = skuLedger.filter(e => e.stage === 'job_assigned')
  const transferred        = skuLedger.filter(e => e.stage === 'transferred')
  const returnedEntries    = skuLedger.filter(e => e.stage === 'returned_to_supplier')
  const finalReceived      = skuLedger.filter(e => e.stage === 'final_received')

  // Barcode batches for this SKU
  const skuBatches = batches.filter(b =>
    b.sku_name?.toLowerCase() === sku.sku_name?.toLowerCase()
  )
  const totalBarcoded = skuBatches.reduce((s, b) => s + (b.quantity || 0), 0)

  const totalOrdered       = sku.total_ordered
  const totalReceived      = clothReceived.reduce((s, e) => s + e.quantity, 0)
  const totalJobWork       = jobAssigned.reduce((s, e) => s + e.quantity, 0)
  const totalReturned      = returnedEntries.reduce((s, e) => s + e.quantity, 0)
  const totalFinalReceived = finalReceived.reduce((s, e) => s + e.quantity, 0)

  const pct = (n, d) => d > 0 ? Math.min(100, Math.round((n / d) * 100)) : 0

  const overallStatus =
    totalBarcoded >= totalOrdered ? 'completed' :
    totalFinalReceived > 0       ? 'final'      :
    totalJobWork > 0             ? 'in_work'    :
    totalReceived > 0            ? 'received'   : 'ordered'

  const STATUS_META = {
    completed: { label: 'Completed',     color: '#10b981' },
    final:     { label: 'Final Rcvd',    color: '#059669' },
    in_work:   { label: 'In Work',       color: '#f59e0b' },
    received:  { label: 'Cloth Rcvd',    color: '#0ea5e9' },
    ordered:   { label: 'Ordered',       color: 'var(--primary-color)' },
  }
  const { label: statusLabel, color: statusColor } = STATUS_META[overallStatus]

  // Quick-glance pipeline chips for the collapsed header
  const chips = [
    { label: `${totalOrdered} ordered`,          done: true },
    { label: `${totalReceived} with supplier`,    done: totalReceived > 0 },
    { label: `${totalJobWork} in job work`,       done: totalJobWork > 0 },
    ...(totalReturned > 0 ? [{ label: `${totalReturned} returned`, done: true }] : []),
    { label: `${totalFinalReceived} final rcvd`,  done: totalFinalReceived > 0 },
    { label: `${totalBarcoded} barcoded`,         done: totalBarcoded > 0 },
  ]

  return (
    <div className={styles.skuCard}>
      {/* ── Clickable Header ── */}
      <div className={styles.skuHeader} onClick={() => setOpen(o => !o)}
        style={{ cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className={styles.skuName}>{sku.sku_name}</div>
            <span className={styles.statusBadge} style={{ background: statusColor }}>
              {statusLabel}
            </span>
          </div>
          <div className={styles.skuMeta}>
            {sku.supplier_name && <span>Supplier: {sku.supplier_name}</span>}
            <span>Order: {sku.order_id}</span>
            <span>{new Date(sku.order_date).toLocaleDateString()}</span>
            {sku.mrp > 0 && <span>MRP: ₹{sku.mrp}</span>}
          </div>
          {/* Pipeline chips — visible when collapsed */}
          {!open && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {chips.map((c, i) => (
                <span key={i} style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                  background: c.done ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                  color: c.done ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
                  border: `1px solid ${c.done ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'}`,
                }}>
                  {c.done && <MdCheckCircle size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />}
                  {c.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div className={styles.progressRing}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>
              {pct(totalFinalReceived, totalOrdered)}%
            </span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)' }}>
            {open ? <MdExpandLess size={22} /> : <MdExpandMore size={22} />}
          </div>
        </div>
      </div>

      {/* ── Progress Bar ── */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${pct(totalFinalReceived, totalOrdered)}%` }} />
      </div>

      {/* ── Collapsible Timeline ── */}
      {open && (
        <div className={styles.timeline}>

          {/* 1. Cloth Ordered */}
          <StageBlock stage="ordered" label="Cloth Ordered" color="var(--primary-color)" done>
            <div className={styles.stageInfo}>
              <span className={styles.qty}>{totalOrdered} pcs</span>
              <span className={styles.date}>{new Date(sku.order_date).toLocaleDateString()}</span>
            </div>
          </StageBlock>

          <StageConnector done={totalReceived > 0} />

          {/* 2. With Supplier */}
          <StageBlock stage="received" label="With Supplier" color="#0ea5e9" done={totalReceived > 0}>
            {clothReceived.map((e, i) => (
              <div key={i} className={styles.entryRow}>
                <span className={styles.qty}>{e.quantity} pcs</span>
                <span className={styles.date}>{new Date(e.created_at).toLocaleDateString()}</span>
                <span className={styles.supplier}>{e.to_entity}</span>
                {totalReceived < totalOrdered && (
                  <span className={styles.shortfall}>{totalOrdered - totalReceived} short</span>
                )}
              </div>
            ))}
          </StageBlock>

          <StageConnector done={totalJobWork > 0} />

          {/* 3. Job Work */}
          <StageBlock stage="job_work" label="Job Work" color="#f59e0b" done={totalJobWork > 0}>
            {jobAssigned.map((e, i) => (
              <div key={i} className={styles.workerEntry}>
                <div className={styles.workerAvatar}>{(e.to_entity || '?')[0].toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div className={styles.workerName}>{e.to_entity}</div>
                  <div className={styles.workerMeta}>{e.work_type}</div>
                </div>
                <span className={styles.qty}>{e.quantity} pcs</span>
                <span className={styles.date}>{new Date(e.created_at).toLocaleDateString()}</span>
              </div>
            ))}
            {totalJobWork > 0 && totalJobWork < totalReceived && (
              <div className={styles.remaining}>
                <MdSchedule size={13} /> {totalReceived - totalJobWork} pcs still with company
              </div>
            )}
          </StageBlock>

          {transferred.length > 0 && (
            <>
              <StageConnector done />
              {/* 4. Additional Work */}
              <StageBlock stage="additional_work" label="Additional Work" color="#8b5cf6" done>
                {transferred.map((e, i) => (
                  <div key={i} className={styles.workerEntry}>
                    <div className={styles.workerAvatar} style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1)' }}>
                      {(e.to_entity || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className={styles.workerName}>{e.from_entity} → {e.to_entity}</div>
                      <div className={styles.workerMeta}>{e.work_type}</div>
                    </div>
                    <span className={styles.qty}>{e.quantity} pcs</span>
                    <span className={styles.date}>{new Date(e.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </StageBlock>
            </>
          )}

          {returnedEntries.length > 0 && (
            <>
              <StageConnector done />
              {/* Return to Supplier */}
              <StageBlock stage="returned_to_supplier" label="Returned to Supplier" color="#ef4444" done>
                {returnedEntries.map((e, i) => (
                  <div key={i} className={styles.workerEntry}>
                    <div className={styles.workerAvatar} style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
                      <MdUndo size={14} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className={styles.workerName}>{e.from_entity} → {e.to_entity}</div>
                      <div className={styles.workerMeta}>{e.notes || 'Returned'}</div>
                    </div>
                    <span className={styles.qty}>{e.quantity} pcs</span>
                    <span className={styles.date}>{new Date(e.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
                <div className={styles.remaining} style={{ color: '#ef4444' }}>
                  <MdUndo size={13} /> {totalReturned} pcs returned to supplier
                </div>
              </StageBlock>
            </>
          )}

          <StageConnector done={totalFinalReceived > 0} />

          {/* 5. Final Received */}
          <StageBlock stage="final_received" label="Final Received" color="#10b981" done={totalFinalReceived > 0}>
            {finalReceived.map((e, i) => (
              <div key={i} className={styles.entryRow}>
                <span className={styles.qty}>{e.quantity} pcs</span>
                <span className={styles.date}>{new Date(e.created_at).toLocaleDateString()}</span>
              </div>
            ))}
            {totalFinalReceived > 0 && totalFinalReceived < totalJobWork && (
              <div className={styles.remaining}>
                <MdSchedule size={13} /> {totalJobWork - totalFinalReceived} pcs still with workers
              </div>
            )}
          </StageBlock>

          <StageConnector done={totalBarcoded > 0} />

          {/* 6. Barcode */}
          <StageBlock stage="barcode" label="Barcode Generated" color="#059669" done={totalBarcoded > 0}>
            {skuBatches.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {skuBatches.map((b, i) => (
                  <div key={i} className={styles.workerEntry}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/batch/${b.batch_id}`)}>
                    <div className={styles.workerAvatar} style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}>
                      <MdQrCode2 size={14} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className={styles.workerName}>
                        <code style={{ fontSize: 11 }}>{b.batch_id}</code>
                      </div>
                      <div className={styles.workerMeta}>
                        {b.quantity} barcodes · {new Date(b.created_at).toLocaleDateString()}
                        {b.size && ` · Size: ${b.size}`}
                      </div>
                    </div>
                    <MdOpenInNew size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                  </div>
                ))}
                {totalFinalReceived > totalBarcoded && (
                  <button className={styles.barcodeBtn}
                    onClick={() => navigate(`/generator?sku_name=${encodeURIComponent(sku.sku_name)}&quantity=${totalFinalReceived - totalBarcoded}&mrp=${sku.mrp || 0}`)}>
                    <MdQrCode2 size={15} /> Generate {totalFinalReceived - totalBarcoded} more
                  </button>
                )}
              </div>
            ) : totalFinalReceived > 0 ? (
              <button className={styles.barcodeBtn}
                onClick={() => navigate(`/generator?sku_name=${encodeURIComponent(sku.sku_name)}&quantity=${totalFinalReceived}&mrp=${sku.mrp || 0}`)}>
                <MdQrCode2 size={15} /> Generate {totalFinalReceived} Barcodes
              </button>
            ) : (
              <div className={styles.stageEmpty}>Complete previous steps first</div>
            )}
          </StageBlock>

        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
function ProductionTracker() {
  const [orders,  setOrders]  = useState([])
  const [ledger,  setLedger]  = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchParams]        = useSearchParams()
  const [search, setSearch]   = useState(searchParams.get('sku') || '')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [oR, lR, bR] = await Promise.all([
        apiFetch('/api/production/orders'),
        apiFetch('/api/production/ledger?limit=500'),
        apiFetch('/api/barcode-batches'),
      ])
      const [o, l, b] = await Promise.all([oR.json(), lR.json(), bR.json()])
      setOrders(Array.isArray(o) ? o : [])
      setLedger(Array.isArray(l) ? l : [])
      setBatches(Array.isArray(b) ? b : [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Flatten orders → per-item SKU rows
  const skuRows = orders.flatMap(order =>
    (order.items || []).map(item => ({
      sku_name:      item.sku_name,
      order_id:      order.order_id,
      supplier_name: order.supplier_name,
      order_date:    order.created_at,
      total_ordered: item.quantity_ordered,
      mrp:           item.mrp || 0,
    }))
  )

  const filtered = skuRows.filter(s =>
    s.sku_name.toLowerCase().includes(search.toLowerCase()) ||
    s.order_id.toLowerCase().includes(search.toLowerCase())
  )

  const fromSku = searchParams.get('sku')

  // Summary counts for hero
  const totalBarcoded = batches.reduce((s, b) => s + (b.quantity || 0), 0)

  return (
    <div>
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>Production Tracker</h1>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>{skuRows.length}</span>
              <span className={styles.heroStatLabel}>SKUs</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>{orders.length}</span>
              <span className={styles.heroStatLabel}>Orders</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>{ledger.length}</span>
              <span className={styles.heroStatLabel}>Movements</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>{batches.length}</span>
              <span className={styles.heroStatLabel}>Batches</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>{totalBarcoded}</span>
              <span className={styles.heroStatLabel}>Barcoded</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Refresh */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <MdSearch size={18} style={{ color: 'var(--text-secondary)' }} />
          <input className={styles.searchInput} placeholder="Search by SKU or Order ID…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-outline" onClick={fetchData}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MdRefresh size={17} /> Refresh
        </button>
      </div>

      {fromSku && search && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          padding: '10px 16px', background: 'rgba(232,73,13,0.07)',
          borderRadius: 10, border: '1px solid rgba(232,73,13,0.2)', fontSize: 13
        }}>
          <span>Showing journey for: <strong>{fromSku}</strong></span>
          <button onClick={() => setSearch('')} style={{
            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--primary-color)', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 3
          }}>
            <MdClose size={14} /> Clear filter
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64 }}>
          <div className="loading" />
          <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Loading tracker data…</p>
        </div>
      ) : filtered.length > 0 ? (
        filtered.map((sku, i) => (
          <SkuTracker
            key={`${sku.order_id}-${sku.sku_name}-${i}`}
            sku={sku}
            ledger={ledger}
            batches={batches}
          />
        ))
      ) : (
        <div className="card">
          <div className="empty-state" style={{ padding: 64 }}>
            <div className="empty-state-icon"><MdAssignment size={56} /></div>
            <div className="empty-state-title">{search ? 'No matching SKUs' : 'No production data yet'}</div>
            <div className="empty-state-description">Create a cloth order in Production to start tracking</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductionTracker
