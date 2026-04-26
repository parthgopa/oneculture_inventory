import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  MdDashboard, 
  MdQrCodeScanner, 
  MdInventory, 
  MdQrCode2, 
  MdLogout,
  MdMenu,
  MdClose
} from 'react-icons/md'
import styles from './Sidebar.module.css'

// Navigation items
const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: MdDashboard },
  { path: '/scanner', label: 'Scanner', icon: MdQrCodeScanner },
  { path: '/inventory', label: 'Inventory', icon: MdInventory },
  { path: '/generator', label: 'Generate Barcodes', icon: MdQrCode2 },
]

function Sidebar() {
  const { user, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

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
            <span className={styles.logoIcon}>OC</span>
            <span className={styles.logoText}>OneCulture</span>
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
          <div className={styles.logo}>
            <span className={styles.logoIcon}>OC</span>
            <span className={styles.logoText}>OneCulture</span>
          </div>
          <div className={styles.logoSubtext}>Inventory Management</div>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
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
