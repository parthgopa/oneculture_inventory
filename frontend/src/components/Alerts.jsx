import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../config'
import { getSettings } from './Settings'
import {
  MdNotifications,
  MdWarning,
  MdError,
  MdCheckCircle,
  MdSettings,
  MdRefresh
} from 'react-icons/md'

function Alerts() {
  const navigate = useNavigate()
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [threshold, setThreshold] = useState(getSettings().lowStockThreshold)

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 10000)
    // Re-read threshold when settings change
    const onSettingsChange = (e) => setThreshold(e.detail.lowStockThreshold)
    window.addEventListener('oc:settingsChanged', onSettingsChange)
    return () => {
      clearInterval(interval)
      window.removeEventListener('oc:settingsChanged', onSettingsChange)
    }
  }, [])

  const fetchAll = async () => {
    try {
      const res = await apiFetch('/api/inventory')
      const data = await res.json()
      setInventory(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  const lowStockItems = inventory.filter(i => i.total_stock > 0 && i.total_stock < threshold)
  const outOfStockItems = inventory.filter(i => i.total_stock === 0)

  if (loading) {
    return (
      <div className="page-header">
        <h1 className="page-title">Alerts</h1>
        <div style={{ textAlign: 'center', padding: '64px' }}>
          <div className="loading"></div>
        </div>
      </div>
    )
  }

  // Combine: out-of-stock + below-threshold, sorted worst first
  const alertRows = [
    ...outOfStockItems.map(i => ({ ...i, alertType: 'OUT_OF_STOCK' })),
    ...lowStockItems.map(i => ({ ...i, alertType: 'LOW_STOCK' }))
  ].sort((a, b) => a.total_stock - b.total_stock)

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">
            <MdNotifications size={28} style={{ verticalAlign: 'middle', marginRight: '10px' }} />
            Stock Alerts
          </h1>
          <p className="page-subtitle">
            Showing SKUs with stock below <strong>{threshold} units</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline" onClick={fetchAll} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <MdRefresh size={16} /> Refresh
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/settings')} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <MdSettings size={16} /> Change Threshold ({threshold})
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: 1, minWidth: '140px', padding: '16px', textAlign: 'center', borderLeft: '4px solid var(--danger-color)' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--danger-color)' }}>{outOfStockItems.length}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Out of Stock</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: '140px', padding: '16px', textAlign: 'center', borderLeft: '4px solid var(--warning-color)' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--warning-color)' }}>{lowStockItems.length}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Low Stock (below {threshold})</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: '140px', padding: '16px', textAlign: 'center', borderLeft: '4px solid var(--success-color)' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--success-color)' }}>
            {inventory.length - outOfStockItems.length - lowStockItems.length}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Healthy SKUs</div>
        </div>
      </div>

      {/* Main SKU alert table */}
      <div className="card">
        {alertRows.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>SKU Name</th>
                  {/* <th>Company</th> */}
                  <th>Current Stock</th>
                  <th>Limit</th>
                  <th>Shortage</th>
                </tr>
              </thead>
              <tbody>
                {alertRows.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      {item.alertType === 'OUT_OF_STOCK' ? (
                        <span className="badge badge-danger">
                          <MdError size={13} /> Out of Stock
                        </span>
                      ) : (
                        <span className="badge badge-warning">
                          <MdWarning size={13} /> Low Stock
                        </span>
                      )}
                    </td>
                    <td><strong>{item.sku_name}</strong></td>
                    {/* <td>{item.company_name}</td> */}
                    <td>
                      <strong style={{ color: item.total_stock === 0 ? 'var(--danger-color)' : 'var(--warning-color)', fontSize: '15px' }}>
                        {item.total_stock}
                      </strong>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{threshold}</td>
                    <td>
                      <strong style={{ color: 'var(--danger-color)' }}>
                        −{threshold - item.total_stock}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><MdCheckCircle size={64} /></div>
            <div className="empty-state-title">All stock levels are healthy</div>
            <div className="empty-state-description">
              No SKU is below the threshold of <strong>{threshold} units</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Alerts
