import { useState, useEffect } from 'react'
import { API_BASE_URL, apiFetch } from '../config'
import MobileBarcodeScanner from './MobileBarcodeScanner'
import { 
  MdInventory2, 
  MdShowChart, 
  MdWarning, 
  MdRemoveCircle,
  MdTrendingUp,
  MdTrendingDown,
  MdRefresh,
  MdQrCodeScanner
} from 'react-icons/md'

function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showScanner, setShowScanner] = useState(false)
  const [scanMode, setScanMode] = useState(null) // null = auto-toggle, 'IN' = forced IN, 'OUT' = forced OUT
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  const [refreshing, setRefreshing] = useState(false)

  // Handle window resize for responsive layout
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      const response = await apiFetch('/api/dashboard/stats')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchDashboardStats()
  }

  if (loading) {
    return (
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <div style={{ textAlign: 'center', padding: '64px' }}>
          <div className="loading"></div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header" style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'flex-start',
        gap: isMobile ? '16px' : '0'
      }}>
        <div>
          <h1 className="page-title">
            <MdShowChart size={32} style={{ verticalAlign: 'middle', marginRight: '12px' }} />
            Dashboard
          </h1>
          <p className="page-subtitle">Inventory overview and analytics</p>
        </div>
        <div style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          justifyContent: isMobile ? 'stretch' : 'flex-end'
        }}>
          {/* Stock IN Button - Green */}
          <button
            onClick={() => { setScanMode('IN'); setShowScanner(true); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flex: isMobile ? '1 1 45%' : 'none',
              padding: '12px 20px',
              fontSize: '15px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <MdQrCodeScanner size={22} />
            Stock IN
          </button>
          
          {/* Stock OUT Button - Red */}
          <button
            onClick={() => { setScanMode('OUT'); setShowScanner(true); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flex: isMobile ? '1 1 45%' : 'none',
              padding: '12px 20px',
              fontSize: '15px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <MdQrCodeScanner size={22} />
            Stock OUT
          </button>
          
          <button
            className="btn btn-outline"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: isMobile ? '1 1 100%' : 'none' }}
          >
            <MdRefresh size={20} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Key Metrics ───────────────────────────────────────────────────────── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <div>
              <div className="stat-value">{stats?.total_products || 0}</div>
              <div className="stat-label">Unique Products</div>
            </div>
            <div className="stat-icon primary">
              <MdInventory2 size={28} />
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
            Total barcodes: {stats?.total_barcodes || 0}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div>
              <div className="stat-value">{stats?.total_stock || 0}</div>
              <div className="stat-label">Current Stock</div>
            </div>
            <div className="stat-icon success">
              <MdShowChart size={28} />
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
            Available inventory units
          </div>
        </div>

        {/* <div className="stat-card">
          <div className="stat-header">
            <div>
              <div className="stat-value" style={{ color: 'var(--success-color)' }}>
                +{stats?.total_movements_in || 0}
              </div>
              <div className="stat-label">Total Stock In</div>
            </div>
            <div className="stat-icon success">
              <MdTrendingUp size={28} />
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
            All-time incoming stock
          </div>
        </div> */}

        {/* <div className="stat-card">
          <div className="stat-header">
            <div>
              <div className="stat-value" style={{ color: 'var(--danger-color)' }}>
                -{stats?.total_movements_out || 0}
              </div>
              <div className="stat-label">Total Stock Out</div>
            </div>
            <div className="stat-icon danger">
              <MdTrendingDown size={28} />
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
            All-time outgoing stock
          </div>
        </div> */}
      </div>

      {/* ── Stock Alerts ──────────────────────────────────────────────────────── */}
      {/* {(stats?.low_stock_count > 0 || stats?.out_of_stock_count > 0) && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          {stats?.low_stock_count > 0 && (
            <div className="stat-card" style={{ borderLeft: '4px solid var(--warning-color)' }}>
              <div className="stat-header">
                <div>
                  <div className="stat-value" style={{ color: 'var(--warning-color)' }}>
                    {stats.low_stock_count}
                  </div>
                  <div className="stat-label">Low Stock Items</div>
                </div>
                <div className="stat-icon warning">
                  <MdWarning size={28} />
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                Products below threshold
              </div>
            </div>
          )}

          {stats?.out_of_stock_count > 0 && (
            <div className="stat-card" style={{ borderLeft: '4px solid var(--danger-color)' }}>
              <div className="stat-header">
                <div>
                  <div className="stat-value" style={{ color: 'var(--danger-color)' }}>
                    {stats.out_of_stock_count}
                  </div>
                  <div className="stat-label">Out of Stock</div>
                </div>
                <div className="stat-icon danger">
                  <MdRemoveCircle size={28} />
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                Products need restocking
              </div>
            </div>
          )}
        </div>
      )} */}

      {/* ── Analytics ─────────────────────────────────────────────────────────── */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <MdShowChart size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              Most Scanned Products
            </h2>
          </div>
          {stats?.most_scanned && stats.most_scanned.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product (SKU)</th>
                    <th style={{ textAlign: 'right' }}>Total Scans</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.most_scanned.slice(0, 5).map((item, index) => (
                    <tr key={index}>
                      <td>
                        <strong>{item.sku_name}</strong>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {item.company_name}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="badge badge-primary">{item.scan_count}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon"><MdShowChart size={64} /></div>
              <div className="empty-state-title">No scan data yet</div>
              <div className="empty-state-description">Start scanning items to see analytics</div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <MdTrendingUp size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              Recent Stock Movement
            </h2>
          </div>
          {stats?.stock_movement && stats.stock_movement.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th style={{ textAlign: 'center' }}>In</th>
                    <th style={{ textAlign: 'center' }}>Out</th>
                    <th style={{ textAlign: 'right' }}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.stock_movement.slice(0, 7).map((item, index) => (
                    <tr key={index}>
                      <td>
                        <strong>{new Date(item.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}</strong>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>
                          +{item.stock_in}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--danger-color)', fontWeight: 600 }}>
                          -{item.stock_out}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span 
                          className="badge"
                          style={{ 
                            backgroundColor: item.net_change >= 0 ? 'var(--success-light)' : 'var(--danger-light)',
                            color: item.net_change >= 0 ? 'var(--success-color)' : 'var(--danger-color)'
                          }}
                        >
                          {item.net_change >= 0 ? '+' : ''}{item.net_change}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon"><MdTrendingUp size={64} /></div>
              <div className="empty-state-title">No movement data</div>
              <div className="empty-state-description">Stock movements will appear here</div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Barcode Scanner Overlay */}
      {showScanner && (
        <MobileBarcodeScanner 
          onClose={() => { setShowScanner(false); setScanMode(null); }}
          onScanSuccess={() => {
            // Refresh stats after successful scan
            setTimeout(() => fetchDashboardStats(), 500)
          }}
          mode={scanMode}
        />
      )}
    </div>
  )
}

export default Dashboard
