export function createUpscaleJob(file, options, onProgress) {
  const worker = new Worker(new URL('./image.worker.js', import.meta.url), { type: 'module' })
  let settled = false
  let cancelling = false
  let rejectJob
  let cancelTimer

  const promise = new Promise((resolve, reject) => {
    rejectJob = reject
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') {
        onProgress(data)
        return
      }

      if (data.type === 'result') {
        settled = true
        window.clearTimeout(cancelTimer)
        worker.terminate()
        if (cancelling) reject(new DOMException('Proses dibatalkan.', 'AbortError'))
        else resolve(data)
      } else if (data.type === 'error') {
        settled = true
        window.clearTimeout(cancelTimer)
        worker.terminate()
        reject(new Error(data.message))
      } else if (data.type === 'cancelled') {
        settled = true
        window.clearTimeout(cancelTimer)
        worker.terminate()
        reject(new DOMException('Proses dibatalkan.', 'AbortError'))
      }
    }

    worker.onerror = (event) => {
      settled = true
      window.clearTimeout(cancelTimer)
      worker.terminate()
      reject(new Error(event.message || 'Worker pemrosesan gambar mengalami masalah.'))
    }

    worker.postMessage({ type: 'process', file, options })
  })

  return {
    promise,
    cancel() {
      if (settled || cancelling) return
      cancelling = true
      worker.postMessage({ type: 'cancel' })
      cancelTimer = window.setTimeout(() => {
        if (settled) return
        settled = true
        worker.terminate()
        rejectJob(new DOMException('Proses dibatalkan.', 'AbortError'))
      }, 5000)
    },
  }
}
