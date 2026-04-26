import { useState, useEffect } from 'react'
import { API_BASE_URL } from '../config'
import { 
  MdNotifications, 
  MdWarning, 
  MdError,
  MdCheckCircle,
  MdFilterList,
  MdClose
} from 'react-icons/md'

function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('unresolved')

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchAlerts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/alerts`)
      const data = await response.json()
      setAlerts(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching alerts:', error)
      setLoading(false)
    }
  }

  const handleResolve = async (alertId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/alerts/${alertId}/resolve`, {
        method: 'PUT',
      })

      if (response.ok) {
        fetchAlerts()
      }
    } catch (error) {
      console.error('Error resolving alert:', error)
    }
  }

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true
    if (filter === 'unresolved') return !alert.resolved
    if (filter === 'resolved') return alert.resolved
    if (filter === 'out-of-stock') return alert.alert_type === 'OUT_OF_STOCK' && !alert.resolved
    if (filter === 'low-stock') return alert.alert_type === 'LOW_STOCK' && !alert.resolved
    return true
  })

  const unresolvedCount = alerts.filter(a => !a.resolved).length

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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <MdNotifications size={32} style={{ verticalAlign: 'middle', marginRight: '12px' }} />
          Alerts & Notifications
        </h1>
        <p className="page-subtitle">Monitor stock alerts and critical inventory issues</p>
      </div>

      {unresolvedCount > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '24px' }}>
          <MdWarning size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>{unresolvedCount} unresolved alert{unresolvedCount !== 1 ? 's' : ''}</strong>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>
              Please review and take necessary action
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ marginBottom: '24px' }}>
          <select
            className="form-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ minWidth: '200px' }}
          >
            <option value="unresolved">Unresolved Alerts</option>
            <option value="all">All Alerts</option>
            <option value="resolved">Resolved Alerts</option>
            <option value="out-of-stock">Out of Stock</option>
            <option value="low-stock">Low Stock</option>
          </select>
        </div>

        {filteredAlerts.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Barcode ID</th>
                  <th>Company</th>
                  <th>SKU</th>
                  <th>Message</th>
                  <th>Stock</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((alert) => (
                  <tr key={alert._id}>
                    <td>
                      <span className={`badge ${alert.alert_type === 'OUT_OF_STOCK' ? 'badge-danger' : 'badge-warning'}`}>
                        {alert.alert_type === 'OUT_OF_STOCK' ? (
                          <><MdError size={14} /> Out</>
                        ) : (
                          <><MdWarning size={14} /> Low</>
                        )}
                      </span>
                    </td>
                    <td><code>{alert.barcode_id}</code></td>
                    <td>{alert.company_name}</td>
                    <td><strong>{alert.sku_name}</strong></td>
                    <td>{alert.message}</td>
                    <td>
                      <strong style={{ 
                        color: alert.current_stock === 0 ? 'var(--danger-color)' : 'var(--warning-color)' 
                      }}>
                        {alert.current_stock}
                      </strong>
                    </td>
                    <td>{new Date(alert.created_at).toLocaleString()}</td>
                    <td>
                      {alert.resolved ? (
                        <span className="badge badge-success"><MdCheckCircle size={14} /> Resolved</span>
                      ) : (
                        <span className="badge badge-danger"><MdError size={14} /> Active</span>
                      )}
                    </td>
                    <td>
                      {!alert.resolved && (
                        <button
                          onClick={() => handleResolve(alert._id)}
                          className="btn btn-outline"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          Mark Resolved
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><MdNotifications size={64} /></div>
            <div className="empty-state-title">No alerts found</div>
            <div className="empty-state-description">
              {filter === 'unresolved' 
                ? 'All alerts have been resolved!'
                : 'Alerts will appear here when stock levels are critical'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Alerts
