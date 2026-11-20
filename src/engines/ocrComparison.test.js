import assert from 'node:assert/strict'
import test from 'node:test'
import { getChangedTokenIndices } from './ocrComparison.js'

test('does not mark matching OCR tokens across different line breaks', () => {
  assert.deepEqual([...getChangedTokenIndices('Nama\n2026', 'Nama 2026')], [])
})

test('marks substituted and missing OCR tokens', () => {
  assert.deepEqual([...getChangedTokenIndices('Nama 2026 Kota', 'Nama 2028')], [1, 2])
})

test('matches OCR tokens without regard to case or repeated whitespace', () => {
  assert.deepEqual([...getChangedTokenIndices('Sertifikat   ASLI', 'sertifikat\nasli')], [])
})
