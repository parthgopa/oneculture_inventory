import { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch } from '../config'
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library'
import {
  MdClose,
  MdQrCodeScanner,
  MdFlashOn,
  MdFlashOff,
  MdCheckCircle,
  MdError,
  MdLogout,
  MdCameraAlt,
  MdKeyboard
} from 'react-icons/md'
import styles from './MobileBarcodeScanner.module.css'

/**
 * Mobile Barcode Scanner - Camera-based scanning for mobile devices
 * Uses canvas-based frame capture + ZXing decoding (reliable across all browsers)
 * Native BarcodeDetector API as secondary fallback
 * Same backend API as USB scanner: POST /api/scan {barcode_id}
 */
function MobileBarcodeScanner({ onClose, onScanSuccess }) {
  const [hasCamera, setHasCamera] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const [message, setMessage] = useState(null)
  const [lastScan, setLastScan] = useState(null)
  const [cameraLoading, setCameraLoading] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manualValue, setManualValue] = useState('')

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const scanFrameRef = useRef(null) // ref to the scan frame overlay element
  const streamRef = useRef(null)
  const zxingReaderRef = useRef(null)
  const barcodeDetectorRef = useRef(null)
  const scanTimerRef = useRef(null)
  const processingRef = useRef(false)
  const lastScanRef = useRef(null)
  const mountedRef = useRef(true)
  const videoReadyRef = useRef(false)
  const scanStartedRef = useRef(false)

  // ── Helpers ──────────────────────────────────────────────

  const updateLastScan = useCallback((value) => {
    lastScanRef.current = value
    setLastScan(value)
  }, [])

  // Short beep sound via Web Audio API (no audio file needed)
  const playBeep = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(1800, ctx.currentTime)        // high pitched
      oscillator.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.08)
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.12)
      oscillator.onended = () => ctx.close()
    } catch (e) { /* AudioContext not supported */ }
  }, [])

  // ── Initialize ZXing + native detector (once) ──────────

  useEffect(() => {
    mountedRef.current = true

    try {
      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.PDF_417,
        BarcodeFormat.ITF,
        BarcodeFormat.CODABAR
      ])
      hints.set(DecodeHintType.TRY_HARDER, true)

      const reader = new BrowserMultiFormatReader(hints)
      reader.timeBetweenDecodingAttempts = 0
      zxingReaderRef.current = reader
      console.log('✅ ZXing reader ready')
    } catch (err) {
      console.warn('ZXing init failed:', err)
    }

    if ('BarcodeDetector' in window) {
      try {
        barcodeDetectorRef.current = new window.BarcodeDetector({
          formats: [
            'qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39',
            'upc_a', 'upc_e', 'data_matrix', 'pdf417', 'itf'
          ]
        })
        console.log('✅ Native BarcodeDetector available')
      } catch (e) {
        console.warn('BarcodeDetector init failed:', e)
      }
    }

    return () => {
      mountedRef.current = false
    }
  }, [])

  // ── Camera lifecycle ───────────────────────────────────

  useEffect(() => {
    initCamera()
    return () => stopEverything()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const initCamera = async () => {
    try {
      console.log('📷 Requesting camera access...')

      let mediaStream = null

      // Try back camera first with exact constraint
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        })
        console.log('📹 Got back camera (exact)')
      } catch (backErr) {
        console.warn('Back camera (exact) failed:', backErr.message)

        // Try with ideal (not exact) — works better on some devices
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false
          })
          console.log('📹 Got camera (ideal environment)')
        } catch (idealErr) {
          console.warn('Ideal environment failed:', idealErr.message)

          // Last resort — any camera
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          })
          console.log('📹 Got fallback camera (any)')
        }
      }

      if (!mountedRef.current) {
        mediaStream.getTracks().forEach(t => t.stop())
        return
      }

      streamRef.current = mediaStream
      setHasCamera(true)

      const track = mediaStream.getVideoTracks()[0]
      if (track) {
        const settings = track.getSettings()
        console.log('📹 Camera active:', settings.width, 'x', settings.height,
          '| facing:', settings.facingMode || 'unknown')
      }

      // Attach stream and explicitly play
      await attachAndPlay(mediaStream)

    } catch (err) {
      console.error('❌ Camera init failed:', err)
      if (!mountedRef.current) return
      setHasCamera(false)
      setCameraLoading(false)
      setMessage({
        type: 'error',
        text: err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera and reload.'
          : 'Could not access camera. Is another app using it?'
      })
    }
  }

  const attachAndPlay = async (mediaStream) => {
    const video = videoRef.current
    if (!video) {
      console.error('❌ Video element ref is null')
      setCameraLoading(false)
      return
    }

    console.log('🔗 Attaching stream to video element...')
    video.srcObject = mediaStream

    // MUST explicitly call play() — autoplay alone is unreliable on mobile
    const tryPlay = async (attempt) => {
      try {
        await video.play()
        console.log(`▶️ video.play() succeeded (attempt ${attempt})`)
        return true
      } catch (err) {
        console.warn(`▶️ video.play() failed (attempt ${attempt}):`, err.message)
        return false
      }
    }

    // Attempt 1: immediate
    let played = await tryPlay(1)

    // Attempt 2: after a short delay (some browsers need DOM to settle)
    if (!played && mountedRef.current) {
      await new Promise(r => setTimeout(r, 300))
      played = await tryPlay(2)
    }

    // Attempt 3: after a longer delay
    if (!played && mountedRef.current) {
      await new Promise(r => setTimeout(r, 500))
      played = await tryPlay(3)
    }

    if (!mountedRef.current) return

    if (played) {
      // Directly start scanning — don't rely solely on onPlaying event
      // (onPlaying can be unreliable on mobile re-open)
      beginScanning()
    } else {
      console.error('❌ All play attempts failed')
      setCameraLoading(false)
      setMessage({
        type: 'error',
        text: 'Camera started but playback blocked. Tap the screen to retry.'
      })
    }
  }

  const stopEverything = () => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current)
      scanTimerRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    if (zxingReaderRef.current) {
      try { zxingReaderRef.current.reset() } catch (e) { /* ignore */ }
    }

    videoReadyRef.current = false
    processingRef.current = false
    scanStartedRef.current = false
  }

  // ── Begin scan loop (called once video confirmed playing) ─

  const beginScanning = useCallback(() => {
    if (scanStartedRef.current) return
    scanStartedRef.current = true
    videoReadyRef.current = true

    console.log('🔍 Scan loop started')
    setCameraLoading(false)
    setScanning(true)
    setMessage(null)
    setDetecting(false)

    if (scanTimerRef.current) clearInterval(scanTimerRef.current)

    scanTimerRef.current = setInterval(() => {
      scanFrame()
    }, 150) // faster interval for snappier detection
  }, [])

  const handleVideoPlaying = useCallback(() => {
    console.log('▶️ onPlaying event fired')
    beginScanning() // backup: also called directly from attachAndPlay
  }, [beginScanning])

  // ── Core scan: crop canvas to scan frame region → decode ───

  const scanFrame = () => {
    if (processingRef.current) return
    if (!videoReadyRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    if (video.readyState < 2) return
    if (video.videoWidth === 0 || video.videoHeight === 0) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    // — Crop canvas to scan frame region only —
    // This ensures only barcodes inside the purple frame are decoded
    const frameBounds = scanFrameRef.current?.getBoundingClientRect()
    const videoBounds = video.getBoundingClientRect()

    if (frameBounds && videoBounds && videoBounds.width > 0) {
      const videoW = video.videoWidth
      const videoH = video.videoHeight
      const displayW = videoBounds.width
      const displayH = videoBounds.height

      // object-fit: cover scale factor (video fills container, may be cropped)
      const scale = Math.max(displayW / videoW, displayH / videoH)
      const scaledW = videoW * scale
      const scaledH = videoH * scale

      // Centering offset (cover crops symmetrically)
      const offsetX = (scaledW - displayW) / 2
      const offsetY = (scaledH - displayH) / 2

      // Frame position relative to the video element's rendered rect
      const relX = frameBounds.left - videoBounds.left
      const relY = frameBounds.top - videoBounds.top

      // Map from screen pixels → actual video pixel coordinates
      const cropX = Math.max(0, (relX + offsetX) / scale)
      const cropY = Math.max(0, (relY + offsetY) / scale)
      const cropW = Math.min(videoW - cropX, frameBounds.width / scale)
      const cropH = Math.min(videoH - cropY, frameBounds.height / scale)

      canvas.width = Math.round(cropW)
      canvas.height = Math.round(cropH)
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height)
    } else {
      // Fallback: use full frame
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    }

    let decoded = null

    // Try ZXing first (synchronous canvas decode)
    if (zxingReaderRef.current) {
      try {
        const result = zxingReaderRef.current.decodeFromCanvas(canvas)
        if (result) {
          decoded = {
            value: result.getText(),
            format: result.getBarcodeFormat()?.toString() || 'unknown',
            source: 'zxing'
          }
        }
      } catch (err) {
        // NotFoundException — normal when no barcode in frame
      }
    }

    // Fallback: native BarcodeDetector (async)
    if (!decoded && barcodeDetectorRef.current) {
      barcodeDetectorRef.current.detect(canvas)
        .then(barcodes => {
          if (processingRef.current) return
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            const raw = barcodes[0].rawValue.trim()
            if (raw && raw !== lastScanRef.current) {
              console.log(`📱 Barcode [native]: "${raw}" (${barcodes[0].format})`)
              processingRef.current = true
              setDetecting(true)
              updateLastScan(raw)
              sendToBackend(raw)
            }
          }
        })
        .catch(() => {})
      return
    }

    // Handle ZXing result
    if (decoded && decoded.value) {
      const raw = decoded.value.trim()
      if (raw === lastScanRef.current) return

      console.log(`📱 Barcode [${decoded.source}]: "${raw}" (${decoded.format})`)
      processingRef.current = true
      setDetecting(true)
      updateLastScan(raw)
      sendToBackend(raw)
    } else {
      setDetecting(false)
    }
  }

  // ── Backend API call (SAME as USB scanner) ─────────────

  const sendToBackend = async (barcodeValue) => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current)
      scanTimerRef.current = null
    }
    scanStartedRef.current = false
    setScanning(false)

    try {
      const payload = { barcode_id: barcodeValue.trim() }
      const res = await apiFetch('/api/scan', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!mountedRef.current) return

      if (res.status === 404) {
        setMessage({ type: 'not_found', text: 'Barcode not in database — not registered in the system' })
        resumeScanAfterDelay(2000)
      } else if (res.ok) {
        const isIn = data.action_type === 'IN'
        setMessage({
          type: isIn ? 'in' : 'out',
          text: `${isIn ? 'Stock In' : 'Stock Out'} — ${data.sku_name} (stock: ${data.current_stock})`
        })
        if (onScanSuccess) onScanSuccess(data)
        playBeep()
        if (navigator.vibrate) navigator.vibrate([100, 50, 100])
        resumeScanAfterDelay(1500)
      } else {
        setMessage({ type: 'error', text: data.error || 'Scan failed' })
        resumeScanAfterDelay()
      }
    } catch (err) {
      if (!mountedRef.current) return
      setMessage({ type: 'error', text: `Network error — ${err.message}` })
      resumeScanAfterDelay()
    }
  }

  const resumeScanAfterDelay = (ms = 1500) => {
    setTimeout(() => {
      if (!mountedRef.current) return
      processingRef.current = false
      updateLastScan(null)
      setMessage(null)
      setDetecting(false)
      setScanning(true)

      if (videoReadyRef.current) {
        scanStartedRef.current = false // Allow beginScanning to run again
        beginScanning()
      }
    }, ms)
  }

  // ── Flash toggle ───────────────────────────────────────

  const toggleFlash = async () => {
    if (!streamRef.current) return
    const track = streamRef.current.getVideoTracks()[0]
    if (!track) return

    try {
      const caps = track.getCapabilities?.() || {}
      if (caps.torch) {
        const next = !flashOn
        await track.applyConstraints({ advanced: [{ torch: next }] })
        setFlashOn(next)
      } else {
        setMessage({ type: 'error', text: 'Flash not available on this device' })
        setTimeout(() => mountedRef.current && setMessage(null), 2000)
      }
    } catch (err) {
      console.warn('Flash toggle error:', err)
    }
  }

  // ── Manual entry ───────────────────────────────────────

  const handleManualSubmit = (e) => {
    e.preventDefault()
    const val = manualValue.trim()
    if (!val) return
    processingRef.current = true
    updateLastScan(val)
    sendToBackend(val)
    setManualValue('')
  }

  // ── Tap-to-retry ───────────────────────────────────────

  const handleViewfinderTap = useCallback(() => {
    const video = videoRef.current
    if (video && video.paused && streamRef.current) {
      console.log('👆 Tap-to-play retry...')
      video.play()
        .then(() => {
          console.log('▶️ Tap-to-play succeeded')
          setMessage(null)
        })
        .catch(err => console.warn('Tap-to-play failed:', err))
    }
  }, [])

  // ── Render ─────────────────────────────────────────────

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            <MdQrCodeScanner size={24} />
            Scan Barcode
          </h2>
          <div className={styles.headerActions}>
            <button
              className={styles.iconBtn}
              onClick={() => setShowManual(prev => !prev)}
              title="Manual entry"
            >
              <MdKeyboard size={22} />
            </button>
            <button className={styles.iconBtn} onClick={onClose} title="Close">
              <MdClose size={24} />
            </button>
          </div>
        </div>

        {/* Viewfinder */}
        <div className={styles.viewfinder} onClick={handleViewfinderTap}>
          {cameraLoading && (
            <div className={styles.loadingCamera}>
              <div className={styles.spinner} />
              <p>Starting camera…</p>
            </div>
          )}

          {/* video is ALWAYS rendered so videoRef.current is never null when attachAndPlay runs */}
          <video
            ref={videoRef}
            className={styles.video}
            style={{ opacity: hasCamera ? 1 : 0 }}
            autoPlay
            playsInline
            muted
            webkit-playsinline="true"
            x-webkit-airplay="allow"
            onPlaying={handleVideoPlaying}
          />

          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {hasCamera ? (
            <>
              {!cameraLoading && (
                <div className={styles.scanOverlay}>
                  <div ref={scanFrameRef} className={styles.scanFrame}>
                    <div className={styles.scanLine} />
                    <span className={styles.cornerTL} />
                    <span className={styles.cornerTR} />
                    <span className={styles.cornerBL} />
                    <span className={styles.cornerBR} />
                  </div>
                  <p className={styles.scanText}>
                    {detecting
                      ? '🔍 Reading barcode…'
                      : scanning
                        ? 'Align barcode in frame'
                        : processingRef.current
                          ? '⏳ Sending to server…'
                          : 'Align barcode in frame'}
                  </p>
                  <p className={styles.scanHint}>Hold steady · Good lighting helps</p>
                </div>
              )}

              {!cameraLoading && (
                <button className={styles.flashBtn} onClick={(e) => {
                  e.stopPropagation()
                  toggleFlash()
                }}>
                  {flashOn ? <MdFlashOn size={20} /> : <MdFlashOff size={20} />}
                </button>
              )}

              {/* Status message — inside viewfinder so absolute positioning works correctly */}
              {message && (
                <div className={`${styles.message} ${styles[message.type]}`}>
                  {message.type === 'in'        && <MdCheckCircle size={20} />}
                  {message.type === 'out'       && <MdLogout size={20} />}
                  {message.type === 'not_found' && <MdError size={20} />}
                  {message.type === 'error'     && <MdError size={20} />}
                  <span>{message.text}</span>
                </div>
              )}
            </>
          ) : !cameraLoading ? (
            <div className={styles.noCamera}>
              <MdCameraAlt size={48} />
              <p>Camera not available</p>
              <button
                className={styles.manualFallbackBtn}
                onClick={() => setShowManual(true)}
              >
                Enter barcode manually
              </button>
            </div>
          ) : null}
        </div>

        {/* Manual input */}
        {showManual && (
          <div className={styles.manualSection}>
            <p className={styles.manualLabel}>Or type / paste barcode:</p>
            <form className={styles.manualForm} onSubmit={handleManualSubmit}>
              <input
                className={styles.manualInput}
                type="text"
                inputMode="text"
                autoComplete="off"
                autoFocus
                placeholder="e.g. 8901234567890"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
              />
              <button
                className={styles.manualBtn}
                type="submit"
                disabled={!manualValue.trim()}
              >
                Scan
              </button>
            </form>
          </div>
        )}

        {/* Last scan */}
        {lastScan && !message && (
          <div className={styles.lastScan}>
            Last detected: <strong>{lastScan}</strong>
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <p>Same as USB scanner · Toggles IN / OUT automatically</p>
        </div>
      </div>
    </div>
  )
}

export default MobileBarcodeScanner