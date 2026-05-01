import { useState, useEffect, useCallback } from 'react'
import { MdRefresh, MdArrowForward, MdArrowDownward, MdCheckCircle,
         MdSchedule, MdSearch, MdQrCode2, MdBuild, MdSwapHoriz, MdAssignment } from 'react-icons/md'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../config'
import styles from './ProductionTracker.module.css'

const STAGES = [
  { key: 'ordered',        label: 'Cloth Ordered',      icon: '📦', color: '#6366f1' },
  { key: 'received',       label: 'Cloth Received',     icon: '✅', color: '#0ea5e9' },
  { key: 'job_work',       label: 'Job Work',           icon: '🧵', color: '#f59e0b' },
  { key: 'additional_work',label: 'Additional Work',    icon: '💎', color: '#8b5cf6' },
  { key: 'final_received', label: 'Final Received',     icon: '🏭', color: '#10b981' },
  { key: 'barcode',        label: 'Barcode Generated',  icon: '🏷️', color: '#059669' },
]

function StatusPill({ done, pending, label }) {
  return (
    <span className={done ? styles.pillDone : styles.pillPending}>
      {done ? <MdCheckCircle size={12} /> : <MdSchedule size={12} />}
      {label}
    </span>
  )
}

function StageBlock({ icon, label, color, children, done }) {
  return (
    <div className={`${styles.stageBlock} ${!done ? styles.stagePending : ''}`}>
      <div className={styles.stageIcon} style={{ background: done ? color : '#e2e8f0', color: done ? 'white' : '#94a3b8' }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div className={styles.stageContent}>
        <div className={styles.stageLabel} style={{ color: done ? color : '#94a3b8' }}>{label}</div>
        {done ? children : <div className={styles.stageEmpty}>Not yet</div>}
      </div>
    </div>
  )
}

function StageConnector({ done }) {
  return (
    <div className={styles.connector}>
      <div className={styles.connectorLine} style={{ background: done ? '#6366f1' : '#e2e8f0' }} />
      <MdArrowDownward size={14} style={{ color: done ? '#6366f1' : '#e2e8f0', flexShrink: 0 }} />
    </div>
  )
}

function SkuTracker({ sku, ledger }) {
  const navigate = useNavigate()

  const skuLedger = ledger.filter(e => e.sku_name === sku.sku_name)
  const clothReceived = skuLedger.filter(e => e.stage === 'cloth_received')
  const jobAssigned   = skuLedger.filter(e => e.stage === 'job_assigned')
  const transferred   = skuLedger.filter(e => e.stage === 'transferred')
  const finalReceived = skuLedger.filter(e => e.stage === 'final_received')

  const totalOrdered       = sku.total_ordered
  const totalReceived      = clothReceived.reduce((s, e) => s + e.quantity, 0)
  const totalJobWork       = jobAssigned.reduce((s, e) => s + e.quantity, 0)
  const totalAdditional    = transferred.reduce((s, e) => s + e.quantity, 0)
  const totalFinalReceived = finalReceived.reduce((s, e) => s + e.quantity, 0)

  const pct = (n, d) => d > 0 ? Math.min(100, Math.round((n / d) * 100)) : 0

  const overallStatus =
    totalFinalReceived >= totalOrdered ? 'completed' :
    totalJobWork > 0 ? 'in_work' :
    totalReceived > 0 ? 'received' : 'ordered'

  const statusColor = { completed: '#10b981', in_work: '#f59e0b', received: '#0ea5e9', ordered: '#6366f1' }
  const statusLabel = { completed: 'Completed', in_work: 'In Work', received: 'Received', ordered: 'Ordered' }

  return (
    <div className={styles.skuCard}>
      {/* SKU Header */}
      <div className={styles.skuHeader}>
        <div>
          <div className={styles.skuName}>{sku.sku_name}</div>
          <div className={styles.skuMeta}>
            {sku.supplier_name && <span>Supplier: {sku.supplier_name}</span>}
            <span>Order: {sku.order_id}</span>
            <span>{new Date(sku.order_date).toLocaleDateString()}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={styles.statusBadge} style={{ background: statusColor[overallStatus] }}>
            {statusLabel[overallStatus]}
          </span>
          <div className={styles.progressRing}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>
              {pct(totalFinalReceived, totalOrdered)}%
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${pct(totalFinalReceived, totalOrdered)}%` }} />
      </div>

      {/* Timeline */}
      <div className={styles.timeline}>
        {/* 1. Ordered */}
        <StageBlock icon="📦" label="Cloth Ordered" color="#6366f1" done>
          <div className={styles.stageInfo}>
            <span className={styles.qty}>{totalOrdered} pcs</span>
            <span className={styles.date}>{new Date(sku.order_date).toLocaleDateString()}</span>
          </div>
        </StageBlock>

        <StageConnector done={totalReceived > 0} />

        {/* 2. Cloth Received */}
        <StageBlock icon="✅" label="Cloth Received" color="#0ea5e9" done={totalReceived > 0}>
          {clothReceived.map((e, i) => (
            <div key={i} className={styles.entryRow}>
              <span className={styles.qty}>{e.quantity} pcs</span>
              <span className={styles.date}>{new Date(e.created_at).toLocaleDateString()}</span>
              {totalReceived < totalOrdered && (
                <span className={styles.shortfall}>({totalOrdered - totalReceived} short)</span>
              )}
            </div>
          ))}
        </StageBlock>

        <StageConnector done={totalJobWork > 0} />

        {/* 3. Job Work */}
        <StageBlock icon="🧵" label="Job Work" color="#f59e0b" done={totalJobWork > 0}>
          {jobAssigned.map((e, i) => (
            <div key={i} className={styles.workerEntry}>
              <div className={styles.workerAvatar}>{e.to_entity[0].toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div className={styles.workerName}>{e.to_entity}</div>
                <div className={styles.workerMeta}>{e.work_type}</div>
              </div>
              <span className={styles.qty}>{e.quantity} pcs</span>
              <span className={styles.date}>{new Date(e.created_at).toLocaleDateString()}</span>
            </div>
          ))}
          {totalJobWork > 0 && totalJobWork < totalReceived && (
            <div className={styles.remaining}>⚠ {totalReceived - totalJobWork} pcs still with company</div>
          )}
        </StageBlock>

        {transferred.length > 0 && (
          <>
            <StageConnector done />
            {/* 4. Additional Work */}
            <StageBlock icon="💎" label="Additional Work" color="#8b5cf6" done>
              {transferred.map((e, i) => (
                <div key={i} className={styles.workerEntry}>
                  <div className={styles.workerAvatar} style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1)' }}>{e.to_entity[0].toUpperCase()}</div>
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

        <StageConnector done={totalFinalReceived > 0} />

        {/* 5. Final Received */}
        <StageBlock icon="🏭" label="Final Received" color="#10b981" done={totalFinalReceived > 0}>
          {finalReceived.map((e, i) => (
            <div key={i} className={styles.entryRow}>
              <span className={styles.qty}>{e.quantity} pcs</span>
              <span className={styles.date}>{new Date(e.created_at).toLocaleDateString()}</span>
            </div>
          ))}
          {totalFinalReceived > 0 && totalFinalReceived < totalJobWork && (
            <div className={styles.remaining}>⚠ {totalJobWork - totalFinalReceived} pcs still with workers</div>
          )}
        </StageBlock>

        <StageConnector done={totalFinalReceived > 0} />

        {/* 6. Barcode */}
        <StageBlock icon="🏷️" label="Barcode Generated" color="#059669" done={false}>
          {totalFinalReceived > 0 ? (
            <button className={styles.barcodeBtn}
              onClick={() => navigate(`/generator?sku_name=${encodeURIComponent(sku.sku_name)}&quantity=${totalFinalReceived}&mrp=${sku.mrp || 0}`)}>
              <MdQrCode2 size={15} /> Generate {totalFinalReceived} Barcodes
            </button>
          ) : (
            <div className={styles.stageEmpty}>Complete previous steps first</div>
          )}
        </StageBlock>
      </div>
    </div>
  )
}

function ProductionTracker() {
  const [orders, setOrders]   = useState([])
  const [ledger, setLedger]   = useState([])
  const [loading, setLoading] = useState(true)
  const [searchParams]        = useSearchParams()
  const [search, setSearch]   = useState(searchParams.get('sku') || '')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [oR, lR] = await Promise.all([
        apiFetch('/api/production/orders'),
        apiFetch('/api/production/ledger?limit=200'),
      ])
      const [o, l] = await Promise.all([oR.json(), lR.json()])
      setOrders(Array.isArray(o) ? o : [])
      setLedger(Array.isArray(l) ? l : [])
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
      quantity_received: item.quantity_received,
      mrp:           item.mrp || 0,
    }))
  )

  const filtered = skuRows.filter(s =>
    s.sku_name.toLowerCase().includes(search.toLowerCase()) ||
    s.order_id.toLowerCase().includes(search.toLowerCase())
  )

  const fromSku = searchParams.get('sku')

  return (
    <div>
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Production Tracker
          </h1>
          <p className={styles.heroSub}>
            Complete journey of every SKU — from cloth order to barcode generation
          </p>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>{skuRows.length}</span>
              <span className={styles.heroStatLabel}>Total SKUs</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>{orders.length}</span>
              <span className={styles.heroStatLabel}>Orders</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>{ledger.length}</span>
              <span className={styles.heroStatLabel}>Movements</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Refresh */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <MdSearch size={18} style={{ color: 'var(--text-secondary)' }} />
          <input className={styles.searchInput} placeholder="Search by SKU or Order ID..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-outline" onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MdRefresh size={17} /> Refresh
        </button>
      </div>

      {fromSku && search && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          padding: '10px 16px', background: 'rgba(99,102,241,0.08)',
          borderRadius: 10, border: '1px solid rgba(99,102,241,0.2)', fontSize: 13
        }}>
          <span>Showing journey for: <strong>{fromSku}</strong></span>
          <button onClick={() => setSearch('')} style={{
            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--primary-color)', fontSize: 12, fontWeight: 600
          }}>✕ Clear filter</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64 }}>
          <div className="loading" />
          <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Loading tracker data...</p>
        </div>
      ) : filtered.length > 0 ? (
        filtered.map((sku, i) => (
          <SkuTracker key={`${sku.order_id}-${sku.sku_name}-${i}`} sku={sku} ledger={ledger} />
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
