import { MdAssignment, MdBuild, MdQrCode2, MdPeople, MdArrowForward } from 'react-icons/md'
import { Badge, STAGE_LABELS, STAGE_COLORS } from './helpers'
import styles from './ProductionOverview.module.css'

function ProductionOverview({ stats, workerStock, ledger, readyItems, setActiveTab }) {

  const grouped = {}
  workerStock.forEach(ws => {
    if (!grouped[ws.worker_name]) grouped[ws.worker_name] = []
    grouped[ws.worker_name].push(ws)
  })

  return (
    <div>
      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
            <MdAssignment size={26} />
          </div>
          <div>
            <div className={styles.statValue}>{stats?.total_orders || 0}</div>
            <div className={styles.statLabel}>Total Orders</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
            <MdBuild size={26} />
          </div>
          <div>
            <div className={styles.statValue}>{stats?.total_in_work || 0}</div>
            <div className={styles.statLabel}>Pieces In Work</div>
            <div className={styles.statSub}>Held by workers</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
            <MdQrCode2 size={26} />
          </div>
          <div>
            <div className={styles.statValue}>{stats?.ready_for_barcode || 0}</div>
            <div className={styles.statLabel}>Ready for Barcode</div>
            <div className={styles.statSub}>Final received</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
            <MdPeople size={26} />
          </div>
          <div>
            <div className={styles.statValue}>{stats?.workers_count || 0}</div>
            <div className={styles.statLabel}>Active Workers</div>
          </div>
        </div>
      </div>

      {/* Ready for Barcode */}
      {readyItems.length > 0 && (
        <div className={styles.barcodeAlert}>
          <div className={styles.barcodeAlertHeader}>
            <MdQrCode2 size={20} />
            <strong>Ready to Generate Barcodes ({readyItems.length} SKU{readyItems.length > 1 ? 's' : ''})</strong>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>SKU Name</th><th>Quantity</th><th>MRP</th><th>Last Received</th><th>Action</th></tr>
              </thead>
              <tbody>
                {readyItems.map((item, i) => (
                  <tr key={i}>
                    <td><strong>{item.sku_name}</strong></td>
                    <td><span className="badge badge-success">{item.quantity}</span></td>
                    <td>{item.mrp > 0 ? `₹${item.mrp.toFixed(2)}` : '—'}</td>
                    <td style={{ fontSize: 12 }}>{item.last_received ? new Date(item.last_received).toLocaleDateString('en-GB') : '—'}</td>
                    <td>
                      <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
                        onClick={() => setActiveTab('generatebarcode')}>
                        <MdQrCode2 size={15} /> Generate Barcodes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={styles.grid2}>
        {/* Worker Holdings */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><MdPeople size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />Worker Holdings</h3>
          </div>
          {Object.keys(grouped).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
              {Object.entries(grouped).map(([wName, items]) => (
                <div key={wName} className={styles.workerRow}>
                  <div className={styles.workerAvatar}>{wName[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{wName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {items.map(i => `${i.sku_name}: ${i.quantity}`).join(' · ')}
                    </div>
                  </div>
                  <span className="badge badge-warning">{items.reduce((s, i) => s + i.quantity, 0)} pcs</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 32 }}>
              <div className="empty-state-title">No pieces with workers</div>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><MdArrowForward size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />Recent Activity</h3>
          </div>
          {ledger.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {ledger.slice(0, 8).map((entry, i) => (
                <div key={i} className={styles.ledgerRow}>
                  <div className={styles.ledgerDot} style={{ backgroundColor: STAGE_COLORS[entry.stage] || '#6b7280' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{entry.sku_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{entry.from_entity}</span>
                      <MdArrowForward size={11} />
                      <span>{entry.to_entity}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{entry.quantity} pcs</div>
                    <Badge text={STAGE_LABELS[entry.stage] || entry.stage} color={STAGE_COLORS[entry.stage]} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 32 }}>
              <div className="empty-state-title">No activity yet</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProductionOverview
