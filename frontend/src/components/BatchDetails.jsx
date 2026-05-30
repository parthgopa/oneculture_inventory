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
  const [showDetails, setShowDetails] = useState(false)
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

  const handlePrintStickers = async () => {
    if (!batchData) return
    const { batch_info, barcodes } = batchData

    // Fetch logo as base64 so it embeds correctly in the popup (relative URLs don't resolve in blank windows)
    let logoDataUrl = ''
    try {
      const logoRes = await fetch('/logo.jpeg')
      const blob = await logoRes.blob()
      logoDataUrl = await new Promise(resolve => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.readAsDataURL(blob)
      })
    } catch (_) {}

    const win = window.open('', '_blank', 'width=900,height=700')
    const stickers = barcodes.map(bc => {
      const displayId = editedIds[bc.barcode_id] ?? bc.barcode_id
      return `
        <div class="sticker-page">
          <div class="sticker">
            <div class="sticker-left">
              <div class="sticker-info">
                <div class="sticker-row">
                  <span class="sticker-label">SKU</span>
                  <span class="sticker-value">${batch_info.sku_name}</span>
                </div>
                <div class="sticker-row">
                  <span class="sticker-label">MRP</span>
                  <span class="sticker-value sticker-mrp">&#8377;${parseFloat(batch_info.mrp).toFixed(2)}</span>
                </div>
                ${batch_info.size ? `<div class="sticker-row"><span class="sticker-label">Size</span><span class="sticker-value">${batch_info.size}</span></div>` : ''}
                ${batch_info.color ? `<div class="sticker-row"><span class="sticker-label">Color</span><span class="sticker-value">${batch_info.color}</span></div>` : ''}
              </div>
              <div class="sticker-barcode">
                <img src="data:image/png;base64,${bc.image_base64}" alt="barcode" />
                ${showDetails ? `<div class="sticker-code">${displayId}</div>` : ''}
              </div>
            </div>
            <div class="sticker-right">
              ${logoDataUrl ? `<img class="sticker-logo" src="${logoDataUrl}" alt="logo" />` : ''}
            </div>
          </div>
        </div>`
    }).join('')
    win.document.write(`<!DOCTYPE html>
<html><head><title>Print Stickers \u2014 ${batch_info.sku_name}</title>
<style>
  @page { size: 1.9in 2.1in; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #fff; }

  .sticker-page {
    width: 1.9in;
    height: 2.1in;
    display: flex;
    align-items: center;
    justify-content: center;
    page-break-after: always;
    break-after: page;
  }

  .sticker {
    width: 1.82in;
    height: 2.0in;
    border: 1.5pt solid #222;
    border-radius: 4pt;
    display: flex;
    flex-direction: row;
    overflow: hidden;
    background: #fff;
  }

  .sticker-left {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-right: 1.5pt solid #222;
    min-width: 0;
  }

  .sticker-info {
    padding: 5pt 5pt 4pt 6pt;
    display: flex;
    flex-direction: column;
    gap: 2pt;
  }

  .sticker-row {
    display: flex;
    align-items: baseline;
    gap: 3pt;
    line-height: 1.3;
  }

  .sticker-label {
    font-size: 6pt;
    font-weight: 700;
    color: #555;
    text-transform: uppercase;
    min-width: 22pt;
    flex-shrink: 0;
  }

  .sticker-value {
    font-size: 8pt;
    font-weight: 600;
    color: #111;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sticker-mrp {
    font-size: 13pt;
    font-weight: 800;
    color: #111;
  }

  .sticker-barcode {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3pt 1pt;
  }

  .sticker-barcode img {
    width: 100%;
    height: auto;
    max-height: 1.1in;
    object-fit: fill;
    display: block;
  }

  .sticker-code {
    font-family: Consolas, 'Courier New', monospace;
    font-size: 5pt;
    color: #444;
    margin-top: 1pt;
    text-align: center;
    word-break: break-all;
  }

  .sticker-right {
    width: 0.27in;
    background: #1c1c1c;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
    padding: 0;
    position: relative;
  }

  .sticker-logo {
    width: 2.0in;
    height: 0.27in;
    object-fit: cover;
    display: block;
    position: absolute;
    transform: rotate(-90deg);
    transform-origin: center center;
    left: 50%;
    top: 50%;
    margin-left: -1.0in;
    margin-top: -0.135in;
  }
</style>
</head><body>
${stickers}
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
            {batch_info.color && <span><strong>Color:</strong> {batch_info.color}</span>}
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
                  {/* Left column */}
                  <div className={stickerStyles.stickerLeft}>
                    {/* Top info rows */}
                    <div className={stickerStyles.stickerInfo}>
                      <div className={stickerStyles.stickerRow}>
                        <span className={stickerStyles.stickerLabel}>SKU</span>
                        <span className={stickerStyles.stickerValue}>{batch_info.sku_name}</span>
                      </div>
                      <div className={stickerStyles.stickerRow}>
                        <span className={stickerStyles.stickerLabel}>MRP</span>
                        <span className={`${stickerStyles.stickerValue} ${stickerStyles.stickerMrp}`}>₹{batch_info.mrp?.toFixed(2)}</span>
                      </div>
                      {batch_info.size && (
                        <div className={stickerStyles.stickerRow}>
                          <span className={stickerStyles.stickerLabel}>Size</span>
                          <span className={stickerStyles.stickerValue}>{batch_info.size}</span>
                        </div>
                      )}
                      {batch_info.color && (
                        <div className={stickerStyles.stickerRow}>
                          <span className={stickerStyles.stickerLabel}>Color</span>
                          <span className={stickerStyles.stickerValue}>{batch_info.color}</span>
                        </div>
                      )}
                    </div>
                    {/* Bottom barcode */}
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
                  {/* Right dark strip */}
                  <div className={stickerStyles.stickerRight}>
                    <img src="/logo.jpeg" alt="OneCulture" className={stickerStyles.stickerLogoImg} />
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
                <th>Size/Color</th>
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
                  <td>
                    {bc.size && <span style={{fontSize: 11, color: '#4338ca'}}>{bc.size}</span>}
                    {bc.size && bc.color && <span style={{fontSize: 11}}> / </span>}
                    {bc.color && <span style={{fontSize: 11, color: '#be185d'}}>{bc.color}</span>}
                  </td>
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
