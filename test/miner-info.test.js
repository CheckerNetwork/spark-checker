import { test } from 'zinnia:test'
import { assertMatch, AssertionError, assert, assertEquals } from 'zinnia:assert'
import { getIndexProviderPeerId } from '../lib/miner-info.js'

const KNOWN_MINER_ID = 'f0142637'

test('get peer id of a known miner', async () => {
  const result = await getIndexProviderPeerId(KNOWN_MINER_ID)
  assertMatch(result, /^12D3KooW/)
})

test('get peer id of a miner that does not exist', async () => {
  try {
    const result = await getIndexProviderPeerId('f010', { maxAttempts: 1 })
    throw new AssertionError(
      `Expected "getIndexProviderPeerId()" to fail, but it resolved with "${result}" instead.`,
    )
  } catch (err) {
    assertMatch(err.toString(), /Error fetching index provider PeerID for miner f010/)
  }
})

test('getIndexProviderPeerId returns correct peer id for miner f03303347', async () => {
  const peerId = await getIndexProviderPeerId('f03303347')

  assert(typeof peerId === 'string', 'Expected peerId to be a string')
  assertEquals(peerId, '12D3KooWJ91c6xQshrNe7QAXPFAaeRrHWq2UrgXGPf8UmMZMwyZ5')
})
