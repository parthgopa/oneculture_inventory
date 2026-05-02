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
import stickerStyles from './BatchSticker.module.css'

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
  // Sticker: track editable barcode IDs per barcode
  const [editedIds, setEditedIds] = useState({})

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

  const handlePrintStickers = () => {
    if (!batchData) return
    const { batch_info, barcodes } = batchData
    const win = window.open('', '_blank', 'width=900,height=700')
    const stickers = barcodes.map(bc => {
      const displayId = editedIds[bc.barcode_id] ?? bc.barcode_id
      return `
        <div class="sticker">
          <div class="sticker-left">
            <div class="sticker-row"><span class="sticker-label">SKU</span><span class="sticker-value">${batch_info.sku_name}</span></div>
            ${batch_info.size ? `<div class="sticker-row"><span class="sticker-label">Size</span><span class="sticker-value sticker-size">${batch_info.size}</span></div>` : ''}
            <div class="sticker-row"><span class="sticker-label">MRP</span><span class="sticker-value sticker-mrp">&#8377;${parseFloat(batch_info.mrp).toFixed(2)}</span></div>
            <div class="sticker-barcode">
              <img src="data:image/png;base64,${bc.image_base64}" alt="barcode" />
              ${showDetails ? `<div class="sticker-code">${displayId}</div>` : ''}
            </div>
          </div>
          <div class="sticker-logo">
            <img src="/logo.webp" alt="OneCulture" />
          </div>
        </div>`
    }).join('')
    win.document.write(`<!DOCTYPE html>
<html><head><title>Print Stickers — ${batch_info.sku_name}</title>
<style>
  @page { size: auto; margin: 6mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #fff; }
  .page { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px; }
  .sticker {
    width: 220px; height: 110px;
    border: 1.5px solid #222;
    border-radius: 6px;
    display: flex;
    overflow: hidden;
    background: #fff;
    page-break-inside: avoid;
  }
  .sticker-left {
    flex: 1;
    padding: 6px 6px 4px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    justify-content: space-between;
  }
  .sticker-row {
    display: flex;
    align-items: baseline;
    gap: 4px;
    line-height: 1.2;
  }
  .sticker-label {
    font-size: 7px;
    font-weight: 700;
    color: #555;
    text-transform: uppercase;
    min-width: 24px;
  }
  .sticker-value {
    font-size: 9px;
    font-weight: 600;
    color: #111;
  }
  .sticker-size {
    font-size: 13px;
    font-weight: 400;
    color: #111;
  }
  .sticker-mrp {
    font-size: 12px;
    font-weight: 400;
    color: #111;
  }
  .sticker-barcode {
    text-align: center;
    margin-top: 2px;
  }
  .sticker-barcode img {
    width: 100%;
    max-height: 58px;
    object-fit: contain;
    display: block;
  }
  .sticker-code {
    font-family: Consolas, monospace;
    font-size: 6.5px;
    color: #333;
    margin-top: 1px;
    word-break: break-all;
    text-align: center;
  }
  .sticker-logo {
    width: 34px;
    background: #1c1c1c;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 2px;
    flex-shrink: 0;
  }
  .sticker-logo img {
    width: 100%;
    object-fit: contain;
    transform: rotate(90deg);
    transform-origin: center center;
    max-height: 28px;
  }
  @media print {
    body { margin: 0; }
  }
</style>
</head><body>
<div class="page">${stickers}</div>
<script>window.onload=()=>{window.print();window.close();}<\/script>
</body></html>`)
    win.document.close()
  }

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
            {batch_info.size && <span><strong>Size:</strong> {batch_info.size}</span>}
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

            {/* <div className={styles.downloadSection}>
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
            </div>*/}
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

        {/* Right: Sticker Preview */}
        <div className={styles.previewPanel}>
          <div className={styles.previewHeader}>
            <h3><MdPrint size={20} /> Sticker Preview</h3>
            <button
              onClick={handlePrintStickers}
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              <MdPrint size={16} /> Print Stickers
            </button>
          </div>

          <div className={styles.previewContainer}>
            <div className={stickerStyles.stickerGrid}>
              {barcodes.map(bc => (
                <div key={bc.barcode_id} className={stickerStyles.sticker}>
                  <div className={stickerStyles.stickerLeft}>
                    <div className={stickerStyles.stickerRow}>
                      <span className={stickerStyles.stickerLabel}>SKU</span>
                      <span className={stickerStyles.stickerValue}>{batch_info.sku_name}</span>
                    </div>
                    {batch_info.size && (
                      <div className={stickerStyles.stickerRow}>
                        <span className={stickerStyles.stickerLabel}>Size</span>
                        <span className={`${stickerStyles.stickerValue} ${stickerStyles.stickerSize}`}>{batch_info.size}</span>
                      </div>
                    )}
                    <div className={stickerStyles.stickerRow}>
                      <span className={stickerStyles.stickerLabel}>MRP</span>
                      <span className={`${stickerStyles.stickerValue} ${stickerStyles.stickerMrp}`}>₹{batch_info.mrp?.toFixed(2)}</span>
                    </div>
                    <div className={stickerStyles.stickerBarcode}>
                      <img
                        src={`data:image/png;base64,${bc.image_base64}`}
                        alt={bc.barcode_id}
                      />
                      {showDetails && (
                        <input
                          className={stickerStyles.stickerCode}
                          value={editedIds[bc.barcode_id] ?? bc.barcode_id}
                          onChange={e => setEditedIds(prev => ({ ...prev, [bc.barcode_id]: e.target.value }))}
                        />
                      )}
                    </div>
                  </div>
                  <div className={stickerStyles.stickerLogo}>
                    <img src="/logo.webp" alt="OneCulture" />
                  </div>
                </div>
              ))}
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
