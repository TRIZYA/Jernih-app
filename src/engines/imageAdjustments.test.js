import assert from 'node:assert/strict'
import test from 'node:test'
import { adjustPixelChannel } from './imageAdjustments.js'

test('keeps a pixel unchanged when sharpening and contrast are disabled', () => {
  assert.equal(adjustPixelChannel(120, 80, 0, 0), 120)
})

test('sharpens edges using the neighboring pixel average', () => {
  assert.equal(adjustPixelChannel(120, 80, 50, 0), 136)
})

test('increases contrast around the midpoint', () => {
  assert.equal(adjustPixelChannel(200, 200, 0, 20), 212)
})

test('clamps adjusted values to the valid color range', () => {
  assert.equal(adjustPixelChannel(255, 0, 100, 30), 255)
  assert.equal(adjustPixelChannel(0, 255, 100, 30), 0)
})
