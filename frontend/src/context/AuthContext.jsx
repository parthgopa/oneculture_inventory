import { createContext, useContext, useState, useEffect } from 'react'

const SECRET_CODE = 'ONECULTURE-INVENTORY'
const ACCESS_KEY = 'oc_access_granted'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const granted = localStorage.getItem(ACCESS_KEY)
    if (granted === 'true') {
      setIsAuthenticated(true)
    }
    setLoading(false)
  }, [])

  const login = (code) => {
    if (code === SECRET_CODE) {
      localStorage.setItem(ACCESS_KEY, 'true')
      setIsAuthenticated(true)
      return true
    }
    return false
  }

  const logout = () => {
    localStorage.removeItem(ACCESS_KEY)
    setIsAuthenticated(false)
  }

  const value = {
    isAuthenticated,
    loading,
    login,
    logout,
    user: null
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
