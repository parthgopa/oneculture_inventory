import { Routes, Route } from 'react-router-dom'
import './theme.css'

// Auth
import { AuthProvider, useAuth } from './context/AuthContext'

// Page Components
import Dashboard from './components/Dashboard'
import Scanner from './components/Scanner'
import Inventory from './components/Inventory'
import BarcodeGenerator from './components/BarcodeGenerator'
import BatchDetails from './components/BatchDetails'
import ProductDetails from './components/ProductDetails'
import Alerts from './components/Alerts'
import Settings from './components/Settings'
import Production from './components/Production'
import ProductionTracker from './components/ProductionTracker'
import SkuCatalog from './components/SkuCatalog'
import GeneralLedger from './components/GeneralLedger'
import AccessGate from './components/AccessGate'
import Sidebar from './components/Sidebar'

// Main Layout with sidebar
function MainLayout() {
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/scanner" element={<Scanner />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/product/:skuName" element={<ProductDetails />} />
          <Route path="/production" element={<Production />} />
          <Route path="/tracker" element={<ProductionTracker />} />
          <Route path="/skus" element={<SkuCatalog />} />
          <Route path="/general-ledger" element={<GeneralLedger />} />
          <Route path="/generator" element={<BarcodeGenerator />} />
          <Route path="/batch/:batchId" element={<BatchDetails />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="auth-container">
        <div className="loading"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AccessGate />
  }

  return <MainLayout />
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
