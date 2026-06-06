// Shared constants, Badge, Modal, FormRow used across production tab components

export const STATUS_LABELS = {
  ordered: 'Ordered', received: 'Received', in_work: 'In Work', completed: 'Completed'
}
export const STATUS_COLORS = {
  ordered: '#6366f1', received: '#0ea5e9', in_work: '#f59e0b', completed: '#10b981'
}
export const STAGE_LABELS = {
  cloth_received: 'Cloth Received', job_assigned: 'Assigned',
  transferred: 'Transferred', final_received: 'Final Received',
  returned_to_supplier: 'Returned', reverted: 'Reverted',
  revert_source: 'Reverted'
}
export const STAGE_COLORS = {
  cloth_received: '#0ea5e9', job_assigned: '#f59e0b',
  transferred: '#8b5cf6', final_received: '#10b981',
  returned_to_supplier: '#ef4444', reverted: '#6b7280',
  revert_source: '#6b7280'
}
export const WORK_TYPES_JOB = ['Embroidery', 'Cutting', 'Stitching', 'Printing', 'Dyeing', 'Other']
export const WORK_TYPES_ADDITIONAL = ['Diamond Work', 'Jari Work', 'Additional Work']
export const WORK_TYPES_WORKER = ['Embroidery','Job Work', 'Additional Work',  'Diamond Work', 'Jari Work', 'Cutting', 'Stitching', 'General']

import { useState, useRef, useEffect } from 'react'
import { MdClose, MdEdit, MdUndo, MdCalendarToday } from 'react-icons/md'
import { apiFetch } from '../../config'

export const Badge = ({ text, color }) => (
  <span style={{
    display: 'inline-block', padding: '3px 10px', borderRadius: 20,
    fontSize: 11, fontWeight: 700, color: 'white', backgroundColor: color || '#6b7280',
    whiteSpace: 'nowrap'
  }}>{text}</span>
)

export const Modal = ({ title, onClose, children, width = 580 }) => (
  <div style={{
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1200, padding: 16
  }} onClick={onClose}>
    <div style={{
      backgroundColor: 'white', borderRadius: 14, width: '100%', maxWidth: width,
      maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      boxShadow: '0 24px 64px rgba(0,0,0,0.25)'
    }} onClick={e => e.stopPropagation()}>
      <div style={{
        padding: '20px 24px 16px', borderBottom: '1px solid var(--border-color)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
      }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h2>
        <button onClick={onClose} style={{
          width: 32, height: 32, borderRadius: '50%', border: 'none',
          background: 'var(--bg-secondary)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}><MdClose size={18} /></button>
      </div>
      <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>{children}</div>
    </div>
  </div>
)

export const FormRow = ({ label, children, required }) => (
  <div className="form-group">
    <label className="form-label">
      {label}{required && <span style={{ color: 'var(--danger-color)' }}> *</span>}
    </label>
    {children}
  </div>
)

/* ── Shared popover date picker styles (injected once) ──────────────────── */
const DATE_POPOVER_STYLE = {
  position: 'absolute', zIndex: 9999, top: 'calc(100% + 6px)', left: 0,
  background: 'white', border: '1px solid var(--border-color)',
  borderRadius: 12, padding: '14px 16px', minWidth: 220,
  boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
  display: 'flex', flexDirection: 'column', gap: 10
}

/**
 * EditableDateCell — polished popover date picker for ledger entries.
 * Props: ledgerId (string), dateStr (ISO string), onSaved (callback)
 */
export function EditableDateCell({ ledgerId, dateStr, onSaved }) {
  const [open, setOpen]     = useState(false)
  const [val, setVal]       = useState('')
  const [saving, setSaving] = useState(false)
  const wrapRef             = useRef(null)

  const toInputVal = (iso) => {
    if (!iso) return ''
    try { return new Date(iso).toISOString().slice(0, 10) } catch { return '' }
  }

  const openPicker = () => { setVal(toInputVal(dateStr)); setOpen(true) }

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSave = async () => {
    if (!val) { setOpen(false); return }
    setSaving(true)
    try {
      const res = await apiFetch(`/api/production/ledger/${ledgerId}/date`, {
        method: 'PATCH',
        body: JSON.stringify({ date: val })
      })
      if (res.ok && onSaved) onSaved()
    } catch (_) {}
    setSaving(false)
    setOpen(false)
  }

  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <span
        onClick={openPicker}
        title="Click to edit date"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
          cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)',
          padding: '2px 6px', borderRadius: 6, transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <MdCalendarToday size={11} />
        {dateStr ? new Date(dateStr).toLocaleDateString('en-GB') : '—'}
        <MdEdit size={10} style={{ opacity: 0.45 }} />
      </span>
      {open && (
        <div style={DATE_POPOVER_STYLE} onMouseDown={e => e.stopPropagation()}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Edit Date</div>
          <input
            type="date" autoFocus value={val}
            onChange={e => setVal(e.target.value)}
            style={{ fontSize: 13, border: '1.5px solid var(--border-color)', borderRadius: 8,
              padding: '7px 10px', width: '100%', outline: 'none', cursor: 'pointer',
              transition: 'border-color 0.15s' }}
            onFocus={e => e.target.style.borderColor = 'var(--primary-color)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSave} disabled={saving || !val}
              style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                background: 'var(--primary-color)', color: 'white', fontWeight: 700,
                fontSize: 12, cursor: saving ? 'wait' : 'pointer', opacity: !val ? 0.5 : 1 }}
            >{saving ? 'Saving…' : 'Save'}</button>
            <button
              onClick={() => setOpen(false)}
              style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border-color)',
                background: 'white', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}
            >Cancel</button>
          </div>
        </div>
      )}
    </span>
  )
}

/**
 * OrderDateCell — same popover UI but patches /api/production/orders/<orderId>/date
 */
export function OrderDateCell({ orderId, dateStr, onSaved }) {
  const [open, setOpen]     = useState(false)
  const [val, setVal]       = useState('')
  const [saving, setSaving] = useState(false)
  const wrapRef             = useRef(null)

  const toInputVal = (iso) => {
    if (!iso) return ''
    try { return new Date(iso).toISOString().slice(0, 10) } catch { return '' }
  }

  const openPicker = () => { setVal(toInputVal(dateStr)); setOpen(true) }

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSave = async () => {
    if (!val) { setOpen(false); return }
    setSaving(true)
    try {
      const res = await apiFetch(`/api/production/orders/${orderId}/date`, {
        method: 'PATCH',
        body: JSON.stringify({ date: val })
      })
      if (res.ok && onSaved) onSaved()
    } catch (_) {}
    setSaving(false)
    setOpen(false)
  }

  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <span
        onClick={openPicker}
        title="Click to edit order date"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
          cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)',
          padding: '2px 6px', borderRadius: 6, transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <MdCalendarToday size={11} />
        {dateStr ? new Date(dateStr).toLocaleDateString('en-GB') : '—'}
        <MdEdit size={10} style={{ opacity: 0.45 }} />
      </span>
      {open && (
        <div style={DATE_POPOVER_STYLE} onMouseDown={e => e.stopPropagation()}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Edit Order Date</div>
          <input
            type="date" autoFocus value={val}
            onChange={e => setVal(e.target.value)}
            style={{ fontSize: 13, border: '1.5px solid var(--border-color)', borderRadius: 8,
              padding: '7px 10px', width: '100%', outline: 'none', cursor: 'pointer' }}
            onFocus={e => e.target.style.borderColor = 'var(--primary-color)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSave} disabled={saving || !val}
              style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                background: 'var(--primary-color)', color: 'white', fontWeight: 700,
                fontSize: 12, cursor: saving ? 'wait' : 'pointer', opacity: !val ? 0.5 : 1 }}
            >{saving ? 'Saving…' : 'Save'}</button>
            <button
              onClick={() => setOpen(false)}
              style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border-color)',
                background: 'white', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}
            >Cancel</button>
          </div>
        </div>
      )}
    </span>
  )
}

/**
 * RevertButton — shows a ↩ button; on click asks for optional notes and calls revert API.
 * Props: ledgerId, stage, onReverted (callback)
 * Disabled for entries that are already reverted or are revert entries.
 */
export function RevertButton({ ledgerId, stage, onReverted }) {
  const [loading, setLoading] = useState(false)

  const nonRevertable = ['revert_source', 'cloth_received']
  if (nonRevertable.includes(stage)) return null

  const handle = async () => {
    const confirmed = window.confirm('Are you sure you want to revert this entry?')
    if (!confirmed) return
    setLoading(true)
    try {
      const res = await apiFetch(`/api/production/ledger/${ledgerId}/revert`, {
        method: 'POST',
        body: JSON.stringify({ notes: '' })
      })
      const data = await res.json()
      if (!res.ok) { window.alert(data.error || 'Revert failed'); return }
      if (onReverted) onReverted()
    } catch (e) { window.alert('Network error') }
    finally { setLoading(false) }
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      title="Revert this entry"
      style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6,
        cursor: 'pointer', padding: '3px 7px', fontSize: 11, color: '#6b7280',
        display: 'inline-flex', alignItems: 'center', gap: 3,
        opacity: loading ? 0.5 : 1, transition: 'all 0.15s' }}
    >
      <MdUndo size={13} />{loading ? '…' : 'Revert'}
    </button>
  )
}
