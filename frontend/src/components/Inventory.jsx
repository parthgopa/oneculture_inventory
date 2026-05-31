import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../config'
import { getSettings } from './Settings'
import { 
  MdInventory, 
  MdTrendingUp,
  MdTrendingDown,
  MdRefresh,
  MdVisibility,
  MdChevronLeft,
  MdChevronRight,
  MdSearch,
  MdImage,
  MdClose
} from 'react-icons/md'
import styles from './Inventory.module.css'

// ─── component ────────────────────────────────────────────────────────────────

function Inventory() {
  const navigate = useNavigate()
  
  // ── state ────────────────────────────────────────────────────────────────────
  const [inventory, setInventory]     = useState([])
  const [summary, setSummary]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [searchTerm, setSearchTerm]   = useState('')
  const [filterStock, setFilterStock] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [productImages, setProductImages] = useState({})
  const [selectedImage, setSelectedImage] = useState(null)

  const [threshold, setThreshold] = useState(getSettings().lowStockThreshold)

  useEffect(() => {
    const onSettingsChange = (e) => setThreshold(e.detail.lowStockThreshold)
    window.addEventListener('oc:settingsChanged', onSettingsChange)
    return () => window.removeEventListener('oc:settingsChanged', onSettingsChange)
  }, [])

  // ── data fetching ────────────────────────────────────────────────────────────
  const fetchInventory = useCallback(async () => {
    try {
      const [invRes, summaryRes] = await Promise.all([
        apiFetch('/api/inventory'),
        apiFetch('/api/inventory/summary')
      ])
      const invData = await invRes.json()
      const summaryData = await summaryRes.json()
      
      setInventory(Array.isArray(invData) ? invData : [])
      setSummary(summaryData)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching inventory:', error)
      setLoading(false)
    }
  }, [])

  // ── mount & auto-refresh ─────────────────────────────────────────────────────
  useEffect(() => {
    fetchInventory()
    const interval = setInterval(fetchInventory, 15000)
    return () => clearInterval(interval)
  }, [fetchInventory])

  // Fetch ALL product images in one request on mount (not per-product)
  useEffect(() => {
    apiFetch('/api/inventory/product-images')
      .then(r => r.json())
      .then(data => {
        if (data && typeof data === 'object') setProductImages(data)
      })
      .catch(() => {})
  }, [])

  // Reset to page 1 when search/filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterStock])

  // ── helpers ──────────────────────────────────────────────────────────────────
  const getStockStatus = (stock) => {
    if (stock === 0) return { label: 'Out of Stock', class: 'danger', indicator: 'out' }
    if (stock < threshold) return { label: 'Low Stock', class: 'warning', indicator: 'low' }
    return { label: 'In Stock', class: 'success', indicator: 'high' }
  }

  const handleViewDetails = (product) => {
    const colorParam = product.color ? `&color=${encodeURIComponent(product.color)}` : ''
    navigate(`/product/${encodeURIComponent(product.sku_name)}?company=${encodeURIComponent(product.company_name)}${colorParam}`)
  }

  // ── filtering (search by product name, color, OR barcode) ────────────────────
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const term = searchTerm.toLowerCase()
      // Search by SKU name, color, OR any barcode in the barcodes array
      const matchesSearch =
        item.sku_name?.toLowerCase().includes(term) ||
        item.color?.toLowerCase().includes(term) ||
        item.barcodes?.some(bc => bc.toLowerCase().includes(term))

      if (filterStock === 'all') return matchesSearch
      if (filterStock === 'in-stock') return matchesSearch && item.total_stock > 0
      if (filterStock === 'low-stock') return matchesSearch && item.status === 'LOW_STOCK'
      if (filterStock === 'out-of-stock') return matchesSearch && item.status === 'OUT_OF_STOCK'
      
      return matchesSearch
    })
  }, [inventory, searchTerm, filterStock])

  // ── pagination ───────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedInventory = filteredInventory.slice(startIndex, endIndex)

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    let end = Math.min(totalPages, start + maxVisible - 1)
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    return pages
  }

  // (Images fetched in bulk above — no per-product fetch needed)

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page-header">
        <h1 className="page-title">
          <MdInventory size={32} style={{ verticalAlign: 'middle', marginRight: 12 }} />
          Inventory
        </h1>
        <div style={{ textAlign: 'center', padding: 64 }}>
          <div className="loading"></div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <h1 className="page-title">
          <MdInventory size={32} style={{ verticalAlign: 'middle', marginRight: 12 }} />
          Inventory Management
        </h1>
        <p className="page-subtitle">Track stock movements, view product details, and monitor inventory levels</p>
      </div>

      {/* ── Summary stats ───────────────────────────────────────────────────── */}
      {summary && (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-header">
              <div>
                <div className="stat-value">{summary.unique_products || 0}</div>
                <div className="stat-label">Unique Products</div>
              </div>
              <div className="stat-icon primary"><MdInventory size={28} /></div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <div>
                <div className="stat-value">{summary.total_stock || 0}</div>
                <div className="stat-label">Total Stock</div>
              </div>
              <div className="stat-icon success"><MdTrendingUp size={28} /></div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <div>
                <div className="stat-value" style={{ color: 'var(--success-color)' }}>
                  +{summary.total_movements_in || 0}
                </div>
                <div className="stat-label">Total Stock In</div>
              </div>
              <div className="stat-icon success"><MdTrendingUp size={28} /></div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <div>
                <div className="stat-value" style={{ color: 'var(--danger-color)' }}>
                  -{summary.total_movements_out || 0}
                </div>
                <div className="stat-label">Total Stock Out</div>
              </div>
              <div className="stat-icon danger"><MdTrendingDown size={28} /></div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content card ───────────────────────────────────────────────── */}
      <div className="card">
        {/* Filters */}
        <div className={styles.filtersContainer}>
          <div style={{ position: 'relative', flex: 1, minWidth: 250 }}>
            <MdSearch 
              size={20} 
              style={{ 
                position: 'absolute', 
                left: 12, 
                top: '50%', 
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)'
              }} 
            />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by product name or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 40 }}
            />
          </div>
          
          <select
            className={styles.filterSelect}
            value={filterStock}
            onChange={(e) => setFilterStock(e.target.value)}
          >
            <option value="all">All Products</option>
            <option value="in-stock">In Stock</option>
            <option value="low-stock">Low Stock</option>
            <option value="out-of-stock">Out of Stock</option>
          </select>

          <button 
            className={styles.refreshBtn}
            onClick={fetchInventory}
            title="Refresh"
          >
            <MdRefresh size={20} />
          </button>
        </div>

        {/* ── Products table ────────────────────────────────────────────────── */}
        {paginatedInventory.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Image</th>
                  <th>Product (SKU)</th>
                  <th>MRP</th>
                  <th>Color</th>
                  <th>Size</th>
                  <th>Current Stock</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedInventory.map((item) => {
                  const status = getStockStatus(item.total_stock)
                  const imageKey = `${item.sku_name}__${item.color || ''}__${item.company_name}`
                  const productImage = productImages[imageKey]

                  return (
                    <tr key={item.sku_name + (item.color || '') + item.company_name}>
                      <td>
                        {productImage ? (
                          <img
                            src={productImage}
                            alt={item.sku_name}
                            className={styles.productImage}
                            onClick={() => setSelectedImage(productImage)}
                            style={{ cursor: 'pointer' }}
                          />
                        ) : (
                          <div className={styles.productImagePlaceholder}>
                            <MdImage size={20} />
                          </div>
                        )}
                      </td>
                      <td>
                        <strong>{item.sku_name}</strong>
                      </td>
                      <td>₹{(item.mrp || 0).toFixed(2)}</td>
                      <td>{item.color || '—'}</td>
                      <td>{item.size || '—'}</td>
                      <td><span className={styles.stockCell}>{item.total_stock}</span></td>
                      {/* <td>
                        <div className="stock-level">
                          <span className={`stock-indicator ${status.indicator}`}></span>
                          <span className={`badge badge-${status.class}`}>{status.label}</span>
                        </div>
                      </td> */}
                      <td>
                        <button
                          onClick={() => handleViewDetails(item)}
                          className={`btn btn-primary ${styles.viewBtn}`}
                        >
                          <MdVisibility size={16} /> View
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><MdInventory size={64} /></div>
            <div className="empty-state-title">
              {searchTerm ? 'No products found' : 'No products in inventory'}
            </div>
            <div className="empty-state-description">
              {searchTerm 
                ? 'Try a different search term or clear filters'
                : 'Products will appear here after barcodes are scanned'}
            </div>
          </div>
        )}

        {/* ── Pagination ────────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button 
              className={styles.pageBtn}
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <MdChevronLeft size={18} /> Prev
            </button>
            
            <div className={styles.pageNumbers}>
              {getPageNumbers().map(page => (
                <button
                  key={page}
                  className={`${styles.pageNumber} ${page === currentPage ? styles.pageNumberActive : ''}`}
                  onClick={() => goToPage(page)}
                >
                  {page}
                </button>
              ))}
            </div>
            
            <button 
              className={styles.pageBtn}
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next <MdChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ── Footer stats ──────────────────────────────────────────────────── */}
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            <span>
              Showing {startIndex + 1}-{Math.min(endIndex, filteredInventory.length)} of {filteredInventory.length} products
            </span>
            <select 
              className={styles.perPageSelect}
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* ── Image Modal ──────────────────────────────────────────────────────── */}
      {selectedImage && (
        <div 
          className={styles.imageModal}
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className={styles.closeBtn}
            onClick={() => setSelectedImage(null)}
            aria-label="Close"
          >
            <MdClose size={24} />
          </button>
          <img 
            src={selectedImage} 
            alt="Product" 
            className={styles.modalImage}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

export default Inventory
