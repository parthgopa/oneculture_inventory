// Shared constants, Badge, Modal, FormRow used across production tab components

export const STATUS_LABELS = {
  ordered: 'Ordered', received: 'Received', in_work: 'In Work', completed: 'Completed'
}
export const STATUS_COLORS = {
  ordered: '#6366f1', received: '#0ea5e9', in_work: '#f59e0b', completed: '#10b981'
}
export const STAGE_LABELS = {
  cloth_received: 'Cloth Received', job_assigned: 'Assigned',
  transferred: 'Transferred', final_received: 'Final Received'
}
export const STAGE_COLORS = {
  cloth_received: '#0ea5e9', job_assigned: '#f59e0b',
  transferred: '#8b5cf6', final_received: '#10b981'
}
export const WORK_TYPES_JOB = ['Embroidery', 'Cutting', 'Stitching', 'Printing', 'Dyeing', 'Other']
export const WORK_TYPES_ADDITIONAL = ['Diamond Work', 'Jari Work', 'Additional Work']
export const WORK_TYPES_WORKER = ['Job Work', 'Additional Work', 'Embroidery', 'Diamond Work', 'Jari Work', 'Cutting', 'Stitching', 'General']

import { MdClose } from 'react-icons/md'

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
