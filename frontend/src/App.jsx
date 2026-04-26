import { Routes, Route, Navigate } from 'react-router-dom'
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
import Login from './components/Login'
import Signup from './components/Signup'
import Sidebar from './components/Sidebar'

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="auth-container">
        <div className="loading"></div>
      </div>
    )
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return children
}

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
          <Route path="/generator" element={<BarcodeGenerator />} />
          <Route path="/batch/:batchId" element={<BatchDetails />} />
          <Route path="/alerts" element={<Alerts />} />
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

  return (
    <Routes>
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} 
      />
      <Route 
        path="/signup" 
        element={isAuthenticated ? <Navigate to="/" replace /> : <Signup />} 
      />
      <Route 
        path="/*" 
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        } 
      />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
