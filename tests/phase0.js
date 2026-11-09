import * as ortWasm from 'onnxruntime-web'
import * as ortWebgpu from 'onnxruntime-web/webgpu'
import * as tf from '@tensorflow/tfjs'
import Upscaler from 'upscaler'
import defaultModel from '@upscalerjs/default-model'

const MODEL_URL = '/models/realesr-general-x4v3.onnx'
const TF_MODEL_URL = '/models/upscalerjs-default/model.json'
const status = document.querySelector('#status')
const results = document.querySelector('#results')
const runButton = document.querySelector('#run')

function log(message) {
  status.textContent += `\n${message}`
}

function makeFixture(kind) {
  const width = 384
  const height = 288
  const source = document.createElement('canvas')
  source.width = width
  source.height = height
  const context = source.getContext('2d')

  if (kind === 'photo') {
    const sky = context.createLinearGradient(0, 0, 0, height)
    sky.addColorStop(0, '#7db7d8')
    sky.addColorStop(0.58, '#e8d1a2')
    sky.addColorStop(1, '#48634e')
    context.fillStyle = sky
    context.fillRect(0, 0, width, height)
    context.fillStyle = '#f2d594'
    context.beginPath()
    context.arc(290, 76, 31, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#45534b'
    context.beginPath()
    context.moveTo(0, 226)
    context.lineTo(95, 119)
    context.lineTo(174, 218)
    context.lineTo(248, 142)
    context.lineTo(384, 257)
    context.lineTo(384, 288)
    context.lineTo(0, 288)
    context.fill()
    for (let x = 20; x < width; x += 35) {
      context.fillStyle = x % 2 ? '#6d825a' : '#899268'
      context.beginPath()
      context.arc(x, 232 + ((x * 7) % 40), 8 + (x % 9), 0, Math.PI * 2)
      context.fill()
    }
  } else if (kind === 'illustration') {
    context.fillStyle = '#fbf2df'
    context.fillRect(0, 0, width, height)
    context.lineWidth = 9
    context.strokeStyle = '#28334a'
    context.fillStyle = '#ed7657'
    context.beginPath()
    context.arc(115, 116, 63, 0, Math.PI * 2)
    context.fill()
    context.stroke()
    context.fillStyle = '#74a98e'
    context.fillRect(209, 62, 112, 137)
    context.strokeRect(209, 62, 112, 137)
    context.beginPath()
    context.moveTo(225, 175)
    context.lineTo(265, 95)
    context.lineTo(305, 175)
    context.closePath()
    context.fillStyle = '#f3c75b'
    context.fill()
    context.stroke()
  } else {
    context.fillStyle = '#fff'
    context.fillRect(0, 0, width, height)
    context.fillStyle = '#20242a'
    context.font = 'bold 26px sans-serif'
    context.fillText('FORM UJI 2048', 24, 53)
    context.font = '17px sans-serif'
    context.fillText('Nama: Siti Contoh', 24, 103)
    context.fillText('Nomor: 1234567890', 24, 143)
    context.fillText('Nilai: 98,75', 24, 183)
    context.lineWidth = 2
    context.strokeStyle = '#69717a'
    context.strokeRect(18, 19, 348, 223)
    for (const y of [116, 156, 196, 216]) {
      context.beginPath()
      context.moveTo(20, y)
      context.lineTo(364, y)
      context.stroke()
    }
  }

  const lowRes = document.createElement('canvas')
  lowRes.width = 96
  lowRes.height = 72
  const lowContext = lowRes.getContext('2d')
  lowContext.filter = 'blur(0.8px)'
  lowContext.drawImage(source, 0, 0, lowRes.width, lowRes.height)

  const compressed = document.createElement('canvas')
  compressed.width = lowRes.width
  compressed.height = lowRes.height
  const compressedContext = compressed.getContext('2d')
  const image = new Image()
  image.src = lowRes.toDataURL('image/jpeg', 0.32)

  return new Promise((resolve, reject) => {
    image.onload = () => {
      compressedContext.drawImage(image, 0, 0)
      resolve({ kind, canvas: compressed, dataUrl: compressed.toDataURL('image/png') })
    }
    image.onerror = reject
  })
}

function toNchw(canvas) {
  const { width, height } = canvas
  const rgba = canvas.getContext('2d').getImageData(0, 0, width, height).data
  const planar = new Float32Array(3 * width * height)
  const planeSize = width * height

  for (let i = 0; i < planeSize; i += 1) {
    planar[i] = rgba[i * 4] / 255
    planar[planeSize + i] = rgba[i * 4 + 1] / 255
    planar[planeSize * 2 + i] = rgba[i * 4 + 2] / 255
  }

  return new ortWasm.Tensor('float32', planar, [1, 3, height, width])
}

function renderOnnxOutput(data, dims) {
  const [, , height, width] = dims
  const planeSize = height * width
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  const image = context.createImageData(width, height)

  for (let i = 0; i < planeSize; i += 1) {
    image.data[i * 4] = Math.round(Math.max(0, Math.min(1, data[i])) * 255)
    image.data[i * 4 + 1] = Math.round(Math.max(0, Math.min(1, data[planeSize + i])) * 255)
    image.data[i * 4 + 2] = Math.round(Math.max(0, Math.min(1, data[planeSize * 2 + i])) * 255)
    image.data[i * 4 + 3] = 255
  }

  context.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

function addResult(label, fixture, imageUrl, elapsedMs, dimensions) {
  const card = document.createElement('article')
  card.innerHTML = `
    <h2>${fixture.kind} — ${label}</h2>
    <p>${dimensions}; ${elapsedMs.toFixed(0)} ms</p>
    <div class="images">
      <img class="source" src="${fixture.dataUrl}" alt="${fixture.kind} synthetic input" />
      <img src="${imageUrl}" alt="${fixture.kind} upscaled output" />
    </div>
  `
  results.append(card)
}

async function benchmarkOnnx(backend, ort, fixtures) {
  const loadStart = performance.now()
  const session = await ort.InferenceSession.create(MODEL_URL, {
    executionProviders: [backend],
  })
  const loadMs = performance.now() - loadStart
  log(`${backend}: model session ready in ${loadMs.toFixed(0)} ms; input=${session.inputNames[0]}, output=${session.outputNames[0]}`)

  for (const fixture of fixtures) {
    const input = toNchw(fixture.canvas)
    const start = performance.now()
    const output = await session.run({ [session.inputNames[0]]: input })
    const elapsedMs = performance.now() - start
    const tensor = output[session.outputNames[0]]
    const imageUrl = renderOnnxOutput(tensor.data, tensor.dims)
    addResult(`Real-ESRGAN ONNX / ${backend}`, fixture, imageUrl, elapsedMs, `${tensor.dims[3]}×${tensor.dims[2]}`)
    input.dispose()
    tensor.dispose()
  }

  await session.release()
}

async function benchmarkUpscaler(fixtures) {
  await tf.ready()
  const upscaler = new Upscaler({
    model: { ...defaultModel, path: TF_MODEL_URL },
    patchSize: 64,
  })
  const loadStart = performance.now()
  await upscaler.ready
  const loadMs = performance.now() - loadStart
  log(`UpscalerJS: backend=${tf.getBackend()}, model ready in ${loadMs.toFixed(0)} ms`)

  for (const fixture of fixtures) {
    const start = performance.now()
    const imageUrl = await upscaler.upscale(fixture.dataUrl)
    const elapsedMs = performance.now() - start
    addResult('UpscalerJS default ESRGAN / 2×', fixture, imageUrl, elapsedMs, '192×144')
  }

  await upscaler.dispose()
}

async function runBenchmark() {
  runButton.disabled = true
  status.textContent = 'Creating synthetic fixtures...'
  results.replaceChildren()

  try {
    const fixtures = await Promise.all(['photo', 'illustration', 'document'].map(makeFixture))
    for (const fixture of fixtures) {
      addResult('Synthetic input', fixture, fixture.dataUrl, 0, '96×72')
    }

    log(`WebGPU supported: ${Boolean(navigator.gpu)}`)
    if (performance.memory) {
      log(`JS heap before inference: ${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)} MiB`)
    } else {
      log('JS heap metric unavailable in this browser')
    }

    try {
      await benchmarkOnnx('wasm', ortWasm, fixtures)
    } catch (error) {
      log(`WASM failed: ${error.message}`)
    }

    if (navigator.gpu) {
      try {
        await benchmarkOnnx('webgpu', ortWebgpu, fixtures)
      } catch (error) {
        log(`WebGPU failed: ${error.message}`)
      }
    }

    try {
      await benchmarkUpscaler(fixtures)
    } catch (error) {
      log(`UpscalerJS failed: ${error.stack || error.message}`)
    }

    if (performance.memory) {
      log(`JS heap after inference: ${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)} MiB`)
    }
    log('Benchmark finished. Compare visual output and inspect console for errors.')
  } finally {
    runButton.disabled = false
  }
}

runButton.addEventListener('click', runBenchmark)
