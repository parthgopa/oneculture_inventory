// scannerDetection.js
// Keyboard-emulation barcode scanners send keystrokes very fast (all chars in <100ms).
// We buffer them and trigger when Enter arrives or when a pause is detected.

export class ScannerDetectionService {
  constructor() {
    this._callbackRef = null  // points to latest callback — avoids stale closure
    this._buffer = ''
    this._lastKeyTime = 0
    this._INTER_KEY_TIMEOUT = 200  // ms between chars (increased for slower scanners)
    this._MIN_BARCODE_LEN = 3
    this._MAX_BARCODE_LEN = 50     // auto-trigger if buffer gets this long
    this._AUTO_TRIGGER_LEN = 30    // fallback: trigger without Enter if buffer >= this
    this._pasteBuffer = ''
    this._pasteTimeout = null
    this._connectedHIDDevices = []  // Track opened HID devices for data reading
  }

  // ─── Browser capability ───────────────────────────────────────────────────

  getBrowserSupport() {
    return {
      hid: 'hid' in navigator,
      bluetooth: 'bluetooth' in navigator,
      keyboard: true
    }
  }

  // ─── HID auto-detect (already-granted devices, no click needed) ───────────

  // Keywords that indicate a barcode/RFID scanner dongle.
  // Devices NOT matching these are ignored for auto-registration.
  _isScannerDevice(device) {
    const name = (device.productName || '').toLowerCase()
    const scannerKeywords = [
      'scanner', 'barcode', 'reader', 'scan', 'rfid',
      'wireless receiver', '2.4g', 'usb receiver', 'hid pos', 'hidi2c',
      'unknown'  // Allow 'Unknown Device' through - often raw HID scanners
    ]
    return scannerKeywords.some(kw => name.includes(kw))
  }

  // Returns ONLY currently physically connected scanner-type HID devices.
  // Strategy: getDevices() gives previously-granted list; then we check
  // device.opened — if it's already open it's live; otherwise we try a
  // quick open() and close() to verify the device is actually present.
  async getGrantedHIDDevices() {
    if (!navigator.hid) {
      console.warn('⚠️ WebHID not supported in this browser (use Chrome/Edge)')
      return []
    }
    try {
      const all = await navigator.hid.getDevices()

      // Deduplicate by vendorId+productId — Windows exposes multiple HID
      // interfaces per physical device
      const seen = new Set()
      const unique = []
      for (const device of all) {
        const key = `${device.vendorId}-${device.productId}`
        if (!seen.has(key)) {
          seen.add(key)
          unique.push(device)
        }
      }

      const live = []
      for (const device of unique) {
        if (!this._isScannerDevice(device)) continue
        const connected = await this._checkDeviceConnected(device)
        if (connected) live.push(device)
      }
      return live
    } catch (err) {
      console.error('HID getDevices error:', err)
      return []
    }
  }

  // Try to open a device to confirm it is physically present.
  async _checkDeviceConnected(device) {
    try {
      if (device.opened) return true   // already open = definitely live
      await device.open()
      await device.close()
      return true
    } catch {
      // open() fails when device is not physically connected
      return false
    }
  }

  // Ask user to grant access to a new USB HID device
  async requestHIDDevice() {
    if (!navigator.hid) throw new Error('WebHID not supported')
    try {
      // Empty filters = show all HID devices
      const devices = await navigator.hid.requestDevice({ filters: [] })
      const device = devices[0]
      if (!device) return null
      
      // Open the device and set up data listener
      await this.connectHIDDevice(device)
      return device
    } catch (err) {
      if (err.name === 'NotFoundError' || err.name === 'SecurityError') {
        throw new Error('USB pairing cancelled')
      }
      throw err
    }
  }

  // Connect to a HID device and listen for barcode data
  async connectHIDDevice(device) {
    try {
      if (!device.opened) {
        await device.open()
      }

      // Set up input report listener for barcode data
      device.addEventListener('inputreport', (event) => {
        const { data } = event
        const barcode = this._parseHIDBarcode(data)
        if (barcode && this._callbackRef?.current) {
          console.log('✅ Barcode scanned:', barcode)
          this._callbackRef.current(barcode)
        }
      })

      // Track connected device
      if (!this._connectedHIDDevices.find(d => d === device)) {
        this._connectedHIDDevices.push(device)
      }

      return device
    } catch (err) {
      console.error('Failed to connect HID device:', err)
      throw err
    }
  }

  // Parse barcode from HID input report data
  _parseHIDBarcode(dataView) {
    try {
      const bytes = new Uint8Array(dataView.buffer)
      let barcode = ''
      for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i]
        if (byte >= 32 && byte <= 126) {
          barcode += String.fromCharCode(byte)
        }
      }
      barcode = barcode.trim()
      return barcode.length >= this._MIN_BARCODE_LEN ? barcode : null
    } catch {
      return null
    }
  }

  // Ask user to pair a Bluetooth device
  async requestBluetoothDevice() {
    if (!navigator.bluetooth) throw new Error('Web Bluetooth not supported')
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service']
      })
      return device
    } catch (err) {
      if (err.name === 'NotFoundError') throw new Error('Bluetooth pairing cancelled')
      throw err
    }
  }

  // ─── Keyboard listener ────────────────────────────────────────────────────
  // IMPORTANT: we store the callback in this._callbackRef so the handler
  // always calls the *latest* version — no stale-closure bugs.

  setupKeyboardListener(callbackRef) {
    this._callbackRef = callbackRef

    let buffer = ''
    let lastKeyTime = 0
    let altBuffer = ''
    let altKeyDown = false

    const triggerBarcode = () => {
      const scanned = buffer.trim()
      buffer = ''
      if (scanned.length >= this._MIN_BARCODE_LEN) {
        console.log('✅ Barcode scanned:', scanned)
        if (this._callbackRef?.current) {
          this._callbackRef.current(scanned)
        }
      }
    }

    const onKeyDown = (e) => {
      const now = Date.now()
      const gap = now - lastKeyTime

      // Handle Alt+Numpad ASCII input mode
      if (e.key === 'Alt') {
        altKeyDown = true
        altBuffer = ''
        return
      }

      if (altKeyDown && e.code?.startsWith('Numpad')) {
        const digit = e.code.replace('Numpad', '')
        if (digit >= '0' && digit <= '9') {
          altBuffer += digit
          e.preventDefault()
          return
        }
      }

      if (e.key.length > 1 && e.key !== 'Enter') return
      if (e.ctrlKey || e.metaKey) return
      if (e.altKey && e.key !== 'Alt') return

      // Reset buffer if gap is too large (manual typing)
      if (gap > 300 && buffer.length > 0) buffer = ''

      if (e.key === 'Enter') {
        triggerBarcode()
      } else {
        buffer += e.key
        if (buffer.length >= this._AUTO_TRIGGER_LEN) triggerBarcode()
        if (buffer.length > this._MAX_BARCODE_LEN) buffer = ''
      }

      lastKeyTime = now
    }

    const onKeyUp = (e) => {
      if (e.key === 'Alt' && altKeyDown) {
        altKeyDown = false
        if (altBuffer.length > 0) {
          const asciiCode = parseInt(altBuffer, 10)
          if (asciiCode >= 32 && asciiCode <= 126) {
            buffer += String.fromCharCode(asciiCode)
            lastKeyTime = Date.now()
            if (buffer.length >= this._AUTO_TRIGGER_LEN) triggerBarcode()
          }
        }
        altBuffer = ''
      }
    }

    // Only attach to document (not window) to avoid duplicate events
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('keyup', onKeyUp, true)
    }
  }

  // Legacy method kept for compatibility
  getSavedScanners() {
    try {
      const saved = localStorage.getItem('barcode_scanners')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  }
}

export const scannerService = new ScannerDetectionService()
