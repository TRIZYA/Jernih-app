import { useCallback, useEffect, useRef, useState } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { createUpscaleJob } from './engines/upscale.js'
import { firebaseAuth, isFirebaseConfigured } from './services/firebase.js'
import {
  analyzeImageWithPuter,
  initializePuter,
  recognizeTextWithPuter,
  signInToPuter,
  signOutFromPuter,
} from './services/puter.js'
import './App.css'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const EXTENSION_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

const PRESETS = [
  { id: 'photo', label: 'Foto', description: 'Warna dan detail alami' },
  { id: 'document', label: 'Dokumen', description: 'Teks dan garis' },
  { id: 'illustration', label: 'Ilustrasi', description: 'Grafis dan anime' },
]

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds} dtk`
  return `${Math.floor(seconds / 60)} mnt ${seconds % 60} dtk`
}

function getImageType(file) {
  if (SUPPORTED_TYPES.has(file.type)) return file.type
  const extension = file.name.split('.').pop()?.toLowerCase()
  return EXTENSION_TYPES[extension] || file.type
}

function Icon({ name, size = 20 }) {
  const paths = {
    sparkle: (
      <>
        <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
        <path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M20 16.5v2A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-2" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    close: (
      <>
        <path d="m18 6-12 12M6 6l12 12" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

function App() {
  const inputRef = useRef(null)
  const jobRef = useRef(null)
  const inferenceStartedAtRef = useRef(null)
  const requestIdRef = useRef(0)
  const ocrRequestIdRef = useRef(0)
  const toastTimerRef = useRef(null)
  const analysisControllerRef = useRef(null)
  const panPointerRef = useRef(null)
  const [authUser, setAuthUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured)
  const [authError, setAuthError] = useState('')
  const [puterUser, setPuterUser] = useState(null)
  const [puterReady, setPuterReady] = useState(false)
  const [puterError, setPuterError] = useState('')
  const [isConsentOpen, setIsConsentOpen] = useState(false)
  const [consentAction, setConsentAction] = useState('advice')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [recommendation, setRecommendation] = useState(null)
  const [isRecognizingText, setIsRecognizingText] = useState(false)
  const [recognizedText, setRecognizedText] = useState('')
  const [ocrError, setOcrError] = useState('')
  const [copyError, setCopyError] = useState('')
  const [image, setImage] = useState(null)
  const [result, setResult] = useState(null)
  const [preset, setPreset] = useState('photo')
  const [quality, setQuality] = useState('quality')
  const [scale, setScale] = useState(4)
  const [progress, setProgress] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [comparePosition, setComparePosition] = useState(50)
  const [compareZoom, setCompareZoom] = useState(1)
  const [comparePan, setComparePan] = useState({ x: 0, y: 0 })
  const [isPanMode, setIsPanMode] = useState(false)
  const [downloadFormat, setDownloadFormat] = useState('image/png')
  const [downloadQuality, setDownloadQuality] = useState(0.92)
  const [exporting, setExporting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!image?.url) return undefined
    return () => URL.revokeObjectURL(image.url)
  }, [image?.url])

  useEffect(() => {
    if (!result?.url) return undefined
    return () => URL.revokeObjectURL(result.url)
  }, [result?.url])

  useEffect(() => {
    if (!firebaseAuth) return undefined
    return onAuthStateChanged(firebaseAuth, (user) => {
      setAuthUser(user)
      setAuthLoading(false)
    }, (authStateError) => {
      setAuthLoading(false)
      setAuthError(`Status login Firebase gagal diperiksa: ${authStateError.message}`)
    })
  }, [])

  useEffect(() => {
    let active = true
    initializePuter()
      .then(({ user }) => {
        if (!active) return
        setPuterUser(user)
        setPuterReady(true)
        setPuterError('')
      })
      .catch((error) => {
        if (!active) return
        setPuterReady(false)
        setPuterError(error.message || 'SDK Puter tidak dapat dimuat.')
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!isConsentOpen) return undefined
    function closeConsent(event) {
      if (event.key === 'Escape') setIsConsentOpen(false)
    }
    window.addEventListener('keydown', closeConsent)
    return () => window.removeEventListener('keydown', closeConsent)
  }, [isConsentOpen])

  useEffect(
    () => () => {
      window.clearTimeout(toastTimerRef.current)
      jobRef.current?.cancel()
      analysisControllerRef.current?.abort()
    },
    [],
  )

  const showToast = useCallback((message) => {
    window.clearTimeout(toastTimerRef.current)
    setToast(message)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 3200)
  }, [])

  const cancelProcessing = useCallback(() => {
    if (!jobRef.current) {
      setIsProcessing(false)
      setProgress(null)
      return
    }
    setIsCancelling(true)
    setProgress((current) => current && {
      ...current,
      stage: 'cancelling',
      message: 'Membatalkan dan membersihkan proses…',
    })
    jobRef.current.cancel()
  }, [])

  function resetCompareView() {
    setCompareZoom(1)
    setComparePan({ x: 0, y: 0 })
    setComparePosition(50)
    setIsPanMode(false)
    panPointerRef.current = null
  }

  function changeCompareZoom(nextZoom) {
    const zoom = Math.max(1, Math.min(4, Math.round(nextZoom * 4) / 4))
    setCompareZoom(zoom)
    if (zoom === 1) setComparePan({ x: 0, y: 0 })
  }

  function handleComparePointerDown(event) {
    const targetInput = event.target instanceof HTMLInputElement ? event.target : null
    if (!isPanMode || event.target.closest('button') || (targetInput && !targetInput.disabled)) return
    event.currentTarget.setPointerCapture(event.pointerId)
    panPointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: comparePan.x,
      panY: comparePan.y,
    }
  }

  function handleComparePointerMove(event) {
    const start = panPointerRef.current
    if (!start || start.pointerId !== event.pointerId) return
    const maxX = (event.currentTarget.clientWidth * (compareZoom - 1)) / 2
    const maxY = (event.currentTarget.clientHeight * (compareZoom - 1)) / 2
    setComparePan({
      x: Math.max(-maxX, Math.min(maxX, start.panX + event.clientX - start.startX)),
      y: Math.max(-maxY, Math.min(maxY, start.panY + event.clientY - start.startY)),
    })
  }

  function stopComparePan(event) {
    if (panPointerRef.current?.pointerId === event.pointerId) panPointerRef.current = null
  }

  async function handlePuterSignIn() {
    setPuterError('')
    try {
      const { user } = await signInToPuter()
      setPuterUser(user)
      setPuterReady(true)
      setAnalysisError('')
      setOcrError('')
    } catch (signInError) {
      if (signInError.error !== 'auth_window_closed') {
        setPuterError(signInError.msg || signInError.message || 'Login Puter gagal. Coba lagi.')
      }
    }
  }

  async function handlePuterSignOut() {
    setPuterError('')
    analysisControllerRef.current?.abort()
    analysisControllerRef.current = null
    ocrRequestIdRef.current += 1
    setIsAnalyzing(false)
    setIsRecognizingText(false)
    try {
      await signOutFromPuter()
      setPuterUser(null)
      setRecommendation(null)
      setRecognizedText('')
    } catch (signOutError) {
      setPuterError(signOutError.message || 'Logout Puter gagal.')
    }
  }

  async function handleFirebaseSignIn() {
    if (!firebaseAuth) {
      setAuthError('Firebase belum dikonfigurasi. Isi variabel VITE_FIREBASE_* lalu mulai ulang aplikasi.')
      return
    }
    setAuthError('')
    try {
      await signInWithPopup(firebaseAuth, new GoogleAuthProvider())
    } catch (signInError) {
      if (signInError.code !== 'auth/popup-closed-by-user') {
        setAuthError(`Login Google gagal: ${signInError.message}`)
      }
    }
  }

  async function handleFirebaseSignOut() {
    if (!firebaseAuth) return
    setAuthError('')
    try {
      await signOut(firebaseAuth)
    } catch (signOutError) {
      setAuthError(`Logout Firebase gagal: ${signOutError.message}`)
    }
  }

  async function requestAiAnalysis() {
    if (!puterUser || !image || isAnalyzing || isRecognizingText) return
    setIsConsentOpen(false)
    setAnalysisError('')
    setRecommendation(null)
    setIsAnalyzing(true)
    const controller = new AbortController()
    analysisControllerRef.current = controller

    try {
      const suggestion = await analyzeImageWithPuter(image.file, controller.signal)
      if (!window.puter?.auth?.isSignedIn?.()) return
      setRecommendation(suggestion)
    } catch (analysisFailure) {
      if (analysisFailure.name !== 'AbortError') {
        setAnalysisError(`${analysisFailure.msg || analysisFailure.message || 'Puter AI gagal memberi saran.'} Pemrosesan lokal tetap tersedia.`)
      }
    } finally {
      if (analysisControllerRef.current === controller) {
        analysisControllerRef.current = null
        setIsAnalyzing(false)
      }
    }
  }

  async function runOcr() {
    if (!puterUser || !result?.blob || isRecognizingText || isAnalyzing) return
    setIsConsentOpen(false)
    setOcrError('')
    setCopyError('')
    setRecognizedText('')
    setIsRecognizingText(true)
    const requestId = ++ocrRequestIdRef.current
    try {
      const text = await recognizeTextWithPuter(result.blob)
      if (requestId !== ocrRequestIdRef.current || !window.puter?.auth?.isSignedIn?.()) return
      setRecognizedText(text)
    } catch (recognitionError) {
      if (requestId === ocrRequestIdRef.current) {
        setOcrError(`${recognitionError.msg || recognitionError.message || 'OCR gagal membaca gambar.'} Hasil upscale visual tetap tersedia.`)
      }
    } finally {
      if (requestId === ocrRequestIdRef.current) setIsRecognizingText(false)
    }
  }

  async function rotateImage(direction) {
    if (!image || isRotating || isProcessing || isAnalyzing || isRecognizingText) return
    setIsRotating(true)
    setError('')
    const requestId = requestIdRef.current
    const sourceFile = image.file
    let bitmap
    try {
      bitmap = await createImageBitmap(sourceFile, { imageOrientation: 'from-image' })
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.height
      canvas.height = bitmap.width
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Browser tidak dapat menyiapkan rotasi gambar.')
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.translate(canvas.width / 2, canvas.height / 2)
      context.rotate((direction * Math.PI) / 2)
      context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((encoded) => {
          if (encoded) resolve(encoded)
          else reject(new Error('Browser gagal memutar gambar.'))
        }, 'image/png')
      })
      const rotatedFile = new File(
        [blob],
        sourceFile.name.replace(/\.[^.]+$/, '') + '-rotated.png',
        { type: 'image/png' },
      )
      if (requestId !== requestIdRef.current) return
      const url = URL.createObjectURL(blob)
      setImage((current) => current?.file === sourceFile
        ? { ...current, file: rotatedFile, url, width: canvas.width, height: canvas.height, type: 'image/png' }
        : current)
      setResult(null)
      setRecommendation(null)
      setRecognizedText('')
      setOcrError('')
      resetCompareView()
      showToast('Orientasi gambar diperbarui.')
    } catch (rotationError) {
      setError(rotationError.message || 'Gambar gagal diputar.')
    } finally {
      bitmap?.close()
      setIsRotating(false)
    }
  }

  async function copyRecognizedText() {
    try {
      await navigator.clipboard.writeText(recognizedText)
      setCopyError('')
      showToast('Teks OCR berhasil disalin.')
    } catch (clipboardError) {
      setCopyError(`Tidak dapat menyalin teks: ${clipboardError.message}`)
    }
  }

  function applyRecommendation() {
    if (!recommendation) return
    setPreset(recommendation.preset)
    setScale(recommendation.scale)
    setQuality('quality')
    showToast('Saran diterapkan. Periksa pengaturan sebelum memproses.')
  }

  const loadImage = useCallback((file) => {
    setError('')
    const type = getImageType(file)
    if (!SUPPORTED_TYPES.has(type)) {
      setError('Format belum didukung. Pilih gambar JPG, PNG, atau WebP.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Ukuran gambar melebihi 20 MB. Pilih file yang lebih kecil.')
      return
    }
    if (file.size === 0) {
      setError('File gambar kosong atau tidak dapat dibaca.')
      return
    }

    analysisControllerRef.current?.abort()
    analysisControllerRef.current = null
    ocrRequestIdRef.current += 1
    setIsAnalyzing(false)
    setIsRecognizingText(false)
    setIsConsentOpen(false)
    setAnalysisError('')
    setOcrError('')
    setCopyError('')
    setRecommendation(null)
    setRecognizedText('')
    const requestId = ++requestIdRef.current
    cancelProcessing()
    setResult(null)
    const url = URL.createObjectURL(file)
    const preview = new Image()
    setIsReading(true)
    preview.onload = () => {
      if (requestId !== requestIdRef.current) {
        URL.revokeObjectURL(url)
        return
      }
      if (!preview.naturalWidth || !preview.naturalHeight) {
        URL.revokeObjectURL(url)
        setIsReading(false)
        setError('Gambar tidak memiliki dimensi yang valid. Coba file lain.')
        return
      }
      setImage({
        file,
        url,
        width: preview.naturalWidth,
        height: preview.naturalHeight,
        type,
      })
      setIsReading(false)
      setError('')
      showToast('Gambar siap untuk diatur.')
    }
    preview.onerror = () => {
      URL.revokeObjectURL(url)
      if (requestId !== requestIdRef.current) return
      setIsReading(false)
      setError('Gambar tidak dapat dibuka. Pastikan file tidak rusak.')
    }
    preview.src = url
  }, [cancelProcessing, showToast])

  useEffect(() => {
    function handlePaste(event) {
      const file = [...(event.clipboardData?.items || [])]
        .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
        ?.getAsFile()
      if (file) {
        event.preventDefault()
        loadImage(file)
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [loadImage])

  function clearImage() {
    requestIdRef.current += 1
    cancelProcessing()
    analysisControllerRef.current?.abort()
    analysisControllerRef.current = null
    ocrRequestIdRef.current += 1
    setIsAnalyzing(false)
    setIsRecognizingText(false)
    setIsConsentOpen(false)
    setAnalysisError('')
    setOcrError('')
    setCopyError('')
    setRecommendation(null)
    setRecognizedText('')
    setImage(null)
    setResult(null)
    setError('')
    setIsReading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) loadImage(file)
  }

  function handleDragOver(event) {
    event.preventDefault()
    setIsDragging(true)
  }

  async function processImage() {
    if (!image || isProcessing || isRotating) return
    setError('')
    setResult(null)
    setRecognizedText('')
    setOcrError('')
    setIsProcessing(true)
    setProgress({ progress: 0, stage: 'starting', message: 'Menyiapkan pemrosesan…' })
    inferenceStartedAtRef.current = null
    const job = createUpscaleJob(
      image.file,
      {
        mode: quality === 'fast' ? 'fast' : 'quality',
        scale: quality === 'fast' ? 2 : Number(scale),
        preset,
      },
      (update) => {
        let remainingSeconds = null
        if (update.stage === 'inference') {
          inferenceStartedAtRef.current ??= performance.now()
          const ratio = update.total
            ? update.completed / update.total
            : Math.max(0, (update.progress - 10) / 80)
          const elapsedSeconds = (performance.now() - inferenceStartedAtRef.current) / 1000
          if (ratio >= 0.08 && ratio < 1) {
            remainingSeconds = Math.max(1, Math.round((elapsedSeconds * (1 - ratio)) / ratio))
          }
        }
        setProgress({ ...update, remainingSeconds })
      },
    )
    jobRef.current = job

    try {
      const output = await job.promise
      const url = URL.createObjectURL(output.blob)
      setResult({ ...output, url, blob: output.blob })
      setRecognizedText('')
      setOcrError('')
      setComparePosition(50)
      resetCompareView()
      showToast('Gambar selesai diproses.')
    } catch (processingError) {
      if (processingError.name !== 'AbortError') {
        setError(processingError.message || 'Gambar gagal diproses. Coba mode Cepat atau skala lebih kecil.')
      } else {
        showToast('Pemrosesan dibatalkan.')
      }
    } finally {
      if (jobRef.current === job) {
        jobRef.current = null
        setIsProcessing(false)
        setIsCancelling(false)
        setProgress(null)
      }
    }
  }

  async function downloadResult() {
    if (!result || exporting) return
    setExporting(true)
    setError('')
    try {
      let blob = result.blob
      if (downloadFormat !== 'image/png') {
        const bitmap = await createImageBitmap(result.blob)
        try {
          const canvas = document.createElement('canvas')
          canvas.width = result.width
          canvas.height = result.height
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Browser tidak dapat menyiapkan gambar untuk diunduh.')
          context.drawImage(bitmap, 0, 0)
          blob = await new Promise((resolve, reject) => {
            canvas.toBlob(
              (encoded) => {
                if (encoded) resolve(encoded)
                else reject(new Error('Browser gagal mengekspor format gambar yang dipilih.'))
              },
              downloadFormat,
              downloadQuality,
            )
          })
        } finally {
          bitmap.close()
        }
      }

      const extension = downloadFormat === 'image/jpeg' ? 'jpg' : downloadFormat.split('/')[1]
      if (blob.type !== downloadFormat) {
        throw new Error(`Browser ini tidak mendukung ekspor ${extension.toUpperCase()}. Pilih format lain.`)
      }
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${image.file.name.replace(/\.[^.]+$/, '')}-jernih.${extension}`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      showToast(`Hasil ${extension.toUpperCase()} siap diunduh.`)
    } catch (downloadError) {
      setError(downloadError.message || 'Hasil gagal diekspor.')
    } finally {
      setExporting(false)
    }
  }

  const selectedPreset = PRESETS.find((item) => item.id === preset)
  const outputScale = quality === 'fast' ? 2 : Number(scale)
  const estimatedWidth = image ? image.width * outputScale : 0
  const estimatedHeight = image ? image.height * outputScale : 0
  const resultOutputScale = result && image ? Math.max(result.width / image.width, result.height / image.height) : 1

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Jernih, beranda">
          <span className="brand-mark">
            <Icon name="sparkle" size={22} />
          </span>
          <span>jernih</span>
        </a>
        <div className="topbar-right">
          <span className="local-badge">
            <Icon name="shield" size={16} />
            <span>Diproses di perangkat</span>
          </span>
          <span className="topbar-divider" />
          {authUser ? (
            <div className="auth-controls">
              <span className="auth-user" title={authUser.email || authUser.displayName}>
                Firebase · {authUser.displayName || authUser.email}
              </span>
              <button className="auth-button" type="button" onClick={handleFirebaseSignOut} disabled={authLoading}>
                Keluar
              </button>
            </div>
          ) : (
            <button
              className="auth-button"
              type="button"
              onClick={handleFirebaseSignIn}
              disabled={!isFirebaseConfigured || authLoading}
              title={!isFirebaseConfigured ? 'Konfigurasi Firebase belum tersedia.' : 'Login Firebase terpisah dari akun Puter.'}
            >
              {authLoading ? 'Memeriksa Firebase…' : 'Masuk Firebase'}
            </button>
          )}
        </div>
      </header>

      <main className="workspace">
        {authError && (
          <div className="inline-error auth-error" role="alert">
            <Icon name="info" size={18} />
            <span>{authError}</span>
          </div>
        )}
        <section className="intro">
          <div className="eyebrow"><span /> RUANG KERJA GAMBAR</div>
          <h1>Jernihkan, dengan caramu.</h1>
          <p>Perbesar dan siapkan gambar untuk detail yang lebih jelas.</p>
        </section>

        <section
          className={`upload-zone ${isDragging ? 'is-dragging' : ''} ${image ? 'has-image' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDragging(false)}
          aria-label="Area unggah gambar"
        >
          <input
            ref={inputRef}
            className="file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) loadImage(file)
            }}
          />
          <div className="upload-icon"><Icon name={image ? 'image' : 'upload'} size={23} /></div>
          <div className="upload-copy">
            <strong>{image ? 'Ganti gambar' : 'Lepas gambar di sini'}</strong>
            <span>{image ? 'Pilih file lain atau tempel gambar baru' : 'atau pilih dari perangkatmu'}</span>
          </div>
          <button
            className="button button-outline"
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isReading}
          >
            {isReading ? 'Membaca gambar…' : 'Pilih gambar'}
          </button>
          <div className="upload-meta">
            JPG, PNG, WebP <span>·</span> Maks. 20 MB <span>·</span> Bisa juga tempel dari clipboard
          </div>
        </section>

        {error && (
          <div className="inline-error" role="alert">
            <Icon name="info" size={18} />
            <span>{error}</span>
          </div>
        )}

        {image ? (
          <section className="editor-grid" aria-label="Pengaturan gambar">
            <div className="preview-card">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">GAMBAR ASLI</span>
                  <h2>Pratinjau</h2>
                </div>
                <div className="preview-actions">
                  <button className="icon-button rotate-button" type="button" onClick={() => rotateImage(-1)} disabled={isRotating || isProcessing} aria-label="Putar gambar ke kiri" title="Putar ke kiri">
                    ↶
                  </button>
                  <button className="icon-button rotate-button" type="button" onClick={() => rotateImage(1)} disabled={isRotating || isProcessing} aria-label="Putar gambar ke kanan" title="Putar ke kanan">
                    ↻
                  </button>
                  <button className="icon-button" type="button" onClick={clearImage} aria-label="Hapus gambar">
                    <Icon name="close" size={18} />
                  </button>
                </div>
              </div>
              <div className="image-preview">
                {result ? (
                  <div
                    className={`comparison-view ${isPanMode ? 'is-pan-mode' : ''}`}
                    style={{ aspectRatio: `${image.width} / ${image.height}` }}
                    onPointerDown={handleComparePointerDown}
                    onPointerMove={handleComparePointerMove}
                    onPointerUp={stopComparePan}
                    onPointerCancel={stopComparePan}
                    onWheel={(event) => {
                      if (event.ctrlKey || event.metaKey) {
                        event.preventDefault()
                        changeCompareZoom(compareZoom + (event.deltaY < 0 ? 0.25 : -0.25))
                      }
                    }}
                  >
                    <img
                      className="comparison-result"
                      src={result.url}
                      alt="Gambar hasil pemrosesan"
                      draggable="false"
                      style={{ transform: `translate(${comparePan.x}px, ${comparePan.y}px) scale(${compareZoom})` }}
                    />
                    <div className="comparison-original-clip" style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}>
                      <img
                        className="comparison-original"
                        src={image.url}
                        alt={`Gambar asli ${image.file.name}`}
                        draggable="false"
                        style={{ transform: `translate(${comparePan.x}px, ${comparePan.y}px) scale(${compareZoom})` }}
                      />
                    </div>
                    <span className="comparison-label original-label">ASLI</span>
                    <span className="comparison-label result-label">HASIL</span>
                    <span className="comparison-divider" style={{ left: `${comparePosition}%` }}>
                      <span>↔</span>
                    </span>
                    <input
                      aria-label="Geser pembanding sebelum dan sesudah"
                      className="comparison-range"
                      type="range"
                      min="0"
                      max="100"
                      value={comparePosition}
                      onChange={(event) => setComparePosition(Number(event.target.value))}
                      disabled={isPanMode}
                    />
                  </div>
                ) : (
                  <img src={image.url} alt={`Pratinjau gambar ${image.file.name}`} />
                )}
              </div>
              {result && (
                <div className="compare-tools" aria-label="Kontrol tampilan pembanding">
                  <button
                    className="compare-tool-button"
                    type="button"
                    aria-label="Perkecil pembanding"
                    onClick={() => changeCompareZoom(compareZoom - 0.25)}
                    disabled={compareZoom <= 1}
                  >
                    −
                  </button>
                  <span className="compare-zoom-value" aria-live="polite">{Math.round(compareZoom * 100)}%</span>
                  <button
                    className="compare-tool-button"
                    type="button"
                    aria-label="Perbesar pembanding"
                    onClick={() => changeCompareZoom(compareZoom + 0.25)}
                    disabled={compareZoom >= 4}
                  >
                    +
                  </button>
                  <button className="compare-tool-button compare-reset" type="button" onClick={resetCompareView} title="Reset zoom, geser, dan posisi pembanding">
                    Reset tampilan
                  </button>
                  <button
                    className={`compare-tool-button compare-pan-toggle ${isPanMode ? 'active' : ''}`}
                    type="button"
                    aria-pressed={isPanMode}
                    onClick={() => {
                      setIsPanMode((active) => !active)
                      panPointerRef.current = null
                    }}
                    disabled={compareZoom <= 1}
                  >
                    {isPanMode ? 'Selesai geser' : 'Geser gambar'}
                  </button>
                  <span className="compare-help">
                    {isPanMode ? 'Seret gambar untuk menggeser · slider sementara nonaktif' : 'Ctrl/⌘ + gulir untuk zoom'}
                  </span>
                </div>
              )}
              <div className="image-details">
                <div className="file-name" title={image.file.name}>
                  <Icon name="image" size={17} />
                  <span>{image.file.name}</span>
                </div>
                <span>{image.width.toLocaleString('id-ID')} × {image.height.toLocaleString('id-ID')} px</span>
                <span>{formatBytes(image.file.size)}</span>
              </div>
              <div className="output-estimate">
                <span>{result ? `Hasil ${resultOutputScale}× · ${result.engine}` : 'Perkiraan ukuran hasil'}</span>
                <strong>
                  {image.width.toLocaleString('id-ID')} × {image.height.toLocaleString('id-ID')}
                  <Icon name="chevron" size={16} />
                  {(result?.width || estimatedWidth).toLocaleString('id-ID')} × {(result?.height || estimatedHeight).toLocaleString('id-ID')} px
                </strong>
              </div>
              {result && (
                <div className="download-settings">
                  <label>
                    Format unduhan
                    <select value={downloadFormat} onChange={(event) => setDownloadFormat(event.target.value)}>
                      <option value="image/png">PNG · lossless</option>
                      <option value="image/jpeg">JPG</option>
                      <option value="image/webp">WebP</option>
                    </select>
                  </label>
                  {downloadFormat !== 'image/png' && (
                    <label className="quality-control">
                      Kualitas {Math.round(downloadQuality * 100)}%
                      <input
                        type="range"
                        min="60"
                        max="100"
                        value={Math.round(downloadQuality * 100)}
                        onChange={(event) => setDownloadQuality(Number(event.target.value) / 100)}
                      />
                    </label>
                  )}
                  <button className="button button-outline download-button" type="button" onClick={downloadResult} disabled={exporting}>
                    {exporting ? 'Menyiapkan unduhan…' : `Unduh ${downloadFormat === 'image/jpeg' ? 'JPG' : downloadFormat.split('/')[1].toUpperCase()}`}
                  </button>
                </div>
              )}
              {recognizedText && (
                <section className="ocr-result" aria-labelledby="ocr-result-title">
                  <div className="ocr-result-heading">
                    <div>
                      <span className="panel-kicker">HASIL OCR</span>
                      <h3 id="ocr-result-title">Teks yang terbaca</h3>
                    </div>
                    <button className="button button-outline" type="button" onClick={copyRecognizedText}>Salin teks</button>
                  </div>
                  <textarea aria-label="Teks hasil OCR" readOnly value={recognizedText} />
                  {copyError && <p className="ai-error" role="alert">{copyError}</p>}
                  <small>Periksa nama, angka, tanggal, dan tanda tangan dengan dokumen asli. OCR dapat keliru.</small>
                </section>
              )}
            </div>

            <aside className="settings-card">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">SESUAIKAN HASIL</span>
                  <h2>Pengaturan</h2>
                </div>
              </div>
              <fieldset className="setting-group" disabled={isProcessing || isRotating}>
                <legend>Preset gambar</legend>
                <div className="preset-list">
                  {PRESETS.map((item) => (
                    <button
                      className={`preset-option ${preset === item.id ? 'selected' : ''}`}
                      key={item.id}
                      type="button"
                      aria-pressed={preset === item.id}
                      onClick={() => setPreset(item.id)}
                    >
                      <span className={`preset-dot ${item.id}`} />
                      <span className="preset-text"><strong>{item.label}</strong><small>{item.description}</small></span>
                      <span className="radio-mark" />
                    </button>
                  ))}
                </div>
                <small className="setting-hint">Preset memberi panduan penggunaan; model yang dipakai tetap model umum yang sama.</small>
              </fieldset>

              {preset === 'document' && (
                <div className="document-warning" role="note">
                  <Icon name="info" size={18} />
                  <p>Teks kecil, nomor, dan tanda tangan bisa berubah. Selalu periksa dengan dokumen asli.</p>
                </div>
              )}

              <section className="ai-advisor" aria-labelledby="ai-advisor-title">
                <div className="ai-advisor-heading">
                  <span className="panel-kicker">SARAN TAMBAHAN</span>
                  <h3 id="ai-advisor-title">Analisis AI</h3>
                </div>
                {!puterReady ? (
                  <>
                    <p className="ai-advisor-note">{puterError || 'Menyiapkan layanan Puter…'} Fitur lokal tetap bisa dipakai.</p>
                    {puterError && (
                      <button className="button button-outline ai-action" type="button" onClick={() => {
                        setPuterError('')
                        initializePuter().then(({ user }) => {
                          setPuterUser(user)
                          setPuterReady(true)
                        }).catch((loadError) => setPuterError(loadError.message || 'SDK Puter tidak dapat dimuat.'))
                      }}>
                        Coba muat ulang Puter
                      </button>
                    )}
                  </>
                ) : !puterUser ? (
                  <>
                    <p className="ai-advisor-note">Masuk secara terpisah dengan akun Puter untuk memakai saran AI dan OCR. Login Firebase/Google tidak masuk otomatis ke Puter.</p>
                    {puterError && <p className="ai-error" role="alert">{puterError}</p>}
                    <button className="button button-outline ai-action" type="button" onClick={handlePuterSignIn}>
                      Masuk dengan Puter
                    </button>
                  </>
                ) : (
                  <>
                    <div className="puter-account">
                      <span>{puterUser.username || puterUser.email || 'Akun Puter aktif'}</span>
                      <button className="text-button" type="button" onClick={handlePuterSignOut}>Keluar Puter</button>
                    </div>
                    <p className="ai-advisor-note">
                      Dapatkan perkiraan jenis gambar, tingkat blur, dan saran pengaturan. Gambar hanya dikirim setelah persetujuanmu.
                    </p>
                    <button
                      className="button button-outline ai-action"
                      type="button"
                      onClick={() => {
                        setConsentAction('advice')
                        setIsConsentOpen(true)
                      }}
                      disabled={isAnalyzing || isRecognizingText || isProcessing || isRotating}
                    >
                      {isAnalyzing ? 'Menganalisis gambar…' : 'Minta saran AI'}
                    </button>
                    {analysisError && <p className="ai-error" role="alert">{analysisError}</p>}
                    {result && (
                      <button
                        className="button button-outline ai-action"
                        type="button"
                        onClick={() => {
                          setConsentAction('ocr')
                          setIsConsentOpen(true)
                        }}
                        disabled={isAnalyzing || isRecognizingText || isProcessing}
                      >
                        {isRecognizingText ? 'Membaca teks…' : 'Baca teks hasil (OCR)'}
                      </button>
                    )}
                    {ocrError && <p className="ai-error" role="alert">{ocrError}</p>}
                    {recommendation && (
                      <div className="ai-recommendation" role="status">
                        <strong>
                          Saran: {PRESETS.find((item) => item.id === recommendation.preset)?.label} · {recommendation.scale}×
                        </strong>
                        <span>Tingkat blur: {recommendation.blur === 'low' ? 'rendah' : recommendation.blur === 'medium' ? 'sedang' : 'tinggi'}</span>
                        <p>{recommendation.explanation}</p>
                        <small>Perkiraan AI, bukan pengukuran pasti. Teks dan detail mungkin ditebak keliru.</small>
                        <button className="button button-outline ai-action" type="button" onClick={applyRecommendation}>
                          Terapkan saran
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>

              <fieldset className="setting-group" disabled={isProcessing || isRotating}>
                <legend>Mode pemrosesan</legend>
                <div className="mode-switch">
                  <button
                    className={quality === 'fast' ? 'active' : ''}
                    type="button"
                    aria-pressed={quality === 'fast'}
                    onClick={() => setQuality('fast')}
                  >
                    <strong>Cepat</strong><small>2× · lebih ringan</small>
                  </button>
                  <button
                    className={quality === 'quality' ? 'active' : ''}
                    type="button"
                    aria-pressed={quality === 'quality'}
                    onClick={() => setQuality('quality')}
                  >
                    <strong>Kualitas</strong><small>Detail lebih tinggi</small>
                  </button>
                </div>
              </fieldset>

              <fieldset className="setting-group scale-group" disabled={quality === 'fast' || isProcessing || isRotating}>
                <legend>Skala</legend>
                <div className="scale-options">
                  {[2, 4].map((value) => (
                    <button
                      className={Number(scale) === value ? 'active' : ''}
                      key={value}
                      type="button"
                      aria-pressed={Number(scale) === value}
                      onClick={() => setScale(value)}
                    >
                      {value}×
                    </button>
                  ))}
                </div>
                {quality === 'fast' && <small className="setting-hint">Mode Cepat memakai skala 2×.</small>}
              </fieldset>

              <div className="engine-pending">
                <span className={`pending-indicator ${result ? 'complete' : ''}`} />
                {result ? `Mesin: ${result.engine}` : 'Pemrosesan berjalan sepenuhnya di perangkat'}
              </div>
              {isProcessing && progress && (
                <div className="progress-panel" aria-live="polite">
                  <div className="progress-heading">
                    <span>
                      {progress.message}
                      {progress.remainingSeconds
                        ? ` · kira-kira ${formatDuration(progress.remainingSeconds)} tersisa`
                        : ''}
                    </span>
                    <strong>{progress.progress}%</strong>
                  </div>
                  <progress max="100" value={progress.progress}>{progress.progress}%</progress>
                </div>
              )}
              {isProcessing ? (
                <button className="button button-cancel process-button" type="button" onClick={cancelProcessing} disabled={isCancelling}>
                  <Icon name="close" size={18} />
                  {isCancelling ? 'Membatalkan…' : 'Batalkan proses'}
                </button>
              ) : (
                <button className="button button-primary process-button" type="button" onClick={processImage} disabled={isRotating}>
                  <Icon name="sparkle" size={19} />
                  {isRotating ? 'Memutar gambar…' : result ? 'Proses ulang' : 'Perjelas gambar'}
                </button>
              )}
              {result && (
                <p className="success-note">
                  Selesai · {formatBytes(result.blob.size)} · Hasil AI dapat menebak detail yang berbeda dari aslinya.
                </p>
              )}
              {result?.warnings?.length > 0 && (
                <div className="fallback-note" role="status">
                  {result.warnings.join(' ')}
                </div>
              )}
              {!result && !isProcessing && (
                <p className="unavailable-note">
                  Model berjalan lokal di browser. Proses gambar besar bisa memerlukan waktu lebih lama.
                </p>
              )}
            </aside>
          </section>
        ) : (
          <section className="empty-guidance" aria-label="Tentang Jernih">
            <div className="guidance-icon"><Icon name="shield" size={20} /></div>
            <div>
              <strong>Privat sejak awal</strong>
              <p>Gambarmu tidak diunggah. Pilih JPG, PNG, atau WebP hingga 20 MB untuk mulai.</p>
            </div>
          </section>
        )}

        <footer className="page-footer">
          <span>Jernih <span className="footer-dot">·</span> Memperjelas gambar, dengan hati-hati.</span>
          <span>AI dapat menebak detail yang tidak ada pada gambar asli.</span>
        </footer>
      </main>

      {toast && <div className="toast" role="status"><span className="toast-check">✓</span>{toast}</div>}
      <div className="sr-only" aria-live="polite">{selectedPreset?.label} dipilih.</div>
      {isConsentOpen && (
        <div className="consent-backdrop">
          <section className="consent-dialog" role="dialog" aria-modal="true" aria-labelledby="consent-title">
            <span className="panel-kicker">PERSETUJUAN PRIVASI</span>
            <h2 id="consent-title">
              {consentAction === 'ocr' ? 'Kirim hasil gambar untuk OCR?' : 'Kirim gambar untuk analisis AI?'}
            </h2>
            {consentAction === 'ocr' ? (
              <p>
                Hasil gambar yang sudah diproses akan dikirim ke Puter OCR untuk mengekstrak teks.
                Pembesaran dapat mengandung detail tebakan; periksa teks dengan sumber asli.
                Penggunaan layanan dapat tunduk pada kuota atau biaya akun Puter.
              </p>
            ) : (
              <p>
                Gambar asli akan dikirim ke Puter AI untuk disarankan preset dan skala.
                Login Firebase tidak menautkan akun ke Puter. Penggunaan layanan dapat tunduk pada kuota atau biaya akun Puter.
              </p>
            )}
            <p>Jika tidak menyetujui, tutup dialog ini. Pemrosesan gambar lokal tetap tersedia dan tidak mengirim gambar.</p>
            <div className="consent-actions">
              <button className="button button-outline" type="button" onClick={() => setIsConsentOpen(false)}>
                Jangan kirim
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={consentAction === 'ocr' ? runOcr : requestAiAnalysis}
              >
                {consentAction === 'ocr' ? 'Setuju & baca teks' : 'Setuju & analisis'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
