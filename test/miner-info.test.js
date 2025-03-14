import { test } from 'zinnia:test'
import { assertMatch, AssertionError } from 'zinnia:assert'
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
      `Expected "getIndexProviderPeerId()" to fail, but it resolved with "${result}" instead.`
    )
  } catch (err) {
    assertMatch(err.cause.toString(), /\bf010\b.*\bactor code is not miner/)
  }
})
