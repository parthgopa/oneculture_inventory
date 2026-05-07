import { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch } from '../config'
import { scannerService } from '../utils/scannerDetection'
import {
  MdQrCodeScanner,
  MdLogin,
  MdLogout,
  MdRefresh,
  MdBluetooth,
  MdUsb,
  MdKeyboard,
  MdCheckCircle,
  MdError,
  MdDevices,
  MdAdd,
  MdDelete,
  MdClose,
  MdFlashOn,
  MdCircle
} from 'react-icons/md'

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeScannerId(device) {
  return `hid-${device.vendorId}-${device.productId}`
}

function getScannerIcon(type, size = 24) {
  if (type === 'USB' || type === 'HID') return <MdUsb size={size} />
  if (type === 'Bluetooth') return <MdBluetooth size={size} />
  return <MdKeyboard size={size} />
}

// ─── component ────────────────────────────────────────────────────────────────

function Scanner() {
  const [barcode, setBarcode]                   = useState('')
  const [scanning, setScanning]                 = useState(false)
  const [message, setMessage]                   = useState(null)
  const [recentScans, setRecentScans]           = useState([])
  const [dbScanners, setDbScanners]             = useState([])   // from backend DB
  const [liveHID, setLiveHID]                   = useState([])   // from navigator.hid
  const [support, setSupport]                   = useState({ hid: false, bluetooth: false })
  const [showModal, setShowModal]               = useState(false)
  const [refreshing, setRefreshing]             = useState(false)

  const inputRef        = useRef(null)
  // ★ KEY FIX: store the scan handler in a ref so the keyboard listener
  //   always calls the *current* version and never has a stale closure.
  const onBarcodeRef    = useRef(null)
  // keep latest dbScanners accessible inside the keyboard callback
  const dbScannersRef   = useRef([])
  const scanningRef     = useRef(false)

  // sync refs with state
  useEffect(() => { dbScannersRef.current = dbScanners }, [dbScanners])
  useEffect(() => { scanningRef.current   = scanning    }, [scanning])

  // ── mount ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const sup = scannerService.getBrowserSupport()
    setSupport(sup)
    console.log('📱 Browser support:', sup)

    // 1. Clean up any duplicate entries left from previous sessions
    apiFetch('/api/scanners/cleanup-duplicates', { method: 'DELETE' })
      .then(r => r.json())
      .then(d => { if (d.message) console.log('🧹', d.message) })
      .catch(() => {})

    // 2. Load DB scanners
    loadDbScanners()

    // 3. Auto-detect HID devices that are already granted AND physically connected
    detectLiveHID()

    // 4. Fetch recent scans
    fetchRecentScans()

    // 5. Attach keyboard listener — pass ref so it always calls latest handler
    onBarcodeRef.current = handleBarcodeFromScanner
    const cleanup = scannerService.setupKeyboardListener(onBarcodeRef)

    // 6. Listen for USB plug/unplug events
    const onConnect    = () => { console.log('🔌 HID device connected'); detectLiveHID() }
    const onDisconnect = () => { console.log('🔌 HID device disconnected'); detectLiveHID() }
    if (navigator.hid) {
      navigator.hid.addEventListener('connect', onConnect)
      navigator.hid.addEventListener('disconnect', onDisconnect)
    }

    return () => {
      cleanup()
      if (navigator.hid) {
        navigator.hid.removeEventListener('connect', onConnect)
        navigator.hid.removeEventListener('disconnect', onDisconnect)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // keep onBarcodeRef current when component re-renders
  useEffect(() => {
    onBarcodeRef.current = handleBarcodeFromScanner
  })

  // ── detect live HID (no user click needed for already-granted devices) ──────
  const detectLiveHID = async () => {
    const devices = await scannerService.getGrantedHIDDevices()
    console.log(`🔌 Live HID devices: ${devices.length}`)
    devices.forEach((d, i) => {
      console.log(`   [${i + 1}] ${d.productName || 'Unknown'} (vendorId=${d.vendorId}, productId=${d.productId}, opened=${d.opened})`)
    })
    setLiveHID(devices)

    // Auto-register new devices into DB and connect them for data reading
    for (const d of devices) {
      await autoRegisterHIDDevice(d)
      // Connect device to listen for barcode data (raw HID mode)
      try {
        await scannerService.connectHIDDevice(d)
      } catch (err) {
        console.warn(`⚠️ Could not connect HID device for data reading:`, err.message)
      }
    }
  }

  const autoRegisterHIDDevice = async (device) => {
    // Only auto-register if scannerService confirms it's a scanner-type device
    if (!scannerService._isScannerDevice(device)) {
      console.log(`⏭️ Skipping non-scanner HID device: "${device.productName}"`)
      return
    }
    const sid = makeScannerId(device)
    try {
      await apiFetch('/api/scanners', {
        method: 'POST',
        body: JSON.stringify({
          scanner_id:  sid,
          name:        device.productName || 'USB Scanner',
          type:        'USB',
          mode:        'IN',
          vendor_id:   device.vendorId,
          product_id:  device.productId
        })
      })
      console.log(`💾 Auto-registered HID device: ${device.productName || sid}`)
      await loadDbScanners()
    } catch (err) {
      console.warn('⚠️ Could not auto-register device:', err.message)
    }
  }

  // ── DB scanner CRUD ─────────────────────────────────────────────────────────
  const loadDbScanners = async () => {
    try {
      const res  = await apiFetch('/api/scanners')
      const data = await res.json()
      console.log('📥 DB scanners loaded:', data.length, 'device(s)', data)
      setDbScanners(data)
    } catch (err) {
      console.error('❌ Could not load scanners from DB:', err)
    }
  }

  const toggleMode = async (scanner) => {
    const next = scanner.mode === 'IN' ? 'OUT' : 'IN'
    console.log(`🔄 ${scanner.name} → mode ${next}`)
    await apiFetch(`/api/scanners/${scanner.scanner_id}/mode`, {
      method:  'PUT',
      body:    JSON.stringify({ mode: next })
    })
    await loadDbScanners()
  }

  const removeScanner = async (scanner) => {
    console.log(`🗑️  Removing scanner: ${scanner.name}`)
    await apiFetch(`/api/scanners/${scanner.scanner_id}`, { method: 'DELETE' })
    await loadDbScanners()
  }

  // ── add scanner via browser dialog ─────────────────────────────────────────
  const handleAddUSB = async () => {
    try {
      const device = await scannerService.requestHIDDevice()
      if (!device) return
      await autoRegisterHIDDevice(device)
      setShowModal(false)
      showMsg('success', `Scanner "${device.productName || 'USB Scanner'}" added! (Serial #${dbScannersRef.current.length + 1})`)
      await detectLiveHID()
    } catch (err) {
      if (err.message !== 'USB pairing cancelled') showMsg('error', err.message)
    }
  }

  const handleAddBluetooth = async () => {
    try {
      const device = await scannerService.requestBluetoothDevice()
      const sid    = device.id
      await apiFetch('/api/scanners', {
        method:  'POST',
        body:    JSON.stringify({
          scanner_id: sid,
          name:       device.name || 'Bluetooth Scanner',
          type:       'Bluetooth',
          mode:       'IN'
        })
      })
      setShowModal(false)
      await loadDbScanners()
      showMsg('success', `Bluetooth scanner "${device.name || 'Scanner'}" added!`)
    } catch (err) {
      if (err.message !== 'Bluetooth pairing cancelled') showMsg('error', err.message)
    }
  }

  // ── barcode handling ────────────────────────────────────────────────────────
  // This is called by the keyboard listener via ref — never stale.
  const handleBarcodeFromScanner = useCallback((value) => {
    processScan(value)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const processScan = async (barcodeValue) => {
    if (!barcodeValue) return
    if (scanningRef.current) return

    console.log(`📦 Scanning: ${barcodeValue}`)

    setScanning(true)
    setMessage(null)

    console.log(`[Scanner] processScan called: "${barcodeValue}"`)

    try {
      const payload = { barcode_id: barcodeValue.trim() }
      const res = await apiFetch('/api/scan', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      console.log(`[Scanner] HTTP ${res.status}`, data)

      if (res.status === 404) {
        console.log('[Scanner] Barcode not in database')
        showMsg('not_found', 'Barcode not in database — this barcode is not registered in the system')
      } else if (res.ok) {
        const isIn  = data.action_type === 'IN'
        const label = isIn ? 'Stock In' : 'Stock Out'
        console.log(`✅ ${label} | ${data.sku_name} | Stock: ${data.current_stock}`)
        showMsg(isIn ? 'in' : 'out', `${label} — ${data.sku_name} (stock: ${data.current_stock})`)
        setBarcode('')
        fetchRecentScans()
      } else {
        console.log('❌ Error:', data.error)
        showMsg('error', data.error || 'Scan failed')
      }
    } catch (err) {
      console.log('❌ Network error:', err.message)
      showMsg('error', `Network error — ${err.message}`)
    } finally {
      setScanning(false)
      if (inputRef.current) inputRef.current.focus()
    }
  }

  const handleManualScan = (e) => {
    e.preventDefault()
    if (!barcode.trim()) return
    processScan(barcode)
    setBarcode('')
  }

  // Handle keydown inside the input box — scanner fires chars so fast the
  // input accumulates them; on Enter we treat the full value as a barcode.
  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const value = e.target.value.trim()
      if (!value) return
      processScan(value)
      setBarcode('')
    }
  }

  const fetchRecentScans = async () => {
    try {
      const res  = await apiFetch('/api/scan-events?limit=10')
      const data = await res.json()
      setRecentScans(data)
    } catch (err) {
      console.error('Error fetching scans:', err)
    }
  }

  const showMsg = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await detectLiveHID()
    await loadDbScanners()
    setRefreshing(false)
  }

  // ── is a DB scanner currently live (plugged in)? ───────────────────────────────
  // liveHID already contains ONLY physically-connected scanner devices
  // (filtered + open()-verified in scannerDetection.js), so a simple
  // ID match is reliable here.
  const isLive = (scanner) => {
    if (scanner.type === 'Bluetooth') return true  // can't easily probe BT connection
    return liveHID.some(d => makeScannerId(d) === scanner.scanner_id)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">
          <MdQrCodeScanner size={32} style={{ verticalAlign: 'middle', marginRight: 12 }} />
          Barcode Scanner
        </h1>
        <p className="page-subtitle">Auto-detects connected devices — scan any barcode to update stock</p>
      </div>

      {/* ── Scanner devices card ─────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title">
            <MdDevices size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Scanner Devices
            <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
              {dbScanners.length} registered · {liveHID.length} live HID
            </span>
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <MdAdd size={18} /> Add Scanner
            </button>
            <button className="btn btn-outline" onClick={handleRefresh} disabled={refreshing} title="Refresh devices">
              <MdRefresh size={18} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
            </button>
          </div>
        </div>

        {/* Support badges */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <span className="badge badge-success"><MdKeyboard size={14} /> Keyboard Always On</span>
          <span className={`badge ${support.hid ? 'badge-success' : 'badge-warning'}`}>
            <MdUsb size={14} /> USB/HID {support.hid ? 'Supported' : 'Not Supported'}
          </span>
          <span className={`badge ${support.bluetooth ? 'badge-success' : 'badge-warning'}`}>
            <MdBluetooth size={14} /> Bluetooth {support.bluetooth ? 'Supported' : 'Not Supported'}
          </span>
        </div>

        {/* Live HID devices not yet in DB */}
        {liveHID.filter(d => !dbScanners.find(s => s.scanner_id === makeScannerId(d))).length > 0 && (
          <div className="alert alert-success" style={{ marginBottom: 16 }}>
            <MdFlashOn size={20} />
            <span>
              New device detected! Click <b>Add Scanner</b> → USB to register it, or refresh to auto-register.
            </span>
          </div>
        )}

        {/* DB Scanner list */}
        {dbScanners.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dbScanners.map((scanner) => {
              const live = isLive(scanner)
              return (
                <div
                  key={scanner._id}
                  style={{
                    padding: '14px 18px',
                    border: '2px solid var(--border-color)',
                    borderRadius: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'white',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Left: icon + info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 10,
                      backgroundColor: 'var(--primary-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--primary-color)', flexShrink: 0
                    }}>
                      {getScannerIcon(scanner.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{scanner.name}</span>
                        <span className="badge badge-primary" style={{ fontSize: 11 }}>
                          Scanner #{scanner.serial_number}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                          color: live ? '#16a34a' : '#9ca3af', fontWeight: 500 }}>
                          <MdCircle size={10} />
                          {live ? 'Live' : 'Offline'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {scanner.type} · Added {new Date(scanner.created_at).toLocaleDateString()}
                        {scanner.vendor_id ? ` · VID:${scanner.vendor_id} PID:${scanner.product_id}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Right: mode toggle + delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <button
                      className={`btn ${scanner.mode === 'IN' ? 'btn-success' : 'btn-danger'}`}
                      onClick={() => toggleMode(scanner)}
                      style={{ minWidth: 120, justifyContent: 'center', gap: 6 }}
                      title="Click to toggle IN / OUT"
                    >
                      {scanner.mode === 'IN'
                        ? <><MdLogin size={17} /> Stock IN</>
                        : <><MdLogout size={17} /> Stock OUT</>}
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => removeScanner(scanner)}
                      style={{ padding: '8px 11px' }}
                      title="Remove scanner"
                    >
                      <MdDelete size={19} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <div className="empty-state-icon"><MdDevices size={56} /></div>
            <div className="empty-state-title">No scanners registered yet</div>
            <div className="empty-state-description">
              Plug in your USB dongle scanner — it will appear here automatically if Chrome/Edge previously granted it access.
              Otherwise click <b>Add Scanner</b>.
            </div>
          </div>
        )}
      </div>

      {/* ── Scan input card ──────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 14, fontSize: 16, fontWeight: 600 }}>
          <MdQrCodeScanner size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Scan Input
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 10 }}>
            Focus this box and scan, OR let the scanner fire automatically
          </span>
        </h3>

        {message && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px', borderRadius: 8, marginBottom: 14,
            fontWeight: 500, fontSize: 14,
            background: message.type === 'in' ? '#f0fdf4'
              : message.type === 'out' ? '#fef2f2'
              : message.type === 'not_found' ? '#fff7ed'
              : '#fef2f2',
            border: `1.5px solid ${
              message.type === 'in' ? '#16a34a'
              : message.type === 'out' ? '#dc2626'
              : message.type === 'not_found' ? '#ea580c'
              : '#dc2626'}`,
            color: message.type === 'in' ? '#15803d'
              : message.type === 'out' ? '#dc2626'
              : message.type === 'not_found' ? '#c2410c'
              : '#dc2626'
          }}>
            {message.type === 'in'  && <MdCheckCircle size={20} style={{ flexShrink: 0 }} />}
            {message.type === 'out' && <MdLogout size={20} style={{ flexShrink: 0 }} />}
            {message.type === 'not_found' && <MdError size={20} style={{ flexShrink: 0 }} />}
            {message.type === 'error' && <MdError size={20} style={{ flexShrink: 0 }} />}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleManualScan}>
          <input
            ref={inputRef}
            type="text"
            className="form-input"
            placeholder="Scanner input auto-captured here — or type barcode + Enter"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={handleInputKeyDown}
            disabled={scanning}
            style={{ marginBottom: 12 }}
          />
          <button
            type="submit"
            className={`btn ${dbScanners[0]?.mode === 'OUT' ? 'btn-danger' : 'btn-success'}`}
            disabled={scanning || !barcode.trim()}
            style={{ width: '100%' }}
          >
            {scanning
              ? <><span className="loading" /> Processing…</>
              : <><MdQrCodeScanner size={20} /> {dbScanners[0]?.mode === 'OUT' ? 'Stock OUT' : 'Stock IN'}</>}
          </button>
        </form>
      </div>

      {/* ── Recent scans ─────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent Scans</h2>
          <button className="btn btn-outline" onClick={fetchRecentScans} style={{ padding: '6px 12px' }}>
            <MdRefresh size={16} />
          </button>
        </div>

        {recentScans.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Barcode ID</th>
                  <th>SKU</th>
                  <th>Company</th>
                  <th>Action</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentScans.map((scan, i) => (
                  <tr key={i}>
                    <td><code style={{ fontSize: 12 }}>{scan.barcode_id}</code></td>
                    <td>{scan.sku_name}</td>
                    <td>{scan.company_name}</td>
                    <td>
                      <span className={`badge ${scan.action_type === 'IN' ? 'badge-success' : 'badge-danger'}`}>
                        {scan.action_type === 'IN' ? <><MdLogin size={13} /> IN</> : <><MdLogout size={13} /> OUT</>}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{new Date(scan.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><MdQrCodeScanner size={56} /></div>
            <div className="empty-state-title">No scans yet</div>
            <div className="empty-state-description">Scan a barcode to start</div>
          </div>
        )}
      </div>

      {/* ── Add Scanner modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, backgroundColor: 'white', borderRadius: 12, padding: '20px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Add Scanner</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <MdClose size={22} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 18, color: 'var(--text-secondary)', fontSize: 14 }}>
                Connect a new USB or Bluetooth barcode scanner. A serial number will be assigned automatically.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {support.hid ? (
                  <button
                    className="btn btn-primary"
                    onClick={handleAddUSB}
                    style={{ width: '100%', justifyContent: 'flex-start', padding: '14px 18px', fontSize: 15 }}
                  >
                    <MdUsb size={22} />
                    <span style={{ marginLeft: 12 }}>USB / Dongle Scanner</span>
                  </button>
                ) : (
                  <div className="alert alert-warning">
                    <MdError size={18} />
                    <span>USB/HID not available. Use Chrome or Edge.</span>
                  </div>
                )}

                {/* {support.bluetooth ? (
                  <button
                    className="btn btn-primary"
                    onClick={handleAddBluetooth}
                    style={{ width: '100%', justifyContent: 'flex-start', padding: '14px 18px', fontSize: 15 }}
                  >
                    <MdBluetooth size={22} />
                    <span style={{ marginLeft: 12 }}>Bluetooth Scanner</span>
                  </button>
                ) : (
                  <div className="alert alert-warning">
                    <MdError size={18} />
                    <span>Bluetooth not available in this browser.</span>
                  </div>
                )} */}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Scanner;
