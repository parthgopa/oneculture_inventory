import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../config'
import { getSettings } from './Settings'
import { 
  MdDashboard, 
  MdQrCodeScanner, 
  MdInventory, 
  MdQrCode2, 
  MdLogout,
  MdMenu,
  MdClose,
  MdBuild,
  MdTimeline,
  MdNotifications,
  MdSettings,
  MdLabel
} from 'react-icons/md'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: MdDashboard },
  { path: '/scanner', label: 'Scanner', icon: MdQrCodeScanner },
  { path: '/inventory', label: 'Inventory', icon: MdInventory },
  { path: '/production', label: 'Production', icon: MdBuild },
  { path: '/tracker', label: 'Prod. Tracker', icon: MdTimeline },
  { path: '/skus', label: 'SKU Catalog', icon: MdLabel },
  { path: '/generator', label: 'Generate Barcodes', icon: MdQrCode2 },
  { path: '/alerts', label: 'Alerts', icon: MdNotifications, badge: true },
  { path: '/settings', label: 'Settings', icon: MdSettings },
]

function Sidebar() {
  const { user, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [alertCount, setAlertCount] = useState(0)

  // Poll inventory to show low-stock badge count
  useEffect(() => {
    const computeBadge = async () => {
      try {
        const threshold = getSettings().lowStockThreshold
        const res = await apiFetch('/api/inventory')
        const data = await res.json()
        if (Array.isArray(data)) {
          const count = data.filter(i => i.total_stock < threshold).length
          setAlertCount(count)
        }
      } catch { /* silent */ }
    }
    computeBadge()
    const interval = setInterval(computeBadge, 30000)
    const onSettings = () => computeBadge()
    window.addEventListener('oc:settingsChanged', onSettings)
    return () => {
      clearInterval(interval)
      window.removeEventListener('oc:settingsChanged', onSettings)
    }
  }, [])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setIsOpen(false) // Close mobile menu on desktop
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Close sidebar when clicking a link on mobile
  const handleNavClick = () => {
    if (isMobile) setIsOpen(false)
  }

  // Close sidebar when clicking overlay
  const handleOverlayClick = () => {
    setIsOpen(false)
  }

  return (
    <>
      {/* Mobile Header */}
      {isMobile && (
        <header className={styles.mobileHeader}>
          <button 
            className={styles.menuBtn}
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <MdClose size={24} /> : <MdMenu size={24} />}
          </button>
          
          <div className={styles.mobileLogo}>
            <img src="/logo.jpeg" alt="OneCulture" style={{ height: '32px', objectFit: 'contain' }} />
          </div>
          
          <div style={{ width: 40 }} /> {/* Spacer for centering */}
        </header>
      )}

      {/* Overlay for mobile */}
      {isMobile && isOpen && (
        <div className={styles.overlay} onClick={handleOverlayClick} />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isMobile ? styles.mobile : ''} ${isOpen ? styles.open : ''}`}>
        {/* Logo */}
        <div className={styles.logoSection}>
          <img src="/logo.jpeg" alt="OneCulture" style={{ maxWidth: '70%', maxHeight: '64px', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {NAV_ITEMS.map(({ path, label, icon: Icon, badge }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => 
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
              onClick={handleNavClick}
              end={path === '/'}
            >
              <Icon size={20} />
              <span>{label}</span>
              {badge && alertCount > 0 && (
                <span style={{
                  marginLeft: 'auto',
                  background: 'var(--danger-color, #ef4444)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '10px',
                  padding: '1px 7px',
                  minWidth: '20px',
                  textAlign: 'center',
                  lineHeight: '18px'
                }}>
                  {alertCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Section */}
        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className={styles.userDetails}>
              <div className={styles.userName}>{user?.full_name}</div>
              <div className={styles.userEmail}>{user?.email}</div>
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={logout}>
            <MdLogout size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
