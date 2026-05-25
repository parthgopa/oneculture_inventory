import { useState, useEffect } from 'react'
import { apiFetch } from '../config'
import {
  MdSettings,
  MdSave,
  MdNotificationsActive,
  MdInventory,
  MdCheckCircle,
  MdWarning,
  MdError
} from 'react-icons/md'

// ── Settings helpers (exported so other components can read synchronously) ──────
// localStorage is used as a fast read-cache; the DB is the source of truth.

export const SETTINGS_KEY = 'oc_settings'
const DEFAULT_SETTINGS = { lowStockThreshold: 50 }

export const getSettings = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY))
    return { ...DEFAULT_SETTINGS, ...stored }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

// Write to localStorage cache + notify listeners
const cacheSettings = (settings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  window.dispatchEvent(new CustomEvent('oc:settingsChanged', { detail: settings }))
}

// ── Component ─────────────────────────────────────────────────────────────────

function Settings() {
  const [settings, setSettings] = useState(getSettings())
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)

  // Load preferences from DB on mount, then fetch inventory
  useEffect(() => {
    const init = async () => {
      try {
        const res = await apiFetch('/api/preferences')
        if (res.ok) {
          const prefs = await res.json()
          const merged = { ...DEFAULT_SETTINGS, ...prefs }
          setSettings(merged)
          cacheSettings(merged)
        }
      } catch (e) {
        console.warn('Could not load preferences from DB, using cached values')
      }
      try {
        const res = await apiFetch('/api/inventory')
        const data = await res.json()
        setInventory(Array.isArray(data) ? data : [])
      } catch {}
      setLoading(false)
    }
    init()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await apiFetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: settings })
      })
      if (!res.ok) throw new Error('Save failed')
      cacheSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setSaveError('Failed to save. Check your connection.')
    } finally {
      setSaving(false)
    }
  }

  const threshold = settings.lowStockThreshold
  const belowThreshold = inventory.filter(i => i.total_stock > 0 && i.total_stock < threshold)
  const outOfStock = inventory.filter(i => i.total_stock === 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <MdSettings size={28} style={{ verticalAlign: 'middle', marginRight: '10px' }} />
          Settings
        </h1>
        <p className="page-subtitle">Configure inventory alert thresholds and preferences</p>
      </div>

      {/* Alert Threshold Card */}
      <div className="card" style={{ maxWidth: 600, marginBottom: '24px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MdNotificationsActive size={20} style={{ color: 'var(--warning-color)' }} />
          Alert Thresholds
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Alerts are triggered when product stock falls below the threshold you set here.
        </p>

        <div className="form-group">
          <label className="form-label">Low Stock Threshold</label>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Products with stock below this number will show as <strong>Low Stock</strong> alerts.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="number"
              className="form-input"
              // min="1"
              // max="100000"
              value={settings.lowStockThreshold}
              onChange={(e) =>
                setSettings(s => ({ ...s, lowStockThreshold: Math.max(0, parseInt(e.target.value)) }))
              }
              style={{ width: '130px' }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>units</span>
          </div>
        </div>

        {/* Live preview */}
        {!loading && (
          <div style={{
            background: 'rgba(255,193,7,0.06)',
            border: '1px solid rgba(255,193,7,0.2)',
            borderRadius: '10px',
            padding: '14px 18px',
            marginTop: '16px',
            marginBottom: '24px'
          }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px' }}>
              Preview at threshold <strong style={{ color: 'var(--text-color)' }}>{threshold}</strong>:
            </p>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--warning-color)', fontWeight: 600 }}>
                <MdWarning size={16} />
                {belowThreshold.length} products low stock
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--danger-color)', fontWeight: 600 }}>
                <MdError size={16} />
                {outOfStock.length} out of stock
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--success-color)', fontWeight: 600 }}>
                <MdInventory size={16} />
                {inventory.length - belowThreshold.length - outOfStock.length} healthy
              </span>
            </div>
          </div>
        )}

        {loading && <div className="loading" style={{ marginBottom: '24px' }} />}

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {saving
              ? <><div className="loading" style={{ width: 16, height: 16 }} /> Saving…</>
              : saved
                ? <><MdCheckCircle size={18} /> Saved to database!</>
                : <><MdSave size={18} /> Save Settings</>}
          </button>
          {saveError && (
            <span style={{ fontSize: '13px', color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MdError size={15} /> {saveError}
            </span>
          )}
        </div>
      </div>

      {/* Low-stock preview table */}
      {!loading && belowThreshold.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: 'var(--warning-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdWarning size={18} />
            Products below current threshold ({threshold} units)
          </h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>SKU Name</th>
                  <th>Company</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {belowThreshold.map((item, i) => (
                  <tr key={i}>
                    <td><strong>{item.sku_name}</strong></td>
                    <td>{item.company_name}</td>
                    <td>
                      <strong style={{ color: item.total_stock < threshold / 2 ? 'var(--danger-color)' : 'var(--warning-color)' }}>
                        {item.total_stock}
                      </strong>
                    </td>
                    <td>
                      <span className="badge badge-warning">
                        <MdWarning size={12} /> Low Stock
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings
