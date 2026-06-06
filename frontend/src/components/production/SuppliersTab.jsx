import { useState, useEffect } from 'react'
import { MdAdd, MdEdit, MdDelete, MdVisibility, MdWarning,
         MdSchedule, MdHistory, MdStorefront } from 'react-icons/md'
import { apiFetch } from '../../config'
import { Badge, Modal, FormRow, STAGE_LABELS, STAGE_COLORS } from './helpers'
import styles from './SuppliersTab.module.css'

function SupplierDetailModal({ supplier, onClose }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    apiFetch(`/api/production/suppliers/${encodeURIComponent(supplier.name)}/holdings`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [supplier.name])

  return (
    <Modal title={`Supplier: ${supplier.name}`} onClose={onClose} width={700}>
      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="loading" />
          <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>Loading holdings...</p>
        </div>
      )}
      {error && <div className="alert alert-danger">{error}</div>}
      {data && (
        <div>
          {supplier.company_name && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Company: <strong style={{ color: 'var(--text-primary)' }}>{supplier.company_name}</strong>
            </div>
          )}

          {/* Summary stat */}
          <div className={styles.detailStats}>
            <div className={styles.detailStat}>
              <div className={styles.detailStatVal} style={{ color: '#f59e0b' }}>{data.total_pieces_current}</div>
              <div className={styles.detailStatLabel}>Currently Holding</div>
            </div>
            <div className={styles.detailStat}>
              <div className={styles.detailStatVal} style={{ color: '#6366f1' }}>{data.current_holdings.length}</div>
              <div className={styles.detailStatLabel}>SKU Lines</div>
            </div>
            <div className={styles.detailStat}>
              <div className={styles.detailStatVal} style={{ color: '#10b981' }}>{data.activity.length}</div>
              <div className={styles.detailStatLabel}>Ledger Entries</div>
            </div>
          </div>

          {/* Current holdings */}
          <div style={{ marginBottom: 20 }}>
            <div className={styles.sectionTitle}>
              <MdSchedule size={16} /> Current Stock With Supplier
            </div>
            {data.current_holdings.length > 0 ? (
              <div className={styles.holdingTable}>
                {data.current_holdings.map((h, i) => (
                  <div key={i} className={styles.holdingRow}>
                    <span className={styles.skuPill}>{h.sku_name}</span>
                    {h.color && (
                      <span style={{ fontSize: 11, color: '#6366f1', background: '#eef2ff', padding: '2px 8px', borderRadius: 4, marginLeft: 8 }}>
                        {h.color}
                      </span>
                    )}
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 12 }}>
                      Received: {h.total_received} · Sent: {h.total_sent}
                    </span>
                    <span className="badge badge-warning">{h.quantity} pcs</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0' }}>No pieces currently held by this supplier.</p>
            )}
          </div>

          {/* Activity log */}
          <div>
            <div className={styles.sectionTitle}>
              <MdHistory size={16} /> Ledger Activity
            </div>
            {data.activity.length > 0 ? (
              <div className={styles.activityLog}>
                {data.activity.map((e, i) => (
                  <div key={i} className={styles.activityRow}>
                    <div className={styles.activityDot} style={{ background: STAGE_COLORS[e.stage] || '#94a3b8' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {e.sku_name}
                        {e.color && (
                          <span style={{ fontSize: 10, color: '#6366f1', background: '#eef2ff', padding: '1px 6px', borderRadius: 4 }}>
                            {e.color}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.from_entity}</span>
                        <span style={{ color: '#6366f1', fontWeight: 800, fontSize: 13, lineHeight: 1 }}>→</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.to_entity}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{e.quantity} pcs</div>
                      <Badge text={STAGE_LABELS[e.stage] || e.stage} color={STAGE_COLORS[e.stage]} />
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {new Date(e.created_at).toLocaleDateString('en-GB')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0' }}>No ledger activity yet.</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

function SuppliersTab({ suppliers, onRefresh }) {
  const [modal, setModal]                   = useState(null)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [editingSupplier, setEditingSupplier]   = useState(null)
  const [deleteTarget, setDeleteTarget]         = useState(null)
  const [submitting, setSubmitting]         = useState(false)
  const [error, setError]                   = useState(null)
  const [form, setForm]                     = useState({ name: '', company_name: '' })
  const [editForm, setEditForm]             = useState({ name: '', company_name: '' })

  const close = () => { setModal(null); setError(null); setEditingSupplier(null); setDeleteTarget(null) }

  const openEdit = (s) => {
    setEditingSupplier(s)
    setEditForm({ name: s.name, company_name: s.company_name || '' })
    setError(null)
    setModal('edit')
  }

  const openDelete = (s) => {
    setDeleteTarget(s)
    setModal('delete')
  }

  const handleAdd = async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await apiFetch('/api/production/suppliers', {
        method: 'POST',
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      close(); onRefresh()
      setForm({ name: '', company_name: '' })
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const handleEdit = async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await apiFetch(`/api/production/suppliers/${editingSupplier.supplier_id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      close(); onRefresh()
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/production/suppliers/${deleteTarget.supplier_id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      close(); onRefresh()
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const renderCard = (s) => (
    <div key={s.supplier_id} className={styles.supplierCard}>
      <div className={styles.cardTop}>
        <div className={styles.avatar}>{s.name[0].toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.supplierName}>{s.name}</div>
          {s.company_name && (
            <div className={styles.companyName}>{s.company_name}</div>
          )}
        </div>
        <button onClick={() => setSelectedSupplier(s)} className={styles.viewBtn} title="View Holdings">
          <MdVisibility size={17} />
        </button>
        <button onClick={() => openEdit(s)} className={styles.editBtn} title="Edit Supplier">
          <MdEdit size={17} />
        </button>
        <button onClick={() => openDelete(s)} className={styles.deleteBtn} title="Remove Supplier">
          <MdDelete size={17} />
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <div className={styles.toolbar}>
        <button className="btn btn-primary" onClick={() => setModal('add')}>
          <MdAdd size={18} /> Add Supplier
        </button>
      </div>

      {suppliers.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 56 }}>
            <div className="empty-state-icon"><MdStorefront size={56} /></div>
            <div className="empty-state-title">No suppliers added yet</div>
            <div className="empty-state-description">Add suppliers to track their stock holdings</div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setModal('add')}>
              <MdAdd size={18} /> Add First Supplier
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.grid}>
          {suppliers.map(renderCard)}
        </div>
      )}

      {/* ── Detail / Holdings Modal ───────────────────────────────────────── */}
      {selectedSupplier && (
        <SupplierDetailModal supplier={selectedSupplier} onClose={() => setSelectedSupplier(null)} />
      )}

      {/* ── Add Modal ────────────────────────────────────────────────────── */}
      {modal === 'add' && (
        <Modal title="Add New Supplier" onClose={close} width={440}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}><MdWarning size={16} /> {error}</div>}
          <FormRow label="Supplier Name" required>
            <input className="form-input" placeholder="e.g. Raj Textiles" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
          </FormRow>
          <FormRow label="Company Name">
            <input className="form-input" placeholder="e.g. Raj Fabrics Pvt Ltd" value={form.company_name}
              onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} />
          </FormRow>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAdd} disabled={submitting}>
            {submitting ? 'Adding...' : 'Add Supplier'}
          </button>
        </Modal>
      )}

      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      {modal === 'edit' && editingSupplier && (
        <Modal title={`Edit Supplier: ${editingSupplier.name}`} onClose={close} width={440}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}><MdWarning size={16} /> {error}</div>}
          <FormRow label="Supplier Name" required>
            <input className="form-input" value={editForm.name}
              onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} autoFocus />
          </FormRow>
          <FormRow label="Company Name">
            <input className="form-input" value={editForm.company_name}
              onChange={e => setEditForm(p => ({ ...p, company_name: e.target.value }))} />
          </FormRow>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleEdit} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </Modal>
      )}

      {/* ── Delete Confirm Modal ─────────────────────────────────────────── */}
      {modal === 'delete' && deleteTarget && (
        <Modal title="Remove Supplier?" onClose={close} width={420}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}><MdWarning size={16} /> {error}</div>}
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 8px' }}>
            This will remove <strong>{deleteTarget.name}</strong> from the supplier list.
          </p>
          {deleteTarget.company_name && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 20px' }}>
              Company: <strong>{deleteTarget.company_name}</strong>
            </p>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, background: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
              disabled={submitting}
              onClick={handleDelete}
            >
              {submitting ? 'Removing...' : 'Yes, Remove'}
            </button>
            <button className="btn btn-outline" onClick={close} disabled={submitting}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default SuppliersTab
