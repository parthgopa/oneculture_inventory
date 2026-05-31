import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
  MdKeyboard,
  MdWarning
} from 'react-icons/md'
import styles from './MobileBarcodeScanner.module.css'

// ══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE: Reduced delays for faster scan-to-result cycle
// ══════════════════════════════════════════════════════════════════════════════
const RESUME_DELAY_SUCCESS = 800   // ms after successful scan
const RESUME_DELAY_ERROR = 1000    // ms after error
const RESUME_DELAY_DUPLICATE = 1200 // ms after duplicate warning

/**
 * Mobile Barcode Scanner - Camera-based scanning for mobile devices
 * Uses canvas-based frame capture + ZXing decoding (reliable across all browsers)
 * Native BarcodeDetector API as secondary fallback
 * Same backend API as USB scanner: POST /api/scan {barcode_id, action_type?}
 * 
 * PERFORMANCE OPTIMIZED:
 * - Canvas context cached in ref (not re-acquired every frame)
 * - Scan loop state in refs (no re-renders during scanning)
 * - requestAnimationFrame for frame-perfect scanning
 * - Memoized callbacks and styles
 */
function MobileBarcodeScanner({ onClose, onScanSuccess, mode = null }) {
  // ══════════════════════════════════════════════════════════════════════════
  // STATE: Only for things that need to trigger re-renders
  // ══════════════════════════════════════════════════════════════════════════
  const [hasCamera, setHasCamera] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const [message, setMessage] = useState(null)
  const [cameraLoading, setCameraLoading] = useState(true)
  const [showManual, setShowManual] = useState(false)
  const [manualValue, setManualValue] = useState('')

  // ══════════════════════════════════════════════════════════════════════════
  // REFS: For scan loop - no re-renders needed
  // ══════════════════════════════════════════════════════════════════════════
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const canvasCtxRef = useRef(null) // PERF: Cache canvas context
  const scanFrameRef = useRef(null)
  const streamRef = useRef(null)
  const zxingReaderRef = useRef(null)
  const barcodeDetectorRef = useRef(null)
  const rafIdRef = useRef(null)
  const processingRef = useRef(false)
  const lastScanRef = useRef(null)
  const lastScanTimeRef = useRef(0) // PERF: Debounce rapid scans
  const mountedRef = useRef(true)
  const videoReadyRef = useRef(false)
  const scanStartedRef = useRef(false)
  const scanningRef = useRef(false) // PERF: Use ref instead of state for scan loop
  const detectingRef = useRef(false) // PERF: Use ref instead of state
  const sendToBackendRef = useRef(null) // PERF: Ref to avoid circular dependency

  // ══════════════════════════════════════════════════════════════════════════
  // MEMOIZED STYLES: Avoid creating new objects on every render
  // ══════════════════════════════════════════════════════════════════════════
  const headerStyle = useMemo(() => ({
    background: mode === 'IN' 
      ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.95) 0%, rgba(16, 185, 129, 0.7) 50%, transparent 100%)'
      : mode === 'OUT'
        ? 'linear-gradient(180deg, rgba(239, 68, 68, 0.95) 0%, rgba(239, 68, 68, 0.7) 50%, transparent 100%)'
        : undefined
  }), [mode])

  const scanFrameStyle = useMemo(() => ({
    '--scan-color': mode === 'IN' ? '#10b981' : mode === 'OUT' ? '#ef4444' : '#e8490d'
  }), [mode])

  const scanLineStyle = useMemo(() => ({
    background: mode === 'IN' 
      ? 'linear-gradient(90deg, transparent 0%, #10b981 40%, #10b981 60%, transparent 100%)'
      : mode === 'OUT'
        ? 'linear-gradient(90deg, transparent 0%, #ef4444 40%, #ef4444 60%, transparent 100%)'
        : undefined
  }), [mode])

  const cornerStyle = useMemo(() => ({
    borderColor: mode === 'IN' ? '#10b981' : mode === 'OUT' ? '#ef4444' : undefined
  }), [mode])

  const videoOpacityStyle = useMemo(() => ({ opacity: hasCamera ? 1 : 0 }), [hasCamera])

  // ── Helpers ──────────────────────────────────────────────

  // Short beep sound via Web Audio API (no audio file needed)
  const playBeep = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(1800, ctx.currentTime)
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
    } catch (err) {
      /* ZXing init failed */
    }

    if ('BarcodeDetector' in window) {
      try {
        barcodeDetectorRef.current = new window.BarcodeDetector({
          formats: [
            'qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39',
            'upc_a', 'upc_e', 'data_matrix', 'pdf417', 'itf'
          ]
        })
      } catch (e) {
        /* BarcodeDetector not supported */
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

      let mediaStream = null

      // ══════════════════════════════════════════════════════════════════════════
      // RESOLUTION NEGOTIATION FIX:
      // Use ONLY 'ideal' constraints (never 'min') so the browser gives the
      // highest resolution it can instead of rejecting the entire constraint set.
      // DO NOT include resizeMode: 'none' — many mobile browsers don't support it
      // and will silently reject the whole constraint set when bundled.
      // ══════════════════════════════════════════════════════════════════════════
      const attempts = [
        {
          label: 'back camera 4K',
          constraints: {
            video: {
              facingMode: { exact: 'environment' },
              width: { ideal: 3840 },
              height: { ideal: 2160 },
              frameRate: { ideal: 30 },
            },
            audio: false,
          },
        },
        {
          label: 'back camera 1080p',
          constraints: {
            video: {
              facingMode: { exact: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 },
            },
            audio: false,
          },
        },
        {
          label: 'back camera (ideal facing)',
          constraints: {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          },
        },
        {
          label: 'any camera HD',
          constraints: {
            video: {
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          },
        },
        {
          label: 'any camera',
          constraints: { video: true, audio: false },
        },
      ]

      for (const attempt of attempts) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(attempt.constraints)
          break
        } catch (err) {
          /* Try next constraint set */
        }
      }

      if (!mediaStream) throw new Error('All camera attempts failed')

      if (!mountedRef.current) {
        mediaStream.getTracks().forEach(t => t.stop())
        return
      }

      streamRef.current = mediaStream
      setHasCamera(true)

      const track = mediaStream.getVideoTracks()[0]
      if (track) {
        const settings = track.getSettings()
        const capabilities = track.getCapabilities?.() || {}
        

        // ══════════════════════════════════════════════════════════════════════════
        // AUTOFOCUS FIX: Apply continuous autofocus, exposure, and white balance
        // This is CRITICAL — without continuous autofocus the camera may lock
        // focus on the background and barcodes will be blurry.
        // ══════════════════════════════════════════════════════════════════════════
        const advancedConstraints = []
        
        if (capabilities.focusMode?.includes('continuous')) {
          advancedConstraints.push({ focusMode: 'continuous' })
        }
        if (capabilities.exposureMode?.includes('continuous')) {
          advancedConstraints.push({ exposureMode: 'continuous' })
        }
        if (capabilities.whiteBalanceMode?.includes('continuous')) {
          advancedConstraints.push({ whiteBalanceMode: 'continuous' })
        }
        
        if (advancedConstraints.length > 0) {
          try {
            await track.applyConstraints({ advanced: advancedConstraints })
          } catch (e) {
            /* Advanced constraints not supported */
          }
        }

        // ══════════════════════════════════════════════════════════════════════════
        // NO DIGITAL ZOOM: Digital zoom crops the sensor and upscales, destroying
        // pixel data and making barcodes blurrier. We want every real sensor pixel.
        // Optical zoom is not controllable via WebRTC.
        // ══════════════════════════════════════════════════════════════════════════
      }

      await attachAndPlay(mediaStream)

    } catch (err) {
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
      setCameraLoading(false)
      return
    }
    video.srcObject = mediaStream

    // MUST explicitly call play() — autoplay alone is unreliable on mobile
    const tryPlay = async (attempt) => {
      try {
        await video.play()
        return true
      } catch (err) {
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
      setCameraLoading(false)
      setMessage({
        type: 'error',
        text: 'Camera started but playback blocked. Tap the screen to retry.'
      })
    }
  }

  const stopEverything = () => {
    // Cancel requestAnimationFrame loop
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
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
    scanningRef.current = true

    setCameraLoading(false)
    setMessage(null)

    // Cancel any existing rAF loop
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
    }

    // PERF: Cache canvas context once
    if (canvasRef.current && !canvasCtxRef.current) {
      canvasCtxRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true })
    }

    // requestAnimationFrame loop - captures every unique frame exactly once
    const scanLoop = () => {
      if (!mountedRef.current || !videoReadyRef.current) return
      
      scanFrame()
      rafIdRef.current = requestAnimationFrame(scanLoop)
    }
    
    rafIdRef.current = requestAnimationFrame(scanLoop)
  }, [])

  const handleVideoPlaying = useCallback(() => {
    beginScanning() // backup: also called directly from attachAndPlay
  }, [beginScanning])

  // ── Core scan: crop canvas to scan frame region → decode ───

  const scanFrame = useCallback(() => {
    if (processingRef.current) return
    if (!videoReadyRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvasCtxRef.current
    if (!video || !canvas || !ctx) return
    if (video.readyState < 2) return
    if (video.videoWidth === 0 || video.videoHeight === 0) return

    // PERF: Disable image smoothing (nearest-neighbor preserves barcode edges)
    ctx.imageSmoothingEnabled = false

    const frameBounds = scanFrameRef.current?.getBoundingClientRect()
    const videoBounds = video.getBoundingClientRect()

    if (frameBounds && videoBounds && videoBounds.width > 0) {
      const videoW = video.videoWidth
      const videoH = video.videoHeight
      const displayW = videoBounds.width
      const displayH = videoBounds.height

      const scale = Math.max(displayW / videoW, displayH / videoH)
      const scaledW = videoW * scale
      const scaledH = videoH * scale
      const offsetX = (scaledW - displayW) / 2
      const offsetY = (scaledH - displayH) / 2
      const relX = frameBounds.left - videoBounds.left
      const relY = frameBounds.top - videoBounds.top

      let cropX = Math.max(0, (relX + offsetX) / scale)
      let cropY = Math.max(0, (relY + offsetY) / scale)
      let cropW = Math.min(videoW - cropX, frameBounds.width / scale)
      let cropH = Math.min(videoH - cropY, frameBounds.height / scale)

      // Add 20% margin for quiet zones
      const marginX = cropW * 0.20
      const marginY = cropH * 0.20
      cropX = Math.max(0, cropX - marginX)
      cropY = Math.max(0, cropY - marginY)
      cropW = Math.min(videoW - cropX, cropW + marginX * 2)
      cropH = Math.min(videoH - cropY, cropH + marginY * 2)

      const finalW = Math.round(cropW)
      const finalH = Math.round(cropH)
      canvas.width = finalW
      canvas.height = finalH
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, finalW, finalH)
    } else {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    }

    let decoded = null

    // Try ZXing first (synchronous canvas decode)
    if (zxingReaderRef.current) {
      try {
        const result = zxingReaderRef.current.decodeFromCanvas(canvas)
        if (result) {
          decoded = { value: result.getText() }
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
            // PERF: Debounce - don't scan same barcode within 500ms
            const now = Date.now()
            if (raw && raw !== lastScanRef.current && (now - lastScanTimeRef.current > 500)) {
              processingRef.current = true
              detectingRef.current = true
              lastScanRef.current = raw
              lastScanTimeRef.current = now
              sendToBackendRef.current?.(raw)
            }
          }
        })
        .catch(() => {})
      return
    }

    // Handle ZXing result
    if (decoded && decoded.value) {
      const raw = decoded.value.trim()
      // PERF: Debounce - don't scan same barcode within 500ms
      const now = Date.now()
      if (raw === lastScanRef.current && (now - lastScanTimeRef.current < 500)) return

      processingRef.current = true
      detectingRef.current = true
      lastScanRef.current = raw
      lastScanTimeRef.current = now
      sendToBackendRef.current?.(raw)
    }
  }, [])

  // ── Backend API call (SAME as USB scanner) ─────────────

  const sendToBackend = useCallback(async (barcodeValue) => {
    // Stop the rAF scan loop while processing
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    scanStartedRef.current = false
    scanningRef.current = false

    try {
      const payload = { barcode_id: barcodeValue.trim() }
      
      // Use dedicated routes for better performance
      const endpoint = mode === 'IN' ? '/api/scan/in' : mode === 'OUT' ? '/api/scan/out' : '/api/scan'
      
      console.time('backend')
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      console.timeEnd('backend')

      if (!mountedRef.current) return

      // Handle different response codes
      if (res.status === 404) {
        // Barcode not found in database
        setMessage({ 
          type: 'not_found', 
          text: `બારકોડ ડેટાબેઝમાં નથી — ${barcodeValue}` // Barcode not in database
        })
        resumeScanAfterDelay(RESUME_DELAY_ERROR)
      } else if (res.status === 409) {
        // Duplicate scan - already in same state
        if (data.error === 'already_in') {
          setMessage({ 
            type: 'duplicate', 
            text: `આ બારકોડ પહેલેથી સ્ટોક ઇન થયેલ છે — ${data.sku_name}` // This barcode is already stocked in
          })
        } else if (data.error === 'already_out') {
          setMessage({ 
            type: 'duplicate', 
            text: `આ બારકોડ પહેલેથી સ્ટોક આઉટ થયેલ છે — ${data.sku_name}` // This barcode is already stocked out
          })
        }
        playBeep() // Still beep to acknowledge scan
        resumeScanAfterDelay(RESUME_DELAY_DUPLICATE)
      } else if (res.status === 400 && data.error === 'no_stock') {
        // No stock available for OUT
        setMessage({ 
          type: 'error', 
          text: `સ્ટોક ઉપલબ્ધ નથી — ${data.sku_name}` // Stock not available
        })
        resumeScanAfterDelay(RESUME_DELAY_ERROR)
      } else if (res.ok) {
        // Success!
        const isIn = data.action_type === 'IN'
        setMessage({
          type: isIn ? 'in' : 'out',
          text: isIn 
            ? `સ્ટોક ઇન ✓ — ${data.sku_name} (સ્ટોક: ${data.current_stock})` // Stock In
            : `સ્ટોક આઉટ ✓ — ${data.sku_name} (સ્ટોક: ${data.current_stock})` // Stock Out
        })
        if (onScanSuccess) onScanSuccess(data)
        playBeep()
        if (navigator.vibrate) navigator.vibrate([100, 50, 100])
        resumeScanAfterDelay(RESUME_DELAY_SUCCESS)
      } else {
        // Other error
        setMessage({ 
          type: 'error', 
          text: data.error || 'સ્કેન નિષ્ફળ' // Scan failed
        })
        resumeScanAfterDelay(RESUME_DELAY_ERROR)
      }
    } catch (err) {
      if (!mountedRef.current) return
      setMessage({ 
        type: 'error', 
        text: `નેટવર્ક ભૂલ — ${err.message}` // Network error
      })
      resumeScanAfterDelay(RESUME_DELAY_ERROR)
    }
  }, [mode, onScanSuccess, playBeep])

  // Keep ref updated for scanFrame to use
  useEffect(() => {
    sendToBackendRef.current = sendToBackend
  }, [sendToBackend])

  const resumeScanAfterDelay = useCallback((ms) => {
    setTimeout(() => {
      if (!mountedRef.current) return
      processingRef.current = false
      detectingRef.current = false
      lastScanRef.current = null
      setMessage(null)
      scanningRef.current = true

      if (videoReadyRef.current) {
        scanStartedRef.current = false
        beginScanning()
      }
    }, ms)
  }, [beginScanning])

  // ── Flash toggle ───────────────────────────────────────

  const toggleFlash = useCallback(async () => {
    if (!streamRef.current) return
    const track = streamRef.current.getVideoTracks()[0]
    if (!track) return

    try {
      const next = !flashOn
      await track.applyConstraints({ advanced: [{ torch: next }] })
      setFlashOn(next)
    } catch (err) {
      if (flashOn === false) {
        setMessage({ type: 'error', text: 'ફ્લેશ ઉપલબ્ધ નથી' }) // Flash not available
        setTimeout(() => mountedRef.current && setMessage(null), 2000)
      }
    }
  }, [flashOn])

  // ── Manual entry ───────────────────────────────────────

  const handleManualSubmit = useCallback((e) => {
    e.preventDefault()
    const val = manualValue.trim()
    if (!val) return
    processingRef.current = true
    lastScanRef.current = val
    sendToBackend(val)
    setManualValue('')
  }, [manualValue, sendToBackend])

  // ── Tap-to-retry ───────────────────────────────────────

  const handleViewfinderTap = useCallback(() => {
    const video = videoRef.current
    if (video && video.paused && streamRef.current) {
      video.play()
        .then(() => setMessage(null))
        .catch(() => { /* Tap-to-play failed */ })
    }
  }, [])

  // ── Render ─────────────────────────────────────────────

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.header} style={headerStyle}>
          <h2 className={styles.title}>
            <MdQrCodeScanner size={24} />
            {mode === 'IN' ? 'સ્ટોક ઇન' : mode === 'OUT' ? 'સ્ટોક આઉટ' : 'બારકોડ સ્કેન'}
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

          {/* ══════════════════════════════════════════════════════════════════════
              VIDEO ELEMENT ATTRIBUTES FIX:
              - autoPlay, playsInline, muted are required for mobile autoplay
              - webkit-playsinline="true" for iOS Safari
              - NO CSS transform: scale(), max-width, max-height that would downscale
              - object-fit: cover is fine (handled in CSS)
              ══════════════════════════════════════════════════════════════════════ */}
          <video
            ref={videoRef}
            className={styles.video}
            style={videoOpacityStyle}
            autoPlay
            playsInline
            muted
            webkit-playsinline="true"
            x-webkit-airplay="allow"
            disablePictureInPicture
            disableRemotePlayback
            onPlaying={handleVideoPlaying}
          />

          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {hasCamera ? (
            <>
              {!cameraLoading && (
                <div className={styles.scanOverlay}>
                  <div 
                    ref={scanFrameRef} 
                    className={styles.scanFrame}
                    style={scanFrameStyle}
                  >
                    <div className={styles.scanLine} style={scanLineStyle} />
                    <span className={styles.cornerTL} style={cornerStyle} />
                    <span className={styles.cornerTR} style={cornerStyle} />
                    <span className={styles.cornerBL} style={cornerStyle} />
                    <span className={styles.cornerBR} style={cornerStyle} />
                  </div>
                  <p className={styles.scanText}>
                    {mode === 'IN' ? 'સ્ટોક ઉમેરવા સ્કેન કરો' : mode === 'OUT' ? 'સ્ટોક કાઢવા સ્કેન કરો' : 'બારકોડ ફ્રેમમાં રાખો'}
                  </p>
                  <p className={styles.scanHint}>
                    {mode === 'IN' ? 'દરેક સ્કેન +1 સ્ટોક ઉમેરે છે' : mode === 'OUT' ? 'દરેક સ્કેન -1 સ્ટોક કાઢે છે' : 'સ્થિર રાખો · નાના બારકોડ માટે નજીક જાઓ'}
                  </p>
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

              {/* Status message — inside viewfinder */}
              {message && (
                <div className={`${styles.message} ${styles[message.type]}`}>
                  {message.type === 'in'        && <MdCheckCircle size={20} />}
                  {message.type === 'out'       && <MdLogout size={20} />}
                  {message.type === 'duplicate' && <MdWarning size={20} />}
                  {message.type === 'not_found' && <MdError size={20} />}
                  {message.type === 'error'     && <MdError size={20} />}
                  <span>{message.text}</span>
                </div>
              )}
            </>
          ) : !cameraLoading ? (
            <div className={styles.noCamera}>
              <MdCameraAlt size={48} />
              <p>કેમેરા ઉપલબ્ધ નથી</p>
              <button
                className={styles.manualFallbackBtn}
                onClick={() => setShowManual(true)}
              >
                બારકોડ મેન્યુઅલી દાખલ કરો
              </button>
            </div>
          ) : null}
        </div>

        {/* Manual input */}
        {showManual && (
          <div className={styles.manualSection}>
            <p className={styles.manualLabel}>અથવા બારકોડ ટાઇપ / પેસ્ટ કરો:</p>
            <form className={styles.manualForm} onSubmit={handleManualSubmit}>
              <input
                className={styles.manualInput}
                type="text"
                inputMode="text"
                autoComplete="off"
                autoFocus
                placeholder="દા.ત. 8901234567890"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
              />
              <button
                className={styles.manualBtn}
                type="submit"
                disabled={!manualValue.trim()}
              >
                સ્કેન
              </button>
            </form>
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <p>{mode === 'IN' ? 'સ્ટોક ઇન મોડ' : mode === 'OUT' ? 'સ્ટોક આઉટ મોડ' : 'ઓટો ટૉગલ મોડ'}</p>
        </div>
      </div>
    </div>
  )
}

export default MobileBarcodeScanner