import { useState, useRef } from 'react'
import { MdImage, MdClose, MdCompress, MdWarning } from 'react-icons/md'
import styles from './ImageUpload.module.css'

// ─── Image compression utility ────────────────────────────────────────────────

const compressImage = (file, quality = 0.7, maxWidth = 1200) => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // Scale down if too large
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // Convert to base64 with compression
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality)
        resolve(compressedBase64)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

// ─── Component ────────────────────────────────────────────────────────────────

function ImageUpload({ 
  currentImage, 
  onImageChange, 
  onImageRemove,
  maxSizeMB = 20,
  compressThresholdMB = 2 
}) {
  const fileInputRef = useRef(null)
  const [showModal, setShowModal] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [compressing, setCompressing] = useState(false)

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    const fileSizeMB = file.size / (1024 * 1024)

    // If over max size, show compression modal
    if (fileSizeMB > maxSizeMB) {
      setPendingFile(file)
      setShowModal(true)
      return
    }

    // If over threshold but under max, ask to compress
    if (fileSizeMB > compressThresholdMB) {
      setPendingFile(file)
      setShowModal(true)
      return
    }

    // Small file - process directly
    processFile(file, false)
  }

  const processFile = async (file, shouldCompress) => {
    if (shouldCompress) {
      setCompressing(true)
      try {
        const compressed = await compressImage(file)
        onImageChange(compressed)
      } catch (err) {
        console.error('Compression failed:', err)
        alert('Failed to compress image')
      } finally {
        setCompressing(false)
        setShowModal(false)
        setPendingFile(null)
      }
    } else {
      // Read as base64 without compression
      const reader = new FileReader()
      reader.onload = (event) => {
        onImageChange(event.target.result)
      }
      reader.readAsDataURL(file)
      setShowModal(false)
      setPendingFile(null)
    }
  }

  const handleCompress = () => {
    if (pendingFile) {
      processFile(pendingFile, true)
    }
  }

  const handleSkipCompress = () => {
    if (pendingFile) {
      const fileSizeMB = pendingFile.size / (1024 * 1024)
      if (fileSizeMB > maxSizeMB) {
        alert(`File is too large (${formatFileSize(pendingFile.size)}). Please compress or choose a smaller image.`)
        return
      }
      processFile(pendingFile, false)
    }
  }

  const handleCancel = () => {
    setShowModal(false)
    setPendingFile(null)
  }

  return (
    <>
      {currentImage ? (
        <div className={styles.imagePreview}>
          <img src={currentImage} alt="Product preview" className={styles.previewImg} />
          <button type="button" onClick={onImageRemove} className={styles.removeBtn}>
            <MdClose size={16} />
          </button>
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()} 
            className={styles.changeBtn}
            title="Change image"
          >
            <MdImage size={16} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className={styles.uploadArea}
        >
          <MdImage size={32} className={styles.uploadIcon} />
          <div className={styles.uploadText}>Click to upload product image</div>
          <div className={styles.uploadHint}>Max {maxSizeMB}MB • JPG, PNG</div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Compression Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <MdWarning size={24} className={styles.warningIcon} />
              <h3>Large Image Detected</h3>
            </div>
            
            <div className={styles.modalBody}>
              <p>
                The selected image is <strong>{formatFileSize(pendingFile?.size || 0)}</strong>.
              </p>
              {pendingFile && pendingFile.size / (1024 * 1024) > maxSizeMB ? (
                <p className={styles.errorText}>
                  This exceeds the maximum size of {maxSizeMB}MB. 
                  Please compress the image to continue.
                </p>
              ) : (
                <p>
                  Would you like to compress it for faster uploads and better performance?
                </p>
              )}
            </div>

            <div className={styles.modalActions}>
              <button 
                onClick={handleCancel} 
                className={`btn btn-outline ${styles.modalBtn}`}
                disabled={compressing}
              >
                Cancel
              </button>
              
              {pendingFile && pendingFile.size / (1024 * 1024) <= maxSizeMB && (
                <button 
                  onClick={handleSkipCompress} 
                  className={`btn btn-outline ${styles.modalBtn}`}
                  disabled={compressing}
                >
                  Keep Original
                </button>
              )}
              
              <button 
                onClick={handleCompress} 
                className={`btn btn-primary ${styles.modalBtn}`}
                disabled={compressing}
              >
                {compressing ? (
                  <>
                    <span className="loading"></span>
                    Compressing...
                  </>
                ) : (
                  <>
                    <MdCompress size={18} />
                    Compress & Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ImageUpload
