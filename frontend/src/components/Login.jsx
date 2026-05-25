import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { MdEmail, MdLock, MdVisibility, MdVisibilityOff, MdInventory2 } from 'react-icons/md'
import styles from './Login.module.css'

function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!formData.email.trim()) {
      setError('Email is required')
      return
    }
    
    if (!formData.password) {
      setError('Password is required')
      return
    }

    setLoading(true)
    
    try {
      await login(formData.email, formData.password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <img src="/logo.jpeg" alt="OneCulture" className={styles.logoImg} />
          <p className={styles.brandTagline}>Inventory Management System</p>
          <h2 className={styles.title}>Welcome Back</h2>
          <p className={styles.subtitle}>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <div className={styles.inputWrapper}>
              <MdEmail className={styles.inputIcon} size={20} />
              <input
                type="email"
                id="email"
                name="email"
                className={styles.input}
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <div className={styles.inputWrapper}>
              <MdLock className={styles.inputIcon} size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                className={styles.input}
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
              </button>
            </div>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className={styles.footer}>
          <p>
            Don't have an account?{' '}
            <Link to="/signup" className={styles.link}>Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
