import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { MdLock, MdVisibility, MdVisibilityOff } from 'react-icons/md'

function AccessGate() {
  const { login } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [showCode, setShowCode] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    const success = login(code.trim())
    if (!success) {
      setError('Invalid access code. Please try again.')
      setCode('')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-color)',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '48px 40px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <img src="/logo.jpeg" alt="OneCulture" style={{ height: '52px', marginBottom: '16px' }} />
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-color)', margin: '0 0 6px' }}>
            Inventory Management
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            Enter your access code to continue
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '13px',
              color: 'var(--danger-color)'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-color)', marginBottom: '8px' }}>
              Access Code
            </label>
            <div style={{ position: 'relative' }}>
              <MdLock size={18} style={{
                position: 'absolute', left: '12px', top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-muted)'
              }} />
              <input
                type={showCode ? 'text' : 'password'}
                value={code}
                onChange={(e) => { setCode(e.target.value); setError('') }}
                placeholder="Enter access code"
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 44px',
                  fontSize: '14px',
                  background: 'var(--input-bg, var(--bg-color))',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-color)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  letterSpacing: showCode ? 'normal' : '3px'
                }}
              />
              <button
                type="button"
                onClick={() => setShowCode(v => !v)}
                style={{
                  position: 'absolute', right: '12px', top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center'
                }}
              >
                {showCode ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!code.trim()}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '15px',
              fontWeight: 600,
              background: code.trim() ? 'var(--primary-color)' : 'var(--border-color)',
              color: code.trim() ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '8px',
              cursor: code.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s'
            }}
          >
            Access Dashboard
          </button>
        </form>
      </div>
    </div>
  )
}

export default AccessGate
