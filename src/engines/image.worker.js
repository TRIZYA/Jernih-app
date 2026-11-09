import * as ort from 'onnxruntime-web'
import * as tf from '@tensorflow/tfjs'
import Upscaler from 'upscaler'
import defaultModel from '@upscalerjs/default-model'
import { MAX_OUTPUT_PIXELS } from './limits.js'

const MODEL_URL = '/models/realesr-general-x4v3.onnx'
const FAST_MODEL_URL = '/models/upscalerjs-default/model.json'
const MODEL_SCALE = 4
const TILE_SIZE = 128
const TILE_PADDING = 12
let activeJob

ort.env.wasm.numThreads = 1

function report(progress, stage, message, completed = 0, total = 0) {
  if (stage === 'fallback' && activeJob) activeJob.warnings.push(message)
  self.postMessage({
    type: 'progress',
    progress,
    stage,
    message,
    completed,
    total,
  })
}

function ensureActive(job) {
  if (job.cancelled) throw new DOMException('Proses dibatalkan.', 'AbortError')
}

function getTileStarts(length, size) {
  const starts = []
  for (let start = 0; start < length; start += size) starts.push(start)
  return starts
}

function toTensor(canvas, x, y, width, height) {
  const pixels = canvas.getContext('2d').getImageData(x, y, width, height).data
  const area = width * height
  const data = new Float32Array(area * 3)
  for (let index = 0; index < area; index += 1) {
    data[index] = pixels[index * 4] / 255
    data[area + index] = pixels[index * 4 + 1] / 255
    data[area * 2 + index] = pixels[index * 4 + 2] / 255
  }
  return new ort.Tensor('float32', data, [1, 3, height, width])
}

function drawNchwTile(tileCanvas, outputData, dimensions) {
  const [, , height, width] = dimensions
  const area = width * height
  const image = new ImageData(width, height)
  for (let index = 0; index < area; index += 1) {
    image.data[index * 4] = Math.round(Math.max(0, Math.min(1, outputData[index])) * 255)
    image.data[index * 4 + 1] = Math.round(Math.max(0, Math.min(1, outputData[area + index])) * 255)
    image.data[index * 4 + 2] = Math.round(Math.max(0, Math.min(1, outputData[area * 2 + index])) * 255)
    image.data[index * 4 + 3] = 255
  }
  tileCanvas.getContext('2d').putImageData(image, 0, 0)
}

function createOutputCanvas(width, height, sourceScale, requestedScale) {
  const outputWidth = width * requestedScale
  const outputHeight = height * requestedScale
  validateOutputSize(outputWidth, outputHeight)
  const canvas = new OffscreenCanvas(outputWidth, outputHeight)
  const context = canvas.getContext('2d', { alpha: false })
  context.imageSmoothingEnabled = requestedScale !== sourceScale
  context.imageSmoothingQuality = 'high'
  return { canvas, context, outputWidth, outputHeight }
}

function validateOutputSize(outputWidth, outputHeight) {
  if (outputWidth * outputHeight > MAX_OUTPUT_PIXELS) {
    throw new Error(
      `Ukuran hasil ${outputWidth.toLocaleString('id-ID')} × ${outputHeight.toLocaleString('id-ID')} px terlalu besar. Pilih skala lebih kecil atau gambar beresolusi lebih rendah.`,
    )
  }
}

function drawOnWhite(canvas, bitmap) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0)
  return context
}

async function createOnnxSession(provider) {
  return ort.InferenceSession.create(MODEL_URL, {
    executionProviders: [provider],
    graphOptimizationLevel: 'all',
  })
}

async function upscaleOnnx(bitmap, requestedScale, job, provider) {
  const source = new OffscreenCanvas(bitmap.width, bitmap.height)
  drawOnWhite(source, bitmap)
  const { canvas, context, outputWidth, outputHeight } = createOutputCanvas(
    bitmap.width,
    bitmap.height,
    MODEL_SCALE,
    requestedScale,
  )
  const xs = getTileStarts(bitmap.width, TILE_SIZE)
  const ys = getTileStarts(bitmap.height, TILE_SIZE)
  const total = xs.length * ys.length
  const session = await createOnnxSession(provider)
  const inputName = session.inputNames[0]
  const outputName = session.outputNames[0]
  let completed = 0

  try {
    for (const coreY of ys) {
      for (const coreX of xs) {
        ensureActive(job)
        const coreWidth = Math.min(TILE_SIZE, bitmap.width - coreX)
        const coreHeight = Math.min(TILE_SIZE, bitmap.height - coreY)
        const tileX = Math.max(0, coreX - TILE_PADDING)
        const tileY = Math.max(0, coreY - TILE_PADDING)
        const tileRight = Math.min(bitmap.width, coreX + coreWidth + TILE_PADDING)
        const tileBottom = Math.min(bitmap.height, coreY + coreHeight + TILE_PADDING)
        const tileWidth = tileRight - tileX
        const tileHeight = tileBottom - tileY
        const input = toTensor(source, tileX, tileY, tileWidth, tileHeight)
        let output

        try {
          output = await session.run({ [inputName]: input })
          ensureActive(job)
          const outputTensor = output[outputName]
          try {
            const tileOutput = new OffscreenCanvas(outputTensor.dims[3], outputTensor.dims[2])
            drawNchwTile(tileOutput, outputTensor.data, outputTensor.dims)
            const cropX = (coreX - tileX) * MODEL_SCALE
            const cropY = (coreY - tileY) * MODEL_SCALE
            context.drawImage(
              tileOutput,
              cropX,
              cropY,
              coreWidth * MODEL_SCALE,
              coreHeight * MODEL_SCALE,
              coreX * requestedScale,
              coreY * requestedScale,
              coreWidth * requestedScale,
              coreHeight * requestedScale,
            )
          } finally {
            for (const tensor of Object.values(output)) tensor.dispose()
          }
        } finally {
          input.dispose()
        }

        completed += 1
        report(
          Math.round((completed / total) * 90),
          'inference',
          `${provider === 'webgpu' ? 'WebGPU' : 'WASM'} · tile ${completed}/${total}`,
          completed,
          total,
        )
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }
  } finally {
    await session.release()
  }

  ensureActive(job)
  return { canvas, outputWidth, outputHeight, engine: `Real-ESRGAN · ${provider.toUpperCase()}` }
}

async function upscaleFast(bitmap, requestedScale, job) {
  report(2, 'loading', 'Menyiapkan mesin Cepat di perangkat…')
  let backend = 'webgl'
  try {
    const initialized = await tf.setBackend(backend)
    if (!initialized) throw new Error('Backend WebGL tidak dapat diinisialisasi di worker.')
    await tf.ready()
  } catch (error) {
    report(3, 'fallback', `UpscalerJS WebGL tidak tersedia di worker: ${error.message}. Mencoba CPU…`)
    backend = 'cpu'
    await tf.setBackend(backend)
    await tf.ready()
  }
  ensureActive(job)
  const upscaler = new Upscaler({
    model: { ...defaultModel, path: FAST_MODEL_URL },
  })
  const source = new OffscreenCanvas(bitmap.width, bitmap.height)
  const sourceContext = drawOnWhite(source, bitmap)
  const rgba = sourceContext.getImageData(
    0,
    0,
    bitmap.width,
    bitmap.height,
  ).data
  const rgb = new Int32Array(bitmap.width * bitmap.height * 3)
  for (let sourceIndex = 0, targetIndex = 0; sourceIndex < rgba.length; sourceIndex += 4) {
    rgb[targetIndex] = rgba[sourceIndex]
    rgb[targetIndex + 1] = rgba[sourceIndex + 1]
    rgb[targetIndex + 2] = rgba[sourceIndex + 2]
    targetIndex += 3
  }
  const inputTensor = tf.tensor3d(rgb, [bitmap.height, bitmap.width, 3], 'int32')
  let outputTensor
  let outputData
  let outputShape

  try {
    await upscaler.ready
    ensureActive(job)
    outputTensor = await upscaler.upscale(inputTensor, {
      output: 'tensor',
      patchSize: 64,
      padding: 8,
      progress: (fraction) => {
        ensureActive(job)
        const percent = Math.max(10, Math.min(90, 10 + Math.round(fraction * 80)))
        report(percent, 'inference', `UpscalerJS · ${Math.round(fraction * 100)}%`)
      },
    })
    ensureActive(job)
    outputShape = outputTensor.shape
    outputData = await outputTensor.data()
    ensureActive(job)
  } finally {
    if (job.cancelled) upscaler.abort()
    inputTensor.dispose()
    outputTensor?.dispose()
    await upscaler.dispose()
  }

  const [height, width] = outputShape
  const tile = new OffscreenCanvas(width, height)
  const image = new ImageData(width, height)
  for (let index = 0; index < width * height; index += 1) {
    image.data[index * 4] = outputData[index * 3]
    image.data[index * 4 + 1] = outputData[index * 3 + 1]
    image.data[index * 4 + 2] = outputData[index * 3 + 2]
    image.data[index * 4 + 3] = 255
  }
  tile.getContext('2d').putImageData(image, 0, 0)
  const { canvas, context, outputWidth, outputHeight } = createOutputCanvas(
    bitmap.width,
    bitmap.height,
    2,
    requestedScale,
  )
  context.drawImage(tile, 0, 0, outputWidth, outputHeight)
  report(90, 'inference', 'UpscalerJS selesai memproses gambar.', 1, 1)
  return { canvas, outputWidth, outputHeight, engine: `UpscalerJS · ${backend.toUpperCase()}` }
}

async function upscaleClassic(bitmap, requestedScale, job) {
  ensureActive(job)
  const { canvas, context, outputWidth, outputHeight } = createOutputCanvas(
    bitmap.width,
    bitmap.height,
    1,
    requestedScale,
  )
  const working = new OffscreenCanvas(outputWidth, outputHeight)
  const workingContext = working.getContext('2d', { willReadFrequently: true })
  workingContext.fillStyle = '#fff'
  workingContext.fillRect(0, 0, outputWidth, outputHeight)
  workingContext.imageSmoothingEnabled = true
  workingContext.imageSmoothingQuality = 'high'
  workingContext.drawImage(bitmap, 0, 0, outputWidth, outputHeight)
  const image = workingContext.getImageData(0, 0, outputWidth, outputHeight)
  const original = image.data
  const sharpened = new Uint8ClampedArray(original)
  for (let y = 1; y < outputHeight - 1; y += 1) {
    ensureActive(job)
    for (let x = 1; x < outputWidth - 1; x += 1) {
      const offset = (y * outputWidth + x) * 4
      for (let channel = 0; channel < 3; channel += 1) {
        const value =
          original[offset + channel] * 1.4 -
          (original[offset - 4 + channel] +
            original[offset + 4 + channel] +
            original[offset - outputWidth * 4 + channel] +
            original[offset + outputWidth * 4 + channel]) *
            0.1
        sharpened[offset + channel] = Math.max(0, Math.min(255, value))
      }
    }
    if (y % 128 === 0) {
      report(
        10 + Math.round((y / outputHeight) * 78),
        'fallback',
        `Cadangan Lanczos + sharpen · baris ${y}/${outputHeight}`,
        y,
        outputHeight,
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  image.data.set(sharpened)
  workingContext.putImageData(image, 0, 0)
  context.drawImage(working, 0, 0)
  return { canvas, outputWidth, outputHeight, engine: 'Cadangan klasik · resampling + sharpen' }
}

async function enhanceDocumentCanvas(canvas, job) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const width = canvas.width
  const height = canvas.height
  const chunkHeight = 64

  for (let startY = 0; startY < height; startY += chunkHeight) {
    ensureActive(job)
    const endY = Math.min(height, startY + chunkHeight)
    const top = Math.max(0, startY - 1)
    const bottom = Math.min(height, endY + 1)
    const stripe = context.getImageData(0, top, width, bottom - top)
    const pixels = stripe.data
    const enhanced = new Uint8ClampedArray(pixels)

    for (let y = startY; y < endY; y += 1) {
      if (y === 0 || y === height - 1) continue
      const localY = y - top
      for (let x = 1; x < width - 1; x += 1) {
        const index = (localY * width + x) * 4
        const above = index - width * 4
        const below = index + width * 4
        for (let channel = 0; channel < 3; channel += 1) {
          const center = pixels[index + channel]
          const neighborAverage = (
            pixels[index - 4 + channel] +
            pixels[index + 4 + channel] +
            pixels[above + channel] +
            pixels[below + channel]
          ) / 4
          const sharpened = center + (center - neighborAverage) * 0.4
          enhanced[index + channel] = Math.max(
            0,
            Math.min(255, (sharpened - 127.5) * 1.05 + 127.5),
          )
        }
      }
    }

    stripe.data.set(enhanced)
    context.putImageData(stripe, 0, top)
    report(
      90 + Math.round((endY / height) * 4),
      'postprocess',
      `Menajamkan teks dokumen · ${endY}/${height} baris`,
      endY,
      height,
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

async function runJob(file, options, job) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const requestedScale = Number(options.scale)
    if (!Number.isInteger(requestedScale) || ![2, 4].includes(requestedScale)) {
      throw new Error('Skala gambar tidak valid.')
    }
    validateOutputSize(bitmap.width * requestedScale, bitmap.height * requestedScale)

    let result
    if (options.mode === 'fast') {
      try {
        result = await upscaleFast(bitmap, requestedScale, job)
      } catch (error) {
        ensureActive(job)
        report(4, 'fallback', `Mode Cepat tidak tersedia: ${error.message}. Beralih ke mesin kualitas…`)
      }
    }

    if (!result) {
      let provider = 'webgpu'
      try {
        report(1, 'loading', 'Memuat model Real-ESRGAN…')
        result = await upscaleOnnx(bitmap, requestedScale, job, provider)
      } catch (error) {
        ensureActive(job)
        console.warn('WebGPU gagal digunakan; beralih ke WASM.', error)
        report(1, 'fallback', 'WebGPU tidak tersedia. Beralih ke WASM…')
        provider = 'wasm'
        try {
          result = await upscaleOnnx(bitmap, requestedScale, job, provider)
        } catch (wasmError) {
          ensureActive(job)
          report(1, 'fallback', `Model ONNX gagal: ${wasmError.message}. Mencoba mode cadangan…`)
          try {
            if (options.mode === 'quality') {
              result = await upscaleFast(bitmap, requestedScale, job)
            }
          } catch (fastError) {
            ensureActive(job)
            report(5, 'fallback', `Mode Cepat tidak tersedia: ${fastError.message}. Menggunakan cadangan klasik…`)
          }
          if (!result) result = await upscaleClassic(bitmap, requestedScale, job)
        }
      }
    }

    ensureActive(job)
    if (options.preset === 'document') await enhanceDocumentCanvas(result.canvas, job)
    ensureActive(job)
    report(95, 'export', 'Menyiapkan pratinjau hasil…')
    const blob = await result.canvas.convertToBlob({ type: 'image/png' })
    ensureActive(job)
    self.postMessage({
      type: 'result',
      blob,
      width: result.outputWidth,
      height: result.outputHeight,
      engine: result.engine,
      warnings: job.warnings,
      sourceWidth: bitmap.width,
      sourceHeight: bitmap.height,
    })
  } finally {
    bitmap.close()
  }
}

self.onmessage = async ({ data }) => {
  if (data.type === 'cancel') {
    if (activeJob) activeJob.cancelled = true
    return
  }
  if (data.type !== 'process' || activeJob) return

  const job = { cancelled: false, warnings: [] }
  activeJob = job
  try {
    await runJob(data.file, data.options, job)
  } catch (error) {
    if (error.name === 'AbortError') {
      self.postMessage({ type: 'cancelled' })
    } else {
      self.postMessage({ type: 'error', message: error.message || 'Pemrosesan gambar gagal.' })
    }
  } finally {
    activeJob = undefined
  }
}
