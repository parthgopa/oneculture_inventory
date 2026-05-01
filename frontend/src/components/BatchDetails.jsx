import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../config'
import { 
  MdArrowBack, 
  MdDownload, 
  MdPrint,
  MdQrCode2,
  MdGridView,
  MdVisibility,
  MdVisibilityOff,
  MdCheckCircle,
  MdDescription,
  MdPictureAsPdf,
  MdFolderZip
} from 'react-icons/md'
import styles from './BatchDetails.module.css'

function BatchDetails() {
  const { batchId } = useParams()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [batchData, setBatchData] = useState(null)
  const [error, setError] = useState(null)
  
  // Document settings
  const [columns, setColumns] = useState(3)
  const [showDetails, setShowDetails] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetchBatchDetails()
  }, [batchId])

  const fetchBatchDetails = async () => {
    try {
      setLoading(true)
      const response = await apiFetch(
        `/api/barcode-batches/${batchId}?include_images=true`
      )
      
      if (!response.ok) {
        throw new Error('Batch not found')
      }
      
      const data = await response.json()
      setBatchData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Generate preview grid based on columns setting
  const previewRows = useMemo(() => {
    if (!batchData?.barcodes) return []
    
    const rows = []
    for (let i = 0; i < batchData.barcodes.length; i += columns) {
      rows.push(batchData.barcodes.slice(i, i + columns))
    }
    return rows
  }, [batchData, columns])

  const handleDownloadDocument = async (format = 'word') => {
    setDownloading(true)
    try {
      const url = `/api/barcode-batches/${batchId}/document?columns=${columns}&show_details=${showDetails}&format=${format}`
      const response = await apiFetch(url)
      if (!response.ok) throw new Error('Download failed')
      
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = format === 'pdf' ? `${batchId}_barcodes.html` : `${batchId}_barcodes.doc`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download error:', err)
    } finally {
      setDownloading(false)
    }
  }

  const handlePrintPDF = () => {
    apiFetch(`/api/barcode-batches/${batchId}/document?columns=${columns}&show_details=${showDetails}&format=pdf`)
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${batchId}_barcodes.html`
        a.click()
      })
  }

  const handleDownloadZip = () => {
    apiFetch(`/api/barcode-batches/${batchId}/download`)
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${batchId}_barcodes.zip`
        a.click()
      })
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className="loading"></div>
          <p>Loading batch details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <h2>Error</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/generator')}>
            <MdArrowBack size={20} /> Back to Generator
          </button>
        </div>
      </div>
    )
  }

  const { batch_info, barcodes } = batchData

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/generator')}>
          <MdArrowBack size={20} /> Back
        </button>
        <div className={styles.headerInfo}>
          <h1>
            <MdQrCode2 size={28} />
            {batch_info.sku_name}
          </h1>
          <div className={styles.headerMeta}>
            <span><strong>Batch:</strong> {batchId}</span>
            <span><strong>Company:</strong> {batch_info.company_name}</span>
            <span><strong>MRP:</strong> ₹{batch_info.mrp?.toFixed(2)}</span>
            <span><strong>Quantity:</strong> {batch_info.quantity}</span>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {/* Left: Settings Panel */}
        <div className={styles.settingsPanel}>
          <div className={styles.settingsCard}>
            <h3>
              <MdGridView size={20} />
              Document Layout
            </h3>
            
            <div className={styles.settingGroup}>
              <label>Barcodes per row</label>
              <div className={styles.columnSelector}>
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <button
                    key={num}
                    className={`${styles.columnBtn} ${columns === num ? styles.active : ''}`}
                    onClick={() => setColumns(num)}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.settingGroup}>
              <label>Show barcode ID</label>
              <button 
                className={styles.toggleBtn}
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? (
                  <><MdVisibility size={18} /> Visible</>
                ) : (
                  <><MdVisibilityOff size={18} /> Hidden</>
                )}
              </button>
            </div>

            <div className={styles.downloadSection}>
              <h4>Download Options</h4>
              
              <div className={styles.downloadGrid}>
                <button 
                  className={styles.downloadCard}
                  onClick={() => handleDownloadDocument('word')}
                  disabled={downloading}
                >
                  <MdDescription size={32} className={styles.downloadIcon} />
                  <span className={styles.downloadLabel}>Word</span>
                  <span className={styles.downloadExt}>.doc</span>
                </button>

                <button 
                  className={styles.downloadCard}
                  onClick={handlePrintPDF}
                  disabled={downloading}
                >
                  <MdPictureAsPdf size={32} className={styles.downloadIconPdf} />
                  <span className={styles.downloadLabel}>PDF</span>
                  <span className={styles.downloadExt}>Print</span>
                </button>

                <button 
                  className={styles.downloadCard}
                  onClick={handleDownloadZip}
                >
                  <MdFolderZip size={32} className={styles.downloadIconZip} />
                  <span className={styles.downloadLabel}>Images</span>
                  <span className={styles.downloadExt}>.zip</span>
                </button>
              </div>
              
              <p className={styles.downloadHint}>
                {columns} barcode{columns > 1 ? 's' : ''} per row • {showDetails ? 'With' : 'Without'} IDs
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className={styles.statsCard}>
            <h3>Batch Statistics</h3>
            <div className={styles.statItem}>
              <span>Total Barcodes</span>
              <strong>{barcodes.length}</strong>
            </div>
            <div className={styles.statItem}>
              <span>Scanned</span>
              <strong>{barcodes.filter(b => b.current_stock > 0).length}</strong>
            </div>
            <div className={styles.statItem}>
              <span>Not Scanned</span>
              <strong>{barcodes.filter(b => b.current_stock === 0).length}</strong>
            </div>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className={styles.previewPanel}>
          <div className={styles.previewHeader}>
            <h3><MdPrint size={20} /> Live Preview</h3>
            <span className={styles.previewHint}>
              This is how your document will look
            </span>
          </div>
          
          <div className={styles.previewContainer}>
            <div className={styles.previewPage}>
              {/* Document Header */}
              <div className={styles.docHeader}>
                <h2>{batch_info.sku_name}</h2>
                <p>
                  <strong>Company:</strong> {batch_info.company_name} | 
                  <strong> MRP:</strong> ₹{batch_info.mrp?.toFixed(2)}
                </p>
                <p>
                  <strong>Batch:</strong> {batchId} | 
                  <strong> Total:</strong> {barcodes.length} barcodes
                </p>
              </div>

              {/* Barcode Grid */}
              <div className={styles.barcodeGrid}>
                {previewRows.map((row, rowIndex) => (
                  <div 
                    key={rowIndex} 
                    className={styles.barcodeRow}
                    style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
                  >
                    {row.map(barcode => (
                      <div key={barcode.barcode_id} className={styles.barcodeCell}>
                        <img 
                          src={`data:image/png;base64,${barcode.image_base64}`}
                          alt={barcode.barcode_id}
                        />
                        {showDetails && (
                          <div className={styles.barcodeId}>
                            {barcode.barcode_id}
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Fill empty cells */}
                    {row.length < columns && 
                      Array(columns - row.length).fill(0).map((_, i) => (
                        <div key={`empty-${i}`} className={styles.barcodeCell}></div>
                      ))
                    }
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barcode List Table */}
      <div className={styles.barcodeListSection}>
        <h3>All Barcodes in Batch</h3>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Barcode ID</th>
                <th>SKU</th>
                <th>MRP</th>
                <th>Stock Status</th>
              </tr>
            </thead>
            <tbody>
              {barcodes.map((bc, index) => (
                <tr key={bc.barcode_id}>
                  <td>{index + 1}</td>
                  <td><code>{bc.barcode_id}</code></td>
                  <td>{bc.sku_name}</td>
                  <td>₹{bc.mrp?.toFixed(2)}</td>
                  <td>
                    {bc.current_stock > 0 ? (
                      <span className={styles.statusScanned}>
                        <MdCheckCircle size={14} /> In Stock ({bc.current_stock})
                      </span>
                    ) : (
                      <span className={styles.statusNotScanned}>Not Scanned</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default BatchDetails
