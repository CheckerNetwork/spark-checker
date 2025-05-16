import { test } from 'zinnia:test'
import { assertEquals } from 'zinnia:assert'
import { retrievalMetrics } from '../lib/metrics.js'

test('retrievalMetrics resets correctly', () => {
  retrievalMetrics.reset()
  const snap = retrievalMetrics.getSnapshot()

  assertEquals(snap.total, 0)
  assertEquals(snap.failed, 0)
  assertEquals(snap.uniquePairCount, 0)
})

test('retrievalMetrics counts retrievals and failures', () => {
  retrievalMetrics.reset()

  retrievalMetrics.recordRetrieval('cid1', 'sp1')
  retrievalMetrics.recordRetrieval('cid2', 'sp2')
  retrievalMetrics.recordFailure()

  const snap = retrievalMetrics.getSnapshot()

  assertEquals(snap.total, 2)
  assertEquals(snap.failed, 1)
  assertEquals(snap.uniquePairCount, 2)
})

test('retrievalMetrics deduplicates (PayloadCID, SP) pairs', () => {
  retrievalMetrics.reset()

  retrievalMetrics.recordRetrieval('cid1', 'sp1')
  retrievalMetrics.recordRetrieval('cid1', 'sp1')
  retrievalMetrics.recordRetrieval('cid2', 'sp2')

  const snap = retrievalMetrics.getSnapshot()

  assertEquals(snap.total, 3)
  assertEquals(snap.uniquePairCount, 2)
})

test('retrievalMetrics roundIndex increments on reset', () => {
  const before = retrievalMetrics.roundIndex
  retrievalMetrics.reset()
  const after = retrievalMetrics.roundIndex

  assertEquals(after, before + 1)
})
