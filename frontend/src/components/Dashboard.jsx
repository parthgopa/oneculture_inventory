import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../config'
import {
  MdShowChart,
  MdTrendingUp,
  MdRefresh,
  MdWarning,
  MdLocalFireDepartment,
  MdBuild,
  MdLayers,
  MdColorLens,
  MdArrowForward,
  MdPeople,
  MdLightbulb
} from 'react-icons/md'
import styles from './Dashboard.module.css'

function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async (forceRefresh = false) => {
    try {
      const url = forceRefresh ? '/api/dashboard/stats?refresh=true' : '/api/dashboard/stats'
      const response = await apiFetch(url)
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
    fetchDashboardStats(true)
  }

  if (loading) {
    return (
      <div className={styles.dashboardContainer}>
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div className="loading" style={{ width: 44, height: 44 }} />
          <p style={{ marginTop: 14, color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 600 }}>
            Analyzing production and sales intelligence...
          </p>
        </div>
      </div>
    )
  }

  const summary = stats?.summary || {}
  const topSelling = stats?.top_selling_skus || []
  const topProduced = stats?.top_produced_skus || []
  const topColors = stats?.top_colors || []
  const topFabrics = stats?.top_fabrics || []
  const topWorkers = stats?.top_workers || []
  const smartAlerts = stats?.smart_alerts || []

  return (
    <div className={styles.dashboardContainer}>
      {/* ── Page Header ── */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>
            <MdShowChart size={30} style={{ color: 'var(--primary-color)' }} />
            Executive Intelligence & Trends Dashboard
          </h1>
          <p className={styles.subtitle}>
            Live insights on sales velocity, trending products, manufacturing demand, and production pipeline.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={`btn btn-outline ${styles.actionBtn}`}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <MdRefresh size={18} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Live Data'}
          </button>
          <button
            className={`btn btn-primary ${styles.actionBtn}`}
            onClick={() => navigate('/production')}
          >
            <MdBuild size={16} /> Production Manager
          </button>
        </div>
      </div>

      {/* ── Top Executive KPI Bar ── */}
      <div className={styles.kpiGrid}>
        {/* 1. Total Dispatched / Sold */}
        <div className={styles.kpiCard} style={{ borderLeft: '4px solid #10b981' }}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Total Dispatched & Sold</span>
            <div className={styles.kpiIcon} style={{ background: '#dcfce7', color: '#15803d' }}>
              <MdTrendingUp size={22} />
            </div>
          </div>
          <div className={styles.kpiValue} style={{ color: '#15803d' }}>
            {summary.total_units_sold?.toLocaleString() || 0} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>pcs</span>
          </div>
          <div className={styles.kpiSubtext}>
            <span>Dispatched & shipped from warehouse</span>
          </div>
        </div>

        {/* 2. Top Trending SKU */}
        <div className={styles.kpiCard} style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>#1 Trending Best-Seller</span>
            <div className={styles.kpiIcon} style={{ background: '#fef3c7', color: '#b45309' }}>
              <MdLocalFireDepartment size={22} />
            </div>
          </div>
          <div className={styles.kpiValue} style={{ fontSize: 20, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {summary.top_trending_sku || '—'}
          </div>
          <div className={styles.kpiSubtext}>
            <span>Highest sales frequency across warehouse</span>
          </div>
        </div>

        {/* 3. Total Production Volume */}
        <div className={styles.kpiCard} style={{ borderLeft: '4px solid #6366f1' }}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Total Production Volume</span>
            <div className={styles.kpiIcon} style={{ background: '#e0e7ff', color: '#4338ca' }}>
              <MdLayers size={22} />
            </div>
          </div>
          <div className={styles.kpiValue}>
            {summary.total_cloth_ordered?.toLocaleString() || 0} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>pcs</span>
          </div>
          <div className={styles.kpiSubtext}>
            <span><strong>{summary.total_cloth_completed?.toLocaleString() || 0} pcs</strong> finished ({summary.production_completion_rate || 0}%)</span>
          </div>
        </div>

        {/* 4. Active Worker Pipeline */}
        <div className={styles.kpiCard} style={{ borderLeft: '4px solid #0ea5e9' }}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Pieces in Factory Hand</span>
            <div className={styles.kpiIcon} style={{ background: '#e0e7ff', color: '#0369a1' }}>
              <MdPeople size={22} />
            </div>
          </div>
          <div className={styles.kpiValue} style={{ color: '#0369a1' }}>
            {summary.pieces_with_workers?.toLocaleString() || 0} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>pcs</span>
          </div>
          <div className={styles.kpiSubtext}>
            <span>Across <strong>{summary.active_chalans_count || 0} active chalans</strong> in work</span>
          </div>
        </div>
      </div>

      {/* ── Main Analytics Section ── */}
      <div className={styles.mainGrid}>
        {/* Module A: Trending & Best-Selling Products */}
        <div className={styles.analyticsCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              <MdLocalFireDepartment size={20} style={{ color: '#ea580c' }} />
              Top Selling & Trending SKUs
            </h2>
            <span className={styles.cardBadge}>Sales Velocity</span>
          </div>
          {topSelling.length > 0 ? (
            <div className="table-container">
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>#</th>
                    <th>Product / SKU</th>
                    <th style={{ textAlign: 'center' }}>Sold</th>
                    <th style={{ textAlign: 'right' }}>Unit MRP</th>
                    <th style={{ textAlign: 'center' }}>In Stock</th>
                    <th style={{ width: 120 }}>Sell-Through</th>
                  </tr>
                </thead>
                <tbody>
                  {topSelling.map((item, idx) => {
                    let rankClass = styles.rankBadge
                    if (idx === 0) rankClass = `${styles.rankBadge} ${styles.rankBadgeGold}`
                    else if (idx === 1) rankClass = `${styles.rankBadge} ${styles.rankBadgeSilver}`
                    else if (idx === 2) rankClass = `${styles.rankBadge} ${styles.rankBadgeBronze}`

                    return (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center' }}>
                          <span className={rankClass}>{idx + 1}</span>
                        </td>
                        <td>
                          <strong>{item.sku_name}</strong>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {item.color ? `Color: ${item.color}` : ''} {item.fabric ? `· ${item.fabric}` : ''}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <strong style={{ fontSize: 14, color: '#15803d' }}>{item.sold_quantity} pcs</strong>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          ₹{item.mrp?.toLocaleString('en-IN') || '—'}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: item.current_stock > 0 ? '#0f172a' : '#ef4444' }}>
                          {item.current_stock} pcs
                        </td>
                        <td>
                          <div style={{ fontSize: 11, fontWeight: 700, color: item.sell_through_rate > 80 ? '#15803d' : '#4338ca' }}>
                            {item.sell_through_rate}% sold
                          </div>
                          <div className={styles.progressBarBg}>
                            <div
                              className={styles.progressBarFill}
                              style={{
                                width: `${Math.min(100, item.sell_through_rate)}%`,
                                backgroundColor: item.sell_through_rate > 80 ? '#10b981' : '#6366f1'
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
              No sales records tracked yet.
            </div>
          )}
        </div>

        {/* Module B: Manufacturing Demand & Completion Progress */}
        <div className={styles.analyticsCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              <MdLayers size={20} style={{ color: 'var(--primary-color)' }} />
              High-Demand Manufacturing Volume
            </h2>
            <span className={styles.cardBadge}>Production Progress</span>
          </div>
          {topProduced.length > 0 ? (
            <div className="table-container">
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>SKU Name</th>
                    <th style={{ textAlign: 'center' }}>Ordered</th>
                    <th style={{ textAlign: 'center' }}>Completed</th>
                    <th style={{ textAlign: 'center' }}>In Work</th>
                    <th style={{ width: 130 }}>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {topProduced.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{item.sku_name}</strong>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {item.color || 'No Color'} {item.fabric ? `· ${item.fabric}` : ''}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>
                        {item.ordered_quantity} pcs
                      </td>
                      <td style={{ textAlign: 'center', color: '#15803d', fontWeight: 600 }}>
                        {item.completed_quantity} pcs
                      </td>
                      <td style={{ textAlign: 'center', color: '#b45309', fontWeight: 600 }}>
                        {item.in_work_quantity} pcs
                      </td>
                      <td>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>
                          {item.completion_percentage}% ({item.completed_quantity}/{item.ordered_quantity})
                        </div>
                        <div className={styles.progressBarBg}>
                          <div
                            className={styles.progressBarFill}
                            style={{
                              width: `${Math.min(100, item.completion_percentage)}%`,
                              backgroundColor: item.completion_percentage === 100 ? '#10b981' : '#3b82f6'
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
              No production orders created yet.
            </div>
          )}
        </div>
      </div>

      {/* ── Color & Fabric Market Trends ── */}
      <div className={styles.mainGrid}>
        {/* Color Trends */}
        <div className={styles.analyticsCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              <MdColorLens size={20} style={{ color: '#ec4899' }} />
              Top Demanded Colors
            </h2>
            <span className={styles.cardBadge}>Market Share</span>
          </div>
          <div className={styles.distributionGrid}>
            {topColors.map((c, idx) => (
              <div key={idx} className={styles.pillCard}>
                <div className={styles.pillHeader}>
                  <strong style={{ fontSize: 14, color: '#1e293b' }}>{c.color}</strong>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#6366f1' }}>{c.percentage}%</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.quantity?.toLocaleString()} pcs total</span>
                <div className={styles.progressBarBg} style={{ height: 6 }}>
                  <div
                    className={styles.progressBarFill}
                    style={{ width: `${Math.min(100, c.percentage * 3)}%`, backgroundColor: '#ec4899' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fabric Trends */}
        <div className={styles.analyticsCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              <MdLayers size={20} style={{ color: '#0ea5e9' }} />
              Top Fabric Types
            </h2>
            <span className={styles.cardBadge}>Fabric Yardage</span>
          </div>
          <div className={styles.distributionGrid}>
            {topFabrics.map((f, idx) => (
              <div key={idx} className={styles.pillCard}>
                <div className={styles.pillHeader}>
                  <strong style={{ fontSize: 14, color: '#1e293b' }}>{f.fabric}</strong>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#0ea5e9' }}>{f.percentage}%</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{f.quantity?.toLocaleString()} pcs ordered</span>
                <div className={styles.progressBarBg} style={{ height: 6 }}>
                  <div
                    className={styles.progressBarFill}
                    style={{ width: `${Math.min(100, f.percentage * 3)}%`, backgroundColor: '#0ea5e9' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Active Worker Factory Pipeline ── */}
      <div className={styles.analyticsCard} style={{ marginBottom: 24 }}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            <MdPeople size={20} style={{ color: '#059669' }} />
            Active Factory Pipeline (Workers Holding Inventory)
          </h2>
          <button
            className="btn btn-outline btn-sm"
            style={{ fontSize: 12, padding: '4px 12px' }}
            onClick={() => navigate('/production?tab=workers')}
          >
            View Worker Holdings <MdArrowForward size={13} />
          </button>
        </div>
        <div className={styles.distributionGrid}>
          {topWorkers.map((w, idx) => (
            <div key={idx} className={styles.pillCard} style={{ borderLeft: '4px solid #10b981' }}>
              <div className={styles.pillHeader}>
                <strong style={{ fontSize: 14, color: '#0f172a' }}>{w.worker_name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Current In Hand:</span>
                <strong style={{ fontSize: 15, color: '#15803d' }}>{w.quantity?.toLocaleString()} pcs</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Smart Restock & Velocity Insights (Placed Below) ── */}
      {smartAlerts.length > 0 && (
        <div className={styles.alertsSection}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <MdLightbulb size={22} style={{ color: '#f59e0b' }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1e293b' }}>
              Smart Inventory & Production Insights
            </h3>
          </div>
          {smartAlerts.map((alert, idx) => (
            <div key={idx} className={styles.alertBanner}>
              <div className={styles.alertContent}>
                <MdWarning size={24} style={{ color: '#d97706', flexShrink: 0 }} />
                <div>
                  <h4 className={styles.alertTextTitle}>{alert.title}</h4>
                  <p className={styles.alertTextMessage}>{alert.message}</p>
                </div>
              </div>
              <button
                className="btn btn-outline btn-sm"
                style={{ backgroundColor: '#ffffff', borderColor: '#d97706', color: '#92400e', fontWeight: 700, fontSize: '12px' }}
                onClick={() => navigate('/production')}
              >
                Create New Order <MdArrowForward size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Dashboard
