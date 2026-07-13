import { useState, useEffect } from 'react'
import { MdArrowBack, MdCheckCircle, MdSchedule, MdHistory, MdClose } from 'react-icons/md'
import { apiFetch } from '../../config'
import { Badge, STAGE_LABELS, STAGE_COLORS } from './helpers'
import styles from './WorkerDetail.module.css'

function WorkerDetail({ worker, onBack }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [filterOrder, setFilterOrder] = useState(null) // { order_id, chalan_number }
  const [fullLogOpen, setFullLogOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    setData(null)
    setFilterOrder(null)
    setFullLogOpen(false)
    apiFetch(`/api/production/workers/${encodeURIComponent(worker.name)}/history`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [worker.name])

  // --- helpers ---
  const renderActivityRow = (e, i, _chalan) => (
    <div key={i} className={styles.activityRow}>
      <div className={styles.activityDot} style={{ background: STAGE_COLORS[e.stage] || '#94a3b8' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          {e.sku_name}
          {e.color && <span style={{ fontSize: 10, color: '#6366f1', background: '#eef2ff', padding: '1px 6px', borderRadius: 4 }}>{e.color}</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.from_entity}</span>
          <span style={{ color: '#6366f1', fontWeight: 800, fontSize: 13, lineHeight: 1 }}>→</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.to_entity}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{e.quantity} pcs</div>
        <Badge text={STAGE_LABELS[e.stage] || e.stage} color={STAGE_COLORS[e.stage]} />
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
          {e.ledger_number_int ? <span style={{ color: '#6366f1', marginRight: 6 }}>#{e.ledger_number_int}</span> : null}
          {new Date(e.created_at).toLocaleDateString('en-GB')}
        </div>
      </div>
    </div>
  )

  return (
    <div className={styles.page}>
      {/* Back header */}
      <div className={styles.pageHeader}>
        <button className={styles.backBtn} onClick={onBack}>
          <MdArrowBack size={18} /> Back to Workers
        </button>
        <div className={styles.workerTitle}>
          <div className={styles.avatar}>{worker.name[0].toUpperCase()}</div>
          <div>
            <div className={styles.workerName}>{worker.name}</div>
            <div className={styles.workerSub}>{worker.work_type}</div>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div className="loading" />
          <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>Loading worker history...</p>
        </div>
      )}
      {error && <div className="alert alert-danger">{error}</div>}

      {data && (() => {
        // Build orderMap: order_id → chalan_number (from holdings + completed)
        const orderMap = {}
        ;[...data.current_holdings, ...data.completed_skus].forEach(h => {
          if (h.order_id) orderMap[h.order_id] = h.chalan_number || ''
        })
        // Also pull order_id from activity (may have orders not in holdings)
        data.activity.forEach(e => {
          if (e.order_id && !(e.order_id in orderMap)) orderMap[e.order_id] = ''
        })

        // Sorted order list by chalan number ascending
        const orderedIds = Object.entries(orderMap)
          .sort((a, b) => (Number(a[1]) || 0) - (Number(b[1]) || 0))
          .map(([oid]) => oid)

        // Apply filter
        const activeIds = filterOrder ? [filterOrder.order_id] : orderedIds

        // Group helpers
        const holdingsByOrder = {}
        const completedByOrder = {}
        const activityByOrder = {}
        orderedIds.forEach(oid => {
          holdingsByOrder[oid]  = data.current_holdings.filter(h => h.order_id === oid)
          completedByOrder[oid] = data.completed_skus.filter(h => h.order_id === oid)
          activityByOrder[oid]  = data.activity.filter(e => e.order_id === oid)
        })

        const chalanHeader = (oid) => {
          const ch = orderMap[oid]
          return (
            <div className={styles.chalanHeader}>
              <span className={styles.chalanBadge}>{ch ? `# ${ch}` : oid}</span>
              {ch && <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 6 }}>{oid}</span>}
            </div>
          )
        }

        return (
          <div>
            {/* Stats */}
            <div className={styles.statsRow}>
              <div className={styles.statCard}>
                <div className={styles.statVal} style={{ color: '#f59e0b' }}>{data.total_pieces_current}</div>
                <div className={styles.statLabel}>Currently Holding</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statVal} style={{ color: '#10b981' }}>{data.total_pieces_completed}</div>
                <div className={styles.statLabel}>Pieces Completed</div>
              </div>
            </div>

            {/* Chalan filter chips */}
            {orderedIds.length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                {orderedIds.map(oid => {
                  const chalan = orderMap[oid]
                  const active = filterOrder?.order_id === oid
                  return (
                    <button key={oid}
                      onClick={() => setFilterOrder(active ? null : { order_id: oid, chalan_number: chalan })}
                      style={{
                        fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                        cursor: 'pointer', border: '1.5px solid #dc2626',
                        background: active ? '#dc2626' : 'transparent',
                        color: active ? '#fff' : '#dc2626',
                        display: 'flex', alignItems: 'center', gap: 4
                      }}>
                      {chalan ? `# ${chalan}` : oid}
                      {active && <MdClose size={12} />}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Current Work In-Hand — grouped by chalan */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <MdSchedule size={16} /> Current Work In-Hand
              </div>
              {activeIds.some(oid => holdingsByOrder[oid]?.length > 0) ? (
                activeIds.map(oid => {
                  const items = holdingsByOrder[oid] || []
                  if (!items.length) return null
                  return (
                    <div key={oid} className={styles.chalanGroup}>
                      {chalanHeader(oid)}
                      <div className={styles.holdingTable}>
                        {items.map((h, i) => (
                          <div key={i} className={styles.holdingRow}>
                            <span className={styles.skuPill}>{h.sku_name}</span>
                            {h.color && <span style={{ fontSize: 11, color: '#6366f1', background: '#eef2ff', padding: '2px 8px', borderRadius: 4, marginLeft: 6 }}>{h.color}</span>}
                            <div style={{ flex: 1 }} />
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 12 }}>
                              Received: {h.total_received} · Forwarded: {h.total_sent}
                            </span>
                            <span className="badge badge-warning">{h.quantity} pcs</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0' }}>
                  {filterOrder ? 'No pieces in hand for this order.' : 'No pieces currently in hand.'}
                </p>
              )}
            </div>

            {/* Completed Work — grouped by chalan */}
            {activeIds.some(oid => completedByOrder[oid]?.length > 0) && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  <MdCheckCircle size={16} style={{ color: '#10b981' }} /> Completed Work (Past)
                </div>
                {activeIds.map(oid => {
                  const items = completedByOrder[oid] || []
                  if (!items.length) return null
                  return (
                    <div key={oid} className={styles.chalanGroup}>
                      {chalanHeader(oid)}
                      <div className={styles.holdingTable}>
                        {items.map((c, i) => (
                          <div key={i} className={styles.holdingRow}>
                            <span className={styles.skuPill}>{c.sku_name}</span>
                            {c.color && <span style={{ fontSize: 11, color: '#10b981', background: '#ecfdf5', padding: '2px 8px', borderRadius: 4, marginLeft: 6 }}>{c.color}</span>}
                            <div style={{ flex: 1 }} />
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 12 }}>
                              {c.total_received} pcs · {c.last_date ? new Date(c.last_date).toLocaleDateString('en-GB') : ''}
                            </span>
                            <span className="badge badge-success">Done</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Full Activity Log — collapsible, grouped by chalan */}
            <div className={styles.section}>
              <button onClick={() => setFullLogOpen(p => !p)} className={styles.collapseBtn}>
                <div className={styles.sectionTitle} style={{ margin: 0, flex: 1 }}>
                  <MdHistory size={16} /> {filterOrder ? `Activity Log — Chalan #${filterOrder.chalan_number || filterOrder.order_id}` : 'Full Activity Log'}
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 6 }}>
                    ({activeIds.reduce((s, oid) => s + (activityByOrder[oid]?.length || 0), 0)})
                  </span>
                </div>
                <span style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1 }}>{fullLogOpen ? '▲' : '▼'}</span>
              </button>
              {fullLogOpen && (
                <div style={{ marginTop: 8 }}>
                  {activeIds.some(oid => activityByOrder[oid]?.length > 0) ? (
                    activeIds.map(oid => {
                      const entries = activityByOrder[oid] || []
                      if (!entries.length) return null
                      return (
                        <div key={oid} className={styles.chalanGroup}>
                          {chalanHeader(oid)}
                          <div className={styles.activityLog}>
                            {entries.map((e, i) => renderActivityRow(e, i, orderMap[e.order_id]))}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0' }}>No activity yet.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default WorkerDetail
