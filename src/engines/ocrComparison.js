function tokenize(text) {
  return text.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]+/gu) || []
}

function normalizeToken(token) {
  return token.toLocaleLowerCase()
}

function computeChangedTokenIndices(left, right) {
  const changed = new Set()
  const cells = (left.length + 1) * (right.length + 1)

  if (cells > 1_000_000) {
    let prefix = 0
    while (
      prefix < left.length &&
      prefix < right.length &&
      normalizeToken(left[prefix]) === normalizeToken(right[prefix])
    ) prefix += 1
    let leftEnd = left.length
    let rightEnd = right.length
    while (
      leftEnd > prefix &&
      rightEnd > prefix &&
      normalizeToken(left[leftEnd - 1]) === normalizeToken(right[rightEnd - 1])
    ) {
      leftEnd -= 1
      rightEnd -= 1
    }
    for (let index = prefix; index < leftEnd; index += 1) changed.add(index)
    return changed
  }

  const columns = right.length + 1
  const lengths = new Uint32Array(cells)
  for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex -= 1) {
      const index = leftIndex * columns + rightIndex
      if (normalizeToken(left[leftIndex]) === normalizeToken(right[rightIndex])) {
        lengths[index] = lengths[(leftIndex + 1) * columns + rightIndex + 1] + 1
      } else {
        lengths[index] = Math.max(
          lengths[(leftIndex + 1) * columns + rightIndex],
          lengths[leftIndex * columns + rightIndex + 1],
        )
      }
    }
  }

  let leftIndex = 0
  let rightIndex = 0
  while (leftIndex < left.length && rightIndex < right.length) {
    if (normalizeToken(left[leftIndex]) === normalizeToken(right[rightIndex])) {
      leftIndex += 1
      rightIndex += 1
    } else if (
      lengths[(leftIndex + 1) * columns + rightIndex] >=
      lengths[leftIndex * columns + rightIndex + 1]
    ) {
      changed.add(leftIndex)
      leftIndex += 1
    } else {
      rightIndex += 1
    }
  }
  while (leftIndex < left.length) {
    changed.add(leftIndex)
    leftIndex += 1
  }
  return changed
}

export function getChangedTokenIndices(text, comparisonText) {
  return computeChangedTokenIndices(tokenize(text), tokenize(comparisonText))
}
