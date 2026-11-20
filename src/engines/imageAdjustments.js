export function adjustPixelChannel(value, neighborAverage, sharpen, contrast) {
  const sharpenAmount = (sharpen / 100) * 0.8
  const sharpened = value + (value - neighborAverage) * sharpenAmount
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast))
  return Math.round(Math.max(0, Math.min(255, (sharpened - 128) * contrastFactor + 128)))
}
