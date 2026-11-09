const PUTER_SCRIPT_URL = 'https://js.puter.com/v2/'
let puterScriptPromise

function loadPuter() {
  if (window.puter) return Promise.resolve(window.puter)
  if (puterScriptPromise) return puterScriptPromise

  puterScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = PUTER_SCRIPT_URL
    script.async = true
    script.onload = () => {
      if (window.puter?.ai?.chat) resolve(window.puter)
      else reject(new Error('SDK Puter.js berhasil dimuat, tetapi fitur AI tidak tersedia.'))
    }
    script.onerror = () => {
      puterScriptPromise = null
      reject(new Error('SDK Puter.js tidak dapat dimuat. Periksa koneksi internet lalu coba lagi.'))
    }
    document.head.append(script)
  })

  return puterScriptPromise
}

export async function initializePuter() {
  const puter = await loadPuter()
  const signedIn = Boolean(puter.auth?.isSignedIn?.())
  return {
    puter,
    user: signedIn ? await puter.auth.getUser() : null,
  }
}

export async function signInToPuter() {
  const puter = window.puter
  if (!puter?.auth?.signIn) throw new Error('SDK Puter belum siap. Coba muat ulang halaman.')
  await puter.auth.signIn()
  return initializePuter()
}

export async function signOutFromPuter() {
  const puter = await loadPuter()
  if (!puter.auth?.signOut) throw new Error('Fitur logout akun Puter tidak tersedia pada SDK ini.')
  await puter.auth.signOut()
}

function readResponseText(response) {
  const content = typeof response === 'string'
    ? response
    : response?.message?.content ?? response?.content ?? response?.text

  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n')
  }
  throw new Error('Respons AI tidak memiliki teks yang dapat dibaca.')
}

function parseRecommendation(text) {
  const json = text.match(/\{[\s\S]*\}/)?.[0]
  if (!json) throw new Error('Respons AI tidak berisi saran terstruktur. Silakan coba lagi.')

  let recommendation
  try {
    recommendation = JSON.parse(json)
  } catch {
    throw new Error('Respons AI tidak dapat dibaca. Silakan coba lagi.')
  }

  const preset = ['photo', 'document', 'illustration'].includes(recommendation.preset)
    ? recommendation.preset
    : null
  const scale = [2, 4].includes(Number(recommendation.scale)) ? Number(recommendation.scale) : null
  const blur = ['low', 'medium', 'high'].includes(recommendation.blur) ? recommendation.blur : null
  const explanation = typeof recommendation.explanation === 'string'
    ? recommendation.explanation.trim().slice(0, 360)
    : ''

  if (!preset || !scale || !blur || !explanation) {
    throw new Error('Saran AI tidak lengkap atau tidak valid. Silakan coba lagi.')
  }
  return { preset, scale, blur, explanation }
}

export async function analyzeImageWithPuter(file, signal) {
  const puter = await loadPuter()
  if (!puter.auth?.isSignedIn?.()) {
    throw new Error('Masuk ke akun Puter terlebih dahulu untuk menggunakan saran AI.')
  }
  if (signal.aborted) throw new DOMException('Analisis dibatalkan.', 'AbortError')

  const prompt = [
    'Periksa gambar yang diberikan untuk menyarankan pengaturan peningkatan resolusi.',
    'Jangan mengarang isi gambar atau mengklaim bahwa detail hasil akan akurat.',
    'Balas hanya satu objek JSON valid dengan field:',
    '{"preset":"photo|document|illustration","scale":2|4,"blur":"low|medium|high","explanation":"alasan singkat dalam Bahasa Indonesia"}.',
    'Pilih document untuk dokumen/teks, illustration untuk ilustrasi/anime/grafis, selain itu photo.',
    'Pilih skala 2 jika gambar tampak cukup jelas atau detail kecil berisiko berubah; pilih 4 hanya bila pembesaran lebih besar layak dicoba.',
    'Tingkat blur adalah perkiraan subjektif, bukan pengukuran.',
  ].join(' ')
  const response = await puter.ai.chat(prompt, file, false, {
    model: 'gpt-5.4-nano',
    max_tokens: 220,
    temperature: 0.1,
    signal,
  })

  if (signal.aborted) throw new DOMException('Analisis dibatalkan.', 'AbortError')
  return parseRecommendation(readResponseText(response))
}

export async function recognizeTextWithPuter(blob) {
  const puter = await loadPuter()
  if (!puter.auth?.isSignedIn?.()) {
    throw new Error('Masuk ke akun Puter terlebih dahulu untuk menggunakan OCR.')
  }
  if (!puter.ai?.img2txt) throw new Error('Fitur OCR Puter tidak tersedia pada SDK ini.')

  const text = await puter.ai.img2txt(blob, { provider: 'mistral' })
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('OCR tidak menemukan teks yang dapat dibaca pada hasil gambar.')
  }
  return text.trim()
}
