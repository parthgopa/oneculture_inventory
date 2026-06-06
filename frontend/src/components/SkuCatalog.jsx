import { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../config'
import {
  MdAdd, MdEdit, MdDelete, MdSearch, MdImage, MdClose,
  MdCheckCircle, MdWarning, MdLabel
} from 'react-icons/md'
import ImageUpload from './ImageUpload'

function SkuCatalog() {
  const [skus, setSkus]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [modal, setModal]         = useState(null) // 'create' | 'edit' | 'delete' | 'image'
  const [selected, setSelected]   = useState(null)
  const [form, setForm]           = useState({ sku_name: '', description: '', image: null, color: '', fabric: '', mrp: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(null)
  const [previewImg, setPreviewImg] = useState(null)

  useEffect(() => { fetchSkus() }, [])

  const fetchSkus = async () => {
    try {
      setLoading(true)
      const res = await apiFetch('/api/skus')
      const data = await res.json()
      setSkus(Array.isArray(data) ? data : [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  const flash = (msg, isErr) => {
    if (isErr) { setError(msg); setTimeout(() => setError(null), 4000) }
    else { setSuccess(msg); setTimeout(() => setSuccess(null), 2500) }
  }

  const openCreate = () => {
    setForm({ sku_name: '', description: '', image: null, color: '', fabric: '', mrp: '' })
    setError(null)
    setModal('create')
  }

  const openEdit = (sku) => {
    setSelected(sku)
    setForm({
      sku_name: sku.sku_name,
      description: sku.description || '',
      image: sku.image || null,
      color: sku.color || '',
      fabric: sku.fabric || '',
      mrp: sku.mrp != null ? String(sku.mrp) : '',
    })
    setError(null)
    setModal('edit')
  }

  const openDelete = (sku) => { setSelected(sku); setModal('delete') }
  const closeModal = () => { setModal(null); setSelected(null); setError(null) }

  const handleCreate = async () => {
    if (!form.sku_name.trim()) { setError('SKU name is required'); return }
    setSubmitting(true); setError(null)
    try {
      const res = await apiFetch('/api/skus', {
        method: 'POST',
        body: JSON.stringify({
          sku_name: form.sku_name.trim(),
          description: form.description,
          image: form.image,
          color: form.color,
          fabric: form.fabric,
          mrp: form.mrp !== '' ? form.mrp : null,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      flash('SKU created')
      closeModal()
      fetchSkus()
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const handleEdit = async () => {
    setSubmitting(true); setError(null)
    try {
      const body = {
        description: form.description,
        image: form.image,
        color: form.color,
        fabric: form.fabric,
        mrp: form.mrp !== '' ? form.mrp : null,
      }
      const res = await apiFetch(`/api/skus/${encodeURIComponent(selected.sku_name)}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      flash('SKU updated')
      closeModal()
      fetchSkus()
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/skus/${encodeURIComponent(selected.sku_name)}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      flash('Deleted')
      closeModal()
      fetchSkus()
    } catch (e) { flash(e.message, true) }
    finally { setSubmitting(false) }
  }

  const filtered = skus.filter(s =>
    s.sku_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.color || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.fabric || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <MdLabel size={30} style={{ verticalAlign: 'middle', marginRight: 10 }} />
          SKU Catalog
        </h1>
        <p className="page-subtitle">Global product name registry — used as autocomplete in cloth orders</p>
      </div>

      {success && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <MdCheckCircle size={18} /> {success}
        </div>
      )}
      {error && !modal && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          <MdWarning size={18} /> {error}
        </div>
      )}

      <div className="card">
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, padding: '16px 16px 0', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <MdSearch size={18} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: 34 }}
              placeholder="Search SKUs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            <MdAdd size={18} /> Add SKU
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><div className="loading" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 56 }}>
            <div className="empty-state-icon"><MdLabel size={52} /></div>
            <div className="empty-state-title">{search ? 'No matching SKUs' : 'No SKUs yet'}</div>
            <div className="empty-state-description">
              {search ? 'Try a different search term' : 'Add your first SKU to the catalog'}
            </div>
            {!search && (
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openCreate}>
                <MdAdd size={18} /> Add First SKU
              </button>
            )}
          </div>
        ) : (
          <div className="table-container" style={{ marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 64 }}>Image</th>
                  <th>SKU Name</th>
                  <th>Description</th>
                  <th>Color</th>
                  <th>Fabric</th>
                  <th>MRP</th>
                  <th>Added</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(sku => (
                  <tr key={sku.sku_name}>
                    <td>
                      {sku.image ? (
                        <img
                          src={sku.image}
                          alt={sku.sku_name}
                          style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-color)' }}
                          onClick={() => setPreviewImg(sku.image)}
                        />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)' }}>
                          <MdImage size={20} style={{ color: 'var(--text-secondary)' }} />
                        </div>
                      )}
                    </td>
                    <td><strong>{sku.sku_name}</strong></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{sku.description || '—'}</td>
                    <td style={{ fontSize: 13 }}>
                      {sku.color ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 12, height: 12, borderRadius: '50%', background: sku.color, border: '1px solid var(--border-color)', display: 'inline-block' }} />
                          {sku.color}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {sku.fabric ? sku.fabric : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {sku.mrp != null ? (
                        <span>₹{Number(sku.mrp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sku.created_at ? new Date(sku.created_at).toLocaleDateString() : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-outline" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => openEdit(sku)}>
                          <MdEdit size={14} /> Edit
                        </button>
                        <button className="btn btn-outline" style={{ padding: '5px 10px', fontSize: 12, color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }} onClick={() => openDelete(sku)}>
                          <MdDelete size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', borderTop: filtered.length ? '1px solid var(--border-color)' : 'none' }}>
          {filtered.length} SKU{filtered.length !== 1 ? 's' : ''}{search ? ' matching' : ' in catalog'}
        </div>
      </div>

      {/* ── Create / Edit Modal ──────────────────────────────────────────────── */}
      {(modal === 'create' || modal === 'edit') && (
        <div style={OVERLAY_STYLE} onClick={closeModal}>
          <div style={MODAL_STYLE} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>{modal === 'create' ? 'Add SKU' : `Edit — ${selected?.sku_name}`}</h3>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><MdClose size={22} /></button>
            </div>

            {error && (
              <div className="alert alert-danger" style={{ marginBottom: 12 }}><MdWarning size={16} /> {error}</div>
            )}

            {modal === 'create' && (
              <div className="form-group">
                <label className="form-label">SKU Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Kia Vine Saree"
                  value={form.sku_name}
                  onChange={e => setForm(p => ({ ...p, sku_name: e.target.value }))}
                  autoFocus
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Description</label>
              <input
                className="form-input"
                placeholder="Optional short description"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                autoFocus={modal === 'edit'}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Color</label>
                <input
                  className="form-input"
                  placeholder="e.g. Ivory, Red"
                  value={form.color}
                  onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Fabric</label>
                <input
                  className="form-input"
                  placeholder="e.g. Cotton, Silk"
                  value={form.fabric}
                  onChange={e => setForm(p => ({ ...p, fabric: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">MRP <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(₹, optional)</span></label>
              <input
                className="form-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 999.00"
                value={form.mrp}
                onChange={e => setForm(p => ({ ...p, mrp: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Product Image <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
              </label>
              <ImageUpload
                currentImage={form.image}
                onImageChange={img => setForm(p => ({ ...p, image: img }))}
                onImageRemove={() => setForm(p => ({ ...p, image: null }))}
                maxSizeMB={20}
                compressThresholdMB={2}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={submitting}
                onClick={modal === 'create' ? handleCreate : handleEdit}
              >
                {submitting ? 'Saving…' : modal === 'create' ? 'Create SKU' : 'Save Changes'}
              </button>
              <button className="btn btn-outline" onClick={closeModal} disabled={submitting}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ─────────────────────────────────────────────── */}
      {modal === 'delete' && (
        <div style={OVERLAY_STYLE} onClick={closeModal}>
          <div style={{ ...MODAL_STYLE, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px' }}>Delete SKU?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 20px' }}>
              This removes <strong>{selected?.sku_name}</strong> from the catalog. Existing cloth orders are not affected.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, background: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                disabled={submitting}
                onClick={handleDelete}
              >
                {submitting ? 'Deleting…' : 'Delete'}
              </button>
              <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Image Preview ────────────────────────────────────────────────────── */}
      {previewImg && (
        <div style={{ ...OVERLAY_STYLE, background: 'rgba(0,0,0,0.75)' }} onClick={() => setPreviewImg(null)}>
          <img src={previewImg} alt="preview" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 10, objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}

const OVERLAY_STYLE = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 16
}
const MODAL_STYLE = {
  background: 'white', borderRadius: 14, padding: 28,
  width: '100%', maxWidth: 520,
  boxShadow: '0 20px 60px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto'
}

export default SkuCatalog
