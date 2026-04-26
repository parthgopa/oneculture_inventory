import { createContext, useContext, useState, useEffect } from 'react'
import { API_BASE_URL } from '../config'

const AuthContext = createContext(null)

const STORAGE_KEY = 'inventory_auth_user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Check for stored session on mount
  useEffect(() => {
    const checkStoredSession = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const userData = JSON.parse(stored)
          
          // Verify session with backend
          const res = await fetch(`${API_BASE_URL}/api/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: userData.id,
              email: userData.email
            })
          })
          
          const data = await res.json()
          
          if (data.valid) {
            setUser(data.user)
          } else {
            // Invalid session, clear storage
            localStorage.removeItem(STORAGE_KEY)
          }
        }
      } catch (error) {
        console.error('Session verification failed:', error)
        localStorage.removeItem(STORAGE_KEY)
      } finally {
        setLoading(false)
      }
    }

    checkStoredSession()
  }, [])

  const login = async (email, password) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Login failed')
    }

    // Store in localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user))
    setUser(data.user)
    
    return data
  }

  const signup = async (fullName, email, password, confirmPassword) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        email,
        password,
        confirm_password: confirmPassword
      })
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Signup failed')
    }

    return data
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    isAuthenticated: !!user
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
