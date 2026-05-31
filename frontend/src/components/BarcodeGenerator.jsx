import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE_URL, apiFetch } from '../config'
import { 
  MdQrCode2, 
  MdDownload, 
  MdCheckCircle,
  MdError,
  MdAdd,
  MdHistory,
  MdVisibility
} from 'react-icons/md'
import ImageUpload from './ImageUpload'

// ─── component ────────────────────────────────────────────────────────────────

function BarcodeGenerator() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // ── state ────────────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    company_name: 'ONėCULTURE',
    sku_name: searchParams.get('sku_name') || '',
    size: searchParams.get('size') || '',
    mrp: searchParams.get('mrp') || '',
    quantity: parseInt(searchParams.get('quantity') || '1'),
  })

  const fromProduction = !!(searchParams.get('sku_name'))
  const [productImage, setProductImage] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState(null)
  const [generatedBatch, setGeneratedBatch] = useState(null)
  const [batchHistory, setBatchHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    fetchBatchHistory()
  }, [])

  const fetchBatchHistory = async () => {
    try {
      const response = await apiFetch('/api/barcode-batches')
      const data = await response.json()
      setBatchHistory(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching batch history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  // ── handlers ─────────────────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setGenerating(true)
    setMessage(null)

    try {
      const payload = {
        ...formData,
        product_image: productImage  // Include image if present
      }

      const response = await apiFetch('/api/barcode-batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({
          type: 'success',
          text: `✓ Successfully generated ${formData.quantity} barcode(s)!`,
        })
        setGeneratedBatch(data)
        // Keep SKU name, size, MRP but reset quantity to 1 for next batch
        setFormData(prev => ({
          ...prev,
          quantity: 1,
        }))
        // Don't clear product image
        fetchBatchHistory()
        
        // Navigate to batch details page
        setTimeout(() => {
          navigate(`/batch/${data.batch_id}`)
        }, 1500)
      } else {
        setMessage({
          type: 'error',
          text: `✗ ${data.error || 'Failed to generate barcodes'}`,
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: '✗ Network error. Please check your connection.',
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleViewDetails = (batchId) => {
    navigate(`/batch/${batchId}`)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <MdQrCode2 size={32} style={{ verticalAlign: 'middle', marginRight: '12px' }} />
          Barcode Generator
        </h1>
        <p className="page-subtitle">Generate barcode batches for inventory items</p>
      </div>

      {fromProduction && (
        <div className="alert alert-success" style={{ marginBottom: 20 }}>
          <MdCheckCircle size={20} />
          <span>
            Pre-filled from Production — <strong>{formData.sku_name}</strong> ({formData.quantity} pieces).
            Review and click <strong>Generate Barcodes</strong>.
          </span>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Generate New Batch</h2>
          </div>

          {message && (
            <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'}`}>
              {message.type === 'success' ? (
                <MdCheckCircle size={20} style={{ flexShrink: 0 }} />
              ) : (
                <MdError size={20} style={{ flexShrink: 0 }} />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Company Name *</label>
              <input
                type="text"
                name="company_name"
                className="form-input"
                placeholder="Enter company name"
                value={formData.company_name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">SKU Name *</label>
              <input
                type="text"
                name="sku_name"
                className="form-input"
                placeholder="Enter SKU name"
                value={formData.sku_name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Size</label>
              <input
                type="text"
                name="size"
                className="form-input"
                placeholder="e.g. S, M, L, XL, 30, 32..."
                value={formData.size}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">MRP (₹) *</label>
              <input
                type="number"
                name="mrp"
                className="form-input"
                placeholder="Enter MRP"
                value={formData.mrp}
                onChange={handleInputChange}
                step="0.01"
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Quantity *</label>
              <input
                type="number"
                name="quantity"
                className="form-input"
                placeholder="Number of barcodes to generate"
                value={formData.quantity}
                onChange={handleInputChange}
                min="1"
                max="1000"
                required
              />
            </div>

            {/* Product Image Upload (Optional) */}
            <div className="form-group">
              <label className="form-label">
                Product Image <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
              </label>
              <ImageUpload
                currentImage={productImage}
                onImageChange={setProductImage}
                onImageRemove={() => setProductImage(null)}
                maxSizeMB={20}
                compressThresholdMB={2}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={generating}
              style={{ width: '100%' }}
            >
              {generating ? (
                <>
                  <span className="loading"></span>
                  Generating...
                </>
              ) : (
                <>
                  <MdAdd size={20} /> Generate Barcodes
                </>
              )}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Generated Batch</h2>
          </div>

          {generatedBatch ? (
            <div>
              <div className="alert alert-success">
                <MdCheckCircle size={24} />
                <div>
                  <div><strong>Batch Created Successfully!</strong></div>
                  <div style={{ marginTop: '4px', fontSize: '14px' }}>
                    {generatedBatch.barcodes.length} barcodes generated
                  </div>
                </div>
              </div>

              <div style={{ 
                marginTop: '20px', 
                padding: '16px', 
                background: 'var(--bg-secondary)', 
                borderRadius: '8px' 
              }}>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Batch ID:</strong> <code>{generatedBatch.batch_id}</code>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
                  Redirecting to batch details page...
                </p>
                <button
                  onClick={() => handleViewDetails(generatedBatch.batch_id)}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  <MdVisibility size={20} /> View Batch Details
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon"><MdQrCode2 size={64} /></div>
              <div className="empty-state-title">No batch generated yet</div>
              <div className="empty-state-description">
                Fill the form and generate barcodes to see details here
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Batch History Section */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h2 className="card-title">
            <MdHistory size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            Batch History
          </h2>
        </div>

        {loadingHistory ? (
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <div className="loading"></div>
          </div>
        ) : batchHistory.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  {/* <th>Company</th> */}
                  <th>SKU</th>
                  <th>MRP</th>
                  <th>Quantity</th>
                  <th>Created</th>
                  <th style={{ width: '200px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batchHistory.map((batch) => (
                  <tr key={batch.batch_id}>
                    <td><code>{batch.batch_id}</code></td>
                    {/* <td>{batch.company_name}</td> */}
                    <td><strong>{batch.sku_name}</strong></td>
                    <td>₹{batch.mrp?.toFixed(2)}</td>
                    <td>
                      <span className="badge badge-primary">{batch.quantity}</span>
                    </td>
                    <td>{new Date(batch.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleViewDetails(batch.batch_id)}
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          <MdVisibility size={16} /> View
                        </button>
                        {/* <button
                          onClick={() => apiFetch(`/api/barcode-batches/${batch.batch_id}/download`).then(r => r.blob()).then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `barcode-batch-${batch.batch_id}.pdf`; a.click() })}
                          className="btn btn-outline"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          <MdDownload size={16} />
                        </button> */}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><MdHistory size={64} /></div>
            <div className="empty-state-title">No batch history</div>
            <div className="empty-state-description">
              Generated batches will appear here
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BarcodeGenerator
