const MAX_OCR_PIXELS = 6_000_000
const MAX_OCR_SIDE = 1_500
const MAX_UPSCALE = 3

export async function prepareOcrImage(blob) {
  const bitmap = await createImageBitmap(blob)
  try {
    const scale = Math.min(
      MAX_UPSCALE,
      MAX_OCR_SIDE / Math.max(bitmap.width, bitmap.height),
      Math.sqrt(MAX_OCR_PIXELS / (bitmap.width * bitmap.height)),
    )
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Browser tidak dapat menyiapkan gambar untuk OCR.')

    context.fillStyle = '#fff'
    context.fillRect(0, 0, width, height)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, width, height)

    const image = context.getImageData(0, 0, width, height)
    for (let index = 0; index < image.data.length; index += 4) {
      const luminance = (
        image.data[index] * 0.299 +
        image.data[index + 1] * 0.587 +
        image.data[index + 2] * 0.114
      )
      const contrast = Math.max(0, Math.min(255, (luminance - 128) * 1.3 + 128))
      image.data[index] = contrast
      image.data[index + 1] = contrast
      image.data[index + 2] = contrast
      image.data[index + 3] = 255
    }
    context.putImageData(image, 0, 0)
    return await new Promise((resolve, reject) => {
      canvas.toBlob((prepared) => {
        if (prepared) resolve(prepared)
        else reject(new Error('Browser gagal menyiapkan gambar untuk OCR.'))
      }, 'image/png')
    })
  } finally {
    bitmap.close()
  }
}
