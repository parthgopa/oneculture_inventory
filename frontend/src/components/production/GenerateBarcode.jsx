import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../config'
import {
  MdQrCode2,
  MdCheckCircle,
  MdError,
  MdAdd,
  MdHistory,
  MdVisibility,
  MdImage
} from 'react-icons/md'
import ImageUpload from '../ImageUpload'

function GenerateBarcode({ readyItems = [] }) {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    company_name: 'ONėCULTURE',
    sku_name: '',
    size: '',
    color: '',
    mrp: '',
    quantity: 1,
  })

  const [availableColors, setAvailableColors] = useState([])
  const [productImage, setProductImage]   = useState(null)
  const [generating, setGenerating]       = useState(false)
  const [message, setMessage]             = useState(null)
  const [generatedBatch, setGeneratedBatch] = useState(null)
  const [batchHistory, setBatchHistory]   = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [skuCatalogImages, setSkuCatalogImages] = useState({})

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

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Fetch available colors and clear product image when SKU changes
  useEffect(() => {
    if (!formData.sku_name) {
      setAvailableColors([])
      setProductImage(null)
      return
    }
    apiFetch(`/api/production/sku-colors?sku_name=${encodeURIComponent(formData.sku_name)}`)
      .then(r => r.json())
      .then(data => {
        if (data.colors) setAvailableColors(data.colors)
      })
      .catch(() => setAvailableColors([]))
  }, [formData.sku_name])

  // Fetch SKU image from catalog when selecting an item
  const fetchSkuImage = async (skuName) => {
    try {
      const response = await apiFetch(`/api/skus/${encodeURIComponent(skuName)}`)
      if (response.ok) {
        const data = await response.json()
        setProductImage(data.image || null)
      }
    } catch (error) {
      console.error('Error fetching SKU image:', error)
    }
  }

  // Fetch SKU catalog images for all ready items
  useEffect(() => {
    const fetchAllSkuImages = async () => {
      const uniqueSkus = [...new Set(readyItems.map(item => item.sku_name).filter(Boolean))]
      const images = {}
      for (const sku of uniqueSkus) {
        try {
          const response = await apiFetch(`/api/skus/${encodeURIComponent(sku)}`)
          if (response.ok) {
            const data = await response.json()
            if (data.image) images[sku] = data.image
          }
        } catch (error) {
          // Silently fail for individual SKUs
        }
      }
      setSkuCatalogImages(images)
    }
    if (readyItems.length > 0) {
      fetchAllSkuImages()
    }
  }, [readyItems])

  const handleReadyItemSelect = (item) => {
    setFormData({
      company_name: 'ONėCULTURE',
      sku_name: item.sku_name || '',
      size: item.size || '',
      color: item.color || '',
      mrp: item.mrp ? String(item.mrp) : '',
      quantity: item.quantity || 1,
    })
    setMessage(null)
    setGeneratedBatch(null)
    // Fetch SKU image from catalog
    if (item.sku_name) {
      fetchSkuImage(item.sku_name)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setGenerating(true)
    setMessage(null)

    try {
      const payload = {
        ...formData,
        product_image: productImage
      }

      const response = await apiFetch('/api/barcode-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({
          type: 'success',
          text: `✓ Successfully generated ${formData.quantity} barcode(s)!`,
        })
        setGeneratedBatch(data)
        // Keep SKU name, size, color, MRP but reset quantity to 1 for next batch
        setFormData(prev => ({
          ...prev,
          quantity: 1,
        }))
        // Don't clear product image or fetch history yet
        fetchBatchHistory()
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

  // Get next barcode number for current SKU
  const getNextBarcodeNumber = () => {
    if (!formData.sku_name) return null
    
    // Find the last barcode for this SKU
    const lastBarcode = batchHistory
      .filter(b => b.sku_name === formData.sku_name && b.barcode_id)
      .sort((a, b) => b.barcode_id.localeCompare(a.barcode_id))[0]
    
    if (lastBarcode && lastBarcode.barcode_id) {
      // Extract the last 4 digits from the previous barcode
      const lastNumber = parseInt(lastBarcode.barcode_id.slice(-4))
      return lastNumber + 1
    }
    return 1
  }

  return (
    <div>
      {/* SKU Status Summary - Always show all SKUs with barcode status */}
      {readyItems.length > 0 && readyItems.some(item => {
        const gen = batchHistory.filter(b => b.sku_name === item.sku_name && (!item.color || b.color === item.color)).reduce((s, b) => s + (b.quantity || b.total_barcodes || 0), 0)
        return gen < item.quantity
      }) && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3 className="card-title">
              <MdQrCode2 size={18} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--primary-color)' }} />
              SKU Barcode Status
            </h3>
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            {readyItems.map((item, i) => {
              const skuImage = skuCatalogImages[item.sku_name]
              // Calculate barcodes generated for this SKU+color
              const matchingBatches = batchHistory.filter(b =>
                b.sku_name === item.sku_name &&
                (!item.color || b.color === item.color)
              )
              // API returns 'quantity' (count of barcodes in group), not 'total_barcodes'
              const generatedForSku = matchingBatches.reduce((sum, b) => sum + (b.quantity || b.total_barcodes || 0), 0)
              const remaining = Math.max(0, item.quantity - generatedForSku)
              const isCompleted = remaining === 0
              // Debug log
              console.log('[Barcode Status]', {
                sku: item.sku_name, color: item.color,
                totalReceived: item.quantity,
                matchingBatches: matchingBatches.length,
                batchDetails: matchingBatches.map(b => ({ batch_id: b.batch_id, quantity: b.quantity, total_barcodes: b.total_barcodes, color: b.color })),
                generatedForSku, remaining
              })

              // Hide completed items
              if (isCompleted) return null

              return (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px',
                  marginBottom: i < readyItems.length - 1 ? '8px' : '0',
                  backgroundColor: isCompleted ? '#f0fdf4' : '#fefce8',
                  border: `1px solid ${isCompleted ? '#86efac' : '#fde047'}`,
                  borderRadius: 8
                }}>
                  {skuImage ? (
                    <img
                      src={skuImage}
                      alt={item.sku_name}
                      style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ 
                      width: 40, height: 40, borderRadius: 6, 
                      background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <MdImage size={20} color="#9ca3af" />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                      {item.sku_name}
                      {item.size && <span style={{ fontWeight: 400, color: '#6b7280' }}> · {item.size}</span>}
                      {item.color && <span style={{ fontWeight: 400, color: '#6b7280' }}> · {item.color}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      Total: {item.quantity} | Generated: {generatedForSku} | Remaining: {remaining}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {isCompleted ? (
                      <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 600 }}>
                        ✓ Completed
                      </span>
                    ) : (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                        onClick={() => handleReadyItemSelect(item)}
                      >
                        Generate {remaining} more
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2 className="card-title">
            Generate New Batch
            {formData.sku_name && (
              <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 8 }}>
                - SKU: {formData.sku_name}
                {getNextBarcodeNumber() && (
                  <span style={{ color: '#059669', marginLeft: 8 }}>
                    Next #: {getNextBarcodeNumber().toString().padStart(4, '0')}
                  </span>
                )}
              </span>
            )}
          </h2>
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
              <label className="form-label">Color</label>
              {availableColors.length > 0 ? (
                <select
                  name="color"
                  className="form-input"
                  value={formData.color}
                  onChange={handleInputChange}
                >
                  <option value="">Select Color...</option>
                  <option value="">No Color / Plain</option>
                  {availableColors.map((color, i) => (
                    <option key={i} value={color}>{color}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="color"
                  className="form-input"
                  placeholder="e.g. Red, Blue, Green..."
                  value={formData.color}
                  onChange={handleInputChange}
                />
              )}
              {formData.sku_name && availableColors.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  No colors found for this SKU in cloth orders. Type manually.
                </div>
              )}
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

            <div className="form-group">
              <label className="form-label">
                Product Image <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
              </label>
              {productImage && formData.sku_name && (
                <div style={{ fontSize: 11, color: 'var(--success-color)', marginBottom: 6 }}>
                  <MdCheckCircle size={12} /> Auto-loaded from SKU catalog
                </div>
              )}
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
                <><span className="loading"></span>Generating...</>
              ) : (
                <><MdAdd size={20} /> Generate Barcodes</>
              )}
            </button>
          </form>
        </div>

        {/* Success message after generation */}
        {generatedBatch && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="alert alert-success" style={{ margin: 0 }}>
              <MdCheckCircle size={24} />
              <div>
                <div><strong>Batch Created Successfully!</strong></div>
                <div style={{ marginTop: 4, fontSize: 14 }}>
                  {generatedBatch.barcodes.length} barcodes generated • Batch ID: <code>{generatedBatch.batch_id}</code>
                </div>
                <button
                  onClick={() => handleViewDetails(generatedBatch.batch_id)}
                  className="btn btn-primary"
                  style={{ marginTop: 12 }}
                >
                  <MdVisibility size={18} /> View Batch Details
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Batch History */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h2 className="card-title">
            <MdHistory size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Batch History
          </h2>
        </div>

        {loadingHistory ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <div className="loading"></div>
          </div>
        ) : batchHistory.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>SKU</th>
                  <th>Size/Color</th>
                  <th>MRP</th>
                  <th>Quantity</th>
                  <th>Created</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batchHistory.map((batch) => (
                  <tr key={batch.batch_id}>
                    <td><code>{batch.batch_id}</code></td>
                    <td><strong>{batch.sku_name}</strong></td>
                    <td>
                      {batch.size && <span className="badge" style={{background: '#e0e7ff', color: '#4338ca', marginRight: 4}}>{batch.size}</span>}
                      {batch.color && <span className="badge" style={{background: '#fce7f3', color: '#be185d'}}>{batch.color}</span>}
                    </td>
                    <td>₹{batch.mrp?.toFixed(2)}</td>
                    <td><span className="badge badge-primary">{batch.quantity}</span></td>
                    <td>{new Date(batch.created_at).toLocaleDateString('en-GB')}</td>
                    <td>
                      <button
                        onClick={() => handleViewDetails(batch.batch_id)}
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                      >
                        <MdVisibility size={16} /> View
                      </button>
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
            <div className="empty-state-description">Generated batches will appear here</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GenerateBarcode
