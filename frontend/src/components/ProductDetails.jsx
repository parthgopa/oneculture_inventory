import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { apiFetch, API_BASE_URL } from '../config'
import {
  MdArrowBack,
  MdInventory,
  MdDownload,
  MdTrendingUp,
  MdTrendingDown,
  MdHistory,
  MdQrCode2,
  MdDelete,
  MdWarning,
  MdClose,
  MdCheckCircle,
  MdCancel,
  MdBarChart,
  MdPrint,
  MdFilterList
} from 'react-icons/md'
import ImageUpload from './ImageUpload'

// ─── component ────────────────────────────────────────────────────────────────

function ProductDetails() {
  const { skuName } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const companyName = searchParams.get('company') || ''
  const color = searchParams.get('color') || ''
  
  // ── state ────────────────────────────────────────────────────────────────────
  const [loading, setLoading]         = useState(true)
  const [productData, setProductData] = useState(null)
  const [error, setError]             = useState(null)
  const [savingImage, setSavingImage] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [barcodeFilter, setBarcodeFilter] = useState('all') // all, scanned, unscanned
  const [showStockStatusModal, setShowStockStatusModal] = useState(false)
  const [stockFilter, setStockFilter] = useState('all') // all, in-stock, not-in-stock

  // ── data fetching ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchProductDetails()
  }, [skuName, companyName, color])

  const fetchProductDetails = async () => {
    try {
      setLoading(true)
      const colorParam = color ? `&color=${encodeURIComponent(color)}` : ''
      const response = await apiFetch(`/api/inventory/product/${encodeURIComponent(skuName)}?company=${encodeURIComponent(companyName)}${colorParam}`)
      
      if (!response.ok) {
        throw new Error('Product not found')
      }
      
      const data = await response.json()
      setProductData(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── image upload ─────────────────────────────────────────────────────────────
  const handleImageChange = async (base64Image) => {
    if (!productData?.batch_id) return
    
    setSavingImage(true)
    try {
      const response = await apiFetch(
        `/api/barcode-batches/${productData.batch_id}/image`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_image: base64Image })
        }
      )
      
      if (response.ok) {
        fetchProductDetails()
      }
    } catch (err) {
      console.error('Error uploading image:', err)
    } finally {
      setSavingImage(false)
    }
  }

  // ── CSV export ───────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const colorParam = color ? `&color=${encodeURIComponent(color)}` : ''
    apiFetch(`/api/inventory/product/${encodeURIComponent(skuName)}/export?company=${encodeURIComponent(companyName)}${colorParam}`)
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${skuName}_export.csv`
        a.click()
      })
  }

  // ── delete product ──────────────────────────────────────────────────────────
  const handleDeleteProduct = async () => {
    setDeleting(true)
    try {
      const colorParam = color ? `&color=${encodeURIComponent(color)}` : ''
      const response = await apiFetch(
        `/api/inventory/product/${encodeURIComponent(skuName)}?company=${encodeURIComponent(companyName)}${colorParam}`,
        { method: 'DELETE' }
      )
      
      if (response.ok) {
        navigate('/inventory', { replace: true })
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete product')
      }
    } catch (err) {
      console.error('Error deleting product:', err)
      alert('Failed to delete product')
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  // ── helpers ──────────────────────────────────────────────────────────────────
  const getStockStatus = (stock) => {
    if (stock === 0) return { label: 'Out of Stock', class: 'danger' }
    if (stock < 10) return { label: 'Low Stock', class: 'warning' }
    return { label: 'In Stock', class: 'success' }
  }

  const handlePrintBarcode = (barcodeId) => {
    const printWindow = window.open('', '_blank')
    const colorDisplay = productData.color ? `<div class="color" style="font-size: 14px; color: #6366f1; margin-bottom: 10px; font-weight: 600;">Color: ${productData.color}</div>` : ''
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcode - ${barcodeId}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background: #f5f5f5;
            }
            .barcode-container {
              text-align: center;
              border: 2px solid #333;
              padding: 30px;
              border-radius: 8px;
              background: white;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .product-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 6px;
              color: #333;
            }
            .company-name {
              font-size: 16px;
              color: #666;
              margin-bottom: 10px;
            }
            .color {
              font-size: 14px;
              color: #6366f1;
              margin-bottom: 15px;
              font-weight: 600;
            }
            .mrp {
              font-size: 20px;
              margin-top: 15px;
              color: #059669;
              font-weight: bold;
            }
            @media print {
              body { padding: 20px; background: white; }
              .no-print { display: none; }
              .barcode-container { box-shadow: none; border: 1px solid #ccc; }
            }
          </style>
        </head>
        <body>
          <div class="barcode-container">
            <div class="product-name">${productData.sku_name}</div>
            <div class="company-name">${productData.company_name}</div>
            ${colorDisplay}
            <svg id="barcode"></svg>
            <div class="mrp">MRP: ₹${productData.mrp.toFixed(2)}</div>
          </div>
          <div class="no-print" style="margin-top: 30px;">
            <button onclick="window.print()" style="padding: 12px 24px; font-size: 16px; cursor: pointer; background: #3b82f6; color: white; border: none; border-radius: 6px; margin-right: 10px;">
              Print
            </button>
            <button onclick="window.close()" style="padding: 12px 24px; font-size: 16px; cursor: pointer; background: #6b7280; color: white; border: none; border-radius: 6px;">
              Close
            </button>
          </div>
          <script>
            JsBarcode("#barcode", "${barcodeId}", {
              format: "CODE128",
              width: 2.5,
              height: 100,
              displayValue: true,
              fontSize: 16,
              margin: 10,
              background: "#ffffff",
              lineColor: "#000000"
            });
          <\/script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <div className="loading"></div>
        <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Loading product details...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2>Product Not Found</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/inventory')} style={{ marginTop: 16 }}>
          <MdArrowBack size={18} /> Back to Inventory
        </button>
      </div>
    )
  }

  const { barcodes = [], recent_scans = [] } = productData
  const status = getStockStatus(productData.total_stock)

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
        <button 
          className="btn btn-outline" 
          onClick={() => navigate('/inventory')}
          style={{ padding: '8px 12px' }}
        >
          <MdArrowBack size={20} />
        </button>
        
        <div style={{ flex: 1 }}>
          <h1 className="page-title" style={{ marginBottom: 4 }}>
            <MdInventory size={28} style={{ verticalAlign: 'middle', marginRight: 10 }} />
            {productData.sku_name}
          </h1>
          <p className="page-subtitle">
            {productData.company_name}
            {productData.color && <span style={{color: '#6366f1', fontWeight: 600}}> • Color: {productData.color}</span>}
            {' • MRP: ₹'}{productData.mrp?.toFixed(2)}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={handleExportCSV}>
            <MdDownload size={18} /> Export CSV
          </button>
          <button 
            className="btn" 
            onClick={() => setShowDeleteModal(true)}
            style={{ 
              backgroundColor: 'var(--danger-color)', 
              color: 'white',
              border: 'none'
            }}
          >
            <MdDelete size={18} /> Delete
          </button>
        </div>
      </div>

      {/* ── Delete Confirmation Modal ─────────────────────────────────────── */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: 12,
            padding: 24,
            maxWidth: 420,
            width: '90%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <MdWarning size={28} style={{ color: 'var(--danger-color)' }} />
              <h3 style={{ margin: 0 }}>Delete Product</h3>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
              Are you sure you want to delete <strong>{productData.sku_name}</strong>
              {productData.color && <span style={{color: '#6366f1'}}> ({productData.color})</span>}?
            </p>
            <p style={{ color: 'var(--danger-color)', fontSize: 14, marginBottom: 20 }}>
              This will permanently delete all {productData.total_barcodes} barcodes and their scan history.
              This action cannot be undone.
            </p>
            
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-outline"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                className="btn"
                onClick={handleDeleteProduct}
                disabled={deleting}
                style={{ 
                  backgroundColor: 'var(--danger-color)', 
                  color: 'white',
                  border: 'none'
                }}
              >
                {deleting ? (
                  <><span className="loading"></span> Deleting...</>
                ) : (
                  <><MdDelete size={18} /> Delete Product</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Product Info Card ───────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {/* Product Image */}
          <div style={{ flexShrink: 0 }}>
            {savingImage && (
              <div style={{ 
                position: 'absolute', 
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(255,255,255,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}>
                <div className="loading"></div>
              </div>
            )}
            <ImageUpload
              currentImage={productData.product_image}
              onImageChange={handleImageChange}
              onImageRemove={() => handleImageChange(null)}
              maxSizeMB={20}
              compressThresholdMB={2}
            />
          </div>

          {/* Stats */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <div style={{ padding: 16, backgroundColor: 'var(--bg-secondary)', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary-color)' }}>
                {productData.total_stock}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Current Stock</div>
              <span className={`badge badge-${status.class}`} style={{ marginTop: 8 }}>{status.label}</span>
            </div>
            
            <div style={{ padding: 16, backgroundColor: 'var(--bg-secondary)', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success-color)' }}>
                +{productData.total_in}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total Stock In</div>
            </div>
            
            <div style={{ padding: 16, backgroundColor: 'var(--bg-secondary)', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--danger-color)' }}>
                -{productData.total_out}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total Stock Out</div>
            </div>
            
            <div 
              style={{ 
                padding: 16, 
                backgroundColor: 'var(--bg-secondary)', 
                borderRadius: 10, 
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: '2px solid transparent'
              }}
              onClick={() => setShowBarcodeModal(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary-light)'
                e.currentTarget.style.borderColor = 'var(--primary-color)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'
                e.currentTarget.style.borderColor = 'transparent'
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 700 }}>
                {productData.total_barcodes}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total Generated</div>
              <div style={{ fontSize: 11, color: 'var(--primary-color)', marginTop: 4, fontWeight: 600 }}>
                <MdBarChart size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                View Details
              </div>
            </div>

            <div 
              style={{ 
                padding: 16, 
                backgroundColor: 'var(--bg-secondary)', 
                borderRadius: 10, 
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: '2px solid transparent',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 8
              }}
              onClick={() => setShowStockStatusModal(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--success-light)'
                e.currentTarget.style.borderColor = 'var(--success-color)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'
                e.currentTarget.style.borderColor = 'transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success-color)' }}>
                    {barcodes.filter(b => b.current_stock > 0).length}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>In Stock</div>
                </div>
                <div style={{ fontSize: 20, color: 'var(--text-secondary)' }}>/</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--warning-color)' }}>
                    {barcodes.filter(b => b.current_stock === 0).length}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Not In Stock</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--success-color)', fontWeight: 600 }}>
                <MdFilterList size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                View Stock Status
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Generated Barcodes Overview ─────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">
            <MdQrCode2 size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Generated Barcodes ({barcodes.length})
          </h3>
          <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
            <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>
              <MdCheckCircle size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {barcodes.filter(b => b.total_scans > 0).length} Scanned
            </span>
            <span style={{ color: 'var(--warning-color)', fontWeight: 600 }}>
              <MdCancel size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {barcodes.filter(b => b.total_scans === 0).length} Unscanned
            </span>
          </div>
        </div>

        {barcodes.length > 0 ? (
          <div className="table-container" style={{ maxHeight: 500, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Barcode ID</th>
                  <th style={{ textAlign: 'center' }}>Scan Status</th>
                  <th style={{ textAlign: 'center' }}>Total Scans</th>
                  <th style={{ textAlign: 'center' }}>Stock In</th>
                  <th style={{ textAlign: 'center' }}>Stock Out</th>
                  <th style={{ textAlign: 'center' }}>Current</th>
                  <th>Last Scanned</th>
                </tr>
              </thead>
              <tbody>
                {barcodes.map((bc) => {
                  const isScanned = bc.total_scans > 0
                  const bcStatus = getStockStatus(bc.current_stock)
                  return (
                    <tr 
                      key={bc.barcode_id}
                      style={{ 
                        backgroundColor: isScanned ? 'transparent' : 'var(--warning-light)',
                        opacity: isScanned ? 1 : 0.85
                      }}
                    >
                      <td>
                        <code style={{ 
                          fontSize: 12,
                          padding: '4px 8px',
                          backgroundColor: isScanned ? 'var(--bg-secondary)' : 'rgba(245, 158, 11, 0.2)',
                          borderRadius: 4
                        }}>
                          {bc.barcode_id}
                        </code>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isScanned ? (
                          <span style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            color: 'var(--success-color)',
                            fontSize: 13,
                            fontWeight: 600
                          }}>
                            <MdCheckCircle size={18} />
                            Scanned
                          </span>
                        ) : (
                          <span style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            color: 'var(--warning-color)',
                            fontSize: 13,
                            fontWeight: 600
                          }}>
                            <MdCancel size={18} />
                            Not Scanned
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isScanned ? (
                          <span className="badge badge-primary">{bc.total_scans}</span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isScanned ? (
                          <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>
                            +{bc.in_count || 0}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isScanned ? (
                          <span style={{ color: 'var(--danger-color)', fontWeight: 600 }}>
                            -{bc.out_count || 0}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isScanned ? (
                          <>
                            <strong>{bc.current_stock}</strong>
                            <span className={`badge badge-${bcStatus.class}`} style={{ marginLeft: 8, fontSize: 10 }}>
                              {bcStatus.label}
                            </span>
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {bc.last_scanned ? (
                          new Date(bc.last_scanned).toLocaleString()
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            Never scanned
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon"><MdQrCode2 size={48} /></div>
            <div className="empty-state-title">No barcodes generated</div>
            <div className="empty-state-description">Generate barcodes to see them here</div>
          </div>
        )}
      </div>

      {/* ── Scan History ────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <MdHistory size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Recent Scan History ({recent_scans.length})
          </h3>
        </div>

        {recent_scans.length > 0 ? (
          <div className="table-container" style={{ maxHeight: 350, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Barcode ID</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recent_scans.map((scan, idx) => (
                  <tr key={scan._id || idx}>
                    <td style={{ fontSize: 12 }}>{new Date(scan.timestamp).toLocaleString()}</td>
                    <td><code style={{ fontSize: 12 }}>{scan.barcode_id}</code></td>
                    <td>
                      <span className={`badge ${scan.action_type === 'IN' ? 'badge-success' : 'badge-danger'}`}>
                        {scan.action_type === 'IN' ? (
                          <><MdTrendingUp size={14} /> Stock In</>
                        ) : (
                          <><MdTrendingDown size={14} /> Stock Out</>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon"><MdHistory size={48} /></div>
            <div className="empty-state-title">No scan history</div>
            <div className="empty-state-description">Scan events will appear here</div>
          </div>
        )}
      </div>

      {/* ── Barcode Status Modal ──────────────────────────────────────────────── */}
      {showBarcodeModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20
          }}
          onClick={() => setShowBarcodeModal(false)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: 16,
              maxWidth: 900,
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ 
              padding: '24px 24px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdBarChart size={24} />
                  Barcode Status Overview
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                  {productData.sku_name}
                  {productData.color && <span style={{color: '#6366f1', marginLeft: 6}}>• Color: {productData.color}</span>}
                </p>
              </div>
              <button
                onClick={() => setShowBarcodeModal(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--bg-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border-color)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
              >
                <MdClose size={20} />
              </button>
            </div>

            {/* Summary Stats */}
            <div style={{ 
              padding: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12,
              backgroundColor: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <div style={{ textAlign: 'center', padding: 12, backgroundColor: 'white', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary-color)' }}>
                  {barcodes.length}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Total Generated
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, backgroundColor: 'white', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success-color)' }}>
                  {barcodes.filter(b => b.total_scans > 0).length}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Scanned
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, backgroundColor: 'white', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning-color)' }}>
                  {barcodes.filter(b => b.total_scans === 0).length}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Unscanned
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, backgroundColor: 'white', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {barcodes.reduce((sum, b) => sum + b.total_scans, 0)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Total Scans
                </div>
              </div>
            </div>

            {/* Filters */}
            <div style={{ 
              padding: '16px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => setBarcodeFilter('all')}
                className={`btn ${barcodeFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: 13, padding: '6px 16px' }}
              >
                All ({barcodes.length})
              </button>
              <button
                onClick={() => setBarcodeFilter('scanned')}
                className={`btn ${barcodeFilter === 'scanned' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: 13, padding: '6px 16px' }}
              >
                <MdCheckCircle size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Scanned ({barcodes.filter(b => b.total_scans > 0).length})
              </button>
              <button
                onClick={() => setBarcodeFilter('unscanned')}
                className={`btn ${barcodeFilter === 'unscanned' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: 13, padding: '6px 16px' }}
              >
                <MdCancel size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Unscanned ({barcodes.filter(b => b.total_scans === 0).length})
              </button>
            </div>

            {/* Barcode List */}
            <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
              {(() => {
                const filteredBarcodes = barcodes.filter(b => {
                  if (barcodeFilter === 'scanned') return b.total_scans > 0
                  if (barcodeFilter === 'unscanned') return b.total_scans === 0
                  return true
                })

                if (filteredBarcodes.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                      <MdQrCode2 size={48} style={{ opacity: 0.3 }} />
                      <div style={{ marginTop: 12 }}>No barcodes found</div>
                    </div>
                  )
                }

                return (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Barcode ID</th>
                          <th style={{ textAlign: 'center' }}>Status</th>
                          <th style={{ textAlign: 'center' }}>Total Scans</th>
                          <th style={{ textAlign: 'center' }}>Stock In</th>
                          <th style={{ textAlign: 'center' }}>Stock Out</th>
                          <th style={{ textAlign: 'center' }}>Current</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBarcodes.map((barcode) => (
                          <tr key={barcode.barcode_id}>
                            <td>
                              <code style={{ 
                                fontSize: 12, 
                                padding: '4px 8px',
                                backgroundColor: 'var(--bg-secondary)',
                                borderRadius: 4
                              }}>
                                {barcode.barcode_id}
                              </code>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {barcode.total_scans > 0 ? (
                                <span style={{ 
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  color: 'var(--success-color)',
                                  fontSize: 13,
                                  fontWeight: 600
                                }}>
                                  <MdCheckCircle size={16} />
                                  Scanned
                                </span>
                              ) : (
                                <span style={{ 
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  color: 'var(--text-secondary)',
                                  fontSize: 13
                                }}>
                                  <MdCancel size={16} />
                                  Unscanned
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="badge badge-primary">
                                {barcode.total_scans}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>
                                +{barcode.in_count}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ color: 'var(--danger-color)', fontWeight: 600 }}>
                                -{barcode.out_count}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ fontWeight: 600 }}>
                                {barcode.current_stock}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Stock Status Modal ────────────────────────────────────────────────── */}
      {showStockStatusModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20
          }}
          onClick={() => setShowStockStatusModal(false)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: 16,
              maxWidth: 1000,
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ 
              padding: '24px 24px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdInventory size={24} />
                  Stock Status Details
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                  {productData.sku_name} - {productData.company_name}
                </p>
              </div>
              <button
                onClick={() => setShowStockStatusModal(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--bg-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border-color)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
              >
                <MdClose size={20} />
              </button>
            </div>

            {/* Summary Stats */}
            <div style={{ 
              padding: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12,
              backgroundColor: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <div style={{ textAlign: 'center', padding: 12, backgroundColor: 'white', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary-color)' }}>
                  {barcodes.length}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Total Barcodes
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, backgroundColor: 'white', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success-color)' }}>
                  {barcodes.filter(b => b.current_stock > 0).length}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  In Stock
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, backgroundColor: 'white', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning-color)' }}>
                  {barcodes.filter(b => b.current_stock === 0).length}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Not In Stock
                </div>
              </div>
            </div>

            {/* Filters */}
            <div style={{ 
              padding: '16px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => setStockFilter('all')}
                className={`btn ${stockFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: 13, padding: '6px 16px' }}
              >
                All ({barcodes.length})
              </button>
              <button
                onClick={() => setStockFilter('in-stock')}
                className={`btn ${stockFilter === 'in-stock' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: 13, padding: '6px 16px' }}
              >
                <MdCheckCircle size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                In Stock ({barcodes.filter(b => b.current_stock > 0).length})
              </button>
              <button
                onClick={() => setStockFilter('not-in-stock')}
                className={`btn ${stockFilter === 'not-in-stock' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: 13, padding: '6px 16px' }}
              >
                <MdCancel size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Not In Stock ({barcodes.filter(b => b.current_stock === 0).length})
              </button>
            </div>

            {/* Barcode List */}
            <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
              {(() => {
                const filteredBarcodes = barcodes.filter(b => {
                  if (stockFilter === 'in-stock') return b.current_stock > 0
                  if (stockFilter === 'not-in-stock') return b.current_stock === 0
                  return true
                })

                if (filteredBarcodes.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                      <MdInventory size={48} style={{ opacity: 0.3 }} />
                      <div style={{ marginTop: 12 }}>No barcodes found</div>
                    </div>
                  )
                }

                return (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Barcode ID</th>
                          <th>Product Name</th>
                          <th style={{ textAlign: 'center' }}>Stock Status</th>
                          <th style={{ textAlign: 'center' }}>Current Stock</th>
                          <th style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBarcodes.map((barcode) => (
                          <tr 
                            key={barcode.barcode_id}
                            style={{ 
                              backgroundColor: barcode.current_stock === 0 ? 'var(--warning-light)' : 'transparent'
                            }}
                          >
                            <td>
                              <code style={{ 
                                fontSize: 12, 
                                padding: '4px 8px',
                                backgroundColor: barcode.current_stock > 0 ? 'var(--bg-secondary)' : 'rgba(245, 158, 11, 0.2)',
                                borderRadius: 4
                              }}>
                                {barcode.barcode_id}
                              </code>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{productData.sku_name}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                {productData.company_name}
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {barcode.current_stock > 0 ? (
                                <span style={{ 
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  color: 'var(--success-color)',
                                  fontSize: 13,
                                  fontWeight: 600
                                }}>
                                  <MdCheckCircle size={18} />
                                  In Stock
                                </span>
                              ) : (
                                <span style={{ 
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  color: 'var(--warning-color)',
                                  fontSize: 13,
                                  fontWeight: 600
                                }}>
                                  <MdCancel size={18} />
                                  Not In Stock
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ 
                                fontWeight: 700,
                                fontSize: 16,
                                color: barcode.current_stock > 0 ? 'var(--success-color)' : 'var(--text-secondary)'
                              }}>
                                {barcode.current_stock}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                onClick={() => handlePrintBarcode(barcode.barcode_id)}
                                className="btn btn-outline"
                                style={{ 
                                  fontSize: 12, 
                                  padding: '6px 12px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6
                                }}
                                title="Print barcode label"
                              >
                                <MdPrint size={16} />
                                Print
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductDetails
