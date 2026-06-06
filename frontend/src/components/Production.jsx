import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MdBuild, MdAssignment, MdSwapHoriz, MdPeople, MdRefresh, MdCheckCircle, MdInbox, MdQrCode2, MdStorefront } from 'react-icons/md'
import { apiFetch } from '../config'
import ProductionOverview from './production/ProductionOverview'
import ClothOrders from './production/ClothOrders'
import JobWork from './production/JobWork'
import AdditionalWork from './production/AdditionalWork'
import ReceiveGoods from './production/ReceiveGoods'
import WorkersTab from './production/WorkersTab'
import SuppliersTab from './production/SuppliersTab'
import GenerateBarcode from './production/GenerateBarcode'
import styles from './Production.module.css'

const TABS = [
  { id: 'overview',        label: 'Overview',         icon: MdBuild },
  { id: 'orders',          label: 'Cloth Orders',     icon: MdAssignment },
  { id: 'workers',         label: 'Workers',          icon: MdPeople },
  { id: 'suppliers',       label: 'Suppliers',        icon: MdStorefront },
  { id: 'jobwork',         label: 'Job Work',         icon: MdBuild },
  { id: 'additionalwork',  label: 'Additional Work',  icon: MdSwapHoriz },
  { id: 'receivegoods',    label: 'Receive Goods',    icon: MdInbox },
  { id: 'generatebarcode', label: 'Barcode', icon: MdQrCode2 },
]

function Production() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'orders')
  const [loading, setLoading]     = useState(true)
  const [success, setSuccess]     = useState(null)

  const [stats, setStats]             = useState(null)
  const [orders, setOrders]           = useState([])
  const [workers, setWorkers]         = useState([])
  const [workerStock, setWorkerStock] = useState([])
  const [ledger, setLedger]           = useState([])
  const [readyItems, setReadyItems]   = useState([])
  const [suppliers, setSuppliers]     = useState([])

  const fetchAll = useCallback(async () => {
    try {
      const [sR, oR, wR, wsR, lR, rR, supR] = await Promise.all([
        apiFetch('/api/production/stats'),
        apiFetch('/api/production/orders'),
        apiFetch('/api/production/workers'),
        apiFetch('/api/production/worker-stock'),
        apiFetch('/api/production/ledger?limit=50'),
        apiFetch('/api/production/ready-for-barcode'),
        apiFetch('/api/production/suppliers'),
      ])
      const [s, o, w, ws, l, r, sup] = await Promise.all([
        sR.json(), oR.json(), wR.json(), wsR.json(), lR.json(), rR.json(), supR.json()
      ])
      setStats(s)
      setOrders(Array.isArray(o) ? o : [])
      setWorkers(Array.isArray(w) ? w : [])
      setWorkerStock(Array.isArray(ws) ? ws : [])
      setLedger(Array.isArray(l) ? l : [])
      setReadyItems(Array.isArray(r) ? r : [])
      setSuppliers(Array.isArray(sup) ? sup : [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const onRefresh = useCallback(() => {
    setSuccess('Saved!')
    setTimeout(() => setSuccess(null), 2500)
    fetchAll()
  }, [fetchAll])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 64 }}>
      <div className="loading" />
      <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Loading production data...</p>
    </div>
  )

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className="page-title">
            <MdBuild size={30} style={{ verticalAlign: 'middle', marginRight: 10 }} />
            Production
          </h1>
          <p className="page-subtitle">Cloth Order → Job Work → Additional Work → Barcode</p>
        </div>
        {/* <button className="btn btn-outline" onClick={fetchAll} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MdRefresh size={18} /> Refresh
        </button> */}
      </div>

      {success && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <MdCheckCircle size={18} /> {success}
        </div>
      )}

      <div className={styles.tabNav}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id}
            className={`${styles.tabBtn} ${activeTab === id ? styles.active : ''}`}
            onClick={() => setActiveTab(id)}>
            <Icon size={17} />{label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <ProductionOverview stats={stats} workerStock={workerStock} ledger={ledger} readyItems={readyItems} setActiveTab={setActiveTab} />
      )}
      {activeTab === 'orders' && (
        <ClothOrders orders={orders} workers={workers} workerStock={workerStock} onRefresh={onRefresh} />
      )}
      {activeTab === 'workers' && (
        <WorkersTab workers={workers} workerStock={workerStock} onRefresh={onRefresh} />
      )}
      {activeTab === 'suppliers' && (
        <SuppliersTab suppliers={suppliers} onRefresh={onRefresh} />
      )}
      {activeTab === 'jobwork' && (
        <JobWork workers={workers} workerStock={workerStock} ledger={ledger} onRefresh={onRefresh} />
      )}
      {activeTab === 'additionalwork' && (
        <AdditionalWork workers={workers} workerStock={workerStock} ledger={ledger} orders={orders} onRefresh={onRefresh} />
      )}
      {activeTab === 'receivegoods' && (
        <ReceiveGoods workers={workers} workerStock={workerStock} ledger={ledger} orders={orders} onRefresh={onRefresh} />
      )}
      {activeTab === 'generatebarcode' && (
        <GenerateBarcode readyItems={readyItems} />
      )}
    </div>
  )
}

export default Production

